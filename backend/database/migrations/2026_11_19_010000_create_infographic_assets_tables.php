<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('infographic_assets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('teacher_id')->constrained('teacher_profiles', 'user_id')->restrictOnDelete();
            $table->string('curriculum_chapter_id', 32);
            $table->foreign('curriculum_chapter_id')->references('id')->on('curriculum_chapters')->restrictOnDelete();
            $table->string('curriculum_lesson_id', 32)->nullable();
            $table->foreign('curriculum_lesson_id')->references('id')->on('curriculum_lessons')->restrictOnDelete();
            $table->string('title', 200);
            $table->string('storage_path', 300)->unique();
            $table->string('mime_type', 32);
            $table->unsignedBigInteger('byte_size');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('created_at')->nullable(false);
            $table->timestampTz('updated_at')->nullable(false);
            $table->timestampTz('deleted_at')->nullable();
            $table->index(['teacher_id', 'deleted_at', 'curriculum_chapter_id'], 'infographic_assets_teacher_chapter_index');
        });
        Schema::create('infographic_asset_publications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('asset_id')->constrained('infographic_assets')->restrictOnDelete();
            $table->foreignUuid('classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->timestampTz('published_at')->nullable(false);
            $table->timestampTz('withdrawn_at')->nullable();
            $table->unique(['asset_id', 'classroom_id']);
            $table->index(['classroom_id', 'withdrawn_at', 'published_at'], 'infographic_publication_class_index');
        });
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE infographic_assets ADD CONSTRAINT infographic_assets_version_check CHECK (version >= 1)');
            DB::statement("ALTER TABLE infographic_assets ADD CONSTRAINT infographic_assets_mime_check CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp'))");
            DB::statement('ALTER TABLE infographic_assets ADD CONSTRAINT infographic_assets_size_check CHECK (byte_size > 0 AND byte_size <= 15728640)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('infographic_asset_publications');
        Schema::dropIfExists('infographic_assets');
    }
};
