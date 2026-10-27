# App Observability Standard

> The observability a DEPLOYED APPLICATION must have before it reaches production. This is distinct from ADF skill-execution telemetry (`AI_DOCS/memory/metrics.jsonl`, `docs/telemetry.md`), which measures the framework, not the app. `deployment-execution`, `audit` (observability-readiness check), and Gate 5 reference THIS file for what the running app must emit.

A production app that cannot be observed cannot be operated. The four signals below are not optional polish: a Gate 5 production sign-off is incomplete without them (or an explicit logged override in `decision-log.md`).

## 1. Logs (structured, required)

- Structured logger (pino / winston / structlog / equivalent), JSON in production, never bare `console.log`.
- Every request carries a correlation/request ID, propagated across services.
- Levels used correctly: `info` on significant success, `warn` on recoverable issues, `error` on caught exceptions.
- NEVER log secrets, tokens, PII, or full request bodies for sensitive endpoints (see `rules/compliance/audit-logs.md`).
- Retention: app logs >= 30 days; audit logs per the compliance regime (HIPAA 6 years for PHI access).

## 2. Metrics (required)

- The four golden signals: latency (p50/p95/p99), traffic (req/s), errors (5xx rate), saturation (CPU, memory, disk).
- Per-endpoint latency + error rate for the critical paths.
- Business-relevant counters where they exist (signups, payments, jobs processed).
- A dashboard exists and is linked from the runbook.

## 3. Traces (recommended; required for multi-service)

- Distributed tracing (OpenTelemetry) across service boundaries when the app is more than one service.
- A slow request can be followed end to end. For a monolith this is addressable; for microservices it is required.

## 4. Error tracking (required)

- An error tracker (Sentry or equivalent) initialized in both frontend and backend entry points.
- Unhandled exceptions and rejections are captured with stack + release version + user context (redacted).
- Source maps uploaded so production stack traces are readable.

## 5. Health + alerting (required)

- A `/health` (liveness) and ideally `/ready` (readiness) endpoint that the load balancer and uptime monitor poll.
- Alerts wired with thresholds and an owner: 5xx rate spike, p95 latency past budget, health-check failures, saturation, error-tracker spike, and an auth-failure-rate alert (security).
- Every alert routes to a real destination (pager / channel), not a dead inbox.
- A billing/cost alert (provider budget) at the approved spend ceiling (see `rules/infrastructure-rules.md` Rule 19).

## Verification (what /audit checks, what Gate 5 requires)

`/audit` observability-readiness check (web/service projects) greps for:
- error-tracker init (`Sentry.init`, `*.init(` for the configured tracker, `@sentry/`),
- a health route (`/health`, `/healthz`, `healthCheck`, `actuator/health`),
- a structured logger (`pino`, `winston`, `structlog`, `bunyan`) rather than `console.log` in app code.

Missing any of the three on a non-POC project heading to production is a Gate 5 CONCERNS (FAIL if a compliance regime is declared). The dashboard, alert wiring, and retention are confirmed by `/operations` at go-live and recorded in the deployment log.
