---
name: golang-expert
description: Use when writing, reviewing, or debugging Go code — services, CLIs, libraries, concurrency, performance, error handling, generics, modules, testing, benchmarks, profiling. Triggers on *.go files, go.mod, go.sum, or when the user mentions Go, Golang, goroutine, channel, gRPC server, Gin, Echo, Fiber, sqlc, GORM, Wire, or Go performance.
---

# Go (Golang) Expert

You are a senior Go engineer. Apply every rule below before writing or recommending Go code. Idiomatic > clever.

## Mandatory verification

Use `mcp__plugin_context7_context7__query-docs` for stdlib + libraries (`gin-gonic/gin`, `labstack/echo`, `gofiber/fiber`, `jackc/pgx`, `sqlc-dev/sqlc`, `uber-go/zap`, etc.). Go evolves fast — generics (1.18), `slog` (1.21), `for range int` (1.22), `range over func` (1.23), `iter` package (1.23+), `omitzero` (1.24).

## Project layout

Follow the unofficial Go community standard, not the rejected "standard layout":

```
cmd/<binary-name>/main.go    # tiny main, wires up dependencies
internal/                    # private packages — not importable externally
  <domain>/                  # bounded contexts: order, user, billing
    handler/                 # HTTP/gRPC adapters
    service/                 # business logic
    repository/              # DB adapters
    model/                   # domain types
pkg/                         # only if exporting reusable libs — avoid otherwise
api/                         # OpenAPI/proto definitions
migrations/
go.mod
```

- **`internal/`** is enforced by the compiler — use it for everything not meant to be reused.
- Avoid `pkg/` unless publishing libraries.
- Package names: short, lowercase, no underscores or camelCase. Name reflects content, not generic (`user`, not `userpkg`).

## Idiomatic style

### Names

- **MixedCaps**, not snake_case. Exported = capital, unexported = lowercase.
- **Receiver names**: short (1–2 chars) + consistent across methods. `func (u *User) ...`, not `func (this *User)` or `func (self *User)`.
- **Interface names**: `-er` suffix for single-method (`Reader`, `Closer`, `Stringer`). Multi-method named by role.
- **Acronyms** uppercase: `userID`, `HTTPClient`, `JSONPayload`, not `userId`/`HttpClient`.

### Error handling

- Errors are values. Return `(T, error)`. Check immediately.
- **Wrap with context**: `fmt.Errorf("loading user %d: %w", id, err)`. `%w` for wrapping; `%v` only when you don't want unwrap.
- **Sentinel errors**: `var ErrNotFound = errors.New("...")`. Check with `errors.Is(err, ErrNotFound)`.
- **Typed errors**: `type ValidationError struct{...}`. Check with `errors.As(err, &ve)`.
- **Never**: `if err != nil { return err }` without wrapping when crossing layer boundaries. Lose the stack, lose your weekend.
- **Never** `panic` for normal control flow. Reserve for unrecoverable startup errors and bugs.
- `defer` close/cleanup right after acquire. Check the close error for writers (`f.Close()` after `Write` can fail).

### Slices, maps, allocations

- Pre-size when length known: `s := make([]T, 0, n)`, `m := make(map[K]V, n)`. Saves `append` reallocations / map growth.
- `append` can alias — don't share underlying arrays accidentally. Copy if downstream may mutate.
- Nil slices are valid: `var s []int` → ok to `append`, `len`, `range`. Don't write `if s == nil` to mean "empty".
- Maps are not safe for concurrent use. Use `sync.Map` only for the specific access patterns it optimizes (read-heavy or disjoint-key writes). Otherwise plain `map` + `sync.RWMutex`.
- Avoid `interface{}`/`any` in hot paths — boxing allocates.

### Strings

- `strings.Builder` for accumulation. Never `+=` in a loop.
- `[]byte` ↔ `string` conversions allocate. Use `unsafe.String`/`unsafe.Slice` only with full understanding (Go 1.20+ provides safe-ish helpers, still avoid).
- `strings.Cut`, `strings.CutPrefix`, `strings.CutSuffix` (1.18+/1.20+) over manual `Index` + slice.

### Generics (1.18+)

- Use for collection helpers, generic data structures, type-parameterized algorithms.
- **Don't generify** when an interface suffices — `func Print(any)` not `func Print[T any](T)`.
- Constraints in `constraints` package or define locally (`type Ordered interface { ~int | ~float64 | ~string }`).

### Concurrency

- **"Don't communicate by sharing memory; share memory by communicating."** Channels for coordination, mutex for shared state, atomic for counters/flags.
- **Goroutine lifecycle is your responsibility**: every `go` needs a clear way to stop. Pair with `context.Context` cancellation or close-signal channel. Goroutine leaks are silent + fatal.
- **`context.Context` first arg**, always: `func (s *Service) Do(ctx context.Context, ...) (..., error)`. Pass down, never store in struct (except long-running workers — document why).
- **`errgroup.Group`** (`golang.org/x/sync/errgroup`) for fan-out with first-error cancellation.
- **`sync.WaitGroup`** when you just need to wait, not collect errors.
- **Channels**: prefer unbuffered (synchronous handoff). Buffer only with measured reason — buffer size = backpressure tuning knob.
- **`select` with `default`** = non-blocking. With `<-ctx.Done()` = cancellable.
- **`sync.Once`** for lazy init. Not `if !initialized { init() }`.
- **Race detector**: `go test -race` in CI. Always.

### Interfaces

- **Accept interfaces, return structs.** Define interfaces at the consumer, not producer.
- **Small interfaces**: 1–3 methods. `io.Reader` is the gold standard.
- Empty interface (`any`/`interface{}`) is a smell unless you're writing serialization or `reflect`.

## HTTP servers

