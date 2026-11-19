# Media APIs (current integration)

All routes require Sanctum. Teacher routes require verified teacher status. Student routes require student role and an active classroom membership. No media is made visible by a draft save.

## Interactive video

- `GET /api/teacher/interactive-videos` and `GET /api/teacher/interactive-videos/{id}` return owner-scoped drafts and active publications.
- `POST /api/teacher/interactive-videos` accepts `{title, youtubeId, lessonId?, checkpoints}`. A checkpoint contains `{id, atSeconds, prompt, options: {A,B,C,D}, correctOption}`. The YouTube ID is eleven characters. No remote video is downloaded.
- `PUT /api/teacher/interactive-videos/{id}` replaces the draft with the same fields and `expectedVersion`; stale versions return 409.
- `POST /api/teacher/interactive-videos/{id}/publish` accepts `{classroomIds: string[], expectedVersion}`. It copies the current draft to each selected active owned classroom and withdraws omitted classrooms. An empty array withdraws all. Published snapshots do not change when the draft is edited.
- `DELETE /api/teacher/interactive-videos/{id}` accepts `{expectedVersion}` and soft-deletes the video, withdrawing active publications.
- `GET /api/student/interactive-videos` and `GET /api/student/interactive-videos/{publicationId}` expose only current publications of active classrooms with active membership. The list accepts `page` and optional `classroomId`; detail returns 404 after withdrawal or membership loss. Checkpoint answers support video self-practice only; no official score is recorded.

## Infographic

- `GET /api/teacher/infographics` lists the teacher's assets, with optional `chapterId`, `lessonId`, and `page`.
- `POST /api/teacher/infographics` uses multipart `title`, `chapterId`, optional `lessonId`, and `image`. The image must be valid PNG, JPEG, or WebP up to 15 MiB. The server checks that a supplied lesson belongs to the chapter. Binary data is stored on the private local disk; there is no public storage URL.
- `GET /api/teacher/infographics/{assetId}/file` streams only the owner's image.
- `POST /api/teacher/infographics/{assetId}/publish` accepts `{classroomIds: string[], expectedVersion}`. Only active owned classrooms are accepted. Omitted classrooms are withdrawn; `[]` withdraws all. Stale versions return 409.
- `GET /api/student/infographics` lists publications for active memberships, with optional `classroomId`, `chapterId`, and `page`. `GET /api/student/infographics/{assetId}/file` streams the binary only while access remains active, otherwise 404.

Infographics saved in the older browser IndexedDB library remain separate. They are not imported or treated as server publications. The current lesson editor still creates device-only asset references; lesson publication rejects those references. Linking a server asset into a published lesson requires a separate explicit contract for asset and classroom access. Deployment must provide persistent shared private storage before using uploaded files across multiple backend instances.
