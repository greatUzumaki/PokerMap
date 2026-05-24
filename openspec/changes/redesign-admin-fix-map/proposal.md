## Why

Admin panel currently is a flat, light-mode top-bar layout with a single Clubs table — feels prototype-grade and gives no overview, no navigation surface, no room for future sections (media, users, audit). The public web app renders a blank viewport instead of the map: the page goes "пустота" instead of showing tiles. Both undermine perceived quality and block real use of the product.

## What Changes

- **Admin app**: switch to dark theme by default (force `dark` class on `<html>`), introduce a persistent shadcn-style left sidebar with sections (Dashboard, Клубы, Медиа, Аудит, Настройки), wrap content in a classic dashboard shell (sidebar + top header with breadcrumbs + main pane).
- **Admin app**: add a Dashboard landing page with overview cards (total clubs, by status, recent updates) replacing the current redirect-to-clubs flow.
- **Admin app**: replace ad-hoc table markup with shadcn `Table`, `Card`, `Sidebar`, `Breadcrumb`, `DropdownMenu`, `Tabs`, `Sheet`, `Tooltip`, `Separator` primitives (added to `@pokermap/ui`).
- **Public web app**: diagnose and fix the blank map. Confirmed candidates: container collapses to 0 height (parent flex chain breaks `h-app`), dynamic import gate hides the map indefinitely if Telegram init throws, or CSS `maplibre-gl.css` not applied to the dynamically loaded module — implementation MUST land a measured root cause and a regression test that fails on blank-map state.
- **Public web app**: polish bottom/top nav and tab visuals — active-state pill, icon weight, safe-area handling, consistent shadcn styling — and tighten typography in `/list` and `/about` to match the redesigned admin look.
- **Shared UI**: extend `@pokermap/ui` exports with the new shadcn primitives needed by both apps (`sidebar`, `table`, `tabs`, `dropdown-menu`, `breadcrumb`, `separator`, `tooltip`, `sheet`, `skeleton`).

## Capabilities

### New Capabilities

_None — all changes refine existing capabilities._

### Modified Capabilities

- `admin-panel`: new dashboard shell (sidebar + header + main), dark-by-default theme, shadcn-based section layout, dashboard overview, navigable sections (Dashboard, Clubs, Media, Audit, Settings stubs where logic does not yet exist).
- `public-map-ui`: map MUST render tiles on first paint outside Telegram (regression: today it shows blank). Navigation tabs MUST use the shared shadcn visual language.

## Impact

- **Code**: `apps/admin/src/app/(authed)/*`, `apps/admin/src/app/globals.css`, `apps/admin/src/components/*`, `apps/web/src/app/page.tsx`, `apps/web/src/components/map/*`, `apps/web/src/components/nav/BottomNav.tsx`, `apps/web/src/app/layout.tsx`, `packages/ui/src/components/*`, `packages/ui/package.json` exports.
- **Dependencies**: add `@radix-ui/react-dropdown-menu`, `@radix-ui/react-separator`, `@radix-ui/react-tooltip`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs` to `@pokermap/ui`; expose `cmdk` only if command palette is built (optional, not required for this change).
- **API**: no backend changes. Existing `listAdminClubs` is reused; new dashboard counts may need a small server-side aggregation, implemented as a thin `getAdminOverview` server fn that calls the existing list endpoint with `status` filters until a dedicated endpoint is added.
- **Tests**: add a Playwright e2e check that `/` renders a `canvas[data-test=map]` with non-zero size; add a vitest snapshot of the admin layout shell.
- **No breaking spec changes** — admin and web URLs stay the same.
