<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_roster_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->unsignedInteger('order_number');
            $table->string('full_name');
            $table->string('student_code', 64);
            $table->foreignId('linked_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('status', 20)->default('not_joined');
            $table->timestampsTz();

            $table->unique(['classroom_id', 'student_code'], 'roster_class_code_unique');
            $table->unique(['id', 'classroom_id'], 'roster_id_class_unique');
            $table->unique('linked_user_id');
            $table->index(['classroom_id', 'order_number']);
        });

        Schema::create('class_join_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->string('student_name');
            $table->string('email');
            $table->string('student_code', 64);
            $table->string('declared_class');
            $table->string('verification_status', 20)->default('unverified');
            $table->string('status', 20)->default('pending');
            $table->foreignUuid('manual_roster_entry_id')->nullable();
            $table->string('original_student_code', 64)->nullable();
            $table->string('manual_verification_reason', 40)->nullable();
            $table->text('manual_verification_note')->nullable();
            $table->timestampTz('manually_verified_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('teacher_profiles', 'user_id')->restrictOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->timestampsTz();

            $table->unique(['id', 'classroom_id', 'student_id'], 'join_request_identity_unique');
            $table->index(['classroom_id', 'status', 'created_at']);
            $table->index(['student_id', 'created_at']);
            $table->foreign(['manual_roster_entry_id', 'classroom_id'], 'join_request_manual_roster_fk')
                ->references(['id', 'classroom_id'])->on('class_roster_entries')->restrictOnDelete();
        });

        Schema::create('class_memberships', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->foreignId('student_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('roster_entry_id');
            $table->foreignUuid('join_request_id')->unique();
            $table->string('status', 20)->default('active');
            $table->timestampTz('joined_at');
            $table->timestampTz('left_at')->nullable();
            $table->timestampsTz();

            $table->index(['classroom_id', 'status']);
            $table->index(['student_id', 'joined_at']);
            $table->foreign(['roster_entry_id', 'classroom_id'], 'membership_roster_class_fk')
                ->references(['id', 'classroom_id'])->on('class_roster_entries')->restrictOnDelete();
            $table->foreign(['join_request_id', 'classroom_id', 'student_id'], 'membership_request_identity_fk')
                ->references(['id', 'classroom_id', 'student_id'])->on('class_join_requests')->restrictOnDelete();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE classrooms ADD CONSTRAINT classrooms_required_text CHECK (btrim(name) <> '' AND btrim(academic_year) <> '' AND btrim(code) <> '')");
            DB::statement("ALTER TABLE class_roster_entries ADD CONSTRAINT roster_status_allowed CHECK (status IN ('not_joined', 'joined', 'conflict'))");
            DB::statement("ALTER TABLE class_roster_entries ADD CONSTRAINT roster_link_status_valid CHECK ((status = 'joined') = (linked_user_id IS NOT NULL))");
            DB::statement("ALTER TABLE class_roster_entries ADD CONSTRAINT roster_required_data CHECK (order_number > 0 AND btrim(full_name) <> '' AND btrim(student_code) <> '')");
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_status_allowed CHECK (status IN ('pending', 'approved', 'rejected'))");
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_verification_allowed CHECK (verification_status IN ('matched', 'unverified', 'mismatch', 'conflict', 'manual_verified'))");
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_manual_reason_allowed CHECK (manual_verification_reason IS NULL OR manual_verification_reason IN ('wrong_student_code', 'wrong_declared_class', 'account_name_difference', 'other'))");
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_required_data CHECK (btrim(student_name) <> '' AND btrim(email) <> '' AND btrim(student_code) <> '' AND btrim(declared_class) <> '')");
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_approval_valid CHECK (status <> 'approved' OR verification_status IN ('matched', 'manual_verified'))");
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_manual_data_valid CHECK (verification_status <> 'manual_verified' OR (manual_roster_entry_id IS NOT NULL AND original_student_code IS NOT NULL AND manual_verification_reason IS NOT NULL AND manual_verification_note IS NOT NULL AND manually_verified_at IS NOT NULL))");
            DB::statement("ALTER TABLE class_memberships ADD CONSTRAINT membership_status_dates_valid CHECK ((status = 'active' AND left_at IS NULL) OR (status = 'left' AND left_at IS NOT NULL AND left_at >= joined_at))");
            DB::statement("CREATE UNIQUE INDEX roster_normalized_code_unique ON class_roster_entries (classroom_id, upper(regexp_replace(student_code, '[[:space:]]+', '', 'g')))");
            DB::statement("CREATE UNIQUE INDEX join_request_pending_student_unique ON class_join_requests (classroom_id, student_id) WHERE status = 'pending'");
            DB::statement("CREATE UNIQUE INDEX join_request_pending_code_unique ON class_join_requests (classroom_id, upper(regexp_replace(student_code, '[[:space:]]+', '', 'g'))) WHERE status = 'pending'");
        } elseif (DB::getDriverName() === 'sqlite') {
            DB::statement("CREATE UNIQUE INDEX join_request_pending_student_unique ON class_join_requests (classroom_id, student_id) WHERE status = 'pending'");
        }

        if (in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            DB::statement("CREATE UNIQUE INDEX membership_one_active_student_unique ON class_memberships (student_id) WHERE status = 'active'");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('class_memberships');
        Schema::dropIfExists('class_join_requests');
        Schema::dropIfExists('class_roster_entries');
    }
};
