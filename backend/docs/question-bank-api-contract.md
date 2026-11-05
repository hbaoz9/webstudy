# Question Bank API V1 (INT-03B.1)

Teacher Question Bank is private to the authenticated, verified teacher. All routes use Sanctum and `teacher.verified`. Question Bank is not an Assessment publication or a Student Lessons publication. `showInLesson` is metadata only. No student endpoint or grading is provided here.

## Routes and responses

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/teacher/questions` | `200 {data: [...], links: {...}, meta: {...}}` |
| POST | `/api/teacher/questions` | `201 {data: QuestionTeacherDTO}` |
| GET | `/api/teacher/questions/{id}` | `200 {data: QuestionTeacherDTO}` |
| PUT | `/api/teacher/questions/{id}` | `200 {data: QuestionTeacherDTO}` |
| DELETE | `/api/teacher/questions/{id}` | `204` without body |

All IDs are server-generated UUIDs. `teacher_id` is taken from the authenticated user. `lessonId` must identify an existing `curriculum_lessons.id` and its chapter is derived from that record. Unknown input fields, including `teacherId`, `teacher_id`, `chapter`, and grading fields, are rejected with `422`.

The teacher DTO contains `id`, `version`, `type`, `lessonId`, `chapterId`, `difficulty`, `content`, optional `image` and `explanation`, `showInLesson`, type-specific fields below, `createdAt`, and `updatedAt`. This is a private teacher projection. The database stores `public_content`, `answer_key`, `rubric`, and `explanation` separately. The answer key, rubric, and explanation must not be reused in a student response without a separate authorization and visibility contract.

## Create and full replacement update

Common fields: `type`, `lessonId`, `difficulty`, `content`, optional `image`, `explanation`, `showInLesson`. The four difficulty values are `recognition`, `comprehension`, `application`, `advanced_application`. Content is trimmed and must contain 1–5,000 characters. Explanation is at most 10,000 characters. An image has `url` and optionally `caption` and `source`; its URL is HTTP(S) or a validated PNG/JPEG/WebP base64 data URL of at most 300,000 characters. The backend does not fetch remote URLs. The complete request is limited to 1 MB.

The following examples each add their fields to the common payload `{"lessonId":"geo10-kn-b07","difficulty":"recognition","content":"Question text"}`:

| `type` | Additional request fields |
| --- | --- |
| `single_choice` | `"options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correctOptionId":"a"` |
| `multiple_choice` | `"options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correctOptionIds":["a","b"]` |
| `true_false` | `"correctAnswer":true` |
| `true_false_group` | `"statements":[{"id":"a","content":"Statement A","correctAnswer":true},{"id":"b","content":"Statement B","correctAnswer":false}]` |
| `short_answer` | `"correctAnswer":"12.5"` |
| `essay_text` | optional `"rubricText":"Criteria"` (up to 10,000 characters) |

Each example also requires its `"type"` value. Options and statements each require 2–10 entries with distinct nonempty IDs and nonempty text. Correct option IDs must refer to existing options. Boolean answers must be JSON booleans. Short answers must be integer or decimal strings; commas are accepted as decimal separators and the normalized key is stored (for example `+0012,500` becomes `12.5`). Essay has no auto-grade answer key. For `true_false_group`, public statement content excludes `correctAnswer`; its private key maps statement IDs to booleans. A later Assessment Revision snapshots the question and defines maximum points and grading policy; Question Bank does not store `max_points` or grade answers.

PUT sends the complete teacher DTO input plus integer `expectedVersion >= 1` in the JSON body. DELETE sends JSON body `{"expectedVersion":2}`. Creation starts at version 1; a successful PUT increments it by one. A stale version returns `409` without changing the question. Updates and soft deletion use a transaction and row lock, so concurrent writes with the same expected version cannot both win. Deleted questions are excluded from list/detail/update/delete; existing rows remain in storage. Question Bank edits and deletion do not mutate any future published Assessment snapshot.

## List query

`page` defaults to 1. `perPage` defaults to 20 and is capped at 100. `q` searches question content case-insensitively and is capped at 100 characters. Optional filters: `type`, `difficulty`, `lessonId`, `chapterId`. `sort` accepts `newest` (default), `lesson`, `difficulty`. All sorting includes a stable UUID tie breaker. Filtering occurs before pagination and always applies teacher ownership and soft-delete scope. `meta.total` is the number of filtered questions.

Status codes: `401` guest; `403` non-teacher/unverified teacher; `404` unknown, deleted, or another teacher's question; `409` version conflict; `422` invalid payload with Laravel `{message, errors}`. No existence information for another teacher's private question is disclosed.
