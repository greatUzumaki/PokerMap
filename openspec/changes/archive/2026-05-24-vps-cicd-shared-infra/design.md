## Context

PokerMap is a Turborepo monorepo with three deployable apps (`apps/web`, `apps/admin`, `apps/api`) plus shared TS packages. The user owns one VPS (`31.130.135.220`, presumed 2–4 GB RAM, single-node Linux) and one root domain (`pargach.ru`, A record already pointing to the VPS). The user wants to host PokerMap and future pet projects on this single VPS with:

- Path-prefix routing on the apex (`pargach.ru/poker`, future `pargach.ru/<other>`).
- A clean API subdomain pattern (`api.pargach.ru/<project>`).
- Shared Postgres and Redis instances reused across projects to save RAM, with logical isolation per project.
- Automated deploy on push to `main` of each project's GitHub repo.

Constraints:

- **One VPS, limited RAM** (assume 4 GB until measured). Running per-project Postgres + Redis is wasteful, so they are shared. Running per-project Node/Go containers is fine — each app is small.
- **GitHub-hosted source**. CI must run on GitHub Actions for the free tier on public repos / Linux minutes on private.
- **Hot path is deploy frequency**, not CI duration. The user iterates fast; deploys must be < 3 min from push to live.
- **Operator is solo** — no on-call rotation, no Kubernetes. Solution must be debuggable with `ssh` + `docker compose logs`.
- **Security exposure today is poor** — root password was shared in cleartext. The bootstrap MUST harden SSH and rotate credentials before opening anything else.

Stakeholders: the user (solo developer & operator).

## Goals / Non-Goals

**Goals:**

- One-time `bootstrap.sh` brings a fresh Ubuntu/Debian VPS to a state where it serves TLS for `pargach.ru` and `*.pargach.ru`, runs the shared platform stack, and has a `deploy` user that GitHub Actions can SSH in as.
- `new-project.sh <name>` scaffolds `/srv/projects/<name>/{docker-compose.yml,.env}`, creates a Postgres database `<name>`, a Postgres role `<name>` with password, allocates a Redis logical DB number, and prints the connection strings — ready to be wired into the project's GH Actions secrets.
- Push to `main` of PokerMap → live at `https://pargach.ru/poker` and `https://api.pargach.ru/poker` within 3 minutes, with health-gated cutover.
- Adding a second pet project later requires only: (a) `new-project.sh <name>` on the VPS, (b) copying the workflow files into the new repo, (c) setting GH secrets. No Traefik config edits, no DNS changes (wildcard covers subdomains).
- Postgres is backed up nightly to disk with 7-day retention. Restore procedure is documented.

**Non-Goals:**

- Multi-node, HA, or Kubernetes. Single VPS only.
- Blue/green or canary deploys. Rolling restart with healthcheck gate is enough.
- Centralized log aggregation (Loki/ELK). `docker logs` + `journalctl` is enough for now; add later if needed.
- Off-site backups (S3/B2). Local-disk backups only in v1; a follow-up change can add rclone/restic to a bucket.
- Monitoring/alerting beyond Traefik dashboard + a basic uptime ping. No Prometheus/Grafana yet.
- Per-project resource quotas (cgroups). All projects share VPS resources cooperatively in v1.
- IPv6.

## Decisions

### D1: Reverse proxy — Traefik v3 with Docker provider + Let's Encrypt HTTP-01

**Choice:** Traefik v3 as a container on the host, attached to a shared external Docker network `proxy`, with the Docker provider (`exposedByDefault=false`) and Let's Encrypt via HTTP-01 challenge.

**Rationale:** Each new project container declares routes via Docker labels (`traefik.http.routers.<name>.rule=...`). Adding a project requires zero edits to the platform stack — labels live with the project's own compose file. Auto-TLS issuance and renewal. Traefik handles path-prefix stripping (`StripPrefix` middleware) needed for `/poker` routing into apps that don't natively support a base path (the Go API). The dashboard, when enabled, gives a visual map of routes — useful when adding the second project.

**Alternatives:**

- *Caddy* — simpler `Caddyfile`, but config is centralized; adding a project requires editing the global file and reloading. Loses the "drop in a project, it just routes" property.
- *Nginx + certbot* — most familiar, but per-project blocks must be hand-written and reloaded; certbot renewal is a separate moving part. Higher operational overhead per project.
- *DNS-01 challenge with wildcard cert* — would avoid the need to expose port 80, but requires the user's DNS provider API token. HTTP-01 works with the existing wildcard A record. Can switch later if a provider with API is in use.

