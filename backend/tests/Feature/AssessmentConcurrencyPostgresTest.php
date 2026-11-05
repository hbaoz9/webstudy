<?php

namespace Tests\Feature;

use App\Models\AssessmentRevision;
use App\Models\User;
use App\Services\AssessmentService;
use App\Services\QuestionBankService;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/** Real independent PHP processes and PostgreSQL transactions; no RefreshDatabase wrapper. */
class AssessmentConcurrencyPostgresTest extends TestCase
{
    private array $fixtureIds = [];
    private array $extraQuestionIds = [];
    private array $originalCurriculumIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        $connection = DB::connection();
        if ($connection->getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        $this->assertSame('testing', app()->environment());
        $this->assertSame('webstudy_test', $connection->getDatabaseName());
        $this->assertSame('webstudy_test', $connection->selectOne('select current_database() as name')->name);
        Artisan::call('migrate', ['--force' => true]);
        foreach (['curriculum_parts', 'curriculum_chapters', 'curriculum_lessons'] as $table) {
            $this->originalCurriculumIds[$table] = DB::table($table)->pluck('id')->all();
        }
        $this->seed(CurriculumSeeder::class);
    }

    protected function tearDown(): void
    {
        if ($this->originalCurriculumIds && DB::connection()->getDriverName() === 'pgsql'
            && DB::connection()->selectOne('select current_database() as name')->name === 'webstudy_test') {
            // Test-only cleanup, in one transaction so trigger state is always restored on failure.
            DB::transaction(function (): void {
                DB::statement('ALTER TABLE revision_questions DISABLE TRIGGER protect_published_question_delete');
                DB::statement('ALTER TABLE assessment_revisions DISABLE TRIGGER block_published_revision_delete');
                foreach ($this->fixtureIds as [$teacherId, $assessmentId, $questionId]) {
                    $revisionIds = DB::table('assessment_revisions')->where('assessment_id', $assessmentId)->pluck('id');
                    DB::table('revision_questions')->whereIn('revision_id', $revisionIds)->delete();
                    DB::table('assessment_revisions')->where('assessment_id', $assessmentId)->delete();
                    DB::table('assessments')->where('id', $assessmentId)->delete();
                    DB::table('question_bank_questions')->where('id', $questionId)->delete();
                    DB::table('question_bank_questions')->whereIn('id', $this->extraQuestionIds[$assessmentId] ?? [])->delete();
                    DB::table('teacher_profiles')->where('user_id', $teacherId)->delete();
                    DB::table('users')->where('id', $teacherId)->delete();
                }
                foreach (['curriculum_lessons', 'curriculum_chapters', 'curriculum_parts'] as $table) {
                    $keep = $this->originalCurriculumIds[$table];
                    $query = DB::table($table);
                    if ($keep) $query->whereNotIn('id', $keep);
                    $query->delete();
                }
                DB::statement('ALTER TABLE assessment_revisions ENABLE TRIGGER block_published_revision_delete');
                DB::statement('ALTER TABLE revision_questions ENABLE TRIGGER protect_published_question_delete');
            });
        }
        parent::tearDown();
    }

    public function test_two_concurrent_draft_creations_leave_exactly_one_draft(): void
    {
        [$teacher, $assessment, $revision, $question] = $this->fixture();
        app(AssessmentService::class)->publish($teacher, $revision->id, 2, 'initial-publish-key');
        $inputs = [
            ['action' => 'createDraft', 'teacherId' => $teacher->id, 'assessmentId' => $assessment->id],
            ['action' => 'createDraft', 'teacherId' => $teacher->id, 'assessmentId' => $assessment->id],
        ];
        $results = $this->race('assessments', $assessment->id, $inputs);
        $this->assertSame([200, 409], $this->statuses($results));
        $this->assertSame(1, $assessment->revisions()->where('status', 'draft')->count());
        $this->assertSame([1, 2], $assessment->revisions()->orderBy('revision_no')->pluck('revision_no')->all());
    }

