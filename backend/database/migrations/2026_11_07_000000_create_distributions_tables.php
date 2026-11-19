<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('distribution_batches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('teacher_id')->constrained('teacher_profiles', 'user_id')->restrictOnDelete();
            $table->foreignUuid('revision_id')->constrained('assessment_revisions')->restrictOnDelete();
            $table->char('idempotency_key_hash', 64);
            $table->char('request_hash', 64);
            $table->timestampTz('created_at')->nullable(false);
            $table->unique(['teacher_id', 'idempotency_key_hash'], 'distribution_batch_key_unique');
        });

        Schema::create('distributions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('batch_id')->constrained('distribution_batches')->restrictOnDelete();
            $table->foreignId('teacher_id')->constrained('teacher_profiles', 'user_id')->restrictOnDelete();
            $table->foreignUuid('classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->foreignUuid('revision_id')->constrained('assessment_revisions')->restrictOnDelete();
            $table->timestampTz('opens_at');
            $table->timestampTz('deadline_at');
            $table->integer('time_limit_seconds');
            $table->integer('max_attempts');
            $table->string('deadline_policy', 32);
            $table->string('lifecycle_status', 20)->default('active');
            $table->integer('version')->default(1);
            $table->timestampTz('closed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampTz('created_at')->nullable(false);
            $table->timestampTz('updated_at')->nullable(false);
            $table->unique(['batch_id', 'classroom_id'], 'distribution_batch_class_unique');
            if (DB::getDriverName() !== 'pgsql') {
                $table->index(['teacher_id', 'created_at', 'id'], 'distribution_teacher_created_idx');
            }
            $table->index(['classroom_id', 'opens_at', 'deadline_at'], 'distribution_class_schedule_idx');
            $table->index('revision_id');
            $table->index(['lifecycle_status', 'deadline_at'], 'distribution_status_deadline_idx');
        });

        Schema::create('distribution_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('distribution_id')->constrained('distributions')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('event_type', 24);
            $table->text('reason')->nullable();
            $table->jsonb('metadata');
            $table->timestampTz('created_at')->nullable(false);
            $table->unique(['distribution_id', 'event_type'], 'distribution_event_once_unique');
        });

        Schema::create('distribution_commands', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('distribution_id')->constrained('distributions')->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('operation', 16);
            $table->char('idempotency_key_hash', 64);
            $table->char('request_hash', 64);
            $table->foreignUuid('event_id')->nullable()->constrained('distribution_events')->restrictOnDelete();
            $table->string('result_code', 32);
            $table->timestampTz('created_at')->nullable(false);
            $table->unique(['actor_id', 'operation', 'idempotency_key_hash'], 'distribution_command_key_unique');
        });

        Schema::create('student_notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('distribution_id')->constrained('distributions')->restrictOnDelete();
            $table->foreignUuid('event_id')->constrained('distribution_events')->restrictOnDelete();
            $table->string('type', 32);
            $table->text('title');
            $table->text('body');
            $table->timestampTz('created_at')->nullable(false);
            $table->timestampTz('read_at')->nullable();
            $table->unique(['event_id', 'student_id'], 'student_notification_event_unique');
            $table->index(['student_id', 'read_at', 'created_at', 'id'], 'student_notification_inbox_idx');
        });

        if (DB::getDriverName() !== 'pgsql') return;

        DB::statement('CREATE INDEX distribution_teacher_created_idx ON distributions (teacher_id, created_at DESC, id ASC)');
        DB::statement("ALTER TABLE distributions ADD CONSTRAINT distributions_values_check CHECK (deadline_at > opens_at AND time_limit_seconds > 0 AND max_attempts >= 1 AND version >= 1 AND deadline_policy IN ('HARD_DEADLINE','FINISH_STARTED_ATTEMPT'))");
        DB::statement("ALTER TABLE distributions ADD CONSTRAINT distributions_lifecycle_check CHECK ((lifecycle_status = 'active' AND closed_at IS NULL AND cancelled_at IS NULL) OR (lifecycle_status = 'closed' AND closed_at IS NOT NULL AND cancelled_at IS NULL) OR (lifecycle_status = 'cancelled' AND cancelled_at IS NOT NULL))");
        DB::statement("ALTER TABLE distribution_events ADD CONSTRAINT distribution_event_values_check CHECK (event_type IN ('created','closed','cancelled') AND jsonb_typeof(metadata) = 'object' AND (event_type <> 'cancelled' OR length(btrim(reason)) > 0))");
        DB::statement("ALTER TABLE distribution_commands ADD CONSTRAINT distribution_command_values_check CHECK (operation IN ('close','cancel') AND result_code = 'success')");
        DB::statement("ALTER TABLE student_notifications ADD CONSTRAINT student_notification_type_check CHECK (type = 'distribution_cancelled')");
        DB::unprepared(<<<'SQL'
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
CREATE TRIGGER distribution_guard_write BEFORE INSERT OR UPDATE OR DELETE ON distributions FOR EACH ROW EXECUTE FUNCTION distribution_guard();
CREATE OR REPLACE FUNCTION distribution_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'distribution audit history is append-only';
END $$;
CREATE TRIGGER distribution_event_append_only BEFORE UPDATE OR DELETE ON distribution_events FOR EACH ROW EXECUTE FUNCTION distribution_append_only();
CREATE TRIGGER distribution_batch_append_only BEFORE UPDATE OR DELETE ON distribution_batches FOR EACH ROW EXECUTE FUNCTION distribution_append_only();
CREATE TRIGGER distribution_command_append_only BEFORE UPDATE OR DELETE ON distribution_commands FOR EACH ROW EXECUTE FUNCTION distribution_append_only();
CREATE TRIGGER distribution_notification_no_delete BEFORE DELETE ON student_notifications FOR EACH ROW EXECUTE FUNCTION distribution_append_only();
CREATE OR REPLACE FUNCTION distribution_notification_read_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.student_id, NEW.distribution_id, NEW.event_id, NEW.type, NEW.title, NEW.body, NEW.created_at)
      IS DISTINCT FROM (OLD.id, OLD.student_id, OLD.distribution_id, OLD.event_id, OLD.type, OLD.title, OLD.body, OLD.created_at)
    THEN RAISE EXCEPTION 'notification content is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER distribution_notification_read_only BEFORE UPDATE ON student_notifications FOR EACH ROW EXECUTE FUNCTION distribution_notification_read_guard();
SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('student_notifications');
        Schema::dropIfExists('distribution_commands');
        Schema::dropIfExists('distribution_events');
        Schema::dropIfExists('distributions');
        Schema::dropIfExists('distribution_batches');
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP FUNCTION IF EXISTS distribution_notification_read_guard()');
            DB::statement('DROP FUNCTION IF EXISTS distribution_append_only()');
            DB::statement('DROP FUNCTION IF EXISTS distribution_guard()');
        }
    }
};
