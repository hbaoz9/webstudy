<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class JoinClassroomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'student';
    }

    public function rules(): array
    {
        return [
            'class_code' => ['required', 'string', 'max:32'],
            'student_code' => ['nullable', 'string', 'max:64'],
            'declared_class' => ['nullable', 'string', 'max:255'],
        ];
    }
}
