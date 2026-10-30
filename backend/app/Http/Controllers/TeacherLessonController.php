<?php

namespace App\Http\Controllers;

use App\Http\Requests\PublishTeacherLessonRequest;
use App\Http\Requests\SaveTeacherLessonDraftRequest;
use App\Models\CurriculumLesson;
use App\Models\TeacherLessonContent;
use App\Services\TeacherLessonService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeacherLessonController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $records = TeacherLessonContent::query()->where('teacher_id', $request->user()->id)
            ->with('classrooms:id')->get()->keyBy('curriculum_lesson_id');
        $lessons = CurriculumLesson::query()->with('chapter.part')->orderBy('number')->get();

        return response()->json(['data' => $lessons->map(fn ($lesson) => $this->present($lesson, $records->get($lesson->id))) ]);
    }

    public function show(Request $request, CurriculumLesson $curriculumLesson): JsonResponse
    {
        $record = $this->ownedRecord($request, $curriculumLesson);
        return response()->json(['data' => $this->present($curriculumLesson->load('chapter.part'), $record)]);
    }

    public function saveDraft(SaveTeacherLessonDraftRequest $request, CurriculumLesson $curriculumLesson, TeacherLessonService $service): JsonResponse
    {
        $record = $service->saveDraft($request->user(), $curriculumLesson, $request->input('content'));
        return response()->json(['data' => $this->present($curriculumLesson->load('chapter.part'), $record)]);
    }

    public function publish(PublishTeacherLessonRequest $request, CurriculumLesson $curriculumLesson, TeacherLessonService $service): JsonResponse
    {
        $record = $service->publish($request->user(), $curriculumLesson, $request->validated('classroomIds'));
        return response()->json(['data' => $this->present($curriculumLesson->load('chapter.part'), $record)]);
    }

    public function withdraw(Request $request, CurriculumLesson $curriculumLesson, TeacherLessonService $service): JsonResponse
    {
        $record = $service->withdraw($request->user(), $curriculumLesson);
        return response()->json(['data' => $this->present($curriculumLesson->load('chapter.part'), $record)]);
    }

    private function ownedRecord(Request $request, CurriculumLesson $lesson): ?TeacherLessonContent
    {
        return TeacherLessonContent::query()->where('teacher_id', $request->user()->id)
            ->where('curriculum_lesson_id', $lesson->id)->with('classrooms:id')->first();
    }

    private function present(CurriculumLesson $lesson, ?TeacherLessonContent $record): array
    {
        return [
            'id' => $lesson->id,
            'chapterId' => $lesson->chapter_id,
            'chapterNumber' => $lesson->chapter->number,
            'chapterTitle' => $lesson->chapter->title,
            'partId' => $lesson->chapter->part_id,
            'partNumber' => $lesson->chapter->part->number,
            'partTitle' => $lesson->chapter->part->title,
            'number' => $lesson->number,
            'title' => $lesson->title,
            'status' => $record?->published_content ? 'published' : ($record?->draft_content ? 'draft' : 'uncreated'),
            'draftContent' => $record?->draft_content,
            'publishedContent' => $record?->published_content,
            'publishedAt' => $record?->published_at?->toIso8601String(),
            'classroomIds' => $record?->classrooms->pluck('id')->values()->all() ?? [],
        ];
    }
}
