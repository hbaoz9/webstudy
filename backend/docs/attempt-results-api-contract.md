# Attempt → Results backend (implementation draft)

This document records the current backend implementation for review. It does not grant release approval. The existing B.3 gates remain OFF; `student_attempt_enabled` is false in `config/distribution.php`. Start also requires the B.3 student-visibility gate. The migration is forward-only and must be applied to a verified database in a separate deployment checkpoint.

## Policy choices made for implementation

- An attempt started while membership was active may continue after the student leaves the class. Historical self-access remains available. Leaving never grants a new start.
- Close prevents new starts **and all new extensions**, but does not shorten the previously authorized `expires_at` of an existing `IN_PROGRESS` attempt. After a student leaves, the original attempt may still resume/autosave/submit until its existing expiration, but **cannot receive new extensions**, deadline exceptions or extra attempt grants. A later rejoin does not reactivate the old attempt's membership for extension.
- An extension requires an active Distribution, active original membership, an unexpired `IN_PROGRESS` attempt, an authorized teacher, a reason, matching version, and no more than 24 hours cumulative extension beyond `initial_expires_at`. `HARD_DEADLINE` still applies unless an audited completion exception permits a later cap. Classroom-row locks serialize Close/Leave against Extend.
- `HARD_DEADLINE` caps expiration at the effective completion deadline. A teacher must set a student-specific completion exception before extending beyond the frozen deadline. `FINISH_STARTED_ATTEMPT` grants the full time limit to a valid start. Late start always requires a student exception and is limited to 30 days after the original deadline.
- Older B.3 distributions have nullable score/release policies. Start is blocked with `policy_unset` until an explicit backfill is approved. New distributions default to `HIGHEST`, `AFTER_DISTRIBUTION_ENDED_AND_GRADED`, and `AFTER_DISTRIBUTION_ENDED_WITH_TEACHER_PERMISSION`.

## Data and locking

`student_attempts` stores server timestamps, frozen policy, current grading totals and state. `attempt_answers` stores the last accepted answer, version and `accepted_at`. `attempt_grade_items` stores per-question current grades by generation; `assessment_results` stores the aggregate projection. `attempt_commands`, `attempt_events`, `grade_events`, `student_exception_events`, `regrade_runs` and `revision_question_invalidations` provide audit/idempotency history. All scores are `NUMERIC(12,6)` and JSON answers are validated by question type. No attempt, answer or audit data is hard-deleted through APIs.

Mutations lock actor User → Classroom → Distribution → Attempt → Answer/Grade/Result. PostgreSQL `clock_timestamp()` is read after locking. Autosave accepts only `serverNow < expires_at`, checks `expectedVersion`, writes answer and receipt in one transaction, and acknowledges `acceptedAt`, `version` and `serverNow`. A retry with the same `Idempotency-Key` and payload replays the receipt; different payload returns 409. Timeout uses only committed answers, and is run by `attempts:finalize-expired` every minute plus lazy finalization on reads/saves. The production scheduler must run for prompt finalization while browsers are closed.

The PostgreSQL connection timezone is UTC so Eloquent timestamps and server-side comparisons refer to the same instant. Close recomputes current aggregate states in its transaction. A student without classroom membership history receives 404 when guessing a distribution ID.

## Student API

All routes require Sanctum and the student role. Actor identity comes from the session. No student can read another student's attempt.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/student/distributions/history` | Paginated distributions with at least one own attempt, including after leaving class |
| GET | `/api/student/distributions/{id}` | Active distribution or own historical distribution summary |
| GET | `/api/student/distributions/{id}/eligibility` | Can start, quota, effective deadline and server time |
| POST | `/api/student/distributions/{id}/attempts` | Start; requires `Idempotency-Key`, returns public revision questions, initial answer versions and expiration |
| GET | `/api/student/attempts/{id}` | Resume own attempt, committed answers and current server time |
| PUT | `/api/student/attempts/{id}/answers/{revisionQuestionId}` | Autosave `{answer,expectedVersion}`; requires `Idempotency-Key` |
| POST | `/api/student/attempts/{id}/submit` | Finalize; requires `Idempotency-Key` |
| GET | `/api/student/distributions/{id}/attempts` | Own attempt history, including after leaving class |
| GET | `/api/student/distributions/{id}/result` | D4 filtered result projection |

