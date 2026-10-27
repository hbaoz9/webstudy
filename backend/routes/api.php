<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\TeacherVerificationController;
use Illuminate\Support\Facades\Route;

Route::get('health', fn () => response()->json(['status' => 'ok', 'service' => 'webstudy-api']));

Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:auth-register');
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:auth-login');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

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
