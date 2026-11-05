<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuestionBankQuestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $public = $this->public_content;
        $key = $this->answer_key ?? [];
        $typeFields = match ($this->type) {
            'true_false_group' => ['statements' => array_map(fn ($statement) => $statement + [
                'correctAnswer' => $key['answersByStatementId'][$statement['id']],
            ], $public['statements'])],
            'essay_text' => ['rubricText' => $this->rubric['rubricText'] ?? null],
            default => array_intersect_key($public, array_flip(['options'])) + $key,
        };

        return [
            'id' => $this->id,
            'version' => $this->version,
            'type' => $this->type,
            'lessonId' => $this->curriculum_lesson_id,
            'chapterId' => $this->curriculumLesson?->chapter_id,
            'difficulty' => $this->difficulty,
            'content' => $public['content'],
            'image' => $public['image'] ?? null,
            'explanation' => $this->explanation,
            'showInLesson' => $this->show_in_lesson,
            ...$typeFields,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
