<?php

namespace Tests\Feature;

use App\Models\Assessment;
use App\Models\Classroom;
use App\Models\Distribution;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DistributionPostgresConstraintsTest extends TestCase
{
    use RefreshDatabase;

    public function test_schema_types_nullability_indexes_and_fk(): void
    {
        $this->postgresOnly();
        $columns = DB::select("SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
            WHERE table_schema='public' AND table_name IN
            ('distribution_batches','distributions','distribution_commands','distribution_events','student_notifications')");
        $map = [];
        foreach ($columns as $column) $map[$column->table_name.'.'.$column->column_name] = [$column->data_type, $column->is_nullable];
        foreach (['distribution_batches.created_at', 'distributions.created_at', 'distributions.updated_at',
            'distribution_commands.created_at', 'distribution_events.created_at', 'student_notifications.created_at'] as $name) {
            $this->assertSame(['timestamp with time zone', 'NO'], $map[$name] ?? null, $name);
        }
        $this->assertSame(['timestamp with time zone', 'YES'], $map['student_notifications.read_at'] ?? null);
        $this->assertSame(['jsonb', 'NO'], $map['distribution_events.metadata'] ?? null);
        $this->assertSame(['uuid', 'NO'], $map['distributions.id'] ?? null);
        $indexes = array_column(DB::select("SELECT indexname FROM pg_indexes WHERE tablename IN
            ('distribution_batches','distributions','distribution_commands','distribution_events','student_notifications')"), 'indexname');
        foreach (['distribution_batch_key_unique', 'distribution_batch_class_unique', 'distribution_event_once_unique',
            'distribution_command_key_unique', 'student_notification_event_unique', 'distribution_class_schedule_idx'] as $name) {
            $this->assertContains($name, $indexes);
        }
        $indexDef = DB::selectOne("SELECT indexdef FROM pg_indexes WHERE indexname='distribution_teacher_created_idx'")->indexdef;
        $this->assertStringContainsString('created_at DESC', $indexDef);
        $fks = DB::select("SELECT conname, confdeltype FROM pg_constraint WHERE contype='f'
            AND conrelid IN ('distribution_batches'::regclass,'distributions'::regclass,
            'distribution_commands'::regclass,'distribution_events'::regclass,'student_notifications'::regclass)");
        $this->assertGreaterThanOrEqual(10, count($fks));
        foreach ($fks as $fk) $this->assertContains($fk->confdeltype, ['r', 'a'], $fk->conname);
    }

    public function test_database_rejects_invalid_configuration_and_mutated_history(): void
    {
        $this->postgresOnly();
        $teacher = User::factory()->create();
        $teacher->teacherProfile()->create([]);
        $assessment = Assessment::create(['teacher_id' => $teacher->id, 'title' => 'A', 'version' => 1]);
        $revision = $assessment->revisions()->create(['revision_no' => 1, 'status' => 'published',
            'title' => 'A', 'version' => 1, 'total_points' => '1', 'published_at' => now()]);
        $class = Classroom::forceCreate(['teacher_id' => $teacher->id, 'name' => '10A1',
            'academic_year' => '2026-2027', 'code' => 'DISTSCHEMA', 'status' => 'active']);
        $batch = (string) \Illuminate\Support\Str::uuid();
        DB::table('distribution_batches')->insert(['id' => $batch, 'teacher_id' => $teacher->id,
            'revision_id' => $revision->id, 'idempotency_key_hash' => str_repeat('a', 64),
            'request_hash' => str_repeat('b', 64), 'created_at' => now()]);
        $d = Distribution::create(['batch_id' => $batch, 'teacher_id' => $teacher->id,
            'classroom_id' => $class->id, 'revision_id' => $revision->id,
            'opens_at' => now(), 'deadline_at' => now()->addHour(), 'time_limit_seconds' => 60,
            'max_attempts' => 1, 'deadline_policy' => 'HARD_DEADLINE', 'lifecycle_status' => 'active']);
        $this->assertSame(1, $d->refresh()->version);
        $this->assertSame(false, DB::table('distribution_batches')->where('id', $batch)->doesntExist());
        foreach ([
            fn () => DB::table('distributions')->where('id', $d->id)->update(['time_limit_seconds' => 120, 'version' => 2]),
            fn () => DB::table('distributions')->where('id', $d->id)->delete(),
            fn () => DB::table('distribution_batches')->where('id', $batch)->delete(),
        ] as $invalid) {
            try { DB::transaction($invalid); $this->fail('Database accepted forbidden mutation.'); }
            catch (QueryException) { $this->assertTrue(true); }
        }
        $this->assertDatabaseHas('distributions', ['id' => $d->id, 'version' => 1]);
    }

    public function test_migration_down_is_reversible_inside_test_database_transaction(): void
    {
        $this->postgresOnly();
        $attemptMigration = require database_path('migrations/2026_11_18_000000_create_attempt_results_tables.php');
        $migration = require database_path('migrations/2026_11_07_000000_create_distributions_tables.php');
        DB::beginTransaction();
        try {
            $attemptMigration->down();
            $migration->down();
            foreach (['distribution_batches', 'distributions', 'distribution_commands',
                'distribution_events', 'student_notifications'] as $table) {
                $this->assertFalse(Schema::hasTable($table));
            }
        } finally {
            DB::rollBack();
        }
        $this->assertTrue(Schema::hasTable('distributions'));
    }

    private function postgresOnly(): void
    {
        if (DB::getDriverName() !== 'pgsql') $this->markTestSkipped('PostgreSQL only');
        $this->assertSame('webstudy_test', DB::selectOne('SELECT current_database() AS name')->name);
    }
}
