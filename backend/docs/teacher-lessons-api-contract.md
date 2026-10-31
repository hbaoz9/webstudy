# Teacher Lessons API — INT-02.A

The teacher endpoints below require Sanctum authentication and a verified teacher. Curriculum lesson IDs come from the seeded `curriculum_lessons` catalog. Teacher content is scoped to the authenticated user; client-supplied ownership, publication timestamps and status cannot grant access.

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

Existing browser localStorage and IndexedDB data are not imported or deleted by these endpoints.

## Student Lessons list — INT-02.B2A

`GET /api/student/lessons` requires Sanctum authentication and the `student` role. The server obtains the student from the session and their active membership; client-supplied user or classroom IDs do not select access. There is no request body or pagination in v1 (the seeded curriculum currently contains 40 lessons).

The response is `{ "data": [...] }`, ordered by curriculum lesson number ascending, then curriculum lesson ID ascending. Each item contains only `id`, `number`, `title`, `chapterId`, `chapterNumber`, `chapterTitle`, `partId`, `partNumber`, `partTitle`, and `publishedAt` (ISO 8601 or null). Draft and published content JSON are never included in this list response.

A lesson is listed only if the student's membership is active, its classroom is active and not soft-deleted, and a publication with non-null `published_content` is linked to that classroom and belongs to its teacher. A later draft save leaves this published snapshot and list visibility unchanged. Republish replaces the classroom distribution; withdraw clears the snapshot and distribution. Pending join requests, left memberships, archived or soft-deleted classrooms, and unassigned or draft-only lessons grant no visibility. With no visible lessons, including no active membership, the response is HTTP 200 with `{ "data": [] }`. Guest requests receive 401; other roles receive 403.

This list endpoint provides metadata only. Learning progress remains outside INT-02.B2A.

## Student Lesson detail — INT-02.B2B

`GET /api/student/lessons/{curriculumLesson}` requires Sanctum authentication and the `student` role. `{curriculumLesson}` is the curriculum's string ID (for example `geo10-kn-b07`), not the numeric teacher content ID. The server derives the student and active classroom from the authenticated account; query parameters such as `user_id` and `classroom_id` do not select access.

The response is `{ "data": { ... } }`. `data` has the same flat metadata fields as the list (`id`, `number`, `title`, `chapterId`, `chapterNumber`, `chapterTitle`, `partId`, `partNumber`, `partTitle`, `publishedAt`) plus `content`, the complete `published_content` JSON snapshot. It does not contain draft content, teacher editing fields, membership data or classroom data. The existing `LessonContent` structure is returned as stored, including its sections and metadata.

Visibility uses the same conditions as the list: active membership, active and non-soft-deleted classroom, a publication assigned to that classroom, ownership by that classroom's teacher, and non-null `published_content`. Saving a new draft does not affect the student's detail response. Republish replaces the snapshot and classroom distribution; withdraw makes the detail unavailable. A guest receives 401 and a non-student receives 403. A student receives the same 404 for an unknown curriculum ID, no active membership, an unassigned or draft-only lesson, withdrawn publication, left membership, or archived/deleted classroom. This endpoint does not write learning progress or other data.
