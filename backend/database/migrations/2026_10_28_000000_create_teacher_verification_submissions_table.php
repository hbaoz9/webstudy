<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_verification_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teacher_profiles', 'user_id')->restrictOnDelete();
            $table->string('full_name');
            $table->string('school_name');
            $table->string('school_address');
            $table->string('teacher_code')->nullable();
            $table->string('position');
            $table->string('document_name');
            $table->string('document_type', 100);
            $table->unsignedBigInteger('document_size');
            $table->string('status', 20)->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->timestampTz('reviewed_at')->nullable();
            $table->timestampsTz();
            $table->index(['teacher_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE teacher_verification_submissions ADD CONSTRAINT teacher_submission_status_allowed CHECK (status IN ('pending', 'verified', 'rejected'))");
            DB::statement("ALTER TABLE teacher_verification_submissions ADD CONSTRAINT teacher_submission_review_valid CHECK ((status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND rejection_reason IS NULL) OR (status = 'verified' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND rejection_reason IS NULL) OR (status = 'rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND btrim(rejection_reason) <> ''))");
            DB::statement("CREATE UNIQUE INDEX teacher_submission_one_pending_unique ON teacher_verification_submissions (teacher_id) WHERE status = 'pending'");
        } elseif (DB::getDriverName() === 'sqlite') {
            DB::statement("CREATE UNIQUE INDEX teacher_submission_one_pending_unique ON teacher_verification_submissions (teacher_id) WHERE status = 'pending'");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_verification_submissions');
    }
};
