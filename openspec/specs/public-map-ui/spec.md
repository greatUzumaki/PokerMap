# public-map-ui

## Purpose

Public-facing web app surface: interactive map of published poker clubs in Saint Petersburg with a side list view and about page. Works both as a standalone web app and inside Telegram Mini App. Dark-themed, mobile-first, persistent map mount with React Query data caching and floating navigation pill.
## Requirements
### Requirement: Map renders tiles on first paint

The public route `/` SHALL render a visible map with non-zero pixel dimensions and at least one successful raster tile response on first paint in a freshly opened browser session, outside of a Telegram Mini App context.

#### Scenario: Map canvas is visible with non-zero size

- **WHEN** a user opens `/` in a desktop browser (Chromium or WebKit) at viewport 1280×800
- **THEN** within 3 seconds the document contains a `canvas.maplibregl-canvas` element whose bounding box has width ≥ 800 px and height ≥ 400 px

#### Scenario: At least one tile request succeeds

- **WHEN** a user opens `/` and waits for network activity to settle
- **THEN** at least one network response from the configured `NEXT_PUBLIC_MAP_TILE_URL` template has HTTP status < 400

#### Scenario: Map renders without an active Telegram context

- **WHEN** the page is loaded in a regular browser (no `window.Telegram.WebApp`)
- **THEN** the loading fallback ("Загружаем карту…") MUST disappear within 3 seconds and be replaced by the rendered map

### Requirement: Map container has deterministic height

The map container in the page chrome SHALL have a deterministic, non-zero height regardless of dynamic-viewport (`dvh`) availability or Telegram viewport reporting timing.

#### Scenario: Height does not collapse before viewport stabilizes

- **WHEN** the page loads and `--app-height` is not yet set
- **THEN** the container that hosts the map computes a non-zero `clientHeight`
- **AND** the map is mounted into that container before `--app-height` is set

#### Scenario: Bottom navigation does not overlap the map

- **WHEN** the page is rendered at viewport 375×812 (mobile)
- **THEN** the bottom of the visible map canvas is above the top edge of the bottom navigation by at least 1 px (no overlap)

### Requirement: Dynamic import errors are surfaced

The dynamic load of the map module SHALL not fail silently. If the import or initialization throws, the user SHALL see an error state with a retry control, not an indefinite loading fallback.

#### Scenario: Import failure shows error state

- **WHEN** the dynamic import of the map module throws on the client
- **THEN** the loading fallback is replaced by a visible error card with text describing that the map failed to load and a "Повторить" button that retries the import
- **AND** the error is also reported to `console.error`

### Requirement: Navigation tabs use shared shadcn visual language

The public app's navigation (bottom nav on mobile, top nav on `md+`) SHALL use the same shadcn primitives, tokens, and visual styling as the admin app's sidebar.

#### Scenario: Active item is visually distinct

- **WHEN** the user is on `/list`
- **THEN** the "Список" navigation item has a filled pill background using the `primary` token and the icon+label use `primary-foreground` or `primary`-colored text
- **AND** inactive items use `muted-foreground` text

#### Scenario: Keyboard focus is visible

- **WHEN** the user tabs to a navigation item with a keyboard
- **THEN** a 2-pixel focus ring using the `ring` token is rendered around the item

### Requirement: Public club detail page exists at `/clubs/[slug]`

The web app SHALL render a server-component route at `/clubs/[slug]` that fetches `GET /v1/clubs/{slug}` and displays the club's name, address, phones (as `tel:` links), website, primary Telegram, structured socials, working hours as a seven-row table with today highlighted, games, buy-in range, entry fee (if set), rake description, photos, and an "Открыть в картах" action. Unknown or non-published slugs SHALL render the Next.js `notFound()` 404.

#### Scenario: Detail page loads for a published slug

- **WHEN** a visitor navigates to `/clubs/bluff` and a published club with that slug exists
- **THEN** the rendered HTML contains the club's `name` inside an `<h1>`, the `address` text, every entry of `phones` as a `<a href="tel:...">`, and a `<table>` with seven rows for the weekdays

#### Scenario: Today's row in the schedule is visually marked

- **WHEN** the detail page renders on a Tuesday
- **THEN** the Tuesday row of the working-hours table carries an `aria-current="date"` attribute and a `Badge` reading "Сегодня"

#### Scenario: Unknown slug returns 404

- **WHEN** a visitor navigates to `/clubs/does-not-exist`
- **THEN** the rendered response is HTTP 404 and the Next.js `not-found` UI is shown

### Requirement: List cards and map markers link to the detail page

The list cards at `/list` and the marker sheet (`ClubSheet`) opened from a map marker SHALL each provide a primary "Подробнее" navigation that links to `/clubs/<slug>`. The list card MUST make its entire surface activatable (click and keyboard).

#### Scenario: List card click navigates to detail

