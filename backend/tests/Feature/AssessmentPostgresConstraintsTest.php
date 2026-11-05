<?php

namespace Tests\Feature;

use App\Models\Assessment;
use App\Models\AssessmentRevision;
use App\Models\User;
use App\Services\AssessmentService;
use App\Services\QuestionBankService;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AssessmentPostgresConstraintsTest extends TestCase
{
    use RefreshDatabase;

    public function test_postgres_schema_constraints_and_indexes(): void
    {
        if (DB::getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        $this->assertSame('webstudy_test', DB::selectOne('select current_database() as name')->name);
        $teacher = User::factory()->create();
        $teacher->teacherProfile()->create([]);
        $assessment = Assessment::create(['teacher_id' => $teacher->id, 'title' => 'A', 'version' => 1]);
        $revision = $assessment->revisions()->create(['revision_no' => 1, 'status' => 'draft', 'title' => 'A', 'version' => 1, 'total_points' => '0']);
        $this->assertDatabaseHas('assessment_revisions', ['id' => $revision->id]);
        $indexes = DB::select("SELECT indexname FROM pg_indexes WHERE tablename IN ('assessments','assessment_revisions','revision_questions')");
        $names = array_column($indexes, 'indexname');
        $this->assertContains('revisions_one_draft_idx', $names);
        $this->assertContains('assessments_owner_updated_idx', $names);
        $this->assertContains('revision_questions_position_unique', $names);
        $this->assertSame('numeric', DB::selectOne("SELECT data_type FROM information_schema.columns WHERE table_name='revision_questions' AND column_name='max_points'")->data_type);
        $this->assertSame('jsonb', DB::selectOne("SELECT data_type FROM information_schema.columns WHERE table_name='revision_questions' AND column_name='public_content'")->data_type);
    }

    public function test_assessment_timestamps_have_contract_nullability(): void
    {
        if (DB::getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        $this->assertSame('webstudy_test', DB::selectOne('select current_database() as name')->name);

        $columns = DB::select("SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('assessments', 'assessment_revisions', 'revision_questions')
              AND column_name IN ('created_at', 'updated_at', 'deleted_at', 'published_at')");
        $actual = [];
        foreach ($columns as $column) {
            $actual[$column->table_name.'.'.$column->column_name] = [$column->data_type, $column->is_nullable];
        }

        foreach (['assessments.created_at', 'assessments.updated_at', 'assessment_revisions.created_at',
            'assessment_revisions.updated_at', 'revision_questions.created_at'] as $name) {
            $this->assertSame(['timestamp with time zone', 'NO'], $actual[$name] ?? null, $name);
        }
        foreach (['assessments.deleted_at', 'assessment_revisions.published_at'] as $name) {
            $this->assertSame(['timestamp with time zone', 'YES'], $actual[$name] ?? null, $name);
        }
    }

    public function test_published_revision_rejects_raw_mutation(): void
    {
        if (DB::getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        $teacher = User::factory()->create();
        $teacher->teacherProfile()->create([]);
        $assessment = Assessment::create(['teacher_id' => $teacher->id, 'title' => 'A', 'version' => 1]);
        $revision = $assessment->revisions()->create(['revision_no' => 1, 'status' => 'draft', 'title' => 'A', 'version' => 1, 'total_points' => '1']);
        $revision->update(['status' => 'published', 'published_at' => now()]);
        try {
            DB::table('assessment_revisions')->where('id', $revision->id)->update(['title' => 'Tampered']);
            $this->fail('Database accepted published mutation');
        } catch (QueryException $e) {
            $this->assertStringContainsString('published revision is immutable', $e->getMessage());
        }
    }

    public function test_second_draft_is_rejected_by_postgres_unique_index(): void
    {
        if (DB::getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        $teacher = User::factory()->create();
        $teacher->teacherProfile()->create([]);
        $assessment = Assessment::create(['teacher_id' => $teacher->id, 'title' => 'A', 'version' => 1]);
        $assessment->revisions()->create(['revision_no' => 1, 'status' => 'draft', 'title' => 'A', 'version' => 1, 'total_points' => '0']);
        try {
            $assessment->revisions()->create(['revision_no' => 2, 'status' => 'draft', 'title' => 'A', 'version' => 1, 'total_points' => '0']);
            $this->fail('Database accepted a second draft');
        } catch (QueryException $e) {
            $this->assertStringContainsString('revisions_one_draft_idx', $e->getMessage());
        }
    }

    public function test_published_snapshot_question_rejects_raw_update(): void
    {
        if (DB::getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        $this->seed(CurriculumSeeder::class);
        $teacher = User::factory()->create();
        $teacher->teacherProfile()->create([]);
        $source = app(QuestionBankService::class)->create($teacher, [
            'type' => 'true_false', 'lessonId' => 'geo10-kn-b07', 'difficulty' => 'recognition',
            'content' => 'Original', 'correctAnswer' => true,
        ]);
        $assessment = app(AssessmentService::class)->create($teacher, ['title' => 'Immutable']);
        $revision = $assessment->revisions()->firstOrFail();
        $revision = app(AssessmentService::class)->saveDraft($teacher, $revision->id, [
            'expectedVersion' => 1, 'title' => 'Immutable',
            'questions' => [['sourceQuestionId' => $source->id, 'sourceQuestionVersion' => 1]],
        ]);
        app(AssessmentService::class)->publish($teacher, $revision->id, 2, 'immutable-key');
        $question = $revision->questions()->firstOrFail();
        try {
            DB::table('revision_questions')->where('id', $question->id)->update(['max_points' => '9.000000']);
            $this->fail('Database accepted published question update');
        } catch (QueryException $e) {
            $this->assertStringContainsString('published question is immutable', $e->getMessage());
        }
    }
}
