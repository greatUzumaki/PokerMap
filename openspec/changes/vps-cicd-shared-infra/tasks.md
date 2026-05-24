## 1. Pre-flight (operator, before any code)

- [ ] 1.1 Rotate the leaked root password on `31.130.135.220` to a long random string stored in a password manager
- [ ] 1.2 Generate an SSH keypair `~/.ssh/pargach_ops_ed25519` for operator emergency access; copy public key to a safe place
- [ ] 1.3 Generate a second SSH keypair `pargach_gha_deploy_ed25519` for GitHub Actions; save the private key — it will become the `VPS_SSH_KEY` repo secret
- [ ] 1.4 In the DNS provider for `pargach.ru`, verify `A pargach.ru → 31.130.135.220` and add wildcard `A *.pargach.ru → 31.130.135.220` (TTL 300). Verify with `dig +short api.pargach.ru` and `dig +short anything.pargach.ru`
- [ ] 1.5 SSH into the VPS as root (last time with password) and capture `lsb_release -a`, `free -h`, `df -h /`, `nproc`, `ss -lntp` so we know OS, RAM, disk, CPU count, and any pre-bound ports — paste output back into this task for the record

## 2. Repository scaffolding (PokerMap monorepo)

- [ ] 2.1 Create `infra/vps/` directory in the repo
- [ ] 2.2 Add `infra/vps/README.md` describing the platform layout, how to run bootstrap, and how to add a new project
- [ ] 2.3 Add `infra/vps/platform/docker-compose.yml` defining services: `traefik`, `postgres`, `redis`, `postgres-backup`. Declare external networks `proxy` and `data`. Add `mem_limit`/`cpus` per Decision D4 and D8
- [ ] 2.4 Add `infra/vps/platform/traefik/traefik.yml` (static config: entrypoints :80 →:443 redirect, :443 with TLS, Docker provider with `exposedByDefault: false`, Let's Encrypt HTTP-01 resolver, file log + access log)
- [ ] 2.5 Add `infra/vps/platform/traefik/dynamic.yml` for any shared middlewares (HSTS, gzip, error-pages)
- [ ] 2.6 Add `infra/vps/platform/postgres/init.sql` that sets `statement_timeout` and `idle_in_transaction_session_timeout` defaults at the cluster level
- [ ] 2.7 Add `infra/vps/platform/.env.example` with the platform-stack secrets (Postgres superuser password, Traefik basic-auth for dashboard, ACME email)
- [ ] 2.8 Add `infra/vps/bootstrap.sh` per Decision D6 — idempotent, prompts for two public keys, hardens SSH, installs Docker, creates `/srv` dirs, starts platform stack
- [ ] 2.9 Add `infra/vps/new-project.sh` per Decision D8 — provisions Postgres role+DB, allocates Redis logical DB in `/srv/platform/registry.json`, scaffolds `/srv/projects/<name>/`, prints connection strings on stdout (and nothing else)
- [ ] 2.10 Add `infra/vps/restore.md` documenting backup restore procedure for the `shared-data-services` capability
- [ ] 2.11 Add `infra/vps/projects/poker/docker-compose.yml.template` — the production compose for the PokerMap project (web/admin/api with Traefik labels per Decision D2, joined to `proxy` and `data` networks, healthchecks, image references to GHCR)

## 3. Application changes for path-prefix routing

- [ ] 3.1 `apps/web/next.config.ts`: add `basePath: process.env.BASE_PATH ?? ''` and `assetPrefix: process.env.BASE_PATH ?? undefined`
- [ ] 3.2 `apps/admin/next.config.ts`: add `basePath: process.env.BASE_PATH ?? ''` (production value `/poker/admin`) and `assetPrefix`
- [ ] 3.3 Audit all `apps/web/**/*.tsx` and `apps/admin/**/*.tsx` for hardcoded `href="/..."` / `<img src="/...">` / `fetch("/api/...")` outside of `next/link` and `next/image`; replace with `next/link` + relative paths, or read `process.env.NEXT_PUBLIC_BASE_PATH` where unavoidable
- [ ] 3.4 `apps/web` and `apps/admin`: introduce `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8080` locally, `https://api.pargach.ru/poker` in prod) and route all client-side API calls through a single `lib/api/client.ts` that prepends it
- [ ] 3.5 `apps/api`: add `/healthz` endpoint returning 200 with JSON `{status: "ok", commit: <build-time SHA>, time: <ISO now>}`
- [ ] 3.6 `apps/api`: ensure routes are mounted at the root (no `/poker` prefix in code) — Traefik strips the prefix in prod; document in `apps/api/README.md`
- [ ] 3.7 `apps/api`: configure CORS allow-list from env `CORS_ALLOWED_ORIGINS` (default empty → deny; prod value `https://pargach.ru`)
- [ ] 3.8 `apps/*/Dockerfile`: add multi-stage build, declare `HEALTHCHECK CMD curl -fsS http://localhost:<port>/healthz`, accept `BASE_PATH` build arg for the two Next.js apps, target `linux/amd64`, run as non-root user
- [ ] 3.9 Local `docker-compose.yml`: align with the `local-infrastructure` spec — rename DB/user/role from `pokermap` to `poker`, ensure `REDIS_URL` includes `/0`, update `.env.example` accordingly and add the "DO NOT use in production" comment

