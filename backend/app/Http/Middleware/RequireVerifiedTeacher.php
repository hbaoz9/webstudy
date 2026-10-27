<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireVerifiedTeacher
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->role === 'teacher'
            && $request->user()->teacherProfile()->value('verification_status') === 'verified', 403);

        return $next($request);
    }
}
