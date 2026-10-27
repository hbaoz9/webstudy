<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ClassMembershipServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_matched_student_can_request_and_teacher_can_approve(): void
    {
        [$teacher, $classroom] = $this->classroom('10A1', '10A1-01');
        $student = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);

        $request = $service->requestJoin($student, mb_strtolower($classroom->code), '10 a1-01', 'Lớp 10A1');
        $this->assertSame('matched', $request->verification_status);
        $this->assertSame($student->email, $request->email);

        $membership = $service->approve($teacher, $request);
        $this->assertSame('active', $membership->status);
        $this->assertSame('approved', $request->fresh()->status);
        $this->assertSame($teacher->id, $request->fresh()->reviewed_by);
        $this->assertSame($student->id, $classroom->rosterEntries()->first()->linked_user_id);
        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_pending_request_is_unique_but_rejected_student_can_resubmit(): void
    {
        [$teacher, $classroom] = $this->classroom('10A1', '10A1-01');
        $student = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);
        $first = $service->requestJoin($student, $classroom->code, '10A1-01', '10A1');

        try {
            $service->requestJoin($student, $classroom->code, '10A1-01', '10A1');
            $this->fail('A duplicate pending request was accepted.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('classroom', $exception->errors());
        }

        $service->reject($teacher, $first);
        $second = $service->requestJoin($student, $classroom->code, '10A1-01', '10A1');
        $this->assertSame('pending', $second->status);
        $this->assertNotSame($first->id, $second->id);
        $this->assertDatabaseCount('class_join_requests', 2);
    }

    public function test_mismatched_request_cannot_be_approved(): void
    {
        [$teacher, $classroom] = $this->classroom('10A1', '10A1-01');
        $student = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);
        $request = $service->requestJoin($student, $classroom->code, '10A1-01', '10A2');
        $this->assertSame('mismatch', $request->verification_status);

        $this->expectException(ValidationException::class);
        $service->approve($teacher, $request);
    }

    public function test_second_student_cannot_claim_pending_roster_code(): void
    {
        [, $classroom] = $this->classroom('10A1', '10A1-01');
        $service = app(ClassMembershipService::class);
        $first = User::factory()->create()->refresh();
        $second = User::factory()->create()->refresh();
        $service->requestJoin($first, $classroom->code, '10A1-01', '10A1');

        try {
            $service->requestJoin($second, $classroom->code, '10 a1-01', '10A1');
            $this->fail('Two students claimed the same pending code.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('student_code', $exception->errors());
        }

        $this->assertDatabaseCount('class_join_requests', 1);
    }

    public function test_reviewed_request_cannot_be_reviewed_twice(): void
    {
        [$teacher, $classroom] = $this->classroom('10A1', '10A1-01');
        $student = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);
        $request = $service->requestJoin($student, $classroom->code, '10A1-01', '10A1');
        $service->approve($teacher, $request);

        try {
            $service->approve($teacher, $request);
            $this->fail('The same request was approved twice.');
        } catch (ValidationException $exception) {
            $this->assertNotEmpty($exception->errors());
        }

        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_manual_verification_records_reason_and_resolved_code(): void
    {
        [$teacher, $classroom] = $this->classroom('10A1', '10A1-01');
        $student = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);
        $request = $service->requestJoin($student, $classroom->code, 'WRONG', '10A2');
        $roster = $classroom->rosterEntries()->first();

        $membership = $service->manuallyVerifyAndApprove(
            $teacher, $request, $roster, 'wrong_student_code', 'Checked school ID.',
        );

        $this->assertSame('active', $membership->status);
        $this->assertSame('manual_verified', $request->fresh()->verification_status);
        $this->assertSame('WRONG', $request->fresh()->original_student_code);
        $this->assertSame('10A1-01', $request->fresh()->student_code);
        $this->assertSame($roster->id, $request->fresh()->manual_roster_entry_id);
        $this->assertSame('wrong_student_code', $request->fresh()->manual_verification_reason);
        $this->assertNotNull($request->fresh()->manually_verified_at);
    }

    public function test_manual_verification_conflict_rolls_back_without_claiming_roster(): void
    {
        [$teacher, $classroom] = $this->classroom('10A1', '10A1-01');
        $firstStudent = User::factory()->create()->refresh();
        $secondStudent = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);
        $firstRequest = $service->requestJoin($firstStudent, $classroom->code, '10A1-01', '10A1');
        $roster = $classroom->rosterEntries()->first();
        $secondRequest = $service->requestJoin($secondStudent, $classroom->code, 'WRONG', '10A1');
        $service->approve($teacher, $firstRequest);

        try {
            $service->manuallyVerifyAndApprove($teacher, $secondRequest, $roster, 'wrong_student_code', 'Checked.');
            $this->fail('A claimed roster entry was assigned to another student.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('roster', $exception->errors());
        }

        $this->assertSame('pending', $secondRequest->fresh()->status);
        $this->assertSame('WRONG', $secondRequest->fresh()->student_code);
        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_two_teachers_cannot_approve_one_student_into_two_classes(): void
    {
        [$firstTeacher, $firstClass] = $this->classroom('10A1', '10A1-01');
        [$secondTeacher, $secondClass] = $this->classroom('10A2', '10A2-01');
        $student = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);
        $firstRequest = $service->requestJoin($student, $firstClass->code, '10A1-01', '10A1');
        $secondRequest = $service->requestJoin($student, $secondClass->code, '10A2-01', '10A2');
        $service->approve($firstTeacher, $firstRequest);

        try {
            $service->approve($secondTeacher, $secondRequest);
            $this->fail('The student joined two active classes.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('student', $exception->errors());
        }

        $this->assertSame('pending', $secondRequest->fresh()->status);
        $this->assertDatabaseCount('class_memberships', 1);
    }

    public function test_leaving_then_joining_another_class_retains_history(): void
    {
        [$firstTeacher, $firstClass] = $this->classroom('10A1', '10A1-01');
        [$secondTeacher, $secondClass] = $this->classroom('10A2', '10A2-01');
        $student = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);
        $firstRequest = $service->requestJoin($student, $firstClass->code, '10A1-01', '10A1');
        $firstMembership = $service->approve($firstTeacher, $firstRequest);
        $service->leave($student, $firstMembership);

        $secondRequest = $service->requestJoin($student, $secondClass->code, '10A2-01', '10A2');
        $service->approve($secondTeacher, $secondRequest);

        $this->assertSame('left', $firstMembership->fresh()->status);
        $this->assertNotNull($firstMembership->fresh()->left_at);
        $this->assertNull($firstClass->rosterEntries()->first()->linked_user_id);
        $this->assertSame(2, $student->classMemberships()->count());
        $this->assertSame(1, $student->classMemberships()->where('status', 'active')->count());
    }

    public function test_approval_rolls_back_if_membership_insert_fails(): void
    {
        [$teacher, $classroom] = $this->classroom('10A1', '10A1-01');
        $student = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);
        $request = $service->requestJoin($student, $classroom->code, '10A1-01', '10A1');
        DB::unprepared("CREATE TRIGGER reject_membership BEFORE INSERT ON class_memberships BEGIN SELECT RAISE(ABORT, 'forced failure'); END");

        try {
            $service->approve($teacher, $request);
            $this->fail('Membership insertion unexpectedly succeeded.');
        } catch (QueryException) {
            $this->assertSame('pending', $request->fresh()->status);
            $this->assertNull($classroom->rosterEntries()->first()->linked_user_id);
            $this->assertDatabaseCount('class_memberships', 0);
        }
    }

    public function test_other_teacher_cannot_approve_or_reject_request(): void
    {
        [, $classroom] = $this->classroom('10A1', '10A1-01');
        $otherTeacher = $this->teacher();
        $student = User::factory()->create()->refresh();
        $service = app(ClassMembershipService::class);
        $request = $service->requestJoin($student, $classroom->code, '10A1-01', '10A1');

        foreach ([
            fn () => $service->approve($otherTeacher, $request),
            fn () => $service->reject($otherTeacher, $request),
        ] as $operation) {
            try {
                $operation();
                $this->fail('Another teacher reviewed this request.');
            } catch (AuthorizationException) {
                $this->assertTrue(true);
            }
        }

        $this->assertSame('pending', $request->fresh()->status);
    }

    private function classroom(string $name, string $studentCode): array
    {
        $teacher = $this->teacher();
        $classroom = app(ClassroomService::class)->create($teacher, [
            'name' => $name, 'academic_year' => '2026-2027',
        ]);
        app(ClassroomService::class)->importRoster($teacher, $classroom, [
            ['orderNumber' => 1, 'fullName' => 'Student Example', 'studentCode' => $studentCode],
        ]);

        return [$teacher, $classroom];
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([]);

        return $teacher->refresh();
    }
}
