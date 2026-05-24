## Context

PokerMap is a Next.js 15 + Go 1.23 monorepo (pnpm workspaces + go workspaces) with three apps: `apps/web` (public map + list), `apps/admin` (operator console), `apps/api` (chi + sqlc + pgx + Postgres). The `clubs` table today stores `working_hours` as opaque `jsonb` validated only by JSON-syntax rules, and the admin form simply round-trips that JSON through a `<textarea>`. The public map renders all published clubs as MapLibre markers; the list view is search-only. There is no public detail page — list cards are non-interactive `<Card>` elements, and the marker sheet (`ClubSheet`) shows partial info with no link out.

Production has not launched, the database has no real customers, and the only data in the table is whatever was inserted by `internal/seed/seed.go`. That gives us freedom to rewrite the working-hours contract and to drop+re-seed the catalog rather than designing a soft migration.

Stakeholders: the operator (admin user) who will enter and maintain real club data, and the end user (web or Telegram WebApp) who needs to answer "where can I play right now."

Relevant existing files: `apps/api/migrations/0001_init_clubs.up.sql`, `apps/api/internal/clubs/{handler,dto}.go`, `apps/api/internal/db/*.sql.go` (sqlc generated), `apps/api/internal/seed/seed.go`, `apps/admin/src/app/(authed)/clubs/_form/ClubForm.tsx`, `apps/web/src/app/list/ListClient.tsx`, `apps/web/src/components/map/{MapView,ClubSheet,MapShell}.tsx`, `packages/types/src/*`.

## Goals / Non-Goals

**Goals:**

- Replace the demo catalog with verifiable real Saint-Petersburg poker clubs and make every required field (address, phones, socials, hours, games) editable in the admin without touching JSON.
- Make the public surface useful right now: clickable list cards → club detail page, marker sheet → club detail page, on-map filters that match the questions users actually have ("open now", "PLO available", "buy-in I can afford").
- Make every place that shows an address openable in the user's native maps app with one tap.
- Formalize the `working_hours` shape into a typed contract enforced at the API boundary, the DB layer, and both UIs — eliminating the JSON-textarea failure mode.

**Non-Goals:**

- Real-time availability ("table running now") — we only model declared hours.
- Multi-city scope. We hardcode `Europe/Moscow` for open-now evaluation and the SPB bbox stays the map's initial view.
- Reservations, tournament schedule import, live chip counts. The `mtt-series` club type only tags venues that primarily run tournaments; it does not model individual events.
- Server-side rendering of the map. The map remains a dynamic client-only import; the new detail page is a server component.
- Mass-import automation. Initial catalog is hand-curated from public sources and embedded in `seed.go`; the admin remains the steady-state authoring tool.

## Decisions

### D1. Typed `WorkingHours` schema replaces opaque `jsonb`

Working hours are modeled as

```ts
type Slot = { open: `${number}${number}:${number}${number}`; close: `${number}${number}:${number}${number}` };
type DaySchedule = { closed: boolean; slots: Slot[] };
type WorkingHours = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DaySchedule>;
```

The Go side mirrors this with a `WorkingHours` struct that implements `json.Marshaler`/`Unmarshaler`. A new `validate` validator (`workinghours`) checks that every day key is present, that `slots` is empty iff `closed=true`, that times match `^[0-2]\d:[0-5]\d$` and that each slot's wall-clock range is non-degenerate (`open != close`). Overnight slots (`close < open`) are explicitly allowed and represent a wrap past midnight.

The DB column stays `jsonb` (`pgx` handles encoding cheaply) with an added `CHECK (jsonb_typeof(working_hours) = 'object')` plus an application-level guarantee that the shape matches. We do **not** push schema validation into Postgres (would need pl/pgsql + a per-day check), because the API layer already validates on every write and there are no other writers.

**Alternative considered**: keeping `json.RawMessage` end-to-end and only validating in the admin. Rejected — the public list/map need to call `isOpenNow` and that function must trust a typed structure, otherwise every renderer reimplements parsing.

### D2. `isOpenNow` lives in a shared TS package and a parallel Go function

