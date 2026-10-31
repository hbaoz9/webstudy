<?php

namespace Tests\Feature;

use App\Models\Classroom;
use App\Models\TeacherLessonContent;
use App\Models\User;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StudentLessonApiTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/student/lessons';
    private const FIRST = 'geo10-kn-b07';
    private const SECOND = 'geo10-kn-b08';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CurriculumSeeder::class);
    }

    public function test_only_authenticated_students_can_read_the_list(): void
    {
        $this->getJson(self::PATH)->assertUnauthorized();
        $this->actingAs($this->teacher())->getJson(self::PATH)->assertForbidden();
        $admin = User::factory()->create();
        $admin->forceFill(['role' => 'admin'])->save();
        $this->actingAs($admin)->getJson(self::PATH)->assertForbidden();
    }

    public function test_no_membership_pending_request_and_draft_only_return_empty(): void
    {
        $teacher = $this->teacher();
        $classroom = $this->classroom($teacher, '10A1');
        $this->publish($teacher, self::FIRST, [$classroom->id]);
        $student = $this->student();
        $this->actingAs($student)->getJson(self::PATH)->assertOk()->assertExactJson(['data' => []]);

        app(ClassMembershipService::class)->requestJoin($student, $classroom->code, 'HS1001');
        $this->getJson(self::PATH)->assertOk()->assertExactJson(['data' => []]);
        $this->assertDatabaseCount('class_memberships', 0);

        $member = $this->member($teacher, $classroom, 'HS1002');
        $this->actingAs($teacher)->putJson('/api/teacher/lessons/'.self::SECOND.'/draft',
            ['content' => $this->content(self::SECOND, 'Draft only')])->assertOk();
        $this->actingAs($member)->getJson(self::PATH)->assertOk()->assertJsonCount(1, 'data');

        // A classroom with only a draft has no visible lessons.
        $otherClassroom = $this->classroom($teacher, '10A2');
        $otherMember = $this->member($teacher, $otherClassroom, 'HS2001');
        $this->actingAs($otherMember)->getJson(self::PATH)->assertExactJson(['data' => []]);
    }

    public function test_list_is_ordered_minimal_scoped_to_membership_and_read_only(): void
    {
        $teacher = $this->teacher();
        $classroom = $this->classroom($teacher, '10A1');
        $otherClassroom = $this->classroom($teacher, '10A2');
        $otherTeacher = $this->teacher();
        $otherTeacherClassroom = $this->classroom($otherTeacher, '10B1');
        $member = $this->member($teacher, $classroom, 'HS1001');
        $otherMember = $this->member($teacher, $otherClassroom, 'HS2001');
        $this->publish($teacher, self::SECOND, [$classroom->id]);
        $this->publish($teacher, self::FIRST, [$classroom->id]);
        $this->publish($teacher, 'geo10-kn-b09', [$otherClassroom->id]);
        $this->publish($otherTeacher, 'geo10-kn-b10', [$otherTeacherClassroom->id]);

        // Even a malformed cross-owner pivot must not expose another teacher's publication.
        $foreign = TeacherLessonContent::query()->where('teacher_id', $otherTeacher->id)->firstOrFail();
        $foreign->classrooms()->attach($classroom->id);
        $before = $this->publicationState();

        $response = $this->actingAs($member)->getJson(self::PATH.'?classroom_id='.$otherClassroom->id.'&user_id='.$otherMember->id)
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', self::FIRST)
            ->assertJsonPath('data.1.id', self::SECOND)
            ->assertJsonPath('data.0.number', 7)
            ->assertJsonPath('data.0.chapterId', 'geo10-kn-c03');
        $this->assertSame([
            'id', 'number', 'title', 'chapterId', 'chapterNumber', 'chapterTitle',
            'partId', 'partNumber', 'partTitle', 'publishedAt',
        ], array_keys($response->json('data.0')));
        $this->assertNotNull($response->json('data.0.publishedAt'));
        $this->assertStringNotContainsString('draftContent', $response->getContent());
        $this->assertStringNotContainsString('publishedContent', $response->getContent());
        $this->assertStringNotContainsString('Private content', $response->getContent());
        $this->assertSame($before, $this->publicationState());
        $this->actingAs($otherMember)->getJson(self::PATH)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'geo10-kn-b09');

        // A pivot without a published snapshot cannot grant access.
        TeacherLessonContent::query()->where('teacher_id', $teacher->id)
            ->where('curriculum_lesson_id', 'geo10-kn-b09')->update(['published_content' => null]);
        $this->getJson(self::PATH)->assertExactJson(['data' => []]);
    }

    public function test_draft_snapshot_republish_and_withdraw_change_visibility_only_when_published(): void
    {
        $teacher = $this->teacher();
        $first = $this->classroom($teacher, '10A1');
        $second = $this->classroom($teacher, '10A2');
        $firstMember = $this->member($teacher, $first, 'HS1001');
        $secondMember = $this->member($teacher, $second, 'HS2001');
        $this->publish($teacher, self::FIRST, [$first->id]);
        $this->actingAs($firstMember)->getJson(self::PATH)->assertJsonCount(1, 'data');

        $this->actingAs($teacher)->putJson('/api/teacher/lessons/'.self::FIRST.'/draft',
            ['content' => $this->content(self::FIRST, 'New private draft')])->assertOk();
        $record = TeacherLessonContent::query()->where('teacher_id', $teacher->id)->firstOrFail();
        $this->assertSame('Private content', $record->published_content['explanation']);
        $this->actingAs($firstMember)->getJson(self::PATH)->assertJsonCount(1, 'data');

        $base = '/api/teacher/lessons/'.self::FIRST;
        $this->actingAs($teacher)->postJson($base.'/publish', ['classroomIds' => [$second->id]])->assertOk();
        $this->actingAs($firstMember)->getJson(self::PATH)->assertExactJson(['data' => []]);
        $this->actingAs($secondMember)->getJson(self::PATH)->assertJsonCount(1, 'data');
        $this->actingAs($teacher)->postJson($base.'/withdraw')->assertOk();
        $this->actingAs($secondMember)->getJson(self::PATH)->assertExactJson(['data' => []]);
    }

    public function test_left_archived_deleted_and_restored_classrooms_do_not_expose_lessons(): void
    {
        $teacher = $this->teacher();
        $classroom = $this->classroom($teacher, '10A1');
        $member = $this->member($teacher, $classroom, 'HS1001');
        $this->publish($teacher, self::FIRST, [$classroom->id]);
        $service = app(ClassMembershipService::class);
        $membership = $member->classMemberships()->firstOrFail();
        $service->leave($member, $membership);
        $this->actingAs($member)->getJson(self::PATH)->assertExactJson(['data' => []]);

        $another = $this->member($teacher, $classroom, 'HS1002');
        $this->actingAs($another)->getJson(self::PATH)->assertJsonCount(1, 'data');
        app(ClassroomService::class)->archive($teacher, $classroom);
        $this->actingAs($another)->getJson(self::PATH)->assertExactJson(['data' => []]);
        app(ClassroomService::class)->restore($teacher, $classroom);
        $this->actingAs($another)->getJson(self::PATH)->assertExactJson(['data' => []]);
        $this->assertSame('left', $another->classMemberships()->firstOrFail()->fresh()->status);

        // A stale active membership cannot bypass Classroom's soft-delete scope.
        $newMember = $this->member($teacher, $classroom, 'HS1003');
        $classroom->forceFill(['status' => 'archived'])->save();
        $this->actingAs($newMember)->getJson(self::PATH)->assertExactJson(['data' => []]);
        $classroom->forceFill(['status' => 'active'])->save();
        $classroom->delete();
        $this->actingAs($newMember)->getJson(self::PATH)->assertExactJson(['data' => []]);
    }

    public function test_detail_requires_student_role_and_active_membership(): void
    {
        $path = self::PATH.'/'.self::FIRST;
        $this->getJson($path)->assertUnauthorized();
        $this->actingAs($this->teacher())->getJson($path)->assertForbidden();
        $admin = User::factory()->create();
        $admin->forceFill(['role' => 'admin'])->save();
        $this->actingAs($admin)->getJson($path)->assertForbidden();

        $teacher = $this->teacher();
        $classroom = $this->classroom($teacher, '10A1');
        $this->publish($teacher, self::FIRST, [$classroom->id]);
        $student = $this->student();
        $this->actingAs($student)->getJson($path)->assertNotFound();
        app(ClassMembershipService::class)->requestJoin($student, $classroom->code);
        $this->getJson($path)->assertNotFound();
        $this->getJson(self::PATH.'/missing-lesson')->assertNotFound();
    }

    public function test_detail_returns_only_the_current_published_snapshot_and_never_writes(): void
    {
        $teacher = $this->teacher();
        $classroom = $this->classroom($teacher, '10A1');
        $member = $this->member($teacher, $classroom, 'HS1001');
        $this->publish($teacher, self::FIRST, [$classroom->id]);
        $record = TeacherLessonContent::query()->where('teacher_id', $teacher->id)->firstOrFail();
        $before = $this->publicationState();
        $path = self::PATH.'/'.self::FIRST;

        $response = $this->actingAs($member)->getJson($path.'?classroom_id=forged&user_id=forged')
            ->assertOk()->assertJsonPath('data.id', self::FIRST)
            ->assertJsonPath('data.number', 7)
            ->assertJsonPath('data.chapterId', 'geo10-kn-c03');
        $this->assertSame([
            'id', 'number', 'title', 'chapterId', 'chapterNumber', 'chapterTitle',
            'partId', 'partNumber', 'partTitle', 'publishedAt', 'content',
        ], array_keys($response->json('data')));
        $this->assertSame($record->published_content, $response->json('data.content'));
        $this->assertNotNull($response->json('data.publishedAt'));
        $this->assertStringNotContainsString('draftContent', $response->getContent());
        $this->assertStringNotContainsString('teacher_id', $response->getContent());
        $this->assertSame($before, $this->publicationState());

        $base = '/api/teacher/lessons/'.self::FIRST;
        $this->actingAs($teacher)->putJson($base.'/draft',
            ['content' => $this->content(self::FIRST, 'New private draft')])->assertOk();
        $this->actingAs($member)->getJson($path)->assertOk()
            ->assertJsonPath('data.content.explanation', 'Private content');
        $this->actingAs($teacher)->postJson($base.'/publish', ['classroomIds' => [$classroom->id]])->assertOk();
        $this->actingAs($member)->getJson($path)->assertOk()
            ->assertJsonPath('data.content.explanation', 'New private draft');
        $this->actingAs($teacher)->postJson($base.'/withdraw')->assertOk();
        $this->actingAs($member)->getJson($path)->assertNotFound();
    }

    public function test_detail_is_isolated_by_classroom_teacher_and_publication_state(): void
    {
        $teacher = $this->teacher();
        $first = $this->classroom($teacher, '10A1');
        $second = $this->classroom($teacher, '10A2');
        $otherTeacher = $this->teacher();
        $otherClassroom = $this->classroom($otherTeacher, '10B1');
        $firstMember = $this->member($teacher, $first, 'HS1001');
        $secondMember = $this->member($teacher, $second, 'HS2001');
        $path = self::PATH.'/'.self::FIRST;
        $draft = '/api/teacher/lessons/'.self::FIRST;

        $this->actingAs($firstMember)->getJson($path)->assertNotFound();
        $this->actingAs($teacher)->putJson($draft.'/draft',
            ['content' => $this->content(self::FIRST, 'Draft only')])->assertOk();
        $this->actingAs($firstMember)->getJson($path)->assertNotFound();
        $this->actingAs($teacher)->postJson($draft.'/publish', ['classroomIds' => [$second->id]])->assertOk();
        $this->actingAs($firstMember)->getJson($path)->assertNotFound();
        $this->actingAs($secondMember)->getJson($path)->assertOk();
        $this->actingAs($teacher)->postJson($draft.'/publish', ['classroomIds' => [$first->id]])->assertUnprocessable();
        // A new draft is required for republish; the previous distribution remains intact.
        $this->actingAs($teacher)->putJson($draft.'/draft',
            ['content' => $this->content(self::FIRST, 'Republished')])->assertOk();
        $this->postJson($draft.'/publish', ['classroomIds' => [$first->id]])->assertOk();
        $this->actingAs($secondMember)->getJson($path)->assertNotFound();
        $this->actingAs($firstMember)->getJson($path)->assertJsonPath('data.content.explanation', 'Republished');

        $this->publish($otherTeacher, self::SECOND, [$otherClassroom->id]);
        $foreign = TeacherLessonContent::query()->where('teacher_id', $otherTeacher->id)->firstOrFail();
        $foreign->classrooms()->attach($first->id);
        $this->actingAs($firstMember)->getJson(self::PATH.'/'.self::SECOND)->assertNotFound();
        $this->getJson(self::PATH.'/missing-lesson')->assertNotFound();

        // An orphaned pivot without its published snapshot must not grant access.
        TeacherLessonContent::query()->where('teacher_id', $teacher->id)
            ->where('curriculum_lesson_id', self::FIRST)->update(['published_content' => null]);
        $this->getJson($path)->assertNotFound();
    }

    public function test_detail_denies_left_archived_deleted_and_restored_classrooms(): void
    {
        $teacher = $this->teacher();
        $classroom = $this->classroom($teacher, '10A1');
        $member = $this->member($teacher, $classroom, 'HS1001');
        $this->publish($teacher, self::FIRST, [$classroom->id]);
        $path = self::PATH.'/'.self::FIRST;
        $this->actingAs($member)->getJson($path)->assertOk();
        app(ClassMembershipService::class)->leave($member, $member->classMemberships()->firstOrFail());
        $this->getJson($path)->assertNotFound();

        $other = $this->member($teacher, $classroom, 'HS1002');
        $this->actingAs($other)->getJson($path)->assertOk();
        app(ClassroomService::class)->archive($teacher, $classroom);
        $this->getJson($path)->assertNotFound();
        app(ClassroomService::class)->restore($teacher, $classroom);
        $this->getJson($path)->assertNotFound();

        $newMember = $this->member($teacher, $classroom, 'HS1003');
        $classroom->forceFill(['status' => 'archived'])->save();
        $this->actingAs($newMember)->getJson($path)->assertNotFound();
        $classroom->forceFill(['status' => 'active'])->save();
        $classroom->delete();
        $this->getJson($path)->assertNotFound();
    }

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $profile = $teacher->teacherProfile()->create([]);
        $profile->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();

        return $teacher->refresh();
    }

    private function classroom(User $teacher, string $name): Classroom
    {
        return app(ClassroomService::class)->create($teacher, ['name' => $name, 'academic_year' => '2026-2027']);
    }

    private function student(): User
    {
        $student = User::factory()->create();
        $student->forceFill(['role' => 'student'])->save();

        return $student->refresh();
    }

    private function member(User $teacher, Classroom $classroom, string $studentCode): User
    {
        app(ClassroomService::class)->importRoster($teacher, $classroom, [[
            'orderNumber' => $classroom->rosterEntries()->count() + 1,
            'fullName' => 'Student '.$studentCode,
            'studentCode' => $studentCode,
        ]]);
        $student = $this->student();
        $service = app(ClassMembershipService::class);
        $request = $service->requestJoin($student, $classroom->code, $studentCode);
        $service->approve($teacher, $request);

        return $student;
    }

    private function publish(User $teacher, string $lessonId, array $classroomIds): void
    {
        $base = '/api/teacher/lessons/'.$lessonId;
        $this->actingAs($teacher)->putJson($base.'/draft', ['content' => $this->content($lessonId, 'Private content')])->assertOk();
        $this->postJson($base.'/publish', ['classroomIds' => $classroomIds])->assertOk();
    }

    private function content(string $lessonId, string $explanation): array
    {
        return [
            'lessonId' => $lessonId, 'status' => 'draft', 'objectives' => ['Learn'], 'keyPoints' => ['Key'],
            'diagramLayout' => 'mindMap', 'diagramDisplay' => ['source' => 'auto'],
            'explanation' => $explanation, 'sections' => [[
                'id' => 'one', 'title' => 'Section', 'content' => 'Detail', 'keyPoints' => [],
                'imageMode' => 'static', 'imageUrl' => 'https://example.test/image.png',
                'videoUrl' => 'https://youtu.be/abcdefghijk',
            ]], 'updatedAt' => now()->toIso8601String(),
        ];
    }

    private function publicationState(): array
    {
        return [
            DB::table('teacher_lesson_contents')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all(),
            DB::table('teacher_lesson_classrooms')->orderBy('teacher_lesson_content_id')->orderBy('classroom_id')->get()->map(fn ($row) => (array) $row)->all(),
            DB::table('class_memberships')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all(),
        ];
    }
}
