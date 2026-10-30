<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_lesson_contents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teacher_profiles', 'user_id')->restrictOnDelete();
            $table->string('curriculum_lesson_id', 32);
            $table->foreign('curriculum_lesson_id')->references('id')->on('curriculum_lessons')->restrictOnDelete();
            $table->json('draft_content')->nullable();
            $table->json('published_content')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();
            $table->unique(['teacher_id', 'curriculum_lesson_id'], 'teacher_lesson_unique');
        });

        Schema::create('teacher_lesson_classrooms', function (Blueprint $table) {
            $table->foreignId('teacher_lesson_content_id')->constrained('teacher_lesson_contents')->cascadeOnDelete();
            $table->foreignUuid('classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->primary(['teacher_lesson_content_id', 'classroom_id'], 'teacher_lesson_classroom_pk');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_lesson_classrooms');
        Schema::dropIfExists('teacher_lesson_contents');
    }
};
