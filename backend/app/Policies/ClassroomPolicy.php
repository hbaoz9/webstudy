<?php

namespace App\Policies;

use App\Models\Classroom;
use App\Models\User;

class ClassroomPolicy
{
    public function manage(User $user, Classroom $classroom): bool
    {
        return $user->role === 'teacher' && (int) $classroom->teacher_id === (int) $user->id;
    }

    public function view(User $user, Classroom $classroom): bool
    {
        return $this->manage($user, $classroom)
            || ($user->role === 'student' && $classroom->memberships()
                ->where('student_id', $user->id)->where('status', 'active')->exists());
    }
}
