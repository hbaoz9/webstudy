<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassMembershipResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $owner = $request->user()?->role === 'teacher'
            && (int) $request->user()->id === (int) $this->classroom->teacher_id;

        return [
            'id' => $this->id,
            'classroom' => new ClassroomResource($this->classroom),
            'status' => $this->status,
            'joinedAt' => $this->joined_at?->toIso8601String(),
            'leftAt' => $this->left_at?->toIso8601String(),
            'studentId' => $this->when($owner, $this->student_id),
            'studentName' => $this->when($owner, fn () => $this->student->name),
            'studentEmail' => $this->when($owner, fn () => $this->student->email),
            'rosterEntryId' => $this->when($owner, $this->roster_entry_id),
        ];
    }
}
