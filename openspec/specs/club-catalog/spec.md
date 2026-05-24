# club-catalog

## Purpose

The club catalog is PokerMap's core data model and read API: a curated, slug-addressable set of poker clubs in Saint Petersburg with addresses, geocoordinates, photos, games, buy-in ranges, working hours, contacts, and a draft → published → archived lifecycle. Surfaces the public list/map via [[public-map-ui]] and the admin CRUD via [[admin-panel]], backed by a Postgres schema, sqlc queries, an HTTP handler with cursor pagination and filtering, and an audit log of every mutation.
## Requirements
### Requirement: Real Saint Petersburg poker clubs are seeded

The application SHALL ship a curated catalog of real Saint Petersburg **sport-poker (rating-only, non-monetary)** venues. The seed routine MUST replace the legacy demo rows AND the legacy cash-club rows (those whose slug appears in the embedded `legacyDemoSlugs` set) rather than coexist with them. Every seeded entry MUST carry a verifiable real address (except `draft` rows whose location is variable), at least one contact channel (phone, website, telegram, or social link), a typed working-hours schedule, one or more games, and a non-null `entry_fee_cents` reflecting the fixed organizational fee. The catalog MUST NOT contain cash-poker venues, PPPoker-based clubs, or any venue advertising rake/buy-in.

#### Scenario: Seed runs on an empty database

- **WHEN** the API boots against an empty `clubs` table and the seed routine executes
- **THEN** every inserted row has a non-empty `address` (or `status = 'draft'` with explanation in description), a non-zero `lat`/`lng` inside the Saint Petersburg bbox (lat 59.7–60.1, lng 30.0–30.6), at least one element in `phones` OR a non-null `website` OR a non-null `telegram_url` OR a non-empty entry in `social_links`, a `working_hours` value matching the typed `WorkingHours` schema, at least one element in `games`, a non-null `entry_fee_cents`, and `min_buy_in_cents` / `max_buy_in_cents` both `NULL`
- **AND** at least 6 rows have `status = 'published'`

#### Scenario: Seed runs against a database containing legacy demo or cash slugs

- **WHEN** the seed routine runs and any of `royal-poker-club`, `neva-cardroom`, `petrogradka-poker`, `moskovsky-poker`, `vasilevsky-card`, `kupchino-poker`, `bluff`, `pulse`, `elo-club`, `obriens-poker`, `cromulent-club` exist in `clubs`
- **THEN** those rows are deleted before the new catalog is inserted
- **AND** the post-seed catalog contains no club whose `description` is "Демо-данные. Замените реальной информацией."
- **AND** no row has `rake_description` containing "%" (sport-poker has no rake)

#### Scenario: Each seeded club cites its source

