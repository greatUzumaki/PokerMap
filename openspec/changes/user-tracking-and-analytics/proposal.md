## Why

PokerMap has no visibility into who uses the app or what they do inside it. The bot currently does not even register users that press `/start`, Mini App opens are not recorded, public-site interactions (filter changes, club detail opens, list scrolls) leave no trace, and the existing `audit_log` table only captures admin mutations. The operator has no way to answer "how many real visitors did we have today", "which clubs are people clicking", "which filters are popular", or "is this Telegram user the same one who pressed /start yesterday". This change introduces full user identity capture, sitewide event tracking, and an Analytics view in the admin panel so the operator can reason about adoption and trim the feedback loop on UX changes.

## What Changes

- Add a **Telegram bot webhook** at `POST /v1/tg/webhook` that handles `/start` (and future bot commands), upserts the Telegram user into a new `users` table, and writes a `bot_start` event. The webhook URL is registered with Telegram by a one-shot `set-webhook.sh` script + on api boot if missing.
- Add a new **`users`** table that captures every Telegram identity the system has seen — `telegram_user_id`, `first_name`, `last_name`, `username`, `language_code`, `is_premium`, `photo_url`, `allows_write_to_pm`, `first_seen_at`, `last_seen_at`, `last_action_at`. Existing `admins.telegram_user_id` becomes a foreign key into `users` so we never have an admin without a user row.
- Add a new **`user_events`** table that captures every interesting action, indexed by `(telegram_user_id, occurred_at desc)` and by `(kind, occurred_at desc)`. The existing `audit_log` table is migrated into this single events table (admin mutations become events with `kind='admin.<verb>'` and `entity_*` filled in). Each event carries an optional `session_id`, `kind`, free-form `payload` JSONB, and references to `entity_type`/`entity_id` where applicable.
- **Capture sources**:
  - Bot `/start` → server-side via webhook.
  - Mini App open → extend `POST /v1/auth/telegram`. Upsert into `users` with every field Telegram provides (currently we keep only the id and a display name), bump `last_seen_at`, write an `app_open` event.
  - Server-rendered public site (browser) → new public endpoint `POST /v1/events` accepting `{kind, payload}` from the client; rate-limited and CORS-locked to `pargach.ru`.
  - Admin mutations → existing `audit_log` write paths fold into `user_events` with `kind='admin.<verb>'`. **BREAKING** for any external reader of `audit_log` (none exist outside this repo).
  - Client-side instrumentation: a small `useTrack()` hook and a `<TrackOnView>`/`<TrackOnClick>` wrapper used to mark high-value actions (filter apply, club detail open, list scroll, telegram share, etc).
- Add **automatic retention**: a Go goroutine in the api process runs daily at 03:00 UTC and deletes `user_events` rows older than 30 days. Configurable via `EVENTS_RETENTION_DAYS` env (default 30). Documented in the api README.
- Add **admin Analytics page** (rename `(authed)/audit` → `(authed)/analytics`, update sidebar label). Lists `user_events` with server-side filters: date range (default last 7 days), `kind` multi-select, `telegramUserId` lookup, free-text search across payload. Each row is one-click expandable to show payload. Includes a "Delete" button per row and a "Delete all matching current filter" bulk action behind a confirm dialog.
- Add **admin Users page** (`(authed)/users`) listing users with name, username, language, is_premium flag, first_seen, last_seen, total event count, and a per-user "View activity" link that opens the Analytics page pre-filtered to that user.
- Update `apps/web` and `apps/admin` to mark high-value UI elements with `data-event` attributes (filters, club detail open, share, search submit, OpenInMaps click, etc) so a single global click/visibility listener forwards them to `/v1/events`.
- Update `apps/api` to bump `users.last_seen_at` on every authenticated request (cheap update, batched in middleware).

## Capabilities

### New Capabilities

- `telegram-bot`: Webhook-based Telegram bot for PokerMap. Handles `/start` (registers the user, writes a `bot_start` event, returns a welcome reply with a link/button to open the Mini App), and provides the `set-webhook` mechanism. Future commands (`/help`, `/find`) will hang off this same capability.
- `user-tracking`: Persistent record of every Telegram identity that has interacted with PokerMap, including the full Telegram user profile, first/last seen timestamps, and the relation to admin role. Centralises user identity so analytics, admin permissioning, and any future per-user feature all draw from one table.
- `event-analytics`: Captures every interesting action across the bot, Mini App, public web, and admin panel into one append-only event log. Includes the public ingestion endpoint, the client instrumentation conventions, the 30-day retention policy, and the admin Analytics + Users views that present the data with filters and a manual-purge UI.

