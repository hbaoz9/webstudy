<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class QuestionBankQuestion extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'curriculum_lesson_id', 'type', 'difficulty', 'public_content',
        'answer_key', 'rubric', 'explanation', 'show_in_lesson',
    ];

    protected $hidden = ['teacher_id', 'answer_key', 'rubric'];

    protected function casts(): array
    {
        return [
            'public_content' => 'array',
            'answer_key' => 'array',
            'rubric' => 'array',
            'show_in_lesson' => 'boolean',
            'version' => 'integer',
        ];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(TeacherProfile::class, 'teacher_id', 'user_id');
    }

    public function curriculumLesson(): BelongsTo
    {
        return $this->belongsTo(CurriculumLesson::class, 'curriculum_lesson_id');
    }
}
