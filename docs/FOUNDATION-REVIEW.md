# Foundation review (M1-12), branch `feat/foundation-backend`

**Reviewer:** fresh session, no part in writing this code. **Date:** 2026-10-28.
**Reviewed:** 19 commits between `main` and `feat/foundation-backend` (the brief said 15; the
branch carries 19), read in the order asked: schema and RLS, tenant client, auth, permissions,
audit, then the closing fix commits. **Docker was available, so every database check ran.**

## Verdict

**Safe to build APIs on: yes after fixes.** The architecture is sound and unusually well
tested for a foundation: two independent isolation locks, 25 tenant tables with `tenant_isolation`
ENABLED and FORCED, a permission matrix that matches the agreed table in all 102 cells, an audit
table the application genuinely cannot rewrite, and tests that fail when I sabotage the thing they
claim to protect (I verified that three separate ways). Three findings must be fixed first.
The request transaction commits **after** the HTTP response is sent, which is not a theoretical
race: I reproduced a 50 percent failure rate on read-after-write, and it is already causing an
intermittent failure in the device-boundary security tests that `pnpm check` does not surface.
The database lock has a self-service bypass, because `app.platform` is an ordinary settable GUC
and the API's own role can turn it on at session scope, which I proved unlocks every tenant table
and persists on the pooled connection. And the one PHI-flagged read endpoint that exists writes no
audit row, while the guard that claims to prevent exactly that inspects route metadata rather than
behaviour. None of the three is reachable by an external attacker today, because no user-controlled
value reaches raw SQL and the affected paths are internal. All three undermine the specific
guarantees the next ticket will be built on top of, and all three have small fixes.

The deferred items in `docs/FOUNDATION-REPORT.md` are honestly reported and none of them blocks
M1-11. The report's numbers are accurate: I reproduced 521 tests and the coverage figures exactly.
Its one overstatement is the claim that everything outside the named modules clears the 80 percent
floor, which is true per directory and false per file.

---

## Critical

### C1. The tenant transaction commits after the response is sent, so a client is told a write succeeded before it is durable

- **Where:** `apps/api/src/db/tenant.middleware.ts:41-71`, specifically the `settle` handler on
  `res.once('finish')` at lines 56-58.
- **What happens:** the whole request runs inside `withTenant`'s interactive transaction, and the
  transaction callback does not return until the response has finished. Prisma therefore issues
  `COMMIT` _after_ Express has flushed the response. The client holds a 201 while the data is
  still uncommitted.
- **Failure scenario:** a client, the Android app, or the voice agent does a write and then
  immediately reads or uses what it wrote. The follow-up request opens a different transaction on
  a different pooled connection, does not see the row, and fails. I reproduced this against the
  real database: issuing a pairing code (201 confirmed) and immediately redeeming it failed
  **10 times out of 20**. This is also the cause of the intermittent failure below.
- **Second failure mode:** if the `COMMIT` itself fails, the response has already been sent with a
  success status. The `.catch` at line 65 calls `next(error)`, and the error handler at
  `apps/api/src/app.ts:128-131` sees `res.headersSent` and re-delegates to Express, which destroys
  the socket. The client has been told the write succeeded and nothing was written.
- **Suggested fix:** do not tie the transaction's lifetime to the response lifecycle. Let the
  handler complete its work inside the transaction, commit, and only then write the response. If
  the request-wide transaction is to be kept, buffer the response and send it after the commit
  resolves.
- **Verified** (reproduced with a temporary probe test against the Testcontainers database, since
  removed; tree confirmed clean).

### C2. `app_user` can grant itself cross-tenant access, and it survives on the pooled connection

