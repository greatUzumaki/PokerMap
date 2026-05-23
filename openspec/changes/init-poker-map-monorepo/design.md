## Context

PokerMap is a directory of live poker clubs in Saint Petersburg, surfaced primarily as a **Telegram Mini App** opened from a bot, and secondarily as a standalone **mobile-first web app** at a public domain. The user opens the app, sees a map of the city with markers, taps a marker to read a club's details, contacts, schedule, and games. An admin (the project owner) uses a protected back-office to add/edit/archive clubs and upload photos.

Both surfaces share a single Next.js codebase. A Go backend serves a REST API and verifies Telegram `initData`. Postgres holds the catalog; MinIO holds photos. Local infra (Postgres + MinIO) already runs in the user's Docker — this change writes a `docker-compose.yml` for documentation/portability but does not start the stack.

The repository is empty; every decision here is greenfield with no migration burden.

## Goals / Non-Goals

**Goals:**
- A single repo where `pnpm dev` runs the frontend, `make api` runs the backend, and both consume the same OpenAPI contract.
- Production-ready Next.js 16 (App Router, RSC, Cache Components, React 19, Tailwind 4) configured for both Telegram Mini App and standalone PWA behavior.
- Production-ready Go 1.23 service with chi, pgx, sqlc, slog, graceful shutdown, OpenTelemetry-ready instrumentation.
- A polished map experience: clustered markers, smooth pan/zoom on mobile, club detail bottom-sheet with photos, hours, games.
- An admin panel guarded by Telegram identity + an allowlist (only specific Telegram user IDs may sign in as admin).
- Local-first dev workflow: deterministic seeds, real Postgres + MinIO from compose, no mocked infra.
- All envs filled with working local defaults; secrets are placeholders the user fills in.

**Non-Goals:**
- Payment processing, reservations, ratings/reviews, user accounts beyond Telegram-derived identity (future change).
- Multi-city support (SPb only — schema allows extension, UI defaults to SPb bbox).
- Internationalization beyond Russian + English copy stubs (full i18n later).
- Push notifications / scheduled jobs / background workers (later).
- Production deployment of the Go API (Vercel hosts the web; API deploy target deferred to a follow-up change).
- Telegram bot itself — the bot's `web_app` button URL is configured manually; the bot's command handlers are out of scope here.

## Decisions

### Repo & build orchestration

**Decision**: **pnpm + Turborepo** for JS/TS workspaces, **`go.work`** + **`Makefile`** at root for Go. Single repo, no Nx, no Bazel.

**Why**: Turbo is the lowest-friction monorepo tool for Next.js + shared TS packages and is the native recommendation for Vercel. pnpm gives strict, fast installs. Go's native workspaces sidestep the need to vendor a JS-style monorepo tool into Go land. Bazel/Nx would be overkill for a two-app repo.

**Alternatives**: Turborepo + npm (slower, hoist issues); Nx (great, but heavier than needed); single-package + git submodules (operational tax).

### Frontend framework

**Decision**: **Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4 + shadcn/ui**, deployed to **Vercel**.

**Why**: SSR/RSC for SEO of public club pages, Server Actions for admin mutations, Cache Components for the map data, native middleware for Telegram-aware redirects, first-class Vercel deployment. shadcn keeps the design system in-repo, no runtime cost.

**Alternatives**: Remix (good DX, smaller ecosystem for our integrations); SvelteKit (less common in Telegram Mini App tutorials, smaller hiring pool); Vite + React Router (loses RSC + image opt).

### Backend language

**Decision**: **Go 1.23** with **chi** router, **pgx/v5**, **sqlc**, **slog**, **`golang-migrate`**, **`minio-go/v7`**.

**Why**: User explicitly requested Go. chi gives stdlib-aligned routing with mature middleware, pgx is the Postgres driver everyone settles on, sqlc removes ORM magic while keeping type-safety. slog is the stdlib structured logger.

**Alternatives**: Echo/Fiber (Fiber uses fasthttp — incompatible with stdlib middleware), Gin (older, magic context), GORM (rejected — slow, hard to debug).

### Auth

**Decision**: Telegram Mini App **initData verification** server-side per [docs](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app). On success, the Go API issues an **httpOnly, Secure, SameSite=Lax** session cookie (JWT signed with `JWT_SECRET`, 7-day TTL, includes `tg_user_id` + `is_admin` claim). Standalone web access (non-Telegram) is read-only — only club browsing, no admin.

