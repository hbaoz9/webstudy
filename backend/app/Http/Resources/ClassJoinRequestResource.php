<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassJoinRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $owner = $request->user()?->role === 'teacher'
            && (int) $request->user()->id === (int) $this->classroom->teacher_id;

        return [
            'id' => $this->id,
            'classroomId' => $this->classroom_id,
            'studentId' => $this->student_id,
            'studentName' => $this->student_name,
            'email' => $this->email,
            'studentCode' => $this->student_code,
            'declaredClass' => $this->declared_class,
            'requestedAt' => $this->created_at?->toIso8601String(),
            'verificationStatus' => $this->verification_status,
            'status' => $this->status,
            'manualVerification' => $this->when($owner && $this->manual_roster_entry_id !== null, fn () => [
                'rosterEntryId' => $this->manual_roster_entry_id,
                'originalStudentCode' => $this->original_student_code,
                'resolvedStudentCode' => $this->student_code,
                'reason' => $this->manual_verification_reason,
                'note' => $this->manual_verification_note,
                'verifiedAt' => $this->manually_verified_at?->toIso8601String(),
            ]),
        ];
    }
}
