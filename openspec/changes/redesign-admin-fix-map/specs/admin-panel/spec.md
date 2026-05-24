## ADDED Requirements

### Requirement: Dark theme by default

The admin panel SHALL render in dark theme on first paint, without depending on the operating-system `prefers-color-scheme` setting or a user toggle. The `<html>` element MUST carry the `dark` class on initial server render so there is no theme flash.

#### Scenario: First visit in a light-mode OS

- **WHEN** an authenticated admin loads any admin route on a device whose OS prefers light mode
- **THEN** the rendered page uses the dark CSS variable values (`--background` ≈ HSL 222 84% 4.9%, `--foreground` ≈ HSL 210 40% 98%)
- **AND** no light → dark flash is visible during hydration

#### Scenario: Tokens come from shared package

- **WHEN** a contributor inspects the computed CSS for `body { background: var(--background) }` in the admin app
- **THEN** the variable resolves to a value defined in `@pokermap/ui/globals.css`, not a duplicate definition inside `apps/admin/src/app/globals.css`

### Requirement: Persistent dashboard shell with sidebar

The admin panel SHALL render every authenticated route inside a dashboard shell composed of a left sidebar, a top header, and a main content pane. The sidebar MUST be persistent across navigations (no remount) and its open/collapsed state MUST be preserved across reloads.

#### Scenario: Sidebar is visible on every authed route

- **WHEN** an authenticated admin navigates from `/` to `/clubs` to any other authed route
- **THEN** the sidebar component instance is preserved (does not unmount between navigations)
- **AND** the active section indicator updates to match the current route

#### Scenario: Sidebar state persists across reloads

- **WHEN** an admin collapses the sidebar and reloads the page
- **THEN** the sidebar renders collapsed on the new page load

#### Scenario: Sidebar exposes core sections

- **WHEN** the sidebar is rendered
- **THEN** it shows clickable navigation entries for: Dashboard (`/`), Клубы (`/clubs`), Медиа (`/media`), Аудит (`/audit`), Настройки (`/settings`)
- **AND** each entry has an icon and a label
- **AND** each entry has a visible focus ring when reached via keyboard

### Requirement: Dashboard landing page

The route `/` for an authenticated admin SHALL render an overview dashboard, not a redirect to a sub-section.

#### Scenario: Dashboard shows club totals

- **WHEN** an admin loads `/`
- **THEN** the page renders KPI cards for total clubs, drafts, published, and archived counts
- **AND** the counts reflect the current database state (no stale cache older than the request)

#### Scenario: Dashboard shows recent activity

- **WHEN** an admin loads `/`
- **THEN** the page renders a list of the 5 most-recently-updated clubs with name, status badge, and updated-at timestamp
- **AND** each row links to that club's edit route

#### Scenario: Dashboard offers a primary action

- **WHEN** an admin loads `/`
- **THEN** a visually prominent "Добавить клуб" button links to `/clubs/new`

### Requirement: shadcn primitives shared via `@pokermap/ui`

UI primitives used by the admin shell — `Sidebar`, `Table`, `Tabs`, `DropdownMenu`, `Breadcrumb`, `Separator`, `Tooltip`, `Sheet`, `Skeleton`, `Card`, `Button`, `Badge`, `Input`, `Label`, `Textarea` — SHALL be exported from `@pokermap/ui`. The admin app MUST NOT define inline copies of these primitives under `apps/admin/src/components/ui`.

#### Scenario: No inline duplicates

- **WHEN** a contributor greps `apps/admin/src` for inline shadcn component definitions
- **THEN** no `components/ui/<primitive>.tsx` files exist that duplicate exports from `@pokermap/ui`

#### Scenario: Imports resolve from shared package

- **WHEN** any admin page imports a shadcn primitive
- **THEN** the import path begins with `@pokermap/ui/` (e.g. `@pokermap/ui/sidebar`)

### Requirement: Placeholder pages for non-implemented sections

Sidebar entries that do not yet have full functionality (Медиа, Аудит, Настройки) SHALL still resolve to a real route that renders an "В разработке" placeholder using the same shell.

#### Scenario: Placeholder renders inside the shell

- **WHEN** an admin clicks a sidebar entry for a not-yet-built section
- **THEN** the route loads inside the same sidebar shell and shows a `Card` with the heading "В разработке" and a short description
- **AND** no 404 is shown

### Requirement: Header carries breadcrumbs and user controls

The dashboard header above the main pane SHALL render breadcrumbs for the current location and a user menu with the admin's identity and a logout action.

#### Scenario: Breadcrumb reflects current path

- **WHEN** an admin is on `/clubs/<id>`
- **THEN** the header breadcrumb reads "Клубы › <club name>" and the first segment is a link back to `/clubs`

#### Scenario: User menu exposes logout

- **WHEN** an admin opens the user menu in the header
- **THEN** a menu item triggers the existing logout flow and ends the session