**Why**: This is the only blessed auth flow inside Telegram Mini Apps. Issuing our own session cookie decouples downstream requests from `initData` reparsing per request and works in iframe contexts.

**Admin gating**: A `admins` table holds whitelisted `telegram_user_id`s seeded from `ADMIN_TELEGRAM_IDS` env (comma-separated). Middleware reads the JWT, looks up the row, and gates `/v1/admin/*` and the `/admin` Next.js segment via Server Component check.

**Alternatives**: NextAuth Telegram provider (less control, extra dep); session in Redis (over-engineered for a single-instance API).

### Map stack

**Decision**: **MapLibre GL JS** with **react-map-gl** wrapper, OSM raster tiles from a CDN to start (e.g., `https://tile.openstreetmap.org/{z}/{x}/{y}.png`), upgrade path to MapTiler vector tiles via env-driven style URL. Markers as a GeoJSON source with `cluster: true`, custom symbol layer using poker-chip SVG.

**Why**: MapLibre is the open-source MapboxGL fork — no token, no quota for raster, full vector support when we add a paid tile provider. Clustering is built-in. react-map-gl gives idiomatic React props.

**Alternatives**: Leaflet (raster-only, no GPU clustering, less polish on mobile gestures); Google Maps (license cost, key required); Yandex Maps (good for RU but heavier SDK and worse RSC story).

**Tile provider note**: OSM Foundation's tile server has a strict usage policy (no high-traffic, must set a UA). Add `NEXT_PUBLIC_MAP_TILE_URL` and document the swap to MapTiler/Stadia/Protomaps before launch.

### Telegram SDK

**Decision**: **`@telegram-apps/sdk-react`** (community-maintained, modern). Wrap the root layout in `<SDKProvider>`. Use `useThemeParams`, `useViewport`, `useMainButton`, `useBackButton`, `useHapticFeedback`.

**Why**: Maintained, TS-first, splits browser-vs-Telegram contexts cleanly. The official `telegram-web-app.js` script is plain JS and not React-friendly.

### Storage

**Decision**: **Postgres 17** for relational data, **MinIO** (S3-compatible) for photos. Photos uploaded via **presigned PUT** from the browser; backend issues the URL, browser does the upload, then POSTs the resulting object key back for persistence.

**Bucket layout**:
- `pokermap-photos` (private). Keys: `clubs/{club_id}/{uuid}.{ext}`.
- Public read served via a thin Next.js **route handler** (`app/api/media/[...key]/route.ts`) that proxies MinIO GET with a short-lived presigned URL — keeps MinIO off the public internet.

**Why presigned**: Browser uploads do not go through the Go API → no body-size limits, no memory pressure on the API.

**Alternatives**: Direct API upload (multipart parsing on Go side — fine but wasteful); Cloudinary (cost, less control).

### Migrations

**Decision**: **`golang-migrate`** CLI, SQL files under `apps/api/migrations/`. Naming: `{timestamp}_{slug}.up.sql` / `.down.sql`. Run via `make migrate-up` / `make migrate-down`. Always reversible.

**Seed data**: A handful of well-known SPb clubs (e.g., Casino Sochi (closed historical), Royal Poker Club references — verified via OSM lookups before commit). Seed runs via a separate `make seed` target so dev DBs are reproducible.

### API style

**Decision**: **REST + OpenAPI 3.1**, JSON only, versioned under `/v1/`. Generate TS client + Zod schemas from OpenAPI into `packages/types`. Pagination cursor-based for list endpoints.

**Why**: REST is the simplest contract for a small surface; OpenAPI auto-generates both the TS client and a Postman/Insomnia spec. gRPC is overkill for a public-facing browser API.

### Validation

**Decision**: **Zod** on the frontend, **`go-playground/validator/v10`** on the backend, with **shared schemas** described in the OpenAPI doc as the source of truth and code-generated on both sides.

### State management (web)

**Decision**: **TanStack Query** for server state, **Zustand** for UI-only state (selected marker, drawer open). No Redux.

### Styling

**Decision**: **Tailwind 4** + **shadcn/ui** primitives copied into `packages/ui`. CSS variables for theme tokens; Telegram theme params (`tg-theme-*`) wired into the same variables so the UI follows the user's TG theme.

### Telemetry

**Decision**: Frontend → **Vercel Analytics** + Web Vitals. Backend → **slog** JSON logs, OpenTelemetry hooks in place but no collector wired in this change (deferred).

### CI/CD

