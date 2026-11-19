<?php

namespace Tests\Feature;

use App\Models\Assessment;
use App\Models\Classroom;
use App\Models\Distribution;
use App\Models\ClassMembership;
use App\Models\User;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/** Two independent PHP processes and PostgreSQL connections; never a sequential request simulation. */
class DistributionConcurrencyPostgresTest extends TestCase
{
    private ?int $teacherId = null;
    private ?string $assessmentId = null;
    private array $studentIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        $this->assertSame('testing', app()->environment());
        $this->assertSame('webstudy_test', DB::connection()->getDatabaseName());
        $this->assertSame('webstudy_test', DB::selectOne('SELECT current_database() AS name')->name);
        Artisan::call('migrate', ['--force' => true]);
    }

    protected function tearDown(): void
    {
        if ($this->teacherId && DB::getDriverName() === 'pgsql'
            && DB::selectOne('SELECT current_database() AS name')->name === 'webstudy_test') {
            $teacherId = $this->teacherId;
            DB::transaction(function () use ($teacherId) {
                foreach ([
                    'student_notifications' => 'distribution_notification_no_delete',
                    'distribution_commands' => 'distribution_command_append_only',
                    'distribution_events' => 'distribution_event_append_only',
                    'distributions' => 'distribution_guard_write',
                    'distribution_batches' => 'distribution_batch_append_only',
                    'assessment_revisions' => 'block_published_revision_delete',
                ] as $table => $trigger) DB::statement("ALTER TABLE $table DISABLE TRIGGER $trigger");
                $ids = DB::table('distributions')->where('teacher_id', $teacherId)->pluck('id');
                DB::table('student_notifications')->whereIn('distribution_id', $ids)->delete();
                DB::table('distribution_commands')->whereIn('distribution_id', $ids)->delete();
                DB::table('distribution_events')->whereIn('distribution_id', $ids)->delete();
                DB::table('distributions')->where('teacher_id', $teacherId)->delete();
                DB::table('distribution_batches')->where('teacher_id', $teacherId)->delete();
                $classIds = DB::table('classrooms')->where('teacher_id', $teacherId)->pluck('id');
                DB::table('class_memberships')->whereIn('classroom_id', $classIds)->delete();
                DB::table('class_join_requests')->whereIn('classroom_id', $classIds)->delete();
                DB::table('class_roster_entries')->whereIn('classroom_id', $classIds)->delete();
                DB::table('classrooms')->where('teacher_id', $teacherId)->delete();
                DB::table('assessment_revisions')->where('assessment_id', $this->assessmentId)->delete();
                DB::table('assessments')->where('id', $this->assessmentId)->delete();
                DB::table('teacher_profiles')->where('user_id', $teacherId)->delete();
                DB::table('users')->where('id', $teacherId)->delete();
                DB::table('users')->whereIn('id', $this->studentIds)->delete();
                foreach ([
                    'assessment_revisions' => 'block_published_revision_delete',
                    'distribution_batches' => 'distribution_batch_append_only',
                    'distributions' => 'distribution_guard_write',
                    'distribution_events' => 'distribution_event_append_only',
                    'distribution_commands' => 'distribution_command_append_only',
                    'student_notifications' => 'distribution_notification_no_delete',
                ] as $table => $trigger) DB::statement("ALTER TABLE $table ENABLE TRIGGER $trigger");
            });
        }
        parent::tearDown();
    }

    public function test_simultaneous_same_key_create_replays_without_duplicate_batch(): void
    {
        [$teacher, $revisionId, $classId] = $this->fixture();
        $payload = $this->payload($revisionId, $classId);
        $results = $this->race($teacher->id, [
            ['action' => 'create', 'teacherId' => $teacher->id, 'payload' => $payload, 'key' => 'distribution-race-key-001'],
            ['action' => 'create', 'teacherId' => $teacher->id, 'payload' => $payload, 'key' => 'distribution-race-key-001'],
        ]);
        $this->assertSame([200, 201], $this->statuses($results));
        $this->assertSame($results[0]['batchId'], $results[1]['batchId']);
        $this->assertSame(1, DB::table('distribution_batches')->where('teacher_id', $teacher->id)->count());
        $this->assertSame(1, Distribution::where('teacher_id', $teacher->id)->count());
        $this->assertSame(1, DB::table('distribution_events')->where('event_type', 'created')->count());
    }

    public function test_simultaneous_different_key_create_detects_new_overlap(): void
    {
        [$teacher, $revisionId, $classId] = $this->fixture();
        $payload = $this->payload($revisionId, $classId);
        $results = $this->race($teacher->id, [
            ['action' => 'create', 'teacherId' => $teacher->id, 'payload' => $payload, 'key' => 'distribution-race-key-002'],
            ['action' => 'create', 'teacherId' => $teacher->id, 'payload' => $payload, 'key' => 'distribution-race-key-003'],
        ]);
        $this->assertSame([201, 409], $this->statuses($results));
        $this->assertSame(1, DB::table('distribution_batches')->where('teacher_id', $teacher->id)->count());
        $this->assertSame(1, Distribution::where('teacher_id', $teacher->id)->count());
    }

    public function test_simultaneous_close_and_cancel_have_serial_lifecycle(): void
    {
        [$teacher, $revisionId, $classId] = $this->fixture();
        config(['distribution.creation_enabled' => true]);
        $created = app(\App\Services\DistributionService::class)->create($teacher,
            $this->payload($revisionId, $classId), 'distribution-race-key-004');
        $id = $created['distributions'][0]['id'];
        $results = $this->race($teacher->id, [
            ['action' => 'close', 'teacherId' => $teacher->id, 'distributionId' => $id,
                'version' => 1, 'reason' => null, 'key' => 'distribution-race-close-001'],
            ['action' => 'cancel', 'teacherId' => $teacher->id, 'distributionId' => $id,
                'version' => 1, 'reason' => 'Lịch thay đổi', 'key' => 'distribution-race-cancel-001'],
        ]);
        $this->assertSame([200, 409], $this->statuses($results));
        $this->assertSame(2, Distribution::findOrFail($id)->version);
        $this->assertSame(2, DB::table('distribution_events')->where('distribution_id', $id)->count());
    }

    public function test_simultaneous_same_key_close_writes_one_event(): void
    {
        [$teacher, $revisionId, $classId] = $this->fixture();
        config(['distribution.creation_enabled' => true]);
        $created = app(\App\Services\DistributionService::class)->create($teacher,
            $this->payload($revisionId, $classId), 'distribution-race-key-006');
        $id = $created['distributions'][0]['id'];
        $input = ['action' => 'close', 'teacherId' => $teacher->id, 'distributionId' => $id,
            'version' => 1, 'reason' => null, 'key' => 'distribution-race-close-002'];
        $results = $this->race($teacher->id, [$input, $input]);
        $this->assertSame([200, 200], $this->statuses($results));
        $this->assertSame(2, Distribution::findOrFail($id)->version);
        $this->assertSame(1, DB::table('distribution_events')->where('distribution_id', $id)
            ->where('event_type', 'closed')->count());
        $this->assertSame(1, DB::table('distribution_commands')->where('distribution_id', $id)->count());
    }

    public function test_cancel_and_membership_leave_serialize_recipient_snapshot(): void
    {
        [$teacher, $revisionId, $classId] = $this->fixture();
        $classroom = Classroom::findOrFail($classId);
        app(ClassroomService::class)->importRoster($teacher, $classroom, [[
            'orderNumber' => 1, 'fullName' => 'Race student', 'studentCode' => 'RACE-STUDENT',
        ]]);
        $student = User::factory()->create();
        $student->forceFill(['role' => 'student'])->save();
        $this->studentIds[] = $student->id;
        $membershipService = app(ClassMembershipService::class);
        $join = $membershipService->requestJoin($student, $classroom->code, 'RACE-STUDENT');
        $membership = $membershipService->approve($teacher, $join);
        config(['distribution.creation_enabled' => true]);
        $created = app(\App\Services\DistributionService::class)->create($teacher,
            $this->payload($revisionId, $classId), 'distribution-race-key-005');
        $distributionId = $created['distributions'][0]['id'];
        $results = $this->race($teacher->id, [
            ['action' => 'cancel', 'teacherId' => $teacher->id, 'distributionId' => $distributionId,
                'version' => 1, 'reason' => 'Thay đổi lịch', 'key' => 'distribution-race-cancel-002'],
            ['action' => 'leave', 'teacherId' => $teacher->id, 'membershipId' => $membership->id,
                'studentId' => $student->id],
        ], 'classrooms', $classId);
        $this->assertSame([200, 200], $this->statuses($results));
        $this->assertSame('left', ClassMembership::findOrFail($membership->id)->status);
        $this->assertSame('cancelled', Distribution::findOrFail($distributionId)->lifecycle_status);
        // Laravel persists these timestamps at second precision, so their equality does not imply a race.
        $notices = DB::table('student_notifications')->where('distribution_id', $distributionId)->get();
        $this->assertContains($notices->count(), [0, 1]);
        if ($notices->isNotEmpty()) $this->assertSame($student->id, $notices->first()->student_id);
        $this->assertSame(1, DB::table('distribution_events')->where('distribution_id', $distributionId)
            ->where('event_type', 'cancelled')->count());
    }

    public function test_two_independent_starts_overlap_and_only_one_consumes_quota(): void
    {
        [$teacher, $revisionId, $classId] = $this->fixture();
        $classroom = Classroom::findOrFail($classId);
        app(ClassroomService::class)->importRoster($teacher, $classroom, [[
            'orderNumber' => 1, 'fullName' => 'Attempt race student', 'studentCode' => 'ATT-RACE-STUDENT',
        ]]);
        $student = User::factory()->create();
        $student->forceFill(['role' => 'student'])->save();
        $this->studentIds[] = $student->id;
        $membership = app(ClassMembershipService::class)->requestJoin($student, $classroom->code, 'ATT-RACE-STUDENT');
        app(ClassMembershipService::class)->approve($teacher, $membership);
        config(['distribution.creation_enabled' => true]);
        $created = app(\App\Services\DistributionService::class)->create($teacher,
            $this->payload($revisionId, $classId), 'distribution-attempt-race-001');
        $distributionId = $created['distributions'][0]['id'];
        try {
            $results = $this->attemptRace($student->id, [
                ['operation' => 'start', 'studentId' => $student->id, 'distributionId' => $distributionId, 'key' => 'attempt-race-start-one'],
                ['operation' => 'start', 'studentId' => $student->id, 'distributionId' => $distributionId, 'key' => 'attempt-race-start-two'],
            ]);
            $this->assertSame([200, 409], $this->statuses($results));
            $this->assertSame(1, DB::table('student_attempts')->where('distribution_id', $distributionId)->count());
            $this->assertSame(1, DB::table('attempt_events')->where('distribution_id', $distributionId)->where('event_type', 'started')->count());
            $attemptId = DB::table('student_attempts')->where('distribution_id', $distributionId)->value('id');
            $submitted = $this->attemptRace($student->id, [
                ['operation' => 'submit', 'studentId' => $student->id, 'attemptId' => $attemptId, 'key' => 'attempt-race-submit-one'],
                ['operation' => 'submit', 'studentId' => $student->id, 'attemptId' => $attemptId, 'key' => 'attempt-race-submit-two'],
            ]);
            $this->assertSame([200, 409], $this->statuses($submitted));
            $this->assertSame('SUBMITTED', DB::table('student_attempts')->where('id', $attemptId)->value('status'));
            $this->assertSame(1, DB::table('attempt_events')->where('attempt_id', $attemptId)->where('event_type', 'manual_submit')->count());
        } finally {
            DB::transaction(function () use ($distributionId) {
                DB::statement('ALTER TABLE attempt_commands DISABLE TRIGGER attempt_commands_append_only');
                DB::statement('ALTER TABLE attempt_events DISABLE TRIGGER attempt_events_append_only');
                $attemptIds = DB::table('student_attempts')->where('distribution_id', $distributionId)->pluck('id');
                DB::table('attempt_commands')->where('target_scope', $distributionId)->orWhereIn('target_scope', $attemptIds)->delete();
                DB::table('attempt_events')->where('distribution_id', $distributionId)->delete();
                DB::table('assessment_results')->where('distribution_id', $distributionId)->delete();
                DB::table('student_attempts')->where('distribution_id', $distributionId)->delete();
                DB::statement('ALTER TABLE attempt_commands ENABLE TRIGGER attempt_commands_append_only');
                DB::statement('ALTER TABLE attempt_events ENABLE TRIGGER attempt_events_append_only');
            });
        }
    }

    private function attemptRace(int $studentId, array $inputs): array
    {
        $db = DB::connection();
        $workers = [];
        $pids = [];
        $db->beginTransaction();
        try {
            $db->table('users')->where('id', $studentId)->lockForUpdate()->first();
            foreach ($inputs as $input) {
                $worker = new Process([PHP_BINARY, base_path('tests/Support/attempt-race-worker.php'),
                    json_encode($input, JSON_THROW_ON_ERROR)], base_path(), [
                    'APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'webstudy_test',
                    'DB_URL' => '', 'WEBSTUDY_PG_TEST' => '1',
                ]);
                $worker->setTimeout(20);
                $worker->start();
                $workers[] = $worker;
            }
            $deadline = microtime(true) + 10;
            do {
                $pids = [];
                foreach ($workers as $worker) {
                    $ready = json_decode(strtok($worker->getOutput(), "\n") ?: '', true);
                    if (isset($ready['pid'])) $pids[] = $ready['pid'];
                }
                if (count($pids) === 2) {
                    $waiting = (int) $db->table('pg_stat_activity')->whereIn('pid', $pids)
                        ->where('wait_event_type', 'Lock')->count();
                    if ($waiting === 2) break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertCount(2, $pids);
            $this->assertSame(2, $waiting ?? 0, 'Both PostgreSQL workers must overlap on the lock');
        } finally { $db->commit(); }
        $results = [];
        foreach ($workers as $worker) {
            $worker->wait();
            $lines = array_values(array_filter(explode("\n", trim($worker->getOutput()))));
            $result = json_decode(end($lines) ?: '', true);
            $this->assertIsArray($result, $worker->getErrorOutput());
            $results[] = $result;
        }
        return $results;
    }

    private function fixture(): array
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([]);
        $this->teacherId = $teacher->id;
        $assessment = Assessment::create(['teacher_id' => $teacher->id, 'title' => 'Race', 'version' => 1]);
        $this->assessmentId = $assessment->id;
        $revision = $assessment->revisions()->create(['revision_no' => 1, 'status' => 'published',
            'title' => 'Race', 'version' => 1, 'total_points' => '1', 'published_at' => now()]);
        $classroom = Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => 'Race class',
            'academic_year' => '2026-2027', 'code' => 'RACE'.bin2hex(random_bytes(5)), 'status' => 'active']);
        return [$teacher, $revision->id, $classroom->id];
    }

    private function payload(string $revisionId, string $classId): array
    {
        return ['revisionId' => $revisionId, 'classroomIds' => [$classId],
            'deadlineAt' => now()->addDay()->toIso8601String(), 'timeLimitSeconds' => 900,
            'deadlinePolicy' => 'HARD_DEADLINE'];
    }

    private function race(int $teacherId, array $inputs, string $lockTable = 'users', ?string $lockId = null): array
    {
        $db = DB::connection();
        $workers = [];
        $pids = [];
        $db->beginTransaction();
        try {
            $db->table($lockTable)->where('id', $lockId ?? $teacherId)->lockForUpdate()->first();
            foreach ($inputs as $input) {
                $worker = new Process([PHP_BINARY, base_path('tests/Support/distribution-race-worker.php'),
                    json_encode($input, JSON_THROW_ON_ERROR)], base_path(), [
                    'APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'webstudy_test',
                    'DB_URL' => '', 'WEBSTUDY_PG_TEST' => '1',
                ]);
                $worker->setTimeout(20);
                $worker->start();
                $workers[] = $worker;
            }
            $deadline = microtime(true) + 10;
            do {
                $pids = [];
                foreach ($workers as $worker) {
                    $ready = json_decode(strtok($worker->getOutput(), "\n") ?: '', true);
                    if (isset($ready['pid'])) $pids[] = $ready['pid'];
                }
                if (count($pids) === 2) {
                    $waiting = (int) $db->table('pg_stat_activity')->whereIn('pid', $pids)
                        ->where('wait_event_type', 'Lock')->count();
                    if ($waiting === 2) break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertCount(2, $pids, 'Two independent PostgreSQL connections must start');
            $this->assertSame(2, $waiting ?? 0, 'Both workers must overlap while waiting on row lock');
        } finally { $db->commit(); }
        $results = [];
        foreach ($workers as $worker) {
            $worker->wait();
            $lines = array_values(array_filter(explode("\n", trim($worker->getOutput()))));
            $result = json_decode(end($lines) ?: '', true);
            $this->assertIsArray($result, $worker->getErrorOutput());
            $results[] = $result;
        }
        return $results;
    }

    private function statuses(array $results): array
    {
        $statuses = array_column($results, 'status'); sort($statuses); return $statuses;
    }
}
