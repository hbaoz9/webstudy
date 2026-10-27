<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReviewTeacherVerificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return ['reason' => [$this->routeIs('admin.teacher-verifications.reject') ? 'required' : 'prohibited', 'string', 'max:2000']];
    }
}
