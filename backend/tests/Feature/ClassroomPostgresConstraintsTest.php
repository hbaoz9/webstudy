<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ClassroomPostgresConstraintsTest extends TestCase
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

        if (! Schema::hasTable('classrooms')) {
            throw new \RuntimeException('PostgreSQL test schema is missing; run the guarded test migration.');
        }
    }

    public function test_class_code_is_case_insensitively_unique(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23505');

        DB::transaction(function (): void {
            $teacher = User::factory()->create();
            $teacher->forceFill(['role' => 'teacher'])->save();
            $profile = $teacher->teacherProfile()->create([]);
            $profile->classrooms()->create([
                'name' => '10A1', 'academic_year' => '2026-2027', 'code' => 'ABC123',
            ]);
            $profile->classrooms()->create([
                'name' => '10A2', 'academic_year' => '2026-2027', 'code' => 'abc123',
            ]);
        });
    }

    public function test_teacher_class_name_is_unique_after_trimming_and_case_folding(): void
    {
        $this->expectException(QueryException::class);
        $this->expectExceptionCode('23505');

        DB::transaction(function (): void {
            $teacher = User::factory()->create();
            $teacher->forceFill(['role' => 'teacher'])->save();
            $profile = $teacher->teacherProfile()->create([]);
            $profile->classrooms()->create([
                'name' => '10A1', 'academic_year' => '2026-2027', 'code' => 'ABC123',
            ]);
            $profile->classrooms()->create([
                'name' => ' 10a1 ', 'academic_year' => '2026-2027', 'code' => 'DEF456',
            ]);
        });
    }
}
