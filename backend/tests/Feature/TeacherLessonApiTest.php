<?php

namespace Tests\Feature;

use App\Models\Classroom;
use App\Models\TeacherLessonContent;
use App\Models\User;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeacherLessonApiTest extends TestCase
{
    use RefreshDatabase;

    private const LESSON = 'geo10-kn-b07';

    public function test_access_catalog_and_teacher_isolation(): void
    {
        $path = '/api/teacher/lessons';
        $this->getJson($path)->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson($path)->assertForbidden();
        $unverified = $this->teacher();
        $this->actingAs($unverified)->getJson($path)->assertForbidden();
        $this->seed(CurriculumSeeder::class);
        $first = $this->verifiedTeacher();
        $this->actingAs($first)->getJson($path)->assertOk()->assertJsonCount(40, 'data')
            ->assertJsonPath('data.6.id', self::LESSON)->assertJsonPath('data.6.status', 'uncreated');
        $this->putJson($path.'/'.self::LESSON.'/draft', ['content' => $this->content('Private')])->assertOk();
        $second = $this->verifiedTeacher();
        $this->actingAs($second)->getJson($path.'/'.self::LESSON)->assertOk()
            ->assertJsonPath('data.status', 'uncreated')->assertJsonPath('data.draftContent', null);
        $this->getJson($path)->assertOk()->assertJsonMissing(['explanation' => 'Private']);
        $this->getJson($path.'/missing')->assertNotFound();
    }

    public function test_draft_publish_scope_snapshot_withdraw_and_repeated_save(): void
    {
        $this->seed(CurriculumSeeder::class);
        $teacher = $this->verifiedTeacher();
        $classroom = $this->classroom($teacher, '10A1');
        $second = $this->classroom($teacher, '10A2');
        $other = $this->verifiedTeacher();
        $otherClassroom = $this->classroom($other, '10B1');
        $base = '/api/teacher/lessons/'.self::LESSON;
        $this->actingAs($teacher);
        $this->postJson($base.'/publish', ['classroomIds' => [$classroom->id]])->assertUnprocessable();
        $this->putJson($base.'/draft', ['content' => $this->content('First')])->assertOk()
            ->assertJsonPath('data.status', 'draft')->assertJsonPath('data.draftContent.sections.0.title', 'Section');
        $this->putJson($base.'/draft', ['content' => $this->content('First')])->assertOk();
        $this->assertDatabaseCount('teacher_lesson_contents', 1);
        $this->putJson($base.'/draft', ['content' => array_merge($this->content('Forged'), ['teacher_id' => $other->id])])
            ->assertUnprocessable();
        $this->postJson($base.'/publish', ['classroomIds' => [$classroom->id, $otherClassroom->id]])->assertUnprocessable();
        $this->assertNull(TeacherLessonContent::firstOrFail()->published_content);
        $this->postJson($base.'/publish', ['classroomIds' => [$classroom->id]])->assertOk()
            ->assertJsonPath('data.status', 'published')->assertJsonPath('data.classroomIds.0', $classroom->id)
            ->assertJsonPath('data.publishedContent.sections.0.videoUrl', 'https://youtu.be/abcdefghijk');
        $this->putJson($base.'/draft', ['content' => $this->content('Second')])->assertOk()
            ->assertJsonPath('data.publishedContent.explanation', 'First')
            ->assertJsonPath('data.draftContent.explanation', 'Second');
        $this->postJson($base.'/publish', ['classroomIds' => [$second->id]])->assertOk()
            ->assertJsonPath('data.publishedContent.explanation', 'Second')
            ->assertJsonPath('data.classroomIds.0', $second->id);
        $this->assertDatabaseCount('teacher_lesson_classrooms', 1);
        $this->postJson($base.'/withdraw')->assertOk()->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.publishedContent', null)->assertJsonPath('data.draftContent.explanation', 'Second');
        $this->assertDatabaseCount('teacher_lesson_classrooms', 0);
        $this->postJson($base.'/withdraw')->assertUnprocessable();
    }

    public function test_publish_validation_and_archived_classroom(): void
    {
        $this->seed(CurriculumSeeder::class);
        $teacher = $this->verifiedTeacher();
        $classroom = $this->classroom($teacher, '10A1');
        $base = '/api/teacher/lessons/'.self::LESSON;
        $this->actingAs($teacher)->putJson($base.'/draft', ['content' => $this->content('')])->assertOk();
        $this->postJson($base.'/publish', ['classroomIds' => [$classroom->id]])->assertUnprocessable();
        $asset = $this->content('[Học liệu](webstudy-asset://v1/infographic/local)');
        $this->putJson($base.'/draft', ['content' => $asset])->assertOk();
        $this->postJson($base.'/publish', ['classroomIds' => [$classroom->id]])->assertUnprocessable();
        $this->putJson($base.'/draft', ['content' => $this->content('Safe')])->assertOk();
        $classroom->forceFill(['status' => 'archived'])->save();
        $this->postJson($base.'/publish', ['classroomIds' => [$classroom->id]])->assertUnprocessable();
        $this->assertDatabaseCount('teacher_lesson_classrooms', 0);
        $classroom->delete();
        $this->postJson($base.'/publish', ['classroomIds' => [$classroom->id]])->assertUnprocessable();
    }

    public function test_draft_accepts_empty_arrays_but_rejects_invalid_structure(): void
{
    $this->seed(CurriculumSeeder::class);

    $this->actingAs($this->verifiedTeacher());

    $url = '/api/teacher/lessons/'.self::LESSON.'/draft';

    // 1. Mang rong hop le khi luu ban nhap.
    $draft = $this->content('Draft validation');

    $draft['objectives'] = [];
    $draft['keyPoints'] = [];
    $draft['sections'][0]['keyPoints'] = [];

    $this->putJson($url, ['content' => $draft])
        ->assertOk()
        ->assertJsonPath('data.draftContent.objectives', [])
        ->assertJsonPath('data.draftContent.keyPoints', [])
        ->assertJsonPath(
            'data.draftContent.sections.0.keyPoints',
            []
        );

    // 2. Truong bat buoc co mat, khong duoc bo han.
    $missing = $draft;
    unset($missing['objectives']);

    $this->putJson($url, ['content' => $missing])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['content.objectives']);

    // 3. Khong chap nhan sai kieu du lieu.
    $invalid = $draft;
    $invalid['keyPoints'] = 'not-an-array';

    $this->putJson($url, ['content' => $invalid])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['content.keyPoints']);

    // 4. Kiem tra keyPoints trong section.
    $invalidSection = $draft;
    $invalidSection['sections'][0]['keyPoints'] = 'not-an-array';

    $this->putJson($url, ['content' => $invalidSection])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'content.sections.0.keyPoints',
        ]);
}

    private function content(string $body): array
    {
        return ['lessonId' => self::LESSON, 'status' => 'draft', 'objectives' => ['Understand'], 'keyPoints' => ['Key'],
            'diagramLayout' => 'mindMap', 'diagramDisplay' => ['source' => 'auto'],
            'explanation' => $body, 'sections' => [[
                'id' => 'one', 'title' => 'Section', 'content' => 'Detail', 'keyPoints' => [],
                'imageMode' => 'static', 'imageUrl' => 'https://example.test/image.png',
                'videoUrl' => 'https://youtu.be/abcdefghijk',
            ]], 'updatedAt' => now()->toIso8601String()];
    }

    private function classroom(User $teacher, string $name): Classroom
    {
        $response = $this->actingAs($teacher)->postJson('/api/teacher/classrooms',
            ['name' => $name, 'academic_year' => '2026-2027'])->assertCreated();
        return Classroom::findOrFail($response->json('data.id'));
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([]);
        return $teacher->refresh();
    }

    private function verifiedTeacher(): User
    {
        $teacher = $this->teacher();
        $teacher->teacherProfile->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        return $teacher;
    }
}
