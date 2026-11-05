<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class QuestionBankPostgresConstraintsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('PostgreSQL constraints only.');
        }
        $this->seed(CurriculumSeeder::class);
    }

    public function test_postgres_schema_constraints_and_indexes(): void
    {
        $columns = collect(DB::select("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'question_bank_questions'"))->keyBy('column_name');
        $this->assertSame('uuid', $columns['id']->data_type);
        $this->assertSame('bigint', $columns['teacher_id']->data_type);
        $this->assertSame('character varying', $columns['curriculum_lesson_id']->data_type);
        $this->assertSame('jsonb', $columns['public_content']->data_type);
        $this->assertSame('jsonb', $columns['answer_key']->data_type);
        $this->assertSame('timestamp with time zone', $columns['created_at']->data_type);
        $this->assertSame('NO', $columns['public_content']->is_nullable);
        $this->assertSame('NO', $columns['teacher_id']->is_nullable);
        $this->assertSame('YES', $columns['deleted_at']->is_nullable);

        $constraints = collect(DB::select("SELECT conname FROM pg_constraint WHERE conrelid = 'question_bank_questions'::regclass"))->pluck('conname');
        foreach (['question_bank_questions_pkey', 'qb_type_allowed', 'qb_difficulty_allowed', 'qb_version_valid', 'qb_public_object', 'qb_private_object', 'qb_answer_presence'] as $name) {
            $this->assertContains($name, $constraints);
        }
        $foreign = DB::select("SELECT confrelid::regclass::text AS target, confdeltype AS delete_action FROM pg_constraint WHERE conrelid = 'question_bank_questions'::regclass AND contype = 'f'");
        $this->assertCount(2, $foreign);
        $this->assertEqualsCanonicalizing(['teacher_profiles', 'curriculum_lessons'], array_column($foreign, 'target'));
        $this->assertEqualsCanonicalizing(['r', 'r'], array_column($foreign, 'delete_action'));
        $indexes = collect(DB::select("SELECT indexname FROM pg_indexes WHERE tablename = 'question_bank_questions'"))->pluck('indexname');
        foreach (['qb_teacher_newest_idx', 'qb_teacher_type_idx', 'qb_teacher_lesson_idx'] as $name) {
            $this->assertContains($name, $indexes);
        }
    }

    public function test_postgres_rejects_invalid_rows_and_keeps_soft_deleted_row(): void
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([])->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        $this->actingAs($teacher);
        $id = $this->postJson('/api/teacher/questions', [
            'type' => 'true_false', 'lessonId' => 'geo10-kn-b07', 'difficulty' => 'recognition',
            'content' => 'Valid question', 'correctAnswer' => true,
        ])->assertCreated()->json('data.id');
        $table = DB::table('question_bank_questions');
        $this->assertFalse((bool) $table->where('id', $id)->value('show_in_lesson'));
        foreach ([
            ['type' => 'invalid'], ['difficulty' => 'invalid'], ['version' => 0],
            ['public_content' => '[]'], ['answer_key' => '[]'], ['answer_key' => null],
            ['teacher_id' => 999999999], ['curriculum_lesson_id' => 'missing'],
        ] as $change) {
            try {
                DB::transaction(fn () => DB::table('question_bank_questions')->where('id', $id)->update($change));
                $this->fail('PostgreSQL accepted invalid row: '.implode(',', array_keys($change)));
            } catch (QueryException $exception) {
                $this->assertNotSame('', $exception->getCode());
            }
        }
        $this->deleteJson('/api/teacher/questions/'.$id, ['expectedVersion' => 1])->assertNoContent();
        $this->assertSame(1, DB::table('question_bank_questions')->where('id', $id)->count());
        $this->assertNotNull(DB::table('question_bank_questions')->where('id', $id)->value('deleted_at'));
    }
}
