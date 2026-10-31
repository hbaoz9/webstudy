<?php

namespace App\Http\Controllers;

use App\Models\Classroom;
use App\Models\CurriculumLesson;
use App\Models\TeacherLessonContent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentLessonController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $classroom = $this->activeClassroom($request);
        if ($classroom === null) {
            return response()->json(['data' => []]);
        }

        $records = $this->visiblePublications($classroom)
            ->join('curriculum_lessons as lessons', 'lessons.id', '=', 'teacher_lesson_contents.curriculum_lesson_id')
            ->with('curriculumLesson.chapter.part')
            ->select('teacher_lesson_contents.id', 'teacher_lesson_contents.curriculum_lesson_id', 'teacher_lesson_contents.published_at')
            ->orderBy('lessons.number')
            ->orderBy('lessons.id')
            ->get();

        return response()->json(['data' => $records->map(function (TeacherLessonContent $record): array {
            return $this->metadata($record->curriculumLesson, $record);
        })->values()]);
    }

    public function show(Request $request, CurriculumLesson $curriculumLesson): JsonResponse
    {
        $classroom = $this->activeClassroom($request);
        abort_if($classroom === null, 404);

        $record = $this->visiblePublications($classroom)
            ->where('teacher_lesson_contents.curriculum_lesson_id', $curriculumLesson->id)
            ->select('teacher_lesson_contents.id', 'teacher_lesson_contents.published_content', 'teacher_lesson_contents.published_at')
            ->firstOrFail();

        return response()->json(['data' => [
            ...$this->metadata($curriculumLesson->load('chapter.part'), $record),
            'content' => $record->published_content,
        ]]);
    }

    private function activeClassroom(Request $request): ?Classroom
    {
        return $request->user()->classMemberships()
            ->where('status', 'active')
            ->whereHas('classroom', fn ($query) => $query->where('status', 'active'))
            ->with('classroom')
            ->first()?->classroom;
    }

    private function visiblePublications(Classroom $classroom): Builder
    {
        return TeacherLessonContent::query()
            ->where('teacher_lesson_contents.teacher_id', $classroom->teacher_id)
            ->whereNotNull('teacher_lesson_contents.published_content')
            ->whereHas('classrooms', fn ($query) => $query->whereKey($classroom->id));
    }

    private function metadata(CurriculumLesson $lesson, TeacherLessonContent $record): array
    {
        $chapter = $lesson->chapter;

        return [
            'id' => $lesson->id,
            'number' => $lesson->number,
            'title' => $lesson->title,
            'chapterId' => $chapter->id,
            'chapterNumber' => $chapter->number,
            'chapterTitle' => $chapter->title,
            'partId' => $chapter->part->id,
            'partNumber' => $chapter->part->number,
            'partTitle' => $chapter->part->title,
            'publishedAt' => $record->published_at?->toIso8601String(),
        ];
    }
}
