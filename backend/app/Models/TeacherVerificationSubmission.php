<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeacherVerificationSubmission extends Model
{
    protected $fillable = ['full_name', 'school_name', 'school_address', 'teacher_code', 'position', 'document_name', 'document_type', 'document_size', 'document_path'];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime'];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(TeacherProfile::class, 'teacher_id', 'user_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
