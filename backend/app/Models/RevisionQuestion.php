<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RevisionQuestion extends Model
{
    use HasUuids;

    public $timestamps = false;
    protected $guarded = [];

    protected function casts(): array { return ['public_content' => 'array', 'answer_key' => 'array', 'rubric' => 'array', 'position' => 'integer', 'source_question_version' => 'integer']; }

    public function revision(): BelongsTo { return $this->belongsTo(AssessmentRevision::class, 'revision_id'); }
}
