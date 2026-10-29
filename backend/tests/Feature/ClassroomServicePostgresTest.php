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

    public function test_roster_search_uses_unaccent_without_changing_roster_or_memberships(): void
    {
        $this->assertSame(1, (int) DB::selectOne(
            "SELECT CASE WHEN to_regprocedure('unaccent(text)') IS NULL THEN 0 ELSE 1 END AS available"
        )->available);

        $teacher = $this->teacher();
        $teacher->teacherProfile->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        $classes = app(ClassroomService::class);
        $classroom = $classes->create($teacher, ['name' => 'Roster search', 'academic_year' => '2026-2027']);
        $otherTeacher = $this->teacher();
        $otherClassroom = $classes->create($otherTeacher, ['name' => 'Other roster', 'academic_year' => '2026-2027']);
        $names = ['Nguyễn Văn An', 'Trần Thị Bình', 'Đặng Minh Đức', 'Đỗ Thị Hà', 'Lê Hoàng Phúc', 'Hồ Chí Minh'];
        for ($number = 1; $number <= 150; $number++) {
            $classroom->rosterEntries()->create([
                'order_number' => $number,
                'full_name' => $names[$number - 1] ?? "Student $number",
                'student_code' => sprintf('HS%04d', $number),
            ]);
        }
        $classroom->rosterEntries()->where('student_code', 'HS0003')->firstOrFail()
            ->forceFill(['status' => 'conflict'])->save();
        $classroom->rosterEntries()->create([
            'order_number' => 151, 'full_name' => 'Percent %! Name', 'student_code' => 'PCT-1',
        ]);
        $classroom->rosterEntries()->create([
            'order_number' => 152, 'full_name' => 'Under_score Name', 'student_code' => 'UND-2',
        ]);
        $otherClassroom->rosterEntries()->create([
            'order_number' => 1, 'full_name' => 'Nguyễn Hidden', 'student_code' => 'OTHER-1',
        ]);

        $url = "/api/teacher/classrooms/{$classroom->id}/roster";
        $this->actingAs($teacher)->getJson($url)
            ->assertOk()->assertJsonCount(100, 'data')->assertJsonPath('meta.total', 152)
            ->assertJsonPath('meta.last_page', 2);
        foreach (['Nguyen' => 'HS0001', 'TRAN' => 'HS0002', 'Dang' => 'HS0003', 'Do' => 'HS0004'] as $search => $code) {
            $this->getJson($url.'?search='.$search)
                ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.studentCode', $code)
                ->assertJsonPath('meta.total', 1);
        }
        $this->getJson($url.'?search=thi%20b')->assertOk()->assertJsonPath('data.0.studentCode', 'HS0002');
        $this->getJson($url.'?search=hs0150')->assertOk()->assertJsonPath('data.0.studentCode', 'HS0150')
            ->assertJsonPath('meta.total', 1);
        $this->getJson($url.'?search=DANG&status=conflict')->assertOk()
            ->assertJsonPath('data.0.studentCode', 'HS0003')->assertJsonPath('meta.total', 1);
        $this->getJson($url.'?search=Dang&status=not_joined')->assertOk()
            ->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 0);
        $this->getJson($url.'?search=%25')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.studentCode', 'PCT-1');
        $this->getJson($url.'?search=%21')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.studentCode', 'PCT-1');
        $this->getJson($url.'?search=_')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.studentCode', 'UND-2');
        $this->getJson($url.'?search=hidden')->assertOk()->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.total', 0);
        $this->actingAs($otherTeacher)->getJson($url.'?search=Nguyen')->assertForbidden();
        $this->assertSame(152, $classroom->rosterEntries()->count());
        $this->assertSame(0, $classroom->memberships()->count());
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([]);

        return $teacher->refresh();
    }
}