## 4. GitHub Actions workflows

- [ ] 4.1 Add `.github/workflows/ci.yml`: triggers on PR + push to `main`; jobs: `install` (pnpm + turbo cache restore), `lint`, `typecheck`, `test-node`, `test-go`. Use `actions/setup-node@v4` with `node: 24` (matches `.nvmrc`), `pnpm/action-setup@v4`, `actions/setup-go@v5`
- [ ] 4.2 Add `.github/workflows/deploy.yml`: triggers on push to `main`; `needs: ci` (waits for ci success via reusable workflow or `workflow_run`); jobs: `build-and-push` (matrix over web/admin/api, uses `docker/build-push-action@v6` with `cache-from: type=gha` / `cache-to: type=gha,mode=max`, builds `linux/amd64` only, tags `:<sha>` and `:latest`), then `deploy` (uses `appleboy/ssh-action@v1`)
- [ ] 4.3 In `deploy.yml`, the `deploy` job: validates required secrets up front; SCPs a generated `.env` to `/srv/projects/poker/.env` (mode 0600 via remote `install -m 600`); SSHes and runs `docker login ghcr.io`, `docker compose -f docker-compose.yml pull`, `docker compose up -d --remove-orphans`; then polls each container's `Health.Status` for up to 60 s; on failure repins to `.last-good` SHA and re-ups
- [ ] 4.4 `deploy.yml` appends an audit row to `/srv/projects/poker/deploys.log` per the `ci-cd-pipeline` spec
- [ ] 4.5 Add `.github/dependabot.yml` for weekly bumps of GH Actions, pnpm deps, Go modules, and Docker base images
- [ ] 4.6 Add branch protection to `main`: require `ci.yml` checks to pass, require PR review, no direct pushes — document the GitHub UI steps in `infra/vps/README.md`

## 5. VPS bootstrap (operator, one-time)

- [ ] 5.1 `scp infra/vps/bootstrap.sh root@31.130.135.220:/tmp/`
- [ ] 5.2 SSH as root, run `bash /tmp/bootstrap.sh`, paste the operator public key and the GH Actions public key when prompted
- [ ] 5.3 Open a SECOND terminal and verify `ssh -i ~/.ssh/pargach_ops_ed25519 deploy@31.130.135.220` works WITHOUT a password before closing the first session
- [ ] 5.4 On the VPS as `deploy`: verify `docker ps` shows `traefik`, `postgres`, `redis`, `postgres-backup` all `Up (healthy)`
- [ ] 5.5 Verify `curl -I http://pargach.ru` returns `301 → https://`; verify `curl -I https://pargach.ru` returns a non-staging Let's Encrypt cert
- [ ] 5.6 Open Traefik dashboard via SSH tunnel (`ssh -L 8080:localhost:8080 deploy@...`), confirm no project routers yet

