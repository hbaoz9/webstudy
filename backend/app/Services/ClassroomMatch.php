<?php

namespace App\Services;

use App\Models\ClassJoinRequest;
use App\Models\Classroom;
use App\Models\ClassRosterEntry;
use Illuminate\Support\Str;

class ClassroomMatch
{
    public static function studentCode(string $code): string
    {
        return mb_strtoupper((string) preg_replace('/\s+/u', '', trim($code)));
    }

    public static function className(string $name): string
    {
        $ascii = mb_strtolower(Str::ascii($name));
        $withoutPrefix = preg_replace('/^lop\s*/u', '', trim($ascii));

        return (string) preg_replace('/\s+/u', '', $withoutPrefix);
    }

    public static function verification(ClassJoinRequest $request, Classroom $classroom, ?ClassRosterEntry $roster): string
    {
        if ($request->verification_status === 'manual_verified') {
            return 'manual_verified';
        }

        if (self::className($request->declared_class) !== self::className($classroom->name)) {
            return 'mismatch';
        }

        if ($roster === null) {
            return 'unverified';
        }

        if ($roster->linked_user_id !== null && (int) $roster->linked_user_id !== (int) $request->student_id) {
            return 'conflict';
        }

        return 'matched';
    }
}
