<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CurriculumPart extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'number',
        'title',
    ];

    public function chapters(): HasMany
    {
        return $this->hasMany(
            CurriculumChapter::class,
            'part_id'
        );
    }
}
