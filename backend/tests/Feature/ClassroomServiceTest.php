<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ClassroomServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_create_update_and_archive_owned_class(): void
    {
        $teacher = $this->teacher();
        $service = app(ClassroomService::class);
        $classroom = $service->create($teacher, [
            'name' => ' Lớp 10 A1 ', 'academic_year' => '2026-2027', 'description' => 'Geography',
        ]);

        $this->assertSame('10 A1', $classroom->name);
        $this->assertSame(6, strlen($classroom->code));
        $this->assertSame($teacher->id, $classroom->teacher_id);

        $updated = $service->update($teacher, $classroom, [
            'name' => '10A2', 'academic_year' => '2026-2027', 'description' => 'Updated',
        ]);
        $this->assertSame('10A2', $updated->name);
        $this->assertSame($classroom->code, $updated->code);
        $this->assertSame('archived', $service->archive($teacher, $classroom)->status);
    }

    public function test_duplicate_name_and_code_are_rejected(): void
    {
        $teacher = $this->teacher();
        $service = app(ClassroomService::class);
        $service->create($teacher, ['name' => '10 A1', 'academic_year' => '2026-2027']);

        try {
            $service->create($teacher, ['name' => 'Lớp 10A1', 'academic_year' => '2026-2027']);
            $this->fail('Duplicate class name was accepted.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('name', $exception->errors());
        }

        $fixedCodeService = new class extends ClassroomService
        {
            protected function generateCode(): string
            {
                return 'FIXED2';
            }
        };
        $fixedCodeService->create($teacher, ['name' => '10A2', 'academic_year' => '2026-2027']);

        try {
            $fixedCodeService->create($this->teacher(), ['name' => '10A3', 'academic_year' => '2026-2027']);
            $this->fail('Duplicate class code was accepted.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('code', $exception->errors());
        }
    }

    public function test_regenerate_code_retries_old_and_deleted_class_codes_with_a_bound(): void
    {
        $teacher = $this->teacher();
        $fixedCodeService = new class extends ClassroomService
        {
            public string $nextCode = 'ABC234';

            protected function generateCode(): string
            {
                return $this->nextCode;
            }
        };
        $deleted = $fixedCodeService->create($teacher, ['name' => 'Old class', 'academic_year' => '2026-2027']);
        $fixedCodeService->nextCode = 'DEF567';
        $target = $fixedCodeService->create($teacher, ['name' => 'Current class', 'academic_year' => '2026-2027']);
        $fixedCodeService->archive($teacher, $deleted);
        $fixedCodeService->deleteArchived($teacher, $deleted);

        $retryService = new class extends ClassroomService
        {
            public int $calls = 0;

            protected function generateCode(): string
            {
                return ['DEF567', 'ABC234', 'GHJ567'][$this->calls++];
            }
        };
        $updated = $retryService->regenerateCode($teacher, $target);
        $this->assertSame('GHJ567', $updated->code);
        $this->assertSame(3, $retryService->calls);
        $this->assertSame('ABC234', \App\Models\Classroom::withTrashed()->findOrFail($deleted->id)->code);

        $exhausted = new class extends ClassroomService
        {
            public int $calls = 0;

            protected function generateCode(): string
            {
                $this->calls++;
                return 'ABC234';
            }
        };
        try {
            $exhausted->regenerateCode($teacher, $target);
            $this->fail('Regeneration accepted a code reserved by a deleted classroom.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('code', $exception->errors());
        }
        $this->assertSame(8, $exhausted->calls);
        $this->assertSame('GHJ567', $target->fresh()->code);
    }

    public function test_roster_import_normalizes_codes_and_rolls_back_duplicate_rows(): void
    {
        $teacher = $this->teacher();
        $service = app(ClassroomService::class);
        $classroom = $service->create($teacher, ['name' => '10A1', 'academic_year' => '2026-2027']);
        $result = $service->importRoster($teacher, $classroom, [
            ['orderNumber' => 1, 'fullName' => 'First Student', 'studentCode' => ' 10 a1-01 '],
        ]);

        $this->assertSame(['created' => 1, 'updated' => 0], $result);
        $this->assertSame('10A1-01', $classroom->rosterEntries()->first()->student_code);

        try {
            $service->importRoster($teacher, $classroom, [
                ['orderNumber' => 1, 'fullName' => 'Changed', 'studentCode' => '10A1-01'],
                ['orderNumber' => 2, 'fullName' => 'Duplicate', 'studentCode' => '10 a1-01'],
            ]);
            $this->fail('Duplicate roster code was accepted.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('rows.1.studentCode', $exception->errors());
        }

        $this->assertDatabaseCount('class_roster_entries', 1);
        $this->assertSame('First Student', $classroom->rosterEntries()->first()->full_name);
    }

    public function test_other_teacher_cannot_manage_class_or_roster(): void
    {
        $owner = $this->teacher();
        $intruder = $this->teacher();
        $service = app(ClassroomService::class);
        $classroom = $service->create($owner, ['name' => '10A1', 'academic_year' => '2026-2027']);

        foreach ([
            fn () => $service->update($intruder, $classroom, ['name' => '10A2', 'academic_year' => '2026-2027']),
            fn () => $service->archive($intruder, $classroom),
            fn () => $service->importRoster($intruder, $classroom, [
                ['orderNumber' => 1, 'fullName' => 'Student', 'studentCode' => '10A1-01'],
            ]),
        ] as $operation) {
            try {
                $operation();
                $this->fail('A different teacher changed this classroom.');
            } catch (AuthorizationException) {
                $this->assertTrue(true);
            }
        }

        $this->assertSame('10A1', $classroom->fresh()->name);
        $this->assertSame('active', $classroom->fresh()->status);
        $this->assertDatabaseCount('class_roster_entries', 0);
    }

    public function test_import_reconciles_pending_request_and_preserves_joined_roster_history(): void
    {
        $teacher = $this->teacher();
        $classes = app(ClassroomService::class);
        $members = app(ClassMembershipService::class);
        $classroom = $classes->create($teacher, ['name' => '10A1', 'academic_year' => '2026-2027']);
        $student = User::factory()->create()->refresh();
        $request = $members->requestJoin($student, $classroom->code, '10a1-01', '10A1');
        $this->assertSame('unverified', $request->verification_status);

        $classes->importRoster($teacher, $classroom, [
            ['orderNumber' => 1, 'fullName' => 'Student Example', 'studentCode' => '10 A1-01'],
        ]);
        $this->assertSame('matched', $request->fresh()->verification_status);
        $membership = $members->approve($teacher, $request);
        $rosterId = $membership->roster_entry_id;

        $classes->importRoster($teacher, $classroom, [
            ['orderNumber' => 1, 'fullName' => 'Corrected Name', 'studentCode' => '10A1-01'],
        ]);
        $this->assertSame($rosterId, $classroom->rosterEntries()->first()->id);
        $this->assertSame($student->id, $classroom->rosterEntries()->first()->linked_user_id);
        $this->assertSame('Corrected Name', $classroom->rosterEntries()->first()->full_name);

        try {
            $classes->removeRosterEntry($teacher, $classroom->rosterEntries()->first());
            $this->fail('An entry with membership history was removed.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('roster', $exception->errors());
        }
    }

    public function test_archive_closes_memberships_and_requests_without_losing_history(): void
    {
        $teacher = $this->teacher();
        $classes = app(ClassroomService::class);
        $members = app(ClassMembershipService::class);
        $classroom = $classes->create($teacher, ['name' => '10A1', 'academic_year' => '2026-2027']);
        $classes->importRoster($teacher, $classroom, [
            ['orderNumber' => 1, 'fullName' => 'Student One', 'studentCode' => '10A1-01'],
        ]);
        $joinedStudent = User::factory()->create()->refresh();
        $waitingStudent = User::factory()->create()->refresh();
        $approvedRequest = $members->requestJoin($joinedStudent, $classroom->code, '10A1-01', '10A1');
        $membership = $members->approve($teacher, $approvedRequest);
        $waitingRequest = $members->requestJoin($waitingStudent, $classroom->code, 'OTHER', '10A1');

        $classes->archive($teacher, $classroom);

        $this->assertSame('left', $membership->fresh()->status);
        $this->assertNotNull($membership->fresh()->left_at);
        $this->assertSame('rejected', $waitingRequest->fresh()->status);
        $this->assertNull($classroom->rosterEntries()->first()->linked_user_id);
        $this->assertDatabaseCount('class_memberships', 1);
        $this->assertSame('archived', $classroom->fresh()->status);
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([]);

        return $teacher->refresh();
    }
}
