# PokerMap

> Interactive directory of live poker clubs in Saint Petersburg — built as a Telegram Mini App and a standalone mobile-first web app.

Browse clubs on an interactive map, tap markers for opening hours, games, buy-ins, photos and contacts. Owners manage the catalog through a separate, Telegram-authenticated admin panel.

---

## Architecture

```
                    ┌──────────────────┐         ┌──────────────────┐
   Telegram /       │   apps/web       │         │   apps/admin     │
   browser users ──▶│   Next.js 16     │         │   Next.js 16     │◀── Telegram-authed
                    │   :3000          │         │   :3001          │    operators
                    └────────┬─────────┘         └────────┬─────────┘
                             │                            │
                             │       REST + cookie        │
                             ▼                            ▼
                    ┌─────────────────────────────────────────────┐
                    │           apps/api · Go 1.23 · :8080         │
                    │   chi · pgx · sqlc · slog · validator        │
                    └──┬─────────────────┬───────────────┬─────────┘
                       │                 │               │
                       ▼                 ▼               ▼
                ┌────────────┐    ┌────────────┐  ┌────────────┐
                │ PostgreSQL │    │   MinIO    │  │   Redis    │
                │   :5432    │    │ S3 :9000   │  │   :6379    │
                └────────────┘    └────────────┘  └────────────┘
```

| App | Path | Port | Purpose |
| --- | --- | --- | --- |
| `web` | `apps/web` | 3000 | Public map + list + club detail, Telegram Mini App entry point |
| `admin` | `apps/admin` | 3001 | Authenticated CRUD for clubs, photo uploads, audit history |
| `api` | `apps/api` | 8080 | Go REST API, Telegram `initData` verification, presigned uploads, Redis caching |

---

## Tech stack

**Frontend** — Next.js 16 (App Router, RSC, Server Actions, typed routes), React 19, TypeScript strict, Tailwind 4, MapLibre GL JS via `react-map-gl`, `@telegram-apps/sdk-react`, TanStack Query, Zustand, Sonner, Vaul.

**Backend** — Go 1.23, `chi` router, `pgx/v5`, `sqlc`-style hand-rolled queries, `slog` JSON logging, `golang-migrate`, `minio-go/v7`, `go-redis/v9`, `go-playground/validator/v10`, `golang-jwt/v5`.

**Infrastructure** — PostgreSQL 17, MinIO (S3-compatible), Redis 7.4. All shipped via `docker-compose.yml`.

**Monorepo tooling** — pnpm workspaces, Turborepo, `go.work`. Shared packages: `@pokermap/ui` (Tailwind preset + primitives), `@pokermap/types` (OpenAPI codegen + Zod schemas), `@pokermap/config` (shared tsconfig + eslint + prettier).

---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 24+ | `nvm use` reads `.nvmrc` |
| pnpm | 9+ | `corepack enable && corepack prepare pnpm@9.15.0 --activate` |
| Go | 1.23+ | |
| Docker | latest | only if you do not already run Postgres / MinIO / Redis |
| `golang-migrate` | 4+ | `brew install golang-migrate` |
| `air` | latest | `go install github.com/air-verse/air@latest` — Go hot reload, optional |

---

## Quick start

```bash
# 1. Install everything
make install

# 2. Start local infra ONLY if you do not already run them.
#    Skip if you already have Postgres + MinIO + Redis running on the documented ports.
make docker-up

# 3. Apply migrations and seed demo clubs
make migrate-up
make seed

# 4. Create the MinIO bucket
make minio-bootstrap

# 5. Fill in real secrets in apps/api/.env:
#    - TELEGRAM_BOT_TOKEN  (from @BotFather)
#    - JWT_SECRET          (openssl rand -base64 48)
#    - ADMIN_TELEGRAM_IDS  (comma-separated, your Telegram user id)

# 6. Run everything in parallel
make dev
```

Now open:

- **Public app** → http://localhost:3000
- **Admin panel** → http://localhost:3001 (returns 404 unless you have a valid Telegram session with `is_admin = true`)
- **API health** → http://localhost:8080/healthz
- **API readiness** → http://localhost:8080/readyz

---

## Repository layout

