<?php

namespace Tests\Feature;

use App\Models\TeacherVerificationSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class TeacherVerificationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_submits_admin_rejects_and_teacher_resubmits_for_approval(): void
    {
        $teacher = $this->teacher();
        $admin = $this->userWithRole('admin');

        $this->actingAs($teacher)->postJson('/api/teacher/verification', $this->submission())
            ->assertCreated()->assertJsonPath('data.status', 'pending');
        $this->postJson('/api/teacher/verification', $this->submission())
            ->assertUnprocessable();
        $this->getJson('/api/teacher/verification')->assertOk()
            ->assertJsonPath('data.verification_status', 'pending')->assertJsonCount(1, 'data.submissions');
        $this->assertSame('pending', $teacher->teacherProfile->fresh()->verification_status);

        $this->actingAs($admin)->getJson('/api/admin/teacher-verifications')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/admin/teacher-verifications/1/reject', [])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->postJson('/api/admin/teacher-verifications/1/reject', ['reason' => 'Missing proof'])
            ->assertOk()->assertJsonPath('data.status', 'rejected');

        $this->actingAs($teacher)->postJson('/api/teacher/verification', $this->submission())
            ->assertCreated()->assertJsonPath('data.id', 2);
        $this->actingAs($admin)->postJson('/api/admin/teacher-verifications/2/approve')
            ->assertOk()->assertJsonPath('data.status', 'verified');
        $this->getJson('/api/admin/teacher-verifications?status=all')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/teacher-verifications?status=invalid')->assertUnprocessable();
        $this->assertNotNull($teacher->teacherProfile->fresh()->verified_at);
        $this->actingAs($teacher)->getJson('/api/teacher/verification')->assertOk()
            ->assertJsonPath('data.verification_status', 'verified')->assertJsonCount(2, 'data.submissions');
        $this->assertDatabaseHas('teacher_verification_submissions', ['id' => 1, 'status' => 'rejected', 'rejection_reason' => 'Missing proof']);
        $this->assertDatabaseHas('teacher_verification_submissions', ['id' => 2, 'status' => 'verified', 'reviewed_by' => $admin->id]);
    }

    public function test_student_and_teacher_cannot_review_and_student_cannot_submit(): void
    {
        $teacher = $this->teacher();
        $otherTeacher = $this->teacher();
        $student = User::factory()->create()->refresh();
        $this->actingAs($teacher)->postJson('/api/teacher/verification', $this->submission())->assertCreated();

        $this->actingAs($student)->postJson('/api/teacher/verification', $this->submission())->assertForbidden();
        $this->postJson('/api/admin/teacher-verifications/1/approve')->assertForbidden();
        $this->actingAs($otherTeacher)->postJson('/api/admin/teacher-verifications/1/reject', ['reason' => 'No'])
            ->assertForbidden();
        $this->getJson('/api/teacher/verification')->assertOk()->assertJsonCount(0, 'data.submissions');
        $this->assertDatabaseHas('teacher_verification_submissions', ['id' => 1, 'status' => 'pending']);
        $submission = TeacherVerificationSubmission::query()->firstOrFail();
        $this->assertFalse(Gate::forUser($student)->allows('review', $submission));
        $this->assertTrue(Gate::forUser($teacher)->allows('view', $submission));
        $this->assertFalse(Gate::forUser($otherTeacher)->allows('view', $submission));
    }

    public function test_review_cannot_be_replayed_and_submission_is_validated(): void
    {
        $teacher = $this->teacher();
        $admin = $this->userWithRole('admin');
        $this->actingAs($teacher)->postJson('/api/teacher/verification', ['full_name' => ''])
            ->assertUnprocessable()->assertJsonValidationErrors(['full_name', 'school_name', 'document']);
        $this->postJson('/api/teacher/verification', $this->submission())->assertCreated();
        $this->actingAs($admin)->postJson('/api/admin/teacher-verifications/1/approve')->assertOk();
        $this->postJson('/api/admin/teacher-verifications/1/approve')->assertUnprocessable();
        $this->assertDatabaseCount('teacher_verification_submissions', 1);
    }

    public function test_verified_teacher_middleware_denies_unverified_teacher_and_student(): void
    {
        Route::middleware(['api', 'auth:sanctum', 'teacher.verified'])
            ->get('/api/test-verified-teacher', fn () => response()->json(['ok' => true]));
        $teacher = $this->teacher();
        $student = User::factory()->create()->refresh();

        $this->actingAs($teacher)->getJson('/api/test-verified-teacher')->assertForbidden();
        $this->actingAs($student)->getJson('/api/test-verified-teacher')->assertForbidden();
        $teacher->teacherProfile->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        $this->actingAs($teacher)->getJson('/api/test-verified-teacher')->assertOk();
    }

    private function teacher(): User
    {
        $teacher = $this->userWithRole('teacher');
        $teacher->teacherProfile()->create([]);

        return $teacher->refresh();
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->forceFill(['role' => $role])->save();

        return $user->refresh();
    }

    private function submission(): array
    {
        return [
            'full_name' => 'Teacher One', 'school_name' => 'School A',
            'school_address' => '123 Main Street', 'teacher_code' => 'T-001',
            'position' => 'Teacher',
            'document' => ['name' => 'proof.pdf', 'type' => 'application/pdf', 'size' => 12345],
        ];
    }
}
