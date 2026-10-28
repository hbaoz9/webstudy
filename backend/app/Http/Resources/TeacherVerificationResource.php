<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TeacherVerificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'teacher_id' => $this->teacher_id,
            'teacher_email' => $this->when($request->user()?->role === 'admin', fn () => $this->teacher?->user?->email),
            'full_name' => $this->full_name,
            'school_name' => $this->school_name,
            'school_address' => $this->school_address,
            'teacher_code' => $this->teacher_code,
            'position' => $this->position,
            'document' => ['name' => $this->document_name, 'type' => $this->document_type, 'size' => $this->document_size, 'available' => $this->document_path !== null],
            'status' => $this->status,
            'submitted_at' => $this->created_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'reviewed_by' => $this->reviewed_by,
            'rejection_reason' => $this->rejection_reason,
        ];
    }
}
