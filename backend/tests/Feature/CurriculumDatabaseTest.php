<?php

namespace Tests\Feature;

use App\Models\CurriculumLesson;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CurriculumDatabaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_curriculum_seed_and_relationships(): void
    {
        $this->seed(CurriculumSeeder::class);

        $this->assertDatabaseCount('curriculum_parts', 3);
        $this->assertDatabaseCount('curriculum_chapters', 13);
        $this->assertDatabaseCount('curriculum_lessons', 40);

        $lesson = CurriculumLesson::with('chapter.part')
            ->findOrFail('geo10-kn-b07');

        $this->assertSame('Nội lực và ngoại lực', $lesson->title);
        $this->assertSame('geo10-kn-c03', $lesson->chapter->id);
        $this->assertSame('geo10-kn-p02', $lesson->chapter->part->id);
    }

    public function test_curriculum_seeding_twice_has_no_duplicates(): void
    {
        $this->seed(CurriculumSeeder::class);
        $this->seed(CurriculumSeeder::class);

        $this->assertDatabaseCount('curriculum_parts', 3);
        $this->assertDatabaseCount('curriculum_chapters', 13);
        $this->assertDatabaseCount('curriculum_lessons', 40);
    }
}
