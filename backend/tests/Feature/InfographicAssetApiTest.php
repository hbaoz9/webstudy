<?php

namespace Tests\Feature;

use App\Models\Classroom;
use App\Models\User;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class InfographicAssetApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CurriculumSeeder::class);
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([])->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        return $teacher;
    }

    public function test_private_upload_and_class_publication_control_binary_access(): void
    {
        Storage::fake('local');
        $chapter = DB::table('curriculum_chapters')->orderBy('id')->first();
        $teacher = $this->teacher();
        $classroom = Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => '10A1',
            'academic_year' => '2026-2027', 'code' => 'INFO10A1', 'status' => 'active']);
        app(ClassroomService::class)->importRoster($teacher, $classroom, [[
            'orderNumber' => 1, 'fullName' => 'Infographic student', 'studentCode' => 'INFO-STUDENT',
        ]]);
        $student = User::factory()->create();
        $student->forceFill(['role' => 'student'])->save();
        $membership = app(ClassMembershipService::class)->requestJoin($student, $classroom->code, 'INFO-STUDENT');
        $membership = app(ClassMembershipService::class)->approve($teacher, $membership);
        $this->post('/api/teacher/infographics')->assertUnauthorized();
        $this->actingAs($student)->getJson('/api/teacher/infographics')->assertForbidden();
        $this->actingAs($teacher);
        $created = $this->post('/api/teacher/infographics', [
            'title' => 'Bản đồ khí hậu', 'chapterId' => $chapter->id,
            'image' => UploadedFile::fake()->image('map.png'),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.version', 1)->json('data');
        $id = $created['id'];
        $this->get('/api/teacher/infographics/'.$id.'/file')->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->actingAs($student)->get('/api/student/infographics/'.$id.'/file')->assertNotFound();
        $this->getJson('/api/student/infographics')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($teacher)->postJson('/api/teacher/infographics/'.$id.'/publish', [
            'classroomIds' => [$classroom->id], 'expectedVersion' => 1,
        ])->assertOk()->assertJsonPath('data.version', 2);
        $this->actingAs($student)->get('/api/student/infographics/'.$id.'/file')->assertOk();
        $this->getJson('/api/student/infographics')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($teacher)->postJson('/api/teacher/infographics/'.$id.'/publish', [
            'classroomIds' => [], 'expectedVersion' => 2,
        ])->assertOk();
        $this->actingAs($student)->get('/api/student/infographics/'.$id.'/file')->assertNotFound();
        app(ClassMembershipService::class)->leave($student, $membership);
        $this->actingAs($teacher)->postJson('/api/teacher/infographics/'.$id.'/publish', [
            'classroomIds' => [$classroom->id], 'expectedVersion' => 3,
        ])->assertOk();
        $this->actingAs($student)->get('/api/student/infographics/'.$id.'/file')->assertNotFound();
        $this->assertTrue(Storage::disk('local')->exists('infographics/'.$id));
    }

    public function test_invalid_image_and_cross_teacher_publication_are_rejected(): void
    {
        Storage::fake('local');
        $chapter = DB::table('curriculum_chapters')->orderBy('id')->first();
        $teacher = $this->teacher(); $other = $this->teacher();
        $this->actingAs($teacher)->post('/api/teacher/infographics', [
            'title' => 'Tệp giả', 'chapterId' => $chapter->id,
            'image' => UploadedFile::fake()->createWithContent('fake.png', 'not an image'),
        ], ['Accept' => 'application/json'])->assertUnprocessable();
        $created = $this->post('/api/teacher/infographics', [
            'title' => 'Bản đồ', 'chapterId' => $chapter->id,
            'image' => UploadedFile::fake()->image('map.png'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data');
        $this->actingAs($other)->get('/api/teacher/infographics/'.$created['id'].'/file')->assertNotFound();
        $this->postJson('/api/teacher/infographics/'.$created['id'].'/publish', [
            'classroomIds' => [], 'expectedVersion' => 1,
        ])->assertNotFound();
        $this->actingAs($teacher)->postJson('/api/teacher/infographics/'.$created['id'].'/publish', [
            'classroomIds' => [], 'expectedVersion' => 99,
        ])->assertStatus(409);
    }
}
