
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('student');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("
                ALTER TABLE users
                ADD CONSTRAINT users_role_allowed
                CHECK (role IN ('admin', 'teacher', 'student'))
            ");

            DB::statement('
                CREATE UNIQUE INDEX users_email_lower_unique
                ON users (lower(email))
            ');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'DROP INDEX IF EXISTS users_email_lower_unique'
            );

            DB::statement(
                'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_allowed'
            );
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
