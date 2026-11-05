<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeleteQuestionBankQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'teacher';
    }

    public function rules(): array
    {
        return ['expectedVersion' => ['required', 'integer', 'min:1']];
    }

    public function after(): array
    {
        return [function ($validator): void {
            foreach (array_diff(array_keys($this->all()), ['expectedVersion']) as $key) {
                $validator->errors()->add($key, 'Unknown delete field.');
            }
        }];
    }
}
