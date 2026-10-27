<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        abort_unless($request->hasSession(), 403, 'A stateful SPA request is required.');
        $data = $request->validated();
        $email = mb_strtolower(trim($data['email']));

        if (User::query()->whereRaw('lower(email) = ?', [$email])->exists()) {
            throw ValidationException::withMessages(['email' => 'This email is already registered.']);
        }

        try {
            $user = DB::transaction(function () use ($data, $email): User {
                $user = User::query()->create([
                    'name' => trim($data['name']),
                    'email' => $email,
                    'password' => $data['password'],
                ]);
                $user->forceFill(['role' => $data['role'] ?? 'student'])->save();

                if ($user->role === 'teacher') {
                    $user->teacherProfile()->create([]);
                }

                return $user->refresh();
            }, 3);
        } catch (QueryException $exception) {
            if ((string) ($exception->errorInfo[0] ?? '') === '23505'
                || str_contains($exception->getMessage(), 'users.email')) {
                throw ValidationException::withMessages(['email' => 'This email is already registered.']);
            }

            throw $exception;
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return response()->json(['data' => new UserResource($user)], 201);
    }

    public function login(LoginRequest $request): UserResource
    {
        abort_unless($request->hasSession(), 403, 'A stateful SPA request is required.');
        $data = $request->validated();

        if (! Auth::guard('web')->attempt(['email' => mb_strtolower(trim($data['email'])), 'password' => $data['password']])) {
            throw ValidationException::withMessages(['email' => 'The credentials are invalid.']);
        }

        $request->session()->regenerate();

        return new UserResource(Auth::guard('web')->user());
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        Auth::guard('sanctum')->forgetUser();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => new UserResource($request->user())]);
    }
}
