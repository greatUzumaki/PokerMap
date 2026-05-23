## ADDED Requirements

### Requirement: Admin route segment
The web app SHALL host the admin panel under the `/admin` route segment. The segment's `layout.tsx` SHALL be a Server Component that verifies the session cookie and the `is_admin` claim; unauthorized requests SHALL receive a 404 (not 403) to avoid revealing the admin surface.

#### Scenario: Non-admin sees 404
- **WHEN** a user with a valid session but `is_admin = false` requests `/admin`
- **THEN** the response is a Next.js `notFound()` 404 page

#### Scenario: Unauthenticated sees 404
- **WHEN** an unauthenticated user requests `/admin`
- **THEN** the response is a 404 page (no redirect to a login screen — admin auth happens via Telegram only)

### Requirement: Admin allowlist
The system SHALL store an `admins` table with columns `telegram_user_id` (PK), `display_name`, `created_at`. The list SHALL be seeded on first boot from `ADMIN_TELEGRAM_IDS` (comma-separated env var). After first boot the table is the source of truth.

#### Scenario: Seed on first boot
- **WHEN** the API starts against a database with an empty `admins` table and `ADMIN_TELEGRAM_IDS=123,456`
- **THEN** the API inserts rows for Telegram IDs 123 and 456 with placeholder display names

#### Scenario: Allowlist takes precedence
- **WHEN** `ADMIN_TELEGRAM_IDS` is empty but the `admins` table already has rows
- **THEN** the API treats the existing rows as the truth and does not wipe them

### Requirement: Club list and editor
The admin panel SHALL show a paginated table of all clubs regardless of status, with columns: status badge, name, slug, address, last updated. Each row SHALL have an Edit action that opens a form for that club. The form SHALL support creating, editing, and archiving clubs and SHALL submit via Next.js Server Actions to the Go API.

#### Scenario: Edit a club
- **WHEN** an admin opens an existing club's edit page, changes the description, and submits
- **THEN** the API receives a `PUT /v1/admin/clubs/:id` with the updated fields, the table refreshes, and a toast confirms success

#### Scenario: Create a club
- **WHEN** an admin opens `/admin/clubs/new`, fills the form (name, slug, address, lat, lng required), and submits
- **THEN** the API receives `POST /v1/admin/clubs`, the new club appears in the table in `draft` status

#### Scenario: Form validation
- **WHEN** an admin submits the form with an invalid slug
- **THEN** the form displays a field-level error from the API's 422 response without losing the user's other inputs

### Requirement: Status transitions
The editor SHALL provide three explicit transition actions: "Save as draft", "Publish", "Archive". Publishing a `draft` SHALL set `status = 'published'`. Archiving SHALL set `status = 'archived'`. Status transitions SHALL be recorded in `audit_log`.

#### Scenario: Publish a draft
- **WHEN** an admin clicks "Publish" on a draft club with all required fields filled
- **THEN** the club's status becomes `published` and it appears in public `GET /v1/clubs` immediately

### Requirement: Geo picker
The club form SHALL include an embedded map that lets the admin click to set `lat`/`lng`, or paste coordinates manually. The map SHALL show the current marker position and update as fields change.

#### Scenario: Click to set location
- **WHEN** an admin clicks somewhere on the embedded map
- **THEN** the `lat` and `lng` fields populate with that point and the visible marker moves there

### Requirement: Photo uploads
The admin panel SHALL allow uploading club photos via presigned MinIO URLs. The browser SHALL request a presigned URL from `POST /v1/admin/uploads/sign`, PUT the file directly to MinIO, then POST the resulting object key to attach it to the club. Allowed mime types SHALL be `image/jpeg`, `image/png`, `image/webp`; max size 8 MB per file.

#### Scenario: Successful upload
- **WHEN** an admin selects a JPEG under 8 MB and confirms upload
- **THEN** the file uploads directly to MinIO, the admin sees a preview, and the photo appears in the club's gallery on save

#### Scenario: Oversized file rejected
- **WHEN** an admin selects a file larger than 8 MB
- **THEN** the UI rejects the file before requesting a presigned URL and shows a clear error

### Requirement: Audit log
The system SHALL write to an `audit_log` table on every admin mutation: `id`, `actor_telegram_user_id`, `action` (create/update/archive/publish), `entity_type` (`club`), `entity_id`, `diff` (JSONB before/after for changed fields), `created_at`. The admin panel SHALL surface a per-club history view.

#### Scenario: Edit recorded
- **WHEN** an admin updates a club's working hours
- **THEN** an `audit_log` row is inserted with the diff showing the previous and new `working_hours` JSON
