<?php

namespace App\Http\Controllers;

use App\Models\Assessment;
use App\Models\AssessmentRevision;
use App\Services\AssessmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TeacherAssessmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = Validator::make($request->query(), [
            'page' => 'sometimes|integer|min:1', 'perPage' => 'sometimes|integer|min:1|max:100',
            'q' => 'sometimes|string|max:100', 'sort' => 'sometimes|in:newest,title',
        ])->validate();
        $query = Assessment::query()->where('teacher_id', $request->user()->id);
        if (!empty($data['q'])) $query->where('title', 'like', '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($data['q'])).'%');
        if (($data['sort'] ?? 'newest') === 'title') $query->orderBy('title');
        else $query->orderByDesc('updated_at');
        $page = $query->orderBy('id')->paginate($data['perPage'] ?? 20)->withQueryString();
        return response()->json($this->page($page, fn ($item) => $this->assessment($item)));
    }

    public function store(Request $request, AssessmentService $service): JsonResponse
    {
        $data = $this->validateExact($request, ['title', 'instructions'], [
            'title' => 'required|string|max:255', 'instructions' => 'nullable|string',
        ]);
        return response()->json(['data' => $this->assessment($service->create($request->user(), $data))], 201);
    }

    public function show(Request $request, string $assessment): JsonResponse
    {
        return response()->json(['data' => $this->assessment($this->owned($request, $assessment)->load('revisions'))]);
    }

    public function update(Request $request, string $assessment, AssessmentService $service): JsonResponse
    {
        $this->owned($request, $assessment);
        $data = $this->validateExact($request, ['title', 'expectedVersion'], [
            'title' => 'required|string|max:255', 'expectedVersion' => 'required|integer|min:1',
        ]);
        return response()->json(['data' => $this->assessment($service->update($request->user(), $assessment, $data))]);
    }

    public function destroy(Request $request, string $assessment, AssessmentService $service): \Illuminate\Http\Response
    {
        $this->owned($request, $assessment);
        $data = $this->validateExact($request, ['expectedVersion'], ['expectedVersion' => 'required|integer|min:1']);
        $service->delete($request->user(), $assessment, (int) $data['expectedVersion']);
        return response()->noContent();
    }

    public function revisions(Request $request, string $assessment): JsonResponse
    {
        $owned = $this->owned($request, $assessment);
        $filters = Validator::make($request->query(), [
            'page' => 'sometimes|integer|min:1', 'perPage' => 'sometimes|integer|min:1|max:100',
        ])->validate();
        $page = $owned->revisions()->orderByDesc('revision_no')->paginate($filters['perPage'] ?? 20)->withQueryString();
        return response()->json($this->page($page, fn ($item) => $this->revision($item)));
    }

    public function createRevision(Request $request, string $assessment, AssessmentService $service): JsonResponse
    {
        $this->owned($request, $assessment);
        $data = $this->validateExact($request, ['basedOnRevisionId'], ['basedOnRevisionId' => 'sometimes|uuid']);
        return response()->json(['data' => $this->revision($service->createDraft($request->user(), $assessment, $data))], 201);
    }

    public function showRevision(Request $request, string $revision): JsonResponse
    {
        return response()->json(['data' => $this->revision($this->ownedRevision($request, $revision)->load('questions'))]);
    }

    public function saveDraft(Request $request, string $revision, AssessmentService $service): JsonResponse
    {
        $this->ownedRevision($request, $revision);
        $data = $this->validateExact($request, ['expectedVersion', 'title', 'instructions', 'questions'], [
            'expectedVersion' => 'required|integer|min:1', 'title' => 'required|string|max:255',
            'instructions' => 'nullable|string', 'questions' => 'present|array|max:200',
            'questions.*' => 'required|array', 'questions.*.revisionQuestionId' => 'sometimes|uuid',
            'questions.*.sourceQuestionId' => 'sometimes|uuid', 'questions.*.sourceQuestionVersion' => 'sometimes|integer|min:1',
            'questions.*.maxPoints' => ['sometimes', 'regex:/^(?:0|[1-9]\\d{0,5})(?:\\.\\d{1,6})?$/'],
        ]);
        foreach ($data['questions'] as $i => $item) {
            $existing = isset($item['revisionQuestionId']);
            $keys = array_keys($item);
            sort($keys);
            $allowed = $existing ? ['maxPoints', 'revisionQuestionId'] : ['maxPoints', 'sourceQuestionId', 'sourceQuestionVersion'];
            if ((!$existing && (!isset($item['sourceQuestionId']) || !isset($item['sourceQuestionVersion']))) || array_diff($keys, $allowed)) {
                throw \Illuminate\Validation\ValidationException::withMessages(["questions.$i" => 'Invalid question reference.']);
            }
        }
        return response()->json(['data' => $this->revision($service->saveDraft($request->user(), $revision, $data))]);
    }

    public function publish(Request $request, string $revision, AssessmentService $service): JsonResponse
    {
        $this->ownedRevision($request, $revision);
        $data = $this->validateExact($request, ['expectedVersion'], ['expectedVersion' => 'required|integer|min:1']);
        $key = $request->header('Idempotency-Key');
        if (!is_string($key) || strlen($key) < 8 || strlen($key) > 200) {
            throw \Illuminate\Validation\ValidationException::withMessages(['Idempotency-Key' => 'A valid Idempotency-Key is required.']);
        }
        return response()->json(['data' => $this->revision($service->publish($request->user(), $revision, (int) $data['expectedVersion'], $key))]);
    }

    private function validateExact(Request $request, array $allowed, array $rules): array
    {
        $input = $request->all();
        foreach (array_keys($input) as $key) if (!in_array($key, $allowed, true)) {
            throw \Illuminate\Validation\ValidationException::withMessages([$key => 'Unknown field.']);
        }
        return Validator::make($input, $rules)->validate();
    }

    private function owned(Request $request, string $id): Assessment
    {
        return Assessment::query()->where('teacher_id', $request->user()->id)->findOrFail($id);
    }

    private function ownedRevision(Request $request, string $id): AssessmentRevision
    {
        return AssessmentRevision::query()->whereKey($id)->whereHas('assessment', fn ($q) => $q->where('teacher_id', $request->user()->id))->firstOrFail();
    }

    private function assessment(Assessment $assessment): array
    {
        return ['id' => $assessment->id, 'title' => $assessment->title, 'version' => $assessment->version,
            'createdAt' => $assessment->created_at?->toISOString(), 'updatedAt' => $assessment->updated_at?->toISOString(),
            'revisions' => $assessment->relationLoaded('revisions') ? $assessment->revisions->map(fn ($r) => $this->revision($r))->all() : null];
    }

    private function revision(AssessmentRevision $revision): array
    {
        return ['id' => $revision->id, 'assessmentId' => $revision->assessment_id, 'revisionNo' => $revision->revision_no,
            'status' => $revision->status, 'title' => $revision->title, 'instructions' => $revision->instructions,
            'sourceRevisionId' => $revision->source_revision_id, 'version' => $revision->version,
            'totalPoints' => (string) $revision->total_points, 'publishedAt' => $revision->published_at?->toISOString(),
            'questions' => $revision->relationLoaded('questions') ? $revision->questions->map(fn ($q) => [
                'id' => $q->id, 'sourceQuestionId' => $q->source_question_id,
                'sourceQuestionVersion' => $q->source_question_version, 'position' => $q->position,
                'type' => $q->type, 'difficulty' => $q->difficulty, 'lessonId' => $q->curriculum_lesson_id,
                'publicContent' => $q->public_content, 'answerKey' => $q->answer_key, 'rubric' => $q->rubric,
                'explanation' => $q->explanation, 'maxPoints' => (string) $q->max_points,
                'gradingPolicy' => $q->grading_policy,
            ])->all() : null];
    }

    private function page($page, callable $map): array
    {
        return ['data' => $page->getCollection()->map($map)->all(),
            'links' => ['first' => $page->url(1), 'last' => $page->url($page->lastPage()),
                'prev' => $page->previousPageUrl(), 'next' => $page->nextPageUrl()],
            'meta' => ['currentPage' => $page->currentPage(), 'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(), 'total' => $page->total()]];
    }
}
