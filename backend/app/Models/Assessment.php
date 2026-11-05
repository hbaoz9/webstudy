<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Assessment extends Model
{
    use HasUuids, SoftDeletes;

    protected $guarded = [];

    protected function casts(): array { return ['version' => 'integer']; }

    public function teacher(): BelongsTo { return $this->belongsTo(TeacherProfile::class, 'teacher_id', 'user_id'); }
    public function revisions(): HasMany { return $this->hasMany(AssessmentRevision::class); }
}
