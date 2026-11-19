<?php

// Independent PostgreSQL connection for DistributionConcurrencyPostgresTest.
require __DIR__.'/../../vendor/autoload.php';

use App\Models\User;
use App\Models\ClassMembership;
use App\Services\ClassMembershipService;
use App\Services\DistributionService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection();
if (!$app->environment('testing') || $db->getDriverName() !== 'pgsql'
    || $db->getDatabaseName() !== 'webstudy_test'
    || $db->selectOne('SELECT current_database() AS name')->name !== 'webstudy_test') {
    fwrite(STDERR, "Unsafe Distribution race worker database.\n");
    exit(2);
}
config(['distribution.creation_enabled' => true]);
$input = json_decode($argv[1] ?? '', true, 512, JSON_THROW_ON_ERROR);
$pid = $db->selectOne('SELECT pg_backend_pid() AS pid')->pid;
echo json_encode(['ready' => true, 'pid' => $pid])."\n";
flush();
try {
    $teacher = User::findOrFail($input['teacherId']);
    $service = app(DistributionService::class);
    if ($input['action'] === 'leave') {
        $member = ClassMembership::findOrFail($input['membershipId']);
        app(ClassMembershipService::class)->leave(User::findOrFail($input['studentId']), $member);
        echo json_encode(['status' => 200, 'membership' => $member->fresh()->status, 'pid' => $pid])."\n";
    } elseif ($input['action'] === 'create') {
        $result = $service->create($teacher, $input['payload'], $input['key']);
        $status = isset($result['_replayed']) ? 200 : 201;
        echo json_encode(['status' => $status, 'batchId' => $result['batchId'], 'pid' => $pid])."\n";
    } else {
        $result = $service->command($teacher, $input['distributionId'], $input['action'],
            $input['version'], $input['reason'] ?? null, $input['key']);
        echo json_encode(['status' => 200, 'version' => $result->version,
            'lifecycle' => $result->lifecycle_status, 'pid' => $pid])."\n";
    }
} catch (HttpResponseException $exception) {
    $response = $exception->getResponse();
    echo json_encode(['status' => $response->getStatusCode(),
        'code' => $response->getData(true)['code'] ?? null, 'pid' => $pid])."\n";
} catch (Throwable $exception) {
    echo json_encode(['status' => 500, 'errorClass' => get_class($exception), 'pid' => $pid])."\n";
    exit(1);
}