### D2: Routing scheme — apex path-prefix for web, subdomain for API

**Choice:**

- `pargach.ru/poker/*` → web container (Next.js, `basePath: '/poker'`).
- `pargach.ru/poker/admin/*` → admin container (Next.js, `basePath: '/poker/admin'`). Traefik priority ensures the more specific rule wins.
- `api.pargach.ru/poker/*` → api container. Traefik `StripPrefix: /poker` middleware so the Go service sees `/clubs` not `/poker/clubs`. CORS allow-list on API includes `https://pargach.ru`.

**Rationale:** Path-prefix on the apex matches the user's stated UX (`pargach.ru/poker`). Subdomain on API avoids the "Next.js basePath also affects the API route" footgun, gives clean CORS semantics, and scales trivially to `api.pargach.ru/<future-project>` with no rule rewrite. Wildcard A record `*.pargach.ru → 31.130.135.220` enables all future API subdomains and lets us also offer `<project>.pargach.ru` for projects that prefer subdomain over path-prefix in the future.

**Alternatives:**

- *Subdomain for everything* (`poker.pargach.ru`) — clean, no `basePath`, but contradicts user's explicit `pargach.ru/poker` request.
- *Single host for web + api* (`pargach.ru/poker/api`) — saves a DNS record but path-stripping with two Next.js apps plus an API on the same host becomes brittle when routers compete on prefix priority.

### D3: Build/deploy — GitHub Actions → GHCR → SSH `docker compose pull && up -d`

**Choice:** Two workflows:

- `ci.yml` on PRs and pushes to `main`: install pnpm, restore turbo cache, run `pnpm lint && pnpm typecheck && pnpm test`, and `go test ./...` inside `apps/api`.
- `deploy.yml` on pushes to `main` (after `ci.yml` green): build three images with `docker/build-push-action@v6`, multi-arch off (linux/amd64 only — the VPS is x86_64), GHA cache for layers, push to `ghcr.io/greatuzumaki/pokermap-{web,admin,api}:<git-sha>` and `:latest`. Then SSH (via `appleboy/ssh-action@v1`) into the VPS as `deploy@31.130.135.220`, run `cd /srv/projects/poker && docker compose pull && docker compose up -d --no-deps web admin api`. After `up`, poll `/healthz` on each container with a 60 s timeout. If any healthcheck fails, run `docker compose rollback` (image tag pinned to previous `:<git-sha>` stored in `.last-good`).

**Rationale:** GHCR is free, integrated with the repo, supports pull from VPS with a PAT. Building in CI means the VPS does no compile work — important on a 4 GB box. SSH + compose is the simplest production-grade deploy mechanism that exists, and `compose pull && up` is atomic per service. `:<git-sha>` tags give deterministic rollback.

**Alternatives:**

- *Build on VPS via rsync + `docker build`* — uses VPS CPU/RAM during deploy (bad on small box), and turns the deploy time into "however long Next.js takes to build."
- *Watchtower auto-pull* — loses atomicity across web/admin/api and gives no control over deploy ordering or health gates.
- *Self-hosted runner on VPS* — defeats the point of isolating build from runtime.

### D4: Data isolation — one Postgres DB + role per project, one Redis logical DB per project

**Choice:**

- Postgres: a single `postgres:17-alpine` container in the platform stack, with a `init.sh` that on first start creates the platform `postgres` superuser. Per-project provisioning is done by `new-project.sh` via `psql`: `CREATE ROLE <name> WITH LOGIN PASSWORD '<random>'; CREATE DATABASE <name> OWNER <name>;`. Connection string handed to the project: `postgres://<name>:<pw>@postgres:5432/<name>` (on the shared `data` Docker network, not exposed to the public).
- Redis: a single `redis:7-alpine`. Each project gets an assigned logical DB number (0–15) recorded in `/srv/platform/registry.json`. Connection string: `redis://redis:6379/<n>`. If we run out of the 16 logical DBs we add a second Redis instance — unlikely for pet projects but documented.
- No project container can reach the data services on the host network; they're only reachable on the internal `data` Docker network that platform services + project services share.