```
PokerMap/
├── apps/
│   ├── web/        # Next.js public app (port 3000) + Telegram Mini App
│   ├── admin/      # Next.js admin app (port 3001) — Telegram-auth required
│   └── api/        # Go 1.23 REST API
├── packages/
│   ├── ui/         # Shared shadcn/ui-style primitives + Tailwind preset + tokens
│   ├── types/      # OpenAPI-generated TypeScript types + Zod schemas
│   └── config/     # eslint / prettier / tsconfig presets
├── openspec/       # Spec-driven change workflow
├── docker-compose.yml
├── Makefile
├── go.work
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## Environment variables

The committed `.env` / `.env.local` files contain working local defaults; placeholders must be replaced before deploying.

### `apps/api/.env`

| Variable | Default | Notes |
| --- | --- | --- |
| `HTTP_ADDR` | `:8080` | API listen address |
| `DATABASE_URL` | `postgres://pokermap:pokermap@localhost:5432/pokermap?sslmode=disable` | Postgres DSN |
| `MINIO_ENDPOINT` | `localhost:9000` | S3 endpoint |
| `MINIO_ACCESS_KEY` | `pokermap` | |
| `MINIO_SECRET_KEY` | `pokermap-secret` | |
| `MINIO_BUCKET` | `pokermap-photos` | |
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | rewritten into presigned URLs |
| `REDIS_URL` | `redis://localhost:6379/0` | leave empty to disable caching |
| `CACHE_TTL` | `60s` | TTL for public list / detail caches |
| `CACHE_KEY_PREFIX` | `pm:` | Redis key namespace |
| `TELEGRAM_BOT_TOKEN` | placeholder | **required** — from `@BotFather` |
| `JWT_SECRET` | placeholder | **required** — `openssl rand -base64 48` |
| `JWT_TTL` | `168h` | session lifetime |
| `ADMIN_TELEGRAM_IDS` | empty | comma-separated allowlist, seeds the `admins` table on first boot |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | comma-separated |
| `UPLOAD_MAX_SIZE_BYTES` | `8388608` | 8 MB |
| `UPLOAD_URL_TTL` | `5m` | presigned URL lifetime |

### `apps/web/.env.local` & `apps/admin/.env.local`

| Variable | Default | Notes |
| --- | --- | --- |
| `API_URL` | `http://localhost:8080` | server-side fetches |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | browser fetches |
| `NEXT_PUBLIC_MAP_TILE_URL` | OSM raster | swap for MapTiler/Stadia/Protomaps before public launch |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | `© OpenStreetMap contributors` | |
| `NEXT_PUBLIC_DEFAULT_BBOX` (web only) | `30.18,59.83,30.55,60.07` | Saint Petersburg bounding box |

---

## Make targets

```text
make install           Install JS + Go dependencies
make docker-up         Start Postgres + MinIO + Redis via docker-compose
make docker-down       Stop docker-compose services
make web-dev           Run the public Next.js app (port 3000)
make admin-dev         Run the admin Next.js app (port 3001)
make api-dev           Run the Go API with hot reload (requires `air`)
make dev               Run web + admin + api in parallel
make migrate-up        Apply pending DB migrations
make migrate-down      Roll back the last migration
make migrate-new name=add_xxx
make seed              Insert demo poker clubs
make minio-bootstrap   Create the MinIO bucket (idempotent)
make lint              ESLint + golangci-lint
make typecheck         tsc --noEmit across workspaces
make test              Vitest + go test -race
make build             Production builds
```

---

## Caching strategy

Public `GET /v1/clubs` and `GET /v1/clubs/:slug` are read-through cached in Redis with a `60s` TTL. Admin mutations (`POST`, `PUT`, `DELETE` on `/v1/admin/clubs*`) invalidate the entire `clubs:*` key space using `SCAN + DEL` batches.

If `REDIS_URL` is empty, the API falls back to a no-op cache so it remains operable without Redis. Hits are surfaced through the `X-Cache: HIT|MISS` response header for debugging.

---

## Auth flow

1. The Telegram Mini App boots, reads `initData` from the WebApp SDK, and POSTs it to `POST /v1/auth/telegram`.
2. The API verifies the HMAC-SHA256 signature against `TELEGRAM_BOT_TOKEN` per the [official spec](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app), rejects `initData` older than 24h, and looks up the Telegram user id in the `admins` table.
3. On success it issues an `httpOnly`, `SameSite=Lax` cookie `pm_session` containing a JWT with `tg_user_id` and `is_admin` claims (7-day TTL).
4. Subsequent requests carry the cookie. Admin endpoints additionally require `is_admin = true`.

