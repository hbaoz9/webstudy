<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('interactive_videos', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('teacher_id')->constrained('teacher_profiles', 'user_id')->restrictOnDelete();
            $table->string('curriculum_lesson_id', 32)->nullable();
            $table->foreign('curriculum_lesson_id')->references('id')->on('curriculum_lessons')->restrictOnDelete();
            $table->string('title', 300);
            $table->string('youtube_id', 11);
            $table->jsonb('draft_checkpoints');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('created_at')->nullable(false);
            $table->timestampTz('updated_at')->nullable(false);
            $table->timestampTz('deleted_at')->nullable();
            $table->index(['teacher_id', 'deleted_at', 'created_at'], 'interactive_videos_teacher_index');
        });
        Schema::create('interactive_video_publications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('video_id')->constrained('interactive_videos')->restrictOnDelete();
            $table->foreignUuid('classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->jsonb('snapshot');
            $table->timestampTz('published_at')->nullable(false);
            $table->timestampTz('withdrawn_at')->nullable();
            $table->unique(['video_id', 'classroom_id'], 'interactive_video_class_unique');
            $table->index(['classroom_id', 'withdrawn_at', 'published_at'], 'interactive_video_class_index');
        });
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE interactive_videos ADD CONSTRAINT interactive_videos_version_check CHECK (version >= 1)");
            DB::statement("ALTER TABLE interactive_videos ADD CONSTRAINT interactive_videos_checkpoints_object CHECK (jsonb_typeof(draft_checkpoints) = 'array')");
            DB::statement("ALTER TABLE interactive_video_publications ADD CONSTRAINT interactive_video_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object')");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('interactive_video_publications');
        Schema::dropIfExists('interactive_videos');
    }
};
