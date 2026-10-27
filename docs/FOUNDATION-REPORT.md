# Backend foundation report (M1-04 to M1-10)

**Branch:** `feat/foundation-backend`, 7 commits, not pushed and not merged.
**Date:** 2026-10-27. **Scope:** M1-04 to M1-10. M1-03 and M1-11 were out of scope.

`pnpm check` is green from a clean clone with `--frozen-lockfile`: typecheck, lint,
**514 tests** (401 in `apps/api`, 113 in `packages/shared`), and the OpenAPI drift stub.
`pnpm audit --audit-level high` reports no known vulnerabilities.

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

**Two isolation locks (M1-06, M1-07).** Row-level security on 24 tables, `ENABLED` and
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

**Coverage** (`apps/api`): 94.63% lines, 84.72% branch. Against the CLAUDE.md floors:
auth 94.18%, tenancy (`src/db`) 97.22%, permissions (`src/common`) 93.53%, audit 100% —
all above the 90% requirement; everything else above the 80% requirement.

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
- **The local dev database at port 5433 does not have the `support_sessions` table.**
  Applying it needs `prisma migrate deploy`, which this session's permissions deny. Run
  `pnpm db:migrate && pnpm db:sql` yourself. The table IS created and tested in
  Testcontainers, so the migration itself is verified.
- **CI has not run this branch.** The workflow is valid and its new steps (migrate, SQL,
  policy coverage) match the local commands, but nothing has pushed.
- **`pnpm openapi` is still a stub** (M1-03, out of scope), so the zod-4 OpenAPI VERIFY
  item in `docs/STACK.md` remains open.
- **The in-memory rate-limit store is single-instance.** The login throttle is not a real
  control until a shared store exists. Tracked for M7 in `docs/STACK.md`.
- **No human security review.** AI-only review is the weakest control here, and
  `docs/ROADMAP.md` already says a human security review is required before real patient
  data. Nothing in this branch changes that.

## Open issues

1. **`prisma migrate dev` now demands a database RESET.** The hand-written SQL in
   `prisma/sql` (policies, roles, constraints) is drift it cannot account for, so
   `db:migrate` is `prisma migrate deploy` and the `support_sessions` migration was
   hand-written. A new migration needs either `prisma migrate diff` with a shadow
   database or the same hand-written route. Worth deciding deliberately in M1-13.
2. **`INTERNAL_ADMIN` audit scope is narrowed.** The agreed table says "organisations they
   are assigned plus support sessions they opened", but no assignment table exists until
   M1-11, so it is restricted to their own actions. Showing less than the table allows is
   the safe direction, but it IS a deviation.
3. **`auditRead` has no caller.** It is tested directly and ready; the patient,
   prescription and recording routes it is for arrive in M2.
4. **Data-scope rules are enforced as helpers, not yet applied to queries.** `scopeFilter`
   returns the filter a repository must merge, and `clinic_opt_in` fails closed, but no
   repository consumes them yet because the resources they govern are M2. The helpers are
   unit tested.
5. **`AI_DOCS/` versus `docs/`.** Two documentation trees now exist; `AI_DOCS/` arrived
   with the ADF framework. Decide which is authoritative before anything writes to both.
6. **ADF removal is pending, by your decision.** `.claude/` carries ~700 vendored ADF
   files. Removing them also removes `/do` and `/retrospective`. A single clean commit can
   drop ADF and keep the 11 project skills, `guard.mjs`, `format.mjs` and `settings.json`.
7. **Coverage floors are not enforced by CI.** They are met today and measured by hand.
   Wiring a threshold into the test command is M1-13.

## Remaining in M1

M1-03 (OpenAPI stubs and generated client) and M1-11 (organisation, user, phone and
voice-agent APIs) were out of scope. M1-12 is the foundation review and must run in a
**fresh session**, not this one. M1-13 is the CI follow-ups, which issues 1 and 7 above
belong to.
