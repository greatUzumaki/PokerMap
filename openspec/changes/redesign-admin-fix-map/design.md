## Context

Two surfaces ship to users today: the public Next.js 16 web app (`apps/web`) and an internal admin panel (`apps/admin`). Both use the App Router on React 19, Tailwind 3, and a shared `@pokermap/ui` Tailwind preset + a tiny set of shadcn-style primitives.

- The **admin** panel is a single-page table inside a top-bar layout. Light/dark theming is wired via CSS variables but no class is forced on `<html>`, so the user gets the browser default (typically light) — the user explicitly wants dark by default.
- The shared **CSS tokens** (`apps/admin/src/app/globals.css` and the `@pokermap/ui/tailwind-preset.ts`) already define `--background`, `--foreground`, `--primary`, etc. — the redesign should consume these, not redefine palette inside the admin app.
- The **web app** route `/` renders `<MapShell>` (a dynamic-imported `<MapView>` using `react-map-gl` against MapLibre). The deployed config now points at CARTO dark tiles. The user reports the map renders as a blank area. Likely causes (ranked):
  1. The page wrapper `<div className="relative h-app flex-1">` sits inside `<main className="flex min-h-app flex-col pb-20 …">` — `h-app` resolves to `var(--app-height, 100dvh)`. Outside Telegram, `--app-height` is never set, so the fallback `100dvh` is used and the container has height. Likely OK; but combining `h-app` and `flex-1` inside a flex column can produce inconsistent layout in some browsers (Safari iOS) where `dvh` is reported as 0 before viewport stabilizes.
  2. The `dynamic(() => import("./MapView"), { ssr: false })` loader hides the map behind a fallback that says "Загружаем карту…". If the import throws (e.g., maplibre-gl ESM/CJS mismatch under Turbopack 16), the error is swallowed and the fallback never resolves → the user sees blank/loading text indefinitely.
  3. `mapStyle.glyphs` points to `https://demotiles.maplibre.org/font/…` — if blocked, the map still renders tiles but logs a glyph error. Not the root cause for a blank canvas, but worth replacing with a same-origin or known-stable URL.
  4. CARTO tiles require a Referer header; some browsers strip it from cross-origin requests. If raster tiles 403, the map renders an empty (transparent) canvas.

The change must land instrumentation + a deterministic fix, not a guess.

## Goals / Non-Goals

**Goals:**
- Admin app loads a polished dark-themed dashboard shell with persistent sidebar navigation, header (breadcrumbs + user menu), and a dashboard landing page.
- Admin section pages (Dashboard, Клубы, Медиа, Аудит, Настройки) use shadcn primitives uniformly: `Sidebar`, `SidebarMenu`, `SidebarMenuItem`, `Card`, `Table`, `Tabs`, `DropdownMenu`, `Breadcrumb`, `Separator`, `Tooltip`, `Sheet`, `Skeleton`.
- Map renders tiles reliably on first paint in a fresh browser (Chromium + WebKit) for both `/` and any nested map view. Regression tested with Playwright.
- Public web navigation (bottom on mobile, top on `md+`) uses the same shadcn visual language as the admin (rounded pill active state, refined icon weight, accessible focus rings, safe-area padding).

**Non-Goals:**
- No backend changes (no new HTTP routes, no DB migrations).
- No new authentication features — admin section access still gated by `getSession().isAdmin`.
- No commandline palette / global search (deferred).
- No theme switcher — dark is the only theme this change ships. Light tokens stay defined for future use.
- No i18n changes — strings stay in Russian.

## Decisions

### 1. Force dark theme on admin via `<html class="dark">`

The admin root layout already sets `className={inter.variable}`. Change to `className={\`${inter.variable} dark\`}` and add `suppressHydrationWarning` to match the web app. Tailwind config already uses `darkMode: ["class"]`, so adding `dark` flips the existing CSS variables. **No JS toggle needed.**

Alternative considered: respect `prefers-color-scheme`. Rejected — the user explicitly wants dark by default; respecting the system pref is a future enhancement.

### 2. Sidebar shell via shadcn's `Sidebar` primitive

