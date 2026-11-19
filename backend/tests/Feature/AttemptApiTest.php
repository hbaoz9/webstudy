<?php

namespace Tests\Feature;

use App\Models\AssessmentRevision;
use App\Models\User;
use App\Services\ClassMembershipService;
use App\Services\ClassroomService;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class AttemptApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CurriculumSeeder::class);
    }

    private function fixture(string $scorePolicy = 'HIGHEST', int $maxAttempts = 1,
        string $questionType = 'true_false_group', string $deadlinePolicy = 'HARD_DEADLINE', ?string $deadlineAt = null,
        string $scoreReleaseMode = 'AFTER_DISTRIBUTION_ENDED_AND_GRADED', string $questionPoints = '1.000000'): array
    {
        Config::set('distribution.creation_enabled', true);
        Config::set('distribution.student_attempt_enabled', true);
        Config::set('distribution.student_visibility_enabled', true);
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $teacher->teacherProfile()->create([])->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        $this->actingAs($teacher);
        $specific = match ($questionType) {
            'essay_text' => ['rubricText' => 'Chấm theo lập luận'],
            'single_choice' => ['options' => [['id' => 'a', 'text' => 'A'], ['id' => 'b', 'text' => 'B']], 'correctOptionId' => 'a'],
            'multiple_choice' => ['options' => [['id' => 'a', 'text' => 'A'], ['id' => 'b', 'text' => 'B']], 'correctOptionIds' => ['a', 'b']],
            'true_false' => ['correctAnswer' => true],
            'short_answer' => ['correctAnswer' => '1.5'],
            default => ['statements' => [
                ['id' => 'a', 'content' => 'A', 'correctAnswer' => true],
                ['id' => 'b', 'content' => 'B', 'correctAnswer' => false],
            ]],
        };
        $question = $this->postJson('/api/teacher/questions', [
            'type' => $questionType, 'lessonId' => 'geo10-kn-b07', 'difficulty' => 'recognition',
            'content' => 'Câu hỏi kiểm tra',
        ] + $specific)->assertCreated()->json('data.id');
        $assessment = $this->postJson('/api/teacher/assessments', ['title' => 'Kiểm tra'])->assertCreated()->json('data.id');
        $revision = AssessmentRevision::where('assessment_id', $assessment)->firstOrFail();
        $draft = $this->putJson('/api/teacher/revisions/'.$revision->id.'/draft', [
            'expectedVersion' => 1, 'title' => 'Kiểm tra', 'questions' => [[
                'sourceQuestionId' => $question, 'sourceQuestionVersion' => 1, 'maxPoints' => $questionPoints,
            ]],
        ])->assertOk()->json('data');
        $this->withHeader('Idempotency-Key', 'publish-attempt-test-001')
            ->postJson('/api/teacher/revisions/'.$revision->id.'/publish', ['expectedVersion' => 2])->assertOk();
        $classroom = \App\Models\Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => '10A1',
            'academic_year' => '2026-2027', 'code' => 'ATT'.strtoupper(bin2hex(random_bytes(5))), 'status' => 'active']);
        app(ClassroomService::class)->importRoster($teacher, $classroom, [[
            'orderNumber' => 1, 'fullName' => 'Student A', 'studentCode' => 'ATTEMPT-S1',
        ]]);
        $student = User::factory()->create();
        $student->forceFill(['role' => 'student'])->save();
        $join = app(ClassMembershipService::class)->requestJoin($student, $classroom->code, 'ATTEMPT-S1');
        app(ClassMembershipService::class)->approve($teacher, $join);
        $distribution = $this->withHeader('Idempotency-Key', 'create-attempt-dist-001')
            ->postJson('/api/teacher/distributions/batches', [
                'revisionId' => $revision->id, 'classroomIds' => [$classroom->id],
                'deadlineAt' => $deadlineAt ?? now()->addDay()->toIso8601String(), 'timeLimitSeconds' => 900,
                'deadlinePolicy' => $deadlinePolicy, 'scorePolicy' => $scorePolicy,
                'maxAttempts' => $maxAttempts,
                'scoreReleaseMode' => $scoreReleaseMode,
            ])->assertCreated()->json('data.distributions.0.id');
        return [$teacher, $student, $distribution, $draft['questions'][0]['id']];
    }

    public function test_start_autosave_partial_score_and_idempotent_submit(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture();
        $this->actingAs($student);
        $classroomId = DB::table('distributions')->where('id', $distribution)->value('classroom_id');
        $this->getJson('/api/student/distributions?classroomId='.$classroomId)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/student/distributions?classroomId='.(string) \Illuminate\Support\Str::uuid())
            ->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/student/distributions/'.$distribution.'/eligibility')->assertOk()->assertJsonPath('data.canStart', true);
        $start = $this->withHeader('Idempotency-Key', 'attempt-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $this->assertSame(1, $start['attemptNo']);
        $this->assertArrayNotHasKey('answerKey', $start['questions'][0]);
        $save = $this->withHeader('Idempotency-Key', 'attempt-save-key-001')
            ->putJson('/api/student/attempts/'.$start['id'].'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['a' => true]], 'expectedVersion' => 0])
            ->assertOk()->assertJsonPath('data.version', 1);
        $this->withHeader('Idempotency-Key', 'attempt-save-key-001')
            ->putJson('/api/student/attempts/'.$start['id'].'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['a' => true]], 'expectedVersion' => 0])
            ->assertOk()->assertJsonPath('data.version', 1);
        $this->withHeader('Idempotency-Key', 'attempt-save-key-002')
            ->putJson('/api/student/attempts/'.$start['id'].'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['b' => false]], 'expectedVersion' => 0])->assertStatus(409);
        $this->withHeader('Idempotency-Key', 'attempt-submit-key-001')
            ->postJson('/api/student/attempts/'.$start['id'].'/submit')->assertOk()->assertJsonPath('data.status', 'SUBMITTED');
        $this->assertDatabaseHas('student_attempts', ['id' => $start['id'], 'grading_status' => 'GRADED', 'total_score' => '0.500000']);
        $this->getJson('/api/student/distributions/'.$distribution.'/result')->assertOk()
            ->assertJsonPath('data.scoreVisible', false)->assertJsonPath('data.aggregateScore', null);
        $resultVersion = DB::table('assessment_results')->where('distribution_id', $distribution)->value('version');
        $this->getJson('/api/student/distributions/'.$distribution.'/result')->assertOk();
        $this->assertSame($resultVersion, DB::table('assessment_results')->where('distribution_id', $distribution)->value('version'));
        $this->actingAs($teacher)->getJson('/api/teacher/attempts/'.$start['id'])->assertOk()
            ->assertJsonPath('data.studentName', $student->name);
        $this->getJson('/api/teacher/distributions/'.$distribution.'/attempts')->assertOk()
            ->assertJsonPath('data.0.studentName', $student->name);
    }

    public function test_gate_ownership_and_cancel_void(): void
    {
        [$teacher, $student, $distribution] = $this->fixture();
        $this->actingAs($student);
        Config::set('distribution.student_attempt_enabled', false);
        $this->withHeader('Idempotency-Key', 'attempt-start-key-002')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertStatus(423);
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'attempt-locked-grant-key-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/students/'.$student->id.'/additional-attempts', [
                'additionalAttempts' => 1, 'reason' => 'Test gate',
            ])->assertStatus(423);
        $this->assertSame(0, DB::table('attempt_quota_grants')->count());
        $this->actingAs($student);
        Config::set('distribution.student_attempt_enabled', true);
        Config::set('distribution.student_visibility_enabled', false);
        $this->withHeader('Idempotency-Key', 'attempt-start-hidden-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertStatus(423);
        Config::set('distribution.student_visibility_enabled', true);
        $id = $this->withHeader('Idempotency-Key', 'attempt-start-key-003')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data.id');
        $other = User::factory()->create(); $other->forceFill(['role' => 'student'])->save();
        $this->actingAs($other)->getJson('/api/student/attempts/'.$id)->assertNotFound();
        $this->withHeader('Idempotency-Key', 'other-class-start-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertNotFound();
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'attempt-cancel-key-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/cancel',
                ['expectedVersion' => 1, 'reason' => 'Hủy bài'])->assertOk();
        $this->assertDatabaseHas('student_attempts', ['id' => $id, 'status' => 'CANCELLED']);
        $this->actingAs($student)->getJson('/api/student/distributions/'.$distribution.'/result')
            ->assertOk()->assertJsonPath('data.status', 'VOID');
    }

    public function test_timeout_uses_last_server_accepted_answer(): void
    {
        [, $student, $distribution, $question] = $this->fixture();
        $this->actingAs($student);
        $id = $this->withHeader('Idempotency-Key', 'timeout-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data.id');
        $this->withHeader('Idempotency-Key', 'timeout-save-key-001')
            ->putJson('/api/student/attempts/'.$id.'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['a' => true]], 'expectedVersion' => 0])->assertOk();
        DB::table('student_attempts')->where('id', $id)->update([
            'started_at' => now()->subMinutes(20), 'initial_expires_at' => now()->subMinute(),
            'expires_at' => now()->subMinute(),
        ]);
        Artisan::call('attempts:finalize-expired');
        $this->assertDatabaseHas('student_attempts', ['id' => $id, 'status' => 'TIMED_OUT']);
        $this->getJson('/api/student/attempts/'.$id)->assertOk()->assertJsonPath('data.status', 'TIMED_OUT');
        $this->assertDatabaseHas('student_attempts', ['id' => $id, 'total_score' => '0.500000',
            'finalization_reason' => 'timeout']);
        $this->withHeader('Idempotency-Key', 'timeout-save-key-002')
            ->putJson('/api/student/attempts/'.$id.'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['a' => true, 'b' => false]], 'expectedVersion' => 1])->assertStatus(409);
    }

    public function test_invalidation_regrades_all_affected_attempts_without_mutating_snapshot(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture();
        $this->actingAs($student);
        $id = $this->withHeader('Idempotency-Key', 'regrade-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data.id');
        $this->withHeader('Idempotency-Key', 'regrade-save-key-001')
            ->putJson('/api/student/attempts/'.$id.'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['a' => false]], 'expectedVersion' => 0])->assertOk();
        $this->withHeader('Idempotency-Key', 'regrade-submit-key-001')
            ->postJson('/api/student/attempts/'.$id.'/submit')->assertOk();
        $this->assertDatabaseHas('student_attempts', ['id' => $id, 'total_score' => '0.000000']);
        $revision = DB::table('distributions')->where('id', $distribution)->value('revision_id');
        $snapshot = DB::table('revision_questions')->where('id', $question)->value('public_content');
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'regrade-invalidate-001')
            ->postJson('/api/teacher/revisions/'.$revision.'/questions/'.$question.'/invalidate',
                ['reason' => 'Câu hỏi có lỗi'])->assertOk()->assertJsonPath('data.generation', 2);
        $this->assertDatabaseHas('student_attempts', ['id' => $id, 'total_score' => '1.000000']);
        $this->assertDatabaseHas('attempt_grade_items', ['attempt_id' => $id, 'revision_question_id' => $question,
            'generation' => 2, 'awarded_points' => '1.000000']);
        $this->assertSame($snapshot, DB::table('revision_questions')->where('id', $question)->value('public_content'));
    }

    public function test_teacher_exception_grant_extension_and_revoke_are_audited(): void
    {
        [$teacher, $student, $distribution] = $this->fixture();
        $this->actingAs($teacher);
        $this->withHeader('Idempotency-Key', 'student-exception-key-001')
            ->putJson('/api/teacher/distributions/'.$distribution.'/students/'.$student->id.'/exception', [
            'expectedVersion' => 0, 'lateStartUntil' => now()->addDays(2)->toIso8601String(),
            'completionDeadlineAt' => now()->addDays(2)->toIso8601String(),
            'timeLimitSeconds' => 1200, 'reason' => 'Học sinh cần thêm thời gian',
        ])->assertOk()->assertJsonPath('data.version', 1);
        $this->withHeader('Idempotency-Key', 'quota-grant-key-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/students/'.$student->id.'/additional-attempts', [
                'additionalAttempts' => 1, 'reason' => 'Cho làm thêm',
            ])->assertOk();
        $this->actingAs($student);
        $this->getJson('/api/student/distributions/'.$distribution.'/eligibility')->assertOk()
            ->assertJsonPath('data.effectiveAttemptLimit', 2);
        $attempt = $this->withHeader('Idempotency-Key', 'extend-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $this->actingAs($teacher);
        $newExpiry = \Carbon\CarbonImmutable::parse($attempt['expiresAt'])->addMinutes(5)->toIso8601String();
        $this->withHeader('Idempotency-Key', 'extend-command-key-001')
            ->postJson('/api/teacher/attempts/'.$attempt['id'].'/extend', [
                'expiresAt' => $newExpiry, 'expectedVersion' => 1, 'reason' => 'Gia hạn có lý do',
            ])->assertOk()->assertJsonPath('data.version', 2);
        $this->withHeader('Idempotency-Key', 'revoke-command-key-001')
            ->postJson('/api/teacher/attempts/'.$attempt['id'].'/revoke', [
                'expectedVersion' => 2, 'reason' => 'Lượt làm sai quy định',
            ])->assertOk()->assertJsonPath('data.status', 'REVOKED');
        $this->assertSame(1, DB::table('attempt_quota_grants')->where('distribution_id', $distribution)->count());
        $this->assertSame(1, DB::table('student_exception_events')->count());
        $this->assertDatabaseHas('student_attempts', ['id' => $attempt['id'], 'status' => 'REVOKED']);
    }

    public function test_highest_latest_and_average_use_only_completed_grades(): void
    {
        foreach (['HIGHEST' => '1.000000', 'LATEST' => '0.500000', 'AVERAGE' => '0.750000'] as $policy => $expected) {
            [, $student, $distribution, $question] = $this->fixture($policy, 2);
            $this->actingAs($student);
            foreach ([1 => ['a' => true, 'b' => false], 2 => ['a' => true]] as $number => $answers) {
                $attemptId = $this->withHeader('Idempotency-Key', 'score-start-'.$policy.'-'.$number)
                    ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data.id');
                $this->withHeader('Idempotency-Key', 'score-save-'.$policy.'-'.$number)
                    ->putJson('/api/student/attempts/'.$attemptId.'/answers/'.$question,
                        ['answer' => ['answersByStatementId' => $answers], 'expectedVersion' => 0])->assertOk();
                $this->withHeader('Idempotency-Key', 'score-submit-'.$policy.'-'.$number)
                    ->postJson('/api/student/attempts/'.$attemptId.'/submit')->assertOk();
            }
            $this->assertDatabaseHas('assessment_results', ['distribution_id' => $distribution,
                'student_id' => $student->id, 'status' => 'FINAL', 'aggregate_score' => $expected]);
        }
    }

    public function test_score_and_answer_publication_are_separate_and_block_early_key_release(): void
    {
        [$teacher, $student, $distribution] = $this->fixture('HIGHEST', 2);
        $this->actingAs($student);
        $attempt = $this->withHeader('Idempotency-Key', 'release-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $this->assertStringNotContainsString('correctAnswer', json_encode($attempt));
        $this->withHeader('Idempotency-Key', 'release-submit-key-001')
            ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk();
        $this->assertDatabaseHas('assessment_results', ['distribution_id' => $distribution, 'status' => 'PROVISIONAL']);
        $this->getJson('/api/student/distributions/'.$distribution.'/result')->assertOk()
            ->assertJsonPath('data.scoreVisible', false)->assertJsonPath('data.answerVisible', false);
        $this->actingAs($teacher);
        $this->withHeader('Idempotency-Key', 'release-answers-early-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/publish-answers')->assertStatus(409);
        $this->withHeader('Idempotency-Key', 'release-close-key-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/close', ['expectedVersion' => 1])->assertOk();
        $this->assertDatabaseHas('assessment_results', ['distribution_id' => $distribution, 'status' => 'FINAL']);
        $this->withHeader('Idempotency-Key', 'release-answers-late-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/publish-answers')->assertOk();
        $this->actingAs($student);
        $this->getJson('/api/student/distributions/'.$distribution.'/result')->assertOk()
            ->assertJsonPath('data.scoreVisible', true)->assertJsonPath('data.answerVisible', true);
    }

    public function test_essay_remains_pending_until_authorized_teacher_grades_it(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture('HIGHEST', 1, 'essay_text');
        $this->actingAs($student);
        $attempt = $this->withHeader('Idempotency-Key', 'essay-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $this->assertStringNotContainsString('rubric', json_encode($attempt));
        $this->withHeader('Idempotency-Key', 'essay-save-key-001')
            ->putJson('/api/student/attempts/'.$attempt['id'].'/answers/'.$question,
                ['answer' => ['text' => 'Giải thích có căn cứ.'], 'expectedVersion' => 0])->assertOk();
        $this->withHeader('Idempotency-Key', 'essay-submit-key-001')
            ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk()
            ->assertJsonPath('data.gradingStatus', 'PENDING_ESSAY');
        $this->assertDatabaseHas('assessment_results', ['distribution_id' => $distribution, 'status' => 'PENDING_GRADING']);
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'essay-grade-key-001')
            ->putJson('/api/teacher/attempts/'.$attempt['id'].'/essay-grades/'.$question, [
                'points' => '0.750000', 'expectedVersion' => 2, 'feedback' => 'Đạt yêu cầu',
            ])->assertOk();
        $this->assertDatabaseHas('student_attempts', ['id' => $attempt['id'], 'grading_status' => 'GRADED',
            'total_score' => '0.750000']);
        $this->assertDatabaseHas('assessment_results', ['distribution_id' => $distribution, 'status' => 'FINAL',
            'aggregate_score' => '0.750000']);
        $this->assertSame(1, DB::table('grade_events')->where('attempt_id', $attempt['id'])->count());
    }

    public function test_teacher_grading_workspace_filters_attempts_and_exposes_rubric_only_to_owner(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture('HIGHEST', 1, 'essay_text');
        $this->actingAs($teacher)->getJson('/api/teacher/distributions/'.$distribution.'/attempts?status=NOT_STARTED')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.studentId', $student->id);
        $this->actingAs($student);
        $attempt = $this->withHeader('Idempotency-Key', 'workspace-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $this->actingAs($teacher)->getJson('/api/teacher/distributions/'.$distribution.'/attempts?status=NOT_STARTED')
            ->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($student);
        $this->assertArrayNotHasKey('rubric', $attempt['questions'][0]);
        $this->withHeader('Idempotency-Key', 'workspace-save-key-001')
            ->putJson('/api/student/attempts/'.$attempt['id'].'/answers/'.$question,
                ['answer' => ['text' => 'Bài làm tự luận'], 'expectedVersion' => 0])->assertOk();
        $this->withHeader('Idempotency-Key', 'workspace-submit-key-001')
            ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk();
        $this->actingAs($teacher);
        $this->getJson('/api/teacher/distributions/'.$distribution.'/attempts?status=PENDING_ESSAY&q='.urlencode($student->name))
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/teacher/distributions/'.$distribution.'/attempts?status=IN_PROGRESS')
            ->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/teacher/attempts/'.$attempt['id'])->assertOk()
            ->assertJsonPath('data.questions.0.rubric.rubricText', 'Chấm theo lập luận')
            ->assertJsonPath('data.autoScore', '0.000000')
            ->assertJsonPath('data.totalScore', null);
        $other = User::factory()->create();
        $other->forceFill(['role' => 'teacher'])->save();
        $other->teacherProfile()->create([])->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        $this->actingAs($other)->getJson('/api/teacher/attempts/'.$attempt['id'])->assertNotFound();
    }

    public function test_essay_score_uses_frozen_five_point_maximum_and_persists_after_reload(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture('HIGHEST', 1, 'essay_text',
            'HARD_DEADLINE', null, 'AFTER_DISTRIBUTION_ENDED_AND_GRADED', '5.000000');
        $this->actingAs($student);
        $attempt = $this->withHeader('Idempotency-Key', 'five-point-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $this->withHeader('Idempotency-Key', 'five-point-save-key-001')
            ->putJson('/api/student/attempts/'.$attempt['id'].'/answers/'.$question,
                ['answer' => ['text' => 'Bài làm đã lưu'], 'expectedVersion' => 0])->assertOk();
        $this->withHeader('Idempotency-Key', 'five-point-submit-key-001')
            ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk();
        $this->actingAs($teacher);
        $url = '/api/teacher/attempts/'.$attempt['id'].'/essay-grades/'.$question;
        $this->withHeader('Idempotency-Key', 'five-point-invalid-key-001')
            ->putJson($url, ['points' => '6.000000', 'expectedVersion' => 2])->assertUnprocessable();
        $this->assertDatabaseHas('student_attempts', ['id' => $attempt['id'], 'grading_status' => 'PENDING_ESSAY']);
        $this->withHeader('Idempotency-Key', 'five-point-grade-key-001')
            ->putJson($url, ['points' => '4.500000', 'expectedVersion' => 2, 'feedback' => 'Đạt'])->assertOk();
        $this->getJson('/api/teacher/attempts/'.$attempt['id'])->assertOk()
            ->assertJsonPath('data.manualScore', '4.500000')
            ->assertJsonPath('data.totalScore', '4.500000')
            ->assertJsonPath('data.gradeItems.0.feedback', 'Đạt');
        $this->assertDatabaseHas('student_attempts', ['id' => $attempt['id'], 'version' => 3,
            'grading_status' => 'GRADED', 'total_score' => '4.500000']);
    }

    public function test_teacher_results_list_tracks_grading_and_enforces_ownership(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture('HIGHEST', 1, 'essay_text');
        $this->actingAs($student);
        $attempt = $this->withHeader('Idempotency-Key', 'results-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $this->withHeader('Idempotency-Key', 'results-answer-key-001')
            ->putJson('/api/student/attempts/'.$attempt['id'].'/answers/'.$question,
                ['answer' => ['text' => 'Bài làm'], 'expectedVersion' => 0])->assertOk();
        $this->withHeader('Idempotency-Key', 'results-submit-key-001')
            ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk();
        $url = '/api/teacher/distributions/'.$distribution.'/results';
        $this->getJson($url)->assertForbidden();
        $this->actingAs($teacher)->getJson($url.'?status=PENDING_GRADING&q='.urlencode($student->name))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.aggregateScore', null)
            ->assertJsonPath('data.0.studentId', $student->id);
        $this->withHeader('Idempotency-Key', 'results-grade-key-001')
            ->putJson('/api/teacher/attempts/'.$attempt['id'].'/essay-grades/'.$question,
                ['points' => '0.750000', 'expectedVersion' => 2])->assertOk();
        $this->getJson($url.'?status=FINAL')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.aggregateScore', '0.750000');
        $this->getJson($url.'?status=PENDING_GRADING')->assertOk()->assertJsonCount(0, 'data');
        $other = User::factory()->create();
        $other->forceFill(['role' => 'teacher'])->save();
        $other->teacherProfile()->create([])->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        $this->actingAs($other)->getJson($url)->assertNotFound();
    }

    public function test_postgres_attempt_constraints_and_partial_unique_active_index(): void
    {
        if (DB::getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        [, $student, $distribution] = $this->fixture();
        $this->actingAs($student);
        $id = $this->withHeader('Idempotency-Key', 'constraint-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data.id');
        $row = (array) DB::table('student_attempts')->where('id', $id)->first();
        $this->assertSame('jsonb', DB::selectOne("select data_type from information_schema.columns where table_name = 'student_attempts' and column_name = 'policy_snapshot'")->data_type);
        try {
            DB::transaction(fn () => DB::table('student_attempts')->where('id', $id)->update(['status' => 'INVALID']));
            $this->fail('Invalid attempt state accepted');
        } catch (\Illuminate\Database\QueryException) { $this->assertTrue(true); }
        try {
            $row['id'] = (string) \Illuminate\Support\Str::uuid();
            $row['attempt_no'] = 2;
            DB::transaction(fn () => DB::table('student_attempts')->insert($row));
            $this->fail('Second active attempt accepted');
        } catch (\Illuminate\Database\QueryException) { $this->assertTrue(true); }
        $this->assertSame(1, DB::table('student_attempts')->where('distribution_id', $distribution)->count());
    }

    public function test_hard_deadline_caps_time_but_finish_started_grants_full_limit(): void
    {
        foreach (['HARD_DEADLINE', 'FINISH_STARTED_ATTEMPT'] as $policy) {
            [, $student, $distribution] = $this->fixture('HIGHEST', 1, 'true_false_group',
                $policy, now()->addMinutes(3)->toIso8601String());
            $this->actingAs($student);
            $eligibility = $this->getJson('/api/student/distributions/'.$distribution.'/eligibility')->assertOk()->json('data');
            $this->assertTrue($eligibility['canStart'], json_encode($eligibility));
            $attempt = $this->withHeader('Idempotency-Key', 'deadline-start-'.$policy)
                ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
            $seconds = \Carbon\CarbonImmutable::parse($attempt['startedAt'])->diffInSeconds($attempt['expiresAt']);
            if ($policy === 'HARD_DEADLINE') $this->assertLessThan(300, $seconds);
            else $this->assertEqualsWithDelta(900, $seconds, 1);
        }
    }

    public function test_objective_types_use_published_keys_and_numeric_normalization(): void
    {
        $cases = [
            'single_choice' => [['optionId' => 'a'], '1.000000'],
            'multiple_choice' => [['optionIds' => ['b', 'a']], '1.000000'],
            'true_false' => [['value' => true], '1.000000'],
            'short_answer' => [['value' => '01,500'], '1.000000'],
        ];
        foreach ($cases as $type => [$answer, $score]) {
            [, $student, $distribution, $question] = $this->fixture('HIGHEST', 1, $type);
            $this->actingAs($student);
            $attempt = $this->withHeader('Idempotency-Key', 'objective-start-'.$type)
                ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
            $this->withHeader('Idempotency-Key', 'objective-save-'.$type)
                ->putJson('/api/student/attempts/'.$attempt['id'].'/answers/'.$question,
                    ['answer' => $answer, 'expectedVersion' => 0])->assertOk();
            $this->withHeader('Idempotency-Key', 'objective-submit-'.$type)
                ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk();
            $this->assertDatabaseHas('student_attempts', ['id' => $attempt['id'], 'total_score' => $score]);
        }
    }

    public function test_left_student_can_finish_existing_attempt_but_cannot_extend_after_close(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture();
        $this->actingAs($student);
        $attempt = $this->withHeader('Idempotency-Key', 'left-start-key-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $membership = \App\Models\ClassMembership::query()->where('student_id', $student->id)
            ->where('classroom_id', DB::table('distributions')->where('id', $distribution)->value('classroom_id'))->firstOrFail();
        app(ClassMembershipService::class)->leave($student, $membership);
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'left-close-key-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/close', ['expectedVersion' => 1])->assertOk();
        $before = DB::table('student_attempts')->where('id', $attempt['id'])->first();
        $newExpiry = \Carbon\CarbonImmutable::parse($attempt['expiresAt'])->addMinutes(5)->toIso8601String();
        $this->withHeader('Idempotency-Key', 'left-extend-key-001')
            ->postJson('/api/teacher/attempts/'.$attempt['id'].'/extend', [
                'expiresAt' => $newExpiry, 'expectedVersion' => 1, 'reason' => 'Cho hoàn thành lượt cũ',
            ])->assertStatus(409)->assertJsonPath('code', 'attempt_unavailable');
        $after = DB::table('student_attempts')->where('id', $attempt['id'])->first();
        $this->assertSame($before->expires_at, $after->expires_at);
        $this->assertSame($before->version, $after->version);
        $this->assertSame(0, DB::table('attempt_events')->where('attempt_id', $attempt['id'])->where('event_type', 'extended')->count());
        $this->actingAs($student)->withHeader('Idempotency-Key', 'left-save-key-001')
            ->putJson('/api/student/attempts/'.$attempt['id'].'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['a' => true]], 'expectedVersion' => 0])->assertOk();
        $this->withHeader('Idempotency-Key', 'left-submit-key-001')
            ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk();
        $this->getJson('/api/student/distributions/history')->assertOk()
            ->assertJsonFragment(['id' => $distribution]);
        $this->getJson('/api/student/distributions/history?classroomId='.
            DB::table('distributions')->where('id', $distribution)->value('classroom_id'))
            ->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/student/distributions/'.$distribution)->assertOk()
            ->assertJsonPath('data.id', $distribution);
        $this->getJson('/api/student/distributions/'.$distribution.'/eligibility')->assertOk()
            ->assertJsonPath('data.canStart', false);
        $this->getJson('/api/student/distributions/'.$distribution.'/attempts')->assertOk()->assertJsonCount(1, 'data');
        $this->withHeader('Idempotency-Key', 'left-start-key-002')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertStatus(409);
        $unrelated = User::factory()->create();
        $unrelated->forceFill(['role' => 'student'])->save();
        $this->actingAs($unrelated)->getJson('/api/student/distributions/history')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/student/distributions/'.$distribution)->assertNotFound();
        $this->getJson('/api/student/distributions/'.$distribution.'/eligibility')->assertNotFound();
        $otherTeacher = User::factory()->create();
        $otherTeacher->forceFill(['role' => 'teacher'])->save();
        $otherTeacher->teacherProfile()->create([])->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        $this->actingAs($otherTeacher)->getJson('/api/teacher/attempts/'.$attempt['id'])->assertNotFound();
    }

    public function test_close_alone_blocks_extension_without_shortening_existing_attempt(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture();
        $this->actingAs($student);
        $attempt = $this->withHeader('Idempotency-Key', 'close-only-start-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'close-only-close-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/close', ['expectedVersion' => 1])->assertOk();
        $before = DB::table('student_attempts')->where('id', $attempt['id'])->first();
        $this->withHeader('Idempotency-Key', 'close-only-extend-001')
            ->postJson('/api/teacher/attempts/'.$attempt['id'].'/extend', [
                'expiresAt' => \Carbon\CarbonImmutable::parse($attempt['expiresAt'])->addMinutes(5)->toIso8601String(),
                'expectedVersion' => 1, 'reason' => 'Gia hạn sau Close',
            ])->assertStatus(409)->assertJsonPath('code', 'attempt_unavailable');
        $after = DB::table('student_attempts')->where('id', $attempt['id'])->first();
        $this->assertSame($before->expires_at, $after->expires_at);
        $this->assertSame($before->version, $after->version);
        $this->actingAs($student)->withHeader('Idempotency-Key', 'close-only-save-001')
            ->putJson('/api/student/attempts/'.$attempt['id'].'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['a' => true]], 'expectedVersion' => 0])->assertOk();
        $this->withHeader('Idempotency-Key', 'close-only-submit-001')
            ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk();
    }

    public function test_leave_alone_blocks_extension_deadline_exception_and_extra_attempts(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture();
        $this->actingAs($student);
        $attempt = $this->withHeader('Idempotency-Key', 'leave-only-start-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $membership = \App\Models\ClassMembership::query()->whereKey(
            DB::table('student_attempts')->where('id', $attempt['id'])->value('membership_id'))->firstOrFail();
        app(ClassMembershipService::class)->leave($student, $membership);
        $this->actingAs($teacher);
        $before = DB::table('student_attempts')->where('id', $attempt['id'])->first();
        $this->withHeader('Idempotency-Key', 'leave-only-extend-001')
            ->postJson('/api/teacher/attempts/'.$attempt['id'].'/extend', [
                'expiresAt' => \Carbon\CarbonImmutable::parse($attempt['expiresAt'])->addMinutes(5)->toIso8601String(),
                'expectedVersion' => 1, 'reason' => 'Gia hạn sau rời lớp',
            ])->assertStatus(409)->assertJsonPath('code', 'membership_inactive');
        $this->withHeader('Idempotency-Key', 'leave-only-grant-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/students/'.$student->id.'/additional-attempts', [
                'additionalAttempts' => 1, 'reason' => 'Cấp lượt sau rời lớp',
            ])->assertNotFound();
        $this->withHeader('Idempotency-Key', 'leave-only-exception-001')
            ->putJson('/api/teacher/distributions/'.$distribution.'/students/'.$student->id.'/exception', [
                'expectedVersion' => 0, 'reason' => 'Đổi hạn sau rời lớp',
                'completionDeadlineAt' => now()->addDays(2)->toIso8601String(),
            ])->assertNotFound();
        $after = DB::table('student_attempts')->where('id', $attempt['id'])->first();
        $this->assertSame($before->expires_at, $after->expires_at);
        $this->assertSame($before->version, $after->version);
        $this->assertSame(0, DB::table('attempt_quota_grants')->where('distribution_id', $distribution)->count());
        $this->assertSame(0, DB::table('student_distribution_exceptions')->where('distribution_id', $distribution)->count());
        $this->actingAs($student)->withHeader('Idempotency-Key', 'leave-only-save-001')
            ->putJson('/api/student/attempts/'.$attempt['id'].'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['a' => true]], 'expectedVersion' => 0])->assertOk();
        $this->withHeader('Idempotency-Key', 'leave-only-submit-001')
            ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk();
    }

    public function test_active_attempt_uses_invalidation_generation_when_later_submitted(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture();
        $this->actingAs($student);
        $attempt = $this->withHeader('Idempotency-Key', 'active-invalidation-start-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data');
        $this->withHeader('Idempotency-Key', 'active-invalidation-save-001')
            ->putJson('/api/student/attempts/'.$attempt['id'].'/answers/'.$question,
                ['answer' => ['answersByStatementId' => ['a' => false]], 'expectedVersion' => 0])->assertOk();
        $revision = DB::table('distributions')->where('id', $distribution)->value('revision_id');
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'active-invalidation-command-001')
            ->postJson('/api/teacher/revisions/'.$revision.'/questions/'.$question.'/invalidate',
                ['reason' => 'Câu chưa rõ'])->assertOk();
        $this->actingAs($student)->withHeader('Idempotency-Key', 'active-invalidation-submit-001')
            ->postJson('/api/student/attempts/'.$attempt['id'].'/submit')->assertOk();
        $this->assertDatabaseHas('attempt_grade_items', ['attempt_id' => $attempt['id'],
            'revision_question_id' => $question, 'generation' => 2, 'awarded_points' => '1.000000']);
        $this->assertDatabaseHas('assessment_results', ['distribution_id' => $distribution,
            'active_generation' => 2, 'aggregate_score' => '1.000000']);
    }

    public function test_manual_score_release_keeps_answer_key_private(): void
    {
        [$teacher, $student, $distribution] = $this->fixture('HIGHEST', 1, 'true_false_group',
            'HARD_DEADLINE', null, 'MANUAL');
        $this->actingAs($student);
        $attemptId = $this->withHeader('Idempotency-Key', 'manual-score-start-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data.id');
        $this->withHeader('Idempotency-Key', 'manual-score-submit-001')
            ->postJson('/api/student/attempts/'.$attemptId.'/submit')->assertOk();
        $this->getJson('/api/student/distributions/'.$distribution.'/result')->assertOk()
            ->assertJsonPath('data.aggregateScore', null)->assertJsonPath('data.answerVisible', false);
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'manual-score-publish-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/publish-scores')->assertOk();
        $this->actingAs($student);
        $body = $this->getJson('/api/student/distributions/'.$distribution.'/result')->assertOk()
            ->assertJsonPath('data.scoreVisible', true)->assertJsonPath('data.answerVisible', false)->json('data');
        $this->assertSame(0, bccomp((string) $body['aggregateScore'], '0.000000', 6));
        $this->assertArrayNotHasKey('answers', $body);
    }

    public function test_manual_release_does_not_expose_partial_aggregate_while_essay_is_pending(): void
    {
        [$teacher, $student, $distribution, $question] = $this->fixture('HIGHEST', 2, 'essay_text',
            'HARD_DEADLINE', null, 'MANUAL');
        $this->actingAs($student);
        $first = $this->withHeader('Idempotency-Key', 'manual-pending-start-001')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data.id');
        $this->withHeader('Idempotency-Key', 'manual-pending-submit-001')
            ->postJson('/api/student/attempts/'.$first.'/submit')->assertOk();
        $this->actingAs($teacher)->withHeader('Idempotency-Key', 'manual-pending-publish-001')
            ->postJson('/api/teacher/distributions/'.$distribution.'/publish-scores')->assertOk();
        $this->actingAs($student);
        $second = $this->withHeader('Idempotency-Key', 'manual-pending-start-002')
            ->postJson('/api/student/distributions/'.$distribution.'/attempts')->assertCreated()->json('data.id');
        $this->withHeader('Idempotency-Key', 'manual-pending-save-001')
            ->putJson('/api/student/attempts/'.$second.'/answers/'.$question,
                ['answer' => ['text' => 'Bài tự luận'], 'expectedVersion' => 0])->assertOk();
        $this->withHeader('Idempotency-Key', 'manual-pending-submit-002')
            ->postJson('/api/student/attempts/'.$second.'/submit')->assertOk();
        $this->getJson('/api/student/distributions/'.$distribution.'/result')->assertOk()
            ->assertJsonPath('data.status', 'PENDING_GRADING')
            ->assertJsonPath('data.scoreVisible', false)
            ->assertJsonPath('data.aggregateScore', null);
    }
}