- **WHEN** a contributor reads `apps/api/internal/seed/seed_spb.go`
- **THEN** every club struct literal is preceded by a Go comment naming the source URL (the club's website, official Telegram channel, Instagram, 2GIS, or Yandex Maps) the data was checked against and an ISO date of the check

#### Scenario: Catalog excludes cash and PPPoker venues

- **WHEN** the seed routine finishes
- **THEN** no row has `club_type = 'underground'` (reserved for cash/PPPoker fallback — kept in enum but unused by seeder)
- **AND** no row's `description` mentions "PPPoker", "рейкбэк", "rakeback", "buy-in за деньги", or "кэш-игры"

### Requirement: `clubs` row carries typed working-hours, club type, social links, and entry fee

The `clubs` table SHALL persist working hours as a JSONB document conforming to the typed `WorkingHours` schema (`{ mon..sun: { closed: bool, slots: [{ open: "HH:MM", close: "HH:MM" }] } }`), a `club_type` enum, a `social_links` JSONB document, and an optional `entry_fee_cents`. The API SHALL reject any write whose working-hours payload deviates from the schema.

#### Scenario: Migration adds new columns with safe defaults

- **WHEN** migration `0004_clubs_typed_hours_and_filters.up.sql` runs against a database created by migration `0001`
- **THEN** the `clubs` table has columns `club_type club_type NOT NULL DEFAULT 'cash'`, `social_links jsonb NOT NULL DEFAULT '{}'::jsonb`, `entry_fee_cents bigint`
- **AND** every pre-existing row has `club_type = 'cash'` and `social_links = '{}'::jsonb`

#### Scenario: API rejects malformed working hours on create

- **WHEN** a `POST /v1/admin/clubs` request supplies a `workingHours` body that is missing a day key, has `closed=true` together with a non-empty `slots` array, has a slot with `open=="06:00"` and `close=="06:00"`, or has a time that does not match `^[0-2]\d:[0-5]\d$`
- **THEN** the API responds `400 invalid_working_hours` with a field-level error pointing to `workingHours`
- **AND** no row is written

#### Scenario: API accepts overnight slots

- **WHEN** a `POST /v1/admin/clubs` request supplies a slot `{ "open": "20:00", "close": "06:00" }`
- **THEN** the request succeeds and the slot is persisted unchanged

#### Scenario: API rejects unknown `clubType`

- **WHEN** a write supplies `clubType: "casino"` (not in `cash`, `club`, `mtt-series`, `mafia-and-poker`, `underground`)
- **THEN** the API responds `400 invalid_club_type` and no row is written

### Requirement: `isOpenNow` is correct across overnight slots and timezones

The system SHALL expose a shared `isOpenNow(hours, now, "Europe/Moscow")` helper, implemented in both TypeScript (`@pokermap/types`) and Go (`internal/clubs`), that returns `true` if and only if `now` (converted to the supplied timezone) falls inside any open slot for the current weekday, OR inside the tail of an overnight slot belonging to the previous weekday.

#### Scenario: Open during a same-day slot

- **WHEN** `hours.mon.slots = [{ open: "12:00", close: "20:00" }]` and `now` is Monday 14:30 Europe/Moscow
- **THEN** `isOpenNow` returns `true`

#### Scenario: Closed before any slot opens

- **WHEN** the same Monday slot exists and `now` is Monday 11:59 Europe/Moscow
- **THEN** `isOpenNow` returns `false`

#### Scenario: Closed at the exact `close` boundary

- **WHEN** the same Monday slot exists and `now` is Monday 20:00:00 Europe/Moscow
- **THEN** `isOpenNow` returns `false` (close is exclusive)

#### Scenario: Open inside an overnight slot before midnight

- **WHEN** `hours.fri.slots = [{ open: "20:00", close: "06:00" }]` and `now` is Friday 23:30 Europe/Moscow
- **THEN** `isOpenNow` returns `true`

#### Scenario: Open inside an overnight slot after midnight (previous day owns the slot)

- **WHEN** `hours.fri.slots = [{ open: "20:00", close: "06:00" }]` and `now` is Saturday 02:30 Europe/Moscow
- **THEN** `isOpenNow` returns `true`

#### Scenario: Day marked closed

- **WHEN** `hours.sun.closed = true` and `now` is Sunday 14:30 Europe/Moscow
- **THEN** `isOpenNow` returns `false`

#### Scenario: TypeScript and Go ports agree on shared fixtures

- **WHEN** the shared fixture `packages/types/test-fixtures/working-hours-cases.json` is evaluated by both ports for the same `(hours, now, tz)` triples
- **THEN** every case yields the same boolean from both implementations

### Requirement: Public list filters server-side on cheap predicates

The `GET /v1/clubs` endpoint SHALL accept query params `games` (comma-separated whitelist), `types` (comma-separated `clubType` whitelist), `minBuyIn` and `maxBuyIn` (integer kopecks) and SHALL apply them at the SQL layer. The `openNow` predicate is documented as a client-side filter and the endpoint SHALL NOT accept it.

#### Scenario: Filter by game intersects array

- **WHEN** the request is `GET /v1/clubs?games=PLO,PLO5`
- **THEN** the response contains only clubs whose `games` array contains at least one of `PLO` or `PLO5`

#### Scenario: Filter by club type matches exactly

- **WHEN** the request is `GET /v1/clubs?types=cash,club`
- **THEN** the response contains only clubs whose `club_type` is `cash` or `club`

#### Scenario: Buy-in range filter is inclusive

- **WHEN** the request is `GET /v1/clubs?minBuyIn=5000&maxBuyIn=50000`
- **THEN** the response contains clubs whose declared range overlaps `[5000, 50000]` (`max_buy_in_cents IS NULL OR max_buy_in_cents >= 5000`) AND (`min_buy_in_cents IS NULL OR min_buy_in_cents <= 50000`)

#### Scenario: Unknown filter values are rejected

- **WHEN** the request is `GET /v1/clubs?games=BLACKJACK`
- **THEN** the response is `400 invalid_filter` and the error payload names the offending param

### Requirement: Club detail is reachable by slug

The endpoint `GET /v1/clubs/{slug}` SHALL return a single published club's full DTO, including the new `clubType`, `socialLinks` and `entryFeeCents` fields, with `404 not_found` for unknown slugs and for any club whose status is not `published`.

#### Scenario: Published club is returned

- **WHEN** `GET /v1/clubs/bluff` is requested and a published club with slug `bluff` exists
- **THEN** the response is `200` with the club DTO and `Cache-Control: public, max-age=60`

#### Scenario: Draft club is hidden from public endpoint

- **WHEN** `GET /v1/clubs/<slug>` is requested and the matching club has status `draft`
- **THEN** the response is `404 not_found`

### Requirement: Mutation handlers emit `user_events` instead of `audit_log` rows

The admin mutation handlers (`Insert`, `Update`, `Publish`, `Archive`, `Delete` on clubs and any future entity) SHALL emit a `user_events` row through the shared `events.Record(ctx, kind, entityType, entityID, diff)` helper. Direct writes to a legacy `audit_log` table SHALL NOT exist after this change. The `kind` value SHALL be `'admin.<entity>.<verb>'` (e.g. `'admin.club.update'`).

#### Scenario: Club update writes one event with the diff

- **WHEN** an admin publishes club `cb12` by changing `status: 'draft' → 'published'`
- **THEN** exactly one `user_events` row is written with `kind = 'admin.club.update'`, `entity_type = 'club'`, `entity_id = 'cb12'`, `payload` containing the field-level diff, `telegram_user_id` = the admin's id, `occurred_at` ≈ now

#### Scenario: Failed mutation writes no event

- **WHEN** an admin submits an invalid club update that fails validation
- **THEN** the mutation is rejected with `400` and no `user_events` row is written

