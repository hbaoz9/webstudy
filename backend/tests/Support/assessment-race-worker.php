<?php

// Invoked only by AssessmentConcurrencyPostgresTest in an independent PHP process.
require __DIR__.'/../../vendor/autoload.php';

use App\Models\QuestionBankQuestion;
use App\Models\User;
use App\Services\AssessmentService;
use App\Services\QuestionBankService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$database = DB::connection();
if (!$app->environment('testing') || $database->getDriverName() !== 'pgsql'
    || $database->getDatabaseName() !== 'webstudy_test'
    || $database->selectOne('select current_database() as name')->name !== 'webstudy_test') {
    fwrite(STDERR, "Unsafe race worker database.\n");
    exit(2);
}

$input = json_decode($argv[1] ?? '', true, 512, JSON_THROW_ON_ERROR);
$name = 'ws_assessment_race_'.preg_replace('/[^a-zA-Z0-9_]/', '', $input['marker']);
$database->statement("SET application_name = '".$name."'");
$pid = $database->selectOne('select pg_backend_pid() as pid')->pid;
echo json_encode(['ready' => true, 'pid' => $pid])."\n";
flush();

try {
    $teacher = User::findOrFail($input['teacherId']);
    $service = app(AssessmentService::class);
    if (in_array($input['action'], ['publishHeld', 'writeHeld', 'writeNow'], true)) {
        $database->beginTransaction();
        try {
            if ($input['action'] === 'publishHeld') {
                $service->publish($teacher, $input['revisionId'], $input['version'], $input['key']);
            } else {
                $snapshot = $database->table('revision_questions')->where('id', $input['snapshotId'])->first();
                if (!$snapshot) throw new RuntimeException('Race snapshot is missing.');
                match ($input['write']) {
                    'update' => $database->table('revision_questions')->where('id', $snapshot->id)
                        ->update(['public_content' => json_encode(['content' => 'Changed during publish'])]),
                    'delete' => $database->table('revision_questions')->where('id', $snapshot->id)->delete(),
                    'insert' => $database->table('revision_questions')->insert(array_merge((array) $snapshot, [
                        'id' => (string) Str::uuid(), 'source_question_id' => $input['secondQuestionId'],
                        'position' => 2, 'created_at' => now(),
                    ])),
                };
            }
            if ($input['action'] !== 'writeNow') {
                echo json_encode(['held' => true, 'pid' => $pid])."\n";
                flush();
                $database->selectOne('select pg_sleep(2)');
            }
            $database->commit();
            echo json_encode(['status' => 200, 'pid' => $pid])."\n";
        } catch (Throwable $exception) {
            $database->rollBack();
            throw $exception;
        }
        exit(0);
    }
    $result = match ($input['action']) {
        'createDraft' => $service->createDraft($teacher, $input['assessmentId'], []),
        'saveDraft' => $service->saveDraft($teacher, $input['revisionId'], [
            'expectedVersion' => $input['version'], 'title' => $input['title'],
            'questions' => [['revisionQuestionId' => $input['revisionQuestionId'], 'maxPoints' => '1.000000']],
        ]),
        'addSource' => $service->saveDraft($teacher, $input['revisionId'], [
            'expectedVersion' => $input['version'], 'title' => 'Source race',
            'questions' => [['sourceQuestionId' => $input['questionId'], 'sourceQuestionVersion' => $input['sourceVersion']]],
        ]),
        'publish' => $service->publish($teacher, $input['revisionId'], $input['version'], $input['key']),
        'updateSource' => app(QuestionBankService::class)->update($teacher, $input['questionId'], [
            'expectedVersion' => $input['sourceVersion'], 'type' => 'true_false',
            'lessonId' => 'geo10-kn-b07', 'difficulty' => 'recognition',
            'content' => 'Changed source', 'correctAnswer' => true,
        ]),
    };
    echo json_encode(['status' => 200, 'id' => $result->id, 'version' => $result->version,
        'content' => $result instanceof QuestionBankQuestion ? $result->public_content['content'] : null])."\n";
} catch (HttpResponseException $exception) {
    echo json_encode(['status' => $exception->getResponse()->getStatusCode(),
        'code' => $exception->getResponse()->getData(true)['code'] ?? null])."\n";
} catch (Throwable $exception) {
    echo json_encode(['status' => 500, 'errorClass' => get_class($exception)])."\n";
    exit(1);
}
