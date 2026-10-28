# BE-03 Authentication and Teacher Verification API

Base URL: `/api`. Responses use JSON. Except for health, all protected endpoints require a Sanctum SPA session cookie. The backend does not issue bearer tokens.

## Browser setup

1. Configure `FRONTEND_ORIGINS` and `SANCTUM_STATEFUL_DOMAINS` for the exact React host and port. Configure `SESSION_DOMAIN` for subdomains when needed. Use HTTPS and `SESSION_SECURE_COOKIE=true` in production.
2. Send `GET /sanctum/csrf-cookie` with credentials. Read the `XSRF-TOKEN` cookie and send its decoded value in `X-XSRF-TOKEN` for state-changing requests.
3. Send `Origin`, `Accept: application/json`, and credentials (`fetch` option `credentials: 'include'`) on API calls. The server sends an HttpOnly session cookie, uses SameSite=Lax by default, and regenerates the session ID after registration/login. Logout invalidates the session and rotates the CSRF token.

The local defaults are `http://localhost:5173` and `http://127.0.0.1:5173`. Do not use wildcard CORS origins with credentials. Admin accounts must be provisioned by a trusted backend operation; registration accepts only `student` and `teacher`.

## Authentication

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| POST | `/auth/register` | `name`, `email`, `password`, `password_confirmation`, optional `role: student\|teacher` | 201, `data: User` |
| POST | `/auth/login` | `email`, `password` | 200, `data: User` |
| POST | `/auth/logout` | — | 200, `message` |
| GET | `/auth/me` | — | 200, `data: User` |

`User`: `id`, `name`, `email`, `role`, `teacher_verification_status` (`null` for nonteachers). Email is stored in lowercase; duplicate addresses are rejected without regard to case. Login is limited to five attempts per minute per email and IP; registration to five per minute per IP.

## Teacher verification

| Method | Path | Access | Success |
| --- | --- | --- | --- |
| POST | `/teacher/verification` | Teacher | 201, `data: Submission` |
| GET | `/teacher/verification` | Teacher | 200, `data: {verification_status, verified_at, submissions}` |
| GET | `/teacher-verifications/{id}/document` | Admin or the submitting teacher | 200, private file stream; 404 when a legacy file is unavailable |
| GET | `/admin/teacher-verifications?status=pending\|verified\|rejected\|all` | Admin | 200, paginated `data: Submission[]`; default `pending` |
| POST | `/admin/teacher-verifications/{id}/approve` | Admin | 200, `data: Submission` |
| POST | `/admin/teacher-verifications/{id}/reject` | Admin | 200, `data: Submission` |

Submit as `multipart/form-data` (snake case): `full_name`, `school_name`, `school_address`, optional `teacher_code`, `position`, and a **file** field named `document`. The server accepts PDF, JPEG or PNG up to 5 MiB and checks the file's detected MIME type. Send the Sanctum CSRF header and credentials, but let the browser set the multipart boundary. A teacher can resubmit after rejection, but cannot create a second pending submission or resubmit after verification. Rejection requires `reason` (up to 2000 characters). Each submission and decision remains in history with reviewer, time, and rejection reason.

`Submission`: `id`, `teacher_id`, `full_name`, `school_name`, `school_address`, `teacher_code`, `position`, `document: {name, type, size, available}`, `status`, `submitted_at`, `reviewed_at`, `reviewed_by`, `rejection_reason`. Admin responses also include `teacher_email`. The response never contains the private storage path or a public file URL. The document endpoint checks the submission's policy before streaming and returns `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.

Files are stored under `storage/app/private/teacher-verifications` with generated names. Database changes are transactional; a newly stored file is removed if submission creation fails. The new nullable `document_path` column preserves existing metadata-only records. Such records show `available: false`; their files return 404 and an old pending record cannot be approved without a stored file. A rejected legacy record can be followed by a real upload. Already reviewed history is retained.

## Verification admin

The React page `/admin/teacher-verifications` lists pending submissions and recent decisions, streams available evidence through the authenticated endpoint, and records approval or a required rejection reason. Admins sign in at `/auth?role=admin`; the registration API does not accept `admin`.

To create a **new** local admin, first configure the intended database connection, verify it explicitly, then run `php artisan webstudy:admin:create --email=admin@example.org --name="Admin Name"` from `backend/`. The command prompts for the password twice without a CLI password argument, requires at least 12 characters, and refuses an email already in use. It never promotes an existing account. Do not run it against a database other than the one you intend to administer.

The application keeps uploaded evidence with the submission audit history; it does not delete files automatically. Before production rollout, the operator should approve a retention period and a documented removal process. The removal process should exclude pending submissions, delete expired private files through the storage disk, set `document_path` to null, and retain the review metadata and audit decisions. Backups must follow the same retention rule.

## Errors and integration

API errors are JSON with `message`; validation errors also have `errors` keyed by input field. Typical statuses: 401 unauthenticated, 403 wrong role, 419 invalid/missing CSRF token, 422 invalid input or conflicting state, 429 rate limited. The `teacher.verified` middleware is available for future classroom routes; this checkpoint does not publish Classroom APIs.

The new nullable document-path migration must be applied to each target environment by its operator. Apply it to `webstudy_test` only after verifying the connection; do not run migrations on `webstudy` as part of test execution.
