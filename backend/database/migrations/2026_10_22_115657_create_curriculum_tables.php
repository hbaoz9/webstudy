
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('curriculum_parts', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->unsignedSmallInteger('number')->unique();
            $table->string('title');
        });

        Schema::create('curriculum_chapters', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->string('part_id', 32);
            $table->unsignedSmallInteger('number')->unique();
            $table->string('title');

            $table->foreign('part_id')
                ->references('id')
                ->on('curriculum_parts')
                ->restrictOnDelete();
        });

        Schema::create('curriculum_lessons', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->string('chapter_id', 32);
            $table->unsignedSmallInteger('number')->unique();
            $table->string('title');

            $table->foreign('chapter_id')
                ->references('id')
                ->on('curriculum_chapters')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('curriculum_lessons');
        Schema::dropIfExists('curriculum_chapters');
        Schema::dropIfExists('curriculum_parts');
    }
};