    public function test_two_tabs_updating_the_same_draft_cannot_overwrite_each_other(): void
    {
        [$teacher, $assessment, $revision, $question, $snapshotId] = $this->fixture();
        $inputs = [
            ['action' => 'saveDraft', 'teacherId' => $teacher->id, 'revisionId' => $revision->id,
                'revisionQuestionId' => $snapshotId, 'version' => 2, 'title' => 'Tab A'],
            ['action' => 'saveDraft', 'teacherId' => $teacher->id, 'revisionId' => $revision->id,
                'revisionQuestionId' => $snapshotId, 'version' => 2, 'title' => 'Tab B'],
        ];
        $results = $this->race('assessments', $assessment->id, $inputs);
        $this->assertSame([200, 409], $this->statuses($results));
        $revision->refresh();
        $this->assertSame(3, $revision->version);
        $this->assertSame($results[0]['status'] === 200 ? 'Tab A' : 'Tab B', $revision->title);
        $this->assertSame(1, $revision->questions()->count());
    }

    public function test_concurrent_draft_update_and_publish_have_one_winner(): void
    {
        [$teacher, $assessment, $revision, $question, $snapshotId] = $this->fixture();
        $results = $this->race('assessments', $assessment->id, [
            ['action' => 'saveDraft', 'teacherId' => $teacher->id, 'revisionId' => $revision->id,
                'revisionQuestionId' => $snapshotId, 'version' => 2, 'title' => 'Late edit'],
            ['action' => 'publish', 'teacherId' => $teacher->id, 'revisionId' => $revision->id,
                'version' => 2, 'key' => 'race-publish-key-a'],
        ]);
        $this->assertSame([200, 409], $this->statuses($results));
        $revision->refresh();
        $this->assertSame(3, $revision->version);
        $this->assertSame($results[0]['status'] === 200 ? 'draft' : 'published', $revision->status);
        $this->assertSame($results[0]['status'] === 200 ? 'Late edit' : 'Race fixture', $revision->title);
    }

    public function test_two_concurrent_publish_requests_with_same_key_are_idempotent(): void
    {
        [$teacher, $assessment, $revision] = $this->fixture();
        $input = ['action' => 'publish', 'teacherId' => $teacher->id, 'revisionId' => $revision->id,
            'version' => 2, 'key' => 'same-publish-key'];
        $results = $this->race('assessments', $assessment->id, [$input, $input]);
        $this->assertSame([200, 200], $this->statuses($results));
        $this->assertSame($results[0]['id'], $results[1]['id']);
        $revision->refresh();
        $this->assertSame('published', $revision->status);
        $this->assertSame(3, $revision->version);
    }

    public function test_two_concurrent_publish_requests_with_different_keys_conflict(): void
    {
        [$teacher, $assessment, $revision] = $this->fixture();
        $base = ['action' => 'publish', 'teacherId' => $teacher->id, 'revisionId' => $revision->id, 'version' => 2];
        $results = $this->race('assessments', $assessment->id, [$base + ['key' => 'publish-key-a'], $base + ['key' => 'publish-key-b']]);
        $this->assertSame([200, 409], $this->statuses($results));
        $this->assertSame('published', $revision->fresh()->status);
        $this->assertSame(3, $revision->fresh()->version);
    }

    public function test_source_update_racing_add_to_draft_never_copies_a_stale_version(): void
    {
        [$teacher, $assessment, $revision, $question] = $this->fixture(false);
        $results = $this->race('question_bank_questions', $question->id, [
            ['action' => 'addSource', 'teacherId' => $teacher->id, 'revisionId' => $revision->id,
                'version' => 1, 'questionId' => $question->id, 'sourceVersion' => 1],
            ['action' => 'updateSource', 'teacherId' => $teacher->id, 'questionId' => $question->id, 'sourceVersion' => 1],
        ]);
        $this->assertSame(200, $results[1]['status']);
        $this->assertContains($results[0]['status'], [200, 409]);
        $this->assertSame(2, $question->fresh()->version);
        if ($results[0]['status'] === 200) {
            $snapshot = $revision->questions()->firstOrFail();
            $this->assertSame(1, $snapshot->source_question_version);
            $this->assertSame('Original source', $snapshot->public_content['content']);
        } else {
            $this->assertSame(0, $revision->questions()->count());
            $this->assertSame(1, $revision->fresh()->version);
        }
    }

