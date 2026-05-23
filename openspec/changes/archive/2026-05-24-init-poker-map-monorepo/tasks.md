## 1. Repository skeleton

- [x] 1.1 Create root `package.json` with `name`, `private: true`, `packageManager: "pnpm@9"`, and workspace scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `format`)
- [x] 1.2 Create `pnpm-workspace.yaml` listing `apps/*` and `packages/*`
- [x] 1.3 Create `turbo.json` with pipelines for `dev`, `build`, `lint`, `typecheck`, `test`, `format:check`
- [x] 1.4 Create root `go.work` referencing `./apps/api`
- [x] 1.5 Create root `Makefile` with umbrella targets (`web-dev`, `api-dev`, `migrate-up`, `migrate-down`, `seed`, `minio-bootstrap`, `lint`, `test`)
- [x] 1.6 Create `.gitignore` (Node, Go, Next.js, env, DS_Store, MinIO data dirs)
- [x] 1.7 Create `.editorconfig` and `.nvmrc` (Node 22 LTS)
- [x] 1.8 Create `README.md` with prerequisites, bootstrap, dev workflow, env override notes
- [x] 1.9 Verify `pnpm install` succeeds from a clean clone

## 2. Shared packages

- [x] 2.1 Scaffold `packages/config` with `eslint-config.js`, `prettier.config.js`, `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: "bundler"`)
- [x] 2.2 Scaffold `packages/ui` with shadcn/ui setup, Tailwind preset, design tokens (CSS vars bound to Telegram theme params), `cn()` helper
- [x] 2.3 Scaffold `packages/types` with OpenAPI codegen script (`openapi-typescript` + `zod-to-openapi` pipeline) and Zod schemas

## 3. Docker Compose + local infra

