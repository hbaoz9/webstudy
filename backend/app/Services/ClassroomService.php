<?php

namespace App\Services;

use App\Models\Classroom;
use App\Models\ClassRosterEntry;
use App\Models\TeacherProfile;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ClassroomService
{
    private const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function create(User $teacher, array $data): Classroom
    {
        $profile = $this->teacherProfile($teacher);
        $values = $this->validateClassroom($data);

        for ($attempt = 0; $attempt < 8; $attempt++) {
            try {
                return DB::transaction(function () use ($profile, $values): Classroom {
                    $this->ensureUniqueName($profile->user_id, $values['name'], $values['academic_year']);

                    return $profile->classrooms()->create([
                        ...$values,
                        'code' => $this->generateCode(),
                    ]);
                }, 3);
            } catch (QueryException $exception) {
                if ($this->isClassCodeCollision($exception)) {
                    continue;
                }

                if ($this->isClassNameCollision($exception)) {
                    throw ValidationException::withMessages(['name' => 'A class with this name already exists in this academic year.']);
                }

                throw $exception;
            }
        }

        throw ValidationException::withMessages(['code' => 'Could not generate a unique class code.']);
    }

    public function update(User $teacher, Classroom $classroom, array $data): Classroom
    {
        $values = $this->validateClassroom($data);

        try {
            return DB::transaction(function () use ($teacher, $classroom, $values): Classroom {
                $owned = $this->ownedClassroom($teacher, $classroom, true);
                $this->ensureActive($owned);
                $this->ensureUniqueName($teacher->id, $values['name'], $values['academic_year'], $owned->id);
                $owned->fill($values)->save();

                return $owned->refresh();
            }, 3);
        } catch (QueryException $exception) {
            if ($this->isClassNameCollision($exception)) {
                throw ValidationException::withMessages(['name' => 'A class with this name already exists in this academic year.']);
            }

            throw $exception;
        }
    }

    public function archive(User $teacher, Classroom $classroom): Classroom
    {
        return DB::transaction(function () use ($teacher, $classroom): Classroom {
            $owned = $this->ownedClassroom($teacher, $classroom, true);
            $this->ensureActive($owned);
            $now = now();

            $owned->memberships()->where('status', 'active')->update(['status' => 'left', 'left_at' => $now]);
            $owned->rosterEntries()->where('status', 'joined')->update(['status' => 'not_joined', 'linked_user_id' => null]);
            $owned->joinRequests()->where('status', 'pending')->update([
                'status' => 'rejected', 'reviewed_by' => $teacher->id, 'reviewed_at' => $now,
            ]);
            $owned->forceFill(['status' => 'archived'])->save();

            return $owned->refresh();
        }, 3);
    }

    public function restore(User $teacher, Classroom $classroom): Classroom
    {
        return DB::transaction(function () use ($teacher, $classroom): Classroom {
            $owned = $this->ownedClassroom($teacher, $classroom, true);
            if ($owned->status !== 'archived') {
                throw ValidationException::withMessages(['classroom' => 'This classroom is not archived.']);
            }

            $owned->forceFill(['status' => 'active'])->save();

            return $owned->refresh();
        }, 3);
    }

    public function deleteArchived(User $teacher, Classroom $classroom): void
    {
        DB::transaction(function () use ($teacher, $classroom): void {
            $owned = $this->ownedClassroom($teacher, $classroom, true);
            if ($owned->status !== 'archived') {
                throw ValidationException::withMessages(['classroom' => 'Only archived classrooms can be deleted.']);
            }
            if ($owned->memberships()->where('status', 'active')->exists()
                || $owned->joinRequests()->where('status', 'pending')->exists()) {
                throw ValidationException::withMessages(['classroom' => 'This classroom still has active memberships or pending join requests.']);
            }

            $owned->delete();
        }, 3);
    }

    public function regenerateCode(User $teacher, Classroom $classroom): Classroom
    {
        for ($attempt = 0; $attempt < 8; $attempt++) {
            try {
                $updated = DB::transaction(function () use ($teacher, $classroom): ?Classroom {
                    $owned = $this->ownedClassroom($teacher, $classroom, true);
                    $this->ensureActive($owned);
                    $code = $this->generateCode();
                    if (strcasecmp($code, $owned->code) === 0
                        || Classroom::withTrashed()->whereRaw('lower(code) = ?', [mb_strtolower($code)])->exists()) {
                        return null;
                    }

                    $owned->forceFill(['code' => $code])->save();

                    return $owned->refresh();
                }, 3);
                if ($updated !== null) {
                    return $updated;
                }
            } catch (QueryException $exception) {
                if (! $this->isClassCodeCollision($exception)) {
                    throw $exception;
                }
            }
        }

        throw ValidationException::withMessages(['code' => 'Could not generate a unique new class code.']);
    }

    /**
     * Upserts validated spreadsheet rows by normalized student code. Existing links and
     * historical roster entries are retained when a later import omits a row.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{created: int, updated: int}
     */
    public function importRoster(User $teacher, Classroom $classroom, array $rows): array
    {
        if ($rows === []) {
            throw ValidationException::withMessages(['rows' => 'The roster must contain at least one student.']);
        }

        return DB::transaction(function () use ($teacher, $classroom, $rows): array {
            $owned = $this->ownedClassroom($teacher, $classroom, true);
            $this->ensureActive($owned);
            $existing = $owned->rosterEntries()->lockForUpdate()->get()
                ->keyBy(fn (ClassRosterEntry $entry) => ClassroomMatch::studentCode($entry->student_code));
            $seen = [];
            $created = 0;
            $updated = 0;

            foreach ($rows as $index => $row) {
                $values = Validator::make($row, [
                    'orderNumber' => ['required', 'integer', 'min:1'],
                    'fullName' => ['required', 'string', 'max:255'],
                    'studentCode' => ['required', 'string', 'max:64'],
                ])->validate();
                $code = ClassroomMatch::studentCode($values['studentCode']);

                if ($code === '' || isset($seen[$code])) {
                    throw ValidationException::withMessages(["rows.$index.studentCode" => 'Student codes must be nonempty and unique within the import.']);
                }

                $seen[$code] = true;
                $attributes = [
                    'order_number' => $values['orderNumber'],
                    'full_name' => trim($values['fullName']),
                    'student_code' => $code,
                ];

                if (trim($attributes['full_name']) === '') {
                    throw ValidationException::withMessages(["rows.$index.fullName" => 'Student name is required.']);
                }

                $entry = $existing->get($code);

                if ($entry === null) {
                    $owned->rosterEntries()->create($attributes);
                    $created++;
                } else {
                    $entry->fill($attributes)->save();
                    $updated++;
                }
            }

            $this->reconcilePendingRequests($owned);

            return compact('created', 'updated');
        }, 3);
    }

    public function removeRosterEntry(User $teacher, ClassRosterEntry $entry): void
    {
        DB::transaction(function () use ($teacher, $entry): void {
            $roster = ClassRosterEntry::query()->lockForUpdate()->findOrFail($entry->id);
            $owned = $this->ownedClassroom($teacher, $roster->classroom, true);
            $this->ensureActive($owned);

            if ($roster->linked_user_id !== null || $roster->memberships()->exists() || $roster->manualJoinRequests()->exists()) {
                throw ValidationException::withMessages(['roster' => 'This roster entry has membership history or an account link.']);
            }

            $roster->delete();
            $this->reconcilePendingRequests($owned);
        }, 3);
    }

    public function ownedClassroom(User $teacher, Classroom $classroom, bool $lock = false): Classroom
    {
        $this->teacherProfile($teacher);
        $query = Classroom::query()->whereKey($classroom->id);

        if ($lock) {
            $query->lockForUpdate();
        }

        $owned = $query->firstOrFail();

        if ((int) $owned->teacher_id !== (int) $teacher->id) {
            throw new AuthorizationException('This classroom belongs to another teacher.');
        }

        return $owned;
    }

    public function ensureActive(Classroom $classroom): void
    {
        if ($classroom->status !== 'active') {
            throw ValidationException::withMessages(['classroom' => 'This classroom is archived.']);
        }
    }

    protected function generateCode(): string
    {
        $code = '';

        for ($i = 0; $i < 6; $i++) {
            $code .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
        }

        return $code;
    }

    private function teacherProfile(User $teacher): TeacherProfile
    {
        if (User::query()->whereKey($teacher->id)->value('role') !== 'teacher') {
            throw new AuthorizationException('A teacher account with a profile is required.');
        }

        return TeacherProfile::query()->where('user_id', $teacher->id)->first()
            ?? throw new AuthorizationException('A teacher account with a profile is required.');
    }

    private function validateClassroom(array $data): array
    {
        $values = Validator::make($data, [
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'academic_year' => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'description' => ['nullable', 'string'],
            'cover_image_path' => ['nullable', 'string', 'max:255'],
        ])->validate();
        $values['name'] = trim((string) preg_replace('/^lớp\s+/iu', '', trim($values['name'])));
        $values['name'] = (string) preg_replace('/\s+/u', ' ', $values['name']);

        if (mb_strlen($values['name']) < 2) {
            throw ValidationException::withMessages(['name' => 'The class name must contain at least two characters.']);
        }

        return $values;
    }

    private function ensureUniqueName(int $teacherId, string $name, string $year, ?string $exceptId = null): void
    {
        $query = Classroom::withTrashed()->where('teacher_id', $teacherId)->where('academic_year', $year);

        if ($exceptId !== null) {
            $query->where('id', '!=', $exceptId);
        }

        $comparable = ClassroomMatch::className($name);

        if ($query->get()->contains(fn (Classroom $classroom) => ClassroomMatch::className($classroom->name) === $comparable)) {
            throw ValidationException::withMessages(['name' => 'A class with this name already exists in this academic year.']);
        }
    }

    private function reconcilePendingRequests(Classroom $classroom): void
    {
        $rosterByCode = $classroom->rosterEntries->keyBy(
            fn (ClassRosterEntry $entry) => ClassroomMatch::studentCode($entry->student_code),
        );

        foreach ($classroom->joinRequests()->where('status', 'pending')->get() as $request) {
            $verification = ClassroomMatch::verification(
                $request,
                $classroom,
                $request->student_code === null ? null : $rosterByCode->get(ClassroomMatch::studentCode($request->student_code)),
            );
            $request->forceFill(['verification_status' => $verification])->save();
        }
    }

    private function isClassCodeCollision(QueryException $exception): bool
    {
        return str_contains($exception->getMessage(), 'classrooms_code_unique')
            || str_contains($exception->getMessage(), 'classrooms_code_lower_unique')
            || str_contains($exception->getMessage(), 'classrooms.code');
    }

    private function isClassNameCollision(QueryException $exception): bool
    {
        return str_contains($exception->getMessage(), 'classrooms_teacher_id_academic_year_name_unique')
            || str_contains($exception->getMessage(), 'classrooms_teacher_year_name_lower_unique')
            || str_contains($exception->getMessage(), 'classrooms.teacher_id, classrooms.academic_year, classrooms.name');
    }
}