**Rationale:** Per-project role+DB is the standard, well-understood Postgres multitenancy boundary. SQL-layer isolation means a compromised project app cannot read another project's data. Reusing one Postgres process saves ~150 MB RAM per avoided instance — meaningful at this VPS size. Redis logical DBs are weaker isolation (no auth per DB) but acceptable for cache use; we mandate per-project key prefixes as defense in depth.

**Alternatives:**

- *Per-project Postgres container* — strongest isolation but ~150 MB RAM each and 16 GB+ disk overhead at scale. Overkill for pet projects.
- *Schema-per-project in a single DB* — slightly cheaper but harder to back up/restore independently and risk of cross-schema queries by mistake.

### D5: Secrets — GitHub Actions Secrets + per-project `.env` materialized on VPS

**Choice:** Each project repo's GH secrets include `VPS_SSH_KEY`, `VPS_SSH_HOST`, `VPS_SSH_USER`, plus the app's runtime secrets (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, etc.). On deploy, the workflow `scp`s a generated `.env` file (or writes via heredoc over SSH) to `/srv/projects/<name>/.env` with `chmod 600`, then `docker compose up` reads it. The `.env` is never committed.

**Rationale:** Simplest mechanism that keeps secrets out of git and out of image layers. Docker Compose's native `env_file` support means no app-level changes. Rotation is "update GH secret, re-run deploy."

**Alternatives:**

- *Vault / Infisical / Doppler* — overkill for a solo pet-projects VPS; another moving part to keep alive.
- *Bake secrets into image at build time* — leaks secrets into image layers and registry.

### D6: SSH hardening — `deploy` user, key-only auth, root login disabled

**Choice:** `bootstrap.sh` performs (in order, on a fresh VPS) using the *current* root password (one time only):

1. `apt update && apt upgrade -y`
2. Install `docker-ce`, `docker-compose-plugin`, `ufw`, `fail2ban`, `unattended-upgrades`.
3. Create user `deploy`, add to `docker` group.
4. Add the user-provided GitHub-Actions public key to `/home/deploy/.ssh/authorized_keys`.
5. Add the operator's personal public key to `/home/deploy/.ssh/authorized_keys` AND to `/root/.ssh/authorized_keys` (so the operator retains an emergency root path via key auth even after passwords are disabled).
6. Edit `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`, `AllowUsers deploy root`.
7. UFW: allow 22, 80, 443. Deny all else inbound.
8. Restart `ssh` — verify deploy-user login from a second session before invalidating the password session.
9. (Operator manually rotates root password to a long random string and stores in password manager — bootstrap prints a reminder.)

**Rationale:** Industry-standard SSH hardening, ordered so we never lock ourselves out (verify new auth before disabling old). Keeping a key-auth root path avoids the "I broke sudo, now I'm locked out" scenario.

### D7: Path-prefix routing inside the apps

**Choice:**

- Next.js (`web`, `admin`): set `basePath` and `assetPrefix` in `next.config.*` from `process.env.BASE_PATH ?? ''`. Local dev keeps empty; prod CI sets `BASE_PATH=/poker` (and `/poker/admin` for admin).
- Go API: do **not** bake `/poker` into routes. Instead, Traefik strips the prefix with the `StripPrefix` middleware so the Go code sees the same routes locally (`/clubs`) and in prod (`/clubs`). Health endpoint `/healthz` lives at the un-stripped root for Traefik's healthcheck.

**Rationale:** Path-prefix should be a deployment concern, not an application concern. The API stays portable; only the frontend needs `basePath` because Next.js generates absolute asset URLs at build time and the prefix has to be known then. Setting it via env at build time in CI is clean.

### D8: Per-project compose layout

**Choice:**

```
/srv/
├── platform/
│   ├── docker-compose.yml          # traefik, postgres, redis, postgres-backup
│   ├── traefik/
│   │   ├── traefik.yml             # static config
│   │   └── acme.json               # 600, LE cert storage
│   ├── postgres/init.sh
│   └── .env                        # platform-wide secrets
├── projects/
│   └── poker/
│       ├── docker-compose.yml      # web, admin, api with traefik labels
│       └── .env                    # poker-only secrets, deploy-managed
└── backups/postgres/<db>/<date>.sql.gz
```

Project compose joins two external networks: `proxy` (to be seen by Traefik) and `data` (to reach postgres/redis). Each network is created once by the platform stack.

### D9: Healthcheck + rollback

