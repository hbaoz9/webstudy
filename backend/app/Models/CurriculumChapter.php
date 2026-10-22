<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CurriculumChapter extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'part_id',
        'number',
        'title',
    ];

    public function part(): BelongsTo
    {
        return $this->belongsTo(
            CurriculumPart::class,
            'part_id'
        );
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(
            CurriculumLesson::class,
            'chapter_id'
        );
    }
}
