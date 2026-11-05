<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('assessments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('teacher_id')->constrained('teacher_profiles', 'user_id')->restrictOnDelete();
            $table->string('title', 255);
            $table->integer('version')->default(1);
            $table->timestampTz('created_at')->nullable(false);
            $table->timestampTz('updated_at')->nullable(false);
            $table->softDeletesTz();
            $table->index(['teacher_id', 'deleted_at', 'updated_at', 'id'], 'assessments_owner_updated_idx');
        });
        Schema::create('assessment_revisions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_id')->constrained('assessments')->restrictOnDelete();
            $table->unsignedInteger('revision_no');
            $table->string('status', 20);
            $table->string('title', 255);
            $table->text('instructions')->nullable();
            $table->uuid('source_revision_id')->nullable();
            $table->integer('version')->default(1);
            $table->decimal('total_points', 12, 6)->default(0);
            $table->timestampTz('published_at')->nullable();
            $table->string('publish_key_hash', 64)->nullable();
            $table->timestampTz('created_at')->nullable(false);
            $table->timestampTz('updated_at')->nullable(false);
            $table->unique(['assessment_id', 'revision_no'], 'revisions_number_unique');
            $table->index(['assessment_id', 'status'], 'revisions_status_idx');
        });
        Schema::table('assessment_revisions', function (Blueprint $table): void {
            $table->foreign('source_revision_id')->references('id')->on('assessment_revisions')->restrictOnDelete();
        });
        Schema::create('revision_questions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('revision_id')->constrained('assessment_revisions')->restrictOnDelete();
            $table->foreignUuid('source_question_id')->constrained('question_bank_questions')->restrictOnDelete();
            $table->integer('source_question_version');
            $table->unsignedInteger('position');
            $table->string('type', 32);
            $table->string('difficulty', 32);
            $table->string('curriculum_lesson_id', 32);
            $table->foreign('curriculum_lesson_id')->references('id')->on('curriculum_lessons')->restrictOnDelete();
            $table->jsonb('public_content');
            $table->jsonb('answer_key')->nullable();
            $table->jsonb('rubric')->nullable();
            $table->text('explanation')->nullable();
            $table->decimal('max_points', 12, 6);
            $table->string('grading_policy', 40);
            $table->timestampTz('created_at')->nullable(false);
            $table->unique(['revision_id', 'position'], 'revision_questions_position_unique');
            $table->unique(['revision_id', 'source_question_id'], 'revision_questions_source_unique');
            $table->index('source_question_id', 'revision_questions_source_idx');
        });
        if (DB::getDriverName() !== 'pgsql') return;
        DB::statement('CREATE UNIQUE INDEX revisions_one_draft_idx ON assessment_revisions (assessment_id) WHERE status = \'draft\'');
        DB::statement('ALTER TABLE assessments ADD CONSTRAINT assessments_version_check CHECK (version >= 1)');
        DB::statement("ALTER TABLE assessment_revisions ADD CONSTRAINT revisions_status_check CHECK (status IN ('draft','published'))");
        DB::statement('ALTER TABLE assessment_revisions ADD CONSTRAINT revisions_values_check CHECK (revision_no >= 1 AND version >= 1 AND total_points >= 0 AND (status = \'draft\' OR published_at IS NOT NULL))');
        DB::statement('ALTER TABLE revision_questions ADD CONSTRAINT revision_questions_values_check CHECK (source_question_version >= 1 AND position >= 1 AND max_points > 0)');
        DB::statement("ALTER TABLE revision_questions ADD CONSTRAINT revision_questions_json_check CHECK (jsonb_typeof(public_content) = 'object' AND (answer_key IS NULL OR jsonb_typeof(answer_key) = 'object'))");
        DB::statement("ALTER TABLE revision_questions ADD CONSTRAINT revision_questions_policy_check CHECK ((type = 'single_choice' AND grading_policy = 'exact_match') OR (type = 'multiple_choice' AND grading_policy = 'exact_set') OR (type = 'true_false' AND grading_policy = 'boolean_match') OR (type = 'true_false_group' AND grading_policy = 'equal_per_statement') OR (type = 'short_answer' AND grading_policy = 'numeric_match') OR (type = 'essay_text' AND grading_policy = 'manual'))");
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION protect_published_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' AND (NEW.title, NEW.instructions, NEW.total_points, NEW.assessment_id, NEW.revision_no, NEW.source_revision_id, NEW.status, NEW.published_at, NEW.publish_key_hash, NEW.version) IS DISTINCT FROM (OLD.title, OLD.instructions, OLD.total_points, OLD.assessment_id, OLD.revision_no, OLD.source_revision_id, OLD.status, OLD.published_at, OLD.publish_key_hash, OLD.version) THEN
    RAISE EXCEPTION 'published revision is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_published_revision_update BEFORE UPDATE ON assessment_revisions FOR EACH ROW EXECUTE FUNCTION protect_published_revision();
CREATE OR REPLACE FUNCTION block_published_revision_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' THEN RAISE EXCEPTION 'published revision cannot be deleted'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER block_published_revision_delete BEFORE DELETE ON assessment_revisions FOR EACH ROW EXECUTE FUNCTION block_published_revision_delete();
CREATE OR REPLACE FUNCTION protect_published_question() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.revision_id <> OLD.revision_id THEN RAISE EXCEPTION 'cannot move revision question'; END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO parent_status FROM assessment_revisions WHERE id = OLD.revision_id;
  ELSE
    SELECT status INTO parent_status FROM assessment_revisions WHERE id = NEW.revision_id;
  END IF;
  IF parent_status = 'published' THEN RAISE EXCEPTION 'published question is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_published_question_insert BEFORE INSERT ON revision_questions FOR EACH ROW EXECUTE FUNCTION protect_published_question();
CREATE TRIGGER protect_published_question_update BEFORE UPDATE ON revision_questions FOR EACH ROW EXECUTE FUNCTION protect_published_question();
CREATE TRIGGER protect_published_question_delete BEFORE DELETE ON revision_questions FOR EACH ROW EXECUTE FUNCTION protect_published_question();
SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP FUNCTION IF EXISTS protect_published_question() CASCADE; DROP FUNCTION IF EXISTS protect_published_revision() CASCADE; DROP FUNCTION IF EXISTS block_published_revision_delete() CASCADE;');
        }
        Schema::dropIfExists('revision_questions');
        Schema::dropIfExists('assessment_revisions');
        Schema::dropIfExists('assessments');
    }
};
