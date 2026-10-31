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
        $missingId = '00000000-0000-4000-8000-000000000000';
        $this->putJson("/api/teacher/classrooms/$missingId", ['name' => 'No session', 'academic_year' => '2026-2027'])->assertUnauthorized();
        $this->postJson("/api/teacher/classrooms/$missingId/archive")->assertUnauthorized();
        $this->getJson("/api/teacher/classrooms/$missingId/roster")->assertUnauthorized();
        $this->getJson("/api/teacher/classrooms/$missingId/join-requests?status=pending")->assertUnauthorized();
        $classroom = $this->createClassroom();
        $otherTeacher = $this->teacher();
        $student = User::factory()->create()->refresh();
        $this->actingAs($otherTeacher)->getJson('/api/teacher/classrooms')->assertForbidden();
        $this->putJson("/api/teacher/classrooms/{$classroom->id}", ['name' => 'Unverified', 'academic_year' => '2026-2027'])->assertForbidden();
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/archive")->assertForbidden();
        $this->getJson("/api/teacher/classrooms/{$classroom->id}/roster")->assertForbidden();
        $this->verify($otherTeacher);
        $this->getJson("/api/teacher/classrooms/{$classroom->id}")->assertForbidden();
        $this->putJson("/api/teacher/classrooms/{$classroom->id}", ['name' => 'Wrong owner', 'academic_year' => '2026-2027'])->assertForbidden();
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/archive")->assertForbidden();
        $this->getJson("/api/teacher/classrooms/{$classroom->id}/roster")->assertForbidden();
        $this->getJson("/api/teacher/classrooms/{$classroom->id}/join-requests")->assertForbidden();
        $this->actingAs($student)->getJson('/api/teacher/classrooms')->assertForbidden();
        $this->getJson("/api/teacher/classrooms/{$classroom->id}/roster")->assertForbidden();
        $this->putJson("/api/teacher/classrooms/{$classroom->id}", ['name' => 'Student edit', 'academic_year' => '2026-2027'])->assertForbidden();
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/archive")->assertForbidden();
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
        $this->putJson("/api/teacher/classrooms/$id", ['name' => '', 'academic_year' => 'invalid'])
            ->assertUnprocessable()->assertJsonValidationErrors(['name', 'academic_year']);
        $this->getJson('/api/teacher/classrooms')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/teacher/classrooms/$id/roster")->assertOk()
            ->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
        $this->getJson("/api/teacher/classrooms/00000000-0000-4000-8000-000000000000/roster")->assertNotFound();
        $this->postJson("/api/teacher/classrooms/$id/roster/import", ['rows' => []])->assertUnprocessable();
        $this->postJson("/api/teacher/classrooms/$id/roster/import", ['rows' => [
            ['orderNumber' => 1, 'fullName' => 'Student One', 'studentCode' => '10A2-01'],
        ]])->assertOk()->assertJsonPath('data.created', 1);
        $this->postJson("/api/teacher/classrooms/$id/roster/import", ['rows' => [
            ['orderNumber' => 2, 'fullName' => 'Student One Updated', 'studentCode' => '10A2-01'],
        ]])->assertOk()->assertJsonPath('data.updated', 1);
        $this->getJson("/api/teacher/classrooms/$id/roster")->assertOk()
            ->assertJsonPath('data.0.fullName', 'Student One Updated')
            ->assertJsonPath('data.0.status', 'not_joined')
            ->assertJsonPath('data.0.linkedUserId', null)
            ->assertJsonPath('meta.total', 1);

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
        $this->getJson("/api/teacher/classrooms/$id/roster")->assertOk()
            ->assertJsonPath('data.0.status', 'not_joined')->assertJsonPath('meta.total', 1);
        $this->getJson("/api/teacher/classrooms/$id/roster?search=updated&status=not_joined")
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.status', 'not_joined');
        $this->getJson("/api/teacher/classrooms/$id")->assertOk()->assertJsonPath('data.status', 'archived');
        $this->postJson("/api/teacher/classrooms/$id/archive")->assertUnprocessable();
        $this->putJson("/api/teacher/classrooms/$id", ['name' => '10A3', 'academic_year' => '2026-2027'])->assertUnprocessable();
        $this->assertDatabaseHas('class_memberships', ['student_id' => $student->id, 'status' => 'left']);
        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_restore_reopens_class_without_reactivating_membership_or_request_history(): void
    {
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $roster = $classroom->rosterEntries()->create([
            'order_number' => 1, 'full_name' => 'Student Example', 'student_code' => 'HS2002',
        ]);
        $student = User::factory()->create()->refresh();
        $this->actingAs($student)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'HS2099', 'declared_class' => $classroom->name,
        ])->assertCreated();
        $approvedRequest = $student->classJoinRequests()->firstOrFail();
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/{$approvedRequest->id}/manual-verify", [
            'roster_entry_id' => $roster->id, 'reason' => 'wrong_student_code', 'note' => 'Checked school ID.',
        ])->assertCreated();
        $membership = $student->classMemberships()->firstOrFail();

        $pendingStudent = User::factory()->create()->refresh();
        $this->actingAs($pendingStudent)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'HS3001', 'declared_class' => $classroom->name,
        ])->assertCreated();
        $pendingRequest = $pendingStudent->classJoinRequests()->firstOrFail();

        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/archive")
            ->assertOk()->assertJsonPath('data.status', 'archived')->assertJsonPath('data.studentCount', 0);
        $this->actingAs($pendingStudent)->getJson('/api/student/classrooms/lookup/'.$classroom->code)->assertNotFound();

        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/restore")
            ->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.studentCount', 0)
            ->assertJsonPath('data.id', $classroom->id)->assertJsonPath('data.code', $classroom->code);
        $this->assertDatabaseHas('class_memberships', ['id' => $membership->id, 'status' => 'left']);
        $this->assertDatabaseHas('class_roster_entries', ['id' => $roster->id, 'student_code' => 'HS2002', 'status' => 'not_joined', 'linked_user_id' => null]);
        $this->assertDatabaseHas('class_join_requests', [
            'id' => $approvedRequest->id, 'status' => 'approved', 'verification_status' => 'manual_verified',
            'original_student_code' => 'HS2099', 'manual_roster_entry_id' => $roster->id,
        ]);
        $this->assertDatabaseHas('class_join_requests', ['id' => $pendingRequest->id, 'status' => 'rejected']);
        $this->assertDatabaseCount('class_memberships', 1);
        $this->assertDatabaseCount('class_join_requests', 2);
        $this->actingAs($pendingStudent)->getJson('/api/student/classrooms/lookup/'.$classroom->code)->assertOk();
        $this->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'HS3001', 'declared_class' => $classroom->name,
        ])->assertCreated()->assertJsonPath('data.status', 'pending');
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/restore")
            ->assertUnprocessable()->assertJsonValidationErrors('classroom');
        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_restore_requires_verified_owner_and_archived_classroom(): void
    {
        $this->postJson('/api/teacher/classrooms/00000000-0000-4000-8000-000000000000/restore')->assertUnauthorized();
        $classroom = $this->createClassroom();
        $url = "/api/teacher/classrooms/{$classroom->id}/restore";
        $this->postJson($url)->assertUnprocessable()->assertJsonValidationErrors('classroom');
        $this->actingAs($classroom->teacher->user)->postJson("/api/teacher/classrooms/00000000-0000-4000-8000-000000000000/restore")
            ->assertNotFound();
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/archive")->assertOk();
        $otherTeacher = $this->teacher();
        $this->actingAs($otherTeacher)->postJson($url)->assertForbidden();
        $this->verify($otherTeacher);
        $this->postJson($url)->assertForbidden();
        $student = User::factory()->create()->refresh();
        $this->actingAs($student)->postJson($url)->assertForbidden();
        $this->assertSame('archived', $classroom->fresh()->status);
    }

    public function test_soft_delete_preserves_history_and_hides_all_classroom_routes(): void
    {
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $roster = $classroom->rosterEntries()->create([
            'order_number' => 1, 'full_name' => 'Student Example', 'student_code' => 'HS2002',
        ]);
        $student = User::factory()->create()->refresh();
        $this->actingAs($student)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'HS2099', 'declared_class' => $classroom->name,
        ])->assertCreated();
        $joinRequest = $student->classJoinRequests()->firstOrFail();
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/{$joinRequest->id}/manual-verify", [
            'roster_entry_id' => $roster->id, 'reason' => 'wrong_student_code', 'note' => 'Checked school ID.',
        ])->assertCreated();
        $membership = $student->classMemberships()->firstOrFail();
        $url = "/api/teacher/classrooms/{$classroom->id}";
        $this->deleteJson($url)->assertUnprocessable()->assertJsonValidationErrors('classroom');
        $this->postJson($url.'/archive')->assertOk();
        $this->deleteJson($url)->assertNoContent();

        $deleted = Classroom::withTrashed()->findOrFail($classroom->id);
        $this->assertNotNull($deleted->deleted_at);
        $this->assertSame($classroom->id, $deleted->id);
        $this->assertSame($classroom->code, $deleted->code);
        $this->assertDatabaseHas('class_roster_entries', ['id' => $roster->id, 'classroom_id' => $classroom->id]);
        $this->assertDatabaseHas('class_join_requests', ['id' => $joinRequest->id, 'status' => 'approved', 'manual_roster_entry_id' => $roster->id]);
        $this->assertDatabaseHas('class_memberships', ['id' => $membership->id, 'status' => 'left']);
        $this->assertDatabaseCount('class_roster_entries', 1);
        $this->assertDatabaseCount('class_join_requests', 1);
        $this->assertDatabaseCount('class_memberships', 1);

        $this->getJson('/api/teacher/classrooms')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($url)->assertNotFound();
        $this->putJson($url, ['name' => 'Changed', 'academic_year' => '2026-2027'])->assertNotFound();
        $this->postJson($url.'/archive')->assertNotFound();
        $this->postJson($url.'/restore')->assertNotFound();
        $this->postJson($url.'/regenerate-code')->assertNotFound();
        $this->deleteJson($url)->assertNotFound();
        $this->getJson($url.'/roster')->assertNotFound();
        $this->getJson($url.'/join-requests')->assertNotFound();
        $this->getJson($url.'/memberships')->assertNotFound();
        $this->postJson($url."/join-requests/{$joinRequest->id}/approve")->assertNotFound();
        $this->actingAs($student)->getJson('/api/student/classrooms/lookup/'.$classroom->code)->assertNotFound();
        $this->getJson('/api/student/classrooms/'.$classroom->id)->assertNotFound();
        $this->getJson('/api/student/classrooms')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'HS2002', 'declared_class' => $classroom->name,
        ])->assertNotFound();
        $this->getJson('/api/student/join-requests')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_soft_delete_requires_verified_owner_and_consistent_archived_state(): void
    {
        $this->deleteJson('/api/teacher/classrooms/00000000-0000-4000-8000-000000000000')->assertUnauthorized();
        $classroom = $this->createClassroom();
        $url = "/api/teacher/classrooms/{$classroom->id}";
        $this->deleteJson($url)->assertUnprocessable();
        $otherTeacher = $this->teacher();
        $this->actingAs($otherTeacher)->deleteJson($url)->assertForbidden();
        $this->verify($otherTeacher);
        $this->deleteJson($url)->assertForbidden();
        $this->actingAs(User::factory()->create()->refresh())->deleteJson($url)->assertForbidden();

        $teacher = $classroom->teacher->user;
        $roster = $classroom->rosterEntries()->create(['order_number' => 1, 'full_name' => 'Student', 'student_code' => 'HS1']);
        $student = User::factory()->create()->refresh();
        $this->actingAs($student)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'HS1', 'declared_class' => $classroom->name,
        ])->assertCreated();
        $joinRequest = $student->classJoinRequests()->firstOrFail();
        $this->actingAs($teacher)->postJson($url."/join-requests/{$joinRequest->id}/manual-verify", [
            'roster_entry_id' => $roster->id, 'reason' => 'account_name_difference', 'note' => 'Checked school ID.',
        ])->assertCreated();
        $membership = $student->classMemberships()->firstOrFail();
        $this->postJson($url.'/archive')->assertOk();

