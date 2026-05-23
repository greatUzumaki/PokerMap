## ADDED Requirements

### Requirement: Club domain model
The system SHALL persist poker clubs with the fields: `id` (UUIDv7 PK), `slug` (unique, kebab-case), `name`, `address`, `lat`, `lng`, `description` (markdown), `phones` (text array), `website`, `telegram_url`, `working_hours` (JSONB, per-weekday open/close array with breaks), `games` (text array — e.g., `NLH`, `PLO`, `MTT`, `SnG`), `min_buy_in_cents`, `max_buy_in_cents`, `rake_description`, `photo_keys` (text array of MinIO keys), `status` (enum: `draft|published|archived`), `created_at`, `updated_at`. The `clubs.slug` column SHALL have a unique index and `clubs(lat, lng)` SHALL have a btree index.

#### Scenario: Insert a club
- **WHEN** the system inserts a club with valid data
- **THEN** the row is persisted with a generated UUIDv7 `id`, `created_at` and `updated_at` set to the current UTC timestamp, and `status` defaulting to `draft`

#### Scenario: Slug uniqueness enforced
- **WHEN** the system attempts to insert a second club with a slug already used
- **THEN** the database rejects the insert with a unique-violation error

### Requirement: Public list endpoint
The system SHALL expose `GET /v1/clubs` returning all clubs with `status = 'published'`. The endpoint SHALL support cursor-based pagination (`?cursor=<opaque>&limit=<1..100>`, default 50) and an optional bounding-box filter (`?bbox=minLng,minLat,maxLng,maxLat`). Response items SHALL include only fields safe for public exposure (omits `audit_log` references and draft fields).

#### Scenario: Default listing
- **WHEN** an unauthenticated client calls `GET /v1/clubs`
- **THEN** the API responds 200 with a JSON object `{ items: Club[], nextCursor: string|null }` containing only published clubs

#### Scenario: Bounding-box filter
- **WHEN** the client calls `GET /v1/clubs?bbox=30.2,59.85,30.5,60.05`
- **THEN** the response includes only published clubs whose `lat`/`lng` fall within the box

#### Scenario: Pagination
- **WHEN** the client calls `GET /v1/clubs?limit=10` and follows the `nextCursor`
- **THEN** subsequent pages return non-overlapping items in stable order by `created_at` DESC, `id` DESC

### Requirement: Public detail endpoint
The system SHALL expose `GET /v1/clubs/:slug` returning a single published club. Unknown or non-published slugs SHALL return 404.

#### Scenario: Fetch by slug
- **WHEN** a client requests `GET /v1/clubs/royal-poker-spb` and the club is published
- **THEN** the API responds 200 with the full public club object

#### Scenario: Draft hidden
- **WHEN** a client requests a slug whose club is in `draft` status
- **THEN** the API responds 404 (not 403, to avoid leaking existence)

### Requirement: Admin CRUD endpoints
The system SHALL expose `POST /v1/admin/clubs`, `PUT /v1/admin/clubs/:id`, and `DELETE /v1/admin/clubs/:id` gated by the admin middleware. `DELETE` SHALL set `status = 'archived'` and SHALL NOT remove the row.

#### Scenario: Admin creates a club
- **WHEN** an admin POSTs a valid club payload
- **THEN** the API responds 201 with the new club and `Location: /v1/admin/clubs/{id}`

#### Scenario: Admin updates a club
- **WHEN** an admin PUTs to `/v1/admin/clubs/{id}` with a partial payload
- **THEN** only provided fields are updated, `updated_at` is bumped, and an entry is written to `audit_log`

#### Scenario: Admin archives a club
- **WHEN** an admin DELETEs `/v1/admin/clubs/{id}`
- **THEN** the club's status becomes `archived`, it disappears from public endpoints, and the row remains for history

#### Scenario: Non-admin rejected
- **WHEN** an authenticated non-admin user calls any `/v1/admin/clubs/*` endpoint
- **THEN** the API responds 403 with `{ error: { code: "forbidden" } }`

### Requirement: Validation
The system SHALL validate club payloads at the API boundary: `slug` matches `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`, `lat` in `[-90,90]`, `lng` in `[-180,180]`, `name` length 1..200, `description` length ≤ 20000, `games` items from a fixed enum (`NLH|PLO|PLO5|MTT|SnG|Mixed|Other`), `working_hours` schema-checked. Invalid payloads SHALL respond 422 with field-level errors.

#### Scenario: Invalid slug rejected
- **WHEN** an admin submits a club with `slug: "Royal Club!"`
- **THEN** the API responds 422 with `{ error: { code: "validation", details: [{ field: "slug", message: ... }] } }`

### Requirement: Seeds
The system SHALL ship a deterministic `make seed` target that inserts a curated set of real Saint Petersburg poker clubs in `published` status, suitable for showing a populated map in development.

#### Scenario: Seed populates clubs
- **WHEN** the user runs `make seed` against an empty database
- **THEN** at least five real SPb poker clubs appear in `GET /v1/clubs` with valid coordinates inside the SPb bounding box
