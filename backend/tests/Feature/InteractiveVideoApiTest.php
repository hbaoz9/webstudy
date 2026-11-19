<?php

namespace Tests\Feature;

use App\Models\Classroom;
use App\Models\User;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class InteractiveVideoApiTest extends TestCase
{
    use RefreshDatabase;

    private function teacher(): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([])->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        return $teacher;
    }

    private function payload(): array
    {
        return ['title' => 'Địa hình Việt Nam', 'youtubeId' => 'dQw4w9WgXcQ', 'checkpoints' => [[
            'id' => 'checkpoint-1', 'atSeconds' => 30, 'prompt' => 'Đâu là đồng bằng?',
            'options' => ['A' => 'Sông Hồng', 'B' => 'Hoàng Liên Sơn', 'C' => 'Trường Sơn', 'D' => 'Tây Nguyên'],
            'correctOption' => 'A',
        ]]];
    }

    public function test_teacher_draft_and_publication_snapshot_are_isolated_from_later_edits(): void
    {
        $teacher = $this->teacher();
        $classroom = Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => '10A1',
            'academic_year' => '2026-2027', 'code' => 'VID10A1', 'status' => 'active']);
        app(ClassroomService::class)->importRoster($teacher, $classroom, [[
            'orderNumber' => 1, 'fullName' => 'Video student', 'studentCode' => 'VIDEO-STUDENT',
        ]]);
        $student = User::factory()->create();
        $student->forceFill(['role' => 'student'])->save();
        $membership = app(ClassMembershipService::class)->requestJoin($student, $classroom->code, 'VIDEO-STUDENT');
        $membership = app(ClassMembershipService::class)->approve($teacher, $membership);

        $this->getJson('/api/teacher/interactive-videos')->assertUnauthorized();
        $this->actingAs($student)->getJson('/api/teacher/interactive-videos')->assertForbidden();
        $this->getJson('/api/student/interactive-videos')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($teacher);
        $created = $this->postJson('/api/teacher/interactive-videos', $this->payload())->assertCreated()
            ->assertJsonPath('data.version', 1)->json('data');
        $id = $created['id'];
        $this->getJson('/api/teacher/interactive-videos/'.$id)->assertOk()->assertJsonPath('data.status', 'draft');
        $this->postJson('/api/teacher/interactive-videos/'.$id.'/publish', [
            'classroomIds' => [$classroom->id], 'expectedVersion' => 1,
        ])->assertOk()->assertJsonPath('data.version', 2)->assertJsonPath('data.status', 'published');
        $publishedId = DB::table('interactive_video_publications')->where('video_id', $id)->value('id');
        $unrelated = User::factory()->create();
        $unrelated->forceFill(['role' => 'student'])->save();
        $this->actingAs($unrelated)->getJson('/api/student/interactive-videos/'.$publishedId)->assertNotFound();
        $this->actingAs($teacher);
        $changed = $this->payload(); $changed['title'] = 'Bản sửa chưa đăng';
        $this->putJson('/api/teacher/interactive-videos/'.$id, $changed + ['expectedVersion' => 2])
            ->assertOk()->assertJsonPath('data.version', 3);
        $this->actingAs($student)->getJson('/api/student/interactive-videos/'.$publishedId)
            ->assertOk()->assertJsonPath('data.title', 'Địa hình Việt Nam');
        $this->actingAs($teacher)->postJson('/api/teacher/interactive-videos/'.$id.'/publish', [
            'classroomIds' => [$classroom->id], 'expectedVersion' => 3,
        ])->assertOk();
        $this->actingAs($student)->getJson('/api/student/interactive-videos/'.$publishedId)
            ->assertOk()->assertJsonPath('data.title', 'Bản sửa chưa đăng');
        app(ClassMembershipService::class)->leave($student, $membership);
        $this->getJson('/api/student/interactive-videos/'.$publishedId)->assertNotFound();
        $this->actingAs($teacher)->postJson('/api/teacher/interactive-videos/'.$id.'/publish', [
            'classroomIds' => [], 'expectedVersion' => 4,
        ])->assertOk();
        $this->actingAs($student)->getJson('/api/student/interactive-videos/'.$publishedId)->assertNotFound();
        $this->assertSame('Bản sửa chưa đăng', DB::table('interactive_videos')->where('id', $id)->value('title'));
    }

    public function test_other_teacher_and_invalid_payload_cannot_publish_or_change_a_video(): void
    {
        $teacher = $this->teacher(); $other = $this->teacher();
        $classroom = Classroom::forceCreate(['teacher_id' => $other->id, 'name' => '10A2',
            'academic_year' => '2026-2027', 'code' => 'VID10A2', 'status' => 'active']);
        $this->actingAs($teacher);
        $emptyDraft = $this->payload(); $emptyDraft['checkpoints'] = [];
        $this->postJson('/api/teacher/interactive-videos', $emptyDraft)->assertCreated()
            ->assertJsonPath('data.checkpoints', []);
        $this->postJson('/api/teacher/interactive-videos', $this->payload() + ['teacherId' => $other->id])->assertUnprocessable();
        $bad = $this->payload(); $bad['checkpoints'][0]['correctOption'] = 'E';
        $this->postJson('/api/teacher/interactive-videos', $bad)->assertUnprocessable();
        $created = $this->postJson('/api/teacher/interactive-videos', $this->payload())->assertCreated()->json('data');
        $id = $created['id'];
        $this->postJson('/api/teacher/interactive-videos/'.$id.'/publish', [
            'classroomIds' => [$classroom->id], 'expectedVersion' => 1,
        ])->assertUnprocessable();
        $this->actingAs($other)->getJson('/api/teacher/interactive-videos/'.$id)->assertNotFound();
        $this->putJson('/api/teacher/interactive-videos/'.$id, $this->payload() + ['expectedVersion' => 1])->assertNotFound();
        $this->actingAs($teacher)->putJson('/api/teacher/interactive-videos/'.$id,
            $this->payload() + ['expectedVersion' => 99])->assertStatus(409);
        $this->assertSame(1, DB::table('interactive_videos')->where('id', $id)->value('version'));
    }
}