    public function test_direct_snapshot_insert_update_delete_serialize_with_publish_in_both_orders(): void
    {
        foreach (['insert', 'update', 'delete'] as $write) {
            foreach (['publish-first', 'write-first'] as $order) {
                [$teacher, $assessment, $revision, , $snapshotId] = $this->fixture();
                $secondQuestionId = null;
                if ($write === 'insert') {
                    $secondQuestion = app(QuestionBankService::class)->create($teacher, [
                        'type' => 'true_false', 'lessonId' => 'geo10-kn-b07', 'difficulty' => 'recognition',
                        'content' => 'Second source', 'correctAnswer' => false,
                    ]);
                    $secondQuestionId = $secondQuestion->id;
                    $this->extraQuestionIds[$assessment->id][] = $secondQuestionId;
                }
                $publish = ['action' => 'publishHeld', 'teacherId' => $teacher->id,
                    'revisionId' => $revision->id, 'version' => 2, 'key' => 'snapshot-race-key'];
                $direct = ['action' => 'writeHeld', 'teacherId' => $teacher->id,
                    'snapshotId' => $snapshotId, 'secondQuestionId' => $secondQuestionId, 'write' => $write];
                [$first, $second, $overlapped, $lockWait] = $this->snapshotRace(
                    $order === 'publish-first' ? $publish : $direct,
                    $order === 'publish-first' ? array_merge($direct, ['action' => 'writeNow']) : array_merge($publish, ['action' => 'publish']),
                );
                $label = "$write / $order";
                $this->assertTrue($overlapped, "Transactions did not overlap: $label");
                $this->assertSame(200, $first['status'], $label);
                if ($order === 'publish-first') {
                    $this->assertSame('published', $revision->fresh()->status, $label);
                    $this->assertSame(1, $revision->questions()->count(), $label);
                    $this->assertSame('Original source', $revision->questions()->first()->public_content['content'], $label);
                    $this->assertSame(500, $second['status'], $label);
                } else {
                    $this->assertSame($write === 'delete' ? 'draft' : 'published', $revision->fresh()->status, $label);
                    $this->assertSame($write === 'delete' ? 0 : ($write === 'insert' ? 2 : 1), $revision->questions()->count(), $label);
                    if ($write === 'update') {
                        $this->assertSame('Changed during publish', $revision->questions()->first()->public_content['content'], $label);
                    }
                    $this->assertSame($write === 'delete' ? 409 : 200, $second['status'], $label);
                }
                $this->assertTrue($lockWait, "Second transaction did not wait for the revision lock: $label");
            }
        }
    }

