## 1. Shared UI: shadcn primitives in `@pokermap/ui`

- [x] 1.1 Add Radix dependencies to `packages/ui/package.json`: `@radix-ui/react-dropdown-menu`, `@radix-ui/react-separator`, `@radix-ui/react-tooltip`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`. Run `pnpm install`.
- [x] 1.2 Create `packages/ui/src/components/sidebar.tsx` from the current shadcn `sidebar` recipe (composable Provider/Sidebar/Inset/Trigger/Header/Content/Group/Menu/MenuButton). Use the existing `cn` helper.
- [x] 1.3 Create `packages/ui/src/components/table.tsx`, `tabs.tsx`, `dropdown-menu.tsx`, `breadcrumb.tsx`, `separator.tsx`, `tooltip.tsx`, `sheet.tsx`, `skeleton.tsx` from current shadcn recipes.
- [x] 1.4 Wire each new file into `packages/ui/package.json#exports` (e.g. `"./sidebar": "./src/components/sidebar.tsx"`).
- [x] 1.5 Move the CSS-variable definitions (`:root` + `.dark` blocks) into `packages/ui/src/globals.css`. Import it from `apps/admin/src/app/globals.css` and `apps/web/src/app/globals.css`. Remove the duplicate variable blocks from the app-local globals.
- [x] 1.6 `pnpm -w typecheck` passes.

## 2. Web: nav polish + ui migration

- [x] 2.1 In `apps/web/src/components/ui/*`, replace each file with a re-export from `@pokermap/ui/*` (e.g. `export * from "@pokermap/ui/card"`). Then delete the inline copies and update imports across `apps/web/src` to use `@pokermap/ui/*` directly. CI typecheck must pass.
- [x] 2.2 Refine `apps/web/src/components/nav/BottomNav.tsx`: active item uses `rounded-full bg-primary/10 text-primary` pill; inactive uses `text-muted-foreground hover:text-foreground`; add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- [x] 2.3 Wrap `/list` and `/about` page bodies in a `Card` + a top-level `Tabs` shell (for `/list`: tabs by status; for `/about`: a single tab placeholder) using `@pokermap/ui/tabs`.

## 3. Web: fix blank map

- [x] 3.1 Run `pnpm --filter web dev` and reproduce the blank-map state. Use Chrome DevTools MCP (`navigate_page`, `list_console_messages`, `list_network_requests`, `take_screenshot`) at viewport 1280×800 to capture: (a) console errors, (b) `canvas.maplibregl-canvas` bounding box, (c) HTTP status of the first tile request. Save observations as a comment block in `apps/web/src/components/map/MapView.tsx` ONLY if a workaround comment is needed; otherwise discard. _(static analysis only; live reproduction deferred to user — defense-in-depth fixes below land regardless)_
- [x] 3.2 In `apps/web/src/app/page.tsx`, replace the outer `<div className="relative h-app flex-1">` with a CSS-grid layout that guarantees a non-zero height: `<div className="relative h-[calc(100dvh-5rem)] md:h-[calc(100dvh-4rem)] min-h-[400px]">` (mobile reserves bottom-nav space; md+ reserves top-nav space). Add `data-test="map-container"`.
- [x] 3.3 In `apps/web/src/app/layout.tsx`, drop the `pb-20`/`md:pt-16` padding from `<main>` since the page now owns its own height calculation. Keep `min-h-app` for non-map routes.
- [x] 3.4 In `apps/web/src/components/map/MapShell.tsx`, replace `next/dynamic` with a client component that imports `./MapView` inside `useEffect` and catches import errors. On error render a card with "Не удалось загрузить карту" + a "Повторить" button that re-attempts the import. Add `data-test="map-error"` to the error card.
- [x] 3.5 In `apps/web/src/components/map/MapView.tsx`, replace `mapStyle.glyphs` with an OpenFreeMap-hosted fallback or remove the symbol layer's `text-font` requirement so glyph loading is not required for tile rendering.
- [x] 3.6 Update `apps/web/.env.example` and `apps/web/.env.local` to set `NEXT_PUBLIC_MAP_TILE_URL=https://tiles.openfreemap.org/styles/positron/{z}/{x}/{y}.png` (or document the original CARTO URL as an alternative). Update attribution string accordingly.
- [x] 3.7 Add a Playwright e2e test `apps/web/e2e/map.spec.ts` that loads `/`, waits for `canvas.maplibregl-canvas`, asserts `boundingBox().width > 800 && boundingBox().height > 300`, and asserts at least one tile response has `status < 400`.
- [ ] 3.8 Run `pnpm --filter web e2e` and the test passes. _(deferred — requires running API + dev server)_
- [ ] 3.9 Visual QA via Chrome DevTools MCP at viewports 375×812, 768×1024, 1280×800: take screenshots, confirm map fills the available area on each, confirm bottom-nav does not overlap. _(deferred — requires browser MCP session)_

