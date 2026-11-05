<?php

namespace Tests\Feature;

use App\Models\QuestionBankQuestion;
use App\Models\User;
use Database\Seeders\CurriculumSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuestionBankApiTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/teacher/questions';
    private const LESSON = 'geo10-kn-b07';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(CurriculumSeeder::class);
    }

    public function test_authentication_verification_and_owner_isolation(): void
    {
        $this->getJson(self::PATH)->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson(self::PATH)->assertForbidden();
        $this->actingAs($this->teacher(false))->postJson(self::PATH, $this->input())->assertForbidden();
        $owner = $this->teacher();
        $id = $this->actingAs($owner)->postJson(self::PATH, $this->input())->assertCreated()->json('data.id');
        $other = $this->teacher();
        $this->actingAs($other)->getJson(self::PATH)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson(self::PATH.'/'.$id)->assertNotFound();
        $this->putJson(self::PATH.'/'.$id, $this->input() + ['expectedVersion' => 1])->assertNotFound();
        $this->deleteJson(self::PATH.'/'.$id, ['expectedVersion' => 1])->assertNotFound();
        $this->actingAs($owner)->getJson(self::PATH.'/'.$id)->assertOk()->assertJsonPath('data.version', 1);
    }

    public function test_all_six_types_store_public_and_private_parts_separately(): void
    {
        $teacher = $this->teacher();
        $this->actingAs($teacher);
        foreach ($this->inputs() as $type => $input) {
            $response = $this->postJson(self::PATH, $input)->assertCreated()
                ->assertJsonPath('data.type', $type)->assertJsonPath('data.version', 1);
            $question = QuestionBankQuestion::findOrFail($response->json('data.id'));
            $this->assertSame($teacher->id, $question->teacher_id);
            $this->assertSame($input['content'], $question->public_content['content']);
            $this->assertArrayNotHasKey('correctAnswer', $question->public_content);
            if ($type === 'true_false_group') {
                $this->assertArrayNotHasKey('correctAnswer', $question->public_content['statements'][0]);
                $this->assertSame(['a' => true, 'b' => false], $question->answer_key['answersByStatementId']);
                $response->assertJsonPath('data.statements.0.correctAnswer', true);
            }
            if ($type === 'essay_text') {
                $this->assertNull($question->answer_key);
                $this->assertSame('Criteria', $question->rubric['rubricText']);
            } else {
                $this->assertNotNull($question->answer_key);
            }
            $this->getJson(self::PATH.'/'.$question->id)->assertOk()->assertJsonPath('data.id', $question->id);
        }
        $this->assertDatabaseCount('question_bank_questions', 6);
    }

    public function test_update_delete_and_stale_versions_preserve_history(): void
    {
        $this->actingAs($this->teacher());
        $id = $this->postJson(self::PATH, $this->input())->assertCreated()->json('data.id');
        $changed = $this->input();
        $changed['content'] = 'Updated';
        $this->putJson(self::PATH.'/'.$id, $changed + ['expectedVersion' => 1])->assertOk()
            ->assertJsonPath('data.version', 2)->assertJsonPath('data.content', 'Updated');
        $this->putJson(self::PATH.'/'.$id, $this->input() + ['expectedVersion' => 1])->assertStatus(409);
        $this->deleteJson(self::PATH.'/'.$id, ['expectedVersion' => 1])->assertStatus(409);
        $this->assertSame('Updated', QuestionBankQuestion::findOrFail($id)->public_content['content']);
        $this->deleteJson(self::PATH.'/'.$id, ['expectedVersion' => 2])->assertNoContent();
        $this->assertNotNull(QuestionBankQuestion::withTrashed()->findOrFail($id)->deleted_at);
        $this->assertDatabaseCount('question_bank_questions', 1);
        $this->getJson(self::PATH.'/'.$id)->assertNotFound();
        $this->deleteJson(self::PATH.'/'.$id, ['expectedVersion' => 2])->assertNotFound();
    }

    public function test_invalid_payloads_do_not_write_or_change_owner(): void
    {
        $teacher = $this->teacher();
        $this->actingAs($teacher);
        $invalid = [
            ['lessonId' => 'missing'], ['type' => 'unknown'], ['difficulty' => 'easy'],
            ['teacher_id' => 999], ['teacherId' => 999], ['chapter' => 'Forged'],
            ['content' => '   '], ['correctOptionId' => 'missing'],
            ['options' => [['id' => 'a', 'text' => 'One'], ['id' => 'a', 'text' => 'Two']]],
            ['options' => [['id' => 'a', 'text' => 'One']]],
            ['image' => ['url' => 'javascript:alert(1)']],
            ['image' => ['url' => 'data:image/png;base64,'.str_repeat('A', 300001)]],
        ];
        foreach ($invalid as $change) {
            $this->postJson(self::PATH, array_replace($this->input(), $change))->assertUnprocessable();
        }
        $this->postJson(self::PATH, $this->inputs()['multiple_choice'] + ['teacher_id' => 999])->assertUnprocessable();
        $this->postJson(self::PATH, $this->inputs()['true_false_group'] + ['chapter' => 'Fake'])->assertUnprocessable();
        $this->assertDatabaseCount('question_bank_questions', 0);
    }

    public function test_type_specific_invalid_answers_and_numeric_normalization(): void
    {
        $this->actingAs($this->teacher());
        $bad = $this->inputs()['multiple_choice'];
        $bad['correctOptionIds'] = ['a', 'a'];
        $this->postJson(self::PATH, $bad)->assertUnprocessable();
        $bad['correctOptionIds'] = ['a', 'unknown'];
        $this->postJson(self::PATH, $bad)->assertUnprocessable();
        $bad = $this->inputs()['true_false_group'];
        $bad['statements'][1]['id'] = 'a';
        $this->postJson(self::PATH, $bad)->assertUnprocessable();
        $bad['statements'][1]['id'] = 'b';
        $bad['statements'][1]['correctAnswer'] = 'false';
        $this->postJson(self::PATH, $bad)->assertUnprocessable();
        $bad = $this->inputs()['true_false'];
        $bad['correctAnswer'] = 'true';
        $this->postJson(self::PATH, $bad)->assertUnprocessable();
        $bad = $this->inputs()['short_answer'];
        $bad['correctAnswer'] = '12 kg';
        $this->postJson(self::PATH, $bad)->assertUnprocessable();
        $bad['correctAnswer'] = ' +0012,500 ';
        $id = $this->postJson(self::PATH, $bad)->assertCreated()->json('data.id');
        $this->assertSame('12.5', QuestionBankQuestion::findOrFail($id)->answer_key['correctAnswer']);
    }

    public function test_filters_search_sort_and_pagination_are_owner_scoped(): void
    {
        $owner = $this->teacher();
        $this->actingAs($owner);
        for ($i = 0; $i < 24; $i++) {
            $input = $this->input();
            $input['content'] = 'Atlas '.$i;
            $this->postJson(self::PATH, $input)->assertCreated();
        }
        $other = $this->teacher();
        $this->actingAs($other)->postJson(self::PATH, $this->input())->assertCreated();
        $this->actingAs($owner)->getJson(self::PATH)->assertOk()->assertJsonCount(20, 'data')
            ->assertJsonPath('meta.total', 24);
        $this->getJson(self::PATH.'?page=2&perPage=10&type=single_choice')->assertOk()
            ->assertJsonCount(10, 'data')->assertJsonPath('meta.total', 24);
        $this->getJson(self::PATH.'?q=Atlas%2023')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson(self::PATH.'?chapterId=missing')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson(self::PATH.'?sort=lesson')->assertOk();
        $this->getJson(self::PATH.'?sort=difficulty')->assertOk();
        $this->getJson(self::PATH.'?perPage=101')->assertUnprocessable();
    }

    public function test_each_type_can_be_updated_and_soft_deleted_without_changing_private_history(): void
    {
        $this->actingAs($this->teacher());
        foreach ($this->inputs() as $type => $input) {
            $id = $this->postJson(self::PATH, $input)->assertCreated()->json('data.id');
            $input['content'] = 'Updated '.$type;
            $this->putJson(self::PATH.'/'.$id, $input + ['expectedVersion' => 1])->assertOk()
                ->assertJsonPath('data.content', 'Updated '.$type)->assertJsonPath('data.version', 2);
            $this->deleteJson(self::PATH.'/'.$id, ['expectedVersion' => 2])->assertNoContent();
            $this->assertNotNull(QuestionBankQuestion::withTrashed()->findOrFail($id)->deleted_at);
        }
        $this->assertDatabaseCount('question_bank_questions', 6);
        $this->getJson(self::PATH)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_malformed_nested_payloads_return_validation_errors_instead_of_server_errors(): void
    {
        $this->actingAs($this->teacher());
        foreach ([
            ['options' => [['id' => ['nested'], 'text' => 'A'], ['id' => 'b', 'text' => 'B']]],
            ['options' => ['not-an-object', ['id' => 'b', 'text' => 'B']]],
            ['correctOptionId' => ['nested']],
            ['image' => ['url' => 'https://example.com/a.png', 'unknown' => 'value']],
        ] as $change) {
            $this->postJson(self::PATH, array_replace($this->input(), $change))->assertUnprocessable();
        }
        $multiple = $this->inputs()['multiple_choice'];
        $multiple['correctOptionIds'] = [['nested']];
        $this->postJson(self::PATH, $multiple)->assertUnprocessable();
        $group = $this->inputs()['true_false_group'];
        $group['statements'][0]['id'] = ['nested'];
        $this->postJson(self::PATH, $group)->assertUnprocessable();
        $this->assertDatabaseCount('question_bank_questions', 0);
    }

    public function test_image_urls_and_data_images_are_validated_without_fetching(): void
    {
        $this->actingAs($this->teacher());
        $input = $this->input();
        $input['image'] = ['url' => 'https://example.org/map.png', 'caption' => 'Map'];
        $this->postJson(self::PATH, $input)->assertCreated()->assertJsonPath('data.image.caption', 'Map');
        $input['image'] = ['url' => 'data:image/png;base64,'.base64_encode(base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII='))];
        $this->postJson(self::PATH, $input)->assertCreated();
        $input['image']['url'] = 'data:image/jpeg;base64,'.base64_encode('not an image');
        $this->postJson(self::PATH, $input)->assertUnprocessable();
    }

    public function test_missing_expected_version_and_failed_replacement_do_not_change_record(): void
    {
        $this->actingAs($this->teacher());
        $id = $this->postJson(self::PATH, $this->input())->assertCreated()->json('data.id');
        $this->putJson(self::PATH.'/'.$id, $this->input())->assertUnprocessable();
        $this->deleteJson(self::PATH.'/'.$id)->assertUnprocessable();
        $invalid = $this->input();
        $invalid['correctOptionId'] = 'not-an-option';
        $this->putJson(self::PATH.'/'.$id, $invalid + ['expectedVersion' => 1])->assertUnprocessable();
        $this->getJson(self::PATH.'/'.$id)->assertOk()->assertJsonPath('data.version', 1)
            ->assertJsonPath('data.correctOptionId', 'a');
    }

    private function input(): array
    {
        return [
            'type' => 'single_choice', 'lessonId' => self::LESSON,
            'difficulty' => 'recognition', 'content' => 'Where is the atlas?',
            'options' => [['id' => 'a', 'text' => 'Here'], ['id' => 'b', 'text' => 'There']],
            'correctOptionId' => 'a', 'showInLesson' => true,
        ];
    }

    private function inputs(): array
    {
        $common = ['lessonId' => self::LESSON, 'difficulty' => 'recognition', 'content' => 'Question'];
        return [
            'single_choice' => $this->input(),
            'multiple_choice' => $common + ['type' => 'multiple_choice', 'options' => [['id' => 'a', 'text' => 'A'], ['id' => 'b', 'text' => 'B']], 'correctOptionIds' => ['a', 'b']],
            'true_false' => $common + ['type' => 'true_false', 'correctAnswer' => true],
            'true_false_group' => $common + ['type' => 'true_false_group', 'statements' => [['id' => 'a', 'content' => 'A', 'correctAnswer' => true], ['id' => 'b', 'content' => 'B', 'correctAnswer' => false]]],
            'short_answer' => $common + ['type' => 'short_answer', 'correctAnswer' => '2.5'],
            'essay_text' => $common + ['type' => 'essay_text', 'rubricText' => 'Criteria'],
        ];
    }

    private function teacher(bool $verified = true): User
    {
        $teacher = User::factory()->create();
        $teacher->forceFill(['role' => 'teacher'])->save();
        $profile = $teacher->teacherProfile()->create([]);
        if ($verified) {
            $profile->forceFill(['verification_status' => 'verified', 'verified_at' => now()])->save();
        }
        return $teacher;
    }
}
