# user-tracking Specification

## Purpose
TBD - created by archiving change user-tracking-and-analytics. Update Purpose after archive.
## Requirements
### Requirement: `users` table is the canonical Telegram identity

The system SHALL persist every Telegram identity that has interacted with any surface (bot, Mini App, or any future channel) in a single `users` table. The table SHALL store `telegram_user_id` (primary key), `first_name`, `last_name`, `username`, `language_code`, `is_premium`, `is_bot`, `photo_url`, `allows_write_to_pm`, `first_seen_at`, `last_seen_at`, and `last_action_at`. Every field except `first_seen_at` is updated on subsequent visits; `first_seen_at` is set on the first observation and is immutable thereafter.

#### Scenario: Mini App open populates a new user

- **WHEN** a Telegram user opens the Mini App for the first time and the api validates the initData
- **THEN** a `users` row is inserted with the id, names, and username from initData, `is_premium = initData.user.is_premium ?? false`, `first_seen_at = now`, `last_seen_at = now`
- **AND** an `app.open` event is appended to `user_events`

#### Scenario: Existing user's profile is refreshed

- **WHEN** a returning user opens the Mini App and their Telegram username has changed since last visit
- **THEN** the existing row's `username` is updated to the new value
- **AND** `first_seen_at` remains the original value
- **AND** `last_seen_at` is bumped to now

#### Scenario: User has no last name on Telegram

- **WHEN** a user with only `first_name` set on Telegram opens the Mini App
- **THEN** the row is written with `last_name = ''` (empty string, NOT NULL) and `username = NULL`
- **AND** no error is surfaced

### Requirement: `admins` row references `users`

The `admins` table SHALL have a foreign key `telegram_user_id` referencing `users.telegram_user_id` with `ON DELETE CASCADE`. It SHALL NOT be possible to insert an admin row for a `telegram_user_id` that does not exist in `users`.

#### Scenario: Adding an admin upserts the user

- **WHEN** the operator promotes Telegram user `99` to admin by setting `ADMIN_TELEGRAM_IDS=99` and restarting the api
- **THEN** before the `admins` row is inserted, a `users` row for `99` is created with a placeholder name (filled when user next interacts)
- **AND** the `admins` row is inserted referencing it

#### Scenario: Deleting a user cascades to admins

- **WHEN** a `users` row is deleted (administrative action, not via product flow)
- **THEN** the matching `admins` row is also deleted

### Requirement: `last_seen_at` is updated by middleware at most once per minute per user

The api SHALL include a middleware that, on any authenticated request, attempts to update `users.last_seen_at = now()` for the current user. To avoid hot-row contention, the middleware SHALL coalesce updates per user via Redis (`SETEX last_seen:<id> 60 NX`) so at most one DB update is issued per user per minute.

#### Scenario: Rapid request burst issues one DB update

- **WHEN** a single authenticated user makes 50 requests to the api in 5 seconds
- **THEN** at most one `UPDATE users SET last_seen_at` statement is executed against Postgres for that user
- **AND** the subsequent 49 requests touch only Redis

#### Scenario: Redis unavailable degrades gracefully

- **WHEN** Redis is unreachable and an authenticated request arrives
- **THEN** the middleware logs a debug message and does not update `last_seen_at`
- **AND** the request is otherwise served normally

