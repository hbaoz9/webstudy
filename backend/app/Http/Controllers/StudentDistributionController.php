<?php

namespace App\Http\Controllers;

use App\Models\ClassMembership;
use App\Models\Distribution;
use App\Models\StudentNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class StudentDistributionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (!config('distribution.student_visibility_enabled', false)) return response()->json($this->emptyPage());
        $filter = Validator::make($request->query(), ['classroomId' => 'sometimes|uuid'])->validate()['classroomId'] ?? null;
        $classIds = $this->activeClassIds($request);
        $page = Distribution::query()->whereIn('classroom_id', $classIds)
            ->when($filter, fn ($q) => $q->where('classroom_id', $filter))
            ->whereHas('classroom', fn ($q) => $q->where('status', 'active'))
            ->with('revision', 'classroom')->orderByDesc('created_at')->orderBy('id')->paginate(20);
        return response()->json($this->page($page, fn ($item) => $this->safeResource($item)));
    }

    public function show(Request $request, string $distribution): JsonResponse
    {
        $active = config('distribution.student_visibility_enabled', false)
            && Distribution::query()->whereKey($distribution)
                ->whereIn('classroom_id', $this->activeClassIds($request))
                ->whereHas('classroom', fn ($q) => $q->where('status', 'active'))->exists();
        $historical = Schema::hasTable('student_attempts') && DB::table('student_attempts')
            ->where('distribution_id', $distribution)->where('student_id', $request->user()->id)->exists();
        if (!$active && !$historical) abort(404);
        $item = Distribution::query()->with('revision', 'classroom')->findOrFail($distribution);
        return response()->json(['data' => $this->safeResource($item)]);
    }

    public function history(Request $request): JsonResponse
    {
        if (!Schema::hasTable('student_attempts')) return response()->json($this->emptyPage());
        $filter = Validator::make($request->query(), ['classroomId' => 'sometimes|uuid'])->validate()['classroomId'] ?? null;
        $ids = DB::table('student_attempts')->where('student_id', $request->user()->id)
            ->select('distribution_id')->distinct();
        $page = Distribution::query()->whereIn('id', $ids)->with('revision', 'classroom')
            ->when($filter, fn ($q) => $q->where('classroom_id', $filter))
            ->orderByDesc('created_at')->orderBy('id')->paginate(20);
        return response()->json($this->page($page, fn ($item) => $this->safeResource($item)));
    }

    public function notifications(Request $request): JsonResponse
    {
        $page = StudentNotification::query()->where('student_id', $request->user()->id)
            ->orderByDesc('created_at')->orderBy('id')->paginate(20);
        return response()->json($this->page($page, fn ($item) => $this->notification($item)));
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $item = StudentNotification::query()->where('student_id', $request->user()->id)->findOrFail($notification);
        if (!$item->read_at) {
            StudentNotification::query()->whereKey($item->id)->whereNull('read_at')->update(['read_at' => now()]);
        }
        return response()->json(['data' => $this->notification($item->refresh())]);
    }

    private function activeClassIds(Request $request): array
    {
        return ClassMembership::query()->where('student_id', $request->user()->id)
            ->where('status', 'active')->pluck('classroom_id')->all();
    }

    private function safeResource(Distribution $item): array
    {
        return [
            'id' => $item->id, 'classroomId' => $item->classroom_id,
            'classroomName' => $item->classroom?->name ?? 'Lớp cũ', 'title' => $item->revision->title,
            'opensAt' => $item->opens_at->toIso8601String(),
            'deadlineAt' => $item->deadline_at->toIso8601String(),
            'status' => $item->lifecycle_status, 'attemptAvailable' => false,
        ];
    }

    private function notification(StudentNotification $item): array
    {
        return ['id' => $item->id, 'distributionId' => $item->distribution_id,
            'type' => $item->type, 'title' => $item->title, 'body' => $item->body,
            'createdAt' => $item->created_at->toIso8601String(), 'readAt' => $item->read_at?->toIso8601String()];
    }

    private function emptyPage(): array
    {
        return ['data' => [], 'links' => ['first' => null, 'last' => null, 'prev' => null, 'next' => null],
            'meta' => ['currentPage' => 1, 'lastPage' => 1, 'perPage' => 20, 'total' => 0]];
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
