<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('distributions', function (Blueprint $table): void {
            // Nullable for pre-existing B.3 rows. A later, explicitly approved backfill can enforce NOT NULL.
            $table->string('score_policy', 16)->nullable();
            $table->string('score_release_mode', 64)->nullable();
            $table->string('answer_release_mode', 64)->nullable();
        });

        Schema::create('student_distribution_exceptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('distribution_id')->constrained('distributions')->restrictOnDelete();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('late_start_until')->nullable();
            $table->timestampTz('completion_deadline_at')->nullable();
            $table->integer('time_limit_seconds')->nullable();
            $table->integer('version')->default(1);
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->nullable(false);
            $table->timestampTz('updated_at')->nullable(false);
            $table->unique(['distribution_id', 'student_id'], 'student_exception_scope_unique');
        });
        Schema::create('student_exception_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('exception_id')->constrained('student_distribution_exceptions')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->jsonb('before_state')->nullable();
            $table->jsonb('after_state');
            $table->text('reason');
            $table->timestampTz('created_at')->nullable(false);
        });
        Schema::create('attempt_quota_grants', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('distribution_id')->constrained('distributions')->restrictOnDelete();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->integer('additional_attempts');
            $table->text('reason');
            $table->foreignId('granted_by')->constrained('users')->restrictOnDelete();
            $table->string('idempotency_key_hash', 64)->unique();
            $table->timestampTz('created_at')->nullable(false);
            $table->index(['distribution_id', 'student_id'], 'quota_scope_idx');
        });
        Schema::create('student_attempts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('distribution_id')->constrained('distributions')->restrictOnDelete();
            $table->foreignUuid('revision_id')->constrained('assessment_revisions')->restrictOnDelete();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('membership_id')->nullable()->constrained('class_memberships')->restrictOnDelete();
            $table->integer('attempt_no');
            $table->string('status', 24);
            $table->string('grading_status', 24)->default('NOT_GRADED');
            $table->timestampTz('started_at');
            $table->timestampTz('initial_expires_at');
            $table->timestampTz('expires_at');
            $table->timestampTz('finalized_at')->nullable();
            $table->string('finalization_reason', 24)->nullable();
            $table->jsonb('policy_snapshot');
            $table->decimal('auto_score', 12, 6)->nullable();
            $table->decimal('manual_score', 12, 6)->nullable();
            $table->decimal('total_score', 12, 6)->nullable();
            $table->integer('version')->default(1);
            $table->timestampTz('created_at')->nullable(false);
            $table->timestampTz('updated_at')->nullable(false);
            $table->unique(['distribution_id', 'student_id', 'attempt_no'], 'attempt_sequence_unique');
            $table->unique(['id', 'revision_id'], 'attempt_revision_scope_unique');
            $table->index(['student_id', 'distribution_id'], 'attempt_student_history_idx');
            $table->index(['status', 'expires_at'], 'attempt_timeout_idx');
        });
        Schema::create('attempt_answers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('attempt_id')->constrained('student_attempts')->restrictOnDelete();
            $table->foreignUuid('revision_id');
            $table->foreignUuid('revision_question_id')->constrained('revision_questions')->restrictOnDelete();
            $table->jsonb('answer_payload')->nullable();
            $table->integer('version');
            $table->timestampTz('accepted_at');
            $table->timestampTz('updated_at');
            $table->unique(['attempt_id', 'revision_question_id'], 'attempt_answer_unique');
            $table->foreign(['attempt_id', 'revision_id'], 'answer_attempt_revision_fk')->references(['id', 'revision_id'])->on('student_attempts')->restrictOnDelete();
        });
        Schema::create('attempt_commands', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('operation', 32);
            $table->string('target_scope', 100);
            $table->char('key_hash', 64);
            $table->char('request_hash', 64);
            $table->integer('response_status');
            $table->jsonb('response_payload');
            $table->timestampTz('created_at');
            $table->unique(['actor_id', 'operation', 'target_scope', 'key_hash'], 'attempt_command_key_unique');
        });
        Schema::create('attempt_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('attempt_id')->nullable()->constrained('student_attempts')->restrictOnDelete();
            $table->foreignUuid('distribution_id')->constrained('distributions')->restrictOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('event_type', 40);
            $table->text('reason')->nullable();
            $table->jsonb('metadata');
            $table->timestampTz('created_at');
        });
        Schema::create('attempt_grade_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('attempt_id')->constrained('student_attempts')->restrictOnDelete();
            $table->foreignUuid('revision_id');
            $table->foreignUuid('revision_question_id')->constrained('revision_questions')->restrictOnDelete();
            $table->integer('generation')->default(1);
            $table->decimal('awarded_points', 12, 6);
            $table->string('grading_source', 32);
            $table->foreignId('graded_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('feedback')->nullable();
            $table->timestampTz('graded_at');
            $table->unique(['attempt_id', 'revision_question_id', 'generation'], 'attempt_grade_generation_unique');
        });
        Schema::create('assessment_results', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('distribution_id')->constrained('distributions')->restrictOnDelete();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->decimal('aggregate_score', 12, 6)->nullable();
            $table->string('status', 24);
            $table->integer('active_generation')->default(1);
            $table->integer('version')->default(1);
            $table->timestampTz('calculated_at');
            $table->unique(['distribution_id', 'student_id'], 'assessment_result_scope_unique');
        });
        Schema::create('grade_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('attempt_id')->constrained('student_attempts')->restrictOnDelete();
            $table->foreignUuid('revision_question_id')->constrained('revision_questions')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->jsonb('before_state')->nullable();
            $table->jsonb('after_state');
            $table->text('reason')->nullable();
            $table->timestampTz('created_at');
        });
        Schema::create('revision_question_invalidations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('revision_id')->constrained('assessment_revisions')->restrictOnDelete();
            $table->foreignUuid('revision_question_id')->constrained('revision_questions')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->text('reason');
            $table->timestampTz('created_at');
            $table->unique(['revision_id', 'revision_question_id'], 'revision_question_invalidation_unique');
        });
        Schema::create('regrade_runs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('revision_id')->constrained('assessment_revisions')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->integer('target_generation');
            $table->string('status', 24);
            $table->text('reason');
            $table->timestampTz('created_at');
            $table->timestampTz('completed_at')->nullable();
            $table->unique(['revision_id', 'target_generation'], 'regrade_generation_unique');
        });
        Schema::create('result_publications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('distribution_id')->constrained('distributions')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('publication_type', 16);
            $table->integer('generation');
            $table->timestampTz('created_at');
            $table->unique(['distribution_id', 'publication_type'], 'result_publication_scope_unique');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE distributions ADD CONSTRAINT distribution_score_policy_check CHECK (score_policy IS NULL OR score_policy IN ('HIGHEST','LATEST','AVERAGE'))");
            DB::statement("ALTER TABLE distributions ADD CONSTRAINT distribution_score_release_check CHECK (score_release_mode IS NULL OR score_release_mode IN ('AFTER_ATTEMPT_GRADED','AFTER_DISTRIBUTION_ENDED_AND_GRADED','MANUAL'))");
            DB::statement("ALTER TABLE distributions ADD CONSTRAINT distribution_answer_release_check CHECK (answer_release_mode IS NULL OR answer_release_mode IN ('AFTER_DISTRIBUTION_ENDED_WITH_TEACHER_PERMISSION','MANUAL','NEVER'))");
            DB::statement('CREATE UNIQUE INDEX attempt_one_active_idx ON student_attempts (distribution_id, student_id) WHERE status = \'IN_PROGRESS\'');
            DB::statement('CREATE UNIQUE INDEX distribution_revision_scope_idx ON distributions (id, revision_id)');
            DB::statement('ALTER TABLE student_attempts ADD CONSTRAINT attempt_distribution_revision_fk FOREIGN KEY (distribution_id, revision_id) REFERENCES distributions (id, revision_id) ON DELETE RESTRICT');
            DB::statement("ALTER TABLE student_attempts ADD CONSTRAINT attempt_state_check CHECK (attempt_no > 0 AND version > 0 AND expires_at > started_at AND initial_expires_at > started_at AND jsonb_typeof(policy_snapshot) = 'object' AND status IN ('IN_PROGRESS','SUBMITTED','TIMED_OUT','REVOKED','CANCELLED') AND grading_status IN ('NOT_GRADED','PENDING_ESSAY','GRADED','PENDING_REGRADE'))");
            DB::statement('CREATE UNIQUE INDEX revision_question_scope_idx ON revision_questions (id, revision_id)');
            DB::statement('ALTER TABLE attempt_answers ADD CONSTRAINT answer_question_revision_fk FOREIGN KEY (revision_question_id, revision_id) REFERENCES revision_questions (id, revision_id) ON DELETE RESTRICT');
            DB::statement('ALTER TABLE attempt_grade_items ADD CONSTRAINT grade_attempt_revision_fk FOREIGN KEY (attempt_id, revision_id) REFERENCES student_attempts (id, revision_id) ON DELETE RESTRICT');
            DB::statement('ALTER TABLE attempt_grade_items ADD CONSTRAINT grade_question_revision_fk FOREIGN KEY (revision_question_id, revision_id) REFERENCES revision_questions (id, revision_id) ON DELETE RESTRICT');
            DB::statement('ALTER TABLE revision_question_invalidations ADD CONSTRAINT invalidation_question_revision_fk FOREIGN KEY (revision_question_id, revision_id) REFERENCES revision_questions (id, revision_id) ON DELETE RESTRICT');
            DB::statement('ALTER TABLE attempt_answers ADD CONSTRAINT answer_version_check CHECK (version > 0 AND (answer_payload IS NULL OR jsonb_typeof(answer_payload) = \'object\'))');
            DB::statement('ALTER TABLE student_distribution_exceptions ADD CONSTRAINT exception_values_check CHECK (version > 0 AND (time_limit_seconds IS NULL OR time_limit_seconds BETWEEN 60 AND 14400))');
            DB::statement('ALTER TABLE attempt_quota_grants ADD CONSTRAINT quota_positive_check CHECK (additional_attempts > 0)');
            DB::statement("ALTER TABLE assessment_results ADD CONSTRAINT result_status_check CHECK (version > 0 AND active_generation > 0 AND status IN ('PENDING_GRADING','PROVISIONAL','FINAL','PENDING_REGRADE','VOID'))");
            DB::statement('ALTER TABLE attempt_grade_items ADD CONSTRAINT grade_nonnegative_check CHECK (awarded_points >= 0 AND generation > 0)');
            DB::statement("ALTER TABLE attempt_grade_items ADD CONSTRAINT grade_source_check CHECK (grading_source IN ('AUTO','MANUAL','FULL_CREDIT_INVALIDATION'))");
            DB::statement("ALTER TABLE regrade_runs ADD CONSTRAINT regrade_state_check CHECK (target_generation >= 2 AND status IN ('PENDING','RUNNING','READY','COMPLETED','FAILED'))");
            DB::statement("ALTER TABLE result_publications ADD CONSTRAINT result_publication_values_check CHECK (generation > 0 AND publication_type IN ('SCORE','ANSWERS'))");
            DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION attempt_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'attempt history is append-only';
END $$;
CREATE TRIGGER exception_events_append_only BEFORE UPDATE OR DELETE ON student_exception_events FOR EACH ROW EXECUTE FUNCTION attempt_append_only();
CREATE TRIGGER quota_grants_append_only BEFORE UPDATE OR DELETE ON attempt_quota_grants FOR EACH ROW EXECUTE FUNCTION attempt_append_only();
CREATE TRIGGER attempt_commands_append_only BEFORE UPDATE OR DELETE ON attempt_commands FOR EACH ROW EXECUTE FUNCTION attempt_append_only();
CREATE TRIGGER attempt_events_append_only BEFORE UPDATE OR DELETE ON attempt_events FOR EACH ROW EXECUTE FUNCTION attempt_append_only();
CREATE TRIGGER grade_events_append_only BEFORE UPDATE OR DELETE ON grade_events FOR EACH ROW EXECUTE FUNCTION attempt_append_only();
CREATE TRIGGER invalidations_append_only BEFORE UPDATE OR DELETE ON revision_question_invalidations FOR EACH ROW EXECUTE FUNCTION attempt_append_only();
CREATE OR REPLACE FUNCTION distribution_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE batch_teacher bigint; batch_revision uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'distribution history cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.batch_id, NEW.teacher_id, NEW.classroom_id, NEW.revision_id, NEW.opens_at, NEW.deadline_at, NEW.time_limit_seconds, NEW.max_attempts, NEW.deadline_policy, NEW.score_policy, NEW.score_release_mode, NEW.answer_release_mode, NEW.created_at)
      IS DISTINCT FROM (OLD.batch_id, OLD.teacher_id, OLD.classroom_id, OLD.revision_id, OLD.opens_at, OLD.deadline_at, OLD.time_limit_seconds, OLD.max_attempts, OLD.deadline_policy, OLD.score_policy, OLD.score_release_mode, OLD.answer_release_mode, OLD.created_at)
      THEN RAISE EXCEPTION 'distribution configuration is immutable'; END IF;
    IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'distribution version must increment'; END IF;
    IF NOT ((OLD.lifecycle_status = 'active' AND NEW.lifecycle_status IN ('closed','cancelled')) OR (OLD.lifecycle_status = 'closed' AND NEW.lifecycle_status = 'cancelled'))
      THEN RAISE EXCEPTION 'invalid distribution lifecycle transition'; END IF;
    RETURN NEW;
  END IF;
  SELECT teacher_id, revision_id INTO batch_teacher, batch_revision FROM distribution_batches WHERE id = NEW.batch_id;
  IF NEW.teacher_id <> batch_teacher OR NEW.revision_id <> batch_revision THEN RAISE EXCEPTION 'distribution batch identity mismatch'; END IF;
  RETURN NEW;
END $$;
SQL);
        }
    }

    public function down(): void
    {
        foreach (['result_publications','regrade_runs','revision_question_invalidations','grade_events','assessment_results','attempt_grade_items','attempt_events','attempt_commands','attempt_answers','student_attempts','attempt_quota_grants','student_exception_events','student_distribution_exceptions'] as $name) {
            Schema::dropIfExists($name);
        }
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS revision_question_scope_idx');
            DB::statement('DROP FUNCTION IF EXISTS attempt_append_only()');
        }
        Schema::table('distributions', fn (Blueprint $table) => $table->dropColumn(['score_policy','score_release_mode','answer_release_mode']));
        if (DB::getDriverName() === 'pgsql') DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION distribution_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE batch_teacher bigint; batch_revision uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'distribution history cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.batch_id, NEW.teacher_id, NEW.classroom_id, NEW.revision_id, NEW.opens_at, NEW.deadline_at, NEW.time_limit_seconds, NEW.max_attempts, NEW.deadline_policy, NEW.created_at)
      IS DISTINCT FROM (OLD.batch_id, OLD.teacher_id, OLD.classroom_id, OLD.revision_id, OLD.opens_at, OLD.deadline_at, OLD.time_limit_seconds, OLD.max_attempts, OLD.deadline_policy, OLD.created_at)
      THEN RAISE EXCEPTION 'distribution configuration is immutable'; END IF;
    IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'distribution version must increment'; END IF;
    IF NOT ((OLD.lifecycle_status = 'active' AND NEW.lifecycle_status IN ('closed','cancelled')) OR (OLD.lifecycle_status = 'closed' AND NEW.lifecycle_status = 'cancelled'))
      THEN RAISE EXCEPTION 'invalid distribution lifecycle transition'; END IF;
    RETURN NEW;
  END IF;
  SELECT teacher_id, revision_id INTO batch_teacher, batch_revision FROM distribution_batches WHERE id = NEW.batch_id;
  IF NEW.teacher_id <> batch_teacher OR NEW.revision_id <> batch_revision THEN RAISE EXCEPTION 'distribution batch identity mismatch'; END IF;
  RETURN NEW;
END $$;
SQL);
    }
};
