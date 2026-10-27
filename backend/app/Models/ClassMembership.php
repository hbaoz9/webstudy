<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassMembership extends Model
{
    use HasUuids;

    protected $fillable = ['roster_entry_id', 'join_request_id', 'joined_at'];

    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
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

    public function rosterEntry(): BelongsTo
    {
        return $this->belongsTo(ClassRosterEntry::class, 'roster_entry_id');
    }

    public function joinRequest(): BelongsTo
    {
        return $this->belongsTo(ClassJoinRequest::class, 'join_request_id');
    }
}