- **Where:** `apps/api/prisma/sql/001_constraints_rls_roles.sql:98-108` and `119-127` (every
  policy's `OR current_setting('app.platform', true) = 'on'`), with
  `apps/api/src/db/tenant-client.ts:66` as the intended setter.
- **What happens:** `app.platform` is a plain PostgreSQL custom GUC. Any role may set it, including
  the unprivileged `app_user` the API connects as, and setting it with the third argument `false`
  makes it **session**-scoped rather than transaction-scoped, so it outlives the statement and
  every later transaction on that connection. `withTenant` sets `app.org_id` and never clears
  `app.platform`.
- **Failure scenario, proven:** connected as `app_user`, scoped to organisation A, `patients`
  returned 1 row. After a single `SELECT set_config('app.platform','on',false)`, the same
  connection, still setting `app.org_id` to organisation A, returned 2 patients, 2 organisations,
  and organisation B's patient row by explicit filter. `current_setting('app.platform')` still read
  `on` afterwards. Any future SQL injection, any raw query that interpolates input, or any code
  that calls `set_config` with the wrong third argument escalates to full platform scope and leaks
  it into unrelated requests that reuse the connection. This is the exact scenario the second lock
  exists to contain, and the second lock does not contain it.
- **Suggested fix:** stop using a client-settable GUC as the authority. Make the platform branch
  depend on something `app_user` cannot assert: a separate database role (`app_platform`) that the
  policy tests with `pg_has_role(current_user, 'app_platform', 'member')`, or a `SECURITY DEFINER`
  function owned by `app_owner` that is the only way to set the flag. As a cheap interim defence,
  have `withTenant` execute `set_config('app.platform','',true)` alongside `app.org_id`, so a
  leaked session value cannot widen a tenant-scoped request.
- **Verified** (reproduced with a temporary probe test, since removed).

### C3. The only PHI-flagged read endpoint writes no audit row, and the guard that claims to prevent that cannot detect it

- **Where:** `apps/api/src/modules/audit/audit.routes.ts:22-32` declares
  `phiSensitive: true, auditAction: 'audit_log.read'`. The handler at lines 37-85 and `readPage`
  at lines 91-123 never call `audit.record` or `audit.recordRead`. The guard is
  `apps/api/src/modules/audit/phi-routes-are-audited.test.ts:31-38`.
- **What happens:** the guard filters `getRegisteredRoutes()` for `phiSensitive` and asserts that
  `auditAction` is a non-empty string. It reads the route **descriptor** and never the route's
  behaviour, so declaring an audit action is sufficient to satisfy it. In the whole application
  there are exactly two calls into the audit module
  (`apps/api/src/modules/support-sessions/support-sessions.service.ts:75` and the unused
  `auditRead` wrapper), so `GET /api/v1/audit-logs` satisfies the guard while recording nothing.
  For a clinic role the route runs under `withTenant`, which writes nothing at all; a platform role
  at least leaves an unattributed `system.scope.used` row from `asSystem`.
- **Failure scenario:** a clinic owner reads the entire audit trail for their organisation and no
  record of that read exists. Root `CLAUDE.md` rule 5 ("sensitive reads and writes call
  `audit.record`") is violated by the only sensitive read that ships, and the test named to prevent
  it reports green. Every PHI route in M2 will be built behind the same guard, with the same false
  assurance.
- **Suggested fix:** add the `audit.record` call to the audit route. Then strengthen the guard so
  it tests behaviour: drive each `phiSensitive` route through the app and assert an audit row with
  the declared `auditAction` appears, or at minimum assert that every declared `auditAction` value
  is produced by some code path. I confirmed the guard's blindness directly: with the only real
  `audit.record` call deleted, `phi-routes-are-audited.test.ts` still passed 4 of 4 (two
  integration tests in `tests/audit.test.ts` and `tests/support-sessions.test.ts` did catch it,
  which is the behaviour the guard should have had).
- **Verified** (read the code, then ran the sabotage and reverted it).

---

## Important

### I1. Lockout is proven to be recorded and never proven to be enforced

`apps/api/src/modules/auth/auth.service.ts:96-99`. The test at `tests/auth.test.ts:134-163` sends
five wrong passwords and then asserts on the database row (`failedLoginCount >= 5`,
`lockedUntil` not null). No test ever attempts a login against a locked account, so the branch that
refuses one is never executed: my coverage run reports `auth.service.ts` lines **97-98 uncovered**,
which is precisely that branch. The lockout could be inverted or dead and the suite would stay
green. **Failure scenario:** a brute-force run continues past five failures because the refusal
never fires in production either, and nothing would have told anyone. **Fix:** assert that a login
with the _correct_ password returns 401 while `lockedUntil` is in the future, and that it succeeds
once the lock expires. **Verified** (read the test, confirmed the uncovered lines in my own
coverage run).

### I2. An account can be kept locked indefinitely by an unauthenticated attacker

`apps/api/src/modules/auth/auth.repository.ts:63-81` with
`apps/api/src/modules/auth/auth.service.ts:96-114`. `failedLoginCount` is reset only by a
_successful_ login (`recordSuccessfulLogin`, line 83-88). It is never reset when a lock expires. So
after five failures the counter sits at 5 forever, and the next single wrong password increments it
to 6, which is `>= LOGIN_MAX_FAILURES`, and re-locks for another 15 minutes. **Failure scenario:**
anyone who knows a clinic owner's email sends one wrong password every 15 minutes and that owner
can never sign in again, from any address, at a cost of 4 requests an hour. The per-email throttle
(5 per minute) does not interfere. **Fix:** reset `failedLoginCount` to 0 when a lock is found to
have expired, before counting the current attempt. **Verified** (read).

### I3. `asSystem`'s audit row is rolled back on every failure path, so the escape hatch is silent exactly when it matters

`apps/api/src/db/tenant-client.ts:63-87`. The `system.scope.used` row is written inside the same
transaction as the work. Every caller that throws from inside the callback therefore discards its
own audit row: `changePassword` (lines 246, 256, 261 of `auth.service.ts`), `pairDevice`
(`devices.service.ts:87, 98`), `authenticateDevice` (`devices.service.ts:132`), `currentUser`
(`auth.service.ts:278`), and `openSupportSession` (`support-sessions.service.ts:51`). The comment at
`tenant-client.ts:69` says "the escape hatch is never silent" and the test named for it
(`tests/audit.test.ts:256-268`) exercises only a successful login. **Failure scenario:** a rejected
password change, a failed device pairing and a rejected device token leave no trace whatsoever,
which are the three events an investigator would most want. Note that login _failure_ does persist,
because `login` deliberately returns an outcome instead of throwing. **Fix:** write the scope row
outside the work transaction, or in a short transaction of its own, and add a test that asserts a
row survives a failed `asSystem` call. **Verified** (read; the rollback mechanism is the same one
the report documents as having previously broken lockout).

### I4. The `permission` field on every route is decorative, and `requirePermission` has one caller

`apps/api/src/common/route-registry.ts:26` describes `permission` as "Permission required, from the
shared matrix". Nothing reads it. Across the application `requirePermission` is called in exactly
one production location, `apps/api/src/modules/audit/audit.routes.ts:56`. Two routes declare a
permission they never check: `POST /api/v1/support-sessions` declares `patients:read`
(`support-sessions.routes.ts:20`) and is gated only by an `isPlatformRole` test inside the service
(`support-sessions.service.ts:33`), and `POST /api/v1/devices/pairing-codes` declares
`device:create` (`devices.routes.ts:30`), which is not a resource in the matrix at all, and is
gated by a local `PAIRING_ROLES` set (`devices.service.ts:16`). **Failure scenario:** this is the
mechanism behind the defect the brief describes. A route carries a plausible permission string, a
reviewer reads it as enforcement, and no test connects the string to a check. In M1-11 that pattern
is about to be copied across every `/api/v1/admin` and `/api/v1/org` endpoint. **Fix:** either make
the registry's `permission` the thing that is enforced (a middleware that reads the descriptor and
calls `requirePermission`), or delete the field so it cannot be mistaken for a control. Add a test
asserting that every route declaring a permission has a matching enforced check. **Verified**
(grepped every caller; read both routes).

### I5. FORCE ROW LEVEL SECURITY is never actually exercised, because the test owner is a superuser

`apps/api/tests/support/global-setup.ts:16-29` creates the container with `app_owner_test` as the
PostgreSQL superuser, and all 28 tables are owned by it. I confirmed from the catalog:
`app_owner_test` has `rolsuper = true` and `rolbypassrls = true`. A superuser bypasses row-level
security regardless of `FORCE`, so `ownerClient()` reads everything for reasons unrelated to the
policy. Separately, the SQL creates an `app_owner` role (`001:140-149`) but never runs
`ALTER TABLE ... OWNER TO app_owner`, so in production the tables are owned by whichever role runs
`prisma migrate deploy`. **Failure scenario:** `FORCE` is the control that stops a non-superuser
table owner (a migration or operations connection) from reading across tenants, it is advertised in
the report and checked by `check-policies.ts`, and no test demonstrates it constrains anybody.
**Fix:** add a non-superuser owner role to the test harness and assert it is subject to the policy.
Decide and document who owns the tables in staging and production. **Verified** (queried
`pg_roles` and `pg_class.relowner` on the live test database).

### I6. `app_user` can rewrite the SQL migration ledger

`apps/api/prisma/sql/001_constraints_rls_roles.sql:157-179` grants `SELECT, INSERT, UPDATE, DELETE`
to `app_user` on every table in `public` except `audit_logs`, and the only explicit revoke is
`_prisma_migrations` at line 183. `apply.ts` creates `_openhours_sql_migrations` before the files
run, so the loop sees it and grants it. I confirmed from `information_schema.table_privileges` that
`app_user` holds all four privileges on `_openhours_sql_migrations`, and that
`_prisma_migrations` is the only table it cannot read. **Failure scenario:** a compromised or buggy
API deletes the ledger rows, and the next `pnpm db:sql` re-executes the historical SQL files.
Today those files are idempotent so the damage is limited, but the project's own comment at
`002:4-5` says re-running an old file is dangerous and that the ledger is what prevents it, so the
API should not be able to edit it. **Fix:** revoke all privileges on `_openhours_sql_migrations`
from `app_user` in a new `prisma/sql` file, and change the grant loop to an explicit allow-list or
to skip tables whose names begin with `_`. **Verified** (queried the live catalog).

### I7. The application lock's operation list is hand-maintained, incomplete, and unguarded

`apps/api/src/db/tenant-extension.ts:19-36`. `WHERE_OPERATIONS` omits `updateManyAndReturn`, which
the Prisma 7 client does generate (present in `src/generated/prisma/internal/class.ts` and the
model files). A call to `db.patient.updateManyAndReturn({ where, data })` under `withTenant` gets
no `organisationId` injected into its `where` and is not rejected, so the stated invariant that the
extension "injects organisation_id into every query" does not hold. No test asserts that the two
operation sets cover everything Prisma generates. Impact is contained today because row-level
security still applies inside the transaction, so the damage is the loss of the first lock, not a
leak. Related and smaller: nested relation writes and relation `include`/`select` do not pass
through `$allOperations` for the related model either, and this is not documented. **Fix:** derive
the operation list from the generated client, or add a test that enumerates Prisma's operations and
fails when one is unclassified. **Verified** (read the extension, confirmed the operation exists in
the generated client, confirmed its absence from the list).

### I8. The `TENANT_MODELS` drift guard compares a count, not names

`apps/api/tests/tenant-client.test.ts:58-71`. The test is titled "covers exactly the models that
have an organisation_id" and its only assertion is
`expect(rows).toHaveLength(TENANT_MODELS.size)`. It compares a count of `organisation_id` columns
in the catalog against the size of a hand-written set (it cannot compare names as written, because
one side is snake_case table names and the other PascalCase model names). **Failure scenario:** one
tenant table is added and one model is removed from `TENANT_MODELS` in the same change, the count
matches, the test passes, and the removed model silently throws at runtime instead of being scoped.
The runtime behaviour does fail closed (`tenant-extension.ts:157-163` refuses an unknown model),
which is why this is Important rather than Critical. **Fix:** map table names to model names and
assert set equality. **Verified** (read).

### I9. Authentication middleware is below both coverage floors, and the report's per-directory figures hide it

My own `pnpm test:coverage` run reproduces the report's headline numbers exactly (94.73 percent
lines, 85.31 percent branch, auth 94.18, `src/db` 97.36, `src/common` 93.53, audit 100). Per file,
`src/common/auth.middleware.ts` is at **77.55 percent**. That file is `requireAuth`,
`requireDevice`, `requireUser` and `requireOrganisation`: authentication code, which root
`CLAUDE.md` puts under the 90 percent floor, and it is below even the 80 percent general floor.
`src/common/cookies.ts` (the refresh-cookie reader) is at **75 percent**. The report's claim that
"everything else clears the 80 percent requirement" is true of directory aggregates and false of
these two files. **Fix:** cover the uncovered branches, and when CI coverage thresholds land in
M1-13 set them per file rather than per directory, otherwise this stays invisible. **Verified**
(ran the coverage report and read the per-file JSON).

