<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class InfographicAssetController extends Controller
{
    private function own(Request $request, string $id, bool $lock = false): object
    {
        $query = DB::table('infographic_assets')->where('id', $id)
            ->where('teacher_id', $request->user()->id)->whereNull('deleted_at');

        return ($lock ? $query->lockForUpdate() : $query)->first() ?? abort(404);
    }

    private function resource(object $row, bool $student = false): array
    {
        return ['id' => $row->id, 'title' => $row->title,
            'chapterId' => $row->curriculum_chapter_id, 'lessonId' => $row->curriculum_lesson_id,
            'mimeType' => $row->mime_type, 'byteSize' => $row->byte_size,
            'imageUrl' => '/api/'.($student ? 'student' : 'teacher').'/infographics/'.$row->id.'/file',
            'publishedAt' => $row->published_at ?? null,
            ...($student ? [] : ['version' => $row->version,
                'classroomIds' => DB::table('infographic_asset_publications')->where('asset_id', $row->id)
                    ->whereNull('withdrawn_at')->pluck('classroom_id')->all()]),
        ];
    }

    public function teacherIndex(Request $request): JsonResponse
    {
        $query = DB::table('infographic_assets')->where('teacher_id', $request->user()->id)->whereNull('deleted_at');
        $input = Validator::make($request->query(), ['chapterId' => 'sometimes|string|max:32',
            'lessonId' => 'sometimes|string|max:32'])->validate();
        if (isset($input['chapterId'])) $query->where('curriculum_chapter_id', $input['chapterId']);
        if (isset($input['lessonId'])) $query->where('curriculum_lesson_id', $input['lessonId']);
        $page = $query->orderByDesc('created_at')->orderBy('id')->paginate(20);

        return response()->json(['data' => $page->getCollection()->map(fn ($row) => $this->resource($row))->all(),
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()],
            'meta' => ['currentPage' => $page->currentPage(), 'lastPage' => $page->lastPage(), 'total' => $page->total()]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['title' => 'required|string|max:200',
            'chapterId' => 'required|string|max:32|exists:curriculum_chapters,id',
            'lessonId' => 'sometimes|nullable|string|max:32|exists:curriculum_lessons,id',
            'image' => 'required|file|max:15360|mimes:png,jpg,jpeg,webp']);
        if (array_diff(array_keys($request->all()), ['title', 'chapterId', 'lessonId', 'image'])) {
            throw ValidationException::withMessages(['image' => 'Dữ liệu tải lên không hợp lệ.']);
        }
        $title = trim($data['title']);
        if ($title === '') throw ValidationException::withMessages(['title' => 'Nhập tên infographic.']);
        if (isset($data['lessonId']) && !DB::table('curriculum_lessons')->where('id', $data['lessonId'])
            ->where('chapter_id', $data['chapterId'])->exists()) {
            throw ValidationException::withMessages(['lessonId' => 'Bài học không thuộc chương đã chọn.']);
        }
        $image = $request->file('image');
        $mime = $image->getMimeType();
        if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)
            || !@getimagesize($image->getRealPath())) {
            throw ValidationException::withMessages(['image' => 'Ảnh PNG, JPEG hoặc WebP không hợp lệ.']);
        }
        $id = (string) Str::uuid();
        $path = 'infographics/'.$id;
        if (!Storage::disk('local')->putFileAs('infographics', $image, $id)) {
            abort(500);
        }
        try {
            $now = now();
            DB::table('infographic_assets')->insert(['id' => $id, 'teacher_id' => $request->user()->id,
                'curriculum_chapter_id' => $data['chapterId'], 'curriculum_lesson_id' => $data['lessonId'] ?? null,
                'title' => $title, 'storage_path' => $path, 'mime_type' => $mime, 'byte_size' => $image->getSize(),
                'version' => 1, 'created_at' => $now, 'updated_at' => $now]);
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($path);
            throw $error;
        }

        return response()->json(['data' => $this->resource($this->own($request, $id))], 201);
    }

    public function teacherFile(Request $request, string $asset): BinaryFileResponse
    {
        return $this->file($this->own($request, $asset));
    }

    private function file(object $asset): BinaryFileResponse
    {
        if (!Storage::disk('local')->exists($asset->storage_path)) abort(404);

        return response()->file(Storage::disk('local')->path($asset->storage_path), [
            'Content-Type' => $asset->mime_type, 'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function publish(Request $request, string $asset): JsonResponse
    {
        $data = $request->validate(['classroomIds' => 'present|array|max:100',
            'classroomIds.*' => 'required|uuid|distinct', 'expectedVersion' => 'required|integer|min:1']);
        if (array_diff(array_keys($request->all()), ['classroomIds', 'expectedVersion'])) {
            throw ValidationException::withMessages(['classroomIds' => 'Dữ liệu không hợp lệ.']);
        }
        $row = DB::transaction(function () use ($request, $asset, $data) {
            $row = $this->own($request, $asset, true);
            if ($row->version !== $data['expectedVersion']) {
                abort(response()->json(['message' => 'Dữ liệu đã thay đổi.', 'code' => 'version_conflict'], 409));
            }
            $ids = $data['classroomIds'];
            $count = DB::table('classrooms')->whereIn('id', $ids)->where('teacher_id', $request->user()->id)
                ->where('status', 'active')->whereNull('deleted_at')->count();
            if ($count !== count($ids)) throw ValidationException::withMessages(['classroomIds' => 'Lớp không khả dụng.']);
            $now = now();
            foreach ($ids as $classId) {
                $existing = DB::table('infographic_asset_publications')->where('asset_id', $asset)
                    ->where('classroom_id', $classId)->first();
                if ($existing) {
                    DB::table('infographic_asset_publications')->where('id', $existing->id)
                        ->update(['published_at' => $now, 'withdrawn_at' => null]);
                } else {
                    DB::table('infographic_asset_publications')->insert(['id' => (string) Str::uuid(),
                        'asset_id' => $asset, 'classroom_id' => $classId, 'published_at' => $now]);
                }
            }
            $withdraw = DB::table('infographic_asset_publications')->where('asset_id', $asset)->whereNull('withdrawn_at');
            if ($ids) $withdraw->whereNotIn('classroom_id', $ids);
            $withdraw->update(['withdrawn_at' => $now]);
            DB::table('infographic_assets')->where('id', $asset)->update(['version' => $row->version + 1, 'updated_at' => $now]);

            return $this->own($request, $asset);
        }, 3);

        return response()->json(['data' => $this->resource($row)]);
    }

    private function studentQuery(Request $request)
    {
        return DB::table('infographic_assets as a')
            ->join('infographic_asset_publications as p', 'p.asset_id', '=', 'a.id')
            ->join('classrooms as c', 'c.id', '=', 'p.classroom_id')
            ->join('class_memberships as m', 'm.classroom_id', '=', 'c.id')
            ->where('m.student_id', $request->user()->id)->where('m.status', 'active')
            ->where('c.status', 'active')->whereNull('c.deleted_at')
            ->whereColumn('a.teacher_id', 'c.teacher_id')
            ->whereNull('a.deleted_at')->whereNull('p.withdrawn_at');
    }

    public function studentIndex(Request $request): JsonResponse
    {
        $data = Validator::make($request->query(), ['classroomId' => 'sometimes|uuid',
            'chapterId' => 'sometimes|string|max:32'])->validate();
        $query = $this->studentQuery($request);
        if (isset($data['classroomId'])) $query->where('p.classroom_id', $data['classroomId']);
        if (isset($data['chapterId'])) $query->where('a.curriculum_chapter_id', $data['chapterId']);
        $page = $query->select('a.*', 'p.published_at', 'p.classroom_id', 'c.name as classroom_name')
            ->orderByDesc('p.published_at')->orderBy('a.id')->paginate(20);

        return response()->json(['data' => $page->getCollection()->map(fn ($row) => [
            ...$this->resource($row, true), 'classroomId' => $row->classroom_id,
            'classroomName' => $row->classroom_name])->all(),
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()],
            'meta' => ['currentPage' => $page->currentPage(), 'lastPage' => $page->lastPage(), 'total' => $page->total()]]);
    }

    public function studentFile(Request $request, string $asset): BinaryFileResponse
    {
        $row = $this->studentQuery($request)->select('a.*')->where('a.id', $asset)->first();
        if (!$row) abort(404);

        return $this->file($row);
    }
}
