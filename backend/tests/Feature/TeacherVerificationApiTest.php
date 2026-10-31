<?php

namespace Tests\Feature;

use App\Models\TeacherVerificationSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TeacherVerificationApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_teacher_submits_admin_rejects_and_teacher_resubmits_for_approval(): void
    {
        $teacher = $this->teacher();
        $admin = $this->userWithRole('admin');

        $firstSubmission = $this->actingAs($teacher)->post('/api/teacher/verification', $this->submission(), ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.status', 'pending');
        $firstSubmissionId = $firstSubmission->json('data.id');
        $this->post('/api/teacher/verification', $this->submission(), ['Accept' => 'application/json'])
            ->assertUnprocessable();
        $this->getJson('/api/teacher/verification')->assertOk()
            ->assertJsonPath('data.verification_status', 'pending')->assertJsonCount(1, 'data.submissions');
        $this->assertSame('pending', $teacher->teacherProfile->fresh()->verification_status);

        $this->actingAs($admin)->getJson('/api/admin/teacher-verifications')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/admin/teacher-verifications/{$firstSubmissionId}/reject", [])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->postJson("/api/admin/teacher-verifications/{$firstSubmissionId}/reject", ['reason' => 'Missing proof'])
            ->assertOk()->assertJsonPath('data.status', 'rejected');

        $secondSubmissionId = $this->actingAs($teacher)->post('/api/teacher/verification', $this->submission(), ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');
        $this->assertNotSame($firstSubmissionId, $secondSubmissionId);
        $this->actingAs($admin)->postJson("/api/admin/teacher-verifications/{$secondSubmissionId}/approve")
            ->assertOk()->assertJsonPath('data.status', 'verified');
        $this->getJson('/api/admin/teacher-verifications?status=all')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/teacher-verifications?status=invalid')->assertUnprocessable();
        $this->assertNotNull($teacher->teacherProfile->fresh()->verified_at);
        $this->actingAs($teacher)->getJson('/api/teacher/verification')->assertOk()
            ->assertJsonPath('data.verification_status', 'verified')->assertJsonCount(2, 'data.submissions');
        $this->assertDatabaseHas('teacher_verification_submissions', ['id' => $firstSubmissionId, 'status' => 'rejected', 'rejection_reason' => 'Missing proof']);
        $this->assertDatabaseHas('teacher_verification_submissions', ['id' => $secondSubmissionId, 'status' => 'verified', 'reviewed_by' => $admin->id]);
    }

    public function test_student_and_teacher_cannot_review_and_student_cannot_submit(): void
    {
        $teacher = $this->teacher();
        $otherTeacher = $this->teacher();
        $student = User::factory()->create()->refresh();
        $this->actingAs($teacher)->post('/api/teacher/verification', $this->submission(), ['Accept' => 'application/json'])->assertCreated();
        $submission = TeacherVerificationSubmission::query()->firstOrFail();

        $this->actingAs($student)->post('/api/teacher/verification', $this->submission(), ['Accept' => 'application/json'])->assertForbidden();
        $this->postJson("/api/admin/teacher-verifications/{$submission->id}/approve")->assertForbidden();
        $this->actingAs($otherTeacher)->postJson("/api/admin/teacher-verifications/{$submission->id}/reject", ['reason' => 'No'])
            ->assertForbidden();
        $this->getJson('/api/teacher/verification')->assertOk()->assertJsonCount(0, 'data.submissions');
        $this->assertDatabaseHas('teacher_verification_submissions', ['id' => $submission->id, 'status' => 'pending']);
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
        $this->post('/api/teacher/verification', $this->submission(), ['Accept' => 'application/json'])->assertCreated();
        $submission = TeacherVerificationSubmission::query()->firstOrFail();
        $this->actingAs($admin)->postJson("/api/admin/teacher-verifications/{$submission->id}/approve")->assertOk();
        $this->postJson("/api/admin/teacher-verifications/{$submission->id}/approve")->assertUnprocessable();
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
            'document' => UploadedFile::fake()->image('proof.png'),
        ];
    }
}
