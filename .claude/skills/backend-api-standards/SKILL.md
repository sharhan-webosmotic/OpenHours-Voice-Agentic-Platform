---
name: backend-api-standards
description: Use when writing or changing anything in apps/api - routes, controllers, services, repositories, zod schemas, errors, pagination, transactions, OpenAPI. Defines the module pattern and API conventions for the clinic platform.
---

# Backend API standards

## Before you write code
1. Find the closest existing module in `apps/api/src/modules` and copy its structure. Do not invent a new pattern.
2. State the endpoint contract first: method, path, zod request and response, permission, PHI-sensitive yes/no, errors.

## Module pattern
routes -> controller -> service -> repository (see `apps/api/CLAUDE.md`). Business rules and permission checks live in the service. Only the repository imports Prisma.

## Checklist for every endpoint
- [ ] zod schemas for params, query, body AND response; registered via `registerRoute` so M1-03 can generate the OpenAPI document from the registry
- [ ] `requirePermission(resource, action)` in the service, using the shared matrix
- [ ] organisation comes from request context, never from input
- [ ] audit call if the endpoint reads or writes PHI, roles, recordings, prescriptions or support access
- [ ] errors are `AppError` subclasses: 400 validation, 401, 403, 404 (also for cross-tenant), 409 conflict, 429
- [ ] list endpoints: cursor pagination, max page size 100, stable sort with id tiebreaker
- [ ] creates callable by the voice agent accept `Idempotency-Key` and return the original result on replay
- [ ] no unbounded queries, no N+1, selects only needed columns
- [ ] tests: happy path, validation failure, permission denied per role, cross-tenant, idempotent replay where relevant

## Conventions
- Paths `/api/v1/<resource>`; plural nouns; kebab-case; actions as sub-resources (`POST /appointments/:id/cancel`).
- Errors: RFC 7807 problem+json with `type`, `title`, `status`, `detail`, `requestId`, and `errors[]` for field problems. Never leak stack traces or SQL.
- Dates are ISO-8601 UTC strings. Enums are UPPER_SNAKE strings. IDs are UUIDs.
- Transactions: one per use case; do not call external services inside; use the outbox/job pattern for side effects.
- Concurrency: rely on database constraints (unique, exclusion) and map violations to 409; never check-then-insert without a constraint.
- Config via `config.ts` only. Logging via the redacting logger with IDs only.

## Anti-patterns to refuse
Prisma outside repositories; business logic in controllers; `any`; trusting client-supplied organisation or role; `try/catch` that swallows; catching an error only to return 500; returning raw Prisma models; endpoints without response schemas.
