<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ClassroomServicePostgresTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        if (! env('WEBSTUDY_PG_TEST')) {
            $this->markTestSkipped('Run with phpunit.pgsql.xml for PostgreSQL service checks.');
        }

        if (DB::getDriverName() !== 'pgsql'
            || DB::connection()->getDatabaseName() !== 'webstudy_test'
            || DB::selectOne('select current_database() as name')->name !== 'webstudy_test') {
            throw new \RuntimeException('Unsafe PostgreSQL test connection; expected pgsql:webstudy_test.');
        }
    }

    public function test_rejection_resubmission_approval_and_transfer_keep_history(): void
    {
        $teacher = $this->teacher();
        $classes = app(ClassroomService::class);
        $members = app(ClassMembershipService::class);
        $firstClass = $classes->create($teacher, ['name' => '10A1', 'academic_year' => '2026-2027']);
        $secondClass = $classes->create($teacher, ['name' => '10A2', 'academic_year' => '2026-2027']);
        $classes->importRoster($teacher, $firstClass, [
            ['orderNumber' => 1, 'fullName' => 'Student', 'studentCode' => '10A1-01'],
        ]);
        $classes->importRoster($teacher, $secondClass, [
            ['orderNumber' => 1, 'fullName' => 'Student', 'studentCode' => '10A2-01'],
        ]);
        $student = User::factory()->create()->refresh();

        $rejected = $members->requestJoin($student, $firstClass->code, '10A1-01', '10A1');
        $members->reject($teacher, $rejected);
        $accepted = $members->requestJoin($student, $firstClass->code, '10A1-01', '10A1');
        $firstMembership = $members->approve($teacher, $accepted);
        $members->leave($student, $firstMembership);
        $secondRequest = $members->requestJoin($student, $secondClass->code, '10A2-01', '10A2');
        $members->approve($teacher, $secondRequest);

        $this->assertSame('rejected', $rejected->fresh()->status);
        $this->assertSame('left', $firstMembership->fresh()->status);
        $this->assertNotNull($firstMembership->fresh()->left_at);
        $this->assertSame(2, $student->classMemberships()->count());
        $this->assertSame(1, $student->classMemberships()->where('status', 'active')->count());
    }

    public function test_competing_approvals_leave_only_one_active_membership(): void
    {
        $firstTeacher = $this->teacher();
        $secondTeacher = $this->teacher();
        $classes = app(ClassroomService::class);
        $members = app(ClassMembershipService::class);
        $firstClass = $classes->create($firstTeacher, ['name' => '10A1', 'academic_year' => '2026-2027']);
        $secondClass = $classes->create($secondTeacher, ['name' => '10A2', 'academic_year' => '2026-2027']);
        $classes->importRoster($firstTeacher, $firstClass, [
            ['orderNumber' => 1, 'fullName' => 'Student', 'studentCode' => '10A1-01'],
        ]);
        $classes->importRoster($secondTeacher, $secondClass, [
            ['orderNumber' => 1, 'fullName' => 'Student', 'studentCode' => '10A2-01'],
        ]);
        $student = User::factory()->create()->refresh();
        $firstRequest = $members->requestJoin($student, $firstClass->code, '10A1-01', '10A1');
        $secondRequest = $members->requestJoin($student, $secondClass->code, '10A2-01', '10A2');
        $members->approve($firstTeacher, $firstRequest);

        try {
            $members->approve($secondTeacher, $secondRequest);
            $this->fail('A second active membership was accepted.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('student', $exception->errors());
        }

        $this->assertSame('pending', $secondRequest->fresh()->status);
        $this->assertSame(1, $student->classMemberships()->where('status', 'active')->count());
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([]);

        return $teacher->refresh();
    }
}
