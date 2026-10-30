<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\StudentClassroomController;
use App\Http\Controllers\TeacherClassroomController;
use App\Http\Controllers\TeacherVerificationController;
use Illuminate\Support\Facades\Route;

Route::get('health', fn () => response()->json(['status' => 'ok', 'service' => 'webstudy-api']));

Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:auth-register');
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:auth-login');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('teacher-verifications/{submission}/document', [TeacherVerificationController::class, 'document']);

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
        Route::post('{classroom}/join-requests/{joinRequest}/approve', [TeacherClassroomController::class, 'approve']);
        Route::post('{classroom}/join-requests/{joinRequest}/reject', [TeacherClassroomController::class, 'reject']);
        Route::post('{classroom}/join-requests/{joinRequest}/manual-verify', [TeacherClassroomController::class, 'manualVerify']);
        Route::get('{classroom}/memberships', [TeacherClassroomController::class, 'memberships']);
    });

    Route::middleware('role:student')->prefix('student')->group(function (): void {
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
