<?php

namespace Tests\Feature;

use App\Models\Assessment;
use App\Models\Classroom;
use App\Models\Distribution;
use App\Models\User;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DistributionApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_release_gate_is_off_and_preview_is_read_only(): void
    {
        Config::set('distribution.creation_enabled', false);
        [$teacher, $revision, $classroom] = $this->fixture();
        $this->actingAs($teacher);
        $payload = $this->payload($revision->id, [$classroom->id]);
        $this->postJson('/api/teacher/distributions/preview', $payload)->assertOk()
            ->assertJsonPath('data.creationEnabled', false);
        $this->withHeader('Idempotency-Key', 'test-create-key-0001')
            ->postJson('/api/teacher/distributions/batches', $payload)->assertStatus(423)
            ->assertJsonPath('error.code', 'distribution_release_locked');
        $this->assertSame(0, DB::table('distribution_batches')->count());
        $this->assertSame(0, Distribution::count());
    }

    public function test_batch_idempotency_overlap_and_lifecycle(): void
    {
        Config::set('distribution.creation_enabled', true);
        [$teacher, $revision, $classroom] = $this->fixture();
        $other = Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => '10A2',
            'academic_year' => '2026-2027', 'code' => 'DIST10A2', 'status' => 'active']);
        $this->actingAs($teacher);
        $payload = $this->payload($revision->id, [$classroom->id, $other->id]);
        $url = '/api/teacher/distributions/batches';
        $created = $this->withHeader('Idempotency-Key', 'test-create-key-0002')
            ->postJson($url, $payload)->assertCreated()->assertJsonCount(2, 'data.distributions')->json('data');
        $this->assertSame(2, DB::table('distribution_events')->where('event_type', 'created')->count());
        $replayed = $this->postJson($url, $payload)->assertOk()->json('data');
        $this->assertSame($created['batchId'], $replayed['batchId']);
        $this->assertSame(2, Distribution::count());
        $this->postJson($url, $this->payload($revision->id, [$classroom->id]))
            ->assertStatus(409)->assertJsonPath('code', 'idempotency_conflict');
        $preview = $this->postJson('/api/teacher/distributions/preview', $payload)->assertOk()->json('data');
        $this->assertCount(2, $preview['overlaps']);
        $this->withHeader('Idempotency-Key', 'test-create-key-0003')->postJson($url, $payload)
            ->assertStatus(409)->assertJsonPath('code', 'overlap_confirmation_required');
        $second = $this->postJson($url, $payload + ['overlapConfirmationToken' => $preview['overlapConfirmationToken']]);
        $second->assertCreated();
        $id = $created['distributions'][0]['id'];
        $this->getJson('/api/teacher/distributions/'.$id)->assertOk()->assertJsonPath('data.version', 1);
        $this->withHeader('Idempotency-Key', 'test-close-key-0001')->postJson('/api/teacher/distributions/'.$id.'/close',
            ['expectedVersion' => 1])->assertOk()->assertJsonPath('data.version', 2);
        $this->postJson('/api/teacher/distributions/'.$id.'/close', ['expectedVersion' => 1])->assertOk();
        $this->withHeader('Idempotency-Key', 'test-cancel-key-0001')->postJson('/api/teacher/distributions/'.$id.'/cancel',
            ['expectedVersion' => 2, 'reason' => 'Kế hoạch thay đổi'])->assertOk()->assertJsonPath('data.version', 3);
        $this->withHeader('Idempotency-Key', 'test-close-key-0001')->postJson('/api/teacher/distributions/'.$id.'/close',
            ['expectedVersion' => 1])->assertOk()->assertJsonPath('data.version', 2)
            ->assertJsonPath('data.lifecycleStatus', 'closed');
        $this->getJson('/api/teacher/distributions/'.$id.'/events')->assertOk()->assertJsonCount(3, 'data');
        $this->assertSame(3, DB::table('distribution_events')->where('distribution_id', $id)->count());
    }

    public function test_list_can_scope_to_an_assessment_across_revisions_without_leaking_other_assessments(): void
    {
        Config::set('distribution.creation_enabled', true);
        [$teacher, $firstRevision, $firstClass] = $this->fixture();
        $assessment = $firstRevision->assessment;
        $secondRevision = $assessment->revisions()->create(['revision_no' => 2, 'status' => 'published',
            'title' => 'Đề địa lí bản hai', 'version' => 1, 'total_points' => '1.000000', 'published_at' => now()]);
        $otherAssessment = Assessment::create(['teacher_id' => $teacher->id, 'title' => 'Kiểm tra 45p', 'version' => 1]);
        $otherRevision = $otherAssessment->revisions()->create(['revision_no' => 1, 'status' => 'published',
            'title' => 'Kiểm tra 45p', 'version' => 1, 'total_points' => '1.000000', 'published_at' => now()]);
        $secondClass = Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => '10Z2',
            'academic_year' => '2026-2027', 'code' => 'DIST10Z2', 'status' => 'active']);
        $thirdClass = Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => '10Z3',
            'academic_year' => '2026-2027', 'code' => 'DIST10Z3', 'status' => 'active']);
        $this->actingAs($teacher);
        foreach ([[$firstRevision, $firstClass], [$secondRevision, $secondClass], [$otherRevision, $thirdClass]] as $index => [$revision, $classroom]) {
            $this->withHeader('Idempotency-Key', 'assessment-scope-'.($index + 1))
                ->postJson('/api/teacher/distributions/batches', $this->payload($revision->id, [$classroom->id]))
                ->assertCreated();
        }
        $url = '/api/teacher/distributions?assessmentId='.$assessment->id;
        $this->getJson($url)->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 2);
        $this->getJson($url.'&perPage=1&page=2')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 2);
        $this->getJson($url.'&classroomId='.$secondClass->id)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.revisionId', $secondRevision->id);
        $empty = Assessment::create(['teacher_id' => $teacher->id, 'title' => 'Chưa giao', 'version' => 1]);
        $this->getJson('/api/teacher/distributions?assessmentId='.$empty->id)->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($this->teacher())->getJson($url)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_teacher_ownership_and_student_visibility_are_enforced(): void
    {
        [$teacher, $revision, $classroom] = $this->fixture();
        $payload = $this->payload($revision->id, [$classroom->id]);
        $this->postJson('/api/teacher/distributions/preview', $payload)->assertUnauthorized();
        $this->actingAs(User::factory()->create())->postJson('/api/teacher/distributions/preview', $payload)->assertForbidden();
        $otherTeacher = $this->teacher();
        $this->actingAs($otherTeacher)->postJson('/api/teacher/distributions/preview', $payload)->assertNotFound();
        $this->actingAs($teacher)->postJson('/api/teacher/distributions/preview', $payload)->assertOk();
        $student = User::factory()->create();
        $student->forceFill(['role' => 'student'])->save();
        $this->actingAs($student)->getJson('/api/student/distributions')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_cancel_notifies_every_active_member_once_and_inbox_is_private(): void
    {
        Config::set('distribution.creation_enabled', true);
        [$teacher, $revision, $classroom] = $this->fixture();
        $service = app(ClassMembershipService::class);
        $students = [];
        foreach (['DIST-S1', 'DIST-S2'] as $number => $code) {
            app(ClassroomService::class)->importRoster($teacher, $classroom, [[
                'orderNumber' => $number + 1, 'fullName' => 'Student '.$code, 'studentCode' => $code,
            ]]);
            $student = User::factory()->create();
            $student->forceFill(['role' => 'student'])->save();
            $join = $service->requestJoin($student, $classroom->code, $code);
            $service->approve($teacher, $join);
            $students[] = $student;
        }
        $this->actingAs($teacher);
        $id = $this->withHeader('Idempotency-Key', 'test-create-key-0004')
            ->postJson('/api/teacher/distributions/batches', $this->payload($revision->id, [$classroom->id]))
            ->assertCreated()->json('data.distributions.0.id');
        $this->withHeader('Idempotency-Key', 'test-cancel-key-0002')
            ->postJson('/api/teacher/distributions/'.$id.'/cancel',
                ['expectedVersion' => 1, 'reason' => 'Hoãn bài kiểm tra'])->assertOk();
        $this->assertSame(2, DB::table('student_notifications')->where('distribution_id', $id)->count());
        $this->actingAs($students[0]);
        $notice = $this->getJson('/api/student/notifications')->assertOk()->assertJsonCount(1, 'data')->json('data.0');
        $this->assertStringNotContainsString('answerKey', json_encode($notice));
        $this->postJson('/api/student/notifications/'.$notice['id'].'/read')->assertOk();
        $this->postJson('/api/student/notifications/'.$notice['id'].'/read')->assertOk();
        $this->actingAs($students[1])->postJson('/api/student/notifications/'.$notice['id'].'/read')->assertNotFound();
        $this->getJson('/api/student/notifications')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_invalid_class_rolls_back_entire_batch_and_draft_cannot_be_assigned(): void
    {
        Config::set('distribution.creation_enabled', true);
        [$teacher, $revision, $classroom] = $this->fixture();
        $this->actingAs($teacher);
        $invalidClass = '00000000-0000-4000-8000-000000000000';
        $payload = $this->payload($revision->id, [$classroom->id, $invalidClass]);
        $this->withHeader('Idempotency-Key', 'test-create-key-0005')
            ->postJson('/api/teacher/distributions/batches', $payload)
            ->assertUnprocessable()->assertJsonPath('code', 'classroom_unavailable');
        $this->assertSame(0, DB::table('distribution_batches')->count());
        $this->assertSame(0, Distribution::count());
        $draftAssessment = Assessment::create(['teacher_id' => $teacher->id, 'title' => 'Draft', 'version' => 1]);
        $draft = $draftAssessment->revisions()->create(['revision_no' => 1, 'status' => 'draft',
            'title' => 'Draft', 'version' => 1, 'total_points' => '0']);
        $this->postJson('/api/teacher/distributions/preview', $this->payload($draft->id, [$classroom->id]))
            ->assertStatus(409)->assertJsonPath('code', 'revision_not_published');
    }

    public function test_student_visibility_never_exposes_private_revision_content(): void
    {
        Config::set('distribution.creation_enabled', true);
        Config::set('distribution.student_visibility_enabled', true);
        [$teacher, $revision, $classroom] = $this->fixture();
        app(ClassroomService::class)->importRoster($teacher, $classroom, [[
            'orderNumber' => 1, 'fullName' => 'Student', 'studentCode' => 'DIST-S3',
        ]]);
        $member = User::factory()->create();
        $member->forceFill(['role' => 'student'])->save();
        $join = app(ClassMembershipService::class)->requestJoin($member, $classroom->code, 'DIST-S3');
        app(ClassMembershipService::class)->approve($teacher, $join);
        $this->actingAs($teacher);
        $id = $this->withHeader('Idempotency-Key', 'test-create-key-0006')
            ->postJson('/api/teacher/distributions/batches', $this->payload($revision->id, [$classroom->id]))
            ->assertCreated()->json('data.distributions.0.id');
        $this->actingAs($member);
        $list = $this->getJson('/api/student/distributions')->assertOk()->assertJsonCount(1, 'data');
        $this->assertSame(false, $list->json('data.0.attemptAvailable'));
        $detail = $this->getJson('/api/student/distributions/'.$id)->assertOk();
        foreach (['answerKey', 'rubric', 'explanation', 'questions'] as $private) {
            $this->assertStringNotContainsString($private, $detail->getContent());
        }
        Config::set('distribution.student_visibility_enabled', false);
        $this->getJson('/api/student/distributions')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/student/distributions/'.$id)->assertNotFound();
    }

    public function test_postgres_batch_rolls_back_if_second_distribution_insert_fails(): void
    {
        if (DB::getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        $this->assertSame('webstudy_test', DB::selectOne('SELECT current_database() AS name')->name);
        Config::set('distribution.creation_enabled', true);
        [$teacher, $revision, $classroom] = $this->fixture();
        $second = Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => '10A2',
            'academic_year' => '2026-2027', 'code' => 'DISTROLLBACK', 'status' => 'active']);
        DB::unprepared("CREATE FUNCTION reject_distribution_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW.classroom_id = '$second->id'::uuid THEN RAISE EXCEPTION 'fixture insert failure'; END IF;
            RETURN NEW; END $$;
            CREATE TRIGGER reject_distribution_fixture AFTER INSERT ON distributions
            FOR EACH ROW EXECUTE FUNCTION reject_distribution_fixture();");
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'test-create-key-0007')
            ->postJson('/api/teacher/distributions/batches',
                $this->payload($revision->id, [$classroom->id, $second->id]))->assertStatus(500);
        $this->assertSame(0, DB::table('distribution_batches')->count());
        $this->assertSame(0, DB::table('distributions')->count());
        $this->assertSame(0, DB::table('distribution_events')->count());
    }

    public function test_schedule_limits_and_explicit_timezone_are_validated(): void
    {
        [$teacher, $revision, $classroom] = $this->fixture();
        $this->actingAs($teacher);
        $url = '/api/teacher/distributions/preview';
        $base = $this->payload($revision->id, [$classroom->id]);
        $this->postJson($url, array_replace($base, ['timeLimitSeconds' => 59]))->assertUnprocessable();
        $this->postJson($url, array_replace($base, ['maxAttempts' => 6]))->assertUnprocessable();
        $this->postJson($url, array_replace($base, ['deadlineAt' => now()->addDays(31)->toIso8601String()]))->assertUnprocessable();
        $this->postJson($url, array_replace($base, ['opensAt' => now()->subHour()->toIso8601String()]))->assertUnprocessable();
        $this->postJson($url, array_replace($base, ['deadlineAt' => '2026-11-15T17:00:00']))->assertUnprocessable();
        $this->postJson($url, array_replace($base, ['deadlinePolicy' => 'UNKNOWN']))->assertUnprocessable();
        $this->assertDatabaseCount('distributions', 0);
    }

    private function fixture(): array
    {
        $teacher = $this->teacher();
        $assessment = Assessment::create(['teacher_id' => $teacher->id, 'title' => 'Địa lí', 'version' => 1]);
        $revision = $assessment->revisions()->create(['revision_no' => 1, 'status' => 'published',
            'title' => 'Đề địa lí', 'version' => 1, 'total_points' => '1.000000', 'published_at' => now()]);
        $classroom = Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => '10A1',
            'academic_year' => '2026-2027', 'code' => 'DIST10A1', 'status' => 'active']);
        return [$teacher, $revision, $classroom];
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([])->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        return $teacher;
    }

    private function payload(string $revisionId, array $classroomIds): array
    {
        return ['revisionId' => $revisionId, 'classroomIds' => $classroomIds,
            'deadlineAt' => now()->addDay()->toIso8601String(), 'timeLimitSeconds' => 900,
            'deadlinePolicy' => 'HARD_DEADLINE'];
    }
}
