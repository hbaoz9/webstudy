<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('question_bank_questions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('teacher_id')->constrained('teacher_profiles', 'user_id')->restrictOnDelete();
            $table->string('curriculum_lesson_id', 32);
            $table->foreign('curriculum_lesson_id')->references('id')->on('curriculum_lessons')->restrictOnDelete();
            $table->string('type', 32);
            $table->string('difficulty', 32);
            $table->jsonb('public_content');
            $table->jsonb('answer_key')->nullable();
            $table->jsonb('rubric')->nullable();
            $table->text('explanation')->nullable();
            $table->boolean('show_in_lesson')->default(false);
            $table->integer('version')->default(1);
            $table->timestampTz('created_at');
            $table->timestampTz('updated_at');
            $table->softDeletesTz();

            $table->index(['teacher_id', 'deleted_at', 'created_at', 'id'], 'qb_teacher_newest_idx');
            $table->index(['teacher_id', 'type'], 'qb_teacher_type_idx');
            $table->index(['teacher_id', 'curriculum_lesson_id'], 'qb_teacher_lesson_idx');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE question_bank_questions ADD CONSTRAINT qb_type_allowed CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'true_false_group', 'short_answer', 'essay_text'))");
            DB::statement("ALTER TABLE question_bank_questions ADD CONSTRAINT qb_difficulty_allowed CHECK (difficulty IN ('recognition', 'comprehension', 'application', 'advanced_application'))");
            DB::statement("ALTER TABLE question_bank_questions ADD CONSTRAINT qb_version_valid CHECK (version >= 1)");
            DB::statement("ALTER TABLE question_bank_questions ADD CONSTRAINT qb_public_object CHECK (jsonb_typeof(public_content) = 'object')");
            DB::statement("ALTER TABLE question_bank_questions ADD CONSTRAINT qb_private_object CHECK (answer_key IS NULL OR jsonb_typeof(answer_key) = 'object')");
            DB::statement("ALTER TABLE question_bank_questions ADD CONSTRAINT qb_answer_presence CHECK ((type = 'essay_text' AND answer_key IS NULL) OR (type <> 'essay_text' AND answer_key IS NOT NULL))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('question_bank_questions');
    }
};
