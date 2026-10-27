<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassRosterEntry extends Model
{
    use HasUuids;

    protected $fillable = ['order_number', 'full_name', 'student_code'];

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function linkedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'linked_user_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ClassMembership::class, 'roster_entry_id');
    }

    public function manualJoinRequests(): HasMany
    {
        return $this->hasMany(ClassJoinRequest::class, 'manual_roster_entry_id');
    }
}