## 6. Provision PokerMap on the VPS

- [ ] 6.1 SSH as `deploy`, run `sudo /srv/platform/scripts/new-project.sh poker`; capture the printed `DATABASE_URL` and `REDIS_URL`
- [ ] 6.2 `scp infra/vps/projects/poker/docker-compose.yml.template deploy@...:/srv/projects/poker/docker-compose.yml` (templating done by `deploy.yml`, so this is the initial copy)
- [ ] 6.3 In the GitHub repo Settings → Secrets and variables → Actions, add: `VPS_SSH_HOST`, `VPS_SSH_USER=deploy`, `VPS_SSH_KEY` (private key from 1.3), `VPS_SSH_PORT=22`, `GHCR_TOKEN` (PAT with `read:packages,write:packages`), `DATABASE_URL`, `REDIS_URL`, plus app secrets (`JWT_SECRET`, `MAPTILER_KEY`, etc. — enumerate from `apps/api/.env.example`)
- [ ] 6.4 On the VPS as `deploy`, run `docker login ghcr.io -u <github-user> -p <PAT>` once interactively so subsequent CI deploys can pull (alternative: stash credentials in `~/.docker/config.json` via the deploy job)

## 7. First deploy

- [ ] 7.1 Merge the branch implementing all `infra/vps/` + `.github/workflows/` + app changes into `main`
- [ ] 7.2 Watch the `deploy.yml` run end-to-end; confirm GHCR shows three new images at the merge SHA
- [ ] 7.3 Verify `curl -I https://pargach.ru/poker` returns 200, `curl https://pargach.ru/poker/admin` returns 200, `curl https://api.pargach.ru/poker/healthz` returns 200 with the deployed SHA
- [ ] 7.4 Open `https://pargach.ru/poker` in a browser; confirm map loads, assets load (no 404 on `/poker/_next/...`), and a sample club detail opens
- [ ] 7.5 `cat /srv/projects/poker/.last-good` on the VPS — must equal the deployed git SHA
- [ ] 7.6 `cat /srv/projects/poker/deploys.log` — confirm a row with `ok`

## 8. Backup and restore verification

- [ ] 8.1 Wait until 03:00 VPS-local (or trigger the backup container manually) and confirm `/srv/backups/postgres/poker/<date>.sql.gz` exists and `gunzip -t` passes
- [ ] 8.2 On a throwaway directory on the VPS, run the restore procedure from `infra/vps/restore.md` against a temporary database `poker_restore_test`; verify row counts match the live `poker` DB
- [ ] 8.3 Drop the test database; record the successful restore in `deploys.log` or a separate `ops-log.md`

## 9. Documentation

- [ ] 9.1 Update root `README.md` with a "Deployment" section linking to `infra/vps/README.md`
- [ ] 9.2 In `infra/vps/README.md` document: bootstrap steps, the `new-project.sh` workflow, how to add Traefik labels to a project compose, how to rotate secrets, how to restore from backup, how to read `deploys.log`
- [ ] 9.3 In `apps/api/README.md` note that the production prefix `/poker` is stripped at the edge and the API code must remain prefix-unaware
- [ ] 9.4 Add a single-page `infra/vps/RUNBOOK.md` covering: "deploy stuck", "TLS cert not renewing", "Postgres OOM", "rollback manually", "rotate VPS password"

## 10. Hardening follow-ups (do during this change, not later)

- [ ] 10.1 Verify UFW: `ufw status` shows only 22, 80, 443 allowed
- [ ] 10.2 Verify fail2ban active and `sshd` jail enabled: `fail2ban-client status sshd`
- [ ] 10.3 Verify `unattended-upgrades` enabled for security updates only
- [ ] 10.4 Confirm root-password login is impossible: from a separate machine, `ssh -o PreferredAuthentications=password root@31.130.135.220` must fail with "Permission denied"
- [ ] 10.5 Add a `pre-commit` or CI grep that fails the build if `.env`, `.env.production`, or any `*key*.pem` is staged for commit
