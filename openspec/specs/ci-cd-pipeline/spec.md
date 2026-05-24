# ci-cd-pipeline Specification

## Purpose
TBD - created by archiving change vps-cicd-shared-infra. Update Purpose after archive.
## Requirements
### Requirement: PR validation pipeline

The repository SHALL run a `ci.yml` GitHub Actions workflow on every pull request targeting `main` and on every push to `main`. The workflow SHALL run, in parallel where possible, the following checks across the monorepo: dependency install (`pnpm install --frozen-lockfile`), ESLint, TypeScript typecheck (`pnpm typecheck`), unit/integration tests (`pnpm test`), and `go test ./...` in `apps/api`. The workflow SHALL fail the PR if any check fails. The workflow SHALL use Turborepo remote cache or GHA cache to skip unchanged tasks.

#### Scenario: PR with failing test

- **WHEN** a contributor pushes a commit that breaks a unit test
- **THEN** the `ci.yml` workflow run reports a failed status check on the PR within 5 minutes
- **AND** the PR cannot be merged until the test passes (when branch protection is enabled)

#### Scenario: PR with no source changes

- **WHEN** a contributor pushes a commit that only changes `README.md`
- **THEN** the workflow detects no buildable changes and completes by relying on cached task results
- **AND** total wall-clock time is under 90 seconds

### Requirement: Image build and registry push

On every push to `main` (after `ci.yml` succeeds), the repository SHALL run a `deploy.yml` workflow that builds three Docker images — `web`, `admin`, `api` — from the corresponding `apps/*/Dockerfile`, for the `linux/amd64` platform only, and pushes them to GitHub Container Registry under `ghcr.io/<owner>/pokermap-<service>` with two tags: the full git SHA and `latest`. The workflow SHALL use Docker Buildx with GHA cache (`type=gha`) for layer caching.

#### Scenario: Successful build pushes both tags

- **WHEN** a push to `main` lands on commit `abc1234`
- **THEN** `ghcr.io/<owner>/pokermap-web:abc1234`, `:latest`, and the matching `admin` and `api` images all exist after the workflow run
- **AND** subsequent pulls of `:latest` resolve to the `abc1234` digest

#### Scenario: Web image embeds correct base path

- **WHEN** the `web` image is built by `deploy.yml`
- **THEN** the build receives `BASE_PATH=/poker` as a build arg and bakes it into Next.js `basePath`/`assetPrefix`
- **AND** asset URLs in the served HTML are prefixed with `/poker/`

### Requirement: SSH-based VPS deploy with health gate and rollback

After image push succeeds, the `deploy.yml` workflow SHALL SSH into the VPS as the `deploy` user (host, user, port, and private key sourced from repository secrets) and execute, from `/srv/projects/poker/`:

1. `docker login ghcr.io` using a registry token from secrets
2. `docker compose pull`
3. `docker compose up -d --remove-orphans`
4. Poll each updated container's healthcheck status for up to 60 seconds.
5. On all-healthy, write the current git SHA to `/srv/projects/poker/.last-good` and exit 0.
6. On any healthcheck failure, repin the relevant service tags to the SHA in `.last-good`, re-run `docker compose up -d`, and exit non-zero so the workflow run is marked failed.

#### Scenario: Healthy deploy

- **WHEN** all three containers become `healthy` within 60 seconds after `up -d`
- **THEN** the workflow exits 0
- **AND** `cat /srv/projects/poker/.last-good` on the VPS equals the deployed git SHA
- **AND** the prior image tags are retained on the VPS for at least one further deploy (not pruned mid-deploy)

#### Scenario: Failed health check triggers rollback

- **WHEN** the `api` container fails its healthcheck for 60 seconds after `up -d`
- **THEN** the workflow re-pins the api tag to the SHA stored in `.last-good`, runs `docker compose up -d api`, and the api container returns to its previous healthy state
- **AND** the workflow run is marked failed in GitHub
- **AND** the `web` and `admin` services are also rolled back to `.last-good` so the system is internally consistent

### Requirement: Secrets and configuration delivery

The `deploy.yml` workflow SHALL render a project `.env` file on the VPS from GitHub Actions secrets at deploy time and SHALL NOT commit any secret to the repository or bake any secret into the image. The rendered `.env` SHALL be owned by `deploy:deploy` with mode `0600`. The workflow SHALL never echo secret values to its log.

#### Scenario: Secret rendered into env file

- **WHEN** the deploy workflow runs with `DATABASE_URL` and `JWT_SECRET` configured as repo secrets
- **THEN** `/srv/projects/poker/.env` on the VPS contains those keys with the secret values
- **AND** `stat -c "%a %U:%G" /srv/projects/poker/.env` returns `600 deploy:deploy`
- **AND** the workflow log shows masked `***` in place of the secret values

#### Scenario: Secret missing aborts deploy

- **WHEN** a required secret (e.g. `JWT_SECRET`) is not set in the repository
- **THEN** the workflow fails at the secret-validation step BEFORE any SSH connection is opened or any image is pulled on the VPS

### Requirement: Deploy auditability

Each completed deploy SHALL leave a structured record on the VPS in `/srv/projects/poker/deploys.log` containing: ISO timestamp, deployed git SHA, previous SHA, deployer (GitHub workflow run URL), and result (`ok` / `rolled-back`).

#### Scenario: Audit entry after deploy

- **WHEN** a deploy completes (success or rollback)
- **THEN** a single line is appended to `deploys.log` with the five fields above, tab-separated
- **AND** the file is owned by `deploy:deploy` and never rotated by the deploy script (logrotate handles retention)

