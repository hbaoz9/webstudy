<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Classroom extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'academic_year',
        'code',
        'description',
        'cover_image_path',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(TeacherProfile::class, 'teacher_id', 'user_id');
    }

    public function rosterEntries(): HasMany
    {
        return $this->hasMany(ClassRosterEntry::class);
    }

    public function joinRequests(): HasMany
    {
        return $this->hasMany(ClassJoinRequest::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ClassMembership::class);
    }
}
