<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Schema;
use App\Services\AttemptService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('attempts:finalize-expired', function (AttemptService $service) {
    if (!Schema::hasTable('student_attempts')) return;
    DB::table('student_attempts')->where('status', 'IN_PROGRESS')
        ->where('expires_at', '<=', now())->orderBy('id')->pluck('id')
        ->each(fn ($id) => $service->timeout($id));
})->purpose('Finalize expired attempts from server-accepted answers');

Schedule::command('attempts:finalize-expired')->everyMinute()->withoutOverlapping();