Both the web filter ("Открыто сейчас") and the API filter need the same semantics. We publish a pure `isOpenNow(hours: WorkingHours, now: Date, tz = "Europe/Moscow"): boolean` from `packages/types` (TypeScript) and a `clubs.IsOpenNow(hours WorkingHours, now time.Time, loc *time.Location) bool` in `apps/api/internal/clubs`. Both implementations carry the same exhaustive unit tests covering: normal same-day slot, overnight slot before midnight, overnight slot after midnight (must inspect previous day), back-to-back slots, multiple slots same day, day where `closed=true`, slot exactly at boundary (open = inclusive, close = exclusive).

**Alternative considered**: evaluate open-now only on the server and pass a boolean per club to the client. Rejected — the client needs to recompute when the user opens the page minutes later, and React Query already caches the raw club list for 60 s; recomputing on the client is cheap and avoids cache-staleness UX bugs.

### D3. Map filters: URL is the single source of truth

The filter state is encoded as URL query params (`?openNow=1&games=NLH,PLO&types=cash&minBuyIn=5000&maxBuyIn=50000`). A `useClubFilters()` hook reads them with `useSearchParams`, exposes typed setters that `router.replace` with `scroll: false`, and returns a `filter(clubs)` predicate. Both `MapView` and `ListClient` consume the same hook, so the map's filter changes are visible after the user taps "Список". This also makes filtered states shareable and survives reload — important for power users.

**Alternative considered**: React Context with a provider in `RootLayout`. Rejected — costs nothing, but breaks shareable links and "open in new tab" semantics that users expect.

### D4. Server-side filtering only for cheap predicates

`games` (array-contains), `types` (exact match) and `minBuyIn`/`maxBuyIn` (range) are pushed into a new sqlc query `ListPublishedClubsFiltered`. `openNow` is **not** pushed into SQL — computing "is now inside any of today's or yesterday's overnight slots in Europe/Moscow" requires materializing per-row time math that ruins index use. Instead the API still returns the SQL-filtered set and the client applies `isOpenNow` as a final pass. With ~50 SPB clubs total this is trivially fast; we revisit only if we add other cities and the bbox returns thousands.

**Alternative considered**: precompute a `next_open_at` / `currently_open` materialized column refreshed by a cron. Rejected — adds infra for a tiny dataset; correctness depends on tz cron alignment.

### D5. "Open in maps" — `geo:` first, platform-specific second

Detection order at click time (not at render time, to avoid SSR/hydration mismatch):

1. If `window.Telegram?.WebApp?.openLink` is present, call it with the chosen URL (parameter `try_instant_view: false`). The default URL is the universal `https://yandex.ru/maps/?pt=lng,lat&z=17` because in-app browser usually can't deep-link to native apps.
2. Else, if `/iPad|iPhone|iPod/.test(navigator.userAgent)`: `maps://?daddr=lat,lng&q=<encoded address>` (Apple Maps registers this scheme; if the app is removed iOS opens the App Store, which is acceptable).
3. Else, if `/Android/.test(navigator.userAgent)`: `geo:lat,lng?q=lat,lng(<encoded name>)` — the OS chooser lists Google Maps, 2GIS, Yandex.Maps if installed.
4. Else (desktop): open `https://yandex.ru/maps/?pt=lng,lat&z=17` in a new tab.

A `DropdownMenu` next to the primary button always exposes "Яндекс.Карты" (web), "2ГИС" (`https://2gis.ru/spb/geo/<lng>,<lat>`), "Google Maps" (`https://www.google.com/maps/search/?api=1&query=lat,lng`) so users can override the platform pick.

**Alternative considered**: render different `<a href>` per platform during SSR using a `User-Agent` header. Rejected — Next.js cache fragmentation by UA, and the Telegram WebApp UA is the regular browser UA anyway; client-side detection is the only place where `window.Telegram` is observable.

### D6. Admin `WorkingHoursEditor` round-trip

The editor is a controlled component that holds `WorkingHours` in local state and re-serializes to a hidden input named `workingHours` on every change. Time inputs use native `<input type="time">` (good mobile UX, returns `HH:MM`). Rows render as:

```
[ Mon ] [ Открыто ▼ ] [ 18:00 ] – [ 06:00 ]  [+ слот]  [⋯]
```