**Decision**: GitHub Actions — three jobs in parallel: `web-ci` (pnpm install + lint + typecheck + build), `api-ci` (`go test -race`, `golangci-lint`, `govulncheck`), `e2e` (Playwright against `next dev` + Go API via docker-compose, run on PRs to main only).

**Vercel**: connect `apps/web` only. Project root = `apps/web`, install command pnpm-aware, framework preset Next.js.

### Folder topology

```
PokerMap/
├── apps/
│   ├── web/                    # Next.js 16
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── .env.local
│   └── api/                    # Go 1.23
│       ├── cmd/api/main.go
│       ├── internal/
│       │   ├── club/{handler,service,repository,model}
│       │   ├── auth/
│       │   ├── media/
│       │   ├── middleware/
│       │   ├── config/
│       │   └── server/
│       ├── migrations/
│       ├── sqlc/{queries.sql,sqlc.yaml}
│       ├── api/openapi.yaml
│       ├── go.mod
│       ├── Makefile
│       └── .env
├── packages/
│   ├── ui/                     # shadcn primitives, tokens
│   ├── config/                 # eslint, tsconfig, prettier
│   └── types/                  # OpenAPI-generated TS + Zod
├── docker-compose.yml          # postgres, minio
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                # root
├── go.work
├── Makefile                    # umbrella
├── .gitignore
├── .editorconfig
├── .nvmrc
├── README.md
└── CLAUDE.md
```

## Risks / Trade-offs

- **OSM tile usage policy** → Default tile URL is OSM raster which is fine for dev but breaches policy at any real traffic. **Mitigation**: env-driven `NEXT_PUBLIC_MAP_TILE_URL`, README flag to swap to MapTiler/Stadia/Protomaps before public launch.
- **Telegram `initData` clock skew** → `initData.auth_date` is a unix timestamp; we reject if older than 24h. Server clock drift could lock users out. **Mitigation**: rely on container time sync (NTP); document.
- **MinIO presigned URLs leak via referrer / browser history** → URLs expire in 5 minutes. **Mitigation**: short TTL + httponly cookie auth on the issuance endpoint; reads go through our proxy route.
- **No CSRF tokens on Server Actions** initially → Next 16 Server Actions ship with built-in same-origin + encrypted-id protection. We rely on that; if a Route Handler accepts a state-changing POST from non-RSC clients, it must add an `X-Request-Origin` check.
- **`go.work` + monorepo tooling** → Some IDEs handle `go.work` poorly. **Mitigation**: keep the API self-contained (no shared Go modules) so contributors can `cd apps/api` and treat it as a normal Go project.
- **Performance budget for cold start on Telegram** → Telegram clients on slow Android devices need <2s LCP. **Mitigation**: Tailwind only, no heavy fonts, defer MapLibre load behind a Suspense boundary, mark the club list as a Cache Component.
- **Admin allowlist via env** is brittle when the team grows. **Mitigation**: the seeded `admins` table is the source of truth; env is only used to seed on first boot.

## Migration Plan

Greenfield — no migration. The bootstrap sequence:

1. Land this change in one PR.
2. User runs `pnpm install` and confirms their existing Postgres + MinIO match the compose definition (same ports, creds, bucket).
3. User runs `make migrate-up && make seed` against their running Postgres.
4. User creates the MinIO bucket: `make minio-bootstrap` (idempotent).
5. User runs `pnpm dev` (web) + `make api-dev` (Go) — both hot-reload.
6. User pastes their real `TELEGRAM_BOT_TOKEN` and `ADMIN_TELEGRAM_IDS` into `.env` files.
7. User sets the Telegram bot's `web_app` URL to the Vercel preview, opens the bot, sees the map.

**Rollback**: revert the PR. No persisted state owned by this change beyond local infrastructure already managed by the user.

## Open Questions

- **Tile provider for production**: MapTiler vs Stadia vs self-hosted Protomaps? Defer until pre-launch (cost vs ops trade-off).
- **Photo CDN**: do we keep proxying MinIO via Next, or front MinIO with a CDN (Bunny, Cloudflare R2 mirror)? Defer.
- **Search**: Postgres trigram (`pg_trgm`) is enough for now; a future change adds full-text + geocoding if user-driven club submissions land.
- **Bot itself**: written separately (likely Go using `go-telegram/bot`) — out of scope here.
- **API hosting**: Fly.io vs Railway vs Hetzner + Caddy? Decide after admin panel is exercised end-to-end.
