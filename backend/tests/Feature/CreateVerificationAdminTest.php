<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateVerificationAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_refuses_to_promote_an_existing_user(): void
    {
        $student = User::factory()->create(['email' => 'existing@example.test']);

        $this->artisan('webstudy:admin:create', [
            '--email' => 'existing@example.test', '--name' => 'Existing User',
        ])->assertExitCode(1);

        $this->assertSame('student', $student->fresh()->role);
        $this->assertDatabaseCount('users', 1);
    }
}
