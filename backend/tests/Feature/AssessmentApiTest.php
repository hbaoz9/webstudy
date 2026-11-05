<?php

namespace Tests\Feature;

use App\Models\AssessmentRevision;
use App\Models\QuestionBankQuestion;
use App\Models\User;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssessmentApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CurriculumSeeder::class);
    }

    public function test_auth_ownership_and_atomic_create(): void
    {
        $this->getJson('/api/teacher/assessments')->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson('/api/teacher/assessments')->assertForbidden();
        $this->actingAs($this->teacher(false))->postJson('/api/teacher/assessments', ['title' => 'T'])->assertForbidden();
        $this->actingAs($this->teacher());
        $created = $this->postJson('/api/teacher/assessments', ['title' => 'Test', 'instructions' => 'Read'])->assertCreated();
        $id = $created->json('data.id');
        $this->assertDatabaseHas('assessment_revisions', ['assessment_id' => $id, 'revision_no' => 1, 'status' => 'draft']);
        $this->actingAs($this->teacher());
        $this->getJson('/api/teacher/assessments/'.$id)->assertNotFound();
        $this->patchJson('/api/teacher/assessments/'.$id, ['title' => 'Other', 'expectedVersion' => 1])->assertNotFound();
    }

    public function test_snapshot_version_decimal_publish_clone_and_delete_restriction(): void
    {
        $this->actingAs($this->teacher());
        $source = $this->postJson('/api/teacher/questions', $this->question())->assertCreated()->json('data.id');
        $assessment = $this->postJson('/api/teacher/assessments', ['title' => 'Assessment'])->assertCreated()->json('data');
        $revision = AssessmentRevision::where('assessment_id', $assessment['id'])->firstOrFail();
        $url = '/api/teacher/revisions/'.$revision->id;
        $saved = $this->putJson($url.'/draft', ['expectedVersion' => 1, 'title' => 'Assessment',
            'questions' => [['sourceQuestionId' => $source, 'sourceQuestionVersion' => 1, 'maxPoints' => '0.750001']]])
            ->assertOk()->assertJsonPath('data.totalPoints', '0.750001')->json('data');
        $this->assertSame('equal_per_statement', $saved['questions'][0]['gradingPolicy']);
        $this->assertArrayNotHasKey('correctAnswer', $saved['questions'][0]['publicContent']['statements'][0]);
        $this->putJson('/api/teacher/questions/'.$source, $this->question('Changed') + ['expectedVersion' => 1])->assertOk();
        $this->getJson($url)->assertJsonPath('data.questions.0.publicContent.content', 'Original');
        $this->putJson($url.'/draft', ['expectedVersion' => 1, 'title' => 'Assessment', 'questions' => []])->assertStatus(409);
        $this->putJson($url.'/draft', ['expectedVersion' => 2, 'title' => 'Assessment',
            'questions' => [['sourceQuestionId' => $source, 'sourceQuestionVersion' => 1]]])->assertStatus(409);
        $this->postJson($url.'/publish', ['expectedVersion' => 2])->assertUnprocessable();
        $published = $this->withHeader('Idempotency-Key', 'publish-test-key-123')
            ->postJson($url.'/publish', ['expectedVersion' => 2])->assertOk()->assertJsonPath('data.status', 'published')->json('data');
        $this->postJson($url.'/publish', ['expectedVersion' => 2])->assertOk()->assertJsonPath('data.id', $published['id']);
        $this->putJson($url.'/draft', ['expectedVersion' => 3, 'title' => 'Changed', 'questions' => []])->assertStatus(409);
        $this->deleteJson('/api/teacher/assessments/'.$assessment['id'], ['expectedVersion' => 1])->assertStatus(409);
        $this->deleteJson('/api/teacher/questions/'.$source, ['expectedVersion' => 2])->assertNoContent();
        $clone = $this->postJson('/api/teacher/assessments/'.$assessment['id'].'/revisions', ['basedOnRevisionId' => $revision->id])
            ->assertCreated()->assertJsonPath('data.revisionNo', 2)->json('data');
        $this->assertSame('Original', $clone['questions'][0]['publicContent']['content']);
        $this->assertSame('0.750001', $clone['totalPoints']);
        $this->actingAs($this->teacher())->postJson('/api/teacher/assessments/'.$assessment['id'].'/revisions',
            ['basedOnRevisionId' => $revision->id])->assertNotFound();
    }

    public function test_never_published_assessment_can_be_soft_deleted(): void
    {
        $this->actingAs($this->teacher());
        $id = $this->postJson('/api/teacher/assessments', ['title' => 'Delete me'])->assertCreated()->json('data.id');
        $this->deleteJson('/api/teacher/assessments/'.$id, ['expectedVersion' => 1])->assertNoContent();
        $this->getJson('/api/teacher/assessments/'.$id)->assertNotFound();
        $this->assertDatabaseHas('assessments', ['id' => $id]);
    }

    public function test_all_six_source_types_are_snapshotted_with_correct_grading_policies(): void
    {
        $this->actingAs($this->teacher());
        $base = ['lessonId' => 'geo10-kn-b07', 'difficulty' => 'recognition', 'content' => 'Question'];
        $options = [['id' => 'a', 'text' => 'A'], ['id' => 'b', 'text' => 'B']];
        $inputs = [
            'single_choice' => ['options' => $options, 'correctOptionId' => 'a'],
            'multiple_choice' => ['options' => $options, 'correctOptionIds' => ['a', 'b']],
            'true_false' => ['correctAnswer' => true],
            'true_false_group' => ['statements' => [['id' => 'a', 'content' => 'A', 'correctAnswer' => true], ['id' => 'b', 'content' => 'B', 'correctAnswer' => false]]],
            'short_answer' => ['correctAnswer' => '2.5'],
            'essay_text' => ['rubricText' => 'Criteria'],
        ];
        $policies = ['exact_match', 'exact_set', 'boolean_match', 'equal_per_statement', 'numeric_match', 'manual'];
        $items = [];
        foreach ($inputs as $type => $specific) {
            $id = $this->postJson('/api/teacher/questions', $base + ['type' => $type] + $specific)->assertCreated()->json('data.id');
            $items[] = ['sourceQuestionId' => $id, 'sourceQuestionVersion' => 1];
        }
        $assessment = $this->postJson('/api/teacher/assessments', ['title' => 'Six'])->assertCreated()->json('data');
        $revision = AssessmentRevision::where('assessment_id', $assessment['id'])->firstOrFail();
        $response = $this->putJson('/api/teacher/revisions/'.$revision->id.'/draft', [
            'expectedVersion' => 1, 'title' => 'Six', 'questions' => $items,
        ])->assertOk()->assertJsonPath('data.totalPoints', '6.000000');
        $this->assertSame($policies, array_column($response->json('data.questions'), 'gradingPolicy'));
        $this->assertNull($response->json('data.questions.5.answerKey'));
    }

    private function question(string $content = 'Original'): array
    {
        return ['type' => 'true_false_group', 'lessonId' => 'geo10-kn-b07', 'difficulty' => 'recognition',
            'content' => $content, 'statements' => [
                ['id' => 'a', 'content' => 'A', 'correctAnswer' => true],
                ['id' => 'b', 'content' => 'B', 'correctAnswer' => false],
            ]];
    }

    private function teacher(bool $verified = true): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $profile = $teacher->teacherProfile()->create([]);
        if ($verified) $profile->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        return $teacher;
    }
}
