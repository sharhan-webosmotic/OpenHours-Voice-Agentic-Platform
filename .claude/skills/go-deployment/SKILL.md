---
name: go-deployment
description: "Prepare Go deployment runbooks: static binary builds (CGO_ENABLED=0), multi-stage distroless/scratch Docker images, non-root containers, health/readiness endpoints, graceful shutdown wiring, and zero-downtime rollout. Use when deploying a Go service, writing a Go Dockerfile, configuring the binary build, setting up health checks, or planning a production Go release. Do NOT use for Go implementation (use build), Go tests (use go-testing), or Python deployment (use python-deployment). Also triggers on: 'Deploy Go', 'Go Dockerfile', 'distroless', 'CGO_ENABLED', 'Go health check'."
next_skill: null
required_gate: "Gate 5 (Production Sign-off)"
skill_id: SK-161
allowed-tools: Read Write Edit Grep Glob Bash
context_budget:
  load_kb: 30
  scope: task
version: 1.0.3
dependencies:
  required:
    - go-testing
  optional:
    - github-ops
    - audit
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# Go Deployment

Loads: `rules/development-rules.md`, `rules/go-rules.md`, `rules/infrastructure-rules.md`.

> AI never deploys. It prepares, documents, validates, and generates artifacts. The human operator runs every `docker push` / `kubectl apply` / cloud-CLI deploy. External operations follow `ops-safety-rules.md` (warn + approve).

## The static binary

Go ships a single static binary. That is the deployment advantage: a tiny image, no runtime to install, instant start.

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -trimpath \
  -ldflags="-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" \
  -o /out/server ./cmd/server
```

- `CGO_ENABLED=0` makes the binary fully static, so it runs in `scratch`/`distroless` with no libc. Only keep CGO if a dependency truly needs it (then use a `distroless/base` image, not `scratch`).
- `-trimpath` strips local filesystem paths from the binary (no leaking build-machine paths).
- `-ldflags="-s -w"` drops the symbol table and DWARF for a smaller binary.
- `-X main.version=...` stamps the version/commit so `/health` or a `--version` flag can report it.

## Dockerfile (multi-stage, distroless)

Verify the Go version against `https://go.dev/dl/` before pinning; match `go.mod`'s `go` directive.

```dockerfile
FROM golang:<VERSION> AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG VERSION=dev
ARG COMMIT=none
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath \
    -ldflags="-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" \
    -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=builder /out/server /server
USER nonroot:nonroot
EXPOSE 8000
ENTRYPOINT ["/server"]
```

- `distroless/static` (or `scratch`) for a `CGO_ENABLED=0` binary: no shell, no package manager, minimal attack surface. Use `distroless/base` only when CGO is on.
- `:nonroot` runs as a non-root user with no extra setup.
- `go mod download` in its own layer (before `COPY . .`) so dependency layers cache across builds.
- No HEALTHCHECK CMD in a distroless image (no shell to run it): the orchestrator probes `/healthz` over HTTP instead.

## Health & readiness

Expose two endpoints, kept cheap and dependency-light:

- `/healthz` (liveness): returns 200 if the process is up. No DB call. Used by the orchestrator to decide a restart.
- `/readyz` (readiness): returns 200 only when dependencies (DB pool, cache) are reachable. Used to gate traffic during rollout. Returns 503 while warming or when a dependency is down.

```go
mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok","version":"` + version + `"}`))
})
mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
	if err := pool.Ping(r.Context()); err != nil {
		http.Error(w, `{"status":"unready"}`, http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
})
```

## Graceful shutdown (mandatory for zero-downtime)

The binary MUST trap SIGTERM and drain in-flight requests, or rolling deploys drop live connections. The pattern lives in `go-rules.md`: `signal.NotifyContext` -> `srv.Shutdown(ctx)` with a timeout -> close the DB pool. On Kubernetes, set `terminationGracePeriodSeconds` above the shutdown timeout, and flip `/readyz` to 503 first so traffic stops before drain.

## Environment & config

```bash
ENVIRONMENT=production
HOST=0.0.0.0          # mandatory in containers (127.0.0.1 is loopback only)
PORT=8000
# Secrets injected at runtime via the secrets manager (never baked into the image)
```

- `internal/config` reads env once and fails fast (returns an error / exits non-zero) on a missing required production value.
- `.env.example` documents every variable. Secrets never in the Dockerfile or the image.
- `GOMAXPROCS` is set automatically to the container CPU limit via `go.uber.org/automaxprocs` (import it) so the scheduler does not assume the host core count.

## Rollout & rollback

| Platform | Mechanism |
|---|---|
| Docker Compose | `up -d --no-deps --build` |
| Docker Swarm | `service update --update-parallelism 1 --update-delay 10s --update-failure-action rollback` |
| Kubernetes | `RollingUpdate` with `maxUnavailable: 0`, `maxSurge: 1`, `readinessProbe` -> `/readyz`, `livenessProbe` -> `/healthz` |

Rollback (target < 5 min):
- K8s: `kubectl rollout undo deployment/<svc>`; verify with `kubectl rollout status`.
- Swarm: `docker service update --image <svc>:${PREV_TAG} <svc>` or `--rollback`.
- Code: `git revert HEAD --no-edit`, push, rebuild clean. Never patch a running container.

## Verification & rollback gate

Pre-deploy:
- `go test -race ./...` passes; `go build ./...` succeeds; `go vet ./...` clean.
- `govulncheck ./...` clean of known vulnerabilities; `audit` passed.
- Image builds, container starts as non-root, `/healthz` returns 200, `/readyz` returns 200 once dependencies are up.
- `ENVIRONMENT=production`, `HOST=0.0.0.0`, secrets injected via the secrets manager (not the image).
- The MAVS `go-test.json` report is PASS and current (`source_commit == HEAD`).

Post-deploy validation:
```bash
curl -f http://host:port/healthz                 # {"status":"ok","version":"..."}
curl -f http://host:port/readyz                  # 200 once DB reachable
kubectl logs deploy/<svc> | grep -E "ERROR|panic" # empty
```

Not successful until: `/readyz` 200 for 60s, no ERROR/panic for 5 min, the first real request succeeds, and the reported version matches the deployed tag.
<!-- Version: 1.0.3 | 2026-10-22 | repointed rule references after code-rules.md and compliance/secrets.md merges (v4.32.0) -->
