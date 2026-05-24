## ADDED Requirements

### Requirement: Local and production wire-compatibility

The local `docker-compose.yml` at repo root SHALL use service names, env var names, port assignments, and credential conventions that match the production VPS platform stack defined in the `shared-data-services` capability, so application code is byte-identical between local and production. Specifically:

- Postgres service is named `postgres` and reachable from app containers at `postgres:5432`.
- Redis service is named `redis` and reachable at `redis:6379`.
- The default database name and role for PokerMap SHALL be `poker` (matching the production project name) — NOT `pokermap` — so local `DATABASE_URL` matches production format `postgres://poker:<pw>@postgres:5432/poker`.
- The default Redis logical DB for PokerMap SHALL be `0` and the local `REDIS_URL` SHALL include the `/0` suffix.
- Applications SHALL read `DATABASE_URL` and `REDIS_URL` from `.env` and SHALL NOT depend on any other connection-related env var (no separate `POSTGRES_HOST`, `POSTGRES_PORT`, etc.).

#### Scenario: Local URL matches production format

- **WHEN** a developer copies `.env.example` to `.env` and runs `pnpm dev`
- **THEN** the api connects using `DATABASE_URL=postgres://poker:poker@postgres:5432/poker` (same shape as production, only credentials and host-IP-vs-container-name differ)
- **AND** switching a checkout from local to a production-credentials `.env` requires no source-code change

#### Scenario: No hardcoded local-only hostnames

- **WHEN** `grep -RIn "localhost\|127\.0\.0\.1" apps/` is run
- **THEN** results appear only in test fixtures, dev-server config, or comments — never in production connection logic

### Requirement: Local stack stays single-tenant

The local `docker-compose.yml` SHALL remain single-tenant (one project, one DB, one Redis logical DB). The multi-tenant provisioning machinery (`new-project.sh`, `registry.json`, per-role passwords) belongs to the production VPS platform and SHALL NOT be replicated locally. Local credentials SHALL remain weak/predictable (`poker:poker`) for developer convenience and SHALL never be reused as production secrets.

#### Scenario: Local credentials are not production-grade

- **WHEN** a developer reads `.env.example`
- **THEN** the password is the literal string `poker` (or similarly trivial)
- **AND** a comment in `.env.example` warns "DO NOT use these values in production; production secrets are managed via GitHub Actions secrets and `new-project.sh`"
