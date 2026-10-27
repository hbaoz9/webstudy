<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClassroomDatabaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_classroom_belongs_to_teacher_profile(): void
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $profile = $teacher->teacherProfile()->create([]);

        $classroom = $profile->classrooms()->create([
            'name' => '10A1',
            'academic_year' => '2026-2027',
            'code' => 'ABC123',
        ]);

        $this->assertSame('active', $classroom->fresh()->status);
        $this->assertTrue($classroom->teacher->is($profile));
        $this->assertTrue($profile->classrooms->first()->is($classroom));
        $this->assertDatabaseCount('classrooms', 1);
    }

    public function test_class_code_is_unique(): void
    {
        $profile = User::factory()->create()->teacherProfile()->create([]);
        $profile->classrooms()->create([
            'name' => '10A1', 'academic_year' => '2026-2027', 'code' => 'ABC123',
        ]);

        $this->expectException(QueryException::class);
        $profile->classrooms()->create([
            'name' => '10A2', 'academic_year' => '2026-2027', 'code' => 'ABC123',
        ]);
    }

    public function test_teacher_cannot_repeat_class_name_in_same_year(): void
    {
        $profile = User::factory()->create()->teacherProfile()->create([]);
        $profile->classrooms()->create([
            'name' => '10A1', 'academic_year' => '2026-2027', 'code' => 'ABC123',
        ]);

        $this->expectException(QueryException::class);
        $profile->classrooms()->create([
            'name' => '10A1', 'academic_year' => '2026-2027', 'code' => 'DEF456',
        ]);
    }
}
