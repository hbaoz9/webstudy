<?php

namespace App\Services;

use App\Models\Assessment;
use App\Models\AssessmentRevision;
use App\Models\QuestionBankQuestion;
use App\Models\RevisionQuestion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssessmentService
{
    private const POLICIES = [
        'single_choice' => 'exact_match', 'multiple_choice' => 'exact_set',
        'true_false' => 'boolean_match', 'true_false_group' => 'equal_per_statement',
        'short_answer' => 'numeric_match', 'essay_text' => 'manual',
    ];

    public function create(User $teacher, array $data): Assessment
    {
        return DB::transaction(function () use ($teacher, $data) {
            $assessment = Assessment::create(['teacher_id' => $teacher->id, 'title' => trim($data['title']), 'version' => 1]);
            $assessment->revisions()->create(['revision_no' => 1, 'status' => 'draft', 'title' => $assessment->title,
                'instructions' => $data['instructions'] ?? null, 'version' => 1, 'total_points' => '0.000000']);
            return $assessment->load('revisions');
        });
    }

    public function update(User $teacher, string $id, array $data): Assessment
    {
        return DB::transaction(function () use ($teacher, $id, $data) {
            $assessment = $this->lockAssessment($teacher, $id);
            $this->version($assessment->version, $data['expectedVersion']);
            $assessment->update(['title' => trim($data['title']), 'version' => $assessment->version + 1]);
            return $assessment;
        }, 3);
    }

    public function delete(User $teacher, string $id, int $expectedVersion): void
    {
        DB::transaction(function () use ($teacher, $id, $expectedVersion) {
            $assessment = $this->lockAssessment($teacher, $id);
            $this->version($assessment->version, $expectedVersion);
            $this->state(!$assessment->revisions()->where('status', 'published')->exists());
            $assessment->delete();
        }, 3);
    }

    public function createDraft(User $teacher, string $id, array $data): AssessmentRevision
    {
        return DB::transaction(function () use ($teacher, $id, $data) {
            $assessment = $this->lockAssessment($teacher, $id);
            $this->state(!$assessment->revisions()->where('status', 'draft')->exists());
            $latest = $assessment->revisions()->orderByDesc('revision_no')->firstOrFail();
            $source = null;
            if (isset($data['basedOnRevisionId'])) {
                $source = $assessment->revisions()->where('status', 'published')->findOrFail($data['basedOnRevisionId']);
            }
            $revision = $assessment->revisions()->create([
                'revision_no' => $latest->revision_no + 1, 'status' => 'draft',
                'title' => $source?->title ?? $assessment->title,
                'instructions' => $source?->instructions,
                'source_revision_id' => $source?->id,
                'version' => 1, 'total_points' => $source?->total_points ?? '0.000000',
            ]);
            if ($source) {
                foreach ($source->questions()->get() as $question) {
                    $copy = $question->replicate(['id', 'revision_id', 'created_at']);
                    $copy->revision_id = $revision->id;
                    $copy->created_at = now();
                    $copy->save();
                }
            }
            return $revision->load('questions');
        }, 3);
    }

    public function saveDraft(User $teacher, string $id, array $data): AssessmentRevision
    {
        return DB::transaction(function () use ($teacher, $id, $data) {
            $revision = $this->lockRevision($teacher, $id);
            $this->state($revision->status === 'draft');
            $this->version($revision->version, $data['expectedVersion']);
            $existing = $revision->questions()->get()->keyBy('id');
            $usedSnapshotIds = [];
            $usedSourceIds = [];
            $rows = [];
            $total = 0;
            foreach ($data['questions'] as $position => $item) {
                $points = $this->points($item['maxPoints'] ?? '1');
                $total += $points;
                $base = ['position' => $position + 1, 'max_points' => $this->decimal($points)];
                if (isset($item['revisionQuestionId'])) {
                    $question = $existing->get($item['revisionQuestionId']);
                    if (!$question || isset($usedSnapshotIds[$question->id])) {
                        throw ValidationException::withMessages(['questions' => 'Invalid or duplicate revision question.']);
                    }
                    $usedSnapshotIds[$question->id] = true;
                    $sourceId = $question->source_question_id;
                    $base['id'] = $question->id;
                    $base += $question->only(['source_question_id', 'source_question_version', 'type', 'difficulty',
                        'curriculum_lesson_id', 'public_content', 'answer_key', 'rubric', 'explanation', 'grading_policy']);
                } else {
                    $source = QuestionBankQuestion::query()->where('teacher_id', $teacher->id)
                        ->whereKey($item['sourceQuestionId'])->lockForUpdate()->first();
                    if (!$source) throw ValidationException::withMessages(['questions' => 'Source question is unavailable.']);
                    if ($source->version !== (int) $item['sourceQuestionVersion']) {
                        abort(response()->json(['message' => 'Source question version conflict.', 'code' => 'source_version_conflict'], 409));
                    }
                    $sourceId = $source->id;
                    $base += ['source_question_id' => $source->id, 'source_question_version' => $source->version,
                        'type' => $source->type, 'difficulty' => $source->difficulty,
                        'curriculum_lesson_id' => $source->curriculum_lesson_id,
                        'public_content' => $source->public_content, 'answer_key' => $source->answer_key,
                        'rubric' => $source->rubric, 'explanation' => $source->explanation,
                        'grading_policy' => self::POLICIES[$source->type]];
                }
                if (isset($usedSourceIds[$sourceId])) throw ValidationException::withMessages(['questions' => 'Duplicate source question.']);
                $usedSourceIds[$sourceId] = true;
                $rows[] = $base;
            }
            if ($total > 999999999999) throw ValidationException::withMessages(['questions' => 'Total points exceed limit.']);
            // Remove and recreate only draft rows. Existing snapshot IDs and their frozen content are retained.
            $revision->questions()->delete();
            foreach ($rows as $row) {
                $row['revision_id'] = $revision->id;
                $row['created_at'] = now();
                RevisionQuestion::create($row);
            }
            $revision->update(['title' => trim($data['title']), 'instructions' => $data['instructions'] ?? null,
                'total_points' => $this->decimal($total), 'version' => $revision->version + 1]);
            return $revision->load('questions');
        }, 3);
    }

    public function publish(User $teacher, string $id, int $expectedVersion, string $key): AssessmentRevision
    {
        return DB::transaction(function () use ($teacher, $id, $expectedVersion, $key) {
            $revision = $this->lockRevision($teacher, $id);
            $hash = hash('sha256', $key);
            if ($revision->status === 'published' && hash_equals((string) $revision->publish_key_hash, $hash)) return $revision->load('questions');
            $this->state($revision->status === 'draft');
            $this->version($revision->version, $expectedVersion);
            $this->state($revision->questions()->exists() && $revision->total_points > 0);
            $revision->update(['status' => 'published', 'published_at' => now(), 'publish_key_hash' => $hash, 'version' => $revision->version + 1]);
            return $revision->load('questions');
        }, 3);
    }

    private function lockAssessment(User $teacher, string $id): Assessment
    {
        return Assessment::query()->where('teacher_id', $teacher->id)->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function lockRevision(User $teacher, string $id): AssessmentRevision
    {
        $assessmentId = AssessmentRevision::query()->whereKey($id)->value('assessment_id');
        if (!$assessmentId) abort(404);
        $this->lockAssessment($teacher, $assessmentId);
        return AssessmentRevision::query()->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function version(int $actual, int $expected): void
    {
        if ($actual !== $expected) abort(response()->json(['message' => 'Version conflict.', 'code' => 'version_conflict'], 409));
    }

    private function state(bool $valid): void
    {
        if (!$valid) abort(response()->json(['message' => 'Lifecycle conflict.', 'code' => 'lifecycle_conflict'], 409));
    }

    private function points(string|int|float $value): int
    {
        $text = (string) $value;
        if (!preg_match('/^(?:0|[1-9]\d{0,5})(?:\.(\d{1,6}))?$/D', $text)) {
            throw ValidationException::withMessages(['questions' => 'Invalid maxPoints.']);
        }
        $parts = explode('.', $text, 2);
        $scaled = ((int) $parts[0]) * 1000000 + (int) str_pad($parts[1] ?? '', 6, '0');
        if ($scaled <= 0) throw ValidationException::withMessages(['questions' => 'maxPoints must be positive.']);
        return $scaled;
    }

    private function decimal(int $scaled): string
    {
        return intdiv($scaled, 1000000).'.'.str_pad((string) ($scaled % 1000000), 6, '0', STR_PAD_LEFT);
    }
}
