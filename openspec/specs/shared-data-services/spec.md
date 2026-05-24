# shared-data-services Specification

## Purpose
TBD - created by archiving change vps-cicd-shared-infra. Update Purpose after archive.
## Requirements
### Requirement: Single shared Postgres 17 instance

The VPS SHALL run exactly one Postgres 17 (alpine) container as part of the platform stack, serving all hosted projects. The container SHALL persist data to a named Docker volume `platform_postgres_data` and SHALL be attached only to the internal `data` Docker network — never to the public host network. Each hosted project SHALL have its own Postgres database and its own login role, owned by that role, with a per-project password stored in the platform's password manifest at `/srv/platform/registry.json` (mode 0600).

#### Scenario: Per-project isolation

- **WHEN** project `alpha` connects with `postgres://alpha:<pw>@postgres:5432/alpha` and runs `SELECT datname FROM pg_database`
- **THEN** the role can connect to its own database `alpha` and CANNOT log into another project's database (e.g. `beta`) with the same password
- **AND** `\du alpha` shows no superuser, createrole, or createdb privileges

#### Scenario: Persistence across restarts

- **WHEN** the platform stack is restarted via `docker compose down && docker compose up -d`
- **THEN** all project data from before the restart is intact
- **AND** all per-project roles still authenticate with their existing passwords

#### Scenario: Public network isolation

- **WHEN** an external client attempts to connect to `pargach.ru:5432`
- **THEN** the connection fails because port 5432 is not exposed on the host

### Requirement: Single shared Redis 7 instance with per-project logical DB

The VPS SHALL run exactly one Redis 7 (alpine) container as part of the platform stack, with AOF persistence enabled, `maxmemory 512mb`, and `maxmemory-policy allkeys-lru`. Each hosted project SHALL be allocated a unique Redis logical database number (0–15) recorded in `/srv/platform/registry.json`. Projects SHALL use a per-project key prefix as defense-in-depth even though logical DBs separate keyspaces.

#### Scenario: Logical DB allocation persists

- **WHEN** `new-project.sh alpha` allocates logical DB 3 to project `alpha`
- **THEN** `/srv/platform/registry.json` records the assignment
- **AND** a subsequent `new-project.sh beta` allocates the next free number (4) and never reuses 3 even after `alpha` is deleted, until manual reclamation

#### Scenario: Memory eviction on cache pressure

- **WHEN** Redis memory exceeds 512 MB
- **THEN** the allkeys-lru policy evicts least-recently-used keys instead of OOM-killing the container

### Requirement: Nightly Postgres backups

The platform stack SHALL include a backup sidecar (`prodrigestivill/postgres-backup-local` or equivalent) that runs daily at 03:00 VPS-local time and writes a per-database gzipped SQL dump to `/srv/backups/postgres/<dbname>/<date>.sql.gz`. The backup sidecar SHALL retain at least 7 daily, 4 weekly, and 3 monthly snapshots per database. The backup directory SHALL be readable only by `deploy:deploy`.

#### Scenario: Daily backup is produced

- **WHEN** 24 hours have passed since the platform stack started
- **THEN** `/srv/backups/postgres/<dbname>/` contains exactly one new dated `.sql.gz` file per project database
- **AND** the file is a valid gzip stream containing a parseable `pg_dump` output (verified by `gunzip -t` and `head` showing `-- PostgreSQL database dump`)

#### Scenario: Retention enforced

- **WHEN** a backup runs and brings the daily-snapshot count above 7
- **THEN** the oldest daily snapshot is deleted to keep the count at 7
- **AND** weekly and monthly slots are populated from appropriate daily snapshots on Sundays and on the 1st of the month

### Requirement: Documented restore procedure

The repository SHALL contain a `infra/vps/restore.md` (or executable `restore.sh`) describing the procedure to restore a project database from a backup snapshot to either the same VPS or a fresh VPS. The procedure SHALL be tested by the operator during initial rollout (recorded in `tasks.md`).

#### Scenario: Restore on fresh VPS

- **WHEN** an operator follows `restore.md` on a freshly bootstrapped VPS, providing a snapshot file and the target project name
- **THEN** the target project's Postgres database is recreated and populated with the snapshot contents
- **AND** the existing role password from `registry.json` is preserved so the project's `DATABASE_URL` continues to work without code changes

### Requirement: Connection-string convention

Project applications SHALL receive their data-service endpoints exclusively via environment variables `DATABASE_URL` and `REDIS_URL`. Hostnames in those URLs SHALL be the internal Docker network names (`postgres`, `redis`) — never `localhost`, `127.0.0.1`, or the public IP. Application code SHALL NOT hardcode any data-service hostname, port, or credential.

#### Scenario: App reads URLs from environment

- **WHEN** the PokerMap api container starts with `DATABASE_URL=postgres://poker:...@postgres:5432/poker` and `REDIS_URL=redis://redis:6379/0`
- **THEN** the api connects successfully to both services on the `data` network
- **AND** `grep -RIn "postgres:5432\|redis:6379" apps/api/` returns no hardcoded matches outside of test fixtures and documentation

### Requirement: Resource limits sized for a small VPS

Postgres and Redis containers SHALL declare `mem_limit` and `cpus` in the platform compose so that a runaway query or cache fill in one project cannot exhaust host resources. Recommended starting limits: Postgres `mem_limit: 1g`, `cpus: 1.0`; Redis `mem_limit: 512m`, `cpus: 0.5`. Postgres SHALL set `statement_timeout = 30s` and `idle_in_transaction_session_timeout = 60s` per project role by default.

#### Scenario: Runaway query is terminated

- **WHEN** a project app runs a query that exceeds `statement_timeout`
- **THEN** Postgres cancels the query and returns an error to the app
- **AND** other projects' queries are unaffected