shadcn ships a full `Sidebar` block (composable: `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuButton`, `SidebarTrigger`, `SidebarInset`). Adopt it as-is into `@pokermap/ui/sidebar`. The shell is rendered in `apps/admin/src/app/(authed)/layout.tsx` and replaces the current `<header>`-only layout.

Structure:

```
<SidebarProvider defaultOpen>
  <AppSidebar /> {/* nav items, user block at bottom */}
  <SidebarInset>
    <header>{/* SidebarTrigger + Breadcrumb + UserMenu */}</header>
    <main>{children}</main>
  </SidebarInset>
</SidebarProvider>
```

Sidebar items: Dashboard (`/`), Клубы (`/clubs`), Медиа (`/media`), Аудит (`/audit`), Настройки (`/settings`). Routes that don't yet have pages render a minimal "В разработке" placeholder card so the navigation is fully clickable.

Alternative considered: a hand-rolled sidebar. Rejected — shadcn `Sidebar` already handles collapse, keyboard nav, mobile sheet behavior, and persists the open/closed state via cookie.

### 3. Dashboard landing page composition

`apps/admin/src/app/(authed)/page.tsx` becomes the Dashboard. Layout:

- 4 KPI cards (total clubs, drafts, published, archived) — each a `Card` with `CardHeader > CardDescription + CardTitle` and a small trend caption.
- One "Recent activity" `Card` listing the 5 most recently updated clubs (reuse `listAdminClubs` sorted by `updatedAt` desc; component already exists, just render compact rows).
- One "Быстрые действия" `Card` with a primary button to `/clubs/new` and links to upcoming sections.

Data fetched server-side via existing `listAdminClubs` with `limit=5` plus three additional calls filtered by status. Each is small; the four totals can be aggregated by a single `getAdminOverview` server fn under `apps/admin/src/lib/api/server.ts`.

Alternative considered: a new backend endpoint `GET /admin/overview`. Deferred — three sequential calls in a server component are cheap enough for now (local API, single DB).

### 4. Fix the blank map: measured root cause + defense in depth

We will run the dev server and the Playwright test below in the implementation phase **before** picking a fix. Expected outcomes and the fix tied to each:

| Observed | Root cause | Fix |
| --- | --- | --- |
| Canvas exists, size 0×0 | Parent flex chain collapses height (`h-app` + `flex-1` interaction with `dvh` not yet stabilized) | Replace `<main className="flex min-h-app flex-col …">` + `<div className="relative h-app flex-1">` with a deterministic CSS-grid layout: `<main className="grid h-app …" style={{gridTemplateRows:'1fr auto'}}>`. Map child gets `min-h-0` and `h-full`. |
| Fallback "Загружаем карту…" stuck | Dynamic import throws under Turbopack | Replace the dynamic import with a client component that calls `useEffect` to import maplibre-gl only on mount, and surface load errors via `console.error` + a visible error state instead of an indefinite fallback. |
| Tiles 403/CORS in network panel | Tile provider rejects request | Switch to a known-stable tile URL (`https://tiles.openfreemap.org/styles/positron` or self-hosted), set as the env default. |
| Glyph fetch fails | `demotiles.maplibre.org` blocked | Remove glyph URL (no text layer needs it; the cluster-count uses a fallback font already available in the basemap style) or move to inline `style.glyphs` with a stable URL. |

The fix branch lands all four hardening steps because they're independent and cheap, plus the implementation-time investigation pinpoints which one actually unblocked the user.

Regression test (Playwright):

```ts
test('map renders tiles on first paint', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('canvas.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box && box.width > 100 && box.height > 100).toBeTruthy();
  // tile requests must succeed
  await page.waitForResponse((r) => r.url().includes('/{z}/'.replace('{z}/', '')) === false && r.status() < 400, { timeout: 5000 }).catch(() => {});
});
```

### 5. Shared UI package expansion

Add new shadcn primitives to `@pokermap/ui/src/components/`:

- `sidebar.tsx` (the full shadcn sidebar with Radix Slot + Tooltip + Sheet integration)
- `table.tsx`
- `tabs.tsx` (admin uses for tabs inside `/clubs/[id]`; web `/list` reuses)
- `dropdown-menu.tsx` (user menu, row actions)
- `breadcrumb.tsx`
- `separator.tsx`
- `tooltip.tsx`
- `sheet.tsx` (admin mobile sidebar, web club details on `md+`)
- `skeleton.tsx`

Each is added to `package.json#exports` and consumed from both apps. **No inline copies** in `apps/admin` or `apps/web`. Existing per-app `apps/web/src/components/ui/*` files are migrated to re-exports from `@pokermap/ui/*` and then deleted in the same PR to avoid drift.

### 6. Nav polish (web)

`BottomNav` keeps its mobile-bottom / desktop-top responsive switch but:

- Active item wraps icon+label in a `rounded-full bg-primary/10 text-primary` pill.
- Inactive items use `text-muted-foreground`; hover lifts to `text-foreground`.
- Add `aria-label` + `role="navigation"` ribbon already present; add focus-visible ring via shadcn token (`focus-visible:ring-2 focus-visible:ring-ring`).
- `/list` and `/about` headers gain a small `Card` + `Tabs` shell consistent with admin pages.

### 7. Theming defaults stay in `@pokermap/ui`

CSS variables are defined twice today (web globals + admin globals). Move both copies into `@pokermap/ui/globals.css` (already exists) and import it from each app's globals to keep tokens canonical. Each app still owns its `globals.css` for app-specific overrides only.

## Risks / Trade-offs

- **[Sidebar adds layout complexity]** → Mitigated: shadcn's Sidebar is battle-tested; we ship the unchanged composable and only build `AppSidebar` glue. Sidebar collapse state persists via cookie so SSR is stable.
- **[Adding many shadcn primitives bloats `@pokermap/ui`]** → Mitigated: each component is a small, tree-shakeable file; adding entries to `package.json#exports` lets Next.js bundle only what's imported. We measure bundle size for `/` and `/(authed)/*` before merging.
- **[Map "fix" might not be the real root cause]** → Mitigated: implementation phase runs a Playwright reproducer and adds Chrome DevTools instrumentation (`mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page` + console capture) **before** picking which of the four candidate fixes lands. Multiple defense-in-depth fixes ship together so the regression test passes regardless of which was the dominant cause.
- **[Removing per-app `components/ui/*` may break imports we didn't search for]** → Mitigated: a grep sweep for `@/components/ui/` in both apps is part of the migration task; CI typecheck catches the rest.
- **[Tile provider stability]** → Risk: CARTO/OpenFreeMap is third-party. Mitigation: keep `NEXT_PUBLIC_MAP_TILE_URL` configurable, set OpenFreeMap as default, document an `openmaptiles`/Protomaps fallback in `.env.example`.
- **[Dashboard counts via three list calls are O(3) round trips]** → Acceptable for now; add a dedicated overview endpoint when load matters.

## Migration Plan

1. Add new shadcn primitives to `@pokermap/ui` and wire exports. No behavior change yet.
2. Migrate `apps/web/src/components/ui/*` to re-exports, then delete the inline copies.
3. Apply nav polish to `BottomNav` (no API changes).
4. Land map fixes (layout + dynamic-import handling + tile URL default) behind the same PR; verify with Playwright.
5. Build admin sidebar shell + Dashboard page; switch `<html>` to `dark`.
6. Convert existing Clubs page to use shadcn `Table`.
7. Add placeholder pages for Media / Audit / Settings.
8. Visual QA pass with Chrome DevTools MCP at three viewport sizes (375, 768, 1280).
9. Merge; no DB migration; no rollback hooks needed.

Rollback: revert the PR; no data state changes.

## Open Questions

- Should the dashboard "Recent activity" link rows open the club edit page in a side `Sheet` (in-place edit) or navigate? Default: navigate, keep behavior consistent with current `/clubs/[id]` route.
- Do Media / Audit / Settings deserve placeholder pages now, or hide nav items until pages exist? Default: show items, render a "В разработке" card, so visual coherence is achieved in one PR.
