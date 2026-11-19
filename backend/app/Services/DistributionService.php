<?php

namespace App\Services;

use App\Models\AssessmentRevision;
use App\Models\ClassMembership;
use App\Models\Classroom;
use App\Models\Distribution;
use App\Models\DistributionEvent;
use App\Models\StudentNotification;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DistributionService
{
    public function preview(User $teacher, array $input): array
    {
        $plan = $this->plan($teacher, $input);
        $overlaps = $this->overlaps($plan['classroomIds'], $plan['opensAt'], $plan['deadlineAt']);
        return [
            'eligible' => true,
            'revision' => $this->revisionSummary($plan['revision']),
            'classrooms' => $plan['classrooms']->map(fn ($classroom) => ['id' => $classroom->id, 'name' => $classroom->name])->values()->all(),
            'overlaps' => $overlaps,
            'overlapConfirmationToken' => $overlaps ? $this->overlapToken($teacher->id, $input, $overlaps) : null,
            'creationEnabled' => (bool) config('distribution.creation_enabled', false),
        ];
    }

    public function create(User $teacher, array $input, string $key): array
    {
        if (!config('distribution.creation_enabled', false)) {
            abort(response()->json(['error' => ['code' => 'distribution_release_locked',
                'message' => 'Tính năng giao bài chưa được mở sử dụng.']], 423));
        }
        $requestHash = $this->payloadHash($input);
        $keyHash = hash('sha256', $teacher->id.':create:'.$key);
        return DB::transaction(function () use ($teacher, $input, $requestHash, $keyHash) {
            // Lock order: teacher user, classrooms by UUID, then new batch/distributions.
            // This serializes idempotency and overlap checks between this teacher's requests.
            User::query()->whereKey($teacher->id)->lockForUpdate()->firstOrFail();
            $existing = DB::table('distribution_batches')->where('teacher_id', $teacher->id)
                ->where('idempotency_key_hash', $keyHash)->first();
            if ($existing) {
                $this->conflict($existing->request_hash === $requestHash, 'idempotency_conflict');
                return $this->batchResult($existing->id) + ['_replayed' => true];
            }
            $classIds = $input['classroomIds'];
            sort($classIds, SORT_STRING);
            foreach ($classIds as $id) Classroom::query()->whereKey($id)->lockForUpdate()->first();
            $plan = $this->plan($teacher, $input);
            $overlaps = $this->overlaps($plan['classroomIds'], $plan['opensAt'], $plan['deadlineAt']);
            if ($overlaps && !hash_equals($this->overlapToken($teacher->id, $input, $overlaps), (string) ($input['overlapConfirmationToken'] ?? ''))) {
                abort(response()->json(['message' => 'Lịch giao bài bị trùng; cần xác nhận lại.',
                    'code' => 'overlap_confirmation_required', 'overlaps' => $overlaps], 409));
            }
            $batchId = (string) Str::uuid();
            $at = now();
            DB::table('distribution_batches')->insert([
                'id' => $batchId, 'teacher_id' => $teacher->id, 'revision_id' => $plan['revision']->id,
                'idempotency_key_hash' => $keyHash, 'request_hash' => $requestHash, 'created_at' => $at,
            ]);
            foreach ($plan['classrooms'] as $classroom) {
                $distribution = Distribution::create([
                    'batch_id' => $batchId, 'teacher_id' => $teacher->id, 'classroom_id' => $classroom->id,
                    'revision_id' => $plan['revision']->id, 'opens_at' => $input['opensAt'] ?? $at,
                    'deadline_at' => $input['deadlineAt'], 'time_limit_seconds' => $input['timeLimitSeconds'],
                    'max_attempts' => $input['maxAttempts'] ?? 1, 'deadline_policy' => $input['deadlinePolicy'],
                    'score_policy' => $input['scorePolicy'] ?? 'HIGHEST',
                    'score_release_mode' => $input['scoreReleaseMode'] ?? 'AFTER_DISTRIBUTION_ENDED_AND_GRADED',
                    'answer_release_mode' => $input['answerReleaseMode'] ?? 'AFTER_DISTRIBUTION_ENDED_WITH_TEACHER_PERMISSION',
                    'lifecycle_status' => 'active', 'version' => 1,
                ]);
                DistributionEvent::create(['distribution_id' => $distribution->id, 'actor_id' => $teacher->id,
                    'event_type' => 'created', 'reason' => null, 'metadata' => (object) [], 'created_at' => $at]);
            }
            return $this->batchResult($batchId);
        }, 3);
    }

    public function command(User $teacher, string $id, string $operation, int $expectedVersion, ?string $reason, string $key): Distribution
    {
        $keyHash = hash('sha256', $teacher->id.':'.$operation.':'.$key);
        $requestHash = hash('sha256', json_encode([$id, $operation, $expectedVersion, trim((string) $reason)], JSON_THROW_ON_ERROR));
        return DB::transaction(function () use ($teacher, $id, $operation, $expectedVersion, $reason, $keyHash, $requestHash) {
            // Lock order: actor user, classroom, distribution. Membership mutations
            // take their student user lock before the same classroom row.
            User::query()->whereKey($teacher->id)->lockForUpdate()->firstOrFail();
            $classId = Distribution::query()->where('teacher_id', $teacher->id)->whereKey($id)->value('classroom_id');
            if (!$classId) abort(404);
            Classroom::query()->whereKey($classId)->lockForUpdate()->firstOrFail();
            $distribution = Distribution::query()->where('teacher_id', $teacher->id)->whereKey($id)->lockForUpdate()->firstOrFail();
            $existing = DB::table('distribution_commands')->where('actor_id', $teacher->id)
                ->where('operation', $operation)->where('idempotency_key_hash', $keyHash)->first();
            if ($existing) {
                $this->conflict($existing->request_hash === $requestHash, 'idempotency_conflict');
                $event = DistributionEvent::findOrFail($existing->event_id);
                $state = $event->metadata;
                $distribution->forceFill([
                    'version' => $state['version'], 'lifecycle_status' => $state['lifecycleStatus'],
                    'closed_at' => $state['closedAt'], 'cancelled_at' => $state['cancelledAt'],
                ]);
                return $distribution;
            }
            $this->conflict($distribution->version === $expectedVersion, 'version_conflict');
            $this->conflict($operation === 'cancel' ? $distribution->lifecycle_status !== 'cancelled'
                : $distribution->lifecycle_status === 'active', 'lifecycle_conflict');
            $at = now();
            $distribution->forceFill([
                'lifecycle_status' => $operation === 'cancel' ? 'cancelled' : 'closed',
                'version' => $distribution->version + 1,
                $operation === 'cancel' ? 'cancelled_at' : 'closed_at' => $at,
            ])->save();
            $event = DistributionEvent::create(['distribution_id' => $id, 'actor_id' => $teacher->id,
                'event_type' => $operation === 'cancel' ? 'cancelled' : 'closed', 'reason' => $reason,
                'metadata' => ['version' => $distribution->version,
                    'lifecycleStatus' => $distribution->lifecycle_status,
                    'closedAt' => $distribution->closed_at?->toIso8601String(),
                    'cancelledAt' => $distribution->cancelled_at?->toIso8601String()], 'created_at' => $at]);
            DB::table('distribution_commands')->insert([
                'id' => (string) Str::uuid(), 'distribution_id' => $id, 'actor_id' => $teacher->id,
                'operation' => $operation, 'idempotency_key_hash' => $keyHash,
                'request_hash' => $requestHash, 'event_id' => $event->id,
                'result_code' => 'success', 'created_at' => $at,
            ]);
            if ($operation === 'close' && \Illuminate\Support\Facades\Schema::hasTable('student_attempts')) {
                app(AttemptService::class)->closeDistributionLocked($distribution);
            }
            if ($operation === 'cancel') {
                if (\Illuminate\Support\Facades\Schema::hasTable('student_attempts')) {
                    app(AttemptService::class)->cancelDistributionLocked($distribution, $teacher->id);
                }
                $students = ClassMembership::query()->where('classroom_id', $classId)
                    ->where('status', 'active')->distinct()->pluck('student_id');
                foreach ($students as $studentId) {
                    StudentNotification::create([
                        'student_id' => $studentId, 'distribution_id' => $id, 'event_id' => $event->id,
                        'type' => 'distribution_cancelled', 'title' => 'Bài kiểm tra đã hủy',
                        'body' => 'Giáo viên đã hủy bài kiểm tra. '.$reason, 'created_at' => $at,
                    ]);
                }
            }
            return $distribution->refresh();
        }, 3);
    }

    private function plan(User $teacher, array $input): array
    {
        $revision = AssessmentRevision::query()->whereKey($input['revisionId'])
            ->whereHas('assessment', fn ($query) => $query->where('teacher_id', $teacher->id))->first();
        if (!$revision) abort(404);
        if ($revision->status !== 'published') abort(response()->json([
            'message' => 'Đề chưa hoàn tất.', 'code' => 'revision_not_published'], 409));
        $ids = $input['classroomIds'];
        $classrooms = Classroom::query()->whereIn('id', $ids)->where('teacher_id', $teacher->id)
            ->where('status', 'active')->get()->keyBy('id');
        if ($classrooms->count() !== count($ids)) abort(response()->json(['message' => 'Một hoặc nhiều lớp không khả dụng.', 'code' => 'classroom_unavailable'], 422));
        $opensAt = isset($input['opensAt']) ? CarbonImmutable::parse($input['opensAt']) : CarbonImmutable::now();
        $deadlineAt = CarbonImmutable::parse($input['deadlineAt']);
        $serverNow = CarbonImmutable::now();
        if ((isset($input['opensAt']) && $opensAt->lessThan($serverNow))
            || $opensAt->greaterThan($serverNow->addDays(180)) || $deadlineAt->lessThan($serverNow)
            || $deadlineAt->diffInSeconds($opensAt, false) >= 0
            || $opensAt->diffInSeconds($deadlineAt) < 60 || $opensAt->diffInSeconds($deadlineAt) > 30 * 86400) {
            throw ValidationException::withMessages(['deadlineAt' => 'Lịch giao bài không hợp lệ.']);
        }
        return ['revision' => $revision, 'classroomIds' => $ids,
            'classrooms' => collect($ids)->map(fn ($id) => $classrooms->get($id)),
            'opensAt' => $opensAt, 'deadlineAt' => $deadlineAt];
    }

    private function overlaps(array $ids, CarbonImmutable $opens, CarbonImmutable $deadline): array
    {
        return Distribution::query()->whereIn('classroom_id', $ids)->where('lifecycle_status', 'active')
            ->where('opens_at', '<', $deadline)->where('deadline_at', '>', $opens)
            ->orderBy('classroom_id')->orderBy('id')->get(['id', 'classroom_id', 'opens_at', 'deadline_at', 'updated_at'])
            ->map(fn ($d) => ['id' => $d->id, 'classroomId' => $d->classroom_id,
                'opensAt' => $d->opens_at->toIso8601String(), 'deadlineAt' => $d->deadline_at->toIso8601String(),
                'updatedAt' => $d->updated_at->toIso8601String()])->all();
    }

    private function overlapToken(int $teacherId, array $input, array $overlaps): string
    {
        return hash_hmac('sha256', $teacherId.':'.$this->payloadHash($input).':'.json_encode($overlaps, JSON_THROW_ON_ERROR), config('app.key'));
    }

    private function payloadHash(array $input): string
    {
        $ids = $input['classroomIds']; sort($ids, SORT_STRING);
        $canonical = [
            $input['revisionId'], $ids, isset($input['opensAt']) ? CarbonImmutable::parse($input['opensAt'])->utc()->toIso8601String() : 'immediate',
            CarbonImmutable::parse($input['deadlineAt'])->utc()->toIso8601String(),
            (int) $input['timeLimitSeconds'], (int) ($input['maxAttempts'] ?? 1), $input['deadlinePolicy'],
        ];
        // Preserve B.3 idempotency receipts for exact retries of the original payload.
        if (isset($input['scorePolicy'], $input['scoreReleaseMode'], $input['answerReleaseMode'])
            || array_key_exists('scorePolicy', $input) || array_key_exists('scoreReleaseMode', $input)
            || array_key_exists('answerReleaseMode', $input)) {
            $canonical[] = $input['scorePolicy'] ?? 'HIGHEST';
            $canonical[] = $input['scoreReleaseMode'] ?? 'AFTER_DISTRIBUTION_ENDED_AND_GRADED';
            $canonical[] = $input['answerReleaseMode'] ?? 'AFTER_DISTRIBUTION_ENDED_WITH_TEACHER_PERMISSION';
        }
        return hash('sha256', json_encode($canonical, JSON_THROW_ON_ERROR));
    }

    private function batchResult(string $batchId): array
    {
        return ['batchId' => $batchId, 'distributions' => Distribution::query()->where('batch_id', $batchId)
            ->orderBy('classroom_id')->get()->map(fn ($d) => $this->resource($d))->all()];
    }

    public function resource(Distribution $distribution): array
    {
        $distribution->loadMissing('revision.assessment', 'classroom');
        $now = now();
        $status = $distribution->lifecycle_status === 'active'
            ? ($now->lt($distribution->opens_at) ? 'scheduled' : ($now->gte($distribution->deadline_at) ? 'expired' : 'open'))
            : $distribution->lifecycle_status;
        return [
            'id' => $distribution->id, 'batchId' => $distribution->batch_id,
            'classroomId' => $distribution->classroom_id, 'classroomName' => $distribution->classroom->name,
            'revisionId' => $distribution->revision_id,
            'assessmentTitle' => $distribution->revision->title,
            'status' => $status, 'lifecycleStatus' => $distribution->lifecycle_status,
            'opensAt' => $distribution->opens_at->toIso8601String(),
            'deadlineAt' => $distribution->deadline_at->toIso8601String(),
            'timeLimitSeconds' => $distribution->time_limit_seconds,
            'maxAttempts' => $distribution->max_attempts, 'deadlinePolicy' => $distribution->deadline_policy,
            'scorePolicy' => $distribution->score_policy, 'scoreReleaseMode' => $distribution->score_release_mode,
            'answerReleaseMode' => $distribution->answer_release_mode,
            'version' => $distribution->version,
            'closedAt' => $distribution->closed_at?->toIso8601String(),
            'cancelledAt' => $distribution->cancelled_at?->toIso8601String(),
            'createdAt' => $distribution->created_at->toIso8601String(),
        ];
    }

    private function revisionSummary(AssessmentRevision $revision): array
    {
        return ['id' => $revision->id, 'title' => $revision->title,
            'questionCount' => $revision->questions()->count(), 'totalPoints' => $revision->total_points];
    }

    private function conflict(bool $condition, string $code): void
    {
        if (!$condition) abort(response()->json(['message' => 'Yêu cầu xung đột với trạng thái hiện tại.', 'code' => $code], 409));
    }
}
