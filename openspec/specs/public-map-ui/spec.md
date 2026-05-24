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
