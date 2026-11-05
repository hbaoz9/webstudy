<?php

namespace App\Http\Controllers;

use App\Http\Requests\DeleteQuestionBankQuestionRequest;
use App\Http\Requests\SaveQuestionBankQuestionRequest;
use App\Http\Resources\QuestionBankQuestionResource;
use App\Models\QuestionBankQuestion;
use App\Services\QuestionBankService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class TeacherQuestionBankController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', QuestionBankQuestion::class);
        $filters = Validator::make($request->query(), [
            'page' => ['sometimes', 'integer', 'min:1'],
            'perPage' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'q' => ['sometimes', 'string', 'max:100'],
            'type' => ['sometimes', 'in:single_choice,multiple_choice,true_false,true_false_group,short_answer,essay_text'],
            'difficulty' => ['sometimes', 'in:recognition,comprehension,application,advanced_application'],
            'lessonId' => ['sometimes', 'string', 'max:32'],
            'chapterId' => ['sometimes', 'string', 'max:32'],
            'sort' => ['sometimes', 'in:newest,lesson,difficulty'],
        ])->validate();
        $questions = QuestionBankQuestion::query()->where('teacher_id', $request->user()->id)
            ->with('curriculumLesson.chapter');
        if (isset($filters['type'])) {
            $questions->where('type', $filters['type']);
        }
        if (isset($filters['difficulty'])) {
            $questions->where('difficulty', $filters['difficulty']);
        }
        if (isset($filters['lessonId'])) {
            $questions->where('curriculum_lesson_id', $filters['lessonId']);
        }
        if (isset($filters['chapterId'])) {
            $questions->whereHas('curriculumLesson', fn ($query) => $query->where('chapter_id', $filters['chapterId']));
        }
        $search = trim($filters['q'] ?? '');
        if ($search !== '') {
            $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search));
            $expression = DB::getDriverName() === 'pgsql'
                ? "public_content->>'content'" : "json_extract(public_content, '$.content')";
            $questions->whereRaw("LOWER($expression) LIKE ? ESCAPE '!'", ['%'.$escaped.'%']);
        }
        $sort = $filters['sort'] ?? 'newest';
        if ($sort === 'lesson') {
            $questions->join('curriculum_lessons as lesson_sort', 'lesson_sort.id', '=', 'question_bank_questions.curriculum_lesson_id')
                ->select('question_bank_questions.*')->orderBy('lesson_sort.number')->orderByDesc('question_bank_questions.created_at');
        } elseif ($sort === 'difficulty') {
            $questions->orderByRaw("CASE difficulty WHEN 'recognition' THEN 0 WHEN 'comprehension' THEN 1 WHEN 'application' THEN 2 ELSE 3 END")
                ->orderByDesc('created_at');
        } else {
            $questions->orderByDesc('created_at');
        }
        $questions->orderByDesc('question_bank_questions.id');
        return QuestionBankQuestionResource::collection($questions->paginate((int) ($filters['perPage'] ?? 20))->withQueryString());
    }

    public function store(SaveQuestionBankQuestionRequest $request, QuestionBankService $service): JsonResponse
    {
        Gate::authorize('create', QuestionBankQuestion::class);
        return response()->json(['data' => new QuestionBankQuestionResource(
            $service->create($request->user(), $request->validated())
        )], 201);
    }

    public function show(Request $request, string $question): QuestionBankQuestionResource
    {
        $owned = $this->owned($request, $question);
        Gate::authorize('view', $owned);
        return new QuestionBankQuestionResource($owned);
    }

    public function update(SaveQuestionBankQuestionRequest $request, string $question, QuestionBankService $service): QuestionBankQuestionResource
    {
        Gate::authorize('update', $this->owned($request, $question));
        return new QuestionBankQuestionResource($service->update($request->user(), $question, $request->validated()));
    }

    public function destroy(DeleteQuestionBankQuestionRequest $request, string $question, QuestionBankService $service): \Illuminate\Http\Response
    {
        Gate::authorize('delete', $this->owned($request, $question));
        $service->delete($request->user(), $question, (int) $request->validated('expectedVersion'));
        return response()->noContent();
    }

    private function owned(Request $request, string $id): QuestionBankQuestion
    {
        return QuestionBankQuestion::query()->where('teacher_id', $request->user()->id)
            ->with('curriculumLesson.chapter')->findOrFail($id);
    }
}
