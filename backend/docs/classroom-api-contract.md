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
| POST | `/teacher/classrooms/{classroom}/restore` | — | 200, `Classroom` |
| DELETE | `/teacher/classrooms/{classroom}` | — | 204, no body |
| POST | `/teacher/classrooms/{classroom}/regenerate-code` | — | 200, `Classroom` |
| GET | `/teacher/classrooms/{classroom}/roster` | Query: `page`, `search`, `status` | 200, paginated `RosterEntry[]` |
| POST | `/teacher/classrooms/{classroom}/roster/import` | `{rows: RosterImportRow[]}` | 200, `{created, updated}` |
| GET | `/teacher/classrooms/{classroom}/join-requests` | — | 200, paginated `JoinRequest[]` |
| POST | `/teacher/classrooms/{classroom}/join-requests/{joinRequest}/approve` | — | 201, `Membership` |
| POST | `/teacher/classrooms/{classroom}/join-requests/{joinRequest}/reject` | — | 200, `JoinRequest` |
| POST | `/teacher/classrooms/{classroom}/join-requests/{joinRequest}/manual-verify` | Manual verification input | 201, `Membership` |
| GET | `/teacher/classrooms/{classroom}/memberships` | — | 200, paginated active `Membership[]` |

Roster GET is available to the verified teacher who owns the classroom, including archived classrooms. `page` is a positive integer (default 1). Optional `search` is a string of at most 100 characters; surrounding whitespace is trimmed, and a blank value has no effect. It matches a literal substring of `fullName` **or** `studentCode`, ignoring ASCII letter case. `%` and `_` are treated as literal characters, not wildcards. On PostgreSQL, when the `unaccent(text)` function is available on the connection, name search uses `lower(unaccent(...))` on both the name and search term. This supports the tested Vietnamese examples such as `Nguyen` matching `Nguyễn` and `TRAN` matching `Trần`. The code field keeps its ordinary case-insensitive search. If the function is unavailable, including on SQLite, name search falls back to `LOWER(full_name) LIKE` and accent-insensitive matching is **not** guaranteed. The endpoint never installs the extension; each PostgreSQL database must enable it separately to provide accent-insensitive search. Optional `status` is exactly one of `joined`, `not_joined`, or `conflict` (roster status, not membership status). Search and status combine with AND, within the requested classroom, before pagination. Results sort by `orderNumber` ascending and then `id` ascending. Each page contains at most 100 entries. Without filters, `meta.total` counts all roster entries in the classroom; with filters, it counts matching entries across all pages. Invalid `page`, `search`, or `status` returns HTTP 422 with Laravel validation errors. The roster entry response fields are unchanged.

Classroom input: `name` (2–255 characters), `academic_year` (`YYYY-YYYY`), optional `description`, `cover_image_path`. Updates require `name` and `academic_year` (full replacement semantics). `code`, `teacher_id`, `status`, and membership counts are assigned by the backend and cannot be set by the caller. Class creation generates a unique six-character code. Archive is a state transition, not deletion: active memberships become `left`, linked roster rows become `not_joined`, pending requests become `rejected`, and history remains. Restore is available only to the verified owner of an archived classroom. It changes only classroom status to `active`; ID, code, roster, left memberships, rejected requests, and verification history remain unchanged. Restore of an active classroom returns 422. After restore, student lookup and new join requests can use the class code again; prior memberships and requests are never reactivated automatically.

Soft delete is available only to the verified owner of an archived classroom with no active memberships or pending join requests. It sets `deleted_at` and returns 204; it does not delete roster entries, requests, memberships, or verification history. Deleted classrooms are excluded from ordinary teacher list/detail, student lookup/detail, and nested classroom routes by Laravel SoftDeletes route binding and query scope. Repeat deletion, restore, archive, edit, and regenerate-code on a deleted classroom return 404. Codes and teacher/year/name uniqueness remain reserved by database constraints. There is no API to recover or permanently purge a deleted classroom. An active class, or an archived class with inconsistent active membership or pending request data, returns 422.

Regenerate-code is available only to the verified owner of an active classroom. It returns the classroom with a newly generated six-character code, different from the previous code. The previous code stops matching student lookup or new join requests; the new code works through the existing student API. Classroom ID, roster, memberships, join requests, and pending review status remain unchanged. The service serializes changes to the same classroom and retries code collisions up to eight times; database unique constraints include soft-deleted classrooms. An archived classroom returns 422 and a deleted classroom returns 404.

Roster import accepts the rows already parsed by the Frontend Excel flow:

```json
{"rows":[{"orderNumber":1,"fullName":"Student Example","studentCode":"10A1-01"}]}
```

The integrated Frontend SheetJS flow accepts `.xlsx` and `.xls` files and previews row errors before posting. For Backend import, the file must contain exactly one sheet and columns for full name and student code. Each imported student must have a supplied code; this flow does not generate one. The optional order-number column falls back to row order when absent or blank; an explicitly invalid number is a row error. Only valid rows are sent as `orderNumber` (positive integer), `fullName` (nonblank, at most 255 characters), and `studentCode` (nonblank, at most 64 characters). At least one row is required. Missing names or codes, overlong values, and duplicate codes after normalization block the Frontend preview; the backend also validates these conditions and returns 422 for invalid input. `excelRow`, `codeSource`, and `errors` are Frontend-only metadata and are not posted. The backend normalizes student codes (case and whitespace), then upserts roster entries by code within the owned, active classroom: an existing code updates its name and order number; a new code creates an entry. Entries omitted from a later import are retained. Import can re-evaluate pending join-request verification, but it does not create accounts, link a roster entry to an account, or create active membership. `RosterEntry.status` and `linkedUserId` describe roster matching/linkage; neither alone proves active membership. `Classroom.studentCount` counts active memberships separately from roster entries. Archived classrooms allow roster read but reject import. No Excel file upload or server Excel parser is part of this contract.

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

The active React teacher classroom flow is connected to these Laravel endpoints for list, create, detail, edit, archive, restore, soft delete, regenerate-code, roster read/search/filter, and Excel roster import. The import modal sends only validated rows through the API client and refreshes the roster after a confirmed response. The older prototype and its localStorage data remain separate from the active Backend classroom route. This API does not calculate completion progress, and `coverImage` can be null; the integrated summary displays only available Backend counts.
