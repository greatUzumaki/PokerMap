# event-analytics Specification

## Purpose
TBD - created by archiving change user-tracking-and-analytics. Update Purpose after archive.
## Requirements
### Requirement: `user_events` is the single append-only event log

The system SHALL persist every interesting action (bot, Mini App, public web, admin) in one `user_events` table with columns `id`, `occurred_at`, `telegram_user_id`, `session_id`, `kind`, `entity_type`, `entity_id`, `payload`, `request_ip`, `user_agent`. The `audit_log` table SHALL be removed; existing rows SHALL be migrated to `user_events` with `kind = 'admin.' || action` and `entity_type` / `entity_id` preserved.

#### Scenario: Schema migration moves audit rows in one transaction

- **WHEN** migration `0005_users_and_events.up.sql` runs against a database that contains `audit_log` rows
- **THEN** every prior `audit_log` row appears in `user_events` with a matching `kind`, `entity_type`, `entity_id`, `payload = diff`, and the original `created_at` as `occurred_at`
- **AND** `audit_log` is dropped after the copy
- **AND** the migration is atomic — partial failure leaves no half-state

#### Scenario: Admin mutation writes through the events package

- **WHEN** an admin publishes a club via `PATCH /v1/admin/clubs/:id` with body changing `status` from `draft` to `published`
- **THEN** a `user_events` row is appended with `kind = 'admin.club.update'`, `entity_type = 'club'`, `entity_id = <club id>`, `telegram_user_id = <admin id>`, `payload` containing the diff
- **AND** no row is written to any legacy `audit_log` table

### Requirement: Public event ingestion endpoint

The api SHALL expose `POST /v1/events` accepting a JSON body `{ events: [{ kind, payload?, occurred_at? }] }` from the public web client. The endpoint SHALL:

- Authenticate using the `pm_session` cookie if present; allow anonymous events with `session_id` from a request header `X-Anon-Session`.
- Validate each `kind` against the server-side whitelist defined in `@pokermap/types/src/events.ts`. Reject the whole batch with `400 invalid_kind` if any kind is unknown.
- Cap each event payload at 4 KiB and the batch at 10 events.
- Rate-limit per `(telegram_user_id or session_id, kind)`: max 20 events per 10 seconds, 200 events per minute, enforced via a Redis sliding window. Exceeding returns `429 rate_limited` for the whole batch.
- Attach `request_ip` and `user_agent` server-side before persisting.

#### Scenario: Valid batch is persisted

- **WHEN** an authenticated browser POSTs `{ events: [{ kind: 'web.filter_apply', payload: { games: ['NLH'] } }] }`
- **THEN** the api returns `204 No Content`
- **AND** a `user_events` row exists with the matching `kind`, `payload`, `telegram_user_id`, populated `request_ip` and `user_agent`

#### Scenario: Unknown kind is rejected

- **WHEN** the browser POSTs a batch where one event has `kind = 'web.spam.something'`
- **THEN** the api returns `400 invalid_kind`
- **AND** no row from the batch is persisted

#### Scenario: Rate limit exceeded

- **WHEN** the same session posts 25 events of `kind='web.club_view'` within 10 seconds
- **THEN** the 21st batch attempt returns `429 rate_limited`
- **AND** no rows past the rate-limit threshold are persisted

### Requirement: 30-day retention with daily prune

The api SHALL run a background goroutine that wakes once per 24 hours (offset to ~03:00 server time) and deletes rows from `user_events` whose `occurred_at` is older than `EVENTS_RETENTION_DAYS` (env, default 30). Deletion runs in batches of 10 000 to avoid long-running transactions. The number of rows deleted SHALL be logged at INFO each run.

#### Scenario: Old rows are removed

- **WHEN** the prune job runs at 03:00 and there are 50 000 rows with `occurred_at = now() - interval '31 days'` plus 100 rows from the last week
- **THEN** after the run the table contains exactly the 100 recent rows
- **AND** a log line at INFO reports `events.prune: deleted=50000`

