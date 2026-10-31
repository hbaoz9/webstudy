<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('class_join_requests', function (Blueprint $table): void {
            $table->string('student_code', 64)->nullable()->change();
            $table->string('declared_class')->nullable()->change();
        });

        if (DB::getDriverName() === 'sqlite') {
            // SQLite table rebuilds for change() can lose the partial-index predicate.
            DB::statement('DROP INDEX IF EXISTS join_request_pending_student_unique');
            DB::statement("CREATE UNIQUE INDEX join_request_pending_student_unique ON class_join_requests (classroom_id, student_id) WHERE status = 'pending'");
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE class_join_requests DROP CONSTRAINT join_request_required_data');
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_required_data CHECK (btrim(student_name) <> '' AND btrim(email) <> '' AND (student_code IS NULL OR btrim(student_code) <> '') AND (declared_class IS NULL OR btrim(declared_class) <> ''))");
            DB::statement('ALTER TABLE class_join_requests DROP CONSTRAINT join_request_manual_data_valid');
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_manual_data_valid CHECK (verification_status <> 'manual_verified' OR (manual_roster_entry_id IS NOT NULL AND manual_verification_reason IS NOT NULL AND manual_verification_note IS NOT NULL AND manually_verified_at IS NOT NULL))");
            DB::statement('ALTER TABLE class_join_requests DROP CONSTRAINT join_request_manual_reason_allowed');
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_manual_reason_allowed CHECK (manual_verification_reason IS NULL OR manual_verification_reason IN ('wrong_student_code', 'student_code_unknown', 'wrong_declared_class', 'account_name_difference', 'other'))");
        }
    }

    public function down(): void
    {
        // Historical requests without these fields cannot be restored to the old schema safely.
        if (DB::table('class_join_requests')->whereNull('student_code')->orWhereNull('declared_class')
            ->orWhere('manual_verification_reason', 'student_code_unknown')->exists()) {
            throw new RuntimeException('Cannot roll back join request fields while new-format requests exist.');
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE class_join_requests DROP CONSTRAINT join_request_manual_reason_allowed');
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_manual_reason_allowed CHECK (manual_verification_reason IS NULL OR manual_verification_reason IN ('wrong_student_code', 'wrong_declared_class', 'account_name_difference', 'other'))");
            DB::statement('ALTER TABLE class_join_requests DROP CONSTRAINT join_request_manual_data_valid');
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_manual_data_valid CHECK (verification_status <> 'manual_verified' OR (manual_roster_entry_id IS NOT NULL AND original_student_code IS NOT NULL AND manual_verification_reason IS NOT NULL AND manual_verification_note IS NOT NULL AND manually_verified_at IS NOT NULL))");
            DB::statement('ALTER TABLE class_join_requests DROP CONSTRAINT join_request_required_data');
            DB::statement("ALTER TABLE class_join_requests ADD CONSTRAINT join_request_required_data CHECK (btrim(student_name) <> '' AND btrim(email) <> '' AND btrim(student_code) <> '' AND btrim(declared_class) <> '')");
        }

        Schema::table('class_join_requests', function (Blueprint $table): void {
            $table->string('student_code', 64)->nullable(false)->change();
            $table->string('declared_class')->nullable(false)->change();
        });

        if (DB::getDriverName() === 'sqlite') {
            DB::statement('DROP INDEX IF EXISTS join_request_pending_student_unique');
            DB::statement("CREATE UNIQUE INDEX join_request_pending_student_unique ON class_join_requests (classroom_id, student_id) WHERE status = 'pending'");
        }
    }
};
