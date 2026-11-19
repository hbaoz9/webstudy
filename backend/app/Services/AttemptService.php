<?php

namespace App\Services;

use App\Models\ClassMembership;
use App\Models\Classroom;
use App\Models\Distribution;
use App\Models\RevisionQuestion;
use App\Models\User;
use App\Http\Requests\SaveQuestionBankQuestionRequest;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\ValidationException;

class AttemptService
{
    public function serverNow(): CarbonImmutable
    {
        return CarbonImmutable::parse(DB::selectOne('select '.(DB::getDriverName() === 'pgsql' ? 'clock_timestamp()' : 'CURRENT_TIMESTAMP').' as at')->at);
    }

    private function conflict(string $code, string $message = 'Trạng thái bài làm đã thay đổi. Vui lòng tải lại.'): never
    {
        abort(response()->json(['message' => $message, 'code' => $code], 409));
    }

    public function lockDistribution(string $id, int $actorId): Distribution
    {
        User::query()->whereKey($actorId)->lockForUpdate()->firstOrFail();
        $classId = Distribution::query()->whereKey($id)->value('classroom_id');
        if (!$classId) abort(404);
        Classroom::withTrashed()->whereKey($classId)->lockForUpdate()->firstOrFail();
        return Distribution::query()->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    public function command(int $actorId, string $operation, string $scope, string $key, array $payload,
        callable $write, int $successStatus = 200): array
    {
        $keyHash = hash('sha256', $key);
        $hash = hash('sha256', json_encode($payload, JSON_THROW_ON_ERROR));
        $existing = DB::table('attempt_commands')->where('actor_id', $actorId)->where('operation', $operation)
            ->where('target_scope', $scope)->where('key_hash', $keyHash)->first();
        if ($existing) {
            if ($existing->request_hash !== $hash) $this->conflict('idempotency_conflict');
            return (array) json_decode($existing->response_payload, true, 512, JSON_THROW_ON_ERROR);
        }
        $response = $write();
        DB::table('attempt_commands')->insert([
            'id' => (string) Str::uuid(), 'actor_id' => $actorId, 'operation' => $operation,
            'target_scope' => $scope, 'key_hash' => $keyHash, 'request_hash' => $hash,
            'response_status' => $successStatus, 'response_payload' => json_encode($response, JSON_THROW_ON_ERROR),
            'created_at' => $this->serverNow(),
        ]);
        return $response;
    }

    private function exception(Distribution $distribution, int $studentId): ?object
    {
        return DB::table('student_distribution_exceptions')->where('distribution_id', $distribution->id)
            ->where('student_id', $studentId)->first();
    }

    private function used(Distribution $distribution, int $studentId): int
    {
        return DB::table('student_attempts')->where('distribution_id', $distribution->id)
            ->where('student_id', $studentId)->count();
    }

    private function quota(Distribution $distribution, int $studentId): int
    {
        return $distribution->max_attempts + (int) DB::table('attempt_quota_grants')
            ->where('distribution_id', $distribution->id)->where('student_id', $studentId)->sum('additional_attempts');
    }

    private function eligibilityFor(Distribution $distribution, int $studentId, CarbonImmutable $now): array
    {
        $exception = $this->exception($distribution, $studentId);
        $lateUntil = $exception?->late_start_until ? CarbonImmutable::parse($exception->late_start_until) : null;
        $deadline = CarbonImmutable::parse($distribution->deadline_at);
        $startDeadline = $lateUntil && $lateUntil->gt($deadline) ? $lateUntil : $deadline;
        $completionDeadline = $exception?->completion_deadline_at
            ? CarbonImmutable::parse($exception->completion_deadline_at) : $deadline;
        $limit = $exception?->time_limit_seconds ?? $distribution->time_limit_seconds;
        $used = $this->used($distribution, $studentId);
        $quota = $this->quota($distribution, $studentId);
        $membership = ClassMembership::query()->where('classroom_id', $distribution->classroom_id)
            ->where('student_id', $studentId)->where('status', 'active')->first();
        $classroom = Classroom::query()->whereKey($distribution->classroom_id)->where('status', 'active')->exists();
        $active = DB::table('student_attempts')->where('distribution_id', $distribution->id)
            ->where('student_id', $studentId)->where('status', 'IN_PROGRESS')->exists();
        $end = $now->addSeconds((int) $limit);
        if ($distribution->deadline_policy === 'HARD_DEADLINE' && $completionDeadline->lt($end)) $end = $completionDeadline;
        $reason = match (true) {
            !config('distribution.student_attempt_enabled', false)
                || !config('distribution.student_visibility_enabled', false) => 'release_locked',
            !$distribution->score_policy || !$distribution->score_release_mode || !$distribution->answer_release_mode => 'policy_unset',
            !$membership || !$classroom => 'membership_inactive',
            $distribution->lifecycle_status !== 'active' => 'distribution_unavailable',
            $now->lt($distribution->opens_at) => 'not_open',
            $now->gte($startDeadline) => 'deadline_passed',
            $used >= $quota => 'attempt_limit_reached',
            $active => 'attempt_in_progress',
            $end->lte($now) => 'no_remaining_time',
            default => null,
        };
        return [
            'canStart' => $reason === null, 'reasonCode' => $reason,
            'effectiveAttemptLimit' => $quota, 'usedAttempts' => $used,
            'remainingAttempts' => max(0, $quota - $used),
            'effectiveDeadlineAt' => $completionDeadline->toIso8601String(),
            'effectiveRemainingSeconds' => max(0, (int) $now->diffInSeconds($end, false)),
            'effectiveTimeLimitSeconds' => (int) $limit,
            'serverNow' => $now->toIso8601String(), 'membershipId' => $membership?->id,
            'startDeadlineAt' => $startDeadline->toIso8601String(),
        ];
    }

    public function eligibility(Distribution $distribution, User $student): array
    {
        $membershipHistory = ClassMembership::query()->where('classroom_id', $distribution->classroom_id)
            ->where('student_id', $student->id)->exists();
        $attemptHistory = DB::table('student_attempts')->where('distribution_id', $distribution->id)
            ->where('student_id', $student->id)->exists();
        if (!$membershipHistory && !$attemptHistory) abort(404);
        $state = $this->eligibilityFor($distribution, $student->id, $this->serverNow());
        unset($state['membershipId'], $state['effectiveTimeLimitSeconds'], $state['startDeadlineAt']);
        $state['canSaveAnswer'] = DB::table('student_attempts')->where('distribution_id', $distribution->id)
            ->where('student_id', $student->id)->where('status', 'IN_PROGRESS')->exists();
        $state['canSubmit'] = $state['canSaveAnswer'];
        return $state;
    }

    public function start(Distribution $distribution, User $student, string $key): array
    {
        return DB::transaction(function () use ($distribution, $student, $key) {
            $locked = $this->lockDistribution($distribution->id, $student->id);
            return $this->command($student->id, 'start', $locked->id, $key, ['distributionId' => $locked->id], function () use ($locked, $student) {
                if (!ClassMembership::query()->where('classroom_id', $locked->classroom_id)
                    ->where('student_id', $student->id)->exists()) abort(404);
                $now = $this->serverNow();
                $state = $this->eligibilityFor($locked, $student->id, $now);
                if (!$state['canStart']) $this->conflict($state['reasonCode']);
                $end = $now->addSeconds($state['effectiveTimeLimitSeconds']);
                $deadline = CarbonImmutable::parse($state['effectiveDeadlineAt']);
                if ($locked->deadline_policy === 'HARD_DEADLINE' && $deadline->lt($end)) $end = $deadline;
                $id = (string) Str::uuid();
                DB::table('student_attempts')->insert([
                    'id' => $id, 'distribution_id' => $locked->id, 'revision_id' => $locked->revision_id,
                    'student_id' => $student->id, 'membership_id' => $state['membershipId'],
                    'attempt_no' => $state['usedAttempts'] + 1, 'status' => 'IN_PROGRESS',
                    'grading_status' => 'NOT_GRADED', 'started_at' => $now,
                    'initial_expires_at' => $end, 'expires_at' => $end,
                    'policy_snapshot' => json_encode(['deadlinePolicy' => $locked->deadline_policy,
                        'completionDeadlineAt' => $state['effectiveDeadlineAt'],
                        'timeLimitSeconds' => $state['effectiveTimeLimitSeconds'],
                        'scorePolicy' => $locked->score_policy ?? 'HIGHEST'], JSON_THROW_ON_ERROR),
                    'version' => 1, 'created_at' => $now, 'updated_at' => $now,
                ]);
                $this->event($locked->id, $id, $student->id, 'started', null, ['attemptNo' => $state['usedAttempts'] + 1]);
                return $this->attemptResource($id, true);
            }, 201);
        }, 3);
    }

    public function event(string $distributionId, ?string $attemptId, ?int $actorId, string $type, ?string $reason, array $metadata = []): void
    {
        DB::table('attempt_events')->insert(['id' => (string) Str::uuid(), 'distribution_id' => $distributionId,
            'attempt_id' => $attemptId, 'actor_id' => $actorId, 'event_type' => $type,
            'reason' => $reason, 'metadata' => json_encode((object) $metadata, JSON_THROW_ON_ERROR),
            'created_at' => $this->serverNow()]);
    }

    private function lockedAttempt(string $id, int $actorId, bool $teacher = false): array
    {
        $attempt = DB::table('student_attempts')->where('id', $id)->first();
        if (!$attempt) abort(404);
        if (!$teacher && $attempt->student_id !== $actorId) abort(404);
        $distribution = $this->lockDistribution($attempt->distribution_id, $actorId);
        if ($teacher ? $distribution->teacher_id !== $actorId : $attempt->student_id !== $actorId) abort(404);
        $attempt = DB::table('student_attempts')->where('id', $id)->lockForUpdate()->first();
        return [$distribution, $attempt];
    }

    public function attemptResource(string $id, bool $includeQuestions = false): array
    {
        $attempt = DB::table('student_attempts')->where('id', $id)->first();
        if (!$attempt) abort(404);
        $answers = DB::table('attempt_answers')->where('attempt_id', $id)->get()->mapWithKeys(fn ($a) => [
            $a->revision_question_id => ['answer' => $a->answer_payload ? json_decode($a->answer_payload, true) : null,
                'version' => $a->version, 'acceptedAt' => $a->accepted_at],
        ])->all();
        $data = ['id' => $attempt->id, 'distributionId' => $attempt->distribution_id,
            'revisionId' => $attempt->revision_id, 'attemptNo' => $attempt->attempt_no,
            'version' => $attempt->version,
            'status' => $attempt->status, 'gradingStatus' => $attempt->grading_status,
            'startedAt' => $attempt->started_at, 'expiresAt' => $attempt->expires_at,
            'finalizedAt' => $attempt->finalized_at, 'finalizationReason' => $attempt->finalization_reason,
            'answers' => (object) $answers, 'serverNow' => $this->serverNow()->toIso8601String()];
        if ($includeQuestions) {
            $data['questions'] = DB::table('revision_questions')->where('revision_id', $attempt->revision_id)
                ->orderBy('position')->get()->map(fn ($q) => [
                    'id' => $q->id, 'position' => $q->position, 'type' => $q->type,
                    'maxPoints' => $q->max_points, 'content' => json_decode($q->public_content, true),
                ])->all();
        }
        return $data;
    }

    private function validateAnswer(RevisionQuestion $question, mixed $answer): void
    {
        if ($answer === null) return;
        if (!is_array($answer) || array_is_list($answer)) throw ValidationException::withMessages(['answer' => 'Đáp án không hợp lệ.']);
        $public = $question->public_content;
        $validIds = fn ($items) => array_column($items, 'id');
        $valid = match ($question->type) {
            'single_choice' => array_keys($answer) === ['optionId'] && is_string($answer['optionId']) && in_array($answer['optionId'], $validIds($public['options']), true),
            'multiple_choice' => array_keys($answer) === ['optionIds'] && is_array($answer['optionIds']) && array_is_list($answer['optionIds'])
                && count($answer['optionIds']) <= count($public['options'])
                && count(array_filter($answer['optionIds'], fn ($id) => !is_string($id))) === 0
                && count($answer['optionIds']) === count(array_unique($answer['optionIds']))
                && count(array_diff($answer['optionIds'], $validIds($public['options']))) === 0,
            'true_false' => array_keys($answer) === ['value'] && is_bool($answer['value']),
            'true_false_group' => array_keys($answer) === ['answersByStatementId'] && is_array($answer['answersByStatementId'])
                && count($answer['answersByStatementId']) <= count($public['statements'])
                && count(array_diff(array_keys($answer['answersByStatementId']), $validIds($public['statements']))) === 0
                && count(array_filter($answer['answersByStatementId'], fn ($v) => !is_bool($v))) === 0,
            'short_answer' => array_keys($answer) === ['value'] && is_string($answer['value'])
                && SaveQuestionBankQuestionRequest::normalizeNumeric($answer['value']) !== null,
            'essay_text' => array_keys($answer) === ['text'] && is_string($answer['text']) && mb_strlen($answer['text']) <= 10000,
            default => false,
        };
        if (!$valid) throw ValidationException::withMessages(['answer' => 'Đáp án không hợp lệ.']);
    }

    public function saveAnswer(string $attemptId, string $questionId, User $student, mixed $answer, int $expectedVersion, string $key): array
    {
        try {
            return DB::transaction(function () use ($attemptId, $questionId, $student, $answer, $expectedVersion, $key) {
            [$distribution, $attempt] = $this->lockedAttempt($attemptId, $student->id);
            return $this->command($student->id, 'autosave', $attemptId.':'.$questionId, $key,
                ['answer' => $answer, 'expectedVersion' => $expectedVersion], function () use ($distribution, $attempt, $questionId, $student, $answer, $expectedVersion) {
                    $now = $this->serverNow();
                    if ($attempt->status !== 'IN_PROGRESS' || $distribution->lifecycle_status === 'cancelled') $this->conflict('attempt_finalized');
                    if ($now->gte($attempt->expires_at)) $this->conflict('attempt_expired');
                    $question = RevisionQuestion::query()->whereKey($questionId)->where('revision_id', $attempt->revision_id)->firstOrFail();
                    $this->validateAnswer($question, $answer);
                    $existing = DB::table('attempt_answers')->where('attempt_id', $attempt->id)
                        ->where('revision_question_id', $questionId)->first();
                    if (($existing?->version ?? 0) !== $expectedVersion) $this->conflict('version_conflict');
                    $version = $expectedVersion + 1;
                    $values = ['answer_payload' => $answer === null ? null : json_encode($answer, JSON_THROW_ON_ERROR),
                        'version' => $version, 'accepted_at' => $now, 'updated_at' => $now];
                    if ($existing) DB::table('attempt_answers')->where('id', $existing->id)->update($values);
                    else DB::table('attempt_answers')->insert($values + ['id' => (string) Str::uuid(),
                        'attempt_id' => $attempt->id, 'revision_id' => $attempt->revision_id,
                        'revision_question_id' => $questionId]);
                    return ['saved' => true, 'acceptedAt' => $now->toIso8601String(),
                        'version' => $version, 'serverNow' => $now->toIso8601String()];
                });
            }, 3);
        } catch (HttpResponseException $exception) {
            // The rejected save transaction rolls back; finalize in a separate transaction.
            $this->timeout($attemptId);
            throw $exception;
        }
    }

    public function submit(string $id, User $student, string $key): array
    {
        return DB::transaction(function () use ($id, $student, $key) {
            [$distribution, $attempt] = $this->lockedAttempt($id, $student->id);
            return $this->command($student->id, 'submit', $id, $key, ['attemptId' => $id], function () use ($distribution, $attempt, $student) {
                if ($attempt->status !== 'IN_PROGRESS') $this->conflict('attempt_finalized');
                $now = $this->serverNow();
                $reason = $now->gte($attempt->expires_at) ? 'timeout' : 'manual_submit';
                $this->finalizeLocked($distribution, $attempt, $reason, $now);
                return $this->attemptResource($attempt->id);
            });
        }, 3);
    }

    public function timeout(string $id): void
    {
        DB::transaction(function () use ($id) {
            $row = DB::table('student_attempts')->where('id', $id)->first();
            if (!$row) return;
            [$distribution, $attempt] = $this->lockedAttempt($id, $row->student_id);
            $now = $this->serverNow();
            if ($attempt->status === 'IN_PROGRESS' && $now->gte($attempt->expires_at)) $this->finalizeLocked($distribution, $attempt, 'timeout', $now);
        }, 3);
    }

    private function finalizeLocked(Distribution $distribution, object $attempt, string $reason, CarbonImmutable $now): void
    {
        $status = $reason === 'timeout' ? 'TIMED_OUT' : 'SUBMITTED';
        $questions = RevisionQuestion::query()->where('revision_id', $attempt->revision_id)->orderBy('position')->get();
        $answers = DB::table('attempt_answers')->where('attempt_id', $attempt->id)->get()->keyBy('revision_question_id');
        $auto = '0'; $pendingEssay = false;
        $generation = max(1, (int) DB::table('regrade_runs')->where('revision_id', $attempt->revision_id)
            ->where('status', 'COMPLETED')->max('target_generation'));
        foreach ($questions as $question) {
            $answer = $answers->get($question->id)?->answer_payload;
            $answer = $answer ? json_decode($answer, true) : null;
            if ($question->type === 'essay_text' && $answer !== null && trim($answer['text']) !== ''
                && !DB::table('revision_question_invalidations')->where('revision_question_id', $question->id)->exists()) {
                $pendingEssay = true;
                continue;
            }
            $score = $this->objectiveScore($question, $answer);
            $auto = bcadd($auto, $score, 6);
            DB::table('attempt_grade_items')->insert(['id' => (string) Str::uuid(), 'attempt_id' => $attempt->id,
                'revision_id' => $attempt->revision_id,
                'revision_question_id' => $question->id, 'generation' => $generation, 'awarded_points' => $score,
                'grading_source' => 'AUTO', 'graded_at' => $now]);
        }
        DB::table('student_attempts')->where('id', $attempt->id)->update([
            'status' => $status, 'grading_status' => $pendingEssay ? 'PENDING_ESSAY' : 'GRADED',
            'auto_score' => $auto, 'manual_score' => $pendingEssay ? null : '0',
            'total_score' => $pendingEssay ? null : $auto, 'finalized_at' => $now,
            'finalization_reason' => $reason, 'version' => $attempt->version + 1, 'updated_at' => $now,
        ]);
        $this->event($distribution->id, $attempt->id, $reason === 'timeout' ? null : $attempt->student_id, $reason, null);
        $this->recomputeResult($distribution, $attempt->student_id);
    }

    public function objectiveScore(RevisionQuestion $q, ?array $a): string
    {
        if (DB::table('revision_question_invalidations')->where('revision_question_id', $q->id)->exists()) return $q->max_points;
        if (!$a) return '0';
        $key = $q->answer_key ?? [];
        $correct = match ($q->type) {
            'single_choice' => ($a['optionId'] ?? null) === ($key['correctOptionId'] ?? null),
            'multiple_choice' => (function () use ($a, $key) { $x = $a['optionIds'] ?? []; $y = $key['correctOptionIds'] ?? []; sort($x); sort($y); return $x === $y; })(),
            'true_false' => ($a['value'] ?? null) === ($key['correctAnswer'] ?? null),
            'short_answer' => isset($a['value'], $key['correctAnswer'])
                && SaveQuestionBankQuestionRequest::normalizeNumeric($a['value']) === $key['correctAnswer'],
            default => false,
        };
        if ($q->type === 'true_false_group') {
            $expected = $key['answersByStatementId'] ?? [];
            $given = $a['answersByStatementId'] ?? [];
            $hits = 0;
            foreach ($expected as $id => $value) if (array_key_exists($id, $given) && $given[$id] === $value) $hits++;
            // Half-up at six decimal places, before attempt-total aggregation.
            $numerator = bcmul($q->max_points, (string) $hits, 7);
            $ratio = bcdiv($numerator, (string) count($expected), 7);
            return bcadd($ratio, '0.0000005', 6);
        }
        return $correct ? $q->max_points : '0';
    }

    public function recomputeResult(Distribution $distribution, int $studentId): void
    {
        $attempts = DB::table('student_attempts')->where('distribution_id', $distribution->id)
            ->where('student_id', $studentId)->orderBy('attempt_no')->get();
        $valid = $attempts->whereNotIn('status', ['REVOKED','CANCELLED']);
        $graded = $valid->where('grading_status', 'GRADED')->whereNotNull('total_score');
        $pending = $valid->contains(fn ($a) => in_array($a->grading_status, ['PENDING_ESSAY','PENDING_REGRADE'], true));
        $score = null;
        if ($graded->isNotEmpty()) {
            $policy = $distribution->score_policy ?? 'HIGHEST';
            $score = match ($policy) {
                'LATEST' => $graded->last()->total_score,
                'AVERAGE' => bcadd(bcdiv($graded->reduce(fn ($carry, $a) => bcadd($carry, $a->total_score, 6), '0'),
                    (string) $graded->count(), 7), '0.0000005', 6),
                default => $graded->reduce(fn ($carry, $a) => $carry === null || bccomp($a->total_score, $carry, 6) > 0 ? $a->total_score : $carry),
            };
        }
        $now = $this->serverNow();
        $exception = $this->exception($distribution, $studentId);
        $startDeadline = $exception?->late_start_until && CarbonImmutable::parse($exception->late_start_until)->gt($distribution->deadline_at)
            ? CarbonImmutable::parse($exception->late_start_until) : CarbonImmutable::parse($distribution->deadline_at);
        $member = ClassMembership::query()->where('classroom_id', $distribution->classroom_id)
            ->where('student_id', $studentId)->where('status', 'active')->exists();
        $canStartLater = $distribution->lifecycle_status === 'active' && $member && $now->lt($startDeadline)
            && $attempts->count() < $this->quota($distribution, $studentId);
        $active = $valid->contains(fn ($a) => $a->status === 'IN_PROGRESS');
        $status = match (true) {
            $distribution->lifecycle_status === 'cancelled' => 'VOID',
            $pending => 'PENDING_GRADING',
            $score === null => $active || $canStartLater ? 'PROVISIONAL' : 'FINAL',
            $active || $canStartLater => 'PROVISIONAL',
            default => 'FINAL',
        };
        $generation = max(1, (int) DB::table('regrade_runs')->where('revision_id', $distribution->revision_id)
            ->where('status', 'COMPLETED')->max('target_generation'));
        $existing = DB::table('assessment_results')->where('distribution_id', $distribution->id)
            ->where('student_id', $studentId)->first();
        $nextScore = $status === 'VOID' ? null : $score;
        if ($existing && $existing->status === $status && $existing->aggregate_score === $nextScore
            && (int) $existing->active_generation === $generation) return;
        DB::table('assessment_results')->updateOrInsert(['distribution_id' => $distribution->id, 'student_id' => $studentId], [
            'id' => $existing?->id ?? (string) Str::uuid(),
            'aggregate_score' => $nextScore,
            'status' => $status, 'active_generation' => $generation,
            'version' => ($existing?->version ?? 0) + 1, 'calculated_at' => $now,
        ]);
    }

    public function refreshResult(Distribution $distribution, User $student): void
    {
        DB::transaction(function () use ($distribution, $student) {
            $locked = $this->lockDistribution($distribution->id, $student->id);
            $this->recomputeResult($locked, $student->id);
        }, 3);
    }

    /** Called inside the B.3 Cancel transaction after its Distribution row is locked. */
    public function cancelDistributionLocked(Distribution $distribution, int $actorId): void
    {
        $now = $this->serverNow();
        $active = DB::table('student_attempts')->where('distribution_id', $distribution->id)
            ->where('status', 'IN_PROGRESS')->orderBy('id')->lockForUpdate()->get();
        foreach ($active as $attempt) {
            DB::table('student_attempts')->where('id', $attempt->id)->update([
                'status' => 'CANCELLED', 'finalized_at' => $now, 'finalization_reason' => 'cancel',
                'version' => $attempt->version + 1, 'updated_at' => $now,
            ]);
            $this->event($distribution->id, $attempt->id, $actorId, 'cancelled', null);
        }
        $students = DB::table('student_attempts')->where('distribution_id', $distribution->id)->distinct()->pluck('student_id');
        foreach ($students as $studentId) $this->recomputeResult($distribution, $studentId);
    }

    /** Called after the B.3 Close transition while its Distribution row remains locked. */
    public function closeDistributionLocked(Distribution $distribution): void
    {
        $studentIds = DB::table('student_attempts')->where('distribution_id', $distribution->id)
            ->distinct()->orderBy('student_id')->pluck('student_id');
        foreach ($studentIds as $studentId) $this->recomputeResult($distribution, (int) $studentId);
    }
}
