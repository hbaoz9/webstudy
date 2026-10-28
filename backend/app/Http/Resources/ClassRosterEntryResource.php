<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassRosterEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'orderNumber' => $this->order_number,
            'fullName' => $this->full_name,
            'studentCode' => $this->student_code,
            'linkedUserId' => $this->linked_user_id,
            'status' => $this->status,
        ];
    }
}
