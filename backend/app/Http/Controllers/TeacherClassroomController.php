<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportRosterRequest;
use App\Http\Requests\ManualVerifyJoinRequest;
use App\Http\Requests\SaveClassroomRequest;
use App\Http\Resources\ClassJoinRequestResource;
use App\Http\Resources\ClassMembershipResource;
use App\Http\Resources\ClassroomResource;
use App\Http\Resources\ClassRosterEntryResource;
use App\Models\ClassJoinRequest;
use App\Models\Classroom;
use App\Models\ClassRosterEntry;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

class TeacherClassroomController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return ClassroomResource::collection(Classroom::query()
            ->where('teacher_id', $request->user()->id)
            ->withCount(['memberships as active_memberships_count' => fn ($query) => $query->where('status', 'active')])
            ->latest()->paginate(20));
    }

    public function show(Classroom $classroom): ClassroomResource
    {
        Gate::authorize('manage', $classroom);

        return new ClassroomResource($this->withActiveCount($classroom));
    }

    public function store(SaveClassroomRequest $request, ClassroomService $service): JsonResponse
    {
        return response()->json(['data' => new ClassroomResource(
            $this->withActiveCount($service->create($request->user(), $request->validated())->refresh())
        )], 201);
    }

    public function update(SaveClassroomRequest $request, Classroom $classroom, ClassroomService $service): ClassroomResource
    {
        Gate::authorize('manage', $classroom);

        return new ClassroomResource($this->withActiveCount($service->update($request->user(), $classroom, $request->validated())));
    }

    public function archive(Request $request, Classroom $classroom, ClassroomService $service): ClassroomResource
    {
        Gate::authorize('manage', $classroom);

        return new ClassroomResource($this->withActiveCount($service->archive($request->user(), $classroom)));
    }

    public function roster(Request $request, Classroom $classroom): AnonymousResourceCollection
    {
        Gate::authorize('manage', $classroom);

        $filters = Validator::make($request->query(), [
            'page' => ['sometimes', 'integer', 'min:1'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'status' => ['sometimes', 'in:joined,not_joined,conflict'],
        ])->validate();

        $roster = $classroom->rosterEntries();
        $search = trim($filters['search'] ?? '');
        if ($search !== '') {
            // Escape LIKE metacharacters so a search term is always literal text.
            $term = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search));
            $pattern = '%'.$term.'%';
            // Check the function on this connection; a database without unaccent keeps basic search.
            $hasUnaccent = DB::connection()->getDriverName() === 'pgsql'
                && (int) DB::connection()->selectOne(
                    "SELECT CASE WHEN to_regprocedure('unaccent(text)') IS NULL THEN 0 ELSE 1 END AS available"
                )->available === 1;
            $roster->where(function ($query) use ($pattern, $hasUnaccent): void {
                $nameExpression = $hasUnaccent ? 'LOWER(unaccent(full_name))' : 'LOWER(full_name)';
                $namePattern = $hasUnaccent ? 'LOWER(unaccent(?))' : '?';
                $query->whereRaw("$nameExpression LIKE $namePattern ESCAPE '!'", [$pattern])
                    ->orWhereRaw("LOWER(student_code) LIKE ? ESCAPE '!'", [$pattern]);
            });
        }
        if (isset($filters['status'])) {
            $roster->where('status', $filters['status']);
        }

        return ClassRosterEntryResource::collection($roster->orderBy('order_number')->orderBy('id')->paginate(100)->withQueryString());
    }

    public function importRoster(ImportRosterRequest $request, Classroom $classroom, ClassroomService $service): JsonResponse
    {
        Gate::authorize('manage', $classroom);

        return response()->json(['data' => $service->importRoster($request->user(), $classroom, $request->validated('rows'))]);
    }

    public function joinRequests(Classroom $classroom): AnonymousResourceCollection
    {
        Gate::authorize('manage', $classroom);

        return ClassJoinRequestResource::collection($classroom->joinRequests()->latest()->paginate(20));
    }

    public function approve(Request $request, Classroom $classroom, ClassJoinRequest $joinRequest, ClassMembershipService $service): ClassMembershipResource
    {
        $this->authorizeJoinRequest($classroom, $joinRequest);

        return new ClassMembershipResource($service->approve($request->user(), $joinRequest));
    }

    public function reject(Request $request, Classroom $classroom, ClassJoinRequest $joinRequest, ClassMembershipService $service): ClassJoinRequestResource
    {
        $this->authorizeJoinRequest($classroom, $joinRequest);

        return new ClassJoinRequestResource($service->reject($request->user(), $joinRequest));
    }

    public function manualVerify(ManualVerifyJoinRequest $request, Classroom $classroom, ClassJoinRequest $joinRequest, ClassMembershipService $service): ClassMembershipResource
    {
        $this->authorizeJoinRequest($classroom, $joinRequest);
        $values = $request->validated();
        $roster = ClassRosterEntry::query()->findOrFail($values['roster_entry_id']);

        return new ClassMembershipResource($service->manuallyVerifyAndApprove(
            $request->user(), $joinRequest, $roster, $values['reason'], $values['note']
        ));
    }

    public function memberships(Classroom $classroom): AnonymousResourceCollection
    {
        Gate::authorize('manage', $classroom);

        return ClassMembershipResource::collection($classroom->memberships()
            ->where('status', 'active')->with(['student', 'classroom'])
            ->orderBy('joined_at')->paginate(100));
    }

    private function authorizeJoinRequest(Classroom $classroom, ClassJoinRequest $joinRequest): void
    {
        Gate::authorize('manage', $classroom);
        abort_unless($joinRequest->classroom_id === $classroom->id, 404);
    }

    private function withActiveCount(Classroom $classroom): Classroom
    {
        return $classroom->loadCount(['memberships as active_memberships_count' => fn ($query) => $query->where('status', 'active')]);
    }
}
