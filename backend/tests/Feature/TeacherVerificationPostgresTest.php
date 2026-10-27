<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TeacherVerificationPostgresTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        if (! env('WEBSTUDY_PG_TEST')) {
            $this->markTestSkipped('Run with phpunit.pgsql.xml for PostgreSQL verification constraints.');
        }

        if (DB::getDriverName() !== 'pgsql'
            || DB::connection()->getDatabaseName() !== 'webstudy_test'
            || DB::selectOne('select current_database() as name')->name !== 'webstudy_test') {
            throw new \RuntimeException('Unsafe PostgreSQL test connection; expected pgsql:webstudy_test.');
        }
    }

    public function test_only_one_pending_submission_per_teacher(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23505');

        $teacher = $this->teacher();
        $teacher->teacherProfile->verificationSubmissions()->create($this->data());
        $teacher->teacherProfile->verificationSubmissions()->create($this->data());
    }

    public function test_rejected_submission_can_be_followed_by_another_pending_submission(): void
    {
        $teacher = $this->teacher();
        $admin = User::factory()->create();
        $admin->forceFill(['role' => 'admin'])->save();
        $first = $teacher->teacherProfile->verificationSubmissions()->create($this->data());
        $first->forceFill([
            'status' => 'rejected', 'reviewed_by' => $admin->id,
            'reviewed_at' => now(), 'rejection_reason' => 'Incomplete',
        ])->save();
        $teacher->teacherProfile->verificationSubmissions()->create($this->data());

        $this->assertSame(2, $teacher->teacherProfile->verificationSubmissions()->count());
    }

    public function test_reviewed_submission_requires_reviewer_and_timestamp(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23514');

        $teacher = $this->teacher();
        $submission = $teacher->teacherProfile->verificationSubmissions()->create($this->data());
        $submission->forceFill(['status' => 'verified'])->save();
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([]);

        return $teacher->refresh();
    }

    private function data(): array
    {
        return [
            'full_name' => 'Teacher', 'school_name' => 'School', 'school_address' => 'Address',
            'position' => 'Teacher', 'document_name' => 'proof.pdf',
            'document_type' => 'application/pdf', 'document_size' => 123,
        ];
    }
}
