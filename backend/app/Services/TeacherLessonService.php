<?php

namespace App\Services;

use App\Models\Classroom;
use App\Models\CurriculumLesson;
use App\Models\TeacherLessonContent;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TeacherLessonService
{
    public function saveDraft(User $teacher, CurriculumLesson $lesson, array $content): TeacherLessonContent
    {
        $content['explanation'] = (string) ($content['explanation'] ?? '');
        foreach (($content['sections'] ?? []) as &$section) {
            $section['title'] = (string) ($section['title'] ?? '');
            $section['content'] = (string) ($section['content'] ?? '');
        }
        unset($section);
        $content['lessonId'] = $lesson->getKey();
        $content['status'] = 'draft';
        $content['updatedAt'] = now()->toIso8601String();
        unset($content['draft']);

        return DB::transaction(function () use ($teacher, $lesson, $content) {
            $record = TeacherLessonContent::firstOrCreate([
                'teacher_id' => $teacher->id,
                'curriculum_lesson_id' => $lesson->getKey(),
            ]);
            $record->draft_content = $content;
            $record->save();

            return $record->load('classrooms');
        });
    }

    public function publish(User $teacher, CurriculumLesson $lesson, array $classroomIds): TeacherLessonContent
    {
        return DB::transaction(function () use ($teacher, $lesson, $classroomIds) {
            $record = TeacherLessonContent::query()
                ->where('teacher_id', $teacher->id)
                ->where('curriculum_lesson_id', $lesson->getKey())
                ->lockForUpdate()->first();
            if (! $record || ! $record->draft_content) {
                throw ValidationException::withMessages(['content' => 'Hãy lưu bản nháp trước khi đăng.']);
            }

            $content = $record->draft_content;
            $this->validatePublishable($content);

            $owned = Classroom::query()->where('teacher_id', $teacher->id)
                ->where('status', 'active')->whereIn('id', $classroomIds)->count();
            if ($owned !== count($classroomIds)) {
                throw ValidationException::withMessages(['classroomIds' => 'Chỉ được đăng cho lớp đang hoạt động của bạn.']);
            }

            $content['status'] = 'published';
            $content['updatedAt'] = now()->toIso8601String();
            $record->published_content = $content;
            $record->published_at = now();
            $record->draft_content = null;
            $record->save();
            $record->classrooms()->sync($classroomIds);

            return $record->load('classrooms');
        });
    }

    public function withdraw(User $teacher, CurriculumLesson $lesson): TeacherLessonContent
    {
        return DB::transaction(function () use ($teacher, $lesson) {
            $record = TeacherLessonContent::query()->where('teacher_id', $teacher->id)
                ->where('curriculum_lesson_id', $lesson->getKey())->lockForUpdate()->first();
            if (! $record || ! $record->published_content) {
                throw ValidationException::withMessages(['lesson' => 'Bài học chưa được công bố.']);
            }
            $draft = $record->draft_content ?? $record->published_content;
            $draft['status'] = 'draft';
            $record->draft_content = $draft;
            $record->published_content = null;
            $record->published_at = null;
            $record->save();
            $record->classrooms()->detach();

            return $record->load('classrooms');
        });
    }

    private function validatePublishable(array $content): void
    {
        if (! is_string($content['explanation'] ?? null) || trim($content['explanation']) === '') {
            throw ValidationException::withMessages(['content.explanation' => 'Vui lòng nhập nội dung trước khi đăng.']);
        }
        $walk = function (mixed $value) use (&$walk): void {
            if (is_array($value)) {
                foreach ($value as $entry) $walk($entry);
                return;
            }
            if (is_string($value) && preg_match('~(?:webstudy-asset://|\bdata:image/|\bblob:)~i', $value)) {
                throw ValidationException::withMessages(['content' => 'Bài học chứa học liệu chỉ có trên thiết bị. Hãy chuyển học liệu lên server trước khi đăng.']);
            }
        };
        $walk($content);
        if (($content['diagramDisplay']['source'] ?? null) === 'uploaded') {
            throw ValidationException::withMessages(['content.diagramDisplay' => 'Infographic trên thiết bị chưa có trên server.']);
        }
        foreach (($content['sections'] ?? []) as $section) {
            if (! empty($section['videoUrl']) && ! $this->validYouTubeUrl($section['videoUrl'])) {
                throw ValidationException::withMessages(['content.sections' => 'Liên kết video phải là YouTube HTTPS hợp lệ.']);
            }
            if (! empty($section['imageUrl']) && ! $this->validHttpUrl($section['imageUrl'])) {
                throw ValidationException::withMessages(['content.sections' => 'Liên kết ảnh phải là HTTP hoặc HTTPS hợp lệ.']);
            }
            if (($section['imageMode'] ?? null) === 'drag_drop') {
                $activity = $section['dragImageActivity'] ?? [];
                if (empty($activity['backgroundUrl']) || ! $this->validHttpUrl($activity['backgroundUrl'])
                    || empty($activity['pieces']) || ! is_array($activity['pieces'])) {
                    throw ValidationException::withMessages(['content.sections' => 'Hoạt động kéo thả chưa hoàn chỉnh.']);
                }
                foreach ($activity['pieces'] as $piece) {
                    if (empty($piece['label']) || empty($piece['imageUrl']) || ! $this->validHttpUrl($piece['imageUrl'])) {
                        throw ValidationException::withMessages(['content.sections' => 'Ảnh kéo thả chưa hoàn chỉnh.']);
                    }
                }
                if (($activity['kind'] ?? null) === 'label_zones' &&
                    (empty($activity['zones']) || count($activity['zones']) !== count($activity['labels'] ?? []))) {
                    throw ValidationException::withMessages(['content.sections' => 'Vùng và nhãn kéo thả chưa hoàn chỉnh.']);
                }
            }
        }
    }

    private function validHttpUrl(string $url): bool
    {
        return filter_var($url, FILTER_VALIDATE_URL) !== false
            && in_array(strtolower(parse_url($url, PHP_URL_SCHEME) ?: ''), ['http', 'https'], true);
    }

    private function validYouTubeUrl(string $url): bool
    {
        if (! $this->validHttpUrl($url) || parse_url($url, PHP_URL_SCHEME) !== 'https') return false;
        $host = strtolower(parse_url($url, PHP_URL_HOST) ?: '');
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $id = null;
        if (in_array($host, ['youtu.be', 'www.youtu.be'], true)) $id = ltrim($path, '/');
        elseif (in_array($host, ['youtube.com', 'www.youtube.com', 'm.youtube.com'], true)) {
            if ($path === '/watch') {
                parse_str(parse_url($url, PHP_URL_QUERY) ?: '', $query);
                $id = $query['v'] ?? null;
            } elseif (preg_match('~^/(shorts|embed|live)/([^/]+)~', $path, $match)) $id = $match[2];
        } elseif (in_array($host, ['youtube-nocookie.com', 'www.youtube-nocookie.com'], true)
            && preg_match('~^/embed/([^/]+)~', $path, $match)) $id = $match[1];

        return is_string($id) && (bool) preg_match('/^[a-zA-Z0-9_-]{11}$/', $id);
    }
}