The admin panel responds with `404` (not `403`) to unauthenticated requests, hiding its existence.

---

## API surface

OpenAPI 3.1 spec lives at `apps/api/api/openapi.yaml`. TS types and Zod schemas are generated into `packages/types`. Run `pnpm --filter @pokermap/types types:gen` after modifying the spec.

```
GET    /healthz                    Liveness
GET    /readyz                     Readiness (db + minio + redis)
POST   /v1/auth/telegram           Verify initData → issue cookie
POST   /v1/auth/logout             Clear cookie
GET    /v1/auth/me                 Current session user
GET    /v1/clubs                   Public list (cursor pagination, optional bbox, filters: games, types, minBuyIn, maxBuyIn)
GET    /v1/clubs/:slug             Public detail (rendered at web /clubs/:slug)
GET    /v1/admin/clubs             Admin list (all statuses)
POST   /v1/admin/clubs             Create
GET    /v1/admin/clubs/:id         Detail (any status)
PUT    /v1/admin/clubs/:id         Partial update
DELETE /v1/admin/clubs/:id         Archive (soft delete)
GET    /v1/admin/clubs/:id/history Audit log
POST   /v1/admin/uploads/sign      Presigned MinIO PUT URL
```

---

## Docker

Each app ships a multi-stage Alpine-based Dockerfile:

- `apps/api/Dockerfile` — `golang:1.23.4-alpine3.20` → `alpine:3.20`, statically linked binary, ~15 MB final image.
- `apps/web/Dockerfile` — `node:24.1.0-alpine3.20`, copies built `.next` + workspace `node_modules`.
- `apps/admin/Dockerfile` — same as web, port 3001.

All three include healthchecks. Build any of them from the repo root:

```bash
docker build -f apps/api/Dockerfile   -t pokermap-api   .
docker build -f apps/web/Dockerfile   -t pokermap-web   .
docker build -f apps/admin/Dockerfile -t pokermap-admin .
```

---

## Seed catalog

The Saint Petersburg club catalog used by the API seeder lives in
`apps/api/internal/seed/seed_spb.go`. **Only legal sport-poker venues
(rating-only, non-monetary, fixed organisational fee ≤ 1500 ₽) are eligible.**
Cash venues, PPPoker-based clubs, and anything advertising buy-ins or rake
are excluded by policy — see the package doc-comment in `seed_spb.go` for
the full inclusion criteria.

Each entry cites the public source URL it was checked against (club website,
Telegram channel, 2GIS, Yandex Maps). `apps/api/internal/seed/seed.go`
deletes retired slugs listed in `legacyDemoSlugs` and upserts the live
catalog inside a single transaction on every boot, so the database
converges idempotently.

The public map and `/list` accept filter query params that are also the
URL-persistent state for the on-map filter pill:

```
?openNow=1                 # evaluated client-side using Europe/Moscow
?games=NLH,PLO,MTT         # whitelist of game codes
?types=cash,club           # whitelist of club_type values
?minBuyIn=500000           # kopecks, inclusive overlap with declared range
?maxBuyIn=5000000
```

## OpenSpec workflow

Non-trivial changes are tracked under `openspec/` using the spec-driven workflow defined in `openspec/AGENTS.md`.

```bash
openspec list                          # active changes
openspec status --change <name>        # progress per change
/opsx:new                              # start a new change
/opsx:apply <name>                     # implement a change
```

---

## Production notes

- **OSM tile policy** — the default `NEXT_PUBLIC_MAP_TILE_URL` points at OSM's tile server which forbids high-traffic apps. Swap to MapTiler / Stadia / Protomaps before public launch.
- **JWT secret** — never deploy with the placeholder. Use `openssl rand -base64 48`.
- **MinIO** — keep the bucket private; reads go through the API's `app/api/media/[...key]/route.ts` proxy or via short-lived presigned GET URLs.
- **API hosting** — Vercel hosts the two Next apps. The Go API hosting target (Fly.io / Railway / self-hosted Caddy) is deferred to a follow-up change.
