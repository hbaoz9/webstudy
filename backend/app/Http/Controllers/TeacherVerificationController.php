<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReviewTeacherVerificationRequest;
use App\Http\Requests\SubmitTeacherVerificationRequest;
use App\Http\Resources\TeacherVerificationResource;
use App\Models\TeacherVerificationSubmission;
use App\Services\TeacherVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TeacherVerificationController extends Controller
{
    public function submit(SubmitTeacherVerificationRequest $request, TeacherVerificationService $service): JsonResponse
    {
        return response()->json(['data' => new TeacherVerificationResource($service->submit($request->user(), $request->validated()))], 201);
    }

    public function status(Request $request): JsonResponse
    {
        $profile = $request->user()->teacherProfile()->first();
        abort_if($profile === null, 403);

        return response()->json(['data' => [
            'verification_status' => $profile->verification_status,
            'verified_at' => $profile->verified_at?->toIso8601String(),
            'submissions' => TeacherVerificationResource::collection(
                $profile->verificationSubmissions()->latest()->get(),
            )->resolve(),
        ]]);
    }

    public function pending(Request $request): AnonymousResourceCollection
    {
        $status = Validator::make($request->query(), [
            'status' => ['sometimes', 'in:pending,verified,rejected,all'],
        ])->validate()['status'] ?? 'pending';
        $query = TeacherVerificationSubmission::query()->with('teacher.user')->latest();

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        return TeacherVerificationResource::collection(
            $query->paginate(20),
        );
    }

    public function approve(ReviewTeacherVerificationRequest $request, TeacherVerificationSubmission $submission, TeacherVerificationService $service): TeacherVerificationResource
    {
        Gate::authorize('review', $submission);

        return new TeacherVerificationResource($service->review($request->user(), $submission, true));
    }

    public function reject(ReviewTeacherVerificationRequest $request, TeacherVerificationSubmission $submission, TeacherVerificationService $service): TeacherVerificationResource
    {
        Gate::authorize('review', $submission);

        return new TeacherVerificationResource($service->review($request->user(), $submission, false, $request->validated('reason')));
    }

    public function document(TeacherVerificationSubmission $submission): StreamedResponse
    {
        Gate::authorize('view', $submission);

        $path = $submission->document_path;
        abort_unless($path && preg_match('~\Ateacher-verifications/[A-Za-z0-9]+\.(?:pdf|jpg|jpeg|png)\z~', $path), 404);
        abort_unless(Storage::disk('local')->exists($path), 404);

        $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $submission->document_name) ?: 'verification-document';

        return Storage::disk('local')->response($path, $name, [
            'Content-Type' => $submission->document_type,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ], 'inline');
    }
}
