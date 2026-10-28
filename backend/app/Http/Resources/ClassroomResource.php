<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassroomResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $owner = $request->user()?->role === 'teacher'
            && (int) $request->user()->id === (int) $this->teacher_id;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'academicYear' => $this->academic_year,
            'description' => $this->description,
            'coverImage' => $this->cover_image_path,
            'status' => $this->status,
            'createdAt' => $this->created_at?->toIso8601String(),
            'studentCount' => $this->when($owner, $this->active_memberships_count ?? null),
        ];
    }
}
