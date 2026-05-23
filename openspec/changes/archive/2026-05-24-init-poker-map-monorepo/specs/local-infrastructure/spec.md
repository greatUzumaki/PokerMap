## ADDED Requirements

### Requirement: Docker Compose definition for local dependencies
The repository SHALL include a `docker-compose.yml` at the root that defines a `postgres` service (Postgres 17, persistent volume, healthcheck) and a `minio` service (latest stable MinIO with console enabled, persistent volume, healthcheck). The file SHALL NOT be started by the bootstrap process because the user already runs these services elsewhere; the file is reference + portability.

#### Scenario: User chooses to run compose
- **WHEN** a contributor without existing services runs `docker compose up -d` from the repo root
- **THEN** Postgres becomes reachable at `localhost:5432` with credentials matching `.env`, and MinIO becomes reachable at `localhost:9000` (S3 API) and `localhost:9001` (console) with credentials matching `.env`

#### Scenario: Existing services compatible
- **WHEN** the user already runs Postgres and MinIO via their own docker-compose
- **THEN** the documented ports, credentials, and bucket names in this repo's `.env.example` match defaults the user can apply to their existing setup without modification

### Requirement: Environment files with working local defaults
The repository SHALL ship `apps/web/.env.local` and `apps/api/.env` (gitignored) plus committed `.env.example` files. Defaults SHALL be production-safe placeholders or working local values. Secrets (Telegram bot token, JWT secret) SHALL be obvious placeholders the user must replace before deploying.

#### Scenario: Local dev runs with defaults
- **WHEN** the user runs `pnpm dev` and `make api-dev` immediately after clone, with their existing Postgres + MinIO running on documented ports
- **THEN** both apps start without env errors and connect to the local infrastructure

#### Scenario: Placeholders flagged at startup
- **WHEN** the Go API starts with `JWT_SECRET` or `TELEGRAM_BOT_TOKEN` set to a recognized placeholder value
- **THEN** the API logs a warning at startup naming the missing secret and degrades admin/auth endpoints to return 503

### Requirement: Bootstrap documentation
The repository SHALL contain a top-level `README.md` describing prerequisites (Node 22+, pnpm 9+, Go 1.23+, Docker, golang-migrate, sqlc), the bootstrap sequence, and how to bypass `docker-compose up` when running services externally.

#### Scenario: New contributor follows README
- **WHEN** a new contributor reads the README from top to bottom and follows the steps
- **THEN** they reach a running local dev environment without external help
