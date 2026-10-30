<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TeacherLessonContent extends Model
{
    protected $fillable = ['teacher_id', 'curriculum_lesson_id', 'draft_content', 'published_content', 'published_at'];

    protected function casts(): array
    {
        return ['draft_content' => 'array', 'published_content' => 'array', 'published_at' => 'datetime'];
    }

    public function curriculumLesson(): BelongsTo
    {
        return $this->belongsTo(CurriculumLesson::class, 'curriculum_lesson_id');
    }

    public function classrooms(): BelongsToMany
    {
        return $this->belongsToMany(Classroom::class, 'teacher_lesson_classrooms');
    }
}