### I10. Uniform login timing is claimed everywhere and asserted nowhere

The ticket, `docs/FOUNDATION-REPORT.md` and `apps/api/src/common/passwords.ts:24-33` all treat
equal timing between an unknown email and a wrong password as a control. The test that covers it
(`tests/auth.test.ts:124-132`) compares status, title and detail only. I grepped the whole suite:
the only timing assertion in the repository is in `src/common/uuid.test.ts:98-101`. Two real
asymmetries exist and are unmeasured: the known-email path performs an extra database write
(`recordFailedLogin`) that the unknown path does not, and the decoy hash is built lazily on first
use (`passwords.ts:31`), so the very first unknown-email request in a process pays an extra argon2
**hash** on top of the verify. **Fix:** either add a test with an explicit tolerance, or stop
describing it as a verified control and record it as a best-effort mitigation. **Verified**
(grepped; read).

### I11. The INTERNAL_ADMIN audit scope rests on one application `where` clause with no database lock beneath it

`apps/api/src/modules/audit/audit.routes.ts:97` runs the read through `withPrincipalScope`, which
for a platform role is `asSystem`, which sets `app.platform = 'on'` and therefore disables every
policy for that transaction. The only thing restricting an INTERNAL_ADMIN to its own organisations
is the `scopedTo` `OR` clause built at `audit.repository.ts:79-86`. **Failure scenario:** a future
refactor that drops or mis-builds that clause exposes every clinic's audit trail with no second
line of defence, and the trail is the record of who touched patient data. The two tests at
`tests/audit.test.ts:142` and `:186` do cover the behaviour today, and removing
`requirePermission` made three tests fail, so this is a defence-in-depth gap rather than a live
defect. **Fix:** prefer scoping the query to the organisation set with `app.org_id` per
organisation, or add a policy branch that reads an explicit allow-list GUC, so the database
constrains platform reads too. **Verified** (read; confirmed by the sabotage run).

### I12. argon2 parameters are library defaults, unpinned and unasserted

`apps/api/src/common/passwords.ts:8` is `{ type: argon2.argon2id }` and nothing else. I measured
the effective parameters by hashing: `m=65536, p=4, t=3` with argon2 0.45.1. Those exceed the OWASP
minimum and are fine today. They are, however, whatever the library chooses, there is no test
asserting them, and a dependency bump could lower them silently. The report lists "argon2id
parameters" as verified, which is true of the algorithm and not of the cost. **Fix:** set
`memoryCost`, `timeCost` and `parallelism` explicitly and assert them in a unit test. **Verified**
(ran argon2 and read the encoded hash prefix).

### I13. The `role` claim is not validated, and an unrecognised role crashes instead of denying

