<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class CreateVerificationAdmin extends Command
{
    protected $signature = 'webstudy:admin:create {--email=} {--name=}';

    protected $description = 'Interactively create a new verification administrator';

    public function handle(): int
    {
        $email = mb_strtolower(trim((string) ($this->option('email') ?: $this->ask('Admin email'))));
        $name = trim((string) ($this->option('name') ?: $this->ask('Admin name')));

        if (! filter_var($email, FILTER_VALIDATE_EMAIL) || $name === '' || mb_strlen($name) > 255) {
            $this->error('Enter a valid email and name.');

            return self::FAILURE;
        }

        if (User::query()->where('email', $email)->exists()) {
            $this->error('This email already belongs to an account. Existing roles are never changed.');

            return self::FAILURE;
        }

        $password = (string) $this->secret('New password (at least 12 characters)');
        $confirmation = (string) $this->secret('Confirm password');
        if (mb_strlen($password) < 12 || $password !== $confirmation) {
            $this->error('Password is too short or does not match.');

            return self::FAILURE;
        }

        try {
            DB::transaction(function () use ($email, $name, $password): void {
                $admin = User::query()->create(['email' => $email, 'name' => $name, 'password' => $password]);
                $admin->forceFill(['role' => 'admin'])->save();
            });
        } catch (QueryException) {
            $this->error('Could not create admin. Check whether the email is already in use.');

            return self::FAILURE;
        }

        $this->info('Verification admin created.');

        return self::SUCCESS;
    }
}
