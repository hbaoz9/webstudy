# Teacher Lessons API — INT-02.A

All endpoints require Sanctum authentication and a verified teacher. Curriculum lesson IDs come from the seeded `curriculum_lessons` catalog. Teacher content is scoped to the authenticated user; client-supplied ownership, publication timestamps and status cannot grant access.

## Endpoints

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/teacher/lessons` | — | `{ data: TeacherLesson[] }`, ordered by curriculum number; includes uncreated lessons |
| GET | `/api/teacher/lessons/{curriculumLesson}` | — | `{ data: TeacherLesson }` |
| PUT | `/api/teacher/lessons/{curriculumLesson}/draft` | `{ content: LessonContent }` | `{ data: TeacherLesson }` |
| POST | `/api/teacher/lessons/{curriculumLesson}/publish` | `{ classroomIds: string[] }` | `{ data: TeacherLesson }` |
| POST | `/api/teacher/lessons/{curriculumLesson}/withdraw` | — | `{ data: TeacherLesson }` |

`TeacherLesson` contains `id`, `chapterId`, `chapterNumber`, `chapterTitle`, `partId`, `partNumber`, `partTitle`, `number`, `title`, `status` (`uncreated|draft|published`), `draftContent`, `publishedContent`, `publishedAt`, and `classroomIds`. The content fields are nullable. `status=published` means a published snapshot exists; a separate draft may also exist. `classroomIds` identifies the selected classes of the current publication.

Draft saves preserve all supported LessonContent fields (objectives, key points, explanation and Markdown format, sections, image/video/activity fields, diagram metadata) as JSON. An empty explanation is allowed in draft. Backend sets `lessonId`, `status=draft`, and `updatedAt` for the draft. The request is limited to 1 MB and does not accept `draft` nesting or arbitrary root fields.

Publish requires a saved draft with nonempty explanation and at least one distinct classroom ID. Every classroom must be active, owned by the teacher and not soft-deleted. The draft is copied to a published snapshot, and the classroom set is replaced in the same database transaction. Later draft edits do not change that snapshot. Withdraw removes the published snapshot and classroom links, preserving the draft or copying the last publication into it. No physical lesson content is deleted.

Publish rejects device-only `webstudy-asset://` references, `data:image`/`blob:` content and uploaded infographic diagram references. No infographic upload API exists in INT-02.A. HTTP(S) image URLs and supported HTTPS YouTube URLs can be used. Invalid input/state returns 422 with Laravel validation errors; unauthenticated requests return 401, unauthorized roles or unverified teachers 403, and unknown curriculum lessons 404.

Student Lessons API and learning progress are outside INT-02.A. Existing browser localStorage and IndexedDB data are not imported or deleted by these endpoints.
