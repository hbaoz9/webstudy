<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$connection = DB::connection();
$driver = $connection->getDriverName();
$configuredDatabase = $connection->getDatabaseName();

if (! $app->environment('testing') || $driver !== 'pgsql' || $configuredDatabase !== 'webstudy_test') {
    fwrite(STDERR, sprintf(
        "Unsafe PostgreSQL test configuration: environment=%s, driver=%s, database=%s; expected testing:pgsql:webstudy_test.\n",
        $app->environment(),
        $driver,
        $configuredDatabase,
    ));
    exit(1);
}

try {
    $actualDatabase = $connection->selectOne('select current_database() as name')->name;
} catch (Throwable $exception) {
    fwrite(STDERR, "PostgreSQL test preflight failed: cannot connect to webstudy_test.\n");
    exit(1);
}

if ($actualDatabase !== 'webstudy_test') {
    fwrite(STDERR, sprintf(
        "Unsafe PostgreSQL test connection: driver=%s, configured database=%s, actual database=%s; expected pgsql:webstudy_test.\n",
        $driver,
        $configuredDatabase,
        $actualDatabase,
    ));
    exit(1);
}

echo "Verified PostgreSQL test connection: webstudy_test.\n";

// Laravel's preflight bootstrap installs handlers before PHPUnit starts.
// Restore the prior handlers so PHPUnit can track each test normally.
restore_error_handler();
restore_exception_handler();
