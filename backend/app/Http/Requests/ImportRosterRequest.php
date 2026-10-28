<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ImportRosterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'teacher';
    }

    public function rules(): array
    {
        return [
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.orderNumber' => ['required', 'integer', 'min:1'],
            'rows.*.fullName' => ['required', 'string', 'max:255'],
            'rows.*.studentCode' => ['required', 'string', 'max:64'],
        ];
    }
}