`apps/api/src/modules/auth/auth.tokens.ts:55-62` accepts any string as `role`.
`apps/api/src/common/permissions.ts:37` casts it with `as Role`, and
`packages/shared/src/permissions.ts:249` then indexes `PERMISSIONS[resource][role][action]`. I
confirmed that an unknown role throws `TypeError: Cannot read properties of undefined` rather than
returning `false`. The practical risk is low, because only our own signing key can mint a token and
`signAccessToken` takes the role from a database enum, so this needs the JWT secret to exploit. It
still means the "default deny for anything not listed" property holds for resources and actions but
not for roles, and a database enum value added without updating the matrix becomes a 500 on every
request by that role rather than a clean 403. **Fix:** validate `role` against `ROLES` in
`verifyAccessToken` and reject the token otherwise; make `permissionScope` return `false` for an
unknown role. **Verified** (ran it).

---

## Minor

- **Duplicate security predicate.** `isPlatformRole` is defined twice, at
  `apps/api/src/common/auth.middleware.ts:59-62` (a local `Set`) and
  `packages/shared/src/permissions.ts:239`. `principal-scope.ts` imports the shared one, the audit
  route imports the shared one, and the middleware uses its own. Two definitions of "may act across
  tenants" can diverge. Delete the local copy. **Verified** (read).
- **Dead code.** `isCrossTenantPrincipal` (`apps/api/src/common/permissions.ts:136-137`) has no
  caller and no test. Root `CLAUDE.md` forbids dead code. **Verified** (grepped).
- **Redaction key list has gaps for this codebase's own secrets.** `apps/api/src/common/redaction.ts:20-51`
  lists `passwordhash` but not `tokenhash`, `codehash` or `code`. Current logging is clean (the
  pairing code is never logged, `devices.service.ts:53-56` logs only the expiry), so this is
  latent. Add the three keys. **Verified** (read).
- **A test expires every refresh token in the database.** `tests/auth.test.ts:232-237` runs
  `updateMany({ where: { revokedAt: null } })`, affecting rows belonging to other tests in the file.
  It happens to be harmless because later tests log in again, and `fileParallelism: false` keeps
  files from colliding. Scope it to the token under test. **Verified** (read).
- **The lockout test never exercises real password verification.** `tests/auth.test.ts:142` stores
  a deliberately malformed hash, so `verifyPassword` fails via its `catch` rather than by comparing.
  The test would pass if verification were broken to always return false. **Verified** (read).
- **Audit cursor pagination orders by one column and cursors on another.**
  `apps/api/src/modules/audit/audit.repository.ts:101-103` orders by `createdAt desc, id desc`
  while the cursor is `{ id }`. This is consistent only because UUID v7 is time-ordered. A row
  written with an explicit `createdAt`, or a clock correction, can make a page skip or repeat.
  Order by `id` alone, or cursor on both columns. **Verified** (read).
- **`packages/shared` has no coverage measurement**, so the coverage of the matrix file itself is
  unknown. Its 112 generated tests are strong, so this is a reporting gap, not a risk. **Verified**
  (read `vitest.config.ts`; no coverage block in the shared package).
- **CI runs on `pull_request` only** (`.github/workflows/ci.yml:4-5`), so nothing runs on a push to
  a branch or to `main`. Consistent with the rule against pushing to `main`, worth stating.
  **Verified** (read).
- **The intermittent failure is worth a ticket in its own right.** Under `pnpm test:coverage` the
  `beforeAll` at `tests/auth.test.ts:360-375` failed once in two runs (`expected 401 to be 201` at
  line 372), which **skipped 5 device-boundary security tests** and reported "403 passed, 5
  skipped". The cause is C1. Until C1 is fixed, a security suite can silently stop asserting.
  **Verified** (observed; reproduced the underlying race separately).

---

## Section-by-section results

### 1. Tenant isolation

All 28 tables in `public`, from the live catalog: 25 carry `tenant_isolation`, ENABLED and FORCED,
with a single policy each. The three without are `_prisma_migrations`, `_openhours_sql_migrations`
and `refresh_tokens`. The 25 are: `appointments`, `audit_logs`, `calls`, `clinic_hours`, `devices`,
`doctor_services`, `doctor_time_off`, `doctor_working_hours`, `doctors`, `follow_ups`,
`forwarding_events`, `forwarding_schedules`, `notifications`, `organisations`, `outbound_calls`,
`pairing_codes`, `patients`, `phone_numbers`, `prescription_items`, `prescriptions`, `services`,
`support_sessions`, `users`, `voice_agents`, `webhook_events`.

I checked the policy **expressions**, not just their presence, because a policy named
`tenant_isolation` with `USING (true)` would satisfy `check-policies.ts`. There are exactly two
distinct expressions across all 25, identical in `USING` and `WITH CHECK`: 24 tables compare
`organisation_id` and `organisations` compares `id`, both with the `app.platform` escape described
in C2. No policy is permissive in the dangerous sense.

Which test proves cross-organisation read, update and delete: `tests/tenant-isolation.test.ts`
(135 tests) generates per-table cases over all 25 for read, update, insert and the no-context case,
and `tests/tenant-client.test.ts` (20 tests) covers the extension. I verified these are real tests
rather than tautologies by disabling the `patients` policy in a scratch copy: 5 tests failed across
read, update, insert and fail-closed, and `check-policies` failed. Reverted.

The app role: `app_user` has `rolsuper = false`, `rolbypassrls = false`, is not the table owner, and
`pg_auth_members` shows it holds **no** role memberships, so it cannot `SET ROLE` to the owner. I
tried, as `app_user`: `SET ROLE app_owner`, `SET ROLE app_owner_test`,
`ALTER TABLE patients DISABLE ROW LEVEL SECURITY`, `DROP POLICY tenant_isolation ON patients`,
`ALTER ROLE app_user BYPASSRLS`, `CREATE TABLE`, and reading `_prisma_migrations`. All seven were
refused. The one thing that succeeded is C2.

Fails closed with no `app.org_id`: confirmed by counting rows in all 25 tables as `app_user` with no
setting. Every one returned zero.

Tables without `organisation_id` that hold clinic data: `refresh_tokens` is the only one, and it is
**listed and justified** in `docs/architecture/erd-identity-tenancy-audit.md:107-116`. The reasoning
is sound: the owning user may be a platform user with no organisation, a nullable column cannot
satisfy an equality policy, and the table holds no patient data and no plaintext token, only a
unique SHA-256 hash. Worth stating plainly, though: it has no database lock at all, `app_user`
holds all four DML privileges on it, and its protection is entirely that every access goes through
`asSystem`. `RefreshToken` is deliberately absent from `TENANT_MODELS`, so a query under
`withTenant` throws rather than running unscoped, which is the right failure. The guard in
`check-policies.ts` is structurally blind to this class of table, since it only looks for an
`organisation_id` column or the literal name `organisations`.

