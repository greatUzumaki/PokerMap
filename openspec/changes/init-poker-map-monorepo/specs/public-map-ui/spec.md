## ADDED Requirements

### Requirement: Map page
The web app SHALL render an interactive map at `/` that fills the viewport, defaults to the Saint Petersburg bounding box (roughly `[30.2, 59.85, 30.5, 60.05]`), and uses MapLibre GL JS via `react-map-gl/maplibre`. The tile source URL SHALL come from `NEXT_PUBLIC_MAP_TILE_URL`.

#### Scenario: Initial render shows SPb
- **WHEN** a user opens `/` for the first time
- **THEN** the map renders centered on Saint Petersburg with a zoom level showing the whole city

#### Scenario: Mobile gestures
- **WHEN** a user pans, pinch-zooms, or rotates on a touch device
- **THEN** the map responds smoothly at 60fps with no scroll-lock fighting between the map and the page

### Requirement: Club markers and clustering
The map SHALL render one marker per published club as a styled poker-chip icon. When markers overlap at low zoom levels the map SHALL cluster them using MapLibre's GeoJSON clustering and show a count badge per cluster. Tapping a cluster SHALL zoom in to break it apart.

#### Scenario: Markers visible
- **WHEN** the public club list endpoint returns clubs and the map is loaded
- **THEN** each club appears at its `lat`/`lng` as a poker-chip marker

#### Scenario: Cluster tap zooms in
- **WHEN** a user taps a cluster of 5 clubs
- **THEN** the map smoothly zooms to a level that splits the cluster

### Requirement: Club detail sheet
Tapping a marker SHALL open a bottom-sheet (mobile) or right-side drawer (desktop, ≥`md` breakpoint) showing the club's photos (carousel), name, address, working hours for the current weekday highlighted, games, buy-in range, rake description, contact links (phone, website, telegram), and a "Build route" button that opens the user's default map app via a geo URI.

#### Scenario: Open detail
- **WHEN** a user taps a club marker
- **THEN** the detail sheet animates in showing all public fields and a hero photo if any are uploaded

#### Scenario: Close detail
- **WHEN** the user swipes the sheet down or taps the backdrop
- **THEN** the sheet closes and focus returns to the map

#### Scenario: Build route handoff
- **WHEN** the user taps "Build route" inside Telegram Mini App
- **THEN** Telegram's `openLink` is invoked with a `geo:` or `https://maps.google.com/?q=lat,lng` URL appropriate to the platform

### Requirement: Bottom navigation menu
The web app SHALL render a mobile-first bottom navigation with at least three tabs: `Map`, `List`, `About`. The active tab SHALL be visually distinct. On viewports ≥`md` the navigation SHALL move to the top.

#### Scenario: Switch to list view
- **WHEN** the user taps the `List` tab
- **THEN** the app navigates to `/list` which renders the same clubs in a scrollable, searchable list

### Requirement: List view
The `/list` route SHALL render published clubs as a searchable, sortable list with a client-side text filter on `name` and `address`. Tapping a row SHALL navigate to the detail sheet over the map.

#### Scenario: Filter by text
- **WHEN** the user types "royal" into the search input on `/list`
- **THEN** the list narrows in <100ms to clubs whose name or address contain "royal" (case-insensitive)

### Requirement: Performance budget
The public map page SHALL meet Core Web Vitals targets on a mid-range mobile device on a 4G profile: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1. The MapLibre bundle SHALL be code-split and loaded inside a Suspense boundary so the first paint is independent of the map.

#### Scenario: Lighthouse passes
- **WHEN** a Lighthouse mobile audit runs on a production build of `/`
- **THEN** all three Core Web Vitals fall within the targets

### Requirement: Accessibility
All interactive controls on the map UI SHALL be keyboard-reachable with a visible focus ring. The detail sheet SHALL trap focus while open and restore focus to the originating marker on close. All images SHALL have descriptive `alt` text or empty alt for decorative.

#### Scenario: Keyboard navigation
- **WHEN** a user opens the page with no mouse
- **THEN** they can move focus across the bottom nav, into the map controls, and into an open detail sheet using only Tab/Shift+Tab/Enter/Escape
