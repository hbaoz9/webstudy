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
