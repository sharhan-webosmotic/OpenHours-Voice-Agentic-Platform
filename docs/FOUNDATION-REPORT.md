# Backend foundation report (M1-04 to M1-10)

**Branch:** `feat/foundation-backend`, 7 commits, not pushed and not merged.
**Date:** 2026-10-27. **Scope:** M1-04 to M1-10. M1-03 and M1-11 were out of scope.

`pnpm check` is green with the Turbo cache cleared, including the Testcontainers database
suites: typecheck, lint, **521 tests** (408 in `apps/api`, 113 in `packages/shared`), and
the OpenAPI drift stub. `pnpm audit --audit-level high` reports no known vulnerabilities.

Coverage in `apps/api`: 94.73% lines, 85.31% branch. Against the CLAUDE.md floors, auth
94.18%, tenancy (`src/db`) 97.36%, permissions (`src/common`) 93.53% and audit 100% all
clear the 90% requirement, and everything else clears the 80% one.

| Commit    | Ticket                                                 |
| --------- | ------------------------------------------------------ |
| `5c2eeef` | M1-04 identity, tenancy and audit schema, Prisma 7     |
| `6c9e915` | M1-05 clinic domain schema                             |
| `b04ad4a` | M1-06 constraints, row-level security, database roles  |
| `6db986d` | M1-07 tenant-scoped Prisma client, `asSystem`          |
| `7b7e9d7` | M1-08 authentication and device pairing                |
| `0ce6e51` | M1-09 permission matrix, data scopes, support sessions |
| `5337119` | M1-10 audit log                                        |
| `2800f95` | coverage work on auth, tenancy and audit               |

## What was built

**Schema (M1-04, M1-05).** 25 tables across identity, tenancy, audit and the clinic
domain. UUID v7 keys generated in the application, snake_case mapping, `timestamptz`
throughout, and every composite index led by `organisation_id`. ERDs and the
justification for each tenant-less table are in `docs/architecture/`.

**Two isolation locks (M1-06, M1-07).** Row-level security on 25 tables, `ENABLED` and
`FORCED`, generated from one catalog query so a new tenant table gets a policy with
nothing to remember. `organisations` is covered explicitly, keyed on `id`. Above it, a
Prisma client extension injects the organisation into every query and throws when there
is no scope. `check-policies.ts` fails CI if any of that lapses.

**Authentication (M1-08).** argon2id, lockout, uniform timing for unknown emails, 15-minute
HS256 access tokens, rotating opaque refresh tokens in an httpOnly cookie with family
revocation on reuse, and device tokens confined to the forwarding endpoints.

**Authorization (M1-09).** The role x resource x action matrix in `packages/shared`,
enforced in the service layer. `requirePermission` returns the SCOPE, not a boolean, so a
caller cannot accidentally widen "own appointments" to "all appointments". Support
sessions are a 60-minute audited grant that unmasks one organisation.

**Audit (M1-10).** `audit.record` writes inside the caller's transaction, takes the actor
from context, and refuses metadata that would carry a patient value. Cursor-paginated
`GET /api/v1/audit-logs`. `phi-routes-are-audited.test.ts` fails the build when a route
flagged PHI-sensitive declares no audit action.

## Tests

The four required suites, all against real PostgreSQL in Testcontainers with the real
migrations applied, connected as the non-owner `app_user` so row-level security is live.

| Required            | Where                                                                                                                        | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Tenant isolation | `tests/tenant-isolation.test.ts`, `tests/tenant-client.test.ts`                                                              | Every one of 24 tenant tables: another organisation cannot read, update or delete a row, and with no `app.org_id` every table returns zero rows. The table list is hard-coded for `it.each` but asserted equal to the catalog, so a new tenant table fails loudly rather than going untested. Also proves A can still read A, since a policy that hid everything would pass "cannot read B". One test removes the extension entirely and shows the database still refuses. |
| 2. Auth             | `tests/auth.test.ts` (33)                                                                                                    | Login success and failure, unknown email answered identically to a wrong password, lockout, deactivation, rotation, reuse revoking the family, expiry, tampered and forged tokens, change-password, idempotent logout, and both directions of the device/user boundary. Asserts no password, token or email reaches the logs.                                                                                                                                              |
| 3. Permissions      | `packages/shared/src/permissions.test.ts` (113)                                                                              | One generated test per matrix cell against an independent transcription of the agreed table. Verified by sabotage that changing one cell fails exactly one generated test. Four invariants hold regardless of the table.                                                                                                                                                                                                                                                   |
| 4. Audit            | `tests/audit.test.ts`, `tests/audit-immutability.test.ts`, `tests/audit-read-wrapper.test.ts`, `src/modules/audit/*.test.ts` | Entries written for sensitive actions with actor, role, request id and reason; `UPDATE`, `DELETE` and `TRUNCATE` all refused because `app_user` holds only `SELECT` and `INSERT`; metadata refused when it would carry a patient value.                                                                                                                                                                                                                                    |

Beyond those four, only where the ticket asked or the logic was genuinely tricky:
the appointment exclusion constraint under concurrency, the constraints and indexes
Prisma cannot express, UUID v7 ordering, recursive log redaction, request-ID handling,
HTTP hardening, and the tenant transaction's rollback behaviour.

