## ADDED Requirements

### Requirement: Bucket layout
The system SHALL use a single MinIO bucket `pokermap-photos` (private, no anonymous access) and store club photos under keys of the form `clubs/{club_id}/{uuid}.{ext}`. The bucket SHALL be created idempotently by `make minio-bootstrap`.

#### Scenario: Bootstrap idempotent
- **WHEN** the user runs `make minio-bootstrap` twice
- **THEN** the second run is a no-op and exits 0

### Requirement: Presigned upload flow
The system SHALL expose `POST /v1/admin/uploads/sign` accepting `{ filename, mime, size }` and returning `{ url, key, expiresAt }`. The endpoint SHALL reject mime types not in `image/jpeg`, `image/png`, `image/webp` and sizes greater than 8 MB. Presigned URLs SHALL expire after 5 minutes.

#### Scenario: Sign request succeeds
- **WHEN** an admin client POSTs valid `filename=club.jpg`, `mime=image/jpeg`, `size=1500000`
- **THEN** the API responds 200 with a presigned PUT URL pointing at the bucket and an `expiresAt` 5 minutes in the future

#### Scenario: Disallowed mime rejected
- **WHEN** an admin client POSTs `mime=image/gif`
- **THEN** the API responds 422 with `{ error: { code: "unsupported_media_type" } }`

#### Scenario: Non-admin rejected
- **WHEN** a non-admin session calls the endpoint
- **THEN** the API responds 403

### Requirement: Proxied public reads
The web app SHALL expose a route handler at `app/api/media/[...key]/route.ts` that, on `GET`, issues a 5-minute presigned MinIO GET URL and `302` redirects to it. The handler SHALL NOT require authentication so embedded photos load in any context (Telegram WebView, public web).

#### Scenario: Public photo loads
- **WHEN** a club detail card embeds `<img src="/api/media/clubs/{id}/{uuid}.jpg" />`
- **THEN** the browser receives a 302 to a presigned MinIO URL and loads the image

#### Scenario: Unknown key 404s
- **WHEN** the route handler is asked for a key that does not exist
- **THEN** the response is 404 (the MinIO `HEAD` precheck failed)

### Requirement: Photo lifecycle
When a club is archived, its photo objects SHALL remain in MinIO (no deletion) until an explicit cleanup pass is run, so audit history retains visual evidence. Photo orphans (objects whose key references a deleted `club_id`) SHALL be detectable by a future `make media-orphans` report.

#### Scenario: Archive preserves photos
- **WHEN** an admin archives a club with three uploaded photos
- **THEN** the photos remain in the `clubs/{club_id}/` prefix and the `audit_log` row references their keys
