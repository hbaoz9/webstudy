<?php

namespace Tests\Feature;

use App\Models\Classroom;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClassroomApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authentication_role_verification_and_ownership(): void
    {
        $this->getJson('/api/teacher/classrooms')->assertUnauthorized();
        $this->getJson('/api/student/classrooms')->assertUnauthorized();
        $classroom = $this->createClassroom();
        $otherTeacher = $this->teacher();
        $student = User::factory()->create()->refresh();
        $this->actingAs($otherTeacher)->getJson('/api/teacher/classrooms')->assertForbidden();
        $this->verify($otherTeacher);
        $this->getJson("/api/teacher/classrooms/{$classroom->id}")->assertForbidden();
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/archive")->assertForbidden();
        $this->getJson("/api/teacher/classrooms/{$classroom->id}/roster")->assertForbidden();
        $this->getJson("/api/teacher/classrooms/{$classroom->id}/join-requests")->assertForbidden();
        $this->actingAs($student)->getJson('/api/teacher/classrooms')->assertForbidden();
        $this->getJson("/api/student/classrooms/{$classroom->id}")->assertForbidden();
        $this->actingAs($classroom->teacher->user)->getJson('/api/student/classrooms')->assertForbidden();
    }

    public function test_teacher_creates_updates_imports_and_archives_without_losing_membership_history(): void
    {
        $teacher = $this->verifiedTeacher();
        $this->actingAs($teacher)->postJson('/api/teacher/classrooms', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'academic_year']);
        $created = $this->postJson('/api/teacher/classrooms', [
            'name' => '10A1', 'academic_year' => '2026-2027', 'teacher_id' => 999,
            'code' => 'FORGED', 'status' => 'archived',
        ])->assertCreated()->json('data');
        $id = $created['id'];
        $this->assertSame($teacher->id, Classroom::findOrFail($id)->teacher_id);
        $this->assertNotSame('FORGED', $created['code']);
        $this->assertSame('active', $created['status']);
        $this->putJson("/api/teacher/classrooms/$id", [
            'name' => '10A2', 'academic_year' => '2026-2027', 'teacher_id' => 999,
            'status' => 'archived',
        ])->assertOk()->assertJsonPath('data.name', '10A2')->assertJsonPath('data.status', 'active');
        $this->getJson('/api/teacher/classrooms')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/teacher/classrooms/$id/roster/import", ['rows' => []])->assertUnprocessable();
        $this->postJson("/api/teacher/classrooms/$id/roster/import", ['rows' => [
            ['orderNumber' => 1, 'fullName' => 'Student One', 'studentCode' => '10A2-01'],
        ]])->assertOk()->assertJsonPath('data.created', 1);
        $this->postJson("/api/teacher/classrooms/$id/roster/import", ['rows' => [
            ['orderNumber' => 2, 'fullName' => 'Student One Updated', 'studentCode' => '10A2-01'],
        ]])->assertOk()->assertJsonPath('data.updated', 1);
        $this->getJson("/api/teacher/classrooms/$id/roster")->assertOk()
            ->assertJsonPath('data.0.fullName', 'Student One Updated');

        $student = User::factory()->create()->refresh();
        $this->actingAs($student)->postJson('/api/student/join-requests', [
            'class_code' => $created['code'], 'student_code' => '10A2-01', 'declared_class' => '10A2',
            'student_id' => 999, 'status' => 'approved',
        ])->assertCreated()->assertJsonPath('data.status', 'pending');
        $joinId = $student->classJoinRequests()->firstOrFail()->id;
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/$id/join-requests/$joinId/approve")
            ->assertCreated()->assertJsonPath('data.status', 'active');
        $this->getJson("/api/teacher/classrooms/$id/memberships")->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/teacher/classrooms/$id/archive")->assertOk()->assertJsonPath('data.status', 'archived');
        $this->assertDatabaseHas('class_memberships', ['student_id' => $student->id, 'status' => 'left']);
        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_join_reject_resubmit_manual_verify_and_leave(): void
    {
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/roster/import", ['rows' => [
            ['orderNumber' => 1, 'fullName' => 'Student Example', 'studentCode' => '10A1-01'],
        ]])->assertOk();
        $student = User::factory()->create()->refresh();
        $payload = ['class_code' => $classroom->code, 'student_code' => 'WRONG', 'declared_class' => '10A1'];
        $this->actingAs($student)->postJson('/api/student/join-requests', $payload)->assertCreated();
        $firstId = $student->classJoinRequests()->firstOrFail()->id;
        $this->postJson('/api/student/join-requests', $payload)->assertUnprocessable();
        $this->getJson('/api/student/join-requests')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/$firstId/approve")
            ->assertUnprocessable();
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/$firstId/reject")
            ->assertOk()->assertJsonPath('data.status', 'rejected');
        $this->actingAs($student)->postJson('/api/student/join-requests', $payload)->assertCreated();
        $secondId = $student->classJoinRequests()->latest()->firstOrFail()->id;
        $rosterId = $classroom->rosterEntries()->firstOrFail()->id;
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/$secondId/manual-verify", [
            'roster_entry_id' => $rosterId, 'reason' => 'wrong_student_code',
        ])->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/$secondId/manual-verify", [
            'roster_entry_id' => $rosterId, 'reason' => 'wrong_student_code', 'note' => 'Checked school ID.',
        ])->assertCreated()->assertJsonPath('data.status', 'active');
        $this->getJson("/api/teacher/classrooms/{$classroom->id}/join-requests")
            ->assertOk()->assertJsonCount(2, 'data');
        $membership = $student->classMemberships()->firstOrFail();
        $this->actingAs($student)->getJson('/api/student/classrooms')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/student/classrooms/{$classroom->id}")->assertOk();
        $this->postJson("/api/student/memberships/{$membership->id}/leave")
            ->assertOk()->assertJsonPath('data.status', 'left');
        $this->assertDatabaseHas('class_memberships', ['id' => $membership->id, 'status' => 'left']);
        $this->assertDatabaseCount('class_memberships', 1);
        $this->getJson('/api/student/classrooms')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/student/classrooms/{$classroom->id}")->assertForbidden();
    }

    public function test_student_lookup_and_resources_do_not_expose_roster_or_other_students(): void
    {
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/roster/import", ['rows' => [
            ['orderNumber' => 1, 'fullName' => 'Private Student', 'studentCode' => 'PRIVATE-01'],
        ]])->assertOk();
        $student = User::factory()->create()->refresh();
        $this->actingAs($student)->getJson('/api/student/classrooms/lookup/'.mb_strtolower($classroom->code))
            ->assertOk()->assertJsonMissing(['fullName' => 'Private Student'])
            ->assertJsonMissingPath('data.studentCount');
        $this->getJson("/api/teacher/classrooms/{$classroom->id}/roster")->assertForbidden();
        $this->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'PRIVATE-01', 'declared_class' => '10A1',
            'student_id' => 999, 'verification_status' => 'manual_verified',
        ])->assertCreated()->assertJsonPath('data.status', 'pending');
        $this->assertSame($student->id, $student->classJoinRequests()->firstOrFail()->student_id);
        $this->assertSame('pending', $student->classJoinRequests()->firstOrFail()->status);
    }

    public function test_membership_conflict_and_nested_request_ownership(): void
    {
        $first = $this->createClassroom();
        $second = $this->createClassroom();
        foreach ([$first, $second] as $classroom) {
            $this->actingAs($classroom->teacher->user)->postJson("/api/teacher/classrooms/{$classroom->id}/roster/import", ['rows' => [
                ['orderNumber' => 1, 'fullName' => 'Student Example', 'studentCode' => $classroom->code.'-01'],
            ]])->assertOk();
        }
        $student = User::factory()->create()->refresh();
        foreach ([$first, $second] as $classroom) {
            $this->actingAs($student)->postJson('/api/student/join-requests', [
                'class_code' => $classroom->code, 'student_code' => $classroom->code.'-01',
                'declared_class' => $classroom->name,
            ])->assertCreated();
        }
        $firstRequest = $first->joinRequests()->firstOrFail();
        $secondRequest = $second->joinRequests()->firstOrFail();
        $this->actingAs($second->teacher->user)
            ->postJson("/api/teacher/classrooms/{$first->id}/join-requests/{$firstRequest->id}/approve")
            ->assertForbidden();
        $this->actingAs($first->teacher->user)
            ->postJson("/api/teacher/classrooms/{$first->id}/join-requests/{$secondRequest->id}/approve")
            ->assertNotFound();
        $this->postJson("/api/teacher/classrooms/{$first->id}/join-requests/{$firstRequest->id}/approve")
            ->assertCreated();
        $membership = $student->classMemberships()->firstOrFail();
        $otherStudent = User::factory()->create()->refresh();
        $this->actingAs($otherStudent)->postJson("/api/student/memberships/{$membership->id}/leave")
            ->assertForbidden();
        $this->actingAs($second->teacher->user)
            ->postJson("/api/teacher/classrooms/{$second->id}/join-requests/{$secondRequest->id}/approve")
            ->assertUnprocessable();
        $this->assertDatabaseCount('class_memberships', 1);
        $this->assertSame('pending', $secondRequest->fresh()->status);
    }

    private function createClassroom(): Classroom
    {
        $teacher = $this->verifiedTeacher();
        $response = $this->actingAs($teacher)->postJson('/api/teacher/classrooms', [
            'name' => '10A1', 'academic_year' => '2026-2027',
        ])->assertCreated();

        return Classroom::findOrFail($response->json('data.id'));
    }

    private function verifiedTeacher(): User
    {
        $teacher = $this->teacher();
        $this->verify($teacher);

        return $teacher;
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([]);

        return $teacher->refresh();
    }

    private function verify(User $teacher): void
    {
        $teacher->teacherProfile->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
    }
}