#### Scenario: Retention value is configurable

- **WHEN** the api is started with `EVENTS_RETENTION_DAYS=90`
- **THEN** the prune deletes rows older than 90 days, not 30

#### Scenario: Retention disabled is rejected

- **WHEN** the api is started with `EVENTS_RETENTION_DAYS=0` or a negative value
- **THEN** the api logs a startup error and exits non-zero
- **AND** the operator must set a positive value to start

### Requirement: Admin listing API supports filters and cursor pagination

`GET /v1/admin/events` SHALL accept query params `from` (ISO timestamp), `to` (ISO timestamp), `kind` (repeatable, intersects), `telegramUserId` (int64), `q` (free-text substring match against `payload::text`), and `cursor` (opaque). The response SHALL include up to 50 rows ordered by `occurred_at DESC, id DESC`, plus a `nextCursor`. Admin-only access enforced by `RequireAdmin` middleware.

#### Scenario: Filter by kind and user

- **WHEN** the admin requests `GET /v1/admin/events?kind=admin.club.update&telegramUserId=42`
- **THEN** every returned row has `kind = 'admin.club.update'` and `telegram_user_id = 42`

#### Scenario: Cursor returns next page

- **WHEN** the admin requests the same filter with `cursor = <value returned previously>`
- **THEN** the response continues from the row immediately after the last seen row

### Requirement: Admin can delete events one-by-one or in bulk by filter

The api SHALL expose:

- `DELETE /v1/admin/events/:id` — deletes one row. Returns `204` on success, `404` if absent.
- `DELETE /v1/admin/events?from&to&kind&telegramUserId&confirm=true` — bulk delete; `confirm=true` is mandatory; an upper bound (`to`) is mandatory to prevent accidental whole-table wipes (`400 unbounded_delete` otherwise). Returns `200 { deleted: <count> }`.

#### Scenario: Single-row deletion

- **WHEN** the admin sends `DELETE /v1/admin/events/12345` and the row exists
- **THEN** the row is removed and the response is `204`

#### Scenario: Bulk delete with required filter

- **WHEN** the admin sends `DELETE /v1/admin/events?to=2026-04-01T00:00:00Z&kind=web.club_view&confirm=true`
- **THEN** every matching row strictly older than `to` is removed
- **AND** the response is `200 { deleted: N }`

#### Scenario: Bulk delete without time bound is refused

- **WHEN** the admin sends `DELETE /v1/admin/events?kind=web.filter_apply&confirm=true` (no `to`)
- **THEN** the response is `400 unbounded_delete` and no rows are touched

### Requirement: Web client emits high-value events

The public web app SHALL emit `user_events` for at least the following actions, via a shared `useTrack()` hook / `<TrackOnView>` wrapper that batches and POSTs to `/v1/events`:

- `web.page_view` — on every Next.js route change (path + referrer).
- `web.filter_apply` — when the user closes the filter sheet with a different `ClubFilters` shape than they opened it (payload: full filter object).
- `web.filter_reset` — when "Сбросить" is clicked.
- `web.club_view` — when a `ClubSheet` opens or `/clubs/[slug]` is navigated to (payload: `slug`).
- `web.openinmaps_click` — when the OpenInMaps button is pressed (payload: club slug, chosen provider).
- `web.share_click` — when a Telegram share button is pressed.

Each handler SHALL be tagged via either `useTrack` or `data-track-event="<kind>"` so the inventory is greppable.

#### Scenario: Filter apply produces an event

- **WHEN** the user toggles a game filter and taps "Готово"
- **THEN** within 2 seconds a `user_events` row appears with `kind = 'web.filter_apply'` and a payload matching the new filter state

#### Scenario: Page view fires once per navigation

- **WHEN** the user navigates `/` → `/list`
- **THEN** exactly one `web.page_view` event is written with `payload.path = '/list'` and `payload.from = '/'`

