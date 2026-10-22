<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CurriculumLesson extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'chapter_id',
        'number',
        'title',
    ];

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(
            CurriculumChapter::class,
            'chapter_id'
        );
    }
}
