# PokerMap — Project Rules

## Core engineering rules

These apply to every response. No exceptions.

### 1. Use current best practices and up-to-date knowledge

- Before recommending any library, framework, API, or syntax: **verify it is current**. Training data may be stale.
- Prefer `context7:query-docs` (via `mcp__plugin_context7_context7__query-docs`) for library/framework docs over memorized knowledge. Use even for "well-known" libraries (React, Next.js, Express, Tailwind, etc.).
- For Vercel platform topics, the `vercel:knowledge-update` skill content overrides any contradicting prior knowledge (Edge Functions deprecated, Fluid Compute default, Node 24 LTS, etc.).
- Pin versions in `package.json` / `go.mod` rather than relying on `latest`. Document why a non-current version is used.
- Reject deprecated patterns even if they "still work" (e.g., `componentWillMount`, Pages Router for new code, `var`, callback-style Node APIs when promise/async exists, `interface{}` over `any` in modern Go ≥1.18).

### 2. Clean code

- **Naming**: intent-revealing. `userIdsToInvalidate` not `arr`. Functions verbs, variables nouns, booleans `is*`/`has*`/`should*`.
- **Single Responsibility**: one function = one reason to change. Extract when a function exceeds ~30 lines or mixes abstraction levels.
- **No dead code**: delete unused imports, vars, branches, commented-out blocks. Git remembers.
- **No magic numbers/strings**: extract to named constants when used >1 place or meaning is non-obvious.
- **Composition over inheritance**. Pure functions over stateful classes when possible.
- **Errors are values**: handle at the right boundary; never silently `catch {}` or `_ = err`. Re-throw with context if you cannot handle.
- **Comments only for WHY**, never WHAT. If you need a comment to explain WHAT, rename or refactor.

### 3. Optimization

- **Measure before optimizing**. No premature micro-optimization. Profile with real data.
- **Algorithmic complexity first**: O(n²) → O(n log n) beats any micro-tweak. Watch nested loops over collections.
- **Avoid N+1**: batch DB queries, use joins/`IN`/dataloader patterns. Critical for any ORM code.
- **Cache invalidation is the hard part**: prefer explicit cache keys with TTL + tag-based invalidation over implicit caching.
- **Frontend**: lazy-load below-the-fold, code-split route-level, image optimization (`next/image`, WebP/AVIF), prefetch on intent, avoid layout shift (CLS).
- **Backend**: connection pooling, prepared statements, indexed queries, streaming over buffering for large payloads.
- **Go specifically**: pre-allocate slices when size known (`make([]T, 0, n)`), avoid unnecessary allocations in hot paths, use `sync.Pool` for high-churn objects, prefer `strings.Builder` over `+=`.
- **Never** add a cache, queue, or microservice "for scale" without a measured bottleneck.

### 4. Type safety and correctness

- TypeScript: `strict: true`. No `any` without a `// eslint-disable` and a justification comment. Prefer `unknown` + narrowing.
- Go: enable `golangci-lint` with `errcheck`, `staticcheck`, `govet`, `revive`. No ignored errors.
- Validate at boundaries: incoming HTTP/RPC requests, env vars, third-party API responses. Use Zod / `go-playground/validator` / similar.
- Make illegal states unrepresentable (discriminated unions, sum types, branded types).

### 5. Testing

- New logic ships with tests. Bug fix ships with a regression test that fails before the fix.
- Test behavior, not implementation. Avoid mocking what you own — mock at system boundaries.
- Integration tests hit real DB (testcontainers / Docker), not in-memory mocks.

### 6. Security

- Never log secrets, tokens, PII. Validate + sanitize all user input. Parametrize SQL. CSRF tokens on state-changing requests.
- Use platform secret stores (Vercel env vars, GCP Secret Manager) — never commit `.env*` files beyond `.env.example`.
- Dependencies: run `npm audit` / `govulncheck` in CI. Patch criticals immediately.

### 7. Process

- Use OpenSpec workflow for non-trivial changes (this repo has `openspec/`). For trivial fixes, edit directly.
- Commits: imperative subject, body explains WHY. Conventional Commits prefix (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `chore:`).
- Branches: `feat/<short-slug>`, `fix/<short-slug>`.

## Domain-specific expertise

Invoke the relevant skill via the `Skill` tool when working in these areas:

- **`nextjs-frontend-expert`** — Next.js App Router, React, TypeScript, Tailwind, performance, accessibility.
- **`backend-expert`** — API design, databases, caching, queues, observability, distributed systems.
- **`golang-expert`** — idiomatic Go, concurrency, performance, ecosystem.

## When in doubt

1. Check current docs via `context7` MCP.
2. Prefer the boring, well-trodden option over the clever one.
3. Ask the user when a decision is irreversible or affects shared state.
