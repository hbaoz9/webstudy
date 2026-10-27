<?php

namespace App\Policies;

use App\Models\TeacherVerificationSubmission;
use App\Models\User;

class TeacherVerificationSubmissionPolicy
{
    public function view(User $user, TeacherVerificationSubmission $submission): bool
    {
        return $user->role === 'admin' || ($user->role === 'teacher' && $user->id === $submission->teacher_id);
    }

    public function review(User $user, TeacherVerificationSubmission $submission): bool
    {
        return $user->role === 'admin';
    }
}
