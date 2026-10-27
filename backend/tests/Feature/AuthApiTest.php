<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        config()->set('sanctum.stateful', ['localhost:5173']);
    }

    public function test_teacher_registration_creates_profile_and_session_then_logout_invalidates_it(): void
    {
        $this->withHeader('Origin', 'http://localhost:5173');
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Teacher One', 'email' => 'TEACHER@example.com',
            'password' => 'password123', 'password_confirmation' => 'password123', 'role' => 'teacher',
        ]);

        $response->assertCreated()->assertJsonPath('data.role', 'teacher')
            ->assertJsonPath('data.teacher_verification_status', 'unverified');
        $this->assertDatabaseHas('users', ['email' => 'teacher@example.com', 'role' => 'teacher']);
        $this->assertDatabaseCount('teacher_profiles', 1);
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.email', 'teacher@example.com');
        $this->postJson('/api/auth/logout')->assertOk();
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_login_rejects_wrong_password_and_authenticates_valid_credentials(): void
    {
        User::factory()->create(['email' => 'student@example.com', 'password' => 'password123']);
        $this->withHeader('Origin', 'http://localhost:5173');

        $this->postJson('/api/auth/login', ['email' => 'student@example.com', 'password' => 'incorrect'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson('/api/auth/login', ['email' => 'STUDENT@example.com', 'password' => 'password123'])
            ->assertOk()->assertJsonPath('data.role', 'student');
        $this->getJson('/api/auth/me')->assertOk();
    }

    public function test_registration_rejects_duplicate_email_and_role_spoofing(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);
        $this->withHeader('Origin', 'http://localhost:5173');
        $base = ['name' => 'Someone', 'email' => 'taken@example.com', 'password' => 'password123', 'password_confirmation' => 'password123'];

        $this->postJson('/api/auth/register', $base)->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson('/api/auth/register', [...$base, 'email' => 'new@example.com', 'role' => 'admin'])
            ->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->assertDatabaseMissing('users', ['email' => 'new@example.com']);
    }

    public function test_registration_validation_and_unauthenticated_access(): void
    {
        $this->withHeader('Origin', 'http://localhost:5173');
        $this->postJson('/api/auth/register', ['name' => '', 'email' => 'invalid', 'password' => 'short'])
            ->assertUnprocessable()->assertJsonValidationErrors(['name', 'email', 'password']);
        $this->getJson('/api/auth/me')->assertUnauthorized();
        $this->postJson('/api/auth/logout')->assertUnauthorized();
        $this->getJson('/api/teacher/verification')->assertUnauthorized();
    }

    public function test_login_is_rate_limited(): void
    {
        $this->withHeader('Origin', 'http://localhost:5173');

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/auth/login', ['email' => 'guess@example.com', 'password' => 'wrong'])
                ->assertUnprocessable();
        }

        $this->postJson('/api/auth/login', ['email' => 'guess@example.com', 'password' => 'wrong'])
            ->assertStatus(429);
    }

    public function test_cors_allows_only_configured_spa_origin_with_credentials(): void
    {
        $this->withHeader('Origin', 'http://localhost:5173')->getJson('/api/health')
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_sanctum_csrf_cookie_endpoint_is_available_to_spa(): void
    {
        $this->withHeader('Origin', 'http://localhost:5173')->get('/sanctum/csrf-cookie')
            ->assertNoContent()->assertCookie('XSRF-TOKEN');
    }

    public function test_registration_requires_a_stateful_spa_request_before_writing_user(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Student', 'email' => 'new@example.com',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'new@example.com']);
    }
}
