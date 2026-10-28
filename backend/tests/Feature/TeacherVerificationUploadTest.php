<?php

namespace Tests\Feature;

use App\Models\TeacherVerificationSubmission;
use App\Models\User;
use App\Services\TeacherVerificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class TeacherVerificationUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_valid_file_is_private_and_authorized_users_can_view_it(): void
    {
        $teacher = $this->teacher();
        $otherTeacher = $this->teacher();
        $student = User::factory()->create();
        $admin = $this->admin();

        $response = $this->actingAs($teacher)->post('/api/teacher/verification', $this->payload(), ['Accept' => 'application/json']);
        $response->assertCreated()->assertJsonPath('data.document.available', true)
            ->assertDontSee('document_path');
        $submission = TeacherVerificationSubmission::query()->firstOrFail();
        $this->assertStringStartsWith('teacher-verifications/', $submission->document_path);
        Storage::disk('local')->assertExists($submission->document_path);
        $this->assertFalse(Storage::disk('public')->exists($submission->document_path));

        $path = "/api/teacher-verifications/{$submission->id}/document";
        $this->get($path)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->actingAs($otherTeacher)->get($path)->assertForbidden();
        $this->actingAs($student)->get($path)->assertForbidden();
        $this->actingAs($admin)->get($path)->assertOk();
        $this->getJson('/api/admin/teacher-verifications')->assertOk()
            ->assertJsonPath('data.0.teacher_email', $teacher->email)
            ->assertDontSee($submission->document_path);
    }

    public function test_unauthenticated_document_request_without_json_accept_returns_json_401(): void
    {
        $teacher = $this->teacher();
        $submissionId = $this->actingAs($teacher)
            ->post('/api/teacher/verification', $this->payload(), ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();
        $this->get("/api/teacher-verifications/{$submissionId}/document")
            ->assertUnauthorized()
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonPath('message', 'Unauthenticated.');
        $this->get('/api/auth/me')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_jpeg_and_pdf_documents_are_served_with_their_actual_content_type(): void
    {
        $files = [
            UploadedFile::fake()->image('proof.jpg'),
            UploadedFile::fake()->createWithContent('proof.pdf', "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"),
        ];

        foreach ($files as $file) {
            $teacher = $this->teacher();
            $id = $this->actingAs($teacher)->post('/api/teacher/verification', $this->payload($file), ['Accept' => 'application/json'])
                ->assertCreated()->json('data.id');
            $this->get("/api/teacher-verifications/{$id}/document")
                ->assertOk()
                ->assertHeader('Content-Type', $file->getMimeType());
        }
    }

    public function test_upload_rejects_invalid_content_oversize_and_missing_file(): void
    {
        $teacher = $this->teacher();
        $temp = tempnam(sys_get_temp_dir(), 'proof-');
        file_put_contents($temp, 'not a PDF');
        try {
            $invalid = new UploadedFile($temp, 'proof.pdf', 'application/pdf', null, true);
            $this->actingAs($teacher)->post('/api/teacher/verification', $this->payload($invalid), ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('document');
        } finally {
            unlink($temp);
        }
        $this->post('/api/teacher/verification', $this->payload(UploadedFile::fake()->image('proof.png')->size(5121)), ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('document');
        $this->postJson('/api/teacher/verification', array_diff_key($this->payload(), ['document' => true]))
            ->assertUnprocessable()->assertJsonValidationErrors('document');
        $this->assertDatabaseCount('teacher_verification_submissions', 0);
        $this->assertSame([], Storage::disk('local')->allFiles('teacher-verifications'));
    }

    public function test_admin_review_resubmission_and_classroom_gate(): void
    {
        $teacher = $this->teacher();
        $admin = $this->admin();
        $this->actingAs($teacher)->getJson('/api/teacher/classrooms')->assertForbidden();
        $firstId = $this->post('/api/teacher/verification', $this->payload(), ['Accept' => 'application/json'])->assertCreated()->json('data.id');
        $this->post('/api/teacher/verification', $this->payload(), ['Accept' => 'application/json'])->assertUnprocessable();
        $this->actingAs($admin)->postJson("/api/admin/teacher-verifications/{$firstId}/reject", [])
            ->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->postJson("/api/admin/teacher-verifications/{$firstId}/reject", ['reason' => 'Please submit a clearer document'])->assertOk();
        $this->postJson("/api/admin/teacher-verifications/{$firstId}/approve")->assertUnprocessable();
        $secondId = $this->actingAs($teacher)->post('/api/teacher/verification', $this->payload(), ['Accept' => 'application/json'])->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson("/api/admin/teacher-verifications/{$secondId}/approve")->assertOk();
        $this->postJson("/api/admin/teacher-verifications/{$secondId}/approve")->assertUnprocessable();
        $this->actingAs($teacher)->getJson('/api/teacher/classrooms')->assertOk();
        $this->getJson('/api/teacher/verification')->assertOk()->assertJsonCount(2, 'data.submissions');
        $this->assertDatabaseHas('teacher_verification_submissions', ['id' => $firstId, 'status' => 'rejected']);
        $this->assertDatabaseHas('teacher_verification_submissions', ['id' => $secondId, 'status' => 'verified', 'reviewed_by' => $admin->id]);
    }

    public function test_legacy_metadata_and_path_tampering_do_not_expose_files(): void
    {
        $teacher = $this->teacher();
        $admin = $this->admin();
        $legacy = $teacher->teacherProfile->verificationSubmissions()->create([
            'full_name' => 'Teacher', 'school_name' => 'School', 'school_address' => 'Address',
            'position' => 'Teacher', 'document_name' => 'old.pdf', 'document_type' => 'application/pdf', 'document_size' => 123,
        ]);
        $teacher->teacherProfile->forceFill(['verification_status' => 'pending'])->save();
        $this->actingAs($admin)->get("/api/teacher-verifications/{$legacy->id}/document")->assertNotFound();
        $this->postJson("/api/admin/teacher-verifications/{$legacy->id}/approve")->assertUnprocessable();
        $legacy->forceFill(['document_path' => '../secret.pdf'])->save();
        $this->get("/api/teacher-verifications/{$legacy->id}/document")->assertNotFound();
        $this->postJson("/api/admin/teacher-verifications/{$legacy->id}/reject", ['reason' => 'Please upload a real document'])->assertOk();
    }

    public function test_storage_file_is_removed_when_database_transaction_fails(): void
    {
        $teacher = $this->teacher();
        TeacherVerificationSubmission::creating(function (): void {
            throw new RuntimeException('Simulated database failure');
        });

        try {
            app(TeacherVerificationService::class)->submit($teacher, $this->payload());
            $this->fail('Expected transaction failure.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated database failure', $exception->getMessage());
        }

        $this->assertDatabaseCount('teacher_verification_submissions', 0);
        $this->assertSame([], Storage::disk('local')->allFiles('teacher-verifications'));
    }

    public function test_non_admin_roles_cannot_review_or_list(): void
    {
        $teacher = $this->teacher();
        $student = User::factory()->create();
        $this->getJson('/api/admin/teacher-verifications')->assertUnauthorized();
        $id = $this->actingAs($teacher)->post('/api/teacher/verification', $this->payload(), ['Accept' => 'application/json'])->assertCreated()->json('data.id');
        $this->getJson('/api/admin/teacher-verifications')->assertForbidden();
        $this->postJson("/api/admin/teacher-verifications/{$id}/approve")->assertForbidden();
        $this->actingAs($student)->getJson('/api/admin/teacher-verifications')->assertForbidden();
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([]);

        return $teacher->refresh();
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->forceFill(['role' => 'admin'])->save();

        return $admin->refresh();
    }

    private function payload(?UploadedFile $file = null): array
    {
        return [
            'full_name' => 'Teacher', 'school_name' => 'School', 'school_address' => '123 Main Street',
            'position' => 'Teacher', 'document' => $file ?? UploadedFile::fake()->image('proof.png'),
        ];
    }
}
