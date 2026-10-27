<?php

namespace Tests\Feature;

use App\Models\ClassJoinRequest;
use App\Models\Classroom;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ClassroomMembershipPostgresConstraintsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (! env('WEBSTUDY_PG_TEST')) {
            $this->markTestSkipped('Run with phpunit.pgsql.xml for PostgreSQL constraints.');
        }

        if (DB::getDriverName() !== 'pgsql'
            || DB::connection()->getDatabaseName() !== 'webstudy_test'
            || DB::selectOne('select current_database() as name')->name !== 'webstudy_test') {
            throw new \RuntimeException('Unsafe PostgreSQL test connection; expected pgsql:webstudy_test.');
        }

        if (! Schema::hasTable('class_memberships')) {
            throw new \RuntimeException('PostgreSQL test schema is missing; run the guarded test migration.');
        }
    }

    public function test_roster_codes_are_unique_after_normalization(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23505');

        DB::transaction(function (): void {
            $classroom = $this->createClassroom('10A1', 'ABC123');
            $classroom->rosterEntries()->create([
                'order_number' => 1, 'full_name' => 'Student One', 'student_code' => '10 A1-01',
            ]);
            $classroom->rosterEntries()->create([
                'order_number' => 2, 'full_name' => 'Student Two', 'student_code' => '10a1-01',
            ]);
        });
    }

    public function test_pending_requests_cannot_claim_the_same_normalized_code(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23505');

        DB::transaction(function (): void {
            $classroom = $this->createClassroom('10A1', 'ABC123');
            $this->createRequest($classroom, User::factory()->create(), '10 A1-01');
            $this->createRequest($classroom, User::factory()->create(), '10a1-01');
        });
    }

    public function test_rejected_request_can_be_resubmitted_but_two_pending_requests_cannot_exist(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23505');

        DB::transaction(function (): void {
            $classroom = $this->createClassroom('10A1', 'ABC123');
            $student = User::factory()->create();
            $rejected = $this->createRequest($classroom, $student, '10A1-01');
            $rejected->forceFill(['status' => 'rejected'])->save();

            $this->createRequest($classroom, $student, '10A1-01');
            $this->assertSame(2, $student->classJoinRequests()->count());

            $this->createRequest($classroom, $student, '10A1-02');
        });
    }

    public function test_membership_request_must_belong_to_the_same_classroom_and_student(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23503');

        DB::transaction(function (): void {
            $student = User::factory()->create();
            $firstClass = $this->createClassroom('10A1', 'ABC123');
            $secondClass = $this->createClassroom('10A2', 'DEF456');
            $request = $this->createRequest($firstClass, $student, '10A1-01');
            $roster = $secondClass->rosterEntries()->create([
                'order_number' => 1, 'full_name' => $student->name, 'student_code' => '10A2-01',
            ]);
            $membership = $secondClass->memberships()->make([
                'roster_entry_id' => $roster->id,
                'join_request_id' => $request->id,
                'joined_at' => now(),
            ]);
            $membership->student()->associate($student);
            $membership->save();
        });
    }

    public function test_membership_roster_must_belong_to_the_same_classroom(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23503');

        DB::transaction(function (): void {
            $student = User::factory()->create();
            $firstClass = $this->createClassroom('10A1', 'ABC123');
            $secondClass = $this->createClassroom('10A2', 'DEF456');
            $roster = $firstClass->rosterEntries()->create([
                'order_number' => 1, 'full_name' => $student->name, 'student_code' => '10A1-01',
            ]);
            $request = $this->createRequest($secondClass, $student, '10A2-01');
            $membership = $secondClass->memberships()->make([
                'roster_entry_id' => $roster->id,
                'join_request_id' => $request->id,
                'joined_at' => now(),
            ]);
            $membership->student()->associate($student);
            $membership->save();
        });
    }

    public function test_membership_request_must_belong_to_the_same_student(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23503');

        DB::transaction(function (): void {
            $classroom = $this->createClassroom('10A1', 'ABC123');
            $requestStudent = User::factory()->create();
            $otherStudent = User::factory()->create();
            $request = $this->createRequest($classroom, $requestStudent, '10A1-01');
            $roster = $classroom->rosterEntries()->create([
                'order_number' => 1, 'full_name' => $otherStudent->name, 'student_code' => '10A1-02',
            ]);
            $membership = $classroom->memberships()->make([
                'roster_entry_id' => $roster->id,
                'join_request_id' => $request->id,
                'joined_at' => now(),
            ]);
            $membership->student()->associate($otherStudent);
            $membership->save();
        });
    }

    public function test_joined_roster_entry_requires_a_linked_user(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23514');

        DB::transaction(function (): void {
            $classroom = $this->createClassroom('10A1', 'ABC123');
            $roster = $classroom->rosterEntries()->create([
                'order_number' => 1, 'full_name' => 'Student Example', 'student_code' => '10A1-01',
            ]);
            $roster->forceFill(['status' => 'joined'])->save();
        });
    }

    public function test_membership_cannot_be_marked_left_without_a_departure_time(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23514');

        DB::transaction(function (): void {
            $student = User::factory()->create();
            $classroom = $this->createClassroom('10A1', 'ABC123');
            $roster = $classroom->rosterEntries()->create([
                'order_number' => 1, 'full_name' => $student->name, 'student_code' => '10A1-01',
            ]);
            $request = $this->createRequest($classroom, $student, '10A1-01');
            $membership = $classroom->memberships()->make([
                'roster_entry_id' => $roster->id,
                'join_request_id' => $request->id,
                'joined_at' => now(),
            ]);
            $membership->student()->associate($student);
            $membership->save();
            $membership->forceFill(['status' => 'left'])->save();
        });
    }

    public function test_manual_verification_requires_audit_data(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23514');

        DB::transaction(function (): void {
            $classroom = $this->createClassroom('10A1', 'ABC123');
            $request = $this->createRequest($classroom, User::factory()->create(), '10A1-01');
            $request->forceFill(['verification_status' => 'manual_verified'])->save();
        });
    }

    public function test_partial_unique_index_allows_history_but_only_one_active_membership(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23505');

        DB::transaction(function (): void {
            $student = User::factory()->create();
            $firstClass = $this->createClassroom('10A1', 'ABC123');
            $secondClass = $this->createClassroom('10A2', 'DEF456');
            $firstRoster = $firstClass->rosterEntries()->create([
                'order_number' => 1, 'full_name' => $student->name, 'student_code' => '10A1-01',
            ]);
            $firstRequest = $this->createRequest($firstClass, $student, '10A1-01');
            $firstMembership = $firstClass->memberships()->make([
                'roster_entry_id' => $firstRoster->id,
                'join_request_id' => $firstRequest->id,
                'joined_at' => now(),
            ]);
            $firstMembership->student()->associate($student);
            $firstMembership->save();
            $firstMembership->forceFill(['status' => 'left', 'left_at' => now()])->save();

            $secondRoster = $secondClass->rosterEntries()->create([
                'order_number' => 1, 'full_name' => $student->name, 'student_code' => '10A2-01',
            ]);
            $secondRequest = $this->createRequest($secondClass, $student, '10A2-01');
            $secondMembership = $secondClass->memberships()->make([
                'roster_entry_id' => $secondRoster->id,
                'join_request_id' => $secondRequest->id,
                'joined_at' => now(),
            ]);
            $secondMembership->student()->associate($student);
            $secondMembership->save();

            $this->assertSame(2, $student->classMemberships()->count());
            $this->assertSame(1, $student->classMemberships()->where('status', 'active')->count());

            $roster = $firstClass->rosterEntries()->create([
                'order_number' => 2, 'full_name' => $student->name, 'student_code' => '10A1-02',
            ]);
            $request = $this->createRequest($firstClass, $student, '10A1-02');
            $membership = $firstClass->memberships()->make([
                'roster_entry_id' => $roster->id,
                'join_request_id' => $request->id,
                'joined_at' => now(),
            ]);
            $membership->student()->associate($student);
            $membership->save();
        });
    }

    private function createClassroom(string $name, string $code): Classroom
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();

        return $teacher->teacherProfile()->create([])->classrooms()->create([
            'name' => $name, 'academic_year' => '2026-2027', 'code' => $code,
        ]);
    }

    private function createRequest(Classroom $classroom, User $student, string $code): ClassJoinRequest
    {
        $request = $classroom->joinRequests()->make([
            'student_name' => $student->name,
            'email' => $student->email,
            'student_code' => $code,
            'declared_class' => $classroom->name,
        ]);
        $request->student()->associate($student);
        $request->save();

        return $request;
    }
}