Raw SQL: exactly one occurrence in `src`, `apps/api/src/health/health.repository.ts:35`
(`$queryRawUnsafe('SELECT 1')`). It carries no input and touches no tenant data. The two
`set_config` calls in `tenant-client.ts` bind their value as a parameter (`$1`) rather than
interpolating it. The remaining occurrences are in `tests/` and `prisma/seed.ts`. No raw query can
currently skip the tenant context with user-controlled input. Note that raw queries do **not** pass
through the client extension at all, so the "throws when there is no scope" guarantee does not
apply to them; this is fine at one call site and is a trap worth a comment.

The `check-policies` guard: I created a new table with an `organisation_id` and no policy in a
throwaway container. Baseline reported `OK: 25 tenant tables`. After the addition it exited 1 with
`FAIL zz_new_tenant_table: tenant isolation is incomplete` and
`1 of 26 tenant tables lack complete row-level security`. `app_user` also could not read it, because
the grant loop had not run for it, so it fails closed twice. The guard runs in CI at
`.github/workflows/ci.yml:114-115`. It is **not** part of `pnpm check`, so a local run does not
exercise it. What it does not check: the policy's expression, the `audit_logs` privilege revocation,
and any tenant table that carries no `organisation_id` column.

### 2. System access

`asSystem` has 10 call sites. For each: the reason string, who reaches it, and whether input can
choose the organisation.

