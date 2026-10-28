# BE-04 Classroom REST API

Base URL: `/api`. All routes require Sanctum authentication and JSON requests. Use the SPA cookie and CSRF flow in [auth-api-contract.md](./auth-api-contract.md). Teacher routes additionally require a verified teacher profile. Student routes require the student role. An existing classroom owned by another teacher returns 403; a join request ID outside the classroom path returns 404.

## Teacher endpoints

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| GET | `/teacher/classrooms` | — | 200, paginated `Classroom[]` |
| GET | `/teacher/classrooms/{classroom}` | — | 200, `Classroom` |
| POST | `/teacher/classrooms` | Classroom input | 201, `Classroom` |
| PUT/PATCH | `/teacher/classrooms/{classroom}` | Classroom input | 200, `Classroom` |
| POST | `/teacher/classrooms/{classroom}/archive` | — | 200, `Classroom` |
| GET | `/teacher/classrooms/{classroom}/roster` | — | 200, paginated `RosterEntry[]` |
| POST | `/teacher/classrooms/{classroom}/roster/import` | `{rows: RosterImportRow[]}` | 200, `{created, updated}` |
| GET | `/teacher/classrooms/{classroom}/join-requests` | — | 200, paginated `JoinRequest[]` |
| POST | `/teacher/classrooms/{classroom}/join-requests/{joinRequest}/approve` | — | 201, `Membership` |
| POST | `/teacher/classrooms/{classroom}/join-requests/{joinRequest}/reject` | — | 200, `JoinRequest` |
| POST | `/teacher/classrooms/{classroom}/join-requests/{joinRequest}/manual-verify` | Manual verification input | 201, `Membership` |
| GET | `/teacher/classrooms/{classroom}/memberships` | — | 200, paginated active `Membership[]` |

Classroom input: `name` (2–255 characters), `academic_year` (`YYYY-YYYY`), optional `description`, `cover_image_path`. Updates require `name` and `academic_year` (full replacement semantics). `code`, `teacher_id`, `status`, and membership counts are assigned by the backend and cannot be set by the caller. Class creation generates a unique six-character code. Archive is a state transition, not deletion: active memberships become `left`, linked roster rows become `not_joined`, pending requests become `rejected`, and history remains.

Roster import accepts the rows already parsed by the Frontend Excel flow:

```json
{"rows":[{"orderNumber":1,"fullName":"Student Example","studentCode":"10A1-01"}]}
```

The Frontend's existing SheetJS flow converts `.xlsx` to rows, supplies or generates student codes, and shows row errors before posting. Send only valid rows. `excelRow`, `codeSource`, and `errors` are Frontend metadata and are not sent. The backend validates the rows, normalizes codes, rejects duplicates, and upserts by code. Omitted rows are retained. No Excel file upload or server Excel parser is part of this contract.

Manual verification input: `roster_entry_id` (UUID), `reason` (`wrong_student_code`, `wrong_declared_class`, `account_name_difference`, `other`), and nonblank `note` (up to 2000 characters). The roster entry must belong to the request's classroom and be available. Approval and manual verification create membership in a transaction. Already reviewed requests cannot be reviewed again.

## Student endpoints

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| GET | `/student/classrooms` | — | 200, paginated active `Membership[]` |
| GET | `/student/classrooms/lookup/{code}` | — | 200, safe `Classroom` preview |
| GET | `/student/classrooms/{classroom}` | — | 200, `Classroom` for an active member |
| GET | `/student/join-requests` | — | 200, paginated own `JoinRequest[]` history |
| POST | `/student/join-requests` | Join input | 201, `JoinRequest` |
| POST | `/student/memberships/{membership}/leave` | — | 200, `Membership` with `left` status |

Join input: `class_code`, `student_code`, `declared_class`. The authenticated account supplies `student_id`, name, and email; client values for those and for `status` or verification results are ignored. Class lookup is case insensitive and shows active classes only. A student may leave only their own active membership. A rejected request can be resubmitted. A duplicate pending request, a reused pending student code, or an existing active membership returns 422.

## Response shapes

Success responses use `data`. Lists also have Laravel pagination `links` and `meta` (`20` per page for classes and requests, `100` for roster and memberships). Response fields use camel case to match the existing React types. Request fields use snake case except for the existing Excel row shape.

- `Classroom`: `id`, `name`, `code`, `academicYear`, `description`, `coverImage`, `status`, `createdAt`. Teachers who own the class also receive `studentCount` (active count). No roster or student identity fields appear in the student preview/detail.
- `RosterEntry` (teacher only): `id`, `orderNumber`, `fullName`, `studentCode`, `linkedUserId`, `status`.
- `JoinRequest`: `id`, `classroomId`, `studentId`, `studentName`, `email`, `studentCode`, `declaredClass`, `requestedAt`, `verificationStatus`, `status`. Teacher responses include `manualVerification` when present, with `rosterEntryId`, `originalStudentCode`, `resolvedStudentCode`, `reason`, `note`, `verifiedAt`. Students receive only their own requests and no manual verification note.
- `Membership`: `id`, nested safe `classroom`, `status`, `joinedAt`, `leftAt`. The class owner also receives `studentId`, `studentName`, `studentEmail`, `rosterEntryId`. Students receive only their own membership.

Errors use Laravel JSON: `{"message":"..."}` and, for validation, `{"message":"...","errors":{"field":["..."]}}`. Statuses: 401 unauthenticated, 403 wrong role, unverified teacher, or forbidden resource, 404 missing resource or mismatched nested ID, 422 invalid input or business conflict. Database uniqueness constraints and service transactions remain the final protection against concurrent claims. No BE-04 migration is needed.

React can connect through an API adapter without changing the existing Excel parser. The current teacher `Classroom` type also requires `completionRate` and a non-null `coverImage`; this API does not calculate completion progress, and `coverImage` can be null. The adapter should provide display defaults until those features have backend sources. Existing localStorage flows are unchanged in BE-04.
