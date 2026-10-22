<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_user_defaults_to_student(): void
    {
        $user = User::factory()->create();

        $this->assertSame('student', $user->fresh()->role);
    }

    public function test_teacher_profile_relationship(): void
    {
        $user = User::factory()->create();

        $user->forceFill(['role' => 'teacher'])->save();

        $profile = $user->teacherProfile()->create([]);

        $this->assertSame($user->id, $profile->user_id);
        $this->assertSame(
            'unverified',
            $profile->fresh()->verification_status
        );

        $this->assertTrue($profile->user->is($user));
        $this->assertTrue(
            $user->fresh()->teacherProfile->is($profile)
        );
    }
}
