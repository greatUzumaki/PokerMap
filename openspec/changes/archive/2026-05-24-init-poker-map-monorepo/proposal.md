## Why

There is no project skeleton yet. The product is a **Telegram Mini App + standalone web app** that maps poker clubs in Saint Petersburg, lets users browse club info on an interactive map, and lets the owner manage the catalog through an admin panel. Before any feature work can ship, the repository needs a monorepo layout, a Next.js frontend, a Go backend, local infrastructure (Postgres + MinIO via Docker Compose), and shared conventions wired together so future changes have a stable foundation.

## What Changes

- Establish a **pnpm + Turborepo monorepo** with `apps/web` (Next.js 16 App Router, TS, Tailwind, shadcn/ui) and `apps/api` (Go 1.23, chi router, pgx, sqlc).
- Add shared packages: `packages/ui` (shadcn primitives + tokens), `packages/config` (eslint/tsconfig/prettier), `packages/types` (OpenAPI-generated TS types).
- Implement a **public map UI** with MapLibre GL JS rendering OpenStreetMap tiles, custom poker-chip markers per club, clustering, and a club detail drawer/sheet on marker tap.
- Implement a **mobile-first menu/nav** that adapts to Telegram Mini App constraints (theme params, viewport, MainButton, BackButton, haptics) and to a standalone PWA-style web shell.
- Implement a **Telegram WebApp SDK integration layer** (`@telegram-apps/sdk`) with `initData` verification on the Go backend (HMAC-SHA256 with bot token) and a session cookie issued after verification.
- Implement an **admin panel** at `/admin` protected by Telegram auth + an `admins` allowlist table — CRUD for clubs, photo uploads to MinIO (S3-compatible) via presigned PUT URLs, rich text descriptions, geo picker.
- Define the **Club domain**: `id`, `slug`, `name`, `address`, `lat/lng`, `description` (markdown), `phones`, `website`, `telegram`, `working_hours` (jsonb per weekday), `games[]` (NLH, PLO, MTT, etc.), `min_buy_in`, `max_buy_in`, `rake`, `photos[]` (MinIO keys), `status` (`draft|published|archived`), `created_at`, `updated_at`.
- Build the **Go REST API**: `GET /v1/clubs`, `GET /v1/clubs/:slug`, `POST /v1/auth/telegram`, admin-only `POST/PUT/DELETE /v1/admin/clubs/:id`, `POST /v1/admin/uploads/sign` (presigned MinIO URL), `GET /healthz`, `GET /readyz`. Spec via OpenAPI 3.1; TS client generated.
- Add **Docker Compose** describing local Postgres 17 + MinIO services (named, with a project-scoped network) — file written but not started, since the user already runs both elsewhere.
- Add **migrations** with `golang-migrate` for the `clubs`, `admins`, `audit_log` tables plus seeds for a handful of real SPb poker rooms.
- Fill in **`.env` files** for both apps with sensible local defaults (DB DSN, MinIO creds, Telegram bot token placeholder, JWT secret placeholder, public map style URL).
- Configure **CI** (GitHub Actions) for lint + typecheck + test on both apps and **Vercel project** for `apps/web` deployment.

## Capabilities

### New Capabilities
- `monorepo-foundation`: repository topology, package manager, build orchestration, shared configs, code quality tooling.
- `local-infrastructure`: Docker Compose definition for Postgres + MinIO, env conventions, bootstrap docs.
- `club-catalog`: domain model + REST API for poker club CRUD, listing, and lookup by slug.
- `public-map-ui`: Next.js public map page with markers, clustering, club detail sheet, mobile menu.
- `telegram-mini-app`: Telegram WebApp SDK integration, initData verification, session issuance, theme/viewport adaptation.
- `admin-panel`: authenticated admin UI for club CRUD, photo upload via presigned URLs, status transitions, audit log.
- `media-storage`: MinIO bucket layout, presigned PUT/GET URL flow, allowed mime types, size limits.

### Modified Capabilities
<!-- none — greenfield repository -->

## Impact

- **New code**: entire monorepo (`apps/web`, `apps/api`, `packages/*`), `docker-compose.yml`, `Makefile`, `.github/workflows/`, `turbo.json`, root `package.json`, `pnpm-workspace.yaml`, root `go.work`.
- **Dependencies introduced**: Next.js 16, React 19, Tailwind 4, shadcn/ui, MapLibre GL JS, `@telegram-apps/sdk-react`, TanStack Query, Zod, `zustand`; Go: `chi`, `pgx/v5`, `sqlc`, `slog`, `golang-migrate`, `minio-go/v7`, `go-playground/validator/v10`.
- **External systems**: Postgres 17 + MinIO (already running locally per user). Telegram Bot API for auth handshake. OSM tile provider (free tier — pin a styling source like MapTiler/Stadia later).
- **Operational**: Vercel project for `apps/web`; Go API deployment target deferred (Fly.io or self-hosted — decided in design.md).
- **Breaking**: none (no prior state).
