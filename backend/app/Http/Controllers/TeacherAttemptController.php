<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Services\AttemptService;
use App\Services\AttemptTeacherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class TeacherAttemptController extends Controller
{
    private function release(): void
    {
        if (!config('distribution.student_attempt_enabled', false))
            abort(response()->json(['message' => 'Chức năng bài làm chưa được mở.', 'code' => 'attempt_release_locked'], 423));
    }

    private function key(Request $request): string
    {
        $key = $request->header('Idempotency-Key');
        if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key))
            throw ValidationException::withMessages(['Idempotency-Key' => 'Mã yêu cầu không hợp lệ.']);
        return $key;
    }

    private function exact(Request $request, array $rules): array
    {
        foreach (array_keys($request->all()) as $field)
            if (!array_key_exists($field, $rules)) throw ValidationException::withMessages([$field => 'Trường không hợp lệ.']);
        return Validator::make($request->all(), $rules)->validate();
    }

    private function offset(array $data, array $fields): void
    {
        foreach ($fields as $field) {
            if (isset($data[$field]) && (!is_string($data[$field])
                || !preg_match('/(?:Z|[+-]\d{2}:\d{2})$/D', $data[$field])))
                throw ValidationException::withMessages([$field => 'Thời gian cần có múi giờ.']);
        }
    }

    private function owned(Request $request, string $id): Distribution
    {
        return Distribution::query()->where('teacher_id', $request->user()->id)->findOrFail($id);
    }

    private function ownAttempt(Request $request, string $id): object
    {
        return DB::table('student_attempts')->join('distributions', 'student_attempts.distribution_id', '=', 'distributions.id')
            ->where('student_attempts.id', $id)->where('distributions.teacher_id', $request->user()->id)
            ->select('student_attempts.*')->first() ?? abort(404);
    }

    public function attempts(Request $request, string $distribution): JsonResponse
    {
        $owned = $this->owned($request, $distribution);
        $filters = Validator::make($request->query(), [
            'page' => 'sometimes|integer|min:1',
            'q' => 'sometimes|string|max:100',
            'status' => 'sometimes|in:NOT_STARTED,IN_PROGRESS,PENDING_ESSAY,PENDING_GRADING,PENDING_REGRADE,GRADED,SUBMITTED,TIMED_OUT',
        ])->validate();
        if (($filters['status'] ?? '') === 'NOT_STARTED') {
            $query = DB::table('class_memberships')->join('users', 'users.id', '=', 'class_memberships.student_id')
                ->where('class_memberships.classroom_id', $owned->classroom_id)
                ->where('class_memberships.status', 'active')
                ->whereNotExists(fn ($subquery) => $subquery->selectRaw('1')->from('student_attempts')
                    ->where('student_attempts.distribution_id', $distribution)
                    ->whereColumn('student_attempts.student_id', 'class_memberships.student_id'));
            if (isset($filters['q']) && trim($filters['q']) !== '')
                $query->whereRaw("LOWER(users.name) LIKE ? ESCAPE '!'", [$this->namePattern($filters['q'])]);
            $page = $query->select('users.id', 'users.name')->orderBy('users.name')->orderBy('users.id')->paginate(20);
            return response()->json(['data' => $page->getCollection()->map(fn ($student) => [
                'id' => null, 'studentId' => $student->id, 'studentName' => $student->name,
                'status' => 'NOT_STARTED', 'gradingStatus' => 'NOT_GRADED', 'attemptNo' => 0,
            ])->all(), 'meta' => $this->statusMeta($distribution) +
                ['total' => $page->total(), 'currentPage' => $page->currentPage(), 'perPage' => $page->perPage()],
                'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()]]);
        }
        $query = DB::table('student_attempts')->join('users', 'users.id', '=', 'student_attempts.student_id')
            ->where('student_attempts.distribution_id', $distribution)
            ->select('student_attempts.*', 'users.name as student_name');
        if (isset($filters['q']) && trim($filters['q']) !== '') {
            $query->whereRaw("LOWER(users.name) LIKE ? ESCAPE '!'", [$this->namePattern($filters['q'])]);
        }
        if (isset($filters['status'])) {
            if (in_array($filters['status'], ['IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT'], true))
                $query->where('student_attempts.status', $filters['status']);
            else $query->where('student_attempts.grading_status', $filters['status']);
        }
        $page = $query->orderByRaw("CASE WHEN student_attempts.grading_status IN ('PENDING_ESSAY', 'PENDING_GRADING') THEN 0 ELSE 1 END")
            ->orderByDesc('student_attempts.started_at')->orderBy('student_attempts.id')->paginate(20);
        return response()->json(['data' => $page->getCollection()->map(fn ($row) => $this->attemptSummary($row))->all(),
            'meta' => $this->statusMeta($distribution) +
                ['total' => $page->total(), 'currentPage' => $page->currentPage(), 'perPage' => $page->perPage()],
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()]]);
    }

    public function show(Request $request, string $attempt, AttemptService $service): JsonResponse
    {
        $this->ownAttempt($request, $attempt);
        $service->timeout($attempt);
        $data = $service->attemptResource($attempt, true);
        $data['studentId'] = $this->ownAttempt($request, $attempt)->student_id;
        $data['studentName'] = DB::table('users')->where('id', $data['studentId'])->value('name');
        $privateQuestions = DB::table('revision_questions')->where('revision_id', $data['revisionId'])
            ->get(['id', 'rubric', 'explanation'])->keyBy('id');
        $data['questions'] = array_map(function (array $question) use ($privateQuestions) {
            $private = $privateQuestions->get($question['id']);
            $question['rubric'] = $private?->rubric ? json_decode($private->rubric, true) : null;
            $question['explanation'] = $private?->explanation;
            return $question;
        }, $data['questions']);
        $scores = DB::table('student_attempts')->where('id', $attempt)->first(['auto_score', 'manual_score', 'total_score']);
        $data['autoScore'] = $this->score($scores->auto_score);
        $data['manualScore'] = $this->score($scores->manual_score);
        $data['totalScore'] = $this->score($scores->total_score);
        $generation = DB::table('assessment_results')->where('distribution_id', $data['distributionId'])
            ->where('student_id', $data['studentId'])->value('active_generation') ?? 1;
        $data['gradeItems'] = DB::table('attempt_grade_items')->where('attempt_id', $attempt)
            ->where('generation', $generation)
            ->orderBy('revision_question_id')->get()->map(fn ($item) => [
                'questionId' => $item->revision_question_id, 'generation' => $item->generation,
                'points' => $this->score($item->awarded_points), 'source' => $item->grading_source,
                'feedback' => $item->feedback, 'gradedBy' => $item->graded_by, 'gradedAt' => $item->graded_at,
            ])->all();
        return response()->json(['data' => $data]);
    }

    public function results(Request $request, string $distribution): JsonResponse
    {
        $this->owned($request, $distribution);
        $filters = Validator::make($request->query(), [
            'page' => 'sometimes|integer|min:1',
            'q' => 'sometimes|string|max:100',
            'status' => 'sometimes|in:PENDING_GRADING,PROVISIONAL,FINAL,PENDING_REGRADE,VOID',
        ])->validate();
        $query = DB::table('assessment_results')->join('users', 'users.id', '=', 'assessment_results.student_id')
            ->where('assessment_results.distribution_id', $distribution)
            ->select('assessment_results.*', 'users.name as student_name');
        if (isset($filters['status'])) $query->where('assessment_results.status', $filters['status']);
        if (isset($filters['q']) && trim($filters['q']) !== '')
            $query->whereRaw("LOWER(users.name) LIKE ? ESCAPE '!'", [$this->namePattern($filters['q'])]);
        $page = $query->orderByRaw("CASE assessment_results.status WHEN 'PENDING_GRADING' THEN 0 WHEN 'PENDING_REGRADE' THEN 1 WHEN 'PROVISIONAL' THEN 2 ELSE 3 END")
            ->orderBy('users.name')->orderBy('users.id')->paginate(20);
        return response()->json(['data' => $page->getCollection()->map(fn ($row) => [
            'studentId' => $row->student_id, 'studentName' => $row->student_name,
            'status' => $row->status, 'aggregateScore' => $this->score($row->aggregate_score),
            'activeGeneration' => $row->active_generation, 'calculatedAt' => $row->calculated_at,
        ])->all(), 'meta' => $this->statusMeta($distribution) +
            ['total' => $page->total(), 'currentPage' => $page->currentPage(), 'perPage' => $page->perPage()],
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()]]);
    }

    public function exceptions(Request $request, string $distribution): JsonResponse
    {
        $this->owned($request, $distribution);
        $page = DB::table('student_distribution_exceptions')->where('distribution_id', $distribution)
            ->orderBy('student_id')->paginate(20);
        return response()->json(['data' => $page->getCollection()->map(fn ($row) => [
            'studentId' => $row->student_id, 'lateStartUntil' => $row->late_start_until,
            'completionDeadlineAt' => $row->completion_deadline_at,
            'timeLimitSeconds' => $row->time_limit_seconds, 'version' => $row->version,
        ])->all(), 'meta' => ['total' => $page->total(), 'currentPage' => $page->currentPage(), 'perPage' => $page->perPage()],
            'links' => ['next' => $page->nextPageUrl(), 'prev' => $page->previousPageUrl()]]);
    }

    public function exception(Request $request, string $distribution, int $student, AttemptTeacherService $service): JsonResponse
    {
        $this->release();
        $data = $this->exact($request, ['lateStartUntil' => 'sometimes|nullable|date',
            'completionDeadlineAt' => 'sometimes|nullable|date', 'timeLimitSeconds' => 'sometimes|nullable|integer|min:60|max:14400',
            'expectedVersion' => 'required|integer|min:0', 'reason' => 'required|string|max:1000']);
        $this->offset($data, ['lateStartUntil','completionDeadlineAt']);
        if (trim($data['reason']) === '') throw ValidationException::withMessages(['reason' => 'Cần nêu lý do.']);
        return response()->json(['data' => $service->setException($request->user(), $distribution, $student, $data, $this->key($request))]);
    }

    public function grant(Request $request, string $distribution, int $student, AttemptTeacherService $service): JsonResponse
    {
        $this->release();
        $data = $this->exact($request, ['additionalAttempts' => 'required|integer|min:1|max:5', 'reason' => 'required|string|max:1000']);
        if (trim($data['reason']) === '') throw ValidationException::withMessages(['reason' => 'Cần nêu lý do.']);
        return response()->json(['data' => $service->grant($request->user(), $distribution, $student,
            $data['additionalAttempts'], trim($data['reason']), $this->key($request))]);
    }

    public function extend(Request $request, string $attempt, AttemptTeacherService $service): JsonResponse
    {
        $this->release();
        $data = $this->exact($request, ['expiresAt' => 'required|date', 'expectedVersion' => 'required|integer|min:1',
            'reason' => 'required|string|max:1000']);
        $this->offset($data, ['expiresAt']);
        if (trim($data['reason']) === '') throw ValidationException::withMessages(['reason' => 'Cần nêu lý do.']);
        return response()->json(['data' => $service->extend($request->user(), $attempt, $data, $this->key($request))]);
    }

    public function revoke(Request $request, string $attempt, AttemptTeacherService $service): JsonResponse
    {
        $this->release();
        $data = $this->exact($request, ['expectedVersion' => 'required|integer|min:1', 'reason' => 'required|string|max:1000']);
        if (trim($data['reason']) === '') throw ValidationException::withMessages(['reason' => 'Cần nêu lý do.']);
        return response()->json(['data' => $service->revoke($request->user(), $attempt, $data, $this->key($request))]);
    }

    public function grade(Request $request, string $attempt, string $question, AttemptTeacherService $service): JsonResponse
    {
        $this->release();
        $data = $this->exact($request, ['points' => ['required','regex:/^\d{1,6}(?:\.\d{1,6})?$/D'],
            'feedback' => 'sometimes|nullable|string|max:10000', 'reason' => 'sometimes|nullable|string|max:1000',
            'expectedVersion' => 'required|integer|min:1']);
        return response()->json(['data' => $service->gradeEssay($request->user(), $attempt, $question, $data, $this->key($request))]);
    }

    public function publishScores(Request $request, string $distribution, AttemptTeacherService $service): JsonResponse
    {
        $this->release();
        if ($request->all() !== []) throw ValidationException::withMessages(['request' => 'Dữ liệu không hợp lệ.']);
        return response()->json(['data' => $service->publish($request->user(), $distribution, 'SCORE', $this->key($request))]);
    }

    public function publishAnswers(Request $request, string $distribution, AttemptTeacherService $service): JsonResponse
    {
        $this->release();
        if ($request->all() !== []) throw ValidationException::withMessages(['request' => 'Dữ liệu không hợp lệ.']);
        return response()->json(['data' => $service->publish($request->user(), $distribution, 'ANSWERS', $this->key($request))]);
    }

    public function invalidate(Request $request, string $revision, string $question, AttemptTeacherService $service): JsonResponse
    {
        $this->release();
        $data = $this->exact($request, ['reason' => 'required|string|max:1000']);
        if (trim($data['reason']) === '') throw ValidationException::withMessages(['reason' => 'Cần nêu lý do.']);
        return response()->json(['data' => $service->invalidate($request->user(), $revision, $question,
            trim($data['reason']), $this->key($request))]);
    }

    public function regrade(Request $request, string $revision, string $run): JsonResponse
    {
        $owned = DB::table('assessment_revisions')->join('assessments', 'assessment_revisions.assessment_id', '=', 'assessments.id')
            ->where('assessment_revisions.id', $revision)->where('assessments.teacher_id', $request->user()->id)->exists();
        if (!$owned) abort(404);
        return response()->json(['data' => DB::table('regrade_runs')->where('id', $run)->where('revision_id', $revision)->first() ?? abort(404)]);
    }

    private function attemptSummary(object $row): array
    {
        return ['id' => $row->id, 'distributionId' => $row->distribution_id,
            'studentId' => $row->student_id, 'studentName' => $row->student_name,
            'attemptNo' => $row->attempt_no,
            'status' => $row->status, 'gradingStatus' => $row->grading_status,
            'startedAt' => $row->started_at, 'expiresAt' => $row->expires_at,
            'finalizedAt' => $row->finalized_at, 'autoScore' => $this->score($row->auto_score),
            'manualScore' => $this->score($row->manual_score), 'totalScore' => $this->score($row->total_score),
            'version' => $row->version];
    }

    private function namePattern(string $query): string
    {
        return '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower(trim($query))).'%';
    }

    private function score(int|float|string|null $value): ?string
    {
        if ($value === null) return null;
        return is_float($value) ? number_format($value, 6, '.', '') : bcadd((string) $value, '0', 6);
    }

    private function statusMeta(string $distribution): array
    {
        return [
            'pendingGrading' => DB::table('student_attempts')->where('distribution_id', $distribution)
                ->whereIn('grading_status', ['PENDING_ESSAY', 'PENDING_GRADING', 'PENDING_REGRADE'])->count(),
            'inProgress' => DB::table('student_attempts')->where('distribution_id', $distribution)
                ->where('status', 'IN_PROGRESS')->count(),
            'graded' => DB::table('student_attempts')->where('distribution_id', $distribution)
                ->where('grading_status', 'GRADED')->count(),
            'scoresPublished' => DB::table('result_publications')->where('distribution_id', $distribution)
                ->where('publication_type', 'SCORE')->exists(),
            'answersPublished' => DB::table('result_publications')->where('distribution_id', $distribution)
                ->where('publication_type', 'ANSWERS')->exists(),
        ];
    }
}
