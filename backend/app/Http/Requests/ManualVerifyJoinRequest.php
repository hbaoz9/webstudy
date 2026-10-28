<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ManualVerifyJoinRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'teacher';
    }

    public function rules(): array
    {
        return [
            'roster_entry_id' => ['required', 'uuid'],
            'reason' => ['required', 'in:wrong_student_code,wrong_declared_class,account_name_difference,other'],
            'note' => ['required', 'string', 'max:2000'],
        ];
    }
}
