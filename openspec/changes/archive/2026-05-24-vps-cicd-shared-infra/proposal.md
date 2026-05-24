## Why

PokerMap currently has no production hosting or automated deployment. The user owns a single VPS (`31.130.135.220`, domain `pargach.ru`) and intends to host this project plus future pet projects on the same machine, sharing Postgres and Redis instances. Without a defined platform layout and CI/CD pipeline, every new project would re-invent reverse proxy config, TLS issuance, secrets, and deployment scripts, and adding a second project would risk port conflicts and credential leakage between tenants. This change establishes a reusable VPS platform with automated GitHub-driven deployment so PokerMap can ship to `pargach.ru/poker` (web) and `api.pargach.ru/poker` (API) on the next push to `main`, and future pet projects can be added in minutes.

## What Changes

- Add **Traefik v3** as the single entry-point reverse proxy on the VPS, with Let's Encrypt TLS (HTTP-01 challenge) and Docker provider for label-based routing.
- Add **shared infra docker-compose stack** (`/srv/platform/`) on the VPS containing Traefik, Postgres 17, Redis 7, and a backup sidecar. Each tenant project gets its own Postgres database, role, and Redis logical DB (or key prefix).
- Add **per-project compose layout** (`/srv/projects/<name>/`) with a project-scoped `docker-compose.yml` that joins the shared `proxy` Docker network and uses Traefik labels to expose routes.
- Add **GitHub Actions CI/CD pipeline** (`.github/workflows/ci.yml` + `deploy.yml`) that on push to `main`: lints/typechecks/tests, builds three images (`web`, `admin`, `api`) with Docker Buildx + GHA cache, pushes to **GHCR** (`ghcr.io/greatuzumaki/pokermap-*`), then SSHes to the VPS and runs `docker compose pull && up -d` with zero-downtime restart.
- Add **routing rules** for PokerMap:
  - `pargach.ru/poker` → `web` container (Next.js with `basePath: /poker` and `assetPrefix: /poker`).
  - `pargach.ru/poker/admin` → `admin` container (Next.js with `basePath: /poker/admin`).
  - `api.pargach.ru/poker` → `api` container (Go service with router stripping `/poker` prefix or mounted under it).
- Add **secrets management** via GitHub Actions Secrets + `.env.production` files materialized on VPS at deploy time (not committed). Document a per-project secret naming convention.
- Add **operational tooling**: nightly `pg_dump` of each project DB to a host directory, weekly retention rotation, a one-shot `bootstrap.sh` for VPS first-time setup, and a `new-project.sh` generator to scaffold `/srv/projects/<name>/`.
- Add **SSH hardening**: disable root password login, deploy key auth only, deploy via a non-root `deploy` user with `docker` group membership and `sudo` only for systemd reloads. **BREAKING** for the current `root` SSH access pattern.
- Update PokerMap apps to honor `BASE_PATH` / `API_BASE_URL` env vars so they work behind the path-prefix routing.

## Capabilities

### New Capabilities

- `vps-platform`: Single-VPS multi-tenant hosting platform — Traefik reverse proxy, shared Docker networks, TLS, DNS conventions, per-project compose layout, and the `bootstrap.sh` / `new-project.sh` scaffolding scripts that make adding a future pet project a 5-minute operation.
- `ci-cd-pipeline`: GitHub Actions workflows for PokerMap that lint/test on PRs and build → push to GHCR → deploy to VPS on `main`, including the SSH deploy contract (`deploy` user, compose pull/up, health-check gate, rollback on failure).
- `shared-data-services`: Multi-tenant Postgres 17 and Redis 7 services on the VPS — per-project database isolation, role/password provisioning convention, connection-string format, backup/restore policy, and resource limits sized for a 2–4 GB VPS.

### Modified Capabilities

- `local-infrastructure`: Local `docker-compose.yml` will be updated so service names, env var names, and the Postgres/Redis port/credential layout match the VPS conventions defined by `shared-data-services`, keeping local dev and production wire-compatible. No behavioral change to local dev workflow beyond renamed env vars.

## Impact

- **Code**:
  - New: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
  - New: `infra/vps/` directory (compose files, Traefik config, bootstrap & new-project scripts, backup scripts) — committed to this repo so it doubles as the platform reference for future projects.
  - Modified: `apps/web/next.config.*` and `apps/admin/next.config.*` for `basePath` / `assetPrefix`.
  - Modified: `apps/api/` router for path-prefix handling under `/poker`.
  - Modified: `apps/*/Dockerfile` to use standalone output (Next.js) and minimal final stage where needed.
  - Modified: `docker-compose.yml` (local) for env var alignment.
- **APIs**: Public API base URL becomes `https://api.pargach.ru/poker`. Web client `API_BASE_URL` must be updated for production builds. CORS allow-list on API must include `https://pargach.ru`.
- **Dependencies**: No new app-level dependencies. New infra-level: `traefik:v3`, `postgres:17-alpine` (already used locally), `redis:7-alpine` (already used locally), `prodrigestivill/postgres-backup-local` for nightly dumps.
- **Systems / external**:
  - VPS `31.130.135.220` filesystem (`/srv/platform`, `/srv/projects`, `/srv/backups`) and OS-level config (UFW firewall, fail2ban, SSH config, `deploy` user) — irreversible without snapshot.
  - DNS: A record `pargach.ru → 31.130.135.220` already set; **wildcard A record `*.pargach.ru → 31.130.135.220`** required to enable `api.pargach.ru` and future project subdomains — must be added by the user before deploy.
  - GitHub: new repo secrets (`VPS_SSH_HOST`, `VPS_SSH_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT`, `GHCR_TOKEN` if cross-account), and the repository must be configured to allow GHCR package writes.
- **Security**:
  - Current shared root password is compromised (exposed in chat) — **must be rotated** and password auth disabled as part of bootstrap.
  - All inter-tenant access is at the Docker-network level; per-project DB credentials prevent cross-project data access at the SQL layer.