**Choice:** Each app image declares an `HEALTHCHECK` in its Dockerfile (`/healthz` for api, `/poker/api/healthz` proxied for web/admin). Compose `depends_on: { service: { condition: service_healthy } }` for any cross-service dep. The deploy script after `up -d`:

```bash
for svc in web admin api; do
  for i in {1..30}; do
    state=$(docker inspect --format='{{.State.Health.Status}}' poker-$svc)
    [ "$state" = "healthy" ] && break
    sleep 2
  done
  [ "$state" = "healthy" ] || { rollback; exit 1; }
done
echo "$NEW_SHA" > /srv/projects/poker/.last-good
```

Rollback re-tags `:latest` back to the previous `.last-good` SHA and `compose up -d` again.

## Risks / Trade-offs

- **Single point of failure (one VPS).** → Mitigated by nightly Postgres dumps and a documented restore on a fresh box. Not mitigated by HA (out of scope).
- **Sharing Postgres across projects means a runaway query in one project can starve another.** → Mitigated by `statement_timeout` set per role and by `pg_top`-style observability when needed. Add per-role connection limits when a second project lands.
- **Path-prefix routing in Next.js is fragile.** Asset URLs, API routes, and client-side `Link`s all need to honor `basePath`. → Mitigated by setting `basePath` once in `next.config` and using `next/link` everywhere (no hand-rolled `<a href="/...">`). CI builds the prod image with `BASE_PATH=/poker` baked in so dev-vs-prod drift is caught at build time.
- **Traefik HTTP-01 challenge requires port 80 reachable.** → Mitigated by UFW rule and bootstrap verification step that curls `http://pargach.ru/.well-known/acme-challenge/test`.
- **Compromised root password.** → Mitigated by bootstrap rotating to key-only auth on first run; **the user must rotate the leaked password before any other use of the VPS**.
- **GHCR rate limits for anonymous pulls** if repo goes public later. → Mitigated by always authenticating the VPS `docker login ghcr.io` with a PAT.
- **`docker compose pull && up` is not atomic across services.** A web-only deploy could land while api is still old. → Mitigated by deploying all three services in one `up` invocation and only flipping `.last-good` after all health-pass; acceptable for a solo project.

## Migration Plan

This is greenfield (no existing prod). Steps:

1. **DNS prep (user action, outside CI):** add wildcard `A *.pargach.ru → 31.130.135.220`. Verify `dig +short api.pargach.ru` returns the VPS IP.
2. **Local prep (operator):** generate an SSH keypair `~/.ssh/pokermap_deploy` for GitHub Actions, save the public key.
3. **Bootstrap VPS (one-time):** copy `infra/vps/bootstrap.sh` to the VPS via the current root password session, run it. Bootstrap prompts for the operator public key and the GH Actions public key. Verify deploy-user login. **Rotate root password manually now.**
4. **Provision PokerMap on VPS:** `new-project.sh poker` → prints `DATABASE_URL` and `REDIS_URL` for poker.
5. **Add GH secrets in `greatUzumaki/PokerMap`:** `VPS_SSH_HOST=31.130.135.220`, `VPS_SSH_USER=deploy`, `VPS_SSH_KEY=<private key>`, `DATABASE_URL`, `REDIS_URL`, app secrets.
6. **Land workflows + Dockerfile updates + Next.js basePath:** PR, CI green, merge → first deploy runs.
7. **Verify:** `curl -I https://pargach.ru/poker` returns 200, `curl https://api.pargach.ru/poker/healthz` returns 200, TLS cert valid.

**Rollback path:** If first deploy fails, `docker compose down` on VPS leaves the platform stack running serving 502. Fix forward by reverting the merge commit; CI re-deploys the previous `main`. Postgres data persists in the named volume regardless.

## Open Questions

- **VPS specs?** Not yet inspected. RAM/CPU/disk determine Postgres `shared_buffers`, Redis `maxmemory`, and how aggressively we tune. Default to "assume 4 GB / 2 vCPU / 40 GB SSD"; revisit after SSH-in.
- **OS version?** Bootstrap script targets Ubuntu 22.04/24.04 and Debian 12. Need to confirm during the first SSH.
- **Existing services on the VPS?** Ports 80/443/5432/6379 must be free. If anything is already bound, the bootstrap script halts and asks.
- **Should `admin` panel be behind an additional auth layer at Traefik (basic auth / IP allow-list)?** Default in v1: no — relies on app-level auth. Worth revisiting once admin lands users.
