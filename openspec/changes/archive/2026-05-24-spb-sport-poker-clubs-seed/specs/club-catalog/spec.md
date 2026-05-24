## MODIFIED Requirements

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