**Coverage** (`apps/api`): 94.73% lines, 85.31% branch. Against the CLAUDE.md floors: auth
94.18%, tenancy (`src/db`) 97.36%, permissions (`src/common`) 93.53% and audit 100%, all
above the 90% requirement. Everything else is above the 80% requirement.

## Bugs found and fixed

Four were in code I had just written, found because the tests exercised the real paths
rather than asserting the shape of the code.

1. **Lockout never persisted.** The failed-login counter was written inside the `asSystem`
   transaction and then the function threw, rolling the increment back. Lockout would
   never have triggered in production.
2. **Family revocation never persisted**, identically: a reused refresh token was revoked
   and then the throw rolled it back, so a stolen token would have kept working.
3. **Every tenant-scoped request was a 500.** `tenantMiddleware` passed a completion
   callback to Express's `next()`, and Express treats any truthy argument as an error.
4. **UUID v7 could stall the process for minutes.** The first version busy-waited for the
   wall clock on counter overflow; a test blocked for 477 seconds. A forward clock jump
   would have done the same in production.

Also: a `/ready` regression from 503 to 500 that my own test initially enshrined rather
than caught; `pg.Pool` crashing the process on an idle-client error (M1-02, now the
adapter's responsibility and re-verified); and `tokenHashesMatch` was dead code.

## Not verified here

- **No end-to-end run against the local docker stack.** Every HTTP test uses supertest
  against an in-process app. To exercise it for real:
  `docker compose up -d && pnpm db:migrate && pnpm db:sql && pnpm db:seed && pnpm dev`.
- **CI has not run this branch.** The workflow is valid, its database steps were verified
  against a clean throwaway database, and the steps call the same root scripts as local,
  but nothing has been pushed so no runner has executed it.
- **`pnpm openapi` is still a stub** (M1-03, out of scope), so the zod-4 OpenAPI VERIFY
  item in `docs/STACK.md` remains open.
- **The in-memory rate-limit store is single-instance.** The login throttle is not a real
  control until a shared store exists. Tracked for M7 in `docs/STACK.md`.
- **No human security review.** AI-only review is the weakest control here. A human
  security review is required before this platform touches real patient data. Nothing in
  this branch changes that.

## Open issues

Reviewed 2026-10-28. Four were fixed, three deferred.

### Fixed

1. **`prisma migrate dev` demanded a database RESET.** Resolved. `pnpm db:migrate:create
<name>` writes a migration by diffing the migrations directory against the schema,
   using a throwaway Testcontainers PostgreSQL as the shadow database, so no real
   database is read or written and no reset is offered. Verified in both directions, and
   it also confirms the hand-written `support_sessions` migration was correct. Workflow in
   `docs/STACK.md`.
2. **`INTERNAL_ADMIN` audit scope.** Now the organisations it has opened a support session
   for, plus its own actions, rather than its own actions alone. **Still narrower than the
   agreed table in one respect:** the table also says "assigned organisations", and no
   assignment mechanism exists, so an organisation this admin has never opened a session
   for stays invisible. Expired and revoked sessions still count, because the question is
   which clinics the admin has been involved with.
3. **Platform roles could not read the audit log at all.** Found while checking issue 2:
   the route sat behind `tenantMiddleware`, which requires an organisation, so SUPER_ADMIN
   and INTERNAL_ADMIN were refused despite the matrix granting both. Scope is now resolved
   per principal, and the pattern is extracted as `withPrincipalScope` because every
   `/api/v1/admin` route in M1-11 has the same shape.
4. **CI database steps.** They now call the same root scripts a developer calls, so the two
   cannot drift. Added a Docker availability check before them, and fixed the test
   harness swallowing migration errors into an unread buffer. Verified against a clean
   throwaway database: migrate, SQL, then policy coverage reporting 25 tenant tables each
   with `tenant_isolation` ENABLED and FORCED.

### Deferred

5. **`auditRead` has no caller.** The patient, prescription and recording routes it wraps
   are M2, and it is already tested directly, so nothing is at risk by waiting.
6. **Data-scope rules are helpers, not yet applied to queries.** M1-11 covers
   organisations, users, phone numbers and voice agents, none of which carry an `own`,
   `assigned` or `masked` scope, so nothing in M1-11 needs them.
7. **`AI_DOCS/` versus `docs/`.** A decision about which tree is authoritative, not a
   defect, and nothing writes to both today.
8. **ADF removal.** Waiting on your call, because removing `.claude/skills/` also removes
   `/do` and `/retrospective`.
9. **Coverage floors are not enforced by CI.** Deferred to M1-13: per-path thresholds need
   a deliberate choice about which paths carry 90, and switching them on without that
   would fail CI on an unrelated dip. Measured by hand every run instead.

## Remaining in M1

M1-03 (OpenAPI stubs and generated client) and M1-11 (organisation, user, phone and
voice-agent APIs) were out of scope. M1-12 is the foundation review and must run in a
**fresh session**, not this one. M1-13 is the CI follow-ups, which issues 1 and 7 above
belong to.
