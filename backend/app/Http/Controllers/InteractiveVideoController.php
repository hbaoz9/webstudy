<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InteractiveVideoController extends Controller
{
    private function exact(Request $request, array $allowed): void
    {
        foreach (array_keys($request->all()) as $field) {
            if (!in_array($field, $allowed, true)) {
                throw ValidationException::withMessages([$field => 'Trường không hợp lệ.']);
            }
        }
    }

    private function videoInput(Request $request, bool $update): array
    {
        $this->exact($request, array_merge(['title', 'youtubeId', 'lessonId', 'checkpoints'], $update ? ['expectedVersion'] : []));
        $data = Validator::make($request->all(), [
            'title' => 'required|string|max:300',
            'youtubeId' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{11}$/D'],
            'lessonId' => 'sometimes|nullable|string|max:32|exists:curriculum_lessons,id',
            'checkpoints' => 'present|array|max:200',
            'checkpoints.*' => 'required|array',
            'checkpoints.*.id' => 'required|string|max:100',
            'checkpoints.*.atSeconds' => 'required|integer|min:0|max:86400',
            'checkpoints.*.prompt' => 'required|string|max:5000',
            'checkpoints.*.options' => 'required|array',
            'checkpoints.*.options.A' => 'required|string|max:1000',
            'checkpoints.*.options.B' => 'required|string|max:1000',
            'checkpoints.*.options.C' => 'required|string|max:1000',
            'checkpoints.*.options.D' => 'required|string|max:1000',
            'checkpoints.*.correctOption' => 'required|in:A,B,C,D',
            'expectedVersion' => $update ? 'required|integer|min:1' : 'prohibited',
        ])->validate();
        $data['title'] = trim($data['title']);
        if ($data['title'] === '') throw ValidationException::withMessages(['title' => 'Nhập tên video.']);
        $ids = []; $times = [];
        foreach ($data['checkpoints'] as $index => &$checkpoint) {
            foreach (array_keys($checkpoint) as $field) {
                if (!in_array($field, ['id', 'atSeconds', 'prompt', 'options', 'correctOption'], true)) {
                    throw ValidationException::withMessages(["checkpoints.$index.$field" => 'Trường không hợp lệ.']);
                }
            }
            $optionKeys = array_keys($checkpoint['options']);
            sort($optionKeys);
            if ($optionKeys !== ['A', 'B', 'C', 'D']) {
                throw ValidationException::withMessages(["checkpoints.$index.options" => 'Cần đúng bốn phương án A–D.']);
            }
            $checkpoint['prompt'] = trim($checkpoint['prompt']);
            if ($checkpoint['prompt'] === '') throw ValidationException::withMessages(["checkpoints.$index.prompt" => 'Nhập câu hỏi.']);
            foreach ($checkpoint['options'] as $letter => &$text) {
                $text = trim($text);
                if ($text === '') throw ValidationException::withMessages(["checkpoints.$index.options.$letter" => 'Nhập phương án.']);
            }
            unset($text);
            if (isset($ids[$checkpoint['id']]) || isset($times[$checkpoint['atSeconds']])) {
                throw ValidationException::withMessages(["checkpoints.$index" => 'Mã hoặc thời điểm câu hỏi bị trùng.']);
            }
            $ids[$checkpoint['id']] = true;
            $times[$checkpoint['atSeconds']] = true;
        }
        unset($checkpoint);
        return $data;
    }

    private function own(Request $request, string $id, bool $lock = false): object
    {
        $query = DB::table('interactive_videos')->where('id', $id)
            ->where('teacher_id', $request->user()->id)->whereNull('deleted_at');
        return ($lock ? $query->lockForUpdate() : $query)->first() ?? abort(404);
    }

    private function conflict(): never
    {
        abort(response()->json(['message' => 'Dữ liệu đã thay đổi. Tải lại trước khi lưu.', 'code' => 'version_conflict'], 409));
    }

    private function teacherResource(object $video): array
    {
        $publications = DB::table('interactive_video_publications')->where('video_id', $video->id)
            ->whereNull('withdrawn_at')->orderBy('classroom_id')->get();
        return ['id' => $video->id, 'title' => $video->title, 'youtubeId' => $video->youtube_id,
            'lessonId' => $video->curriculum_lesson_id, 'checkpoints' => json_decode($video->draft_checkpoints, true),
            'version' => $video->version, 'status' => $publications->isEmpty() ? 'draft' : 'published',
            'classroomIds' => $publications->pluck('classroom_id')->all(),
            'publications' => $publications->map(fn ($item) => ['id' => $item->id,
                'classroomId' => $item->classroom_id, 'snapshot' => json_decode($item->snapshot, true),
                'publishedAt' => $item->published_at])->all(),
            'publishedAt' => $publications->max('published_at'),
            'createdAt' => $video->created_at, 'updatedAt' => $video->updated_at];
    }

    public function teacherIndex(Request $request): JsonResponse
    {
        $page = DB::table('interactive_videos')->where('teacher_id', $request->user()->id)
            ->whereNull('deleted_at')->orderByDesc('created_at')->orderBy('id')->paginate(20);
        return response()->json(['data' => $page->getCollection()->map(fn ($item) => $this->teacherResource($item))->all(),
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()],
            'meta' => ['currentPage' => $page->currentPage(), 'lastPage' => $page->lastPage(), 'total' => $page->total()]]);
    }

    public function teacherShow(Request $request, string $video): JsonResponse
    {
        return response()->json(['data' => $this->teacherResource($this->own($request, $video))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->videoInput($request, false);
        $id = (string) Str::uuid(); $now = now();
        DB::table('interactive_videos')->insert(['id' => $id, 'teacher_id' => $request->user()->id,
            'curriculum_lesson_id' => $data['lessonId'] ?? null, 'title' => $data['title'],
            'youtube_id' => $data['youtubeId'], 'draft_checkpoints' => json_encode($data['checkpoints'], JSON_THROW_ON_ERROR),
            'version' => 1, 'created_at' => $now, 'updated_at' => $now]);
        return response()->json(['data' => $this->teacherResource($this->own($request, $id))], 201);
    }

    public function update(Request $request, string $video): JsonResponse
    {
        $this->own($request, $video);
        $data = $this->videoInput($request, true);
        $item = DB::transaction(function () use ($request, $video, $data) {
            $row = $this->own($request, $video, true);
            if ($row->version !== $data['expectedVersion']) $this->conflict();
            DB::table('interactive_videos')->where('id', $video)->update([
                'title' => $data['title'], 'youtube_id' => $data['youtubeId'],
                'curriculum_lesson_id' => $data['lessonId'] ?? null,
                'draft_checkpoints' => json_encode($data['checkpoints'], JSON_THROW_ON_ERROR),
                'version' => $row->version + 1, 'updated_at' => now(),
            ]);
            return $this->own($request, $video);
        }, 3);
        return response()->json(['data' => $this->teacherResource($item)]);
    }

    public function destroy(Request $request, string $video): JsonResponse
    {
        $this->exact($request, ['expectedVersion']);
        $data = $request->validate(['expectedVersion' => 'required|integer|min:1']);
        DB::transaction(function () use ($request, $video, $data) {
            $row = $this->own($request, $video, true);
            if ($row->version !== $data['expectedVersion']) $this->conflict();
            $now = now();
            DB::table('interactive_video_publications')->where('video_id', $video)->whereNull('withdrawn_at')->update(['withdrawn_at' => $now]);
            DB::table('interactive_videos')->where('id', $video)->update(['deleted_at' => $now, 'version' => $row->version + 1, 'updated_at' => $now]);
        }, 3);
        return response()->json(null, 204);
    }

    public function publish(Request $request, string $video): JsonResponse
    {
        $this->exact($request, ['classroomIds', 'expectedVersion']);
        $data = $request->validate(['classroomIds' => 'present|array|max:100',
            'classroomIds.*' => 'required|uuid|distinct', 'expectedVersion' => 'required|integer|min:1']);
        $item = DB::transaction(function () use ($request, $video, $data) {
            $row = $this->own($request, $video, true);
            if ($row->version !== $data['expectedVersion']) $this->conflict();
            $ids = $data['classroomIds'];
            $owned = DB::table('classrooms')->whereIn('id', $ids)->where('teacher_id', $request->user()->id)
                ->where('status', 'active')->whereNull('deleted_at')->count();
            if ($owned !== count($ids)) throw ValidationException::withMessages(['classroomIds' => 'Có lớp không khả dụng.']);
            $now = now();
            $snapshot = json_encode(['title' => $row->title, 'youtubeId' => $row->youtube_id,
                'lessonId' => $row->curriculum_lesson_id,
                'checkpoints' => json_decode($row->draft_checkpoints, true)], JSON_THROW_ON_ERROR);
            foreach ($ids as $classId) {
                DB::table('interactive_video_publications')->updateOrInsert(['video_id' => $video, 'classroom_id' => $classId], [
                    'id' => DB::table('interactive_video_publications')->where('video_id', $video)->where('classroom_id', $classId)->value('id') ?? (string) Str::uuid(),
                    'snapshot' => $snapshot, 'published_at' => $now, 'withdrawn_at' => null,
                ]);
            }
            $withdraw = DB::table('interactive_video_publications')->where('video_id', $video)->whereNull('withdrawn_at');
            if ($ids) $withdraw->whereNotIn('classroom_id', $ids);
            $withdraw->update(['withdrawn_at' => $now]);
            DB::table('interactive_videos')->where('id', $video)->update(['version' => $row->version + 1, 'updated_at' => $now]);
            return $this->own($request, $video);
        }, 3);
        return response()->json(['data' => $this->teacherResource($item)]);
    }

    private function studentQuery(Request $request)
    {
        return DB::table('interactive_video_publications as p')
            ->join('interactive_videos as v', 'v.id', '=', 'p.video_id')
            ->join('classrooms as c', 'c.id', '=', 'p.classroom_id')
            ->join('class_memberships as m', 'm.classroom_id', '=', 'c.id')
            ->where('m.student_id', $request->user()->id)->where('m.status', 'active')
            ->where('c.status', 'active')->whereNull('c.deleted_at')
            ->whereColumn('v.teacher_id', 'c.teacher_id')
            ->whereNull('v.deleted_at')->whereNull('p.withdrawn_at');
    }

    private function studentResource(object $row): array
    {
        $snapshot = json_decode($row->snapshot, true);
        return ['id' => $row->id, 'videoId' => $row->video_id, 'classroomId' => $row->classroom_id,
            'classroomName' => $row->classroom_name, 'title' => $snapshot['title'],
            'youtubeId' => $snapshot['youtubeId'], 'lessonId' => $snapshot['lessonId'],
            'checkpoints' => $snapshot['checkpoints'], 'publishedAt' => $row->published_at];
    }

    public function studentIndex(Request $request): JsonResponse
    {
        $filter = Validator::make($request->query(), ['classroomId' => 'sometimes|uuid'])->validate()['classroomId'] ?? null;
        $page = $this->studentQuery($request)->when($filter, fn ($query) => $query->where('p.classroom_id', $filter))
            ->select('p.*', 'c.name as classroom_name')
            ->orderByDesc('p.published_at')->orderBy('p.id')->paginate(20);
        return response()->json(['data' => $page->getCollection()->map(fn ($row) => $this->studentResource($row))->all(),
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()],
            'meta' => ['currentPage' => $page->currentPage(), 'lastPage' => $page->lastPage(), 'total' => $page->total()]]);
    }

    public function studentShow(Request $request, string $publication): JsonResponse
    {
        $row = $this->studentQuery($request)->select('p.*', 'c.name as classroom_name')->where('p.id', $publication)->first();
        if (!$row) abort(404);
        return response()->json(['data' => $this->studentResource($row)]);
    }
}