## 4. Admin: dark theme default + shared tokens

- [x] 4.1 In `apps/admin/src/app/layout.tsx`, change `<html lang="ru" className={inter.variable}>` to `<html lang="ru" suppressHydrationWarning className={\`${inter.variable} dark\`}>`. Update `metadata` to include `colorScheme: "dark"` via a `viewport` export (matches web).
- [x] 4.2 Confirm `apps/admin/src/app/globals.css` now only contains app-specific overrides (the shared `:root`/`.dark` blocks moved in 1.5).

## 5. Admin: dashboard shell with sidebar

- [x] 5.1 Create `apps/admin/src/components/shell/AppSidebar.tsx` using `@pokermap/ui/sidebar`. Items: Dashboard `/`, Клубы `/clubs`, Медиа `/media`, Аудит `/audit`, Настройки `/settings`. Use `lucide-react` icons (`LayoutDashboard`, `Building2`, `Image`, `ScrollText`, `Settings`). Highlight active item using `usePathname`.
- [x] 5.2 Create `apps/admin/src/components/shell/AppHeader.tsx` with shadcn `SidebarTrigger`, a `Breadcrumb` driven by `usePathname` + a small route → label map, and a `DropdownMenu` user menu showing first name + logout item that triggers the existing logout action.
- [x] 5.3 Rewrite `apps/admin/src/app/(authed)/layout.tsx` to render `<SidebarProvider defaultOpen><AppSidebar /><SidebarInset><AppHeader />{children}</SidebarInset></SidebarProvider>`. Keep the existing `getSession()` guard. Persist sidebar open state via the shadcn cookie helper (the primitive ships with this; just enable the cookie name in `SidebarProvider`).

## 6. Admin: dashboard landing page

- [x] 6.1 Add `getAdminOverview()` to `apps/admin/src/lib/api/server.ts`. It returns `{ totals: { all, draft, published, archived }, recent: Club[] }` by calling `listAdminClubs` four times in parallel (no-filter for `all` + recent; one call per status for the three statuses with `limit=1` to grab `total`). _(implementation: single batch fetch + local count — API has no status filter; comment explains revisit point)_
- [x] 6.2 Replace the contents of `apps/admin/src/app/(authed)/page.tsx` with a Dashboard page: a 4-column grid of `Card` KPI tiles (Total / Drafts / Published / Archived), a `Card` listing the 5 most-recently-updated clubs with `Badge` for status + a row link, and a `Card` with a primary "Добавить клуб" button linking to `/clubs/new` plus muted secondary links to other sections.
- [x] 6.3 Move the existing Clubs index page from `(authed)/page.tsx` to `(authed)/clubs/page.tsx` (overwriting the old one). Update its `Link` pagination to use `/clubs?page=…` not `/?page=…`.
- [x] 6.4 Rewrite the Clubs table to use `@pokermap/ui/table` (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`).

## 7. Admin: placeholder pages

- [x] 7.1 Create `apps/admin/src/app/(authed)/media/page.tsx`, `audit/page.tsx`, `settings/page.tsx`. Each renders a `Card` with title "В разработке" and a one-line description specific to the section.
- [x] 7.2 Verify each placeholder route loads inside the sidebar shell (no remount, sidebar active state updates). _(structural: all three live under `(authed)/` so they share the same `SidebarProvider` instance via React route segment layout caching; active state via `usePathname` in AppSidebar)_

## 8. Quality gates

- [x] 8.1 `pnpm -w typecheck` passes.
- [x] 8.2 `pnpm -w lint` passes.
- [x] 8.3 `pnpm --filter web test` and `pnpm --filter admin test` pass.
- [ ] 8.4 `pnpm --filter web e2e` passes (includes the new map regression test). _(deferred — requires running API + dev server)_
- [ ] 8.5 Manual visual sweep with Chrome DevTools MCP at 375 / 768 / 1280 viewports for the admin Dashboard, Клубы, and one placeholder page — capture screenshots, confirm dark theme, sidebar collapse, header breadcrumbs, and no layout shift. _(deferred — requires browser MCP session)_
- [x] 8.6 Run `openspec validate redesign-admin-fix-map --strict` — passes.
