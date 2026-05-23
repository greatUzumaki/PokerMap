## ADDED Requirements

### Requirement: Workspace topology
The repository SHALL be a pnpm + Turborepo monorepo with two apps (`apps/web`, `apps/api`) and three shared packages (`packages/ui`, `packages/config`, `packages/types`). A root `go.work` file SHALL include `apps/api` so Go tooling resolves the workspace.

#### Scenario: Fresh clone installs cleanly
- **WHEN** a contributor clones the repo and runs `pnpm install` from the root
- **THEN** all JS dependencies for `apps/web` and every `packages/*` resolve via the pnpm workspace without manual per-directory installs

#### Scenario: Go workspace recognized
- **WHEN** a contributor opens `apps/api` in any Go-aware editor or runs `go build ./...` from the repo root
- **THEN** the build succeeds because `go.work` references `./apps/api`

### Requirement: Build orchestration
The repository SHALL define Turborepo pipelines for `dev`, `build`, `lint`, `typecheck`, `test`, and `format:check` that fan out to each workspace. A root `Makefile` SHALL provide top-level targets that delegate to per-app commands (`make web-dev`, `make api-dev`, `make migrate-up`, `make seed`, `make minio-bootstrap`).

#### Scenario: Run dev across the stack
- **WHEN** the user runs `pnpm dev` from the root
- **THEN** Turborepo starts the Next.js dev server with hot reload

#### Scenario: Cached builds
- **WHEN** a contributor runs `pnpm build` twice in succession without changes
- **THEN** the second invocation completes from Turborepo's local cache without rebuilding

### Requirement: Shared TypeScript and lint configuration
The repository SHALL centralize ESLint, Prettier, and base `tsconfig.json` rules under `packages/config`. Every TS workspace SHALL extend these shared configs rather than duplicating them.

#### Scenario: Strict mode enforced
- **WHEN** any TS workspace runs `tsc --noEmit`
- **THEN** TypeScript is configured with `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true` via the shared config

### Requirement: Code quality gates
The repository SHALL run lint, typecheck, and tests in CI for every pull request. The pipeline SHALL block merge on failure of any gate.

#### Scenario: Lint failure blocks PR
- **WHEN** a contributor pushes a branch with an ESLint or `golangci-lint` violation
- **THEN** the GitHub Actions check reports failure and the PR cannot be merged until fixed
