<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SaveTeacherLessonDraftRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'content' => ['required', 'array:lessonId,objectives,keyPoints,explanation,explanationFormat,sections,status,updatedAt,diagramLayout,diagramDisplay'],
            'content.lessonId' => ['sometimes', 'string', 'max:32'],
            'content.objectives' => ['present', 'array', 'max:100'],
            'content.objectives.*' => ['string', 'max:2000'],
            'content.keyPoints' => ['present', 'array', 'max:100'],
            'content.keyPoints.*' => ['string', 'max:2000'],
            'content.explanation' => ['present', 'nullable', 'string', 'max:200000'],
            'content.explanationFormat' => ['sometimes', 'in:markdown'],
            'content.sections' => ['sometimes', 'array', 'max:100'],
            'content.sections.*' => ['array:id,title,content,contentFormat,keyPoints,imageUrl,imageCaption,imageMode,dragImageActivity,videoUrl'],
            'content.sections.*.id' => ['required', 'string', 'max:100'],
            'content.sections.*.title' => ['present', 'nullable', 'string', 'max:500'],
            'content.sections.*.content' => ['present', 'nullable', 'string', 'max:200000'],
            'content.sections.*.keyPoints' => ['present', 'array', 'max:100'],
            'content.sections.*.keyPoints.*' => ['string', 'max:2000'],
            'content.sections.*.imageUrl' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'content.sections.*.videoUrl' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'content.sections.*.imageMode' => ['sometimes', 'in:static,drag_drop'],
            'content.diagramLayout' => ['sometimes', 'in:mindMap,logicalStructure,organizationStructure'],
            'content.diagramDisplay' => ['sometimes', 'array:source,infographicId'],
            'content.diagramDisplay.source' => ['required_with:content.diagramDisplay', 'in:auto,uploaded'],
            'content.status' => ['sometimes', 'in:draft'],
            'content.draft' => ['prohibited'],
            'content.updatedAt' => ['sometimes', 'date'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if (strlen($this->getContent()) > 1024 * 1024) {
                $validator->errors()->add('content', 'Nội dung bài học vượt quá 1 MB.');
            }
            if ($this->input('content.lessonId') !== null
                && $this->input('content.lessonId') !== $this->route('curriculumLesson')?->getKey()) {
                $validator->errors()->add('content.lessonId', 'Mã bài học không khớp URL.');
            }
        }];
    }
}