    /** @return array{array, array, bool, bool} */
    private function snapshotRace(array $firstInput, array $secondInput): array
    {
        $workers = [];
        $overlapped = false;
        $lockWait = false;
        try {
            foreach ([$firstInput, $secondInput] as $index => $input) {
                $input['marker'] = bin2hex(random_bytes(6));
                $worker = new Process([PHP_BINARY, base_path('tests/Support/assessment-race-worker.php'), json_encode($input)], base_path(), [
                    'APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'webstudy_test',
                    'DB_URL' => '', 'WEBSTUDY_PG_TEST' => '1',
                ]);
                $worker->setTimeout(15);
                $worker->start();
                $workers[] = $worker;
                if ($index === 0) {
                    $deadline = microtime(true) + 8;
                    while (!str_contains($worker->getOutput(), '"held":true') && microtime(true) < $deadline) usleep(20000);
                    $this->assertStringContainsString('"held":true', $worker->getOutput(), $worker->getErrorOutput());
                }
            }
            $deadline = microtime(true) + 1.5;
            do {
                $line = strtok($workers[1]->getOutput(), "\n");
                $ready = $line ? json_decode($line, true) : null;
                if (isset($ready['pid'])) {
                    $overlapped = $workers[0]->isRunning() && $workers[1]->isRunning();
                    $lockWait = DB::table('pg_stat_activity')->where('pid', $ready['pid'])->where('wait_event_type', 'Lock')->exists();
                    if ($lockWait || !$workers[1]->isRunning()) break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $results = [];
            foreach ($workers as $worker) {
                $worker->wait();
                $lines = array_values(array_filter(explode("\n", trim($worker->getOutput()))));
                $results[] = json_decode(end($lines) ?: '', true);
                $this->assertIsArray(end($results), $worker->getOutput().' '.$worker->getErrorOutput());
            }
            return [$results[0], $results[1], $overlapped, $lockWait];
        } finally {
            foreach ($workers as $worker) if ($worker->isRunning()) $worker->stop(1);
        }
    }

    /** @return array{User, \App\Models\Assessment, AssessmentRevision, \App\Models\QuestionBankQuestion, string|null} */
    private function fixture(bool $withSnapshot = true): array
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create(['verification_status' => 'verified', 'verified_at' => now()]);
        $question = app(QuestionBankService::class)->create($teacher, [
            'type' => 'true_false', 'lessonId' => 'geo10-kn-b07', 'difficulty' => 'recognition',
            'content' => 'Original source', 'correctAnswer' => true,
        ]);
        $assessment = app(AssessmentService::class)->create($teacher, ['title' => 'Race fixture']);
        $this->fixtureIds[] = [$teacher->id, $assessment->id, $question->id];
        $revision = $assessment->revisions()->firstOrFail();
        $snapshotId = null;
        if ($withSnapshot) {
            $revision = app(AssessmentService::class)->saveDraft($teacher, $revision->id, [
                'expectedVersion' => 1, 'title' => 'Race fixture',
                'questions' => [['sourceQuestionId' => $question->id, 'sourceQuestionVersion' => 1]],
            ]);
            $snapshotId = $revision->questions()->firstOrFail()->id;
        }
        return [$teacher, $assessment, $revision, $question, $snapshotId];
    }

    /** Hold a row in the coordinator, then observe both independent connections waiting on it before release. */
    private function race(string $table, string $id, array $inputs): array
    {
        $connection = DB::connection();
        $marker = bin2hex(random_bytes(6));
        $workers = [];
        $pids = [];
        $connection->beginTransaction();
        try {
            $connection->table($table)->where('id', $id)->lockForUpdate()->first();
            foreach ($inputs as $input) {
                $input['marker'] = $marker;
                $worker = new Process([PHP_BINARY, base_path('tests/Support/assessment-race-worker.php'), json_encode($input)], base_path(), [
                    'APP_ENV' => 'testing', 'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'webstudy_test',
                    'DB_URL' => '', 'WEBSTUDY_PG_TEST' => '1',
                ]);
                $worker->setTimeout(20);
                $worker->start();
                $workers[] = $worker;
            }
            $deadline = microtime(true) + 10;
            do {
                $pids = [];
                foreach ($workers as $worker) {
                    $line = strtok($worker->getOutput(), "\n");
                    $ready = $line ? json_decode($line, true) : null;
                    if (isset($ready['pid'])) $pids[] = $ready['pid'];
                }
                if (count($pids) === 2) {
                    $waiting = (int) $connection->table('pg_stat_activity')->whereIn('pid', $pids)
                        ->where('wait_event_type', 'Lock')->count();
                    if ($waiting === 2) break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertCount(2, $pids, 'Both workers must reach independent PostgreSQL connections');
            $this->assertSame(2, $waiting ?? 0, 'Both transactions must overlap while blocked on the held row');
        } finally {
            $connection->commit();
        }
        $results = [];
        foreach ($workers as $worker) {
            $worker->wait();
            $lines = array_values(array_filter(explode("\n", trim($worker->getOutput()))));
            $result = json_decode(end($lines) ?: '', true);
            $this->assertIsArray($result, $worker->getErrorOutput());
            $this->assertContains($result['status'] ?? null, [200, 409], $worker->getOutput().' '.$worker->getErrorOutput());
            $results[] = $result;
        }
        return $results;
    }

    private function statuses(array $results): array
    {
        $statuses = array_column($results, 'status');
        sort($statuses);
        return $statuses;
    }
}
