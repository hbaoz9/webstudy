<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Services\AttemptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class StudentAttemptController extends Controller
{
    private function key(Request $request): string
    {
        $key = $request->header('Idempotency-Key');
        if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key))
            throw ValidationException::withMessages(['Idempotency-Key' => 'Mã yêu cầu không hợp lệ.']);
        return $key;
    }

    private function own(Request $request, string $id): object
    {
        return DB::table('student_attempts')->where('id', $id)->where('student_id', $request->user()->id)->first() ?? abort(404);
    }

    public function eligibility(Request $request, string $distribution, AttemptService $service): JsonResponse
    {
        $item = Distribution::findOrFail($distribution);
        $active = DB::table('class_memberships')->where('classroom_id', $item->classroom_id)
            ->where('student_id', $request->user()->id)->where('status', 'active')->exists();
        $history = DB::table('student_attempts')->where('distribution_id', $item->id)
            ->where('student_id', $request->user()->id)->exists();
        if (!$active && !$history) abort(404);
        return response()->json(['data' => $service->eligibility($item, $request->user())]);
    }

    public function start(Request $request, string $distribution, AttemptService $service): JsonResponse
    {
        if (!config('distribution.student_attempt_enabled', false)
            || !config('distribution.student_visibility_enabled', false))
            return response()->json(['message' => 'Bài làm chưa được mở.', 'code' => 'attempt_release_locked'], 423);
        $item = Distribution::findOrFail($distribution);
        return response()->json(['data' => $service->start($item, $request->user(), $this->key($request))], 201);
    }

    public function show(Request $request, string $attempt, AttemptService $service): JsonResponse
    {
        $this->own($request, $attempt);
        $service->timeout($attempt);
        return response()->json(['data' => $service->attemptResource($attempt, true)]);
    }

    public function save(Request $request, string $attempt, string $question, AttemptService $service): JsonResponse
    {
        $this->own($request, $attempt);
        $data = $request->validate(['expectedVersion' => 'required|integer|min:0', 'answer' => 'present|nullable|array']);
        if (count(array_diff(array_keys($request->all()), ['expectedVersion','answer'])) !== 0)
            throw ValidationException::withMessages(['request' => 'Dữ liệu không hợp lệ.']);
        return response()->json(['data' => $service->saveAnswer($attempt, $question, $request->user(),
            $data['answer'], $data['expectedVersion'], $this->key($request))]);
    }

    public function submit(Request $request, string $attempt, AttemptService $service): JsonResponse
    {
        $this->own($request, $attempt);
        if ($request->all() !== []) throw ValidationException::withMessages(['request' => 'Dữ liệu không hợp lệ.']);
        return response()->json(['data' => $service->submit($attempt, $request->user(), $this->key($request))]);
    }

    public function history(Request $request, string $distribution, AttemptService $service): JsonResponse
    {
        $query = DB::table('student_attempts')->where('distribution_id', $distribution)->where('student_id', $request->user()->id);
        if (!$query->exists()) abort(404);
        $data = Validator::make($request->query(), ['perPage' => 'sometimes|integer|min:1|max:100'])->validate();
        $page = $query->orderByDesc('attempt_no')->paginate($data['perPage'] ?? 20);
        foreach ($page->items() as $row) $service->timeout($row->id);
        return response()->json(['data' => $page->getCollection()->map(fn ($row) => $service->attemptResource($row->id))->all(),
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()],
            'meta' => ['currentPage' => $page->currentPage(), 'total' => $page->total()]]);
    }

    public function result(Request $request, string $distribution, AttemptService $service): JsonResponse
    {
        $item = Distribution::findOrFail($distribution);
        $student = $request->user();
        if (!DB::table('student_attempts')->where('distribution_id', $item->id)->where('student_id', $student->id)->exists()) abort(404);
        $due = DB::table('student_attempts')->where('distribution_id', $item->id)->where('student_id', $student->id)
            ->where('status', 'IN_PROGRESS')->where('expires_at', '<=', now())->pluck('id');
        foreach ($due as $id) $service->timeout($id);
        $service->refreshResult($item, $student);
        $result = DB::table('assessment_results')->where('distribution_id', $item->id)->where('student_id', $student->id)->first();
        $active = DB::table('student_attempts')->where('distribution_id', $item->id)->where('status', 'IN_PROGRESS')->exists();
        $late = DB::table('student_distribution_exceptions')->where('distribution_id', $item->id)
            ->where('late_start_until', '>', now())->exists();
        $ended = !$active && ($item->lifecycle_status === 'closed'
            || ($item->lifecycle_status === 'active' && now()->gte($item->deadline_at) && !$late));
        $generation = $result?->active_generation ?? 1;
        $scoreVisible = $item->lifecycle_status !== 'cancelled' && match ($item->score_release_mode ?? 'AFTER_DISTRIBUTION_ENDED_AND_GRADED') {
            'AFTER_ATTEMPT_GRADED' => $result && in_array($result->status, ['PROVISIONAL','FINAL'], true),
            'MANUAL' => $result && in_array($result->status, ['PROVISIONAL', 'FINAL'], true)
                && DB::table('result_publications')->where('distribution_id', $item->id)
                ->where('publication_type', 'SCORE')->where('generation', $generation)->exists(),
            default => $ended && $result?->status === 'FINAL',
        };
        $answerVisible = $item->lifecycle_status !== 'cancelled' && $ended && $item->answer_release_mode !== 'NEVER'
            && DB::table('result_publications')->where('distribution_id', $item->id)->where('publication_type', 'ANSWERS')->exists();
        $data = ['status' => $result?->status ?? 'PENDING_GRADING', 'scoreVisible' => $scoreVisible,
            'answerVisible' => $answerVisible, 'aggregateScore' => $scoreVisible ? $result?->aggregate_score : null];
        if (($item->score_release_mode ?? '') === 'AFTER_ATTEMPT_GRADED') {
            $data['attemptScores'] = DB::table('student_attempts')->where('distribution_id', $item->id)
                ->where('student_id', $student->id)->orderBy('attempt_no')->get()
                ->map(fn ($a) => ['attemptId' => $a->id, 'attemptNo' => $a->attempt_no,
                    'gradingStatus' => $a->grading_status,
                    'score' => $item->lifecycle_status !== 'cancelled' && $a->grading_status === 'GRADED'
                        && !in_array($a->status, ['REVOKED','CANCELLED'], true)
                        ? $a->total_score : null])->all();
        }
        if ($answerVisible) $data['answers'] = DB::table('revision_questions')->where('revision_id', $item->revision_id)
            ->orderBy('position')->get(['id','answer_key','explanation'])->map(fn ($q) => ['questionId' => $q->id,
                'invalidated' => DB::table('revision_question_invalidations')->where('revision_question_id', $q->id)->exists(),
                'answerKey' => DB::table('revision_question_invalidations')->where('revision_question_id', $q->id)->exists()
                    ? null : ($q->answer_key ? json_decode($q->answer_key, true) : null),
                'explanation' => $q->explanation])->all();
        return response()->json(['data' => $data]);
    }
}
