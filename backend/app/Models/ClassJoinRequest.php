<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ClassJoinRequest extends Model
{
    use HasUuids;

    protected $fillable = ['student_name', 'email', 'student_code', 'declared_class'];

    protected function casts(): array
    {
        return [
            'manually_verified_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function manualRosterEntry(): BelongsTo
    {
        return $this->belongsTo(ClassRosterEntry::class, 'manual_roster_entry_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(TeacherProfile::class, 'reviewed_by', 'user_id');
    }

    public function membership(): HasOne
    {
        return $this->hasOne(ClassMembership::class, 'join_request_id');
    }
}
