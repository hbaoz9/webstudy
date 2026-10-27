<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TeacherProfile extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = ['user_id'];

    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function classrooms(): HasMany
    {
        return $this->hasMany(Classroom::class, 'teacher_id', 'user_id');
    }

    public function verificationSubmissions(): HasMany
    {
        return $this->hasMany(TeacherVerificationSubmission::class, 'teacher_id', 'user_id');
    }
}
