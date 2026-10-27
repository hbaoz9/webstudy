<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitTeacherVerificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'teacher';
    }

    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:255'],
            'school_name' => ['required', 'string', 'max:255'],
            'school_address' => ['required', 'string', 'max:255'],
            'teacher_code' => ['nullable', 'string', 'max:255'],
            'position' => ['required', 'string', 'max:255'],
            'document' => ['required', 'array:name,type,size'],
            'document.name' => ['required', 'string', 'max:255'],
            'document.type' => ['required', 'string', 'max:100'],
            'document.size' => ['required', 'integer', 'min:1', 'max:10485760'],
        ];
    }
}
