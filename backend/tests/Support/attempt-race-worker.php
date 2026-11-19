<?php

use App\Models\Distribution;
use App\Models\User;
use App\Services\AttemptService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! $app->environment('testing') || DB::getDriverName() !== 'pgsql'
    || DB::selectOne('select current_database() as name')->name !== 'webstudy_test') exit(2);

$input = json_decode($argv[1], true, 512, JSON_THROW_ON_ERROR);
config()->set('distribution.student_attempt_enabled', true);
config()->set('distribution.student_visibility_enabled', true);
echo json_encode(['pid' => DB::selectOne('select pg_backend_pid() as pid')->pid])."\n";
flush();
try {
    $service = app(AttemptService::class);
    $student = User::findOrFail($input['studentId']);
    $result = match ($input['operation']) {
        'start' => $service->start(Distribution::findOrFail($input['distributionId']), $student, $input['key']),
        'save' => $service->saveAnswer($input['attemptId'], $input['questionId'], $student,
            $input['answer'], $input['expectedVersion'], $input['key']),
        'submit' => $service->submit($input['attemptId'], $student, $input['key']),
    };
    echo json_encode(['status' => 200, 'result' => $result])."\n";
} catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
    echo json_encode(['status' => $e->getResponse()->getStatusCode()])."\n";
} catch (Throwable $e) {
    echo json_encode(['status' => 500, 'errorType' => get_class($e)])."\n";
}
