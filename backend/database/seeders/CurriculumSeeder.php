<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CurriculumSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path(
            'seeders/data/geo10_curriculum.json'
        );

        $data = json_decode(
            file_get_contents($path),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        DB::transaction(function () use ($data) {
            DB::table('curriculum_parts')->upsert(
                $data['parts'],
                ['id'],
                ['number', 'title']
            );

            DB::table('curriculum_chapters')->upsert(
                $data['chapters'],
                ['id'],
                ['part_id', 'number', 'title']
            );

            DB::table('curriculum_lessons')->upsert(
                $data['lessons'],
                ['id'],
                ['chapter_id', 'number', 'title']
            );
        });
    }
}
