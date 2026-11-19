<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Distribution extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'version' => 'integer', 'time_limit_seconds' => 'integer', 'max_attempts' => 'integer',
            'opens_at' => 'datetime', 'deadline_at' => 'datetime', 'closed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function classroom(): BelongsTo { return $this->belongsTo(Classroom::class); }
    public function revision(): BelongsTo { return $this->belongsTo(AssessmentRevision::class, 'revision_id'); }
    public function events(): HasMany { return $this->hasMany(DistributionEvent::class)->orderBy('created_at'); }
}