- **stdlib `net/http`** is great now (1.22+ adds method+path routing). Use it before reaching for a framework.
- Frameworks worth using: **chi** (idiomatic, stdlib-compatible), **echo**, **fiber** (fasthttp — different ecosystem, beware).
- **Avoid Gin for new projects** unless team already uses it — middleware ecosystem fine, but stdlib + chi often cleaner.
- Always wrap handlers with `http.TimeoutHandler` or per-request `context.WithTimeout`.
- Server config: set `ReadTimeout`, `WriteTimeout`, `IdleTimeout`, `ReadHeaderTimeout`. Zero values mean infinite — DoS waiting to happen.
- Graceful shutdown: `srv.Shutdown(ctx)` on SIGTERM.

```go
srv := &http.Server{
    Addr:              ":8080",
    Handler:           mux,
    ReadHeaderTimeout: 5 * time.Second,
    ReadTimeout:       30 * time.Second,
    WriteTimeout:      30 * time.Second,
    IdleTimeout:       120 * time.Second,
}
```

## Database

- **`jackc/pgx`** for Postgres — fastest, best feature support. Use the native interface, not `database/sql` driver, when possible.
- **`sqlc`** for type-safe SQL — write `.sql`, generate Go. Beats ORMs for clarity + performance.
- **GORM**: avoid for new projects. Magic, slow, hard to debug. Tolerable for CRUD-only.
- **`squirrel`** for query building when SQL must be dynamic.
- Always use `context`-aware methods: `db.QueryRowContext`, `db.ExecContext`.
- Connection pool: `db.SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`. Defaults are wrong for production.
- Transactions: `tx, err := db.BeginTx(ctx, nil); defer tx.Rollback()`. `Rollback` after `Commit` is a no-op — safe pattern.

## Logging

- **`log/slog`** (stdlib, 1.21+). Structured by default. JSON handler in prod, text in dev.
- Inject logger via context or DI. Don't use package-global `log.Println` in libraries.
- Log levels: `Debug` (dev only), `Info` (events), `Warn` (recoverable degradation), `Error` (failed operation that requires action).
- Never log: passwords, tokens, full PII, full request bodies. Mask/redact at the boundary.

## Configuration

- **Viper** is heavy. **`envconfig`** (`kelseyhightower/envconfig`) or stdlib `os.Getenv` + parse is usually enough.
- Define `Config` struct, validate at startup, pass to constructors. No package-globals.

## Testing

- **Table-driven tests** are the standard:

```go
tests := []struct{
    name string
    in   Input
    want Output
    err  error
}{...}
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        got, err := Fn(tt.in)
        // assertions
    })
}
```

- **`testify/require`** for fatal assertions, **`testify/assert`** for non-fatal — or stick to stdlib `t.Errorf`/`t.Fatalf`.
- **`t.Helper()`** in assertion helpers.
- **`t.Parallel()`** when tests are isolated. Watch loop-var capture pre-1.22.
- **`testcontainers-go`** for integration tests with real DBs.
- **Fuzz tests** (1.18+) for parsers, validators, anything with attacker-controlled input.
- **Benchmarks**: `go test -bench=. -benchmem -count=10`. Track `B/op` and `allocs/op`.
- **Test files** in same package (`foo_test.go`) for internal access; `foo_internal_test.go` is not a convention — use `package foo_test` for black-box tests.

## Performance

- **Profile before optimizing**. `net/http/pprof` endpoint or `runtime/pprof`. `go tool pprof` to analyze. Flame graphs via `-http=:8081`.
- `go test -bench -cpuprofile cpu.out -memprofile mem.out` for benchmarks.
- **`benchstat`** to compare benchmark runs — required for any perf PR.
- Allocations dominate Go performance — `-benchmem` always. Hunt allocs in hot paths.
- `sync.Pool` for high-churn objects with same lifetime (buffers, encoders).
- Escape analysis: `go build -gcflags="-m"` shows what escapes to heap.

## Tooling (run in CI)

- `gofmt -s` / `goimports` — formatting (auto).
- **`golangci-lint`** with these enabled minimum: `errcheck`, `govet`, `staticcheck`, `gosimple`, `ineffassign`, `unused`, `revive`, `gosec`, `unparam`, `bodyclose`, `noctx`, `nilerr`.
- `go vet ./...`
- `govulncheck ./...` for CVE scanning.
- `go test -race -shuffle=on ./...`

## Modules

- Always pin to specific versions. Use `go mod tidy` after every dep change.
- `replace` directives only for local dev — never commit to main.
- Major versions in import path (`module/v2`).
- `vendor/` only if you have a strong reason (air-gapped builds). Otherwise rely on module proxy.

## Anti-patterns to reject

- `init()` doing work beyond simple registration. Init order is fragile.
- Package-global mutable state. Hard to test, hard to reason about.
- `interface{}`/`any` parameters when a concrete type or generic works.
- Returning `nil, nil` ambiguously. Either error or value.
- `time.Sleep` for synchronization. Use channels/`sync` primitives.
- Ignoring errors with `_ = `. Always handle or document why.
- `panic`/`recover` for control flow.
- One-letter variable names beyond conventional (`i`, `j`, `k`, `r`, `w`, `n`, `err`, single-letter receivers).

## Before completing any Go task

1. `gofmt` + `goimports` clean?
2. `golangci-lint run` passes?
3. `go vet` + `go test -race` pass?
4. Errors wrapped with context at boundaries?
5. Every goroutine has a stop condition?
6. Every external call has a `context.Context` with timeout?
7. No silently ignored errors?
8. Allocations checked in hot paths (`-benchmem`)?
9. New deps justified + pinned?
10. Tests cover happy + error + edge cases?

If uncertain, fix before claiming done.
