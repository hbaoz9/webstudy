<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveQuestionBankQuestionRequest extends FormRequest
{
    private const TYPES = ['single_choice', 'multiple_choice', 'true_false', 'true_false_group', 'short_answer', 'essay_text'];
    private const DIFFICULTIES = ['recognition', 'comprehension', 'application', 'advanced_application'];

    public function authorize(): bool
    {
        return $this->user()?->role === 'teacher';
    }

    protected function prepareForValidation(): void
    {
        $trimmed = [];
        foreach (['lessonId', 'content', 'explanation', 'rubricText', 'correctAnswer', 'correctOptionId'] as $key) {
            if (is_string($this->input($key))) {
                $trimmed[$key] = trim($this->input($key));
            }
        }
        foreach (['options' => 'text', 'statements' => 'content'] as $key => $textKey) {
            if (! is_array($this->input($key))) {
                continue;
            }
            $trimmed[$key] = array_map(function ($item) use ($textKey) {
                if (! is_array($item)) {
                    return $item;
                }
                foreach (['id', $textKey] as $field) {
                    if (isset($item[$field]) && is_string($item[$field])) {
                        $item[$field] = trim($item[$field]);
                    }
                }
                return $item;
            }, $this->input($key));
        }
        if (is_array($this->input('image'))) {
            $image = $this->input('image');
            foreach (['url', 'caption', 'source'] as $field) {
                if (isset($image[$field]) && is_string($image[$field])) {
                    $image[$field] = trim($image[$field]);
                }
            }
            $trimmed['image'] = $image;
        }
        $this->merge($trimmed);
    }

    public function rules(): array
    {
        $type = $this->input('type');
        $choice = in_array($type, ['single_choice', 'multiple_choice'], true);

        return [
            'type' => ['required', Rule::in(self::TYPES)],
            'lessonId' => ['required', 'string', 'max:32', Rule::exists('curriculum_lessons', 'id')],
            'difficulty' => ['required', Rule::in(self::DIFFICULTIES)],
            'content' => ['required', 'string', 'min:1', 'max:5000'],
            'image' => ['sometimes', 'nullable', 'array:url,caption,source'],
            'image.url' => ['required_with:image', 'string', 'max:300000'],
            'image.caption' => ['sometimes', 'nullable', 'string', 'max:300'],
            'image.source' => ['sometimes', 'nullable', 'string', 'max:500'],
            'explanation' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'showInLesson' => ['sometimes', 'boolean'],
            'options' => [$choice ? 'required' : 'prohibited', 'array', 'min:2', 'max:10'],
            'options.*' => ['array:id,text'],
            'options.*.id' => ['required', 'string', 'max:100'],
            'options.*.text' => ['required', 'string', 'max:5000'],
            'correctOptionId' => [$type === 'single_choice' ? 'required' : 'prohibited', 'string', 'max:100'],
            'correctOptionIds' => [$type === 'multiple_choice' ? 'required' : 'prohibited', 'array', 'min:1', 'max:10'],
            'correctOptionIds.*' => ['string', 'max:100'],
            'statements' => [$type === 'true_false_group' ? 'required' : 'prohibited', 'array', 'min:2', 'max:10'],
            'statements.*' => ['array:id,content,correctAnswer'],
            'statements.*.id' => ['required', 'string', 'max:100'],
            'statements.*.content' => ['required', 'string', 'max:5000'],
            'statements.*.correctAnswer' => ['required'],
            'correctAnswer' => [in_array($type, ['true_false', 'short_answer'], true) ? 'required' : 'prohibited'],
            'rubricText' => [$type === 'essay_text' ? 'sometimes' : 'prohibited', 'nullable', 'string', 'max:10000'],
            'expectedVersion' => [$this->isMethod('PUT') ? 'required' : 'prohibited', 'integer', 'min:1'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $allowed = ['type', 'lessonId', 'difficulty', 'content', 'image', 'explanation', 'showInLesson'];
            $type = $this->input('type');
            $allowed = array_merge($allowed, match ($type) {
                'single_choice' => ['options', 'correctOptionId'],
                'multiple_choice' => ['options', 'correctOptionIds'],
                'true_false', 'short_answer' => ['correctAnswer'],
                'true_false_group' => ['statements'],
                'essay_text' => ['rubricText'],
                default => [],
            });
            if ($this->isMethod('PUT')) {
                $allowed[] = 'expectedVersion';
            }
            foreach (array_diff(array_keys($this->all()), $allowed) as $key) {
                $validator->errors()->add($key, 'Unknown question field.');
            }
            if (strlen($this->getContent()) > 1024 * 1024) {
                $validator->errors()->add('content', 'Question request exceeds 1 MB.');
            }

            $image = $this->input('image');
            if (is_array($image) && is_string($image['url'] ?? null) && ! $this->validImage($image['url'])) {
                $validator->errors()->add('image.url', 'Image must be an HTTP(S) URL or a valid PNG/JPEG/WebP data URL.');
            }
            if (in_array($type, ['single_choice', 'multiple_choice'], true) && is_array($this->input('options')) &&
                collect($this->input('options'))->every(fn ($option) => is_array($option) && is_string($option['id'] ?? null))) {
                $ids = array_column($this->input('options'), 'id');
                if (count($ids) !== count(array_unique($ids, SORT_STRING))) {
                    $validator->errors()->add('options', 'Option IDs must be unique.');
                }
                $correct = $type === 'single_choice' ? [$this->input('correctOptionId')] : $this->input('correctOptionIds');
                if (is_array($correct) && collect($correct)->every(fn ($id) => is_string($id))) {
                    if (count($correct) !== count(array_unique($correct, SORT_STRING)) || count(array_diff($correct, $ids)) > 0) {
                        $validator->errors()->add('correctOptionIds', 'Correct option IDs must be distinct and belong to the options.');
                    }
                }
            }
            if ($type === 'true_false_group' && is_array($this->input('statements')) &&
                collect($this->input('statements'))->every(fn ($statement) => is_array($statement) && is_string($statement['id'] ?? null))) {
                $ids = array_column($this->input('statements'), 'id');
                if (count($ids) !== count(array_unique($ids, SORT_STRING))) {
                    $validator->errors()->add('statements', 'Statement IDs must be unique.');
                }
                foreach ($this->input('statements') as $index => $statement) {
                    if (is_array($statement) && array_key_exists('correctAnswer', $statement) && ! is_bool($statement['correctAnswer'])) {
                        $validator->errors()->add("statements.$index.correctAnswer", 'Correct answer must be a boolean.');
                    }
                }
            }
            if ($type === 'true_false' && ! is_bool($this->input('correctAnswer'))) {
                $validator->errors()->add('correctAnswer', 'Correct answer must be a boolean.');
            }
            if ($type === 'short_answer' && (! is_string($this->input('correctAnswer')) || self::normalizeNumeric($this->input('correctAnswer')) === null)) {
                $validator->errors()->add('correctAnswer', 'Correct answer must be a number.');
            }
        }];
    }

    public static function normalizeNumeric(string $value): ?string
    {
        $value = trim($value);
        if (! preg_match('/^[+-]?\d+(?:[.,]\d+)?$/D', $value)) {
            return null;
        }
        $negative = str_starts_with($value, '-');
        $unsigned = preg_replace('/^[+-]/', '', $value);
        [$whole, $fraction] = array_pad(explode('.', str_replace(',', '.', $unsigned), 2), 2, '');
        $integer = ltrim($whole, '0');
        $integer = $integer === '' ? '0' : $integer;
        $decimal = rtrim($fraction, '0');
        $magnitude = $decimal === '' ? $integer : "$integer.$decimal";
        return $negative && $magnitude !== '0' ? "-$magnitude" : $magnitude;
    }

    private function validImage(string $url): bool
    {
        if (str_starts_with($url, 'data:')) {
            if (strlen($url) > 300000 || ! preg_match('/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+\/]+={0,2})$/D', $url, $matches)) {
                return false;
            }
            $bytes = base64_decode($matches[2], true);
            return $bytes !== false && (getimagesizefromstring($bytes)['mime'] ?? null) === 'image/'.$matches[1];
        }
        return filter_var($url, FILTER_VALIDATE_URL) !== false
            && in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true);
    }
}
