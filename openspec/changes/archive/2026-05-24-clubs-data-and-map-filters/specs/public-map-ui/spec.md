## ADDED Requirements

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
