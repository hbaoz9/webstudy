<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\StudentClassroomController;
use App\Http\Controllers\StudentLessonController;
use App\Http\Controllers\TeacherClassroomController;
use App\Http\Controllers\TeacherLessonController;
use App\Http\Controllers\TeacherQuestionBankController;
use App\Http\Controllers\TeacherAssessmentController;
use App\Http\Controllers\TeacherDistributionController;
use App\Http\Controllers\StudentDistributionController;
use App\Http\Controllers\StudentAttemptController;
use App\Http\Controllers\TeacherAttemptController;
use App\Http\Controllers\InteractiveVideoController;
use App\Http\Controllers\InfographicAssetController;
use App\Http\Controllers\TeacherVerificationController;
use Illuminate\Support\Facades\Route;

Route::get('health', fn () => response()->json(['status' => 'ok', 'service' => 'webstudy-api']));

Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:auth-register');
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:auth-login');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('teacher-verifications/{submission}/document', [TeacherVerificationController::class, 'document']);

    Route::middleware('teacher.verified')->prefix('teacher/questions')->group(function (): void {
        Route::get('/', [TeacherQuestionBankController::class, 'index']);
        Route::post('/', [TeacherQuestionBankController::class, 'store']);
        Route::get('{question}', [TeacherQuestionBankController::class, 'show']);
        Route::put('{question}', [TeacherQuestionBankController::class, 'update']);
        Route::delete('{question}', [TeacherQuestionBankController::class, 'destroy']);
    });

    Route::middleware('teacher.verified')->group(function (): void {
        Route::get('teacher/infographics', [InfographicAssetController::class, 'teacherIndex']);
        Route::post('teacher/infographics', [InfographicAssetController::class, 'store']);
        Route::get('teacher/infographics/{asset}/file', [InfographicAssetController::class, 'teacherFile']);
        Route::post('teacher/infographics/{asset}/publish', [InfographicAssetController::class, 'publish']);
        Route::get('teacher/interactive-videos', [InteractiveVideoController::class, 'teacherIndex']);
        Route::post('teacher/interactive-videos', [InteractiveVideoController::class, 'store']);
        Route::get('teacher/interactive-videos/{video}', [InteractiveVideoController::class, 'teacherShow']);
        Route::put('teacher/interactive-videos/{video}', [InteractiveVideoController::class, 'update']);
        Route::delete('teacher/interactive-videos/{video}', [InteractiveVideoController::class, 'destroy']);
        Route::post('teacher/interactive-videos/{video}/publish', [InteractiveVideoController::class, 'publish']);
        Route::get('teacher/distributions/{distribution}/attempts', [TeacherAttemptController::class, 'attempts']);
        Route::get('teacher/distributions/{distribution}/results', [TeacherAttemptController::class, 'results']);
        Route::get('teacher/attempts/{attempt}', [TeacherAttemptController::class, 'show']);
        Route::get('teacher/distributions/{distribution}/exceptions', [TeacherAttemptController::class, 'exceptions']);
        Route::put('teacher/distributions/{distribution}/students/{student}/exception', [TeacherAttemptController::class, 'exception']);
        Route::post('teacher/distributions/{distribution}/students/{student}/additional-attempts', [TeacherAttemptController::class, 'grant']);
        Route::post('teacher/attempts/{attempt}/extend', [TeacherAttemptController::class, 'extend']);
        Route::post('teacher/attempts/{attempt}/revoke', [TeacherAttemptController::class, 'revoke']);
        Route::put('teacher/attempts/{attempt}/essay-grades/{question}', [TeacherAttemptController::class, 'grade']);
        Route::post('teacher/distributions/{distribution}/publish-scores', [TeacherAttemptController::class, 'publishScores']);
        Route::post('teacher/distributions/{distribution}/publish-answers', [TeacherAttemptController::class, 'publishAnswers']);
        Route::post('teacher/revisions/{revision}/questions/{question}/invalidate', [TeacherAttemptController::class, 'invalidate']);
        Route::get('teacher/revisions/{revision}/regrade-runs/{run}', [TeacherAttemptController::class, 'regrade']);
        Route::post('teacher/distributions/preview', [TeacherDistributionController::class, 'preview']);
        Route::post('teacher/distributions/batches', [TeacherDistributionController::class, 'store']);
        Route::get('teacher/distributions', [TeacherDistributionController::class, 'index']);
        Route::get('teacher/distributions/{distribution}', [TeacherDistributionController::class, 'show']);
        Route::post('teacher/distributions/{distribution}/close', [TeacherDistributionController::class, 'close']);
        Route::post('teacher/distributions/{distribution}/cancel', [TeacherDistributionController::class, 'cancel']);
        Route::get('teacher/distributions/{distribution}/events', [TeacherDistributionController::class, 'events']);
        Route::get('teacher/assessments', [TeacherAssessmentController::class, 'index']);
        Route::post('teacher/assessments', [TeacherAssessmentController::class, 'store']);
        Route::get('teacher/assessments/{assessment}', [TeacherAssessmentController::class, 'show']);
        Route::patch('teacher/assessments/{assessment}', [TeacherAssessmentController::class, 'update']);
        Route::delete('teacher/assessments/{assessment}', [TeacherAssessmentController::class, 'destroy']);
        Route::get('teacher/assessments/{assessment}/revisions', [TeacherAssessmentController::class, 'revisions']);
        Route::post('teacher/assessments/{assessment}/revisions', [TeacherAssessmentController::class, 'createRevision']);
        Route::get('teacher/revisions/{revision}', [TeacherAssessmentController::class, 'showRevision']);
        Route::put('teacher/revisions/{revision}/draft', [TeacherAssessmentController::class, 'saveDraft']);
        Route::post('teacher/revisions/{revision}/publish', [TeacherAssessmentController::class, 'publish']);
    });

    Route::middleware('teacher.verified')->prefix('teacher/lessons')->group(function (): void {
        Route::get('/', [TeacherLessonController::class, 'index']);
        Route::get('{curriculumLesson}', [TeacherLessonController::class, 'show']);
        Route::put('{curriculumLesson}/draft', [TeacherLessonController::class, 'saveDraft']);
        Route::post('{curriculumLesson}/publish', [TeacherLessonController::class, 'publish']);
        Route::post('{curriculumLesson}/withdraw', [TeacherLessonController::class, 'withdraw']);
    });

    Route::middleware('teacher.verified')->prefix('teacher/classrooms')->group(function (): void {
        Route::get('/', [TeacherClassroomController::class, 'index']);
        Route::post('/', [TeacherClassroomController::class, 'store']);
        Route::get('{classroom}', [TeacherClassroomController::class, 'show']);
        Route::put('{classroom}', [TeacherClassroomController::class, 'update']);
        Route::patch('{classroom}', [TeacherClassroomController::class, 'update']);
        Route::post('{classroom}/archive', [TeacherClassroomController::class, 'archive']);
        Route::post('{classroom}/restore', [TeacherClassroomController::class, 'restore']);
        Route::delete('{classroom}', [TeacherClassroomController::class, 'destroy']);
        Route::post('{classroom}/regenerate-code', [TeacherClassroomController::class, 'regenerateCode']);
        Route::get('{classroom}/roster', [TeacherClassroomController::class, 'roster']);
        Route::post('{classroom}/roster/import', [TeacherClassroomController::class, 'importRoster']);
        Route::get('{classroom}/join-requests', [TeacherClassroomController::class, 'joinRequests']);
        Route::post('{classroom}/join-requests/bulk-approve/preview', [TeacherClassroomController::class, 'bulkApprovalPreview']);
        Route::post('{classroom}/join-requests/bulk-approve', [TeacherClassroomController::class, 'bulkApprove']);
        Route::post('{classroom}/join-requests/{joinRequest}/approve', [TeacherClassroomController::class, 'approve']);
        Route::post('{classroom}/join-requests/{joinRequest}/reject', [TeacherClassroomController::class, 'reject']);
        Route::post('{classroom}/join-requests/{joinRequest}/manual-verify', [TeacherClassroomController::class, 'manualVerify']);
        Route::get('{classroom}/memberships', [TeacherClassroomController::class, 'memberships']);
    });

    Route::middleware('role:student')->prefix('student')->group(function (): void {
        Route::get('infographics', [InfographicAssetController::class, 'studentIndex']);
        Route::get('infographics/{asset}/file', [InfographicAssetController::class, 'studentFile']);
        Route::get('interactive-videos', [InteractiveVideoController::class, 'studentIndex']);
        Route::get('interactive-videos/{publication}', [InteractiveVideoController::class, 'studentShow']);
        Route::get('distributions/{distribution}/eligibility', [StudentAttemptController::class, 'eligibility']);
        Route::post('distributions/{distribution}/attempts', [StudentAttemptController::class, 'start']);
        Route::get('distributions/{distribution}/attempts', [StudentAttemptController::class, 'history']);
        Route::get('distributions/{distribution}/result', [StudentAttemptController::class, 'result']);
        Route::get('attempts/{attempt}', [StudentAttemptController::class, 'show']);
        Route::put('attempts/{attempt}/answers/{question}', [StudentAttemptController::class, 'save']);
        Route::post('attempts/{attempt}/submit', [StudentAttemptController::class, 'submit']);
        Route::get('distributions', [StudentDistributionController::class, 'index']);
        Route::get('distributions/history', [StudentDistributionController::class, 'history']);
        Route::get('distributions/{distribution}', [StudentDistributionController::class, 'show']);
        Route::get('notifications', [StudentDistributionController::class, 'notifications']);
        Route::post('notifications/{notification}/read', [StudentDistributionController::class, 'markRead']);
        Route::get('lessons', [StudentLessonController::class, 'index']);
        Route::get('lessons/{curriculumLesson}', [StudentLessonController::class, 'show']);
        Route::get('classrooms', [StudentClassroomController::class, 'index']);
        Route::get('classrooms/lookup/{code}', [StudentClassroomController::class, 'lookup']);
        Route::get('classrooms/{classroom}', [StudentClassroomController::class, 'show']);
        Route::get('join-requests', [StudentClassroomController::class, 'joinRequests']);
        Route::post('join-requests', [StudentClassroomController::class, 'requestJoin']);
        Route::post('memberships/{membership}/leave', [StudentClassroomController::class, 'leave']);
    });

    Route::middleware('role:teacher')->group(function (): void {
        Route::get('teacher/verification', [TeacherVerificationController::class, 'status']);
        Route::post('teacher/verification', [TeacherVerificationController::class, 'submit']);
    });

    Route::middleware('role:admin')->prefix('admin')->group(function (): void {
        Route::get('teacher-verifications', [TeacherVerificationController::class, 'pending']);
        Route::post('teacher-verifications/{submission}/approve', [TeacherVerificationController::class, 'approve']);
        Route::post('teacher-verifications/{submission}/reject', [TeacherVerificationController::class, 'reject'])
            ->name('admin.teacher-verifications.reject');
    });
});
