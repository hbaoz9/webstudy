<?php

namespace App\Policies;

use App\Models\QuestionBankQuestion;
use App\Models\User;

class QuestionBankQuestionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === 'teacher';
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function view(User $user, QuestionBankQuestion $question): bool
    {
        return $this->viewAny($user) && (int) $question->teacher_id === (int) $user->id;
    }

    public function update(User $user, QuestionBankQuestion $question): bool
    {
        return $this->view($user, $question);
    }

    public function delete(User $user, QuestionBankQuestion $question): bool
    {
        return $this->view($user, $question);
    }
}
