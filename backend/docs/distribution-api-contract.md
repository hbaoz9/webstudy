# Distribution API V1 (INT-03B.3)

All routes require Sanctum. Teacher routes require a verified teacher account. IDs and actor are derived from the session; cross-owner resources are inaccessible. All times use ISO 8601 with an offset and are stored as PostgreSQL `timestamptz`.

The creation gate `DISTRIBUTION_CREATION_ENABLED` and student visibility gate `STUDENT_DISTRIBUTION_VISIBILITY_ENABLED` default to **false**. With creation disabled, `POST /api/teacher/distributions/batches` returns 423 `{ "error": { "code": "distribution_release_locked", "message": "Tính năng giao bài chưa được mở sử dụng." } }` without a write. Do not enable either gate on a real class before the Attempt checkpoint is accepted. No Start or grading endpoint exists here.

## Teacher routes

| Method | Path | Result |
| --- | --- | --- |
| POST | `/api/teacher/distributions/preview` | Validates schedule and ownership, lists overlaps, no Distribution write |
| POST | `/api/teacher/distributions/batches` | Creates one atomic batch with one Distribution per class |
| GET | `/api/teacher/distributions` | Paginated teacher list |
| GET | `/api/teacher/distributions/{id}` | Detail |
| POST | `/api/teacher/distributions/{id}/close` | Blocks future starts |
| POST | `/api/teacher/distributions/{id}/cancel` | Terminal cancel and durable notices |
| GET | `/api/teacher/distributions/{id}/events` | Paginated append-only audit |

Preview and Create share the business payload:

```json
{
  "revisionId": "published-revision-uuid",
  "classroomIds": ["classroom-uuid"],
  "opensAt": null,
  "deadlineAt": "2026-11-15T17:00:00+07:00",
  "timeLimitSeconds": 900,
  "maxAttempts": 1,
  "deadlinePolicy": "HARD_DEADLINE",
  "overlapConfirmationToken": null
}
```

`opensAt: null` means server time at first commit. `maxAttempts` defaults to 1. Valid limits: time limit 60–14,400 seconds, attempts 1–5, opening at most 180 days ahead, window 1 minute–30 days, 1–30 distinct classrooms. Deadline is required and must be future. `deadlinePolicy` is required: `HARD_DEADLINE` or `FINISH_STARTED_ATTEMPT`. The latter lets a valid attempt started before deadline finish its allotted time in the future Attempt implementation. Neither policy allows starting a new attempt after deadline by itself.

Create requires a random `Idempotency-Key` header of 16–128 URL-safe characters. First success: 201 `{data:{batchId,distributions:[...]}}`. Replay with the same key and business payload: 200, same IDs, no extra audit. Reuse with different payload: 409 `idempotency_conflict`. The canonical business hash treats omitted/null `opensAt` as the same “open now” intent and does not change on retry.

An overlap is another active Distribution for the same classroom whose half-open `[opensAt, deadlineAt)` interval intersects. Preview returns `{data:{eligible,revision:{id,title,questionCount,totalPoints},classrooms,overlaps,overlapConfirmationToken,creationEnabled}}`. After showing overlaps, send that token in Create; server rechecks overlap under classroom locks. Missing/stale token returns 409 `overlap_confirmation_required` with current `overlaps`. Preview is never authorization for Create.

List accepts `page` (default 1), `perPage` (default 20, max 100), `classroomId`, `assessmentId` (UUID; includes distributions of every published revision of that assessment), `status` (`scheduled`, `open`, `expired`, `closed`, `cancelled`), `q` (title, max 100 characters), `sort=newest`. Filters are applied before pagination and always scoped to the authenticated teacher. Status `scheduled/open/expired` is derived from server time for active records. Responses use `{data,links,meta}`. Detail fields include ID, batch/class/revision IDs, assessment title, lifecycle and derived status, schedule, time limit, attempts, deadline policy, version and lifecycle timestamps. No question content, answer key, rubric or explanation is returned.

Close requires `{ "expectedVersion": 1, "reason": "" }` and a fresh `Idempotency-Key`. Cancel requires a nonblank `reason` of at most 1,000 Unicode characters plus `expectedVersion` and key. Both return 200 `{data:Distribution}`; exact retry returns 200 without a new event. A new command after terminal lifecycle returns 409 `lifecycle_conflict`; stale version returns 409 `version_conflict`. Close can run before opening or after deadline; Cancel can follow Close. There is no reopen or configuration edit. Cancel records the actor/reason and inserts notifications for all members active at cancellation serialization time. The Attempt/Result consequences of Cancel are deferred to their checkpoints.

## Student routes

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/student/distributions` | Active-class safe metadata when visibility gate is enabled; otherwise empty list |
| GET | `/api/student/distributions/{id}` | Active-class safe detail when visibility gate is enabled; otherwise 404 |
| GET | `/api/student/notifications` | Current student's durable inbox |
| POST | `/api/student/notifications/{id}/read` | Idempotently marks own notice read |

Student Distribution metadata contains title, class, times, lifecycle, and `attemptAvailable:false`; it never contains a question snapshot or teacher-private fields. Cancel notices remain readable with the visibility gate off. Other students' notice IDs return 404. All lists use pagination.

Errors follow existing API conventions: 401 unauthenticated, 403 role/verification, 404 outside ownership, 422 validation, 409 conflict, 423 release locked. `showInLesson`, Assessment snapshots, Question Bank and Assignment prototype are not changed by this API.
