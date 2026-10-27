<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public function teacherProfile(): HasOne
    {
        return $this->hasOne(
            TeacherProfile::class,
            'user_id'
        );
    }

    public function classJoinRequests(): HasMany
    {
        return $this->hasMany(ClassJoinRequest::class, 'student_id');
    }

    public function classMemberships(): HasMany
    {
        return $this->hasMany(ClassMembership::class, 'student_id');
    }

    public function linkedRosterEntries(): HasMany
    {
        return $this->hasMany(ClassRosterEntry::class, 'linked_user_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
