## 1. Shared types and helpers (`packages/types`)

- [x] 1.1 Define `WorkingHours`, `DaySchedule`, `Slot`, `ClubType`, `SocialLinks`, `EntryFee` TypeScript types in `packages/types/src/club.ts` (or extend the existing `Club` definition); export from package index.
- [x] 1.2 Add `isOpenNow(hours: WorkingHours, now: Date, tz: string): boolean` to `packages/types/src/openNow.ts`, using `Intl.DateTimeFormat` parts to convert `now` to wall-clock in `tz`, handling overnight slots by also inspecting the previous day.
- [x] 1.3 Create shared fixture `packages/types/test-fixtures/working-hours-cases.json` listing `(hours, nowISO, tz, expected)` cases covering all scenarios in `specs/club-catalog/spec.md` `isOpenNow` block.
- [x] 1.4 Add Vitest suite `packages/types/src/openNow.test.ts` that loads the fixture and asserts `isOpenNow` matches every `expected`; include explicit boundary cases (close exclusive at 20:00:00.000, open inclusive at 12:00:00.000).
- [x] 1.5 Add a `parseWorkingHours(raw: unknown): WorkingHours` helper with a Zod (or hand-rolled) schema; export it for the admin form. Reject missing day keys, mismatched `closed`/`slots`, invalid time format, and identical `open === close`.

## 2. Database migration (`apps/api/migrations`)

- [x] 2.1 Add migration `0004_clubs_typed_hours_and_filters.up.sql`:
  - `CREATE TYPE club_type AS ENUM ('cash', 'club', 'mtt-series', 'mafia-and-poker', 'underground');` wrapped in the same `DO $$ ... duplicate_object ...` idiom as 0001.
  - `ALTER TABLE clubs ADD COLUMN club_type club_type NOT NULL DEFAULT 'cash';`
  - `ALTER TABLE clubs ADD COLUMN social_links jsonb NOT NULL DEFAULT '{}'::jsonb;`
  - `ALTER TABLE clubs ADD COLUMN entry_fee_cents bigint;`
  - `ALTER TABLE clubs ADD CONSTRAINT clubs_entry_fee_nonneg CHECK (entry_fee_cents IS NULL OR entry_fee_cents >= 0);`
  - `ALTER TABLE clubs ADD CONSTRAINT clubs_working_hours_object CHECK (jsonb_typeof(working_hours) = 'object');`
  - Add index `CREATE INDEX IF NOT EXISTS clubs_status_type_idx ON clubs (status, club_type);` to support filtered listing.
- [x] 2.2 Add matching `0004_clubs_typed_hours_and_filters.down.sql` that drops the index, the constraints, the columns, and the enum.
- [ ] 2.3 Run `make migrate-up` locally against the dev DB and verify the schema with `\d+ clubs`.

## 3. sqlc queries and Go types (`apps/api/internal/db`, `internal/clubs`)