| Call site                         | Reason                                  | Reachable by                          | Organisation chosen by input?                                                                                                              |
| --------------------------------- | --------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.service.ts:86`              | `auth.login`                            | anyone, unauthenticated               | No. The organisation is a result of authenticating.                                                                                        |
| `auth.service.ts:167`             | `auth.refresh`                          | holder of a refresh cookie            | No. Taken from the stored token row.                                                                                                       |
| `auth.service.ts:223`             | `auth.logout`                           | anyone                                | No.                                                                                                                                        |
| `auth.service.ts:244`             | `auth.change-password`                  | authenticated user                    | No. User id from the token.                                                                                                                |
| `auth.service.ts:275`             | `auth.me`                               | authenticated user                    | No. User id from the token.                                                                                                                |
| `support-sessions.service.ts:42`  | `support-session.open`                  | platform roles only                   | **Yes, by design.** `organisationId` comes from the request body (`support-sessions.routes.ts:44`). Gated by `isPlatformRole` and audited. |
| `support-sessions.service.ts:103` | `support-session.check`                 | no production caller                  | No.                                                                                                                                        |
| `devices.service.ts:75`           | `devices.pair`                          | anyone, unauthenticated, rate limited | No. Taken from the pairing-code row, which requires knowing a live code.                                                                   |
| `devices.service.ts:125`          | `devices.authenticate`                  | holder of a device token              | No. Taken from the device row.                                                                                                             |
| `principal-scope.ts:36`           | caller-supplied, currently `audit.read` | platform roles                        | No.                                                                                                                                        |

`withPrincipalScope` has one production call site, `audit.routes.ts:97`, reason `audit.read`. It
routes platform roles to `asSystem` and clinic roles to `withTenant`, and refuses a clinic role
with no organisation (`principal-scope.ts:39-46`). Its own docstring correctly warns that it decides
where a query may look and never whether the caller may run it, and the audit route does call
`requirePermission` first. That ordering is load-bearing and nothing enforces it; see I4.

Organisation id, role and user id come only from the verified token. `requireAuth`
(`auth.middleware.ts:25-56`) is the sole writer of `userId`, `role` and `organisationId` into the
request context, taking all three from `verifyAccessToken`. `requireDevice` (lines 98-127) sets an
organisation and a device id but deliberately **no role**, so a device cannot satisfy a permission
check. `tenantMiddleware` reads the organisation from the context only and touches no header, query
or body, and holds the scoped client in a `WeakMap` keyed by the request so another middleware
cannot substitute a differently-scoped one. One user-supplied organisation exists in the whole
surface, the support-session body, and it is the intended cross-tenant path.

### 3. Auth

argon2id confirmed, with the caveat in I12. Password minimum is 12 characters, enforced on change
(`auth.schemas.ts:18`) and deliberately not on login (`auth.schemas.ts:11-13`, so an older password
still works and the policy is not leaked to a guesser). Hashes and tokens: no password, token or
hash is logged anywhere I could find, and the redaction walker scrubs the relevant keys at any
depth. The test for it (`tests/auth.test.ts:660-679`) proves the redaction configuration rather than
the auth module's actual output, since it constructs its own logger and logs a synthetic object;
the report describes it as asserting that no credential reaches the logs, which is stronger than
what it does.

**The persistence mechanism, which the brief asked me to find:** it is the outcome-return pattern
documented at `auth.service.ts:70-80`. `login` and `refresh` never throw from inside the `asSystem`
transaction. They record what happened (`recordFailedLogin`, `revokeTokenFamily`), return a
discriminated outcome, let the transaction commit, and throw afterwards at lines 133-138 and
211-217. That is the correct fix for the rollback bug the report describes, and it is real.

The tests prove it against the real database, not mocks. `tests/auth.test.ts:197-218` logs in,
rotates once, replays the original token (401), and then presents the token that _was_ valid and
asserts it is now 401 too. That last assertion can only pass if the family revocation survived the
throw and committed. The whole `tests/auth.test.ts` file runs over Testcontainers PostgreSQL as
`app_user` through supertest against the real app. For lockout, the same pattern is _not_ fully
proven: see I1. Note that the same rollback trap is still live for `asSystem`'s own audit row
(I3) and for `changePassword`, which does throw from inside the transaction.

Access tokens: HS256, `alg` pinned via `algorithms: ['HS256']` at `auth.tokens.ts:50`, so neither
`none` nor algorithm confusion is accepted; issuer and audience are set and verified; expiry is
15 minutes by default and capped at 3600 seconds by config; claims are `sub`, `org`, `role`, plus
`iat` and `exp`. Every verification failure returns one indistinguishable error. The key is a
symmetric secret from validated config with a 32-character minimum. Shape is checked after
verification, except that `role` is not validated against the enum (I13). Tests cover a tampered
payload, a forged role and a missing header.

Device pairing: 6 characters over a 30-symbol Crockford-style alphabet, about 29.5 bits
(`tokens.ts:26-37`), 10-minute TTL from config, single use enforced by a conditional
`updateMany({ where: { id, consumedAt: null } })` and a `count !== 1` check in the same transaction
that creates the device (`devices.service.ts:90-99`), so two phones cannot race one code. Rate
limited at 10 requests per 10 minutes per IP on `/pair` (`devices.routes.ts:20`). Unknown, expired
and already-used codes all return one identical error, so the endpoint is not a code oracle. The
device token reaches only the forwarding endpoints: it is accepted solely by `requireDevice`, which
is mounted only in `forwarding.routes.ts:29`, and because it carries no role it cannot pass a
permission check. Both directions are tested, though those are the 5 tests that intermittently
skip. The honest caveat on the rate limit is the one the project already records: the store is
in-memory and per-process, so with N instances the effective limit is N times higher, and a
distributed attempt is bounded only by the 10-minute code lifetime.

Unknown user versus wrong password: the response is provably identical (same status, title and
detail, asserted at `tests/auth.test.ts:124-132`), and both paths spend one argon2 verification.
The timing claim itself is untested and has two known asymmetries. See I10.

### 4. Permissions

**Matrix comparison: no differences.** I compared all 17 resources against the table in the brief,
cell by cell, for all 6 roles and all 3 actions. All 102 cells match, including every scope
qualifier: `masked` for both platform roles on patients and appointments, `metadata` on call
history, `own` for the doctor on patients, appointments, call history and analytics,
`clinic_opt_in` for staff on recordings, `assigned` for staff on follow-ups, `usage` on analytics,
`audit_scope` for INTERNAL_ADMIN on the audit log, and `none` for every platform role on
recordings, prescriptions and follow-ups. The `permissionScope` function returning the scope rather
than a boolean is a genuinely good decision and the comment explaining it is correct.

**Granted cells with no end-to-end test: 64 of 67.** There are 67 resource-by-role cells with at
least one granted action. Only one resource has an implemented route, so only three cells are
proven end to end through the real middleware chain: `audit_log` for SUPER_ADMIN
(`tests/audit.test.ts:128`), INTERNAL_ADMIN (`:142` and `:186`) and CLINIC_OWNER (`:101`). The
remaining 64 are:

| Resource                 | Granted cells with no end-to-end test                             |
| ------------------------ | ----------------------------------------------------------------- |
| `platform_users`         | SUPER_ADMIN                                                       |
| `organisations`          | SUPER_ADMIN, INTERNAL_ADMIN, CLINIC_OWNER                         |
| `phone_voice_mapping`    | SUPER_ADMIN, INTERNAL_ADMIN, CLINIC_OWNER                         |
| `clinic_settings`        | SUPER_ADMIN, INTERNAL_ADMIN, CLINIC_OWNER, CLINIC_MANAGER         |
| `clinic_users`           | SUPER_ADMIN, INTERNAL_ADMIN, CLINIC_OWNER, CLINIC_MANAGER         |
| `doctors_services_hours` | all six roles                                                     |
| `patients`               | all six roles                                                     |
| `appointments`           | all six roles                                                     |
| `call_history`           | all six roles                                                     |
| `recordings`             | CLINIC_OWNER, CLINIC_MANAGER, STAFF                               |
| `prescriptions`          | CLINIC_OWNER, DOCTOR                                              |
| `follow_ups`             | CLINIC_OWNER, CLINIC_MANAGER, DOCTOR, STAFF                       |
| `reminder_settings`      | SUPER_ADMIN, INTERNAL_ADMIN, CLINIC_OWNER, CLINIC_MANAGER, STAFF  |
| `forwarding_schedules`   | SUPER_ADMIN, INTERNAL_ADMIN, CLINIC_OWNER, CLINIC_MANAGER         |
| `analytics`              | SUPER_ADMIN, INTERNAL_ADMIN, CLINIC_OWNER, CLINIC_MANAGER, DOCTOR |
| `integration_errors`     | SUPER_ADMIN, INTERNAL_ADMIN                                       |

Most of this is simply work that has not happened: those routes are M1-11 and M2. The finding is not
the count, it is that nothing will tell anyone when a route ships without its end-to-end
permission test, which is exactly how the audit-log defect hid. The 112 generated tests in
`packages/shared/src/permissions.test.ts` assert the table against an independent transcription and
nothing about reachability. I recommend a guard analogous to the PHI one, fixed per I4: every route
declaring a permission must have a test proving the granting roles reach it and a denied role does
not.

**Denied cells:** 35 cells are fully denied, and exactly one has an end-to-end denial test, STAFF
on `audit_log` (`tests/audit.test.ts:112`). I confirmed it is a real test: removing
`requirePermission` from the audit route turned it from 403 to 200 and failed three tests. Denials
are otherwise covered only at unit level in `src/common/permissions.test.ts` and the generated
shared tests. CLINIC_MANAGER and DOCTOR on `audit_log` are denied by the matrix with no test of any
kind at route level.

**Default deny:** holds for resources and actions, which are closed TypeScript unions with no
fallthrough, and `requirePermission` throws `ForbiddenError` on `false`. It does not hold for an
unrecognised role, which throws a `TypeError` and becomes a 500 (I13).

**Masked views:** `maskPatientFields` (`permissions.ts:71-96`) nulls `fullName`, `phone`,
`dateOfBirth`, `notes` and `transcript`, which covers name, phone and notes as required. It nulls
only fields present on the row and is unit tested. It has **no production caller**, and neither do
`shouldMask`, `scopeFilter` or `hasActiveSupportSession`. Masking is therefore a tested helper, not
yet an enforced control. The report discloses this as deferred item 6 and the reasoning holds for
M1-11.

**Support sessions:** a session is required to unmask by the design of `shouldMask`, which is not
yet wired. It is scoped to one organisation and one platform user
(`support-sessions.service.ts:104-110` filters on both). A reason is required and substantive,
`z.string().trim().min(10).max(500)` at `support-sessions.routes.ts:12`. The duration is fixed at 60
minutes in code (`service.ts:19`), not client-supplied. Expiry is evaluated on the server on every
check, with `expiresAt: { gt: new Date() }` and no caching, and revocation is honoured through
`revokedAt: null`; both are tested (`tests/support-sessions.test.ts:190`, `:210`). An audit entry is
written through the audit module so it carries request id, IP and user agent
(`service.ts:75-81`), and I proved that test is real by deleting the call and watching two
integration tests fail. A clinic role is refused (`tests/support-sessions.test.ts:123`). The two
gaps are that the declared `patients:read` permission is never checked (I4) and that opening
sessions is not rate limited, so a platform admin can open one per organisation, each audited.

### 5. Audit

**Append-only is enforced in the database, not only in code.** From
`information_schema.table_privileges`, `app_user` holds exactly `SELECT` and `INSERT` on
`audit_logs` and nothing else, while on a comparison table (`patients`) it holds all four. I ran the
statements as `app_user`: `UPDATE audit_logs SET action='x'`, `DELETE FROM audit_logs` and
`TRUNCATE audit_logs` were all refused. The mechanism is the absence of the grant
(`001:168-173`), so it fails at the database even if a repository tries. `tests/audit-immutability.test.ts`
covers the same ground. One caveat: `check-policies.ts` does not verify the revocation, so a future
grant loop that forgot the `audit_logs` branch would not be caught by the guard.

**No PHI, tokens, passwords or full phone numbers in audit payloads.** `assertSafeMetadata`
(`audit.service.ts:70-78`) rejects a metadata key named after any of 18 patient or secret fields and
throws rather than silently stripping, which is the right choice. The type restricts values to
primitives and string arrays, so a nested object cannot carry a patient record past the top-level
key check. Actor, role, organisation, IP, user agent and request id all come from the request
context and never from arguments, so a caller cannot attribute an action to someone else. Tests
cover both the refusal and the context attribution.

**Can the PHI-audit test pass while a route is missing an audit call? Yes.** This is C3. I removed
the only real `audit.record` call from `support-sessions.service.ts` in a scratch copy and
`phi-routes-are-audited.test.ts` passed 4 of 4. Two integration tests did fail, which is the real
protection. Reverted.

Two further audit observations. The `system.scope.used` row written by `asSystem`
(`tenant-client.ts:72-81`) sets no `actorUserId`, `actorRole` or `organisationId`, so platform-scope
records are unattributed, and it is rolled back on every failure path (I3). And M1-08 asks for
login success and failure, logout, password change, token reuse and device pairing to be audited;
what exists is a generic `system.scope.used` row carrying only a reason string such as
`auth.login`, which is identical for a successful and a failed login and names no user. Those
specific audit actions are not implemented.

### 6. Test quality

**Expected values copied from the code rather than the spec.** I checked the obvious candidates and
found the discipline good. The lockout test uses the literal `5` from the ticket rather than
`config.LOGIN_MAX_FAILURES`, the page-size cap test asserts the documented maximum, and no test in
`tests/` imports `src/config.ts` to assert against it except `tests/readiness.test.ts`, which uses
it for a timeout rather than an expectation. The report volunteers the one historical instance (a
`/ready` test that enshrined a 500 regression instead of catching it), and that test now asserts 503. The weaker cases I did find are described above and are about what the tests _omit_ rather
than where their numbers came from: the lockout test asserts database state instead of refusal
(I1), the credential-logging test asserts the redaction config instead of the auth module's output
(I10 area), and the `TENANT_MODELS` guard asserts a count instead of names (I8).

**Security tests that would still pass with the protection removed.** I ran three sabotage
experiments, each reverted, and the tree is clean.

1. Disabled the `tenant_isolation` policy on `patients` and turned RLS off for that table.
   `tests/tenant-isolation.test.ts` failed 5 tests: foreign read, foreign update, foreign insert,
   and both no-context cases. The isolation suite is genuine.
2. Removed `requirePermission` from the audit route. `tests/audit.test.ts` failed 3 tests: the
   STAFF denial became a 200, and both INTERNAL_ADMIN scope tests began returning other
   organisations' rows. The permission enforcement is genuinely tested where it exists.
3. Removed the only real `audit.record` call. `phi-routes-are-audited.test.ts` passed, which is C3.
   Two integration tests failed.

So the answer is mixed in a useful way: the row-level security and permission tests are real and I
proved it; the PHI-audit guard is not, and I proved that too.

**Coverage, measured by me.** `pnpm test:coverage` in `apps/api`: 94.61 percent statements, 85.31
percent branch, 96.19 percent functions, 94.73 percent lines, over 817 statements. Against the
root `CLAUDE.md` floors:

| Area                                      | Lines           | Floor               | Result   |
| ----------------------------------------- | --------------- | ------------------- | -------- |
| auth (`src/modules/auth`)                 | 94.18           | 90                  | pass     |
| tenancy (`src/db`)                        | 97.36           | 90                  | pass     |
| permissions (`src/common/permissions.ts`) | 92.59           | 90                  | pass     |
| audit (`src/modules/audit`)               | 100             | 90                  | pass     |
| `src/common/auth.middleware.ts`           | 77.55           | 90 (authentication) | **fail** |
| `src/common/cookies.ts`                   | 75              | 80                  | **fail** |
| everything else, per file                 | 83.33 and above | 80                  | pass     |

`packages/shared` is not measured at all. Booking and webhooks do not exist yet, so their floors do
not apply.

### 7. Express and runtime

**An HTTP-level test does hit a tenant-scoped route through the real middleware chain.** Two do.
`tests/audit.test.ts` drives `GET /api/v1/audit-logs` through `createApp`, a real bearer token,
`requireAuth`, `requireUser` and the real scope resolution, and asserts 200 with a body.
`tests/auth.test.ts:364-367` drives `POST /api/v1/devices/pairing-codes` through
`requireAuth`, `requireUser`, `requireOrganisation` and `tenantMiddleware` and asserts 201. The
regression the brief mentions (a misused `next()` argument turning every tenant-scoped request into
a 500) would fail both. `tests/tenant-middleware.test.ts` adds 7 tests on a purpose-built Express
app covering commit, rollback on throw, rollback on a 4xx, the missing-organisation refusal and the
unwrapped-`tenantDb` error. The comment at `tenant.middleware.ts:60-62` records the original bug.

**UUID v7: no busy-wait, both clock directions handled, tests for both.** On counter overflow
`createUuidV7` borrows from the next millisecond (`uuid.ts:71-77`) rather than spinning, and the
comment records that an earlier version blocked for 477 seconds. A backwards clock is handled by the
same rule, holding `lastTimestamp` at the highest value already issued so no id can sort before an
earlier one. Tests cover ordering within a millisecond, across milliseconds, on counter overflow,
on a backwards jump (`uuid.test.ts:78`), and a far-future-then-rewind case that asserts the
generator returns in under a second (`:89-101`), which is the regression test for the stall.

**The migration script cannot touch a real database and cannot trigger a reset.** `prisma migrate
diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` reads two
files and replays history into a throwaway Testcontainers shadow database whose URL the script
injects. I ran it with `DATABASE_URL` pointed at an unreachable host and a sentinel database name:
it completed normally and reported "No schema changes to migrate", proving it never connects to the
configured database. That result also confirms the committed migrations exactly match the schema,
including the hand-written `support_sessions` migration. `prisma migrate dev`, `migrate reset`,
`--force-reset` and `db push` appear nowhere in the repository except in comments and documentation
explaining why they are not used. The name argument is constrained to `^[a-z0-9_]+$`, so it cannot
escape the migrations directory.

### 8. Blockers for M1-11

I read the deferred items in `docs/FOUNDATION-REPORT.md`. **None of the five blocks M1-11.** My own
Critical findings do, which is a separate matter.

| Deferred item                                | Blocks M1-11?          | Reasoning                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5. `auditRead` has no caller                 | No                     | It wraps read endpoints on patients, prescriptions and recordings, all of which are M2. It is directly tested. M1-11 has no PHI read. But C3 means the audit coverage M1-11 _does_ need is weaker than it looks: the new admin and org routes must call `audit.record` themselves, and the guard will not notice if they do not.                             |
| 6. Data-scope rules are helpers, not applied | No                     | Correct as stated. M1-11 covers organisations, users, phone numbers and voice agents, and I confirmed against the matrix that not one of those four resources carries an `own`, `assigned`, `masked`, `metadata`, `usage` or `clinic_opt_in` scope for any role. Every relevant cell is `all`. The helpers stay unused until M2's patients and appointments. |
| 7. `AI_DOCS/` versus `docs/`                 | No                     | A documentation-tree decision, no code depends on it.                                                                                                                                                                                                                                                                                                        |
| 8. ADF removal                               | No                     | Tooling, outside the application.                                                                                                                                                                                                                                                                                                                            |
| 9. Coverage floors not enforced by CI        | No, but fix it with I9 | Measuring by hand is what let `auth.middleware.ts` sit at 77.55 percent while the report read as all-clear. When M1-13 adds thresholds, set them per file.                                                                                                                                                                                                   |

Two things that are not in the deferred list but do bear on M1-11. First, `withPrincipalScope` was
extracted precisely because every `/api/v1/admin` route has the audit-log route's shape, and it is
the right abstraction, but it grants a platform role cross-tenant database access and relies on the
caller having run `requirePermission` first. With `permission` descriptors unenforced (I4), M1-11
will add roughly a dozen routes on that pattern. Fix I4 before writing them, not after. Second,
M1-11 creates organisations and users, which means writes under platform scope where RLS is off;
C2 should be fixed before that code exists.

---

## What I could not run or verify

- **No end-to-end run against the local docker-compose stack.** Every HTTP test I ran, and every
  one in the suite, uses supertest against an in-process app. I did not run
  `docker compose up && pnpm dev` and exercise the API over a real socket, so nothing here
  verifies the server bootstrap, graceful shutdown, or behaviour behind a proxy.
- **CI has not executed this branch.** I read `.github/workflows/ci.yml` and verified its database
  steps call the same root scripts as local, and I verified the policy check it runs. Nothing has
  been pushed, so no runner has executed it. **Unverified** by execution.
- **`pnpm openapi:check` is a stub** that prints "not yet implemented" and exits 0, so the OpenAPI
  drift gate in `pnpm check` currently asserts nothing, and the zod-4 OpenAPI compatibility item in
  `docs/STACK.md` remains open. M1-03, out of scope.
- **The rate limits are not a real control under scale.** The store is in-memory and per-process, as
  the project records. I verified the single-process behaviour only.
- **`FORCE ROW LEVEL SECURITY` against a non-superuser owner.** See I5. I could not verify it from
  the existing harness because the test owner is a superuser; I verified the flag is set on all 25
  tables but not that it constrains a realistic owner.
- **Production role and ownership layout.** The SQL creates `app_owner` but never assigns table
  ownership, so who owns the tables in staging and production is a deployment fact I cannot read
  from this branch.
- **Timing equality on login.** Unmeasured, by me and by the suite. See I10.
- **The exploitability of C2 from outside.** I proved the escalation works for anyone who can
  execute SQL as `app_user`. I did **not** find a path from an HTTP request to arbitrary SQL, and I
  believe none exists today, since the only raw query in `src` is a parameterless `SELECT 1`. I
  cannot prove the absence of such a path, which is why I rate C2 on the strength of the control it
  removes rather than on a working exploit.
- **`pnpm check --force` did not actually clear the Turbo cache.** The flag is consumed by `pnpm`,
  not passed to Turbo, so build, typecheck and lint reported `FULL TURBO` from cache in both of my
  runs. The 408 api tests and 113 shared tests did execute. If a truly cold verification matters,
  `turbo run build typecheck test --force` is the command.

## Commands I ran, and their real results

- `pnpm check`: **exit 0.** 26 test files, **408 tests passed** in `apps/api`; 2 files,
  **113 tests passed** in `packages/shared`. 521 total, matching the report. Build, typecheck and
  lint were served from the Turbo cache (see above). `openapi:check` printed its stub message.
- `pnpm test:coverage` in `apps/api`, run twice: **once exit 1, once exit 0.** The failing run
  aborted the `beforeAll` at `tests/auth.test.ts:372` with `expected 401 to be 201` and skipped 5
  tests, reporting "403 passed, 5 skipped". The passing run gave the coverage table above. This
  intermittency is the symptom of C1.
- `pnpm vitest run tests/auth.test.ts --coverage` three times in isolation: 33 passed each time, so
  the failure appears only under full-suite load.
- Temporary probe tests against the Testcontainers database, all since deleted, for: the
  read-after-write race (10 of 20 failures), the catalog and role inventory, the `app.platform`
  escalation, and the privilege matrix.
- `prisma/sql/check-policies.ts` against a throwaway container, before and after adding an
  unprotected tenant table: `OK: 25` then exit 1 naming the new table.
- Three sabotage experiments (policy disabled, permission check removed, audit call removed), each
  reverted.
- `prisma/create-migration.ts` with `DATABASE_URL` pointed at an unreachable host.

`git status` is clean. The only file I changed is this one.

## One thing I have to report

`docs/PR-foundation-backend.md` was present as an untracked file when this session began and is no
longer on disk. It was never committed, so git cannot restore it, and it is not in the stash or in
the trash. No command I ran removes files other than the temporary probes I created and deleted by
name, and I did not touch it. I am recording it because it was in the working tree at the start and
is not now, and because an untracked file is the one thing version control cannot give back.