// Tải lại membership sau khi Archive cập nhật database.
$membership->refresh();
$this->assertSame('left', $membership->status);

// Cố ý tạo trạng thái dữ liệu bất nhất để kiểm tra Soft Delete.
$membership->forceFill([
    'status' => 'active',
    'left_at' => null,
])->save();

// Bảo đảm trạng thái active thực sự đã được lưu vào database.
$this->assertSame('active', $membership->fresh()->status);

// Backend phải từ chối xóa lớp archived còn active membership.
$this->deleteJson($url)
    ->assertUnprocessable()
    ->assertJsonValidationErrors('classroom');
        $this->assertNull($classroom->fresh()->deleted_at);
    }

    public function test_regenerate_code_preserves_memberships_roster_and_pending_requests(): void
    {
        $this->postJson('/api/teacher/classrooms/00000000-0000-4000-8000-000000000000/regenerate-code')->assertUnauthorized();
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $oldCode = $classroom->code;
        $url = "/api/teacher/classrooms/{$classroom->id}/regenerate-code";
        $otherTeacher = $this->teacher();
        $this->actingAs($otherTeacher)->postJson($url)->assertForbidden();
        $this->verify($otherTeacher);
        $this->postJson($url)->assertForbidden();
        $this->actingAs(User::factory()->create()->refresh())->postJson($url)->assertForbidden();
        $roster = $classroom->rosterEntries()->create(['order_number' => 1, 'full_name' => 'Student', 'student_code' => 'HS1']);
        $student = User::factory()->create()->refresh();
        $this->actingAs($student)->postJson('/api/student/join-requests', [
            'class_code' => $oldCode, 'student_code' => 'HS1', 'declared_class' => $classroom->name,
        ])->assertCreated();
        $approved = $student->classJoinRequests()->firstOrFail();
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/{$approved->id}/manual-verify", [
            'roster_entry_id' => $roster->id, 'reason' => 'account_name_difference', 'note' => 'Checked school ID.',
        ])->assertCreated();
        $membership = $student->classMemberships()->firstOrFail();
        $pendingStudent = User::factory()->create()->refresh();
        $this->actingAs($pendingStudent)->postJson('/api/student/join-requests', [
            'class_code' => $oldCode, 'student_code' => 'HS2', 'declared_class' => $classroom->name,
        ])->assertCreated();
        $pending = $pendingStudent->classJoinRequests()->firstOrFail();
        $this->actingAs($teacher);
        $newCode = $this->postJson($url)->assertOk()->assertJsonPath('data.id', $classroom->id)->json('data.code');
        $this->assertNotSame($oldCode, $newCode);
        $this->assertMatchesRegularExpression('/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/', $newCode);
        $this->assertDatabaseHas('class_roster_entries', ['id' => $roster->id, 'linked_user_id' => $student->id]);
        $this->assertDatabaseHas('class_memberships', ['id' => $membership->id, 'status' => 'active']);
        $this->assertDatabaseHas('class_join_requests', ['id' => $pending->id, 'status' => 'pending']);
        $this->assertDatabaseCount('class_memberships', 1);
        $this->actingAs($pendingStudent)->getJson('/api/student/classrooms/lookup/'.$oldCode)->assertNotFound();
        $this->getJson('/api/student/classrooms/lookup/'.$newCode)->assertOk();
        $this->postJson('/api/student/join-requests', [
            'class_code' => $oldCode, 'student_code' => 'HS3', 'declared_class' => $classroom->name,
        ])->assertNotFound();
        $newStudent = User::factory()->create()->refresh();
        $this->actingAs($newStudent)->postJson('/api/student/join-requests', [
            'class_code' => $newCode, 'student_code' => 'HS3', 'declared_class' => $classroom->name,
        ])->assertCreated();
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/archive")->assertOk();
        $this->postJson($url)->assertUnprocessable()->assertJsonValidationErrors('classroom');
        $this->deleteJson("/api/teacher/classrooms/{$classroom->id}")->assertNoContent();
        $this->postJson($url)->assertNotFound();
    }

    public function test_roster_read_is_scoped_to_classroom_and_paginated(): void
    {
        $first = $this->createClassroom();
        $second = $this->createClassroom();
        $teacher = $first->teacher->user;
        for ($number = 1; $number <= 101; $number++) {
            $first->rosterEntries()->create([
                'order_number' => $number,
                'full_name' => "Student $number",
                'student_code' => "FIRST-$number",
            ]);
        }
        $second->rosterEntries()->create([
            'order_number' => 1, 'full_name' => 'Other class student', 'student_code' => 'SECOND-1',
        ]);

        $this->actingAs($teacher)->getJson("/api/teacher/classrooms/{$first->id}/roster?page=1")
            ->assertOk()->assertJsonCount(100, 'data')->assertJsonPath('meta.total', 101)
            ->assertJsonPath('meta.last_page', 2)->assertJsonMissing(['fullName' => 'Other class student']);
        $this->getJson("/api/teacher/classrooms/{$first->id}/roster?page=2")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.orderNumber', 101)
            ->assertJsonMissing(['fullName' => 'Other class student']);
    }

    public function test_roster_search_filters_before_pagination_and_keeps_other_class_private(): void
    {
        $classroom = $this->createClassroom();
        $otherClassroom = $this->createClassroom();
        for ($number = 1; $number <= 150; $number++) {
            $classroom->rosterEntries()->create([
                'order_number' => $number,
                'full_name' => "Student $number",
                'student_code' => sprintf('HS%04d', $number),
            ]);
        }
        $otherClassroom->rosterEntries()->create([
            'order_number' => 1, 'full_name' => 'Hidden Name', 'student_code' => 'HIDDEN-1',
        ]);
        $url = "/api/teacher/classrooms/{$classroom->id}/roster";
        $this->actingAs($classroom->teacher->user)->getJson($url)
            ->assertOk()->assertJsonCount(100, 'data')->assertJsonPath('meta.total', 150);
        $this->getJson($url.'?page=2')
            ->assertOk()->assertJsonCount(50, 'data')->assertJsonPath('data.49.studentCode', 'HS0150');
        $this->getJson($url.'?search=hs0150')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.studentCode', 'HS0150')
            ->assertJsonPath('meta.total', 1);
        $this->getJson($url.'?search=STUDENT%20150')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.fullName', 'Student 150');
        $this->getJson($url.'?search=Hidden')
            ->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
        $this->getJson($url.'?search=%20%20')
            ->assertOk()->assertJsonPath('meta.total', 150);
    }

    public function test_roster_status_and_search_are_combined_and_order_is_stable(): void
    {
        $classroom = $this->createClassroom();
        $student = User::factory()->create()->refresh();
        $joined = $classroom->rosterEntries()->create([
            'order_number' => 1, 'full_name' => 'Match Joined', 'student_code' => 'JOIN-1',
        ]);
        $joined->forceFill(['status' => 'joined', 'linked_user_id' => $student->id])->save();
        $notJoined = $classroom->rosterEntries()->create([
            'order_number' => 1, 'full_name' => 'Match Waiting', 'student_code' => 'WAIT-1',
        ]);
        $conflict = $classroom->rosterEntries()->create([
            'order_number' => 2, 'full_name' => 'Match Conflict', 'student_code' => 'CONFLICT-1',
        ]);
        $conflict->forceFill(['status' => 'conflict'])->save();
        $url = "/api/teacher/classrooms/{$classroom->id}/roster";
        $this->actingAs($classroom->teacher->user);
        $expectedIds = [$joined->id, $notJoined->id];
        sort($expectedIds);
        $expectedIds[] = $conflict->id;
        $this->assertSame($expectedIds, array_column($this->getJson($url)->assertOk()->json('data'), 'id'));
        foreach (['joined' => $joined, 'not_joined' => $notJoined, 'conflict' => $conflict] as $status => $entry) {
            $this->getJson($url.'?status='.$status)
                ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $entry->id)
                ->assertJsonPath('meta.total', 1);
        }
        $this->getJson($url.'?search=match&status=conflict')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $conflict->id);
        $this->getJson($url.'?search=waiting&status=joined')
            ->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
        $this->getJson($url.'?search=missing')
            ->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
    }

    public function test_roster_search_treats_like_metacharacters_literally_and_rejects_invalid_parameters(): void
    {
        $classroom = $this->createClassroom();
        $classroom->rosterEntries()->create([
            'order_number' => 1, 'full_name' => 'Percent % Name', 'student_code' => 'PCT-1',
        ]);
        $classroom->rosterEntries()->create([
            'order_number' => 2, 'full_name' => 'Under_score Name', 'student_code' => 'UND-2',
        ]);
        $url = "/api/teacher/classrooms/{$classroom->id}/roster";
        $this->actingAs($classroom->teacher->user);
        $this->getJson($url.'?search=%25')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.studentCode', 'PCT-1');
        $this->getJson($url.'?search=_')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.studentCode', 'UND-2');
        $this->getJson($url.'?status=active')->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->getJson($url.'?page=0')->assertUnprocessable()->assertJsonValidationErrors('page');
        $this->getJson($url.'?page=abc')->assertUnprocessable()->assertJsonValidationErrors('page');
        $this->getJson($url.'?search='.str_repeat('a', 101))
            ->assertUnprocessable()->assertJsonValidationErrors('search');
        $this->getJson($url.'?search[]=bad')->assertUnprocessable()->assertJsonValidationErrors('search');
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

    public function test_student_can_request_with_only_class_code_without_becoming_a_member(): void
    {
        $classroom = $this->createClassroom();
        $student = User::factory()->create()->refresh();

        $this->actingAs($student)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code,
        ])->assertCreated()->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.verificationStatus', 'unverified')
            ->assertJsonPath('data.studentCode', null)
            ->assertJsonPath('data.declaredClass', null);
        $request = $student->classJoinRequests()->firstOrFail();
        $this->assertNull($request->student_code);
        $this->assertNull($request->declared_class);
        $this->assertDatabaseCount('class_memberships', 0);
        $this->getJson('/api/student/classrooms')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/student/join-requests', ['class_code' => $classroom->code])
            ->assertUnprocessable();

        $otherStudent = User::factory()->create()->refresh();
        $this->actingAs($otherStudent)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'HS999',
        ])->assertCreated()->assertJsonPath('data.verificationStatus', 'unverified');

        $this->actingAs($classroom->teacher->user)
            ->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/{$request->id}/approve")
            ->assertUnprocessable();
        $this->assertSame('pending', $request->fresh()->status);

        $this->postJson("/api/teacher/classrooms/{$classroom->id}/roster/import", ['rows' => [
            ['orderNumber' => 1, 'fullName' => $student->name, 'studentCode' => 'HS001'],
        ]])->assertOk();
        $this->assertSame('unverified', $request->fresh()->verification_status);
        $roster = $classroom->rosterEntries()->firstOrFail();
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/{$request->id}/manual-verify", [
            'roster_entry_id' => $roster->id,
            'reason' => 'wrong_student_code',
            'note' => 'Confirmed student identity in person.',
        ])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->assertSame('pending', $request->fresh()->status);
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/{$request->id}/manual-verify", [
            'roster_entry_id' => $roster->id,
            'reason' => 'student_code_unknown',
            'note' => 'Confirmed student identity in person.',
        ])->assertCreated()->assertJsonPath('data.status', 'active');
        $this->assertNull($request->fresh()->original_student_code);
        $this->assertSame('HS001', $request->fresh()->student_code);
        $this->assertSame('manual_verified', $request->fresh()->verification_status);
        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_student_code_matches_roster_without_declared_class_but_still_needs_approval(): void
    {
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/roster/import", ['rows' => [
            ['orderNumber' => 1, 'fullName' => 'Student One', 'studentCode' => 'HS001'],
        ]])->assertOk();
        $first = User::factory()->create()->refresh();
        $this->actingAs($first)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'hs 001',
        ])->assertCreated()->assertJsonPath('data.verificationStatus', 'matched')
            ->assertJsonPath('data.declaredClass', null)
            ->assertJsonPath('data.status', 'pending');
        $this->assertDatabaseCount('class_memberships', 0);
        $firstRequest = $first->classJoinRequests()->firstOrFail();
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/{$firstRequest->id}/approve")
            ->assertCreated()->assertJsonPath('data.status', 'active');

        $second = User::factory()->create()->refresh();
        $this->actingAs($second)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'HS001',
        ])->assertCreated()->assertJsonPath('data.verificationStatus', 'conflict');
        $secondRequest = $second->classJoinRequests()->firstOrFail();
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/join-requests/{$secondRequest->id}/approve")
            ->assertUnprocessable();
        $this->assertSame('pending', $secondRequest->fresh()->status);
        $this->assertSame($first->id, $classroom->rosterEntries()->firstOrFail()->linked_user_id);
        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_legacy_declared_class_mismatch_remains_readable(): void
    {
        $classroom = $this->createClassroom();
        $student = User::factory()->create()->refresh();

        $this->actingAs($student)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code,
            'student_code' => 'HS001',
            'declared_class' => '10A2',
        ])->assertCreated()->assertJsonPath('data.verificationStatus', 'mismatch');
        $this->getJson('/api/student/join-requests')->assertOk()
            ->assertJsonPath('data.0.declaredClass', '10A2')
            ->assertJsonPath('data.0.verificationStatus', 'mismatch');
        $this->assertDatabaseCount('class_memberships', 0);
    }

    public function test_teacher_join_request_queue_filters_counts_and_pagination_stay_within_classroom(): void
    {
        $classroom = $this->createClassroom();
        $otherClassroom = $this->createClassroom();
        $url = "/api/teacher/classrooms/{$classroom->id}/join-requests";
        $teacher = $classroom->teacher->user;

        $this->actingAs($this->teacher())->getJson($url)->assertForbidden();
        $this->actingAs($teacher)->getJson($url)->assertOk()
            ->assertJsonPath('meta.total', 0)
            ->assertJsonPath('statusCounts', ['pending' => 0, 'approved' => 0, 'rejected' => 0, 'processed' => 0, 'total' => 0]);

        $ids = [];
        $nullCodeRequestId = null;
        for ($index = 0; $index < 25; $index++) {
            $student = User::factory()->create()->refresh();
            $status = $index < 22 ? 'pending' : ($index < 24 ? 'approved' : 'rejected');
            $joinRequest = $classroom->joinRequests()->make([
                'student_name' => $student->name,
                'email' => $student->email,
                'student_code' => $index === 0 ? null : "HS$index",
                'declared_class' => $index === 0 ? null : '10A1',
            ]);
            $joinRequest->forceFill([
                'student_id' => $student->id,
                'status' => $status,
                'verification_status' => $status === 'approved' ? 'matched' : 'unverified',
                'created_at' => '2026-10-30 12:00:00',
            ])->save();
            $ids[$status][] = $joinRequest->id;
            if ($index === 0) {
                $nullCodeRequestId = $joinRequest->id;
            }
        }
        $otherStudent = User::factory()->create()->refresh();
        $otherRequest = $otherClassroom->joinRequests()->make([
            'student_name' => $otherStudent->name, 'email' => $otherStudent->email,
            'student_code' => null, 'declared_class' => null,
        ]);
        $otherRequest->forceFill([
            'student_id' => $otherStudent->id, 'status' => 'approved', 'verification_status' => 'matched',
        ])->save();

        $counts = ['pending' => 22, 'approved' => 2, 'rejected' => 1, 'processed' => 3, 'total' => 25];
        $all = $this->actingAs($teacher)->getJson($url)->assertOk()->assertJsonStructure([
            'data', 'links', 'meta', 'statusCounts' => ['pending', 'approved', 'rejected', 'processed', 'total'],
        ])->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 25)->assertJsonPath('statusCounts', $counts);
        $this->assertNotContains($otherRequest->id, array_column($all->json('data'), 'id'));
        $this->getJson($url.'?status=all')->assertOk()->assertJsonPath('meta.total', 25)->assertJsonPath('statusCounts', $counts);

        $pending = $this->getJson($url.'?status=pending')->assertOk()->assertJsonCount(20, 'data')
            ->assertJsonPath('meta.total', 22)->assertJsonPath('meta.last_page', 2)->assertJsonPath('statusCounts', $counts);
        $this->assertSame(['pending'], array_values(array_unique(array_column($pending->json('data'), 'status'))));
        $this->assertStringContainsString('status=pending', $pending->json('links.next'));
        $pendingSecond = $this->getJson($url.'?status=pending&page=2')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.current_page', 2)->assertJsonPath('meta.total', 22)->assertJsonPath('statusCounts', $counts);
        $expectedPendingIds = $ids['pending'];
        rsort($expectedPendingIds, SORT_STRING);
        $this->assertSame($expectedPendingIds, array_merge(
            array_column($pending->json('data'), 'id'), array_column($pendingSecond->json('data'), 'id')
        ));
        $allPendingRows = array_merge($pending->json('data'), $pendingSecond->json('data'));
        $nullCodeRow = collect($allPendingRows)->firstWhere('id', $nullCodeRequestId);
        $this->assertNull($nullCodeRow['studentCode']);
        $this->assertNull($nullCodeRow['declaredClass']);
        $this->assertContains('10A1', array_column($allPendingRows, 'declaredClass'));

        $processed = $this->getJson($url.'?status=processed')->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.total', 3)->assertJsonPath('statusCounts', $counts);
        $this->assertEqualsCanonicalizing(['approved', 'rejected'], array_unique(array_column($processed->json('data'), 'status')));
        $this->assertNotContains($otherRequest->id, array_column($processed->json('data'), 'id'));
        $this->getJson($url.'?status=invalid')->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->getJson($url.'?page=0')->assertUnprocessable()->assertJsonValidationErrors('page');

        $this->actingAs($otherClassroom->teacher->user)->getJson($url.'?status=processed')->assertForbidden();
        $this->actingAs($student)->getJson($url.'?status=processed')->assertForbidden();
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/archive")->assertOk();
        $this->getJson($url.'?status=processed')->assertOk()->assertJsonPath('statusCounts.total', 25);
        $classroom->delete();
        $this->getJson($url)->assertNotFound();
    }

    public function test_teacher_join_request_counts_follow_approve_and_reject(): void
    {
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $url = "/api/teacher/classrooms/{$classroom->id}/join-requests";
        $this->actingAs($teacher)->postJson("/api/teacher/classrooms/{$classroom->id}/roster/import", ['rows' => [
            ['orderNumber' => 1, 'fullName' => 'Student One', 'studentCode' => 'HS001'],
        ]])->assertOk();
        $approvedStudent = User::factory()->create()->refresh();
        $this->actingAs($approvedStudent)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code, 'student_code' => 'HS001',
        ])->assertCreated();
        $approvedRequest = $approvedStudent->classJoinRequests()->firstOrFail();
        $rejectedStudent = User::factory()->create()->refresh();
        $this->actingAs($rejectedStudent)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code,
        ])->assertCreated();
        $rejectedRequest = $rejectedStudent->classJoinRequests()->firstOrFail();
        $this->actingAs($teacher)->getJson($url.'?status=pending')->assertOk()
            ->assertJsonPath('statusCounts.pending', 2)->assertJsonPath('meta.total', 2);
        $this->postJson($url."/{$approvedRequest->id}/approve")->assertCreated();
        $this->postJson($url."/{$rejectedRequest->id}/reject")->assertOk();
        $this->getJson($url.'?status=pending')->assertOk()->assertJsonPath('meta.total', 0)
            ->assertJsonPath('statusCounts', ['pending' => 0, 'approved' => 1, 'rejected' => 1, 'processed' => 2, 'total' => 2]);
        $this->getJson($url.'?status=processed')->assertOk()->assertJsonPath('meta.total', 2);
        $this->actingAs($rejectedStudent)->postJson('/api/student/join-requests', [
            'class_code' => $classroom->code,
        ])->assertCreated()->assertJsonPath('data.status', 'pending');
        $this->actingAs($teacher)->getJson($url.'?status=pending')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('statusCounts', ['pending' => 1, 'approved' => 1, 'rejected' => 1, 'processed' => 2, 'total' => 3]);
        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_bulk_approval_preview_scans_the_whole_classroom_and_paginates_without_writing(): void
    {
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $otherClassroom = $this->createClassroom();
        $url = "/api/teacher/classrooms/{$classroom->id}/join-requests/bulk-approve/preview";
        $eligibleIds = [];

        foreach (User::factory()->count(101)->create() as $index => $student) {
            $code = sprintf('HS%04d', $index + 1);
            $classroom->rosterEntries()->create(['order_number' => $index + 1, 'full_name' => "Roster $index", 'student_code' => $code]);
            $joinRequest = $classroom->joinRequests()->make([
                'student_name' => $student->name, 'email' => $student->email,
                'student_code' => $code, 'declared_class' => null,
            ]);
            $joinRequest->student()->associate($student);
            $joinRequest->forceFill(['verification_status' => 'matched'])->save();
            $eligibleIds[] = $joinRequest->id;
        }

        $studentWithoutCode = User::factory()->create();
        $withoutCode = $classroom->joinRequests()->make([
            'student_name' => $studentWithoutCode->name, 'email' => $studentWithoutCode->email,
            'student_code' => null, 'declared_class' => null,
        ]);
        $withoutCode->student()->associate($studentWithoutCode);
        $withoutCode->forceFill(['verification_status' => 'unverified'])->save();

        $studentWithoutRoster = User::factory()->create();
        $withoutRoster = $classroom->joinRequests()->make([
            'student_name' => $studentWithoutRoster->name, 'email' => $studentWithoutRoster->email,
            'student_code' => 'MISSING', 'declared_class' => null,
        ]);
        $withoutRoster->student()->associate($studentWithoutRoster);
        $withoutRoster->forceFill(['verification_status' => 'matched'])->save();

        $studentWithMismatch = User::factory()->create();
        $classroom->rosterEntries()->create(['order_number' => 102, 'full_name' => 'Mismatch', 'student_code' => 'MISMATCH']);
        $mismatch = $classroom->joinRequests()->make([
            'student_name' => $studentWithMismatch->name, 'email' => $studentWithMismatch->email,
            'student_code' => 'MISMATCH', 'declared_class' => '10A2',
        ]);
        $mismatch->student()->associate($studentWithMismatch);
        $mismatch->forceFill(['verification_status' => 'matched'])->save();

        $studentWithConflict = User::factory()->create();
        $claimedBy = User::factory()->create();
        $claimedRoster = $classroom->rosterEntries()->create(['order_number' => 103, 'full_name' => 'Claimed', 'student_code' => 'CLAIMED']);
        $claimedRoster->forceFill(['linked_user_id' => $claimedBy->id, 'status' => 'joined'])->save();
        $conflict = $classroom->joinRequests()->make([
            'student_name' => $studentWithConflict->name, 'email' => $studentWithConflict->email,
            'student_code' => 'CLAIMED', 'declared_class' => null,
        ]);
        $conflict->student()->associate($studentWithConflict);
        $conflict->forceFill(['verification_status' => 'matched'])->save();

        $studentWithMembership = User::factory()->create();
        $otherClassroom->rosterEntries()->create(['order_number' => 1, 'full_name' => 'Existing member', 'student_code' => 'OTHER1']);
        $service = app(\App\Services\ClassMembershipService::class);
        $existing = $service->requestJoin($studentWithMembership, $otherClassroom->code, 'OTHER1');
        $service->approve($otherClassroom->teacher->user, $existing);
        $classroom->rosterEntries()->create(['order_number' => 104, 'full_name' => 'Already member', 'student_code' => 'ACTIVE']);
        $active = $classroom->joinRequests()->make([
            'student_name' => $studentWithMembership->name, 'email' => $studentWithMembership->email,
            'student_code' => 'ACTIVE', 'declared_class' => null,
        ]);
        $active->student()->associate($studentWithMembership);
        $active->forceFill(['verification_status' => 'matched'])->save();

        $studentLinkedElsewhere = User::factory()->create();
        $otherLinkedRoster = $otherClassroom->rosterEntries()->create(['order_number' => 2, 'full_name' => 'Linked elsewhere', 'student_code' => 'OTHER2']);
        $otherLinkedRoster->forceFill(['linked_user_id' => $studentLinkedElsewhere->id, 'status' => 'joined'])->save();
        $classroom->rosterEntries()->create(['order_number' => 105, 'full_name' => 'Other roster link', 'student_code' => 'LINKED']);
        $linked = $classroom->joinRequests()->make([
            'student_name' => $studentLinkedElsewhere->name, 'email' => $studentLinkedElsewhere->email,
            'student_code' => 'LINKED', 'declared_class' => null,
        ]);
        $linked->student()->associate($studentLinkedElsewhere);
        $linked->forceFill(['verification_status' => 'matched'])->save();

        $studentManuallyVerified = User::factory()->create();
        $manualRoster = $classroom->rosterEntries()->create(['order_number' => 106, 'full_name' => 'Manual', 'student_code' => 'MANUAL']);
        $manual = $classroom->joinRequests()->make([
            'student_name' => $studentManuallyVerified->name, 'email' => $studentManuallyVerified->email,
            'student_code' => 'MANUAL', 'declared_class' => null,
        ]);
        $manual->student()->associate($studentManuallyVerified);
        $manual->forceFill([
            'verification_status' => 'manual_verified', 'manual_roster_entry_id' => $manualRoster->id,
            'original_student_code' => 'WRONG', 'manual_verification_reason' => 'wrong_student_code',
            'manual_verification_note' => 'Checked ID', 'manually_verified_at' => now(),
        ])->save();

        $otherStudent = User::factory()->create();
        $otherClassroom->rosterEntries()->create(['order_number' => 3, 'full_name' => 'Other classroom', 'student_code' => 'OTHER3']);
        $otherRequest = $otherClassroom->joinRequests()->make([
            'student_name' => $otherStudent->name, 'email' => $otherStudent->email,
            'student_code' => 'OTHER3', 'declared_class' => null,
        ]);
        $otherRequest->student()->associate($otherStudent);
        $otherRequest->forceFill(['verification_status' => 'matched'])->save();

        $processedStudent = User::factory()->create();
        $classroom->rosterEntries()->create(['order_number' => 107, 'full_name' => 'Processed', 'student_code' => 'DONE']);
        $processedRequest = $service->requestJoin($processedStudent, $classroom->code, 'DONE');
        $service->approve($teacher, $processedRequest);
        $rejectedStudent = User::factory()->create();
        $rejectedRequest = $service->requestJoin($rejectedStudent, $classroom->code);
        $service->reject($teacher, $rejectedRequest);

        $before = [
            'requests' => \Illuminate\Support\Facades\DB::table('class_join_requests')->orderBy('id')->get()->toArray(),
            'roster' => \Illuminate\Support\Facades\DB::table('class_roster_entries')->orderBy('id')->get()->toArray(),
            'memberships' => \Illuminate\Support\Facades\DB::table('class_memberships')->orderBy('id')->get()->toArray(),
        ];
        $first = $this->actingAs($teacher)->postJson($url, [])->assertOk()
            ->assertJsonCount(100, 'data');
        $first->assertJsonPath('summary.eligibleTotal', 101)
            ->assertJsonPath('summary.requiresIndividualReviewTotal', 7)
            ->assertJsonPath('summary.pendingTotal', 108)
            ->assertJsonPath('meta.perPage', 100)->assertJsonPath('meta.currentPage', 1)
            ->assertJsonPath('meta.lastPage', 2)->assertJsonPath('meta.hasMore', true);
        $second = $this->postJson($url, ['page' => 2])->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('summary.eligibleTotal', 101)
            ->assertJsonPath('meta.currentPage', 2)->assertJsonPath('meta.hasMore', false);
        $returnedIds = array_merge(array_column($first->json('data'), 'requestId'), array_column($second->json('data'), 'requestId'));
        $this->assertEqualsCanonicalizing($eligibleIds, $returnedIds);
        $this->assertNotContains($otherRequest->id, $returnedIds);
        $this->assertNotContains($processedRequest->id, $returnedIds);
        $this->assertNotContains($rejectedRequest->id, $returnedIds);
        $this->assertSame(['requestId', 'studentName', 'studentEmail', 'submittedStudentCode', 'rosterEntryId', 'rosterStudentName', 'rosterStudentCode'], array_keys($first->json('data.0')));
        $this->assertEquals($before, [
            'requests' => \Illuminate\Support\Facades\DB::table('class_join_requests')->orderBy('id')->get()->toArray(),
            'roster' => \Illuminate\Support\Facades\DB::table('class_roster_entries')->orderBy('id')->get()->toArray(),
            'memberships' => \Illuminate\Support\Facades\DB::table('class_memberships')->orderBy('id')->get()->toArray(),
        ]);
    }

    public function test_bulk_approval_preview_requires_active_owned_classroom_and_valid_input(): void
    {
        $this->postJson('/api/teacher/classrooms/00000000-0000-4000-8000-000000000000/join-requests/bulk-approve/preview')->assertUnauthorized();
        $classroom = $this->createClassroom();
        $url = "/api/teacher/classrooms/{$classroom->id}/join-requests/bulk-approve/preview";
        $this->actingAs(User::factory()->create())->postJson($url)->assertForbidden();
        $this->actingAs($this->teacher())->postJson($url)->assertForbidden();
        $this->actingAs($this->verifiedTeacher())->postJson($url)->assertForbidden();
        $teacher = $classroom->teacher->user;
        $this->actingAs($teacher)->postJson($url, [])->assertOk()
            ->assertJsonCount(0, 'data')->assertJsonPath('summary', [
                'eligibleTotal' => 0, 'requiresIndividualReviewTotal' => 0, 'pendingTotal' => 0,
            ])->assertJsonPath('meta.lastPage', 1);
        $this->postJson($url, ['page' => 0])->assertUnprocessable()->assertJsonValidationErrors('page');
        $this->postJson($url, ['request_ids' => ['forged']])->assertUnprocessable()->assertJsonValidationErrors('request_ids');
        $this->postJson($url, ['verification_status' => 'matched'])->assertUnprocessable()->assertJsonValidationErrors('verification_status');
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/archive")->assertOk();
        $this->postJson($url)->assertUnprocessable();
        $classroom->delete();
        $this->postJson($url)->assertNotFound();
    }

    public function test_bulk_approve_only_selected_currently_matched_requests_and_retry_is_safe(): void
    {
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $otherClassroom = $this->createClassroom();
        $service = app(\App\Services\ClassMembershipService::class);
        $matched = [];
        foreach (['HS1001', 'HS1002', 'HS1003'] as $number => $code) {
            $classroom->rosterEntries()->create(['order_number' => $number + 1, 'full_name' => "Student $number", 'student_code' => $code]);
            $matched[] = $service->requestJoin(User::factory()->create(), $classroom->code, $code);
        }
        $missingCode = $service->requestJoin(User::factory()->create(), $classroom->code);
        $otherClassroom->rosterEntries()->create(['order_number' => 1, 'full_name' => 'Other', 'student_code' => 'OTHER']);
        $foreign = $service->requestJoin(User::factory()->create(), $otherClassroom->code, 'OTHER');
        $service->reject($teacher, $matched[2]);

        $url = "/api/teacher/classrooms/{$classroom->id}/join-requests/bulk-approve";
        $ids = [$matched[1]->id, $foreign->id, $missingCode->id, $matched[2]->id, $matched[0]->id];
        $response = $this->actingAs($teacher)->postJson($url, ['request_ids' => $ids])->assertOk()
            ->assertJsonPath('approvedCount', 2)->assertJsonPath('skippedCount', 3)
            ->assertJsonPath('statusCounts.pending', 1)->assertJsonPath('statusCounts.approved', 2)
            ->assertJsonPath('statusCounts.rejected', 1)->assertJsonPath('statusCounts.total', 4);
        $results = collect($response->json('results'))->keyBy('requestId');
        $this->assertSame('approved', $results[$matched[0]->id]['status']);
        $this->assertSame('approved', $results[$matched[1]->id]['status']);
        $this->assertSame('not_matched', $results[$missingCode->id]['reason']);
        $this->assertSame('already_processed', $results[$matched[2]->id]['reason']);
        $this->assertSame('not_found', $results[$foreign->id]['reason']);
        $this->assertSame('pending', $foreign->fresh()->status);
        $this->assertSame(2, $classroom->memberships()->where('status', 'active')->count());

        $retry = $this->postJson($url, ['request_ids' => $ids])->assertOk()
            ->assertJsonPath('approvedCount', 0)->assertJsonPath('skippedCount', 5);
        $this->assertSame(2, $classroom->memberships()->count());
        $this->assertSame('pending', $missingCode->fresh()->status);
        $this->assertSame('rejected', $matched[2]->fresh()->status);
        $this->assertSame(5, count($retry->json('results')));
    }

    public function test_bulk_approve_rechecks_roster_and_excludes_manual_verification(): void
    {
        $classroom = $this->createClassroom();
        $teacher = $classroom->teacher->user;
        $service = app(\App\Services\ClassMembershipService::class);
        foreach (['CHANGE', 'CLAIM', 'MANUAL'] as $number => $code) {
            $classroom->rosterEntries()->create(['order_number' => $number + 1, 'full_name' => $code, 'student_code' => $code]);
        }
        $changed = $service->requestJoin(User::factory()->create(), $classroom->code, 'CHANGE');
        $claimed = $service->requestJoin(User::factory()->create(), $classroom->code, 'CLAIM');
        $manual = $service->requestJoin(User::factory()->create(), $classroom->code, 'MANUAL');
        $otherClassroom = $this->createClassroom();
        $otherClassroom->rosterEntries()->create(['order_number' => 1, 'full_name' => 'Already member', 'student_code' => 'OTHERACTIVE']);
        $activeStudent = User::factory()->create();
        $existing = $service->requestJoin($activeStudent, $otherClassroom->code, 'OTHERACTIVE');
        $service->approve($otherClassroom->teacher->user, $existing);
        $classroom->rosterEntries()->create(['order_number' => 4, 'full_name' => 'New class', 'student_code' => 'NEWACTIVE']);
        $activeRequest = $classroom->joinRequests()->make([
            'student_name' => $activeStudent->name, 'email' => $activeStudent->email,
            'student_code' => 'NEWACTIVE', 'declared_class' => null,
        ]);
        $activeRequest->student()->associate($activeStudent);
        $activeRequest->forceFill(['verification_status' => 'matched'])->save();
        $url = "/api/teacher/classrooms/{$classroom->id}/join-requests/bulk-approve";
        $this->actingAs($teacher)->postJson("$url/preview")->assertJsonPath('summary.eligibleTotal', 3);
        $classroom->rosterEntries()->where('student_code', 'CHANGE')->update(['student_code' => 'CHANGED']);
        $classroom->rosterEntries()->where('student_code', 'CLAIM')->update(['linked_user_id' => User::factory()->create()->id, 'status' => 'joined']);
        $manualRoster = $classroom->rosterEntries()->where('student_code', 'MANUAL')->firstOrFail();
        $manual->forceFill([
            'verification_status' => 'manual_verified', 'manual_roster_entry_id' => $manualRoster->id,
            'original_student_code' => 'MANUAL', 'manual_verification_reason' => 'account_name_difference',
            'manual_verification_note' => 'Identity checked', 'manually_verified_at' => now(),
        ])->save();

        $response = $this->postJson($url, ['request_ids' => [$changed->id, $claimed->id, $manual->id, $activeRequest->id]])->assertOk()
            ->assertJsonPath('approvedCount', 0)->assertJsonPath('skippedCount', 4);
        $reasons = collect($response->json('results'))->pluck('reason', 'requestId');
        $this->assertSame('not_matched', $reasons[$changed->id]);
        $this->assertSame('not_matched', $reasons[$claimed->id]);
        $this->assertSame('not_matched', $reasons[$manual->id]);
        $this->assertSame('student_ineligible', $reasons[$activeRequest->id]);
        $this->assertSame(0, $classroom->memberships()->count());
        $this->assertSame(4, $classroom->joinRequests()->where('status', 'pending')->count());
    }

    public function test_bulk_approve_validates_ids_and_requires_active_owned_classroom(): void
    {
        $this->postJson('/api/teacher/classrooms/00000000-0000-4000-8000-000000000000/join-requests/bulk-approve', [
            'request_ids' => ['00000000-0000-4000-8000-000000000000'],
        ])->assertUnauthorized();
        $classroom = $this->createClassroom();
        $url = "/api/teacher/classrooms/{$classroom->id}/join-requests/bulk-approve";
        $id = '00000000-0000-4000-8000-000000000000';
        $this->actingAs(User::factory()->create())->postJson($url, ['request_ids' => [$id]])->assertForbidden();
        $this->actingAs($this->teacher())->postJson($url, ['request_ids' => [$id]])->assertForbidden();
        $this->actingAs($this->verifiedTeacher())->postJson($url, ['request_ids' => [$id]])->assertForbidden();
        $this->actingAs($classroom->teacher->user)->postJson($url, [])->assertUnprocessable()->assertJsonValidationErrors('request_ids');
        $this->postJson($url, ['request_ids' => []])->assertUnprocessable();
        $this->postJson($url, ['request_ids' => ['bad']])->assertUnprocessable()->assertJsonValidationErrors('request_ids.0');
        $this->postJson($url, ['request_ids' => [$id, $id]])->assertUnprocessable()->assertJsonValidationErrors('request_ids.1');
        $this->postJson($url, ['request_ids' => ['aaaaaaaa-0000-4000-8000-000000000000', 'AAAAAAAA-0000-4000-8000-000000000000']])
            ->assertUnprocessable()->assertJsonValidationErrors('request_ids.1');
        $this->postJson($url, ['request_ids' => array_fill(0, 101, $id)])->assertUnprocessable();
        $this->postJson($url, ['request_ids' => [$id], 'verification_status' => 'matched'])->assertUnprocessable();
        $this->postJson($url, ['request_ids' => [$id]])->assertJsonPath('results.0.reason', 'not_found');
        $this->postJson("/api/teacher/classrooms/{$classroom->id}/archive")->assertOk();
        $this->postJson($url, ['request_ids' => [$id]])->assertUnprocessable();
        $classroom->delete();
        $this->postJson($url, ['request_ids' => [$id]])->assertNotFound();
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
