$ErrorActionPreference = 'Stop'

$env:APP_ENV = 'testing'
$env:DB_CONNECTION = 'pgsql'
$env:DB_DATABASE = 'webstudy_test'
$env:DB_URL = ''
$env:WEBSTUDY_PG_TEST = '1'

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    php tests/bootstrap-postgres.php
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL preflight failed; no migration was run.' }

    php artisan migrate --force
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL test migration failed.' }

    php tests/bootstrap-postgres.php
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL preflight failed; no test was run.' }

    & .\vendor\bin\phpunit.bat --configuration=phpunit.pgsql.xml
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL constraint tests failed.' }
} finally {
    Pop-Location
}
