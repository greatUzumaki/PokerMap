# vps-platform Specification

## Purpose
TBD - created by archiving change vps-cicd-shared-infra. Update Purpose after archive.
## Requirements
### Requirement: Single-entry reverse proxy with automated TLS

The VPS SHALL run exactly one reverse proxy (Traefik v3) bound to ports 80 and 443 on the host, terminating TLS for `pargach.ru` and any `*.pargach.ru` subdomain. Certificates SHALL be issued and renewed automatically via Let's Encrypt HTTP-01 challenge. No other process MAY bind ports 80, 443, or 5432/6379 on the host.

#### Scenario: First-time certificate issuance

- **WHEN** the platform stack starts on a fresh VPS with DNS pointing at it and ports 80/443 reachable from the public internet
- **THEN** Traefik obtains valid Let's Encrypt certificates for `pargach.ru` and any `Host()` rule declared by a routed container
- **AND** `curl -I https://pargach.ru` returns a TLS handshake with a non-staging certificate

#### Scenario: HTTP→HTTPS redirect

- **WHEN** a client requests `http://pargach.ru/anything`
- **THEN** Traefik responds with `301` to `https://pargach.ru/anything`

#### Scenario: Certificate auto-renewal

- **WHEN** a stored certificate is within 30 days of expiry
- **THEN** Traefik renews it without operator intervention and without dropping in-flight connections

### Requirement: Project routing via Docker labels

Each project container SHALL declare its public routes through Traefik labels in its own `docker-compose.yml`. The platform Traefik configuration SHALL NOT contain any project-specific routes or hostnames. Adding or removing a project SHALL require zero edits to the platform stack.

#### Scenario: New project drops in

- **WHEN** the operator scaffolds a new project at `/srv/projects/<name>/` whose compose declares `traefik.http.routers.<name>.rule=Host(`pargach.ru`) && PathPrefix(`/<name>`)` and joins the `proxy` network
- **AND** the operator runs `docker compose up -d` from `/srv/projects/<name>/`
- **THEN** the route is live within 10 seconds with TLS, without restarting Traefik or any other project

#### Scenario: Route priority for nested paths

- **WHEN** project `poker` exposes `/poker` (web) and `/poker/admin` (admin)
- **THEN** requests to `/poker/admin/*` resolve to the admin container, not the web container
- **AND** path priority is achieved by Traefik router `priority` labels or by rule specificity, not by URL ordering

### Requirement: Filesystem layout under `/srv`

The VPS SHALL use the following directory layout, owned by the `deploy` user and group:

- `/srv/platform/` — platform stack (Traefik, Postgres, Redis, backup sidecar) and its config.
- `/srv/projects/<name>/` — one directory per deployed project, each containing a `docker-compose.yml` and `.env`.
- `/srv/backups/` — backup output target.

The platform stack SHALL provide two external Docker networks named `proxy` and `data` that project compose files join.

#### Scenario: Project directory bootstrap

- **WHEN** `new-project.sh <name>` is executed
- **THEN** `/srv/projects/<name>/` is created with mode `0750`, owner `deploy:deploy`
- **AND** a starter `docker-compose.yml` is written containing `networks: [proxy, data]` and a `.env` template with the project's `DATABASE_URL` and `REDIS_URL` filled in

#### Scenario: Shared networks exist

- **WHEN** the platform stack is running
- **THEN** `docker network ls` shows networks `proxy` and `data`, both with `external: false` ownership from the platform compose project
- **AND** any project compose that declares them as `external: true` can join without error

### Requirement: Hardened host SSH access

The VPS SHALL accept SSH connections only via public-key authentication. Password authentication SHALL be disabled in `sshd_config`. A non-root user `deploy` SHALL exist, belong to the `docker` group, and be the only user that CI deploys are permitted to log in as. Root login SHALL be restricted to `prohibit-password` (key-only) and SHALL be reserved for operator emergency access.

#### Scenario: Password login refused

- **WHEN** any SSH client attempts `ssh root@<vps>` or `ssh deploy@<vps>` with a password
- **THEN** the server denies the attempt with `Permission denied (publickey)`

#### Scenario: Deploy user has docker permission without sudo

- **WHEN** the GitHub Actions deploy job SSHes in as `deploy` and runs `docker compose pull && docker compose up -d`
- **THEN** the commands succeed without `sudo` or password prompts

### Requirement: Idempotent bootstrap script

The repository SHALL contain `infra/vps/bootstrap.sh` that brings a fresh Debian 12 or Ubuntu 22.04+ VPS to the state required by the other requirements in this capability. The script SHALL be safe to re-run; re-running on an already-bootstrapped VPS SHALL make no changes and SHALL exit 0.

#### Scenario: Fresh-VPS first run

- **WHEN** the script is executed on a VPS with only base packages installed
- **THEN** it installs Docker Engine, the Compose plugin, UFW, fail2ban, and unattended-upgrades
- **AND** it creates the `deploy` user, installs the two provided public keys (operator + CI), and hardens `sshd_config`
- **AND** it creates `/srv/platform`, `/srv/projects`, `/srv/backups` with correct ownership
- **AND** it pulls and starts the platform stack
- **AND** the script exits 0 with a printed summary of next steps

#### Scenario: Re-run is a no-op

- **WHEN** the script is executed a second time on the same VPS
- **THEN** no package is reinstalled, no user is recreated, no SSH session is dropped
- **AND** the script exits 0 with output "VPS already bootstrapped; nothing to do."

### Requirement: New-project generator

The repository SHALL contain `infra/vps/new-project.sh` that, given a kebab-case project name, provisions the per-project resources needed to host a new project on the platform: a Postgres database and role, a Redis logical-DB allocation, and a starter `/srv/projects/<name>/` directory. The script SHALL refuse to overwrite an existing project and SHALL print the connection strings as its only stdout output suitable for piping to a secret store.

#### Scenario: Provision a new project

- **WHEN** the operator runs `new-project.sh shopcat` on a bootstrapped VPS
- **THEN** Postgres has a database `shopcat` owned by role `shopcat` with a freshly generated 32-character password
- **AND** Redis logical DB number `N` is reserved for `shopcat` in `/srv/platform/registry.json`
- **AND** `/srv/projects/shopcat/` is created with a starter compose and `.env` containing `DATABASE_URL=postgres://shopcat:<pw>@postgres:5432/shopcat` and `REDIS_URL=redis://redis:6379/N`
- **AND** stdout contains exactly the two connection strings (one per line) so they can be captured into GitHub secrets

#### Scenario: Duplicate name rejected

- **WHEN** `new-project.sh shopcat` is run a second time
- **THEN** the script exits non-zero with stderr "project 'shopcat' already exists; refusing to clobber"

### Requirement: Firewall posture

The VPS SHALL run UFW with default-deny inbound. Only ports 22 (ssh), 80 (http), and 443 (https) SHALL be open to the public internet. Postgres (5432) and Redis (6379) SHALL NOT be exposed on the public interface and SHALL only be reachable on the internal `data` Docker network.

#### Scenario: Postgres unreachable from public

- **WHEN** an attacker port-scans `pargach.ru:5432` from the public internet
- **THEN** the connection is dropped or refused at the firewall before reaching any service

