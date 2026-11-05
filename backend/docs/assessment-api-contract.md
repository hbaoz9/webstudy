# Assessment & Immutable Revisions — B.2

All routes require Sanctum and verified Teacher. Responses use `{data: ...}`; lists use `{data, links, meta}`. A teacher sees only their own assessments and revisions. No Student or Distribution API exists in B.2.

## Endpoints

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | `/api/teacher/assessments` | `page`, `perPage` (1–100), `q`, `sort=newest\|title` | 200 paginated |
| POST | `/api/teacher/assessments` | `{title,instructions?}` | 201, assessment and draft revision 1 |
| GET | `/api/teacher/assessments/{id}` | — | 200 assessment with revisions |
| PATCH | `/api/teacher/assessments/{id}` | `{title,expectedVersion}` | 200 |
| DELETE | `/api/teacher/assessments/{id}` | JSON `{expectedVersion}` | 204 if never published |
| GET | `/api/teacher/assessments/{id}/revisions` | `perPage` | 200 paginated, newest revision number first |
| POST | `/api/teacher/assessments/{id}/revisions` | `{basedOnRevisionId?}` | 201, empty draft or clone of a published snapshot |
| GET | `/api/teacher/revisions/{id}` | — | 200 including teacher-only snapshot keys |
| PUT | `/api/teacher/revisions/{id}/draft` | full draft DTO below | 200 |
| POST | `/api/teacher/revisions/{id}/publish` | `{expectedVersion}`, `Idempotency-Key` header (8–200 chars) | 200 |

The full draft DTO is:

```json
{
  "expectedVersion": 1,
  "title": "Kiểm tra khí quyển",
  "instructions": "Đọc kỹ từng câu.",
  "questions": [
    {"revisionQuestionId": "existing-snapshot-uuid", "maxPoints": "2.000000"},
    {"sourceQuestionId": "question-bank-uuid", "sourceQuestionVersion": 1, "maxPoints": "1.000000"}
  ]
}
```

`questions` is the complete ordered list. New questions are copied from the teacher's current, nondeleted Question Bank row only when its version matches. Existing snapshot IDs must belong to this draft. Omit `maxPoints` for the default `1.000000`. The server computes positions, grading policy and `totalPoints` with six decimal places. It never refreshes a copied snapshot, including when publishing or cloning. Supported grading policies: `exact_match`, `exact_set`, `boolean_match`, `equal_per_statement`, `numeric_match`, `manual`. Grading itself is outside B.2.

`Idempotency-Key` is hashed and stored with the published revision. Retrying with the same key returns the same revision; another key after publication conflicts. Version conflicts return 409 `{message,code:"version_conflict"}`; lifecycle conflicts return 409 `{message,code:"lifecycle_conflict"}`; stale source versions return 409 `{message,code:"source_version_conflict"}`. Invalid payload is 422 `{message,errors}`; unauthorized 401/403; unavailable or another owner's resource 404. Published content and points are immutable. Published assessments cannot be soft-deleted.

Teacher revision DTO includes `id`, `assessmentId`, `revisionNo`, `status`, `title`, `instructions`, `sourceRevisionId`, `version`, `totalPoints` (decimal string), `publishedAt`, and ordered `questions`. Each question includes its snapshot `publicContent`, teacher-only `answerKey` and `rubric`, source ID/version, position, lesson ID, type, difficulty, explanation, `maxPoints` (decimal string) and `gradingPolicy`. The teacher API must never be reused as a Student payload because it contains answer keys and rubrics.

Assessment is not assigned to a class by these routes. The existing local Assignment prototype remains separate.