The `⋯` menu offers "Скопировать в Пн–Пт", "Скопировать на все дни", "Закрыть весь день". Hidden input stays compatible with the existing `actions.ts` form-data handler — only the parse step changes from `JSON.parse` to `parseWorkingHours(input)` which validates via the shared schema and rejects with a field-level error if malformed.

**Alternative considered**: react-hook-form. Rejected for now — the rest of `ClubForm` is uncontrolled `<form action={...}>`; introducing RHF here doubles the form-state model and is out of scope.

### D7. Catalog ground truth lives in `seed.go`, not a CSV

We embed the curated SPB club list in `internal/seed/seed.go` as Go struct literals. The seed is idempotent (`q.CreateClub` already skips on duplicate slug). For this change, the seed runner is extended with a `--reset-demo` flag that deletes any club whose slug is in a hardcoded `legacyDemoSlugs` set before inserting. This keeps real-data evolution in version control (PRs review the data), avoids introducing a new file format, and means dev/test environments converge on the same catalog.

**Alternative considered**: a Postgres `COPY` from a CSV checked into the repo. Rejected — code review of CSV diffs is painful, and the small N (~10 clubs initially) does not justify the parser.

## Risks / Trade-offs

- **[Stale or wrong real-club data]** Public listings (2GIS, PokerDiscover, club Telegram channels) drift, and some clubs operate in a legal grey area and close or rebrand quietly. → Mitigation: every entry in `seed.go` carries an inline comment with the source URL and the date checked; the admin can edit any field without redeploy; we mark uncertain phones/hours as `nil`/empty rather than guess.
- **[Open-now drift between client and server]** Two implementations of `isOpenNow` can diverge. → Mitigation: both ports load the same JSON test fixture (`packages/types/test-fixtures/working-hours-cases.json`) and assert identical outputs; CI runs both suites on PR.
- **[Telegram WebApp can't open native maps]** Telegram's in-app browser ignores `geo:` / `maps://`. → Mitigation: when inside Telegram we route to `Telegram.WebApp.openLink(yandexWebUrl)`, which Telegram intercepts and offers "Open in browser"; users who want the native chooser get it after that one tap.
- **[Migration adds NOT NULL columns]** Adding `club_type` and `social_links` NOT NULL would fail on existing rows. → Mitigation: ship with sensible defaults (`'cash'`, `'{}'::jsonb`); the migration runs `UPDATE clubs SET ...` in the same transaction before the `SET NOT NULL` step.
- **[Filter URL pollution]** Long shared URLs with five chip selections look noisy. → Mitigation: serialize empty/default values as absent params (no `&openNow=0`), keep the canonical order in the URL writer.
- **[`geo:` intent inconsistent on Android]** Some Android OEMs default `geo:` to Chrome rather than the chooser. → Mitigation: dropdown menu always exposes explicit options.

## Migration Plan

1. Land the migration `0004_clubs_typed_hours_and_filters` in a single PR with backfill of any non-conforming `working_hours` rows. The seed file is updated in the same PR; running the API with `SEED_ON_BOOT=1` produces the new catalog.
2. Ship API changes (DTO, validators, filter query) and shared types behind the same PR — types and API are co-versioned.
3. Ship admin form edit and web filter UI in a follow-up PR (so the API is already serving the new fields when the UIs need them).
4. Rollback strategy: the down migration drops the new columns; `seed.go` is reverted via git. There is no production data to preserve. If a single field (say `entry_fee_cents`) causes problems, we can ship a small fixup migration to drop just that column rather than reverting the whole change.

## Open Questions

- Should `social_links` be a free-form map (`{vk: "...", instagram: "...", custom: [{label, url}]}`) or a fixed set of platforms? Decision: fixed set for v1 (vk, instagram, youtube, telegramChannel) — easier to render uniform icons. Revisit if operators ask for arbitrary links.
- Open-now strictly requires server-time-of-request, but the client uses `new Date()`. If the client clock is way off (e.g. user travelling) we'll mislabel. Acceptable for v1; future iteration could fetch server time via a `GET /v1/now` endpoint and pass it to the helper.
- Do we want a "Closed temporarily" admin flag distinct from `status='archived'`? Out of scope for this change; tracked separately if operators request it.
