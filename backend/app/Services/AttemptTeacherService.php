<?php

namespace App\Services;

use App\Models\AssessmentRevision;
use App\Models\ClassMembership;
use App\Models\Distribution;
use App\Models\RevisionQuestion;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AttemptTeacherService
{
    public function __construct(private readonly AttemptService $attempts) {}

    private function release(): void
    {
        if (!config('distribution.student_attempt_enabled', false))
            abort(response()->json(['message' => 'Chức năng bài làm chưa được mở.', 'code' => 'attempt_release_locked'], 423));
    }

    private function conflict(string $code): never
    {
        abort(response()->json(['message' => 'Trạng thái đã thay đổi. Vui lòng tải lại.', 'code' => $code], 409));
    }

    private function owned(User $teacher, string $id): Distribution
    {
        return Distribution::query()->where('teacher_id', $teacher->id)->findOrFail($id);
    }

    private function locked(User $teacher, string $id): Distribution
    {
        $this->owned($teacher, $id);
        return $this->attempts->lockDistribution($id, $teacher->id);
    }

    private function studentInClass(Distribution $distribution, int $studentId): void
    {
        if (!ClassMembership::query()->where('classroom_id', $distribution->classroom_id)
            ->where('student_id', $studentId)->where('status', 'active')->exists()) abort(404);
    }

    public function setException(User $teacher, string $id, int $studentId, array $data, string $key): array
    {
        $this->release();
        return DB::transaction(function () use ($teacher, $id, $studentId, $data, $key) {
            $distribution = $this->locked($teacher, $id);
            $this->studentInClass($distribution, $studentId);
            return $this->attempts->command($teacher->id, 'exception', $id.':'.$studentId, $key, $data,
                function () use ($teacher, $id, $studentId, $data, $distribution) {
            if ($distribution->lifecycle_status !== 'active') $this->conflict('distribution_unavailable');
            if (DB::table('result_publications')->where('distribution_id', $id)->where('publication_type', 'ANSWERS')->exists()) $this->conflict('answers_already_published');
            $old = DB::table('student_distribution_exceptions')->where('distribution_id', $id)
                ->where('student_id', $studentId)->lockForUpdate()->first();
            if (($old?->version ?? 0) !== $data['expectedVersion']) $this->conflict('version_conflict');
            $deadline = CarbonImmutable::parse($distribution->deadline_at);
            $late = isset($data['lateStartUntil']) ? CarbonImmutable::parse($data['lateStartUntil']) : null;
            if ($late && ($late->lte($deadline) || $late->gt($deadline->addDays(30))))
                throw ValidationException::withMessages(['lateStartUntil' => 'Hạn bắt đầu riêng phải sau hạn gốc và không quá 30 ngày.']);
            $completion = isset($data['completionDeadlineAt']) ? CarbonImmutable::parse($data['completionDeadlineAt']) : null;
            if ($completion && $completion->lte($deadline))
                throw ValidationException::withMessages(['completionDeadlineAt' => 'Hạn hoàn thành riêng phải sau hạn gốc.']);
            $now = $this->attempts->serverNow();
            $next = ['late_start_until' => $late, 'completion_deadline_at' => $completion,
                'time_limit_seconds' => $data['timeLimitSeconds'] ?? null,
                'version' => ($old?->version ?? 0) + 1, 'updated_by' => $teacher->id, 'updated_at' => $now];
            if ($old) DB::table('student_distribution_exceptions')->where('id', $old->id)->update($next);
            else {
                $next += ['id' => (string) Str::uuid(), 'distribution_id' => $id,
                    'student_id' => $studentId, 'created_at' => $now];
                DB::table('student_distribution_exceptions')->insert($next);
            }
            DB::table('student_exception_events')->insert(['id' => (string) Str::uuid(),
                'exception_id' => $old?->id ?? $next['id'], 'actor_id' => $teacher->id,
                'before_state' => $old ? json_encode($old, JSON_THROW_ON_ERROR) : null,
                'after_state' => json_encode($next, JSON_THROW_ON_ERROR), 'reason' => trim($data['reason']), 'created_at' => $now]);
            $this->attempts->event($id, null, $teacher->id, 'exception_changed', trim($data['reason']), ['studentId' => $studentId]);
            return ['studentId' => $studentId, 'version' => $next['version'],
                'lateStartUntil' => $late?->toIso8601String(), 'completionDeadlineAt' => $completion?->toIso8601String(),
                'timeLimitSeconds' => $next['time_limit_seconds']];
            });
        }, 3);
    }

    public function grant(User $teacher, string $id, int $studentId, int $amount, string $reason, string $key): array
    {
        $this->release();
        return DB::transaction(function () use ($teacher, $id, $studentId, $amount, $reason, $key) {
            $distribution = $this->locked($teacher, $id);
            $this->studentInClass($distribution, $studentId);
            return $this->attempts->command($teacher->id, 'grant', $id.':'.$studentId, $key,
                ['additionalAttempts' => $amount, 'reason' => $reason], function () use ($distribution, $studentId, $teacher, $amount, $reason, $key) {
                    if ($distribution->lifecycle_status !== 'active') $this->conflict('distribution_unavailable');
                    if (DB::table('result_publications')->where('distribution_id', $distribution->id)->where('publication_type', 'ANSWERS')->exists()) $this->conflict('answers_already_published');
                    DB::table('attempt_quota_grants')->insert(['id' => (string) Str::uuid(), 'distribution_id' => $distribution->id,
                        'student_id' => $studentId, 'additional_attempts' => $amount, 'reason' => $reason,
                        'granted_by' => $teacher->id, 'idempotency_key_hash' => hash('sha256', $teacher->id.':'.$key),
                        'created_at' => $this->attempts->serverNow()]);
                    $this->attempts->event($distribution->id, null, $teacher->id, 'quota_granted', $reason,
                        ['studentId' => $studentId, 'additionalAttempts' => $amount]);
                    $this->attempts->recomputeResult($distribution, $studentId);
                    return ['studentId' => $studentId, 'additionalAttempts' => $amount];
                });
        }, 3);
    }

    public function extend(User $teacher, string $attemptId, array $data, string $key): array
    {
        $this->release();
        return DB::transaction(function () use ($teacher, $attemptId, $data, $key) {
            $row = DB::table('student_attempts')->where('id', $attemptId)->first();
            if (!$row) abort(404);
            $distribution = $this->locked($teacher, $row->distribution_id);
            $attempt = DB::table('student_attempts')->where('id', $attemptId)->lockForUpdate()->first();
            return $this->attempts->command($teacher->id, 'extend', $attemptId, $key, $data, function () use ($teacher, $distribution, $attempt, $data) {
                $now = $this->attempts->serverNow();
                // Close/Cancel block NEW extensions; an already authorized attempt may still finish.
                if ($attempt->status !== 'IN_PROGRESS' || $distribution->lifecycle_status !== 'active' || $now->gte($attempt->expires_at))
                    $this->conflict('attempt_unavailable');
                // Check the membership frozen at Start, not a new membership after a possible rejoin.
                // Both Leave and Extend lock the Classroom row first, serializing concurrent changes.
                $membershipActive = ClassMembership::query()->whereKey($attempt->membership_id)
                    ->where('classroom_id', $distribution->classroom_id)
                    ->where('student_id', $attempt->student_id)->where('status', 'active')->exists();
                if (!$membershipActive) $this->conflict('membership_inactive');
                if ($attempt->version !== $data['expectedVersion']) $this->conflict('version_conflict');
                $new = CarbonImmutable::parse($data['expiresAt']);
                if ($new->lte($attempt->expires_at) || $new->gt(CarbonImmutable::parse($attempt->initial_expires_at)->addHours(24)))
                    throw ValidationException::withMessages(['expiresAt' => 'Thời gian gia hạn vượt giới hạn 24 giờ hoặc không tăng.']);
                $policy = json_decode($attempt->policy_snapshot, true, 512, JSON_THROW_ON_ERROR);
                if ($distribution->deadline_policy === 'HARD_DEADLINE' && $new->gt(CarbonImmutable::parse($policy['completionDeadlineAt']))) {
                    $exception = DB::table('student_distribution_exceptions')->where('distribution_id', $distribution->id)->where('student_id', $attempt->student_id)->first();
                    if (!$exception?->completion_deadline_at || $new->gt(CarbonImmutable::parse($exception->completion_deadline_at)))
                        throw ValidationException::withMessages(['expiresAt' => 'Cần cấp hạn hoàn thành riêng trước khi gia hạn lượt này.']);
                }
                DB::table('student_attempts')->where('id', $attempt->id)->update(['expires_at' => $new, 'version' => $attempt->version + 1, 'updated_at' => $now]);
                $this->attempts->event($distribution->id, $attempt->id, $teacher->id, 'extended', trim($data['reason']),
                    ['before' => $attempt->expires_at, 'after' => $new->toIso8601String()]);
                return ['id' => $attempt->id, 'expiresAt' => $new->toIso8601String(), 'version' => $attempt->version + 1];
            });
        }, 3);
    }

    public function revoke(User $teacher, string $attemptId, array $data, string $key): array
    {
        $this->release();
        return DB::transaction(function () use ($teacher, $attemptId, $data, $key) {
            $row = DB::table('student_attempts')->where('id', $attemptId)->first();
            if (!$row) abort(404);
            $distribution = $this->locked($teacher, $row->distribution_id);
            $attempt = DB::table('student_attempts')->where('id', $attemptId)->lockForUpdate()->first();
            return $this->attempts->command($teacher->id, 'revoke', $attemptId, $key, $data, function () use ($teacher, $distribution, $attempt, $data) {
                if ($attempt->version !== $data['expectedVersion']) $this->conflict('version_conflict');
                if (in_array($attempt->status, ['REVOKED','CANCELLED'], true)) $this->conflict('attempt_unavailable');
                $now = $this->attempts->serverNow();
                DB::table('student_attempts')->where('id', $attempt->id)->update(['status' => 'REVOKED',
                    'finalized_at' => $attempt->finalized_at ?? $now, 'finalization_reason' => 'revoke',
                    'version' => $attempt->version + 1, 'updated_at' => $now]);
                $this->attempts->event($distribution->id, $attempt->id, $teacher->id, 'revoked', trim($data['reason']),
                    ['previousStatus' => $attempt->status, 'previousFinalizationReason' => $attempt->finalization_reason]);
                $this->attempts->recomputeResult($distribution, $attempt->student_id);
                return ['id' => $attempt->id, 'status' => 'REVOKED', 'version' => $attempt->version + 1];
            });
        }, 3);
    }

    public function gradeEssay(User $teacher, string $attemptId, string $questionId, array $data, string $key): array
    {
        $this->release();
        return DB::transaction(function () use ($teacher, $attemptId, $questionId, $data, $key) {
            $row = DB::table('student_attempts')->where('id', $attemptId)->first();
            if (!$row) abort(404);
            $distribution = $this->locked($teacher, $row->distribution_id);
            $attempt = DB::table('student_attempts')->where('id', $attemptId)->lockForUpdate()->first();
            return $this->attempts->command($teacher->id, 'grade_essay', $attemptId.':'.$questionId, $key, $data,
                function () use ($teacher, $distribution, $attempt, $attemptId, $questionId, $data) {
                    if (!in_array($attempt->status, ['SUBMITTED','TIMED_OUT'], true)) $this->conflict('attempt_unavailable');
                    if ($attempt->version !== $data['expectedVersion']) $this->conflict('version_conflict');
                    $question = RevisionQuestion::query()->whereKey($questionId)->where('revision_id', $attempt->revision_id)
                        ->where('type', 'essay_text')->firstOrFail();
                    if (DB::table('revision_question_invalidations')->where('revision_question_id', $questionId)->exists())
                        $this->conflict('question_invalidated');
                    if (bccomp($data['points'], '0', 6) < 0 || bccomp($data['points'], $question->max_points, 6) > 0)
                        throw ValidationException::withMessages(['points' => 'Điểm vượt thang điểm của câu.']);
                    $answer = DB::table('attempt_answers')->where('attempt_id', $attemptId)->where('revision_question_id', $questionId)->first();
                    if (!$answer?->answer_payload || trim(json_decode($answer->answer_payload, true)['text'] ?? '') === '') abort(404);
                    $generation = DB::table('assessment_results')->where('distribution_id', $distribution->id)->where('student_id', $attempt->student_id)->value('active_generation') ?? 1;
                    $old = DB::table('attempt_grade_items')->where('attempt_id', $attemptId)->where('revision_question_id', $questionId)
                        ->where('generation', $generation)->first();
                    $now = $this->attempts->serverNow();
                    $values = ['awarded_points' => $data['points'], 'grading_source' => 'MANUAL', 'graded_by' => $teacher->id,
                        'feedback' => $data['feedback'] ?? null, 'graded_at' => $now];
                    if ($old) DB::table('attempt_grade_items')->where('id', $old->id)->update($values);
                    else DB::table('attempt_grade_items')->insert($values + ['id' => (string) Str::uuid(),
                        'attempt_id' => $attemptId, 'revision_id' => $attempt->revision_id,
                        'revision_question_id' => $questionId, 'generation' => $generation]);
                    DB::table('grade_events')->insert(['id' => (string) Str::uuid(), 'attempt_id' => $attemptId,
                        'revision_question_id' => $questionId, 'actor_id' => $teacher->id,
                        'before_state' => $old ? json_encode($old, JSON_THROW_ON_ERROR) : null,
                        'after_state' => json_encode($values, JSON_THROW_ON_ERROR), 'reason' => $data['reason'] ?? null,
                        'created_at' => $now]);
                    $this->refreshGrade($distribution, $attemptId, $generation);
                    return ['attemptId' => $attemptId, 'questionId' => $questionId, 'points' => $data['points'],
                        'version' => $attempt->version + 1];
                });
        }, 3);
    }

    private function refreshGrade(Distribution $distribution, string $attemptId, int $generation): void
    {
        $attempt = DB::table('student_attempts')->where('id', $attemptId)->first();
        $questions = RevisionQuestion::query()->where('revision_id', $attempt->revision_id)->get();
        $items = DB::table('attempt_grade_items')->where('attempt_id', $attemptId)->where('generation', $generation)->get()->keyBy('revision_question_id');
        $pending = $questions->contains(function ($q) use ($attemptId, $items) {
            if ($q->type !== 'essay_text') return false;
            $answer = DB::table('attempt_answers')->where('attempt_id', $attemptId)->where('revision_question_id', $q->id)->value('answer_payload');
            return $answer && trim(json_decode($answer, true)['text'] ?? '') !== '' && !$items->has($q->id);
        });
        $auto = '0'; $manual = '0';
        foreach ($items as $item) {
            if ($item->grading_source === 'MANUAL') $manual = bcadd($manual, $item->awarded_points, 6);
            else $auto = bcadd($auto, $item->awarded_points, 6);
        }
        DB::table('student_attempts')->where('id', $attemptId)->update([
            'grading_status' => $pending ? 'PENDING_ESSAY' : 'GRADED', 'auto_score' => $auto,
            'manual_score' => $pending ? null : $manual, 'total_score' => $pending ? null : bcadd($auto, $manual, 6),
            'version' => $attempt->version + 1, 'updated_at' => $this->attempts->serverNow(),
        ]);
        $this->attempts->recomputeResult($distribution, $attempt->student_id);
    }

    public function publish(User $teacher, string $distributionId, string $type, string $key): array
    {
        $this->release();
        return DB::transaction(function () use ($teacher, $distributionId, $type, $key) {
            $distribution = $this->locked($teacher, $distributionId);
            return $this->attempts->command($teacher->id, 'publish_'.$type, $distributionId, $key,
                ['type' => $type], function () use ($teacher, $distribution, $type) {
                    if ($distribution->lifecycle_status === 'cancelled') $this->conflict('distribution_unavailable');
                    $active = DB::table('student_attempts')->where('distribution_id', $distribution->id)->where('status', 'IN_PROGRESS')->exists();
                    $late = DB::table('student_distribution_exceptions')->where('distribution_id', $distribution->id)
                        ->where('late_start_until', '>', $this->attempts->serverNow())->exists();
                    if ($type === 'ANSWERS' && ($active || ($distribution->lifecycle_status === 'active' && (now()->lt($distribution->deadline_at) || $late))))
                        $this->conflict('answers_not_releasable');
                    if ($type === 'SCORE' && DB::table('assessment_results')->where('distribution_id', $distribution->id)
                        ->whereIn('status', ['PENDING_GRADING','PENDING_REGRADE'])->exists()) $this->conflict('grading_incomplete');
                    $generation = max(1, (int) DB::table('regrade_runs')->where('revision_id', $distribution->revision_id)
                        ->where('status', 'COMPLETED')->max('target_generation'));
                    $existing = DB::table('result_publications')->where('distribution_id', $distribution->id)
                        ->where('publication_type', $type)->first();
                    if ($existing && $existing->generation >= $generation) $this->conflict('already_published');
                    if ($existing) DB::table('result_publications')->where('id', $existing->id)->update([
                        'generation' => $generation, 'actor_id' => $teacher->id, 'created_at' => $this->attempts->serverNow()]);
                    else DB::table('result_publications')->insert(['id' => (string) Str::uuid(), 'distribution_id' => $distribution->id,
                        'actor_id' => $teacher->id, 'publication_type' => $type, 'generation' => $generation,
                        'created_at' => $this->attempts->serverNow()]);
                    $this->attempts->event($distribution->id, null, $teacher->id,
                        $type === 'SCORE' ? 'scores_published' : 'answers_published', null,
                        ['generation' => $generation]);
                    return ['distributionId' => $distribution->id, 'type' => $type, 'published' => true];
                });
        }, 3);
    }

    public function invalidate(User $teacher, string $revisionId, string $questionId, string $reason, string $key): array
    {
        $this->release();
        $revision = AssessmentRevision::query()->whereKey($revisionId)
            ->whereHas('assessment', fn ($q) => $q->where('teacher_id', $teacher->id))->firstOrFail();
        if ($revision->status !== 'published') $this->conflict('revision_not_published');
        RevisionQuestion::query()->whereKey($questionId)->where('revision_id', $revisionId)->firstOrFail();
        return DB::transaction(function () use ($teacher, $revisionId, $questionId, $reason, $key) {
            User::query()->whereKey($teacher->id)->lockForUpdate()->firstOrFail();
            $revision = AssessmentRevision::query()->whereKey($revisionId)->lockForUpdate()->firstOrFail();
            return $this->attempts->command($teacher->id, 'invalidate', $questionId, $key, ['reason' => $reason], function () use ($teacher, $revision, $questionId, $reason) {
                if (DB::table('revision_question_invalidations')->where('revision_question_id', $questionId)->exists()) $this->conflict('already_invalidated');
                $now = $this->attempts->serverNow();
                DB::table('revision_question_invalidations')->insert(['id' => (string) Str::uuid(), 'revision_id' => $revision->id,
                    'revision_question_id' => $questionId, 'actor_id' => $teacher->id, 'reason' => $reason, 'created_at' => $now]);
                $generation = max(1, (int) DB::table('regrade_runs')->where('revision_id', $revision->id)->max('target_generation')) + 1;
                $runId = (string) Str::uuid();
                DB::table('regrade_runs')->insert(['id' => $runId, 'revision_id' => $revision->id, 'actor_id' => $teacher->id,
                    'target_generation' => $generation, 'status' => 'RUNNING', 'reason' => $reason, 'created_at' => $now]);
                // V1 cutover runs inside one transaction. Readers see either the old or complete new generation.
                $distributions = Distribution::query()->where('revision_id', $revision->id)->orderBy('id')->lockForUpdate()->get();
                foreach ($distributions as $distribution) {
                    $attempts = DB::table('student_attempts')->where('distribution_id', $distribution->id)
                        ->orderBy('id')->lockForUpdate()->get();
                    foreach ($attempts as $attempt) {
                        if (!in_array($attempt->status, ['SUBMITTED','TIMED_OUT'], true)) continue;
                        $questions = RevisionQuestion::query()->where('revision_id', $revision->id)->get();
                        foreach ($questions as $q) {
                            $previous = DB::table('attempt_grade_items')->where('attempt_id', $attempt->id)
                                ->where('revision_question_id', $q->id)->orderByDesc('generation')->first();
                            if (!$previous && $q->type === 'essay_text'
                                && !DB::table('revision_question_invalidations')->where('revision_question_id', $q->id)->exists()) continue;
                            $answer = DB::table('attempt_answers')->where('attempt_id', $attempt->id)
                                ->where('revision_question_id', $q->id)->value('answer_payload');
                            $points = DB::table('revision_question_invalidations')->where('revision_question_id', $q->id)->exists()
                                ? $q->max_points : ($q->type === 'essay_text' ? $previous?->awarded_points
                                    : $this->attempts->objectiveScore($q, $answer ? json_decode($answer, true) : null));
                            DB::table('attempt_grade_items')->insert(['id' => (string) Str::uuid(), 'attempt_id' => $attempt->id,
                                'revision_id' => $attempt->revision_id,
                                'revision_question_id' => $q->id, 'generation' => $generation, 'awarded_points' => $points,
                                'grading_source' => DB::table('revision_question_invalidations')->where('revision_question_id', $q->id)->exists()
                                    ? 'FULL_CREDIT_INVALIDATION' : ($previous?->grading_source ?? 'AUTO'),
                                'graded_by' => $q->type === 'essay_text' ? $previous?->graded_by : null,
                                'feedback' => $q->type === 'essay_text' ? $previous?->feedback : null, 'graded_at' => $now]);
                        }
                        $this->refreshGrade($distribution, $attempt->id, $generation);
                    }
                    DB::table('assessment_results')->where('distribution_id', $distribution->id)->update(['active_generation' => $generation]);
                }
                DB::table('regrade_runs')->where('id', $runId)->update(['status' => 'COMPLETED', 'completed_at' => $this->attempts->serverNow()]);
                return ['runId' => $runId, 'status' => 'COMPLETED', 'generation' => $generation];
            });
        }, 3);
    }
}
