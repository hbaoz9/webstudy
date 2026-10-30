<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PublishTeacherLessonRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'classroomIds' => ['required', 'array', 'min:1', 'max:100'],
            'classroomIds.*' => ['required', 'uuid', 'distinct'],
        ];
    }
}
