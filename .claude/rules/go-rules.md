---
paths:
  - "**/*.go"
  - "go.mod"
---

# Go Backend Rules

> Loaded when `stack.md → backend` is Go. The always-on baseline for Go services, the sibling of `python-rules.md`. Short, enforceable bullets. API contract + security rules (`api-rules.md`, `security-rules.md`) apply on top.

## Project layout
- Standard layout: `cmd/<binary>/main.go` for entrypoints, `internal/` for non-exported packages, `pkg/` only for genuinely reusable libraries. No `src/`.
- One package per directory, named for what it provides (`store`, `httpapi`, `auth`), never `utils`/`common`/`helpers`.
- `go.mod` committed; pin the Go version; `go mod tidy` clean (no unused deps).

## Concurrency & context
- `context.Context` is the FIRST parameter of every function that does I/O, network, or DB work. Propagate the request context, never `context.Background()` deep in a handler, never store a context in a struct field.
- Every `go func()` has a cancellation path (the context or a done channel) and a bounded lifetime. No fire-and-forget goroutine that outlives the request.
- Bound fan-out: `golang.org/x/sync/errgroup` or a semaphore, never an unbounded `go` per item in a request-sized loop.
- Channels: document direction (`chan<-` / `<-chan`) in signatures; never write to a channel with no reader; close from the sender, once.

## Errors
- Every error is checked. Never `_ = err`. Never ignore the error from a write/close.
- Wrap with context at each layer: `fmt.Errorf("loading user %s: %w", id, err)`. Check at the boundary with `errors.Is` / `errors.As`.
- `panic` only for unrecoverable programmer errors (nil-deref of an invariant), never for a normal failure path. HTTP handlers convert errors to the standard envelope (`api-rules.md`), never leak the raw error or a stack trace.

## Resources & shutdown
- `defer` the close of every `rows`, response `Body`, file, and acquired `conn` immediately after acquiring it.
- `database/sql` / `pgx`: parameterized queries only (no string-concatenated SQL); set pool limits (`SetMaxOpenConns`, `SetConnMaxLifetime`).
- Graceful shutdown: trap SIGTERM/SIGINT, call `http.Server.Shutdown(ctx)` with a timeout, drain in-flight requests, close the DB pool.
- Every outbound HTTP call sets a timeout (a custom `http.Client`, never `http.DefaultClient` with no timeout).

## API & validation
- Router: standard `net/http` (Go 1.22+ pattern routing) or `chi`/`echo`/`gin` per `stack.md`. Handlers thin; business logic in a service layer; DB in a store layer.
- Validate request input at the boundary (a validator, e.g. `go-playground/validator`, or explicit checks) before use. Never trust client data.
- The standard response envelope and HTTP status codes from `api-rules.md` apply (200/201/400/401/403/404/409/500). 401 vs 403 distinction enforced.

## Style & tooling
- `gofmt`/`goimports` clean (non-negotiable, CI-enforced). `go vet` clean. `golangci-lint` with `errcheck`, `govet`, `staticcheck`, `gosec` enabled, zero warnings.
- Small interfaces defined at the CONSUMER; return concrete structs. No giant "for testing" interfaces, no getters/setters by reflex.
- Table-driven tests (`tests := []struct{...}`), `t.Run` subtests, `-race` in CI. Mock external services at the interface boundary.

## Verification (what /audit / code-reviewer checks)
- `gofmt -l` is empty, `go vet ./...` clean, `golangci-lint run` clean.
- No goroutine without a context/exit path; no unchecked error; no SQL string concatenation; no missing `defer Close()`.
- Graceful-shutdown handler present for any long-lived server.

<!-- Version: 1.0.0 (2026-06-29): initial Go backend rules (backs the Go option in TECH-OPTIONS + the go-specialist agent) -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
