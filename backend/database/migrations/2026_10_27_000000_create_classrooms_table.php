<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('classrooms', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('teacher_id')
                ->constrained('teacher_profiles', 'user_id')
                ->restrictOnDelete();
            $table->string('name');
            $table->string('academic_year', 20);
            $table->string('code', 20)->unique();
            $table->text('description')->nullable();
            $table->string('cover_image_path')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestampsTz();

            $table->index(['teacher_id', 'status']);
            $table->unique(['teacher_id', 'academic_year', 'name']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE classrooms ADD CONSTRAINT classrooms_status_allowed CHECK (status IN ('active', 'archived'))");
            DB::statement('CREATE UNIQUE INDEX classrooms_code_lower_unique ON classrooms (lower(code))');
            DB::statement('CREATE UNIQUE INDEX classrooms_teacher_year_name_lower_unique ON classrooms (teacher_id, academic_year, lower(btrim(name)))');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('classrooms');
    }
};
