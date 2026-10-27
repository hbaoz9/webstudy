<?php

namespace Tests\Feature;

use App\Models\ClassJoinRequest;
use App\Models\ClassMembership;
use App\Models\Classroom;
use App\Models\ClassRosterEntry;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClassroomMembershipDatabaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_relationships_and_membership_history_survive_a_class_change(): void
    {
        $student = User::factory()->create();
        $firstClass = $this->createClassroom('10A1', 'ABC123');
        $firstRoster = $this->createRoster($firstClass, '10A1-01', $student);
        $firstRequest = $this->createRequest($firstClass, $student, '10A1-01', 'approved');
        $firstMembership = $this->createMembership($firstClass, $student, $firstRoster, $firstRequest);

        $firstMembership->forceFill(['status' => 'left', 'left_at' => now()])->save();
        $firstRoster->forceFill(['status' => 'not_joined', 'linked_user_id' => null])->save();

        $secondClass = $this->createClassroom('10A2', 'DEF456');
        $secondRoster = $this->createRoster($secondClass, '10A2-01', $student);
        $secondRequest = $this->createRequest($secondClass, $student, '10A2-01', 'approved');
        $secondMembership = $this->createMembership($secondClass, $student, $secondRoster, $secondRequest);

        $this->assertTrue($secondMembership->student->is($student));
        $this->assertTrue($secondMembership->classroom->is($secondClass));
        $this->assertTrue($secondMembership->rosterEntry->is($secondRoster));
        $this->assertTrue($secondMembership->joinRequest->is($secondRequest));
        $this->assertTrue($secondRequest->membership->is($secondMembership));
        $this->assertCount(2, $student->classMemberships);
        $this->assertSame('left', $firstMembership->fresh()->status);
        $this->assertNotNull($firstMembership->fresh()->left_at);
        $this->assertDatabaseCount('class_memberships', 2);
    }

    public function test_a_student_cannot_have_two_active_memberships(): void
    {
        $student = User::factory()->create();
        $firstClass = $this->createClassroom('10A1', 'ABC123');
        $firstRoster = $this->createRoster($firstClass, '10A1-01', $student);
        $firstRequest = $this->createRequest($firstClass, $student, '10A1-01', 'approved');
        $this->createMembership($firstClass, $student, $firstRoster, $firstRequest);

        $secondClass = $this->createClassroom('10A2', 'DEF456');
        $secondRoster = $this->createRoster($secondClass, '10A2-01');
        $secondRequest = $this->createRequest($secondClass, $student, '10A2-01', 'approved');

        $this->expectException(QueryException::class);
        $this->createMembership($secondClass, $student, $secondRoster, $secondRequest);
    }

    public function test_rejected_request_can_be_resubmitted_but_pending_request_cannot_be_duplicated(): void
    {
        $student = User::factory()->create();
        $classroom = $this->createClassroom('10A1', 'ABC123');
        $rejected = $this->createRequest($classroom, $student, '10A1-01');
        $rejected->forceFill(['status' => 'rejected'])->save();

        $this->createRequest($classroom, $student, '10A1-01');
        $this->assertDatabaseCount('class_join_requests', 2);

        $this->expectException(QueryException::class);
        $this->createRequest($classroom, $student, '10A1-01');
    }

    public function test_membership_request_must_match_student_and_classroom(): void
    {
        $student = User::factory()->create();
        $firstClass = $this->createClassroom('10A1', 'ABC123');
        $secondClass = $this->createClassroom('10A2', 'DEF456');
        $request = $this->createRequest($firstClass, $student, '10A1-01', 'approved');
        $roster = $this->createRoster($secondClass, '10A2-01', $student);

        $this->expectException(QueryException::class);
        $this->createMembership($secondClass, $student, $roster, $request);
    }

    private function createClassroom(string $name, string $code): Classroom
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();

        return $teacher->teacherProfile()->create([])->classrooms()->create([
            'name' => $name,
            'academic_year' => '2026-2027',
            'code' => $code,
        ]);
    }

    private function createRoster(Classroom $classroom, string $code, ?User $student = null): ClassRosterEntry
    {
        $roster = $classroom->rosterEntries()->create([
            'order_number' => 1,
            'full_name' => 'Student Example',
            'student_code' => $code,
        ]);

        if ($student !== null) {
            $roster->forceFill(['linked_user_id' => $student->id, 'status' => 'joined'])->save();
        }

        return $roster;
    }

    private function createRequest(Classroom $classroom, User $student, string $code, string $status = 'pending'): ClassJoinRequest
    {
        $request = $classroom->joinRequests()->make([
            'student_name' => $student->name,
            'email' => $student->email,
            'student_code' => $code,
            'declared_class' => $classroom->name,
        ]);
        $request->student()->associate($student);

        if ($status === 'approved') {
            $request->forceFill(['verification_status' => 'matched', 'status' => 'approved']);
        }

        $request->save();

        return $request;
    }

    private function createMembership(Classroom $classroom, User $student, ClassRosterEntry $roster, ClassJoinRequest $request): ClassMembership
    {
        $membership = $classroom->memberships()->make([
            'roster_entry_id' => $roster->id,
            'join_request_id' => $request->id,
            'joined_at' => now(),
        ]);
        $membership->student()->associate($student);
        $membership->save();

        return $membership;
    }
}
