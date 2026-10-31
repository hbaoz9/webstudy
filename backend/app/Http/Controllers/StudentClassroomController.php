<?php

namespace App\Http\Controllers;

use App\Http\Requests\JoinClassroomRequest;
use App\Http\Resources\ClassJoinRequestResource;
use App\Http\Resources\ClassMembershipResource;
use App\Http\Resources\ClassroomResource;
use App\Models\ClassMembership;
use App\Models\Classroom;
use App\Services\ClassMembershipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class StudentClassroomController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return ClassMembershipResource::collection($request->user()->classMemberships()
            ->where('status', 'active')->whereHas('classroom')->with('classroom')->latest()->paginate(20));
    }

    public function show(Classroom $classroom): ClassroomResource
    {
        Gate::authorize('view', $classroom);

        return new ClassroomResource($classroom);
    }

    public function lookup(string $code): ClassroomResource
    {
        $classroom = Classroom::query()->whereRaw('lower(code) = ?', [mb_strtolower(trim($code))])
            ->where('status', 'active')->firstOrFail();

        return new ClassroomResource($classroom);
    }

    public function joinRequests(Request $request): AnonymousResourceCollection
    {
        return ClassJoinRequestResource::collection($request->user()->classJoinRequests()
            ->with('classroom')->latest()->paginate(20));
    }

    public function requestJoin(JoinClassroomRequest $request, ClassMembershipService $service): JsonResponse
    {
        $values = $request->validated();

        return response()->json(['data' => new ClassJoinRequestResource($service->requestJoin(
            $request->user(), $values['class_code'], $values['student_code'] ?? null, $values['declared_class'] ?? null
        ))], 201);
    }

    public function leave(Request $request, ClassMembership $membership, ClassMembershipService $service): ClassMembershipResource
    {
        abort_unless((int) $membership->student_id === (int) $request->user()->id, 403);
        abort_if($membership->classroom === null, 404);

        return new ClassMembershipResource($service->leave($request->user(), $membership));
    }
}
