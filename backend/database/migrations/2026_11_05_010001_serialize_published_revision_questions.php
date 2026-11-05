<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') return;

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION protect_published_question() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.revision_id <> OLD.revision_id THEN
    RAISE EXCEPTION 'cannot move revision question';
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO parent_status FROM assessment_revisions WHERE id = OLD.revision_id FOR SHARE;
  ELSE
    SELECT status INTO parent_status FROM assessment_revisions WHERE id = NEW.revision_id FOR SHARE;
  END IF;
  IF parent_status = 'published' THEN
    RAISE EXCEPTION 'published question is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
SQL);
    }

    public function down(): void
    {
        // Forward-only: restoring the former trigger would reopen the published snapshot race.
    }
};
