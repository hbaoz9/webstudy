<?php

namespace App\Services;

use App\Models\TeacherProfile;
use App\Models\TeacherVerificationSubmission;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TeacherVerificationService
{
    public function submit(User $teacher, array $data): TeacherVerificationSubmission
    {
        try {
            return DB::transaction(function () use ($teacher, $data): TeacherVerificationSubmission {
                $profile = TeacherProfile::query()->where('user_id', $teacher->id)->lockForUpdate()->first();

                if (User::query()->whereKey($teacher->id)->value('role') !== 'teacher' || ! $profile) {
                    throw new AuthorizationException('Only teachers can submit verification.');
                }

                if ($profile->verification_status === 'verified' || $profile->verification_status === 'pending') {
                    throw ValidationException::withMessages(['verification' => 'Verification is already pending or complete.']);
                }

                $submission = $profile->verificationSubmissions()->create([
                    'full_name' => $data['full_name'],
                    'school_name' => $data['school_name'],
                    'school_address' => $data['school_address'],
                    'teacher_code' => $data['teacher_code'] ?? null,
                    'position' => $data['position'],
                    'document_name' => $data['document']['name'],
                    'document_type' => $data['document']['type'],
                    'document_size' => $data['document']['size'],
                ]);
                $profile->forceFill(['verification_status' => 'pending', 'verified_at' => null])->save();

                return $submission->refresh();
            }, 3);
        } catch (QueryException $exception) {
            if ((string) ($exception->errorInfo[0] ?? '') === '23505'
                || str_contains($exception->getMessage(), 'teacher_submission_one_pending_unique')) {
                throw ValidationException::withMessages(['verification' => 'A submission is already pending.']);
            }

            throw $exception;
        }
    }

    public function review(User $admin, TeacherVerificationSubmission $submission, bool $approve, ?string $reason = null): TeacherVerificationSubmission
    {
        if (User::query()->whereKey($admin->id)->value('role') !== 'admin') {
            throw new AuthorizationException('Only administrators can review teacher verification.');
        }

        if (! $approve && trim((string) $reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A rejection reason is required.']);
        }

        return DB::transaction(function () use ($admin, $submission, $approve, $reason): TeacherVerificationSubmission {
            $profile = TeacherProfile::query()->where('user_id', $submission->teacher_id)->lockForUpdate()->firstOrFail();
            $locked = TeacherVerificationSubmission::query()->whereKey($submission->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'pending' || $profile->verification_status !== 'pending') {
                throw ValidationException::withMessages(['verification' => 'The submission is no longer pending.']);
            }

            $now = now();
            $locked->forceFill([
                'status' => $approve ? 'verified' : 'rejected',
                'reviewed_by' => $admin->id,
                'reviewed_at' => $now,
                'rejection_reason' => $approve ? null : trim($reason),
            ])->save();
            $profile->forceFill([
                'verification_status' => $approve ? 'verified' : 'rejected',
                'verified_at' => $approve ? $now : null,
            ])->save();

            return $locked->refresh();
        }, 3);
    }
}
