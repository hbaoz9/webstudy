<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssessmentRevision extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array { return ['version' => 'integer', 'revision_no' => 'integer', 'published_at' => 'datetime']; }

    public function assessment(): BelongsTo { return $this->belongsTo(Assessment::class); }
    public function questions(): HasMany { return $this->hasMany(RevisionQuestion::class, 'revision_id')->orderBy('position'); }
}