- [x] 3.1 Add a `WorkingHours` Go struct (with `MarshalJSON` / `UnmarshalJSON` enforcing the schema and the no-zero-length-slot invariant) in `internal/clubs/working_hours.go`; export `(WorkingHours).IsOpenNow(now time.Time, loc *time.Location) bool` ported from the TS reference.
- [x] 3.2 Add a `ClubType` Go alias + validator function; add a `SocialLinks` struct with optional `VK`, `Instagram`, `YouTube`, `TelegramChannel`. Both round-trip through `jsonb` columns via `pgx`.
- [x] 3.3 Update `internal/clubs/dto.go`: replace `WorkingHours json.RawMessage` with the typed struct, add `ClubType string`, `SocialLinks SocialLinks`, `EntryFeeCents *int64`; mirror in `CreateRequest` and `UpdateRequest` with validator tags `clubtype`, `workinghours`.
- [x] 3.4 Register the `workinghours` and `clubtype` validators in `internal/validate`; add Go unit tests covering the same fixture file as the TS port (read JSON, assert errors / acceptance).
- [x] 3.5 Add sqlc query `ListPublishedClubsFiltered` to `internal/db/queries.sql` accepting `bbox`, `games`, `types`, `min_buy_in`, `max_buy_in` and producing the same ordered/paginated result as the existing `ListPublishedClubs`. Use `(games && @games::text[])` for the games filter and `club_type = ANY(@types::club_type[])` for type filter.
- [ ] 3.6 Regenerate sqlc code (`make sqlc-generate` or equivalent); commit generated files. *(NOTE: this repo's `internal/db/db.go` is hand-rolled per its file header; sql changes were mirrored manually in `db.go` rather than running sqlc.)*
- [x] 3.7 Update `handler.list` to read `games`, `types`, `minBuyIn`, `maxBuyIn` query params, validate them, dispatch to `ListPublishedClubsFiltered` when any are set, and reject `openNow` as `400 invalid_filter`.
- [x] 3.8 Update `handler.create`/`handler.update` to deserialize/validate the new fields and persist them; ensure cache invalidation already covers the listed key namespace (`clubs:*`).
- [ ] 3.9 Add table-driven Go tests for the filter handler covering: each filter alone, combined filters, invalid game value rejected, invalid type rejected, buy-in range overlap (one bound NULL, both NULL).

## 4. Seed real Saint Petersburg clubs (`apps/api/internal/seed`)

- [x] 4.1 Build a curated list of real SPB clubs in `internal/seed/seed_spb.go` (new file) with one Go struct literal per club. For each: name, slug (kebab-case), full address, lat/lng (use the actual address on Yandex.Maps to copy coordinates), phones (digits only entries the API accepts), website, primary `telegram_url`, `social_links` map, `games`, `min_buy_in_cents`, `max_buy_in_cents`, `entry_fee_cents`, `rake_description`, `club_type`, `working_hours`. Each entry MUST be preceded by a comment of the form `// source: <URL>, checked: 2026-05-24`.
- [x] 4.2 Initial set (start with these, expand as research confirms — leave a TODO comment for any missing field rather than guess): `bluff` (Фурштатская ул., 44), `pulse` (Бугский пер., 3, ТОЦ «Андреевский двор»), `elo-club` (Каменноостровский пр., 10 лит. Б), `saint-pokersburg` (Невский пр., в Mysterium lounge), `obriens` (O'Briens, Невский пр.), `cromulent-club` (Владимирский пр., 15), `joker-club-spb`, `pokeroff`, `royal-club`. For each verify hours and phones against the source URL.
- [x] 4.3 In `internal/seed/seed.go`, define `var legacyDemoSlugs = []string{"royal-poker-club","neva-cardroom","petrogradka-poker","moskovsky-poker","vasilevsky-card","kupchino-poker"}` and execute `DELETE FROM clubs WHERE slug = ANY($1)` before inserting the new catalog. Wrap delete+insert in a single transaction.
- [x] 4.4 Replace `var demoClubs = []db.CreateClubParams{...}` reference with the new `spbClubs` slice from 4.1; remove the old `everyDay` helper if it has no remaining callers.
- [ ] 4.5 Run `SEED_ON_BOOT=1 go run ./cmd/api` against a fresh dev DB; verify with `psql` that every published row carries non-empty contact info and that `description` is no longer the demo placeholder.

## 5. Admin: `WorkingHoursEditor` and form refactor (`apps/admin`)

- [x] 5.1 Create `apps/admin/src/app/(authed)/clubs/_form/WorkingHoursEditor.tsx` as a controlled component: state `WorkingHours`, props `value`, `onChange`, `error`. Render seven rows in Mon→Sun order; each row has a label, an open/closed `Switch`, a list of slot `<input type="time">` pairs, "Добавить слот" button, and a `DropdownMenu` with "Скопировать в Пн–Пт" / "Скопировать на все дни" / "Закрыть весь день".
- [x] 5.2 In `ClubForm.tsx`: remove the `<Textarea name="workingHours">`, add `const [hours, setHours] = useState<WorkingHours>(parseWorkingHours(initial?.workingHours) ?? defaultWorkingHours());`, render `<WorkingHoursEditor value={hours} onChange={setHours} error={fieldErr("workingHours")} />`, and submit through a `<input type="hidden" name="workingHours" value={JSON.stringify(hours)} />`.
- [x] 5.3 Update `apps/admin/src/app/actions.ts` (and any other place that builds the form payload) to parse the hidden field with `parseWorkingHours` from `@pokermap/types` and to surface field-level errors back into `ActionState.fields.workingHours`.
- [x] 5.4 Create `apps/admin/src/app/(authed)/clubs/_form/SocialsEditor.tsx` with four labeled inputs (VK, Instagram, YouTube, Telegram channel). Empty inputs serialize to absent keys in the submitted JSON.
- [x] 5.5 Add `clubType` `<select>` and `entryFeeCents` `<input type="number" min="0">` to `ClubForm.tsx`; reuse the existing `Row` helper.
- [x] 5.6 Refactor `ClubForm.tsx` layout into seven `<Card>` sections per spec ("Основное", "Локация", "Контакты", "Игра", "Расписание", "Описание", "Фотографии"). Make sure section headings are real `<h2>`/`<h3>` for screen readers.
- [x] 5.7 If `@pokermap/ui` lacks `Switch`, add the shadcn `Switch` primitive following the same pattern used for other primitives in that package.
- [ ] 5.8 Add a Vitest component test for `WorkingHoursEditor` round-trip: render with a known `WorkingHours`, simulate toggling closed, adding a slot, and "Скопировать в Пн–Пт"; assert resulting JSON.

## 6. Public web: `/clubs/[slug]` detail page (`apps/web`)

- [x] 6.1 Add server component `apps/web/src/app/clubs/[slug]/page.tsx` that fetches `/v1/clubs/{slug}` via the existing server-side API client; `notFound()` on 404. Set `export const revalidate = 60`.
- [x] 6.2 Build the page using `Card` sections: header with name + badges (status, club type), address row with `OpenInMapsButton` (see §8), contacts (phones as `tel:`, primary telegram link, socials icon row), working-hours table with today's row highlighted (`aria-current="date"` and a "Сегодня" `Badge`), games chip list, buy-in + entry fee + rake, description, photo grid.
- [x] 6.3 Add `app/clubs/[slug]/not-found.tsx` with a friendly "Клуб не найден" card and a link back to `/`.
- [x] 6.4 Add metadata: `generateMetadata` produces `title = "<name> — PokerMap"` and an OG description = club address. Cache headers come from the API.
- [ ] 6.5 Playwright spec `apps/web/e2e/club-detail.spec.ts`: visit `/clubs/bluff` (assuming seeded), assert the h1 text equals the club name, at least one `tel:` link is rendered, and the day matching today carries the "Сегодня" badge.

## 7. List + sheet: link out to detail (`apps/web`)

- [x] 7.1 In `ListClient.tsx` wrap each card in `<Link href={`/clubs/${c.slug}`} prefetch={false}>`. Remove default `<button>` semantics from the inner content and ensure the link has a visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring`).
- [x] 7.2 In `ClubSheet.tsx` add a primary "Подробнее" button linking to `/clubs/<slug>` (use `next/link` with `prefetch={false}`); keep the existing "Открыть в картах" action separate.
- [ ] 7.3 Playwright spec: from `/list`, click the first card and assert URL pathname starts with `/clubs/`.

## 8. "Открыть в картах" deep-link component (`apps/web`)

- [x] 8.1 Create `apps/web/src/components/OpenInMapsButton.tsx` (client component) accepting `lat`, `lng`, `name`, `address`. Render a primary `Button` plus a `DropdownMenu` with "Яндекс.Карты", "2ГИС", "Google Maps". Compute the platform-specific URL on click, not on render, to avoid SSR mismatch.
- [x] 8.2 Implement platform detection: Telegram WebApp (`typeof window !== "undefined" && window.Telegram?.WebApp?.openLink`) → call `openLink(yandexWebUrl)`; iOS UA → `maps://?daddr=lat,lng&q=<addr>`; Android UA → `geo:lat,lng?q=lat,lng(<name>)`; else open `https://yandex.ru/maps/?pt=lng,lat&z=17` in a new tab.
- [x] 8.3 Use it in three places: `app/clubs/[slug]/page.tsx`, `components/map/ClubSheet.tsx`, and `app/list/ListClient.tsx` (as a small secondary action on each card, not on the card-wide `<Link>` — render it as a sibling button to avoid nesting interactive elements).
- [x] 8.4 Vitest unit test for the URL builder: assert each platform branch produces the exact expected URL given `(lat=59.9, lng=30.3, name="Bluff", address="Фурштатская 44")`; assert URL components are properly `encodeURIComponent`-d.

## 9. Map filters (`apps/web`)

- [x] 9.1 Create `apps/web/src/hooks/useClubFilters.ts` that reads `useSearchParams`, parses `openNow`, `games`, `types`, `minBuyIn`, `maxBuyIn` into a typed `Filters` object, exposes setters that build a new `URLSearchParams` and call `router.replace(`${pathname}?${qs}`, { scroll: false })`, and returns `(clubs: Club[]) => Club[]` predicate. `openNow` evaluated client-side using `isOpenNow`.
- [x] 9.2 Create `apps/web/src/components/map/MapFilters.tsx`: floating pill (bottom-left on `<md`, top-left on `md+`) with active count badge; clicking opens a `Sheet` with "Открыто сейчас" `Switch`, game chip group, type chip group, dual-handle `Slider` for buy-in, and "Сбросить" / "Готово" footer buttons.
- [x] 9.3 Wire `MapFilters` and `useClubFilters` into `MapShell.tsx` (or `MapStage.tsx`): apply `predicate(clubs)` before passing to `MapView`, and surface the same predicate to `ListClient` by passing it server→client (the list page can use the same hook directly since both are client components).
- [x] 9.4 Update server fetch in `apps/web/src/app/page.tsx` and `apps/web/src/app/list/page.tsx`: when query params include `games`/`types`/`minBuyIn`/`maxBuyIn`, forward them to `/v1/clubs?...` so the initial paint already reflects them; `openNow` is intentionally not forwarded (client-only).
- [x] 9.5 If `@pokermap/ui` lacks `Switch`/`Slider`, add the shadcn primitives.
- [ ] 9.6 Vitest test for `useClubFilters` (using `next/navigation` mocks): assert URL parse, URL write, predicate behavior for each filter, and that "Сбросить" yields a URL with no filter params.
- [ ] 9.7 Playwright spec `map-filters.spec.ts`: open `/`, count markers, toggle "Открыто сейчас", assert the count is `<=` initial; reload with `?openNow=1`, assert pill renders the toggle as on.

## 10. Wiring and verification

- [x] 10.1 Run `pnpm -w lint`, `pnpm -w typecheck`, `pnpm -w test`; fix any breaks.
- [x] 10.2 Run `make -C apps/api lint test` (Go); fix any breaks.
- [ ] 10.3 Run `docker compose up` and verify end-to-end: open admin → edit a seeded club's hours via the new editor → save → confirm public detail page reflects the change → toggle filter on the map → verify markers reduce.
- [x] 10.4 Update `README.md` (top-level) with a one-line note that the catalog data lives in `apps/api/internal/seed/seed_spb.go` and that filter URL params are documented on the public map view.
- [x] 10.5 Run `openspec validate clubs-data-and-map-filters --strict` and ensure it passes before archiving.
