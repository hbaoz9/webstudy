<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SanctumDevOriginTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_vite_origin_is_stateful_without_an_env_override(): void
    {
        $this->assertContains('localhost:5173', config('sanctum.stateful'));

        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/auth/register', [
                'name' => 'Student',
                'email' => 'vite-origin@example.com',
                'password' => 'password123',
                'password_confirmation' => 'password123',
                'role' => 'student',
            ])
            ->assertCreated()
            ->assertJsonPath('data.role', 'student');

        $this->getJson('/api/auth/me')->assertOk();
    }
}