- [x] 3.1 Write `docker-compose.yml` with `postgres` (Postgres 17, named volume, healthcheck, port 5432) and `minio` (latest stable, console on 9001, healthcheck, named volume)
- [x] 3.2 Write `.env.example` files at root, `apps/web/`, and `apps/api/` with documented defaults
- [x] 3.3 Write actual `.env.local` (apps/web) and `.env` (apps/api) with working local values + placeholders for `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `ADMIN_TELEGRAM_IDS`
- [x] 3.4 Add `make minio-bootstrap` target that uses `mc` (MinIO client in Docker) to create the `pokermap-photos` bucket idempotently

## 4. Go backend scaffolding

- [x] 4.1 Create `apps/api/go.mod` with Go 1.23, add deps: `chi/v5`, `chi/v5/middleware`, `pgx/v5`, `pgx/v5/pgxpool`, `golang-migrate/v4`, `sqlc-dev/sqlc`, `minio-go/v7`, `go-playground/validator/v10`, `golang-jwt/jwt/v5`, `google/uuid`, `kelseyhightower/envconfig`, `stretchr/testify`
- [x] 4.2 Create `internal/config/config.go` loading `Config` struct from env via envconfig + validation; fail-fast on missing required values; warn on placeholders
- [x] 4.3 Create `internal/server/server.go` with `*http.Server` configured with timeouts (`ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`) and graceful shutdown on SIGTERM
- [x] 4.4 Create `cmd/api/main.go` wiring config → logger (slog JSON) → pgxpool → minio client → router → server
- [x] 4.5 Add `/healthz` (process alive) and `/readyz` (DB + MinIO pingable) endpoints
- [x] 4.6 Add CORS middleware (env-driven allowlist), request-id middleware, structured access log middleware, panic recoverer
- [x] 4.7 Add `Makefile` for the api: `api-dev` (with `air` hot-reload), `api-build`, `api-test`, `api-lint`, `migrate-up`, `migrate-down`, `sqlc-gen`, `openapi-gen`

## 5. Database migrations + sqlc

- [x] 5.1 Configure `sqlc.yaml` (engine postgres, gen.go.package `db`, gen.go.sql_package `pgx/v5`, out `internal/db`)
- [x] 5.2 Write migration `0001_init_clubs.up.sql` creating `clubs` table per spec, plus indexes on `slug` (UNIQUE) and `(lat, lng)`
- [x] 5.3 Write migration `0002_admins.up.sql` creating `admins` table
- [x] 5.4 Write migration `0003_audit_log.up.sql` creating `audit_log` table
- [x] 5.5 Write matching `.down.sql` files (reversible)
- [x] 5.6 Write `apps/api/internal/db/queries.sql` for: `ListPublishedClubs` (with bbox + cursor), `GetClubBySlug`, `CreateClub`, `UpdateClub`, `ArchiveClub`, `ListAdmins`, `UpsertAdmin`, `InsertAuditLog`
- [x] 5.7 Run `sqlc generate` and commit generated code under `internal/db`
- [x] 5.8 Write `apps/api/internal/seed/seed.go` inserting 5+ real SPb poker clubs with verified coordinates (Royal Poker Club, Casino, etc.) — invoked by `make seed`

## 6. OpenAPI contract + TS client

- [x] 6.1 Author `apps/api/api/openapi.yaml` describing every public + admin endpoint with request/response schemas
- [x] 6.2 Add codegen script in `packages/types/package.json` that runs `openapi-typescript` to produce `Schema` types and `openapi-zod-client` (or equivalent) to produce Zod schemas
- [x] 6.3 Add `pnpm types:gen` script wired into Turbo `build` dependsOn

## 7. Telegram auth on the API

- [x] 7.1 Implement `internal/auth/telegram.go` with `VerifyInitData(initData string, botToken string) (TelegramUser, error)` per the official spec (HMAC-SHA256, sorted key=value pairs)
- [x] 7.2 Implement JWT issuer + parser (`internal/auth/jwt.go`) using HS256 + `JWT_SECRET`, 7-day TTL, claims `{ sub: tg_user_id, is_admin: bool, iat, exp }`
- [x] 7.3 Implement `POST /v1/auth/telegram` handler that verifies initData, checks `admins` table, issues cookie
- [x] 7.4 Implement `internal/middleware/session.go` reading the cookie, parsing the JWT, attaching `User` to context
- [x] 7.5 Implement `internal/middleware/admin.go` gating routes by `is_admin`

## 8. Club catalog endpoints

- [x] 8.1 Implement `GET /v1/clubs` handler with cursor pagination + bbox filter
- [x] 8.2 Implement `GET /v1/clubs/:slug` handler
- [x] 8.3 Implement admin `POST /v1/admin/clubs` handler with full validation
- [x] 8.4 Implement admin `PUT /v1/admin/clubs/:id` partial-update handler + audit_log write
- [x] 8.5 Implement admin `DELETE /v1/admin/clubs/:id` archive handler + audit_log write
- [x] 8.6 Wire validators (go-playground/validator) with custom rules for `slug`, lat/lng ranges, games enum
- [x] 8.7 Write integration tests using `testcontainers-go` against a real Postgres for each handler

## 9. Media storage endpoints

- [x] 9.1 Implement `internal/media/minio.go` wrapper around `minio-go` (presigned PUT, presigned GET, bucket bootstrap)
- [x] 9.2 Implement `POST /v1/admin/uploads/sign` validating mime + size, returning presigned URL + final key
- [x] 9.3 Integration test against MinIO container

## 10. Next.js frontend scaffolding

- [x] 10.1 Run `pnpm create next-app@latest apps/web` with options: TypeScript, ESLint, Tailwind, App Router, src dir, import alias `@/*`, Turbopack
- [x] 10.2 Upgrade to Next 16 / React 19 if create-next-app didn't pick the latest; pin versions in `package.json`
- [x] 10.3 Add deps: `@telegram-apps/sdk-react`, `maplibre-gl`, `react-map-gl`, `@tanstack/react-query`, `zustand`, `zod`, `clsx`, `tailwind-merge`, `lucide-react`, `vaul` (bottom sheet), `sonner` (toasts), `next-themes`
- [x] 10.4 Init shadcn/ui (`pnpm dlx shadcn@latest init`) and add components: `button`, `card`, `dialog`, `drawer`, `form`, `input`, `label`, `select`, `sheet`, `switch`, `table`, `tabs`, `textarea`, `toast`, `tooltip`
- [x] 10.5 Configure `next.config.ts` (turbopack, image remote patterns for MinIO host, transpilePackages for `packages/ui`)
- [x] 10.6 Configure `tailwind.config.ts` extending `packages/ui` preset
- [x] 10.7 Update `tsconfig.json` to extend `packages/config/tsconfig.base.json`
- [x] 10.8 Set up root `app/layout.tsx` with `<SDKProvider>`, `<QueryProvider>`, `<ThemeBridge>` wiring TG theme to CSS vars
- [x] 10.9 Add `app/globals.css` with Tailwind layers + CSS variables for Telegram theme tokens

## 11. Public map page

- [x] 11.1 Implement `app/page.tsx` (Server Component) that fetches `/v1/clubs` via Cache Components (`use cache` + `cacheTag('clubs')`) and renders `<MapView clubs={...} />`
- [x] 11.2 Implement `components/map/MapView.tsx` (Client Component) loading MapLibre lazily via `next/dynamic({ ssr: false })`
- [x] 11.3 Implement GeoJSON source + clustered symbol layer with custom poker-chip SVG marker
- [x] 11.4 Implement marker tap → opens `<ClubSheet>` (drawer on mobile via vaul, side sheet on `md+` via shadcn `<Sheet>`)
- [x] 11.5 Implement `<ClubSheet>` showing photos carousel, name, address, working hours (current weekday highlighted), games, buy-ins, rake, contacts, "Build route" button
- [x] 11.6 Implement haptic feedback hooks (`useTelegramHaptics`) firing on tap and confirm
- [x] 11.7 Implement focus trap inside the sheet + Esc-to-close

## 12. Navigation + list view

- [x] 12.1 Implement `components/nav/BottomNav.tsx` with 3 tabs (Map/List/About), active-state styling, mobile-bottom + desktop-top responsive
- [x] 12.2 Implement `app/list/page.tsx` (Server Component) rendering club rows with client-side search
- [x] 12.3 Implement `app/about/page.tsx` static content (project description, contacts, OSM attribution)

## 13. Telegram integration polish

- [x] 13.1 Implement `<ThemeBridge>` Client Component listening to `themeParams` changes and writing CSS vars
- [x] 13.2 Implement `<ViewportBridge>` calling `WebApp.expand()` + locking `--app-height` to `viewportStableHeight`
- [x] 13.3 Implement `<BackButtonBridge>` syncing TG BackButton with Next router on non-root routes
- [x] 13.4 Implement `useTelegramAuth()` hook posting `initData` to `/v1/auth/telegram` once on mount inside TG, caching the session via TanStack Query
- [x] 13.5 Add fallback path: outside Telegram, app stays read-only and hides admin entry points

## 14. Admin panel

- [x] 14.1 Implement `app/admin/layout.tsx` Server Component verifying session + `is_admin`; `notFound()` otherwise
- [x] 14.2 Implement `app/admin/page.tsx` showing club table (status badge, name, slug, address, updated_at) with pagination
- [x] 14.3 Implement `app/admin/clubs/new/page.tsx` create form
- [x] 14.4 Implement `app/admin/clubs/[id]/page.tsx` edit form with status transition buttons
- [x] 14.5 Implement embedded geo picker (`<GeoPicker>`) inside the form: click on map to set lat/lng, manual input synced two-way
- [x] 14.6 Implement photo uploader: request presigned URL → browser PUT to MinIO → POST key to attach → preview gallery
- [x] 14.7 Implement audit log view (`app/admin/clubs/[id]/history/page.tsx`)
- [x] 14.8 Wire all mutations through Server Actions that call the Go API with the session cookie forwarded
- [x] 14.9 Surface API validation errors at the field level

## 15. Tests

- [x] 15.1 Add Vitest + React Testing Library setup in `apps/web`
- [x] 15.2 Write unit tests for utility functions (cn, time formatting, haptic guards)
- [x] 15.3 Write component tests for `<ClubSheet>`, `<BottomNav>`, `<GeoPicker>`
- [x] 15.4 Add Playwright config + smoke test (`/` loads, marker tap opens sheet)
- [x] 15.5 Go: `go test -race ./...` covers auth, handlers, validation; ensure `golangci-lint run` is clean

## 16. CI/CD

- [x] 16.1 Add `.github/workflows/ci.yml` with three parallel jobs: `web` (pnpm install, lint, typecheck, build), `api` (golangci-lint, go test -race, govulncheck), `e2e` (Playwright on PR)
- [x] 16.2 Add `vercel.json` (or `vercel.ts`) configuring Vercel for the `apps/web` root with framework preset Next.js, pnpm install command, and ignoreBuildStep based on `git diff`
- [x] 16.3 Add Dependabot config (`.github/dependabot.yml`) for npm + go modules

## 17. Final verification

- [x] 17.1 From a clean clone: `pnpm install`, `make migrate-up`, `make seed`, `make minio-bootstrap`, `pnpm dev`, `make api-dev` all succeed
- [x] 17.2 Open `http://localhost:3000/`, verify map renders, markers appear, sheet opens on tap
- [x] 17.3 Open `/admin` outside Telegram → 404 confirmed
- [x] 17.4 Sign Telegram initData manually with bot token → POST to `/v1/auth/telegram` → cookie issued → `/admin` accessible (smoke via curl)
- [x] 17.5 Lighthouse mobile audit on `/` shows LCP/INP/CLS within budget
- [x] 17.6 `golangci-lint run` + `go test -race ./...` clean
- [x] 17.7 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` clean
- [x] 17.8 README walkthrough validated by following it end-to-end
