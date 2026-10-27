# apps/api rules

Read the root `CLAUDE.md` first. Skills: `backend-api-standards`, `tenant-security-phi`, `database-prisma-postgres`, `testing-quality-gates`.

## Layout
```
src/
  app.ts server.ts config.ts          config.ts is the only reader of process.env
  db/                                  Prisma client, withTenant, asSystem
  common/                              errors, logger, context, middleware, pagination
  modules/<name>/
    <name>.routes.ts                   path + method + zod schemas + permission + sensitivity flag
    <name>.controller.ts               parse, call service, shape response. No business logic
    <name>.service.ts                  business rules, permission checks, transactions, audit
    <name>.repository.ts               the ONLY place Prisma is imported
    <name>.schemas.ts                  zod request/response (shared types come from packages/shared)
    <name>.test.ts                     unit + integration tests
  voice/                               VoiceProvider interface, providers/sarvam, tool endpoints, webhooks
  jobs/                                pg-boss queues, workers, schedulers
  storage/                             S3 access, signed URLs
```

## Rules
- Controller -> service -> repository. A controller never touches Prisma; a repository never checks permissions.
- Every route declares: zod params/query/body/response, required permission, whether it is PHI-sensitive. It must appear in the generated OpenAPI.
- Multi-step writes run in one transaction. External calls (provider, S3, email) never happen inside a database transaction; use an outbox row or a job.
- Lists are cursor-paginated with a hard maximum page size. No unbounded queries. Select only the columns needed.
- Responses never include internal fields (password hashes, token hashes, provider secrets).
- Voice tool endpoints are latency-critical (target p95 < 400 ms): one round trip to the database where possible, no N+1, no external calls, short human-readable `message` in the response.
- Jobs are idempotent: use a `dedupe_key`, check state before acting, record every attempt and outcome. A worker restart must never cause a duplicate call to a patient.
- Rate-limit auth and webhook endpoints. Set request body size limits. Verify webhook signatures before parsing the body.
- Tests: integration tests use a real PostgreSQL (Testcontainers) connecting as the restricted `app_user` role so row-level security is exercised.
