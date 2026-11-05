<?php

namespace App\Services;

use App\Http\Requests\SaveQuestionBankQuestionRequest;
use App\Models\QuestionBankQuestion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class QuestionBankService
{
    public function create(User $teacher, array $data): QuestionBankQuestion
    {
        return DB::transaction(function () use ($teacher, $data): QuestionBankQuestion {
            $question = new QuestionBankQuestion();
            $question->forceFill(['teacher_id' => $teacher->id, 'version' => 1] + $this->columns($data));
            $question->save();
            return $question->load('curriculumLesson.chapter');
        });
    }

    public function update(User $teacher, string $id, array $data): QuestionBankQuestion
    {
        return DB::transaction(function () use ($teacher, $id, $data): QuestionBankQuestion {
            $question = QuestionBankQuestion::query()->where('teacher_id', $teacher->id)
                ->whereKey($id)->lockForUpdate()->firstOrFail();
            abort_if($question->version !== (int) $data['expectedVersion'], 409, 'Question version conflict.');
            $question->forceFill($this->columns($data) + ['version' => $question->version + 1]);
            $question->save();
            return $question->load('curriculumLesson.chapter');
        }, 3);
    }

    public function delete(User $teacher, string $id, int $expectedVersion): void
    {
        DB::transaction(function () use ($teacher, $id, $expectedVersion): void {
            $question = QuestionBankQuestion::query()->where('teacher_id', $teacher->id)
                ->whereKey($id)->lockForUpdate()->firstOrFail();
            abort_if($question->version !== $expectedVersion, 409, 'Question version conflict.');
            $question->delete();
        }, 3);
    }

    private function columns(array $data): array
    {
        $type = $data['type'];
        $public = ['content' => $data['content']];
        if (isset($data['image'])) {
            $public['image'] = $data['image'];
        }
        $key = null;
        $rubric = null;
        if (in_array($type, ['single_choice', 'multiple_choice'], true)) {
            $public['options'] = $data['options'];
            $key = $type === 'single_choice'
                ? ['correctOptionId' => $data['correctOptionId']]
                : ['correctOptionIds' => $data['correctOptionIds']];
        } elseif ($type === 'true_false') {
            $key = ['correctAnswer' => $data['correctAnswer']];
        } elseif ($type === 'true_false_group') {
            $public['statements'] = array_map(fn ($statement) => [
                'id' => $statement['id'], 'content' => $statement['content'],
            ], $data['statements']);
            $key = ['answersByStatementId' => array_column($data['statements'], 'correctAnswer', 'id')];
        } elseif ($type === 'short_answer') {
            $key = ['correctAnswer' => SaveQuestionBankQuestionRequest::normalizeNumeric($data['correctAnswer'])];
        } else {
            $rubric = isset($data['rubricText']) ? ['rubricText' => $data['rubricText']] : null;
        }
        return [
            'curriculum_lesson_id' => $data['lessonId'],
            'type' => $type,
            'difficulty' => $data['difficulty'],
            'public_content' => $public,
            'answer_key' => $key,
            'rubric' => $rubric,
            'explanation' => $data['explanation'] ?? null,
            'show_in_lesson' => $data['showInLesson'] ?? false,
        ];
    }
}