- **WHEN** a user clicks anywhere on a list card at `/list`
- **THEN** the browser navigates to `/clubs/<that-club-slug>`

#### Scenario: Keyboard activation works on list card

- **WHEN** a user tabs to a list card and presses Enter
- **THEN** the browser navigates to `/clubs/<that-club-slug>`

#### Scenario: Marker sheet exposes "Подробнее" link

- **WHEN** a user clicks a map marker and the `ClubSheet` opens
- **THEN** the sheet contains a visible "Подробнее" link or button whose `href` is `/clubs/<slug>`

### Requirement: Map and list share a filter pill with URL-persistent state

The public surface SHALL render a floating filter pill anchored to the map (bottom-left on viewports < 768 px, top-left on larger) that opens a filter panel containing: an "Открыто сейчас" toggle, a multi-select chip group for games (`NLH`, `PLO`, `PLO5`, `MTT`, `SnG`, `Mixed`), a multi-select chip group for club type (`cash`, `club`, `mtt-series`, `mafia-and-poker`, `underground`), and a min/max buy-in slider in rubles. Active filter state MUST be serialized to the URL query string and MUST be the single source of truth, so that the same filter is applied to both `/` (map) and `/list`.

#### Scenario: Toggling "Открыто сейчас" reduces marker count

- **WHEN** the map renders N markers with no filters and the user toggles "Открыто сейчас" at a moment when only M of those clubs satisfy `isOpenNow(hours, now, "Europe/Moscow") === true` with M < N
- **THEN** the rendered marker count becomes exactly M
- **AND** the URL gains `?openNow=1` (existing params preserved)

#### Scenario: URL filter survives reload

- **WHEN** the user reloads `/?openNow=1&games=PLO&types=cash`
- **THEN** the filter pill renders with "Открыто сейчас" on, "PLO" chip active and "cash" chip active
- **AND** the visible markers and list cards reflect those filters

#### Scenario: Filter pill shows active count badge

- **WHEN** any filter is active
- **THEN** the filter pill displays a numeric badge equal to the count of active filter categories (open-now counts as 1, each non-empty multi-select counts as 1, an explicitly set buy-in range counts as 1)

#### Scenario: "Сбросить" clears all filters and the URL

- **WHEN** the user opens the filter panel and clicks "Сбросить"
- **THEN** all toggles, chips and slider return to defaults
- **AND** the URL has no `openNow`, `games`, `types`, `minBuyIn`, `maxBuyIn` params

#### Scenario: Filter state persists when switching between map and list

- **WHEN** the user activates "PLO" on the map view and navigates to `/list`
- **THEN** the list view renders only clubs whose games include `PLO`
- **AND** the filter pill (if present on `/list`) reflects the same active state

### Requirement: "Открыть в картах" deep link is platform-aware

Every UI surface that shows a club address (detail page, list card, marker sheet) SHALL render an "Открыть в картах" primary action. Activation MUST resolve to the user's likely native maps app and MUST also expose an overflow menu with explicit choices "Яндекс.Карты", "2ГИС", "Google Maps".

#### Scenario: iOS deep link uses Apple Maps scheme

- **WHEN** the user activates the button on an iOS device (`navigator.userAgent` matches `/iPad|iPhone|iPod/`) outside of Telegram WebApp
- **THEN** the navigation target is `maps://?daddr=<lat>,<lng>&q=<urlencoded address>`

#### Scenario: Android activation issues a `geo:` intent

- **WHEN** the user activates the button on Android (`navigator.userAgent` matches `/Android/`) outside of Telegram WebApp
- **THEN** the navigation target is `geo:<lat>,<lng>?q=<lat>,<lng>(<urlencoded name>)`

#### Scenario: Desktop activation opens Yandex Maps web

- **WHEN** the user activates the button on a desktop browser
- **THEN** a new tab opens at `https://yandex.ru/maps/?pt=<lng>,<lat>&z=17`

#### Scenario: Telegram WebApp uses `Telegram.WebApp.openLink`

- **WHEN** the user activates the button and `window.Telegram.WebApp.openLink` is a function
- **THEN** the click handler calls `window.Telegram.WebApp.openLink(<web URL>)` and does NOT call `window.open` or set `location.href`
- **AND** no `geo:` or `maps://` URL is used (Telegram's in-app browser cannot resolve them)

#### Scenario: Overflow menu always exposes explicit choices

- **WHEN** the user opens the dropdown next to the primary "Открыть в картах" button on any platform
- **THEN** the menu contains items with labels "Яндекс.Карты", "2ГИС", "Google Maps", each navigating to the corresponding web URL with the club's coordinates

#### Scenario: Detail page button uses the club's own coordinates

- **WHEN** the button is rendered on `/clubs/<slug>` for a club at `lat=59.945, lng=30.345`
- **THEN** the resolved URL embeds those exact coordinates (not the SPB centre fallback)

