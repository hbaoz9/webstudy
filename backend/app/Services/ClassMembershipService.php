<?php

namespace App\Services;

use App\Models\ClassJoinRequest;
use App\Models\ClassMembership;
use App\Models\Classroom;
use App\Models\ClassRosterEntry;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ClassMembershipService
{
    public function __construct(private readonly ClassroomService $classrooms) {}

    public function requestJoin(User $student, string $classCode, string $studentCode, string $declaredClass): ClassJoinRequest
    {
        $code = ClassroomMatch::studentCode($studentCode);
        $declaredClass = trim($declaredClass);

        if ($code === '' || mb_strlen($code) > 64 || $declaredClass === '') {
            throw ValidationException::withMessages(['student_code' => 'A valid student code and declared class are required.']);
        }

        try {
            return DB::transaction(function () use ($student, $classCode, $code, $declaredClass): ClassJoinRequest {
                $lockedStudent = User::query()->whereKey($student->id)->lockForUpdate()->firstOrFail();

                if ($lockedStudent->role !== 'student') {
                    throw new AuthorizationException('Only student accounts can request to join a class.');
                }
                $classroom = Classroom::query()
                    ->whereRaw('lower(code) = ?', [mb_strtolower(trim($classCode))])
                    ->lockForUpdate()
                    ->firstOrFail();
                $this->classrooms->ensureActive($classroom);

                if ($lockedStudent->classMemberships()->where('status', 'active')->exists()) {
                    throw ValidationException::withMessages(['classroom' => 'The student already belongs to an active class.']);
                }

                if ($classroom->joinRequests()->where('student_id', $student->id)->where('status', 'pending')->exists()) {
                    throw ValidationException::withMessages(['classroom' => 'A join request is already pending.']);
                }

                if ($classroom->joinRequests()->where('status', 'pending')->get()->contains(
                    fn (ClassJoinRequest $pending) => ClassroomMatch::studentCode($pending->student_code) === $code,
                )) {
                    throw ValidationException::withMessages(['student_code' => 'This student code already has a pending request.']);
                }

                $roster = $this->rosterByCode($classroom, $code);
                $request = $classroom->joinRequests()->make([
                    'student_name' => $lockedStudent->name,
                    'email' => $lockedStudent->email,
                    'student_code' => $code,
                    'declared_class' => $declaredClass,
                ]);
                $request->student()->associate($lockedStudent);
                $request->forceFill([
                    'verification_status' => ClassroomMatch::verification($request, $classroom, $roster),
                ])->save();

                return $request->refresh();
            }, 3);
        } catch (QueryException $exception) {
            if ($this->isUniqueViolation($exception)) {
                throw ValidationException::withMessages(['student_code' => 'This student or code already has a pending request.']);
            }

            throw $exception;
        }
    }

    public function approve(User $teacher, ClassJoinRequest $request): ClassMembership
    {
        try {
            return DB::transaction(function () use ($teacher, $request): ClassMembership {
                [$locked, $classroom] = $this->lockRequestForTeacher($teacher, $request);

                return $this->approveLocked($teacher, $locked, $classroom);
            }, 3);
        } catch (QueryException $exception) {
            $this->throwMembershipConflict($exception);
            throw $exception;
        }
    }

    public function reject(User $teacher, ClassJoinRequest $request): ClassJoinRequest
    {
        return DB::transaction(function () use ($teacher, $request): ClassJoinRequest {
            [$locked, $classroom] = $this->lockRequestForTeacher($teacher, $request);
            $this->classrooms->ensureActive($classroom);
            $this->ensurePending($locked);
            $locked->forceFill([
                'status' => 'rejected',
                'reviewed_by' => $teacher->id,
                'reviewed_at' => now(),
            ])->save();

            return $locked->refresh();
        }, 3);
    }

    public function manuallyVerifyAndApprove(
        User $teacher,
        ClassJoinRequest $request,
        ClassRosterEntry $rosterEntry,
        string $reason,
        string $note,
    ): ClassMembership {
        if (! in_array($reason, ['wrong_student_code', 'wrong_declared_class', 'account_name_difference', 'other'], true)
            || trim($note) === '') {
            throw ValidationException::withMessages(['reason' => 'A valid reason and note are required for manual verification.']);
        }

        try {
            return DB::transaction(function () use ($teacher, $request, $rosterEntry, $reason, $note): ClassMembership {
                [$locked, $classroom] = $this->lockRequestForTeacher($teacher, $request);
                $this->classrooms->ensureActive($classroom);
                $this->ensurePending($locked);
                $roster = ClassRosterEntry::query()->whereKey($rosterEntry->id)->lockForUpdate()->firstOrFail();

                if ($roster->classroom_id !== $classroom->id) {
                    throw ValidationException::withMessages(['roster' => 'The roster entry belongs to another class.']);
                }

                if ($roster->linked_user_id !== null && (int) $roster->linked_user_id !== (int) $locked->student_id) {
                    throw ValidationException::withMessages(['roster' => 'The roster entry is linked to another account.']);
                }

                $locked->forceFill([
                    'original_student_code' => $locked->student_code,
                    'student_code' => ClassroomMatch::studentCode($roster->student_code),
                    'verification_status' => 'manual_verified',
                    'manual_roster_entry_id' => $roster->id,
                    'manual_verification_reason' => $reason,
                    'manual_verification_note' => trim($note),
                    'manually_verified_at' => now(),
                ])->save();

                return $this->approveLocked($teacher, $locked, $classroom, $roster);
            }, 3);
        } catch (QueryException $exception) {
            $this->throwMembershipConflict($exception);
            throw $exception;
        }
    }

    public function leave(User $actor, ClassMembership $membership): ClassMembership
    {
        return DB::transaction(function () use ($actor, $membership): ClassMembership {
            $student = User::query()->whereKey($membership->student_id)->lockForUpdate()->firstOrFail();
            $locked = ClassMembership::query()->whereKey($membership->id)->lockForUpdate()->firstOrFail();

            if ($actor->id !== $student->id) {
                $this->classrooms->ownedClassroom($actor, $locked->classroom, true);
            }

            if ($locked->status !== 'active') {
                throw ValidationException::withMessages(['membership' => 'This membership is no longer active.']);
            }

            $roster = ClassRosterEntry::query()->whereKey($locked->roster_entry_id)->lockForUpdate()->firstOrFail();
            $locked->forceFill(['status' => 'left', 'left_at' => now()])->save();

            if ((int) $roster->linked_user_id === (int) $student->id) {
                $roster->forceFill(['linked_user_id' => null, 'status' => 'not_joined'])->save();
            }

            return $locked->refresh();
        }, 3);
    }

    /** @return array{ClassJoinRequest, Classroom} */
    private function lockRequestForTeacher(User $teacher, ClassJoinRequest $request): array
    {
        $studentId = ClassJoinRequest::query()->whereKey($request->id)->value('student_id');
        User::query()->whereKey($studentId)->lockForUpdate()->firstOrFail();
        $locked = ClassJoinRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
        $classroom = $this->classrooms->ownedClassroom($teacher, $locked->classroom, true);

        return [$locked, $classroom];
    }

    private function approveLocked(
        User $teacher,
        ClassJoinRequest $request,
        Classroom $classroom,
        ?ClassRosterEntry $manualRoster = null,
    ): ClassMembership {
        $this->classrooms->ensureActive($classroom);
        $this->ensurePending($request);

        if ($request->student->role !== 'student'
            || $request->student->classMemberships()->where('status', 'active')->exists()) {
            throw ValidationException::withMessages(['student' => 'The student already has an active class or is not a student.']);
        }

        $roster = $manualRoster ?? $this->rosterByCode($classroom, $request->student_code, true);

        if ($roster === null) {
            throw ValidationException::withMessages(['roster' => 'No roster entry matches this student code.']);
        }

        $verification = ClassroomMatch::verification($request, $classroom, $roster);

        if (! in_array($verification, ['matched', 'manual_verified'], true)) {
            throw ValidationException::withMessages(['verification' => 'The request does not match the class roster.']);
        }

        if ($roster->linked_user_id !== null && (int) $roster->linked_user_id !== (int) $request->student_id) {
            throw ValidationException::withMessages(['roster' => 'The roster entry is linked to another account.']);
        }

        if ($request->student->linkedRosterEntries()->where('id', '!=', $roster->id)->exists()) {
            throw ValidationException::withMessages(['student' => 'The student is linked to another roster entry.']);
        }

        $roster->forceFill(['linked_user_id' => $request->student_id, 'status' => 'joined'])->save();
        $request->forceFill([
            'verification_status' => $verification,
            'status' => 'approved',
            'reviewed_by' => $teacher->id,
            'reviewed_at' => now(),
        ])->save();

        $membership = $classroom->memberships()->make([
            'roster_entry_id' => $roster->id,
            'join_request_id' => $request->id,
            'joined_at' => now(),
        ]);
        $membership->student()->associate($request->student);
        $membership->save();

        return $membership->refresh();
    }

    private function ensurePending(ClassJoinRequest $request): void
    {
        if ($request->status !== 'pending') {
            throw ValidationException::withMessages(['request' => 'The join request has already been reviewed.']);
        }
    }

    private function rosterByCode(Classroom $classroom, string $code, bool $lock = false): ?ClassRosterEntry
    {
        $query = $classroom->rosterEntries();

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->get()->first(
            fn (ClassRosterEntry $entry) => ClassroomMatch::studentCode($entry->student_code) === $code,
        );
    }

    private function throwMembershipConflict(QueryException $exception): void
    {
        if ($this->isUniqueViolation($exception)) {
            throw ValidationException::withMessages(['membership' => 'The student or roster entry was already claimed.']);
        }
    }

    private function isUniqueViolation(QueryException $exception): bool
    {
        return (string) ($exception->errorInfo[0] ?? '') === '23505'
            || ((string) ($exception->errorInfo[0] ?? '') === '23000'
                && str_contains($exception->getMessage(), 'UNIQUE constraint failed'));
    }
}
