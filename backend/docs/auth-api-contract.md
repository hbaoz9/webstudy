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
| GET | `/admin/teacher-verifications?status=pending\|verified\|rejected\|all` | Admin | 200, paginated `data: Submission[]`; default `pending` |
| POST | `/admin/teacher-verifications/{id}/approve` | Admin | 200, `data: Submission` |
| POST | `/admin/teacher-verifications/{id}/reject` | Admin | 200, `data: Submission` |

Submit body (snake case): `full_name`, `school_name`, `school_address`, optional `teacher_code`, `position`, and `document: {name, type, size}`. The document object records metadata only; this checkpoint does not upload or store file contents. Rejection requires `reason` (up to 2000 characters). A teacher can resubmit after rejection, but cannot create a second pending submission or resubmit after verification. Each submission and decision remains in history with reviewer, time, and rejection reason.

`Submission`: `id`, `teacher_id`, `full_name`, `school_name`, `school_address`, `teacher_code`, `position`, `document`, `status`, `submitted_at`, `reviewed_at`, `reviewed_by`, `rejection_reason`.

## Errors and integration

API errors are JSON with `message`; validation errors also have `errors` keyed by input field. Typical statuses: 401 unauthenticated, 403 wrong role, 419 invalid/missing CSRF token, 422 invalid input or conflicting state, 429 rate limited. The `teacher.verified` middleware is available for future classroom routes; this checkpoint does not publish Classroom APIs.

The new verification-history migration must be applied to each target environment by its operator. Only the guarded PostgreSQL runner may migrate `webstudy_test` automatically; do not run migrations on `webstudy` as part of test execution.