### Modified Capabilities

- `admin-panel`: Adds the renamed Analytics page (replaces the bare Audit list), a new Users page, and per-user "view activity" navigation. Existing audit-log read endpoint is renamed/extended to serve `user_events` with filtering; admin mutations now write through the events table.
- `club-catalog`: Mutation write paths (`Insert`, `Update`, `Publish`, etc.) emit a `user_events` row with `kind='admin.<verb>'` instead of writing to `audit_log` directly. The behaviour from the operator's perspective (audit trail of who changed what) is unchanged, but the storage target moves.

## Impact

- **Code**:
  - New: `apps/api/internal/bot/` package (webhook handler + Telegram client + set-webhook entrypoint).
  - New: `apps/api/internal/users/` package (upsert, last-seen middleware, list/get queries).
  - New: `apps/api/internal/events/` package (insert, list with filters, delete, retention job).
  - New: `apps/api/migrations/0005_users_and_events.up.sql` / `.down.sql` — creates `users`, `user_events`, migrates `audit_log` rows in, drops `audit_log`. Add FK `admins.telegram_user_id -> users.telegram_user_id`.
  - Modified: `apps/api/cmd/api/main.go` — start retention goroutine, register bot handler, attach last-seen middleware.
  - Modified: `apps/api/internal/auth/telegram.go` — return full TelegramUser fields (already partial; need `language_code`, `photo_url`, `allows_write_to_pm`).
  - Modified: `apps/api/internal/authh/handler.go` — upsert into `users`, write `app_open` event.
  - Modified: `apps/api/internal/clubs/handler.go` and any other admin mutation site — write through events package.
  - New: `apps/admin/src/app/(authed)/analytics/` (replaces `audit/`).
  - New: `apps/admin/src/app/(authed)/users/`.
  - Modified: `apps/admin/src/components/sidebar` (rename Audit → Analytics, add Users).
  - New: `apps/web/src/lib/track.ts` (client emitter, batches POSTs to `/v1/events`).
  - New: `apps/web/src/components/track/TrackOnClick.tsx` / `TrackOnView.tsx`.
  - Modified: public web call sites that mark high-value actions (MapFilters, ClubSheet, OpenInMapsButton, BottomNav links, MapStage filter-reset button).
  - New: `packages/types/src/events.ts` — shared `EventKind` union and zod schema reused by api + web + admin.
- **APIs**:
  - `POST /v1/tg/webhook` — public, accepts Telegram Update payloads.
  - `POST /v1/events` — public, rate-limited, anonymous if no session, captures action.
  - `GET /v1/admin/events?from&to&kind&telegramUserId&q&cursor` — paged listing.
  - `DELETE /v1/admin/events/:id` — single row.
  - `DELETE /v1/admin/events` — bulk delete by filter, requires `confirm=true` and an explicit time-bound filter.
  - `GET /v1/admin/users?cursor&q&sort` — paged listing of `users`.
  - `GET /v1/admin/users/:telegramUserId` — single user with profile.
  - Existing `audit_log` read endpoint removed (callers updated to events endpoint).
- **Dependencies**: no new app-level deps. Telegram bot can be hit with stdlib `net/http`; no Go SDK needed.
- **Systems / external**:
  - Telegram: webhook must be set once per environment via `set-webhook.sh` with the bot token and the public URL (`https://pargach.ru/poker/api/v1/tg/webhook`). The Telegram-side webhook supports secret-token header (`X-Telegram-Bot-Api-Secret-Token`) — we use it to authenticate inbound requests.
  - Storage: events table grows by ~1 row per user action; 30-day retention keeps it bounded (~MB-scale for typical pet-project traffic).
  - Privacy: by capturing full Telegram profile and every action, we now hold PII. Document this in `apps/api/README.md` and gate cross-project access at the Postgres-role level (already enforced by `shared-data-services`).
