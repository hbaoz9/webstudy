<?php

namespace App\Http\Controllers;

use App\Models\Distribution;
use App\Services\DistributionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class TeacherDistributionController extends Controller
{
    public function preview(Request $request, DistributionService $service): JsonResponse
    {
        return response()->json(['data' => $service->preview($request->user(), $this->schedule($request))]);
    }

    public function store(Request $request, DistributionService $service): JsonResponse
    {
        // The gate also lives in the service so direct calls cannot bypass it.
        if (!config('distribution.creation_enabled', false)) {
            abort(response()->json(['error' => ['code' => 'distribution_release_locked',
                'message' => 'Tính năng giao bài chưa được mở sử dụng.']], 423));
        }
        $input = $this->schedule($request);
        $result = $service->create($request->user(), $input, $this->key($request));
        $status = isset($result['_replayed']) ? 200 : 201;
        unset($result['_replayed']);
        return response()->json(['data' => $result], $status);
    }

    public function index(Request $request, DistributionService $service): JsonResponse
    {
        $data = Validator::make($request->query(), [
            'page' => 'sometimes|integer|min:1', 'perPage' => 'sometimes|integer|min:1|max:100',
            'classroomId' => 'sometimes|uuid', 'assessmentId' => 'sometimes|uuid', 'status' => 'sometimes|in:scheduled,open,expired,closed,cancelled',
            'q' => 'sometimes|string|max:100', 'sort' => 'sometimes|in:newest',
        ])->validate();
        $query = Distribution::query()->where('teacher_id', $request->user()->id);
        if (isset($data['classroomId'])) $query->where('classroom_id', $data['classroomId']);
        if (isset($data['assessmentId'])) {
            $assessmentId = $data['assessmentId'];
            $query->whereHas('revision', fn ($revision) => $revision->where('assessment_id', $assessmentId)
                ->whereHas('assessment', fn ($assessment) => $assessment->where('teacher_id', $request->user()->id)));
        }
        if (!empty($data['q'])) {
            $term = str_replace(['%', '_'], ['\\%', '\\_'], trim($data['q']));
            $query->whereHas('revision', fn ($q) => $q->whereRaw('lower(title) like ?', ['%'.mb_strtolower($term).'%']));
        }
        $now = now();
        switch ($data['status'] ?? null) {
            case 'scheduled': $query->where('lifecycle_status', 'active')->where('opens_at', '>', $now); break;
            case 'open': $query->where('lifecycle_status', 'active')->where('opens_at', '<=', $now)->where('deadline_at', '>', $now); break;
            case 'expired': $query->where('lifecycle_status', 'active')->where('deadline_at', '<=', $now); break;
            case 'closed': case 'cancelled': $query->where('lifecycle_status', $data['status']); break;
        }
        $page = $query->with('revision', 'classroom')->orderByDesc('created_at')->orderBy('id')
            ->paginate($data['perPage'] ?? 20)->withQueryString();
        return response()->json($this->page($page, fn ($item) => $service->resource($item)));
    }

    public function show(Request $request, string $distribution, DistributionService $service): JsonResponse
    {
        return response()->json(['data' => $service->resource($this->owned($request, $distribution))]);
    }

    public function close(Request $request, string $distribution, DistributionService $service): JsonResponse
    {
        return $this->command($request, $distribution, $service, 'close');
    }

    public function cancel(Request $request, string $distribution, DistributionService $service): JsonResponse
    {
        return $this->command($request, $distribution, $service, 'cancel');
    }

    public function events(Request $request, string $distribution): JsonResponse
    {
        $owned = $this->owned($request, $distribution);
        $data = Validator::make($request->query(), ['page' => 'sometimes|integer|min:1',
            'perPage' => 'sometimes|integer|min:1|max:100'])->validate();
        $page = $owned->events()->paginate($data['perPage'] ?? 20)->withQueryString();
        return response()->json($this->page($page, fn ($event) => [
            'id' => $event->id, 'type' => $event->event_type, 'actorId' => $event->actor_id,
            'reason' => $event->reason, 'metadata' => $event->metadata,
            'createdAt' => $event->created_at->toIso8601String(),
        ]));
    }

    private function command(Request $request, string $id, DistributionService $service, string $operation): JsonResponse
    {
        $this->owned($request, $id);
        $data = $this->exact($request, ['expectedVersion', 'reason'], [
            'expectedVersion' => 'required|integer|min:1',
            'reason' => $operation === 'cancel' ? 'required|string|min:1|max:1000' : 'sometimes|nullable|string|max:1000',
        ]);
        if ($operation === 'cancel' && trim($data['reason']) === '') {
            throw ValidationException::withMessages(['reason' => 'Cần nêu lý do hủy bài.']);
        }
        return response()->json(['data' => $service->resource($service->command($request->user(), $id,
            $operation, (int) $data['expectedVersion'], isset($data['reason']) ? trim($data['reason']) : null,
            $this->key($request)))]);
    }

    private function schedule(Request $request): array
    {
        $data = $this->exact($request, [
            'revisionId', 'classroomIds', 'opensAt', 'deadlineAt', 'timeLimitSeconds',
            'maxAttempts', 'deadlinePolicy', 'overlapConfirmationToken',
            'scorePolicy', 'scoreReleaseMode', 'answerReleaseMode',
        ], [
            'revisionId' => 'required|uuid', 'classroomIds' => 'required|array|min:1|max:30',
            'classroomIds.*' => 'required|uuid|distinct', 'opensAt' => 'sometimes|nullable|date',
            'deadlineAt' => 'required|date', 'timeLimitSeconds' => 'required|integer|min:60|max:14400',
            'maxAttempts' => 'sometimes|integer|min:1|max:5',
            'deadlinePolicy' => 'required|in:HARD_DEADLINE,FINISH_STARTED_ATTEMPT',
            'scorePolicy' => 'sometimes|in:HIGHEST,LATEST,AVERAGE',
            'scoreReleaseMode' => 'sometimes|in:AFTER_ATTEMPT_GRADED,AFTER_DISTRIBUTION_ENDED_AND_GRADED,MANUAL',
            'answerReleaseMode' => 'sometimes|in:AFTER_DISTRIBUTION_ENDED_WITH_TEACHER_PERMISSION,MANUAL,NEVER',
            'overlapConfirmationToken' => 'sometimes|nullable|size:64|regex:/^[a-f0-9]{64}$/',
        ]);
        foreach (['opensAt', 'deadlineAt'] as $field) {
            if (isset($data[$field]) && !preg_match('/(?:Z|[+-]\d{2}:\d{2})$/', $data[$field])) {
                throw ValidationException::withMessages([$field => 'Thời gian cần có múi giờ.']);
            }
        }
        return $data;
    }

    private function key(Request $request): string
    {
        $key = $request->header('Idempotency-Key');
        if (!is_string($key) || strlen($key) < 16 || strlen($key) > 128 || !preg_match('/^[A-Za-z0-9_-]+$/', $key)) {
            throw ValidationException::withMessages(['Idempotency-Key' => 'Cần mã yêu cầu hợp lệ.']);
        }
        return $key;
    }

    private function owned(Request $request, string $id): Distribution
    {
        return Distribution::query()->where('teacher_id', $request->user()->id)->findOrFail($id);
    }

    private function exact(Request $request, array $allowed, array $rules): array
    {
        foreach (array_keys($request->all()) as $key) if (!in_array($key, $allowed, true)) {
            throw ValidationException::withMessages([$key => 'Unknown field.']);
        }
        return Validator::make($request->all(), $rules)->validate();
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
