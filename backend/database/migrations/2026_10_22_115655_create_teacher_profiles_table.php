
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_profiles', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->primary()
                ->constrained('users')
                ->cascadeOnDelete();

            $table->string('verification_status', 20)
                ->default('unverified');

            $table->timestampTz('verified_at')->nullable();
            $table->timestampsTz();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("
                ALTER TABLE teacher_profiles
                ADD CONSTRAINT teacher_verification_status_allowed
                CHECK (
                    verification_status IN (
                        'unverified',
                        'pending',
                        'verified',
                        'rejected'
                    )
                )
            ");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_profiles');
    }
};