The active and historical Distribution lists accept optional `classroomId` (UUID) for class navigation. The filter narrows server-authorized rows; it never grants access. Invalid IDs receive 422. Active list remains empty while the student-visibility gate is OFF, while own historical attempt summaries remain available.

Answer payloads: `single_choice:{optionId}`, `multiple_choice:{optionIds}`, `true_false:{value}`, `true_false_group:{answersByStatementId}`, `short_answer:{value}`, `essay_text:{text}`. `answer:null` clears a saved answer. Group answers may be partial; unknown IDs and wrong types receive 422. Short answers use B.1 numeric normalization. Student question DTO has only `id`, `position`, `type`, `maxPoints`, and public `content`; answer key, rubric and explanation are absent. Attempt responses include current attempt `version`; answer entries include `version` and `acceptedAt`. The frontend may keep unacknowledged edits in session storage as a recovery copy, never as a server-accepted answer.

## Teacher API

All routes require Sanctum and verified teacher ownership of the Distribution or Revision.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/teacher/distributions/{id}/attempts` | Attempt list |
| GET | `/api/teacher/attempts/{id}` | Attempt detail and grades |
| GET | `/api/teacher/distributions/{id}/exceptions` | Student exceptions |
| PUT | `/api/teacher/distributions/{id}/students/{studentId}/exception` | Future start/time policy, `expectedVersion`, reason and idempotency key |
| POST | `/api/teacher/distributions/{id}/students/{studentId}/additional-attempts` | Positive grant, reason and idempotency key |
| POST | `/api/teacher/attempts/{id}/extend` | `expiresAt`, `expectedVersion`, reason, idempotency key |
| POST | `/api/teacher/attempts/{id}/revoke` | `expectedVersion`, reason and idempotency key |
| PUT | `/api/teacher/attempts/{id}/essay-grades/{questionId}` | Decimal points, feedback, `expectedVersion`, idempotency key |
| POST | `/api/teacher/distributions/{id}/publish-scores` | Manual score publication |
| POST | `/api/teacher/distributions/{id}/publish-answers` | Answer/explanation publication when no further starts are possible |
| POST | `/api/teacher/revisions/{id}/questions/{questionId}/invalidate` | Revision-wide full credit and atomic regrade |
| GET | `/api/teacher/revisions/{id}/regrade-runs/{runId}` | Regrade status |

All idempotency keys are 16–128 URL-safe characters. Conflicting versions or lifecycle changes return 409; malformed payloads return 422; resources outside scope return 404. When the release gate is OFF, Start and teacher attempt writes return 423 `attempt_release_locked`.

## Grading and publication

Objective scoring uses immutable Published Revision snapshots. `true_false_group` grants equal per-statement credit, rounded half-up to six decimal places. Other objective types use exact-match full credit or zero. Essay text is manually graded; unanswered essay is zero, answered essay remains pending until graded. Attempt totals and aggregate HIGHEST/LATEST/AVERAGE are recomputed in transactions. A pending essay never becomes a final aggregate score. Cancel marks results VOID without representing a zero grade. Invalidation grants full credit for that question to affected submitted/timed-out attempts, preserves snapshots and answers, and changes grade generations atomically. Active attempts are graded using the new invalidation after finalization.

Score and answer release are independent. Student result responses omit numeric scores until the chosen score release condition, and omit keys/explanations until explicit answer publication and a safe end of the distribution. A manually published aggregate is hidden again while a later essay attempt is pending grading. `NEVER` never reveals keys. Publishing answers blocks later exception or quota grants that would enable another start.

## Deployment boundary

The migration is tested only on `webstudy_test`. Do not migrate development `webstudy`, enable release gates, or consider this feature accepted without a separate deployment and Owner QA checkpoint. The frontend Attempt experience requires browser testing after gates are explicitly released.
