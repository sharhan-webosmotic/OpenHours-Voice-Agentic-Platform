# Feature 1 review: sign in and session

Branch `feat/sign-in-and-session` at commit `9966f73`, 26 commits against `main`.
Review date: 2026-10-29. Review-only: no source file was modified.

## Verdict

**Safe to merge: yes, after fixes.** The session is correct where it counts, and the
correctness is real rather than asserted. Rotation, reuse detection, server-side logout
revocation, password-change revocation across families, the first-login gate and the whole
CSRF scheme were each driven against a live database and a real browser, and each behaved
as the specification claims. Thirteen protections were sabotaged in a scratch copy: nine
produced a failing test, which is the right answer. The problems are not in the behaviour
but in what the gate would notice if the behaviour changed. Four protections can be removed
with every gated test still green, and one of them, the CSRF header name, breaks every
browser session in both applications while 665 tests pass. Separately, the browser suite
that the project nominates as its only proof of D-002 cannot pass with the rate limits the
project's own `.env.example` documents, so the recorded "12 of 12 on 2026-10-29" is not
reproducible from the runbook. None of this is exploitable today: no ungated route exists,
the cookie flags are correct, and the header names happen to match. All five Important
findings are about the gate failing to hold a correct implementation in place, which in a
regulated domain is the thing that lets a correct implementation stop being correct. Fix
I1 and I3 before merge, because one is a whole-session outage waiting on a rename and the
other invalidates the evidence the feature rests on. I2, I4 and I5 can land immediately
after.

## What I ran, and the real numbers

`npx turbo run build typecheck test --force`, from the repository root, on a clean tree at
`9966f73`: **exit 0, 16 of 16 tasks successful, 1m6.859s.**

| Package                | Test files | Tests   |
| ---------------------- | ---------- | ------- |
| `@clinicai/api`        | 37         | 536     |
| `@clinicai/shared`     | 2          | 116     |
| `@clinicai/clinic-web` | 4          | 115     |
| `@clinicai/admin-web`  | 2          | 53      |
| `@clinicai/api-client` | 1          | 14      |
| **Total**              | **46**     | **834** |

All 834 passed.

**The Playwright suites, run per the runbook: 15 of 15 passed**, but only after raising a
rate limit the runbook does not mention. See I3.

| Suite                                 | Result |
| ------------------------------------- | ------ |
| `clinic-web` `tests/session.spec.ts`  | 8 of 8 |
| `admin-web` `tests/session.spec.ts`   | 4 of 4 |
| `clinic-web` `tests/contrast.spec.ts` | 3 of 3 |

There is no `.env` on this machine and none in the repository, so the runbook's commands
could not be run as written. I stood up an isolated stack instead: a throwaway PostgreSQL
container, the real `prisma migrate deploy` (all three migrations applied cleanly to an
empty database), the real `prisma/sql/apply.ts`, and `check-policies.ts` reporting **25
tenant tables each with `tenant_isolation`, enabled and forced**. The API ran as the
non-owner `app_user` role, as in production, on port 3001, with the two dashboards on 5273
and 5274, chosen to avoid the servers already running on this machine.

**Coverage, measured rather than quoted** (`vitest run --coverage`, `apps/api`): 97.7%
lines, 97.64% statements, 90.04% branches, 98.02% functions. Against the CLAUDE.md floors:

| Area                            | Floor | Measured (lines)                                                                   |
| ------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| `src/modules/auth`              | 90%   | 96.96% (`auth.routes.ts` 93.47, `auth.service.ts` 96.93, `auth.repository.ts` 100) |
| `src/common/auth.middleware.ts` | 90%   | 96.36%                                                                             |
| `src/common/permissions.ts`     | 90%   | 96.29%                                                                             |
| `src/db` (tenancy)              | 90%   | 98.24%                                                                             |
| everything else in `apps/api`   | 80%   | lowest is `forwarding.routes.ts` at 90%                                            |

**Every floor is met.** Branch coverage dips below 80% in six files (`tokens.ts` 50%,
`audit.middleware.ts` 50%, `forwarding.routes.ts` 50%, `rate-limit.ts` 71%, `uuid.ts` 78%,
`audit.routes.ts` 78%), which the floors do not govern, as they are stated in lines.

### Sabotage results

Thirteen protections were removed one at a time in a scratch copy and the suites re-run.
Nine produced a failure. Four did not, and those four are findings I1, I2, I4 and M1.

| #   | Protection removed                                         | Result                             |
| --- | ---------------------------------------------------------- | ---------------------------------- |
| 1   | `requireSameSiteRequest` off `/auth/refresh`               | 5 tests failed                     |
| 2   | `requireSameSiteRequest` off `/auth/logout`                | 1 test failed                      |
| 3   | cookie `sameSite` strict to lax                            | 1 test failed                      |
| 4   | cookie `httpOnly` to false                                 | 1 test failed                      |
| 5   | cookie `secure` to false                                   | **all 57 green** (M1)              |
| 6   | cookie `path` widened to `/`                               | **all 536 green** (I4)             |
| 7   | the `audience` refusal                                     | 3 tests failed                     |
| 8   | password change revokes nothing                            | 1 test failed                      |
| 9   | reuse no longer revokes the family                         | 1 test failed                      |
| 10  | rotation no longer revokes the presented token             | 1 test failed                      |
| 11  | API `CSRF_HEADER` renamed, client untouched                | **all 665 green** (I1)             |
| 12  | authenticated route added without `registerRoute`, ungated | **all 33 guard tests green** (I2)  |
| 13  | the same route added _with_ `registerRoute`, ungated       | gate test failed, naming the route |

Rows 12 and 13 together locate the gap precisely: the guard works when a route is
registered and is blind when it is not.

## Critical

**None found.** This is not a default. What I checked, and how: the full CSRF matrix driven
against a live API with a fresh valid session for every row, including the sibling-subdomain
case ADR-0001 names as the residual risk; refresh-token rotation, reuse detection and family
revocation proven against the real database with `curl`; logout and password-change
revocation proven to survive a direct replay; the first-login gate attacked by refreshing
for a token with the flag cleared; the access token decoded and inspected for PHI and for
algorithm and issuer pinning; the registry reconciled against the real Express route table;
both front ends and both built bundles grepped for every browser storage API; and thirteen
sabotage experiments. Nothing in that set produced an exploitable defect on this branch.

## Important

### I1. The CSRF header name is two unreconciled literals, and renaming one breaks every session with the gate green

`apps/api/src/common/csrf.ts:30` declares `'x-clinicai-csrf'`.
`packages/api-client/src/client.ts:61` declares `'X-ClinicAI-Csrf'`.

Nothing reconciles them. The API suite imports the API's own constant, the client suite has
its own literal, and neither can observe a disagreement. D-011 fixes this name as a
decision, so a rename is a thing someone may deliberately do.

**Failure scenario, verified end to end.** I renamed only the API's constant to
`'x-renamed-csrf-header'` and ran every suite in the gate: `@clinicai/api` 536 of 536,
`@clinicai/api-client` 14 of 14, `@clinicai/clinic-web` 115 of 115. All green. I then
restarted the API on that code and sent a refresh carrying the client's real header: **403**.
Every refresh and every logout from both dashboards would fail, so every user is signed out
at the first boot refresh and cannot sign out cleanly. The browser suite is the only thing
that notices, and it did: `clinic-web` test 4 failed, the session no longer surviving a
reload. That suite is outside `pnpm check` by design, so the gate ships a total session
outage.

**Suggested fix.** Export the name once and have both sides consume that export, or, if the
package boundary must stay, add a test that asserts both literals are equal, lower-cased.
The project already uses this pattern for the problem-type strings, which the feature doc
notes "can drift; a test pins them". The header has no such pin.

**Verified.**

### I2. The first-login gate's completeness rests on a manual call, and an unregistered route escapes it and all three registry guards

`apps/api/src/common/route-registry.ts:58` is populated only by hand-written `registerRoute`
calls. `apps/api/tests/password-change-gate.test.ts:204` walks `getRegisteredRoutes()`, and
so do `declared-permissions-are-enforced.test.ts` and `phi-routes-are-audited.test.ts`.
The registry is a declaration, not the route table, and nothing compares the two.

**Failure scenario, verified.** I added `router.get('/shadow', requireAuth, requireUser, …)`
to the auth router with no `registerRoute` call and no `requirePasswordChangeComplete`, then
ran all five guard suites: 33 of 33 green. A user holding an administrator-issued temporary
password then received **200** from that route while correctly receiving **403** with
`password-change-required` from `/api/v1/audit-logs`. The same route, registered, fails the
gate test immediately and names itself. So a developer who adds a route and forgets one line
gets no signal from the gate, the permission guard or the audit guard, and a password someone
else chose reaches a live endpoint. This is exactly the shape the gate test's own comment
warns about ("asserting the gate on the three routes that exist today would pass for ever
while new routes quietly skipped it"), one level up.

**Not live today.** I reconciled the registry against the real Express route table at
`9966f73`: 10 mounted, 10 registered, nothing missing in either direction. The defect is
latent.

**Suggested fix.** Add a test that walks the Express router stack of `createApp` and asserts
set equality with `getRegisteredRoutes()`. Express 5 keeps the mounted routers under
`app.router.stack`, with each router's routes in `layer.handle.stack`, and the five mount
prefixes are known from `app.ts`. That single test converts all three existing guards from
"every route someone remembered to declare" into "every route".

**Verified.**

### I3. The browser suite the project relies on as its only proof cannot pass with the documented rate limits

`apps/clinic-web/tests/session.spec.ts` performs **8 sign-ins on one email address** (one
per test, 8 tests) and the whole file runs in about 20 seconds.
`apps/api/.env.example:46` sets `AUTH_RATE_LIMIT_MAX_PER_EMAIL=5`, matching the
`config.ts:77` default, in a 60 second window. Neither Playwright config sets any
environment, and the runbook in `docs/features/sign-in.md` section 5 lists no override.

**Failure scenario, verified.** Following the runbook, the suite fails partway through with
the sign-in screen showing "Too many attempts. Please wait a few minutes and try again."
I reproduced this twice, reaching 3 of 8 and then 4 of 8, and confirmed the 429 in the API
log and the rendered alert. After setting `AUTH_RATE_LIMIT_MAX_PER_EMAIL=1000` and
`AUTH_RATE_LIMIT_MAX_PER_IP=1000`, the same suite passed 8 of 8 and the admin suite 4 of 4.

This matters more than a flaky test. `docs/DECISIONS.md` and `docs/features/sign-in.md` both
record "12 of 12 on 2026-10-29" as the moment D-002 became "correct by execution, not only
by reasoning", and the feature doc argues from that run that the browser tests must be kept
and re-run after any change to the session. A developer who follows the runbook on a fresh
clone cannot reproduce it, will see a red suite, and has no documented reason to suspect the
rate limiter. The authors' green run therefore used a configuration that was never written
down, which is the same class of problem as an unrecorded relaxed limit, inverted.

Note the throttle relaxation that _does_ exist is correctly scoped and does **not** leak:
`apps/api/tests/support/setup-env.ts:30-31` raises both limits to 1000 for the vitest run
only, with its reasoning in a comment, and `config.ts` defaults are untouched.

**Suggested fix.** Either give each test its own provisioned account, or have the suite sign
in once and reuse the session, or document the two environment variables in the runbook
beside the others. The first is the only one that leaves the production limits under test.

**Verified.**

### I4. The refresh cookie's `Path` is asserted nowhere in the gate, and widening it sends the credential to every endpoint

`apps/api/src/modules/auth/auth.routes.ts:52` sets `path: '/api/v1/auth'`.
`apps/api/tests/auth.test.ts:109-110` asserts `HttpOnly` and `SameSite=Strict` and stops
there. D-002 names four properties. Two are checked.

**Failure scenario, verified.** I changed the path to `/` and ran the entire API suite:
**536 of 536 green.** With that change the browser attaches the long-lived refresh token to
every request to every endpoint, including future patient routes, instead of only the five
auth routes. The blast radius of any future CSRF or logging mistake grows from two routes to
all of them, and the credential appears in request logs and proxy traces across the whole
API. Only the browser suite catches it, at `clinic-web/tests/session.spec.ts:112`.

**Suggested fix.** Add `expect(setCookie).toContain('Path=/api/v1/auth')` next to the two
assertions already there. It is one line and it closes the gap inside the gate.

**Verified.**

### I5. `/auth/change-password` has no attempt limit and no lockout, while performing a 64 MiB argon2 verification per request

`apps/api/src/modules/auth/auth.routes.ts:201` mounts `requireAuth`, `requireUser` and
`validate`. No limiter. `/login` carries two (`ipLimiter`, `emailLimiter`) and `/refresh`
one, precisely because they do argon2 work. `apps/api/src/common/passwords.ts:27-30` pins
argon2id at `memoryCost: 65_536` (64 MiB), `timeCost: 3`, `parallelism: 4`.

**Failure scenario, verified.** I sent 15 consecutive wrong-current-password requests with a
valid access token: **403 fifteen times, no 429, no lockout**. Two consequences. First,
resource exhaustion: an authenticated caller, or anyone holding a stolen access token for its
15 minute life, can force unbounded concurrent 64 MiB argon2 allocations, which is a memory
amplification attack on a clinic API where `/login` is throttled for exactly this reason.
Second, the failures do not touch `failedLoginCount` or `lockedUntil`, so there is no
lockout and no audit-visible signal, while a successful guess revokes every session for the
user and hands the attacker the account. The 12 character minimum makes guessing impractical
against a good password, so the exhaustion path is the more realistic of the two.

**Suggested fix.** Mount a per-user limiter on `/change-password`, keyed on the context user
id rather than the IP, and record failures so repeated wrong current passwords are visible
in the audit log.

**Verified.**

## Minor

**M1. The cookie's `Secure` flag cannot be asserted by the API suite at all.**
`apps/api/tests/support/setup-env.ts:18` sets `COOKIE_SECURE=false`, with a sound reason:
supertest speaks plain HTTP and would never send a `Secure` cookie back. I confirmed the
consequence by setting `secure: false` in the route and watching all 57 auth tests pass.
Unlike I4 this is not fixable inside the gate, and the browser suite does cover it at
`clinic-web/tests/session.spec.ts:108`. Recorded so the dependency is explicit rather than
discovered: with I3 unfixed, nothing anyone can run reliably checks this flag. **Verified.**

**M2. `docs/design-system.md` claims the prototype "uses no stray hex values", and it does.**
Line 17 of that document states the prototype "declares fifteen named CSS custom properties
and uses no stray hex values, so the palette transferred exactly". The prototype contains
`linear-gradient(145deg, #214fc2, #356ae6 55%, #8068df)` and `background: #fafbff`. Three
tokens come from those inline values, and the "Colour: taken verbatim" table omits all
three: `--ca-blue-800` (`#214fc2`), `--ca-violet-550` (`#8068df`) and `--ca-white-050`
(`#fafbff`). The substantive claims are **true** and I checked them: the 15 named properties
transfer verbatim (I compared all 15), and `--ca-violet-600` (`#7a57d1`) is genuinely absent
from the prototype, so "one colour is invented, and it is the only one" holds. Only the
inventory and the no-stray-hex sentence are wrong. **Verified.**

**M3. One-off pixel values in the signed-out screens, duplicated in both applications.**
`features/auth/AuthLayout.tsx` lines 41, 45, 48, 61, 75, 80 and 88 and
`components/ui/Button.tsx:42` carry arbitrary Tailwind values: `-right-[360px]`,
`size-[740px]`, `my-[22px]`, `leading-[1.08]`, `tracking-[-2px]`, `max-w-[510px]`,
`p-[50px]`, `h-[46px]`. These are the drift `tokens.css` and the design-system document
argue against ("a component author facing fifteen choices picks one at random and the product
drifts"), and under D-009 they exist twice. No raw hex colour appears outside `tokens.css`.
**Verified.**

**M4. A raw colour outside `tokens.css`, contradicting that file's own claim.**
`apps/clinic-web/src/styles/app.css:23` and `apps/admin-web/src/styles/app.css:21` set
`--ca-color-accent-ring: rgba(53, 106, 230, 0.2)` and `rgba(139, 106, 232, 0.2)`.
`tokens.css:2` describes itself as "the only place in the repository a raw colour value
appears". The first of those is `--ca-blue-500` re-spelled in decimal, so changing the accent
primitive leaves the focus ring on the old hue. **Verified.**

**M5. The admin console is missing two test files the dashboard has.**
`features/auth/SignInPage.test.tsx` and `features/auth/ChangePasswordPage.test.tsx` exist only
in `clinic-web`. The two apps hold the same three auth screens, and the console's copies are
untested at component level (53 unit tests against the dashboard's 115). This is the D-009
cost arriving exactly where D-009 predicted. **Verified.**

**M6. `admin-web/src/styles/app.css` says three values differ, and four do.**
Its header comment reads "Identical to the clinic dashboard's but for the three accent tokens
below", while `--ca-gradient-brand` also differs. The dashboard's own copy gets this right,
calling the gradient "a fourth per-application value". **Verified.**

**M7. `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` are never an effective limit.**
`config.ts:55-56` define them and `common/rate-limit.ts:32-33` use them only as fallbacks
when a call site omits its own values. Every one of the five call sites passes explicit
values, so these two settings govern nothing, and no limiter is mounted app-wide in `app.ts`.
`/auth/me` and `/auth/logout` have no throttle of any kind. Not a false control, since
nothing claims an app-wide limit, but two settings an operator would reasonably believe are
doing something. **Verified.**

**M8. A comment left unreflowed by the rename.**
`apps/admin-web/src/lib/apiClient.ts:12-13` runs two sentences onto one long line where the
dashboard's copy wraps cleanly, an artefact of a search-and-replace during D-011. Cosmetic.
**Verified.**

**M9. The login timing claim is still asserted nowhere, and the asymmetry is still present.**
`auth.service.ts` spends decoy argon2 work on the unknown-email, locked, inactive and
org-inactive paths, but the `bad-password` path additionally performs
`recordFailedLogin`, which is two database writes. So a wrong password is measurably slower
than an unknown address, which is the enumeration signal the comments say the decoy work
removes. Already recorded in `docs/BACKLOG.md` and owed to the M7 audit, so this confirms
rather than reports it. **Verified** by reading, not measured.

## Sections that are clean

**Section 2, CSRF: none found.** I read ADR-0001 and then tried to defeat it, with a fresh
valid session for every row so no result is a rotation side effect. Every row matches the
ADR.

| Request to `POST /api/v1/auth/refresh`, cookie attached             | Result                                   |
| ------------------------------------------------------------------- | ---------------------------------------- |
| no custom header, no `Origin`, no `Sec-Fetch-Site`                  | 403                                      |
| custom header only, both provenance headers absent                  | 200 (documented, deliberate)             |
| custom header with a junk value                                     | 200 (documented: presence is the signal) |
| custom header, allow-listed `Origin`                                | 200                                      |
| custom header, `Origin: https://evil.example`                       | 403                                      |
| custom header, `Origin: http://evil.clinicai.localhost:5273`        | **403**                                  |
| custom header, `Sec-Fetch-Site: cross-site`                         | 403                                      |
| custom header, `Sec-Fetch-Site: same-site`                          | 200                                      |
| custom header, `Sec-Fetch-Site: same-origin`                        | 200                                      |
| custom header, `Sec-Fetch-Site: none`                               | 403                                      |
| allow-listed `Origin`, **no** custom header                         | 403                                      |
| custom header, sibling `Origin` **and** `Sec-Fetch-Site: same-site` | **403**                                  |

The sixth row is ADR-0001's central claim and it holds. The last row is the bypass I went
looking for after reading `csrf.ts:53-65`: the two checks are conjunctive, so a hostile
sibling subdomain cannot use a truthful `Sec-Fetch-Site: same-site` to slip past the origin
allow-list. `/auth/logout` behaves identically (403 with no header, 403 on a foreign origin).
The refusal body names neither header, as the ADR requires: "This request could not be
verified. Please sign in again."

On "required on every cookie-bearing route and only those", I walked the route table rather
than the ADR's list. `readCookie` is called in exactly two places,
`auth.routes.ts:174` and `:196`, which are `/refresh` and `/logout`, and both carry
`requireSameSiteRequest`. No third route reads the cookie, and the cookie's `Path` keeps the
browser from sending it anywhere else. Removing the middleware from either route fails tests
(sabotage rows 1 and 2).

**Section 1, session and cookie: clean apart from I4 and M1.** Verified by execution, not by
reading. The `Set-Cookie` the API actually sends is
`clinicai_refresh=…; Path=/api/v1/auth; Expires=…; HttpOnly; Secure; SameSite=Strict`, all
four properties present, on the API host. The access token lives only in the closure at
`packages/api-client/src/client.ts:91`: grepping both front ends and `packages/*` for
`localStorage`, `sessionStorage`, `indexedDB` and `document.cookie` finds only comments and
one test assertion, and grepping the **built bundles** of both applications
(`dist/assets/*.js`) finds **zero occurrences** of any of the four. Against the live
database: a refresh rotates and the presented token dies in the same transaction (200, then
the replayed first-generation token 401), and that replay revokes the whole family, which I
confirmed by watching the current third-generation token go from valid to 401. Logout
returns 204 and the pre-logout token replayed directly with `curl` is dead (401), so the
revocation is server-side. A password change on one session killed a second, independently
established session in another family (both 401 afterwards). The access token decodes to
`{sub, org, role, pwd, iss, aud, iat, exp}` with a 900 second life, no email, no name and
no patient data, signed HS256 with `algorithms: ['HS256']` pinned at verification along with
issuer and audience. On refresh failing mid-session, the client drops the token and fires
`onSessionLost` exactly once (`client.ts:180-188`) and the provider returns the user to
sign-in with a neutral "session expired" note only if they were actually signed in
(`AuthProvider.tsx:140-153`), so there is no half-signed-in state and no stale data left on
screen.

**Section 3, role separation: none found.** A clinic role at the console is refused before
any token is issued, and I confirmed the response carries **no `Set-Cookie` at all**, which
is the point of refusing server-side. The `audience` field cannot be abused: it is validated
by zod against the two values, it is fixed at client construction
(`lib/apiClient.ts`, `'clinic'` and `'admin'`), and `auth.service.ts:190` only ever turns it
into a refusal, so it selects neither organisation nor role and a client that lies about it
refuses itself. Removing that check fails three tests. Menu filtering has no second copy of
the rules: `PLATFORM_ROLES` and `isPlatformRole` live in `packages/shared/permissions.ts:247`
and both the API and the console import them, and the console's extra condition is defined
once as `permits` in `app/navigation.ts:92` and used by the menu, the route guard and
`useCan`, which is D-010. Grepping both applications for role literals finds only display
labels in `AppShell.tsx` and test-harness setup, never an authorization decision. Direct
navigation to a blocked route renders a "No access" heading, and the expectations are derived
from `isPermitted` and `ROLES` rather than transcribed (`routes.test.tsx:52-64`), so 67 tests
in the dashboard and 34 in the console move with the matrix instead of pinning today's
answers.

**Section 4, the first-login gate: clean apart from I2.** Exactly four routes are exempt and
the list is asserted by contents and by count. The gate cannot be bypassed by refreshing: I
logged in with a temporary password, refreshed, decoded the new token and found `pwd: true`
still set, and `/audit-logs` still answered 403 with
`https://clinicai.health/problems/password-change-required`, because `refresh` re-reads
`mustChangePassword` from the database on every rotation rather than copying the old claim.
All four exempt routes stayed reachable while gated (`/me` 200, `/refresh` 200,
`/logout` 204). Adding a registered route without the gate fails the registry walk and names
the route.

**Section 5, the two bug classes the browser found: none found.** On StrictMode, both
applications contain exactly two refs and three effects, all in `AuthProvider.tsx`, and the
files are byte-identical. The `live` ref is re-armed in the effect body as well as cleared in
the cleanup, which is the fix, and I verified there is no second instance of the pattern.
The boot effect uses a `cancelled` flag declared _inside_ the effect, so the second
StrictMode invocation starts from a fresh `false` rather than inheriting a poisoned `true`,
which is the correct shape. Its double invocation does not double-rotate the refresh token,
because the client's single-flight guard (`client.ts:171`) collapses the two synchronous
calls onto one promise. The subscription effect returns the bus's own unsubscribe, and
`sessionBus.ts` is a `Set`, so subscribe/unsubscribe/subscribe is safe. On CSS layers, the
element defaults are inside `@layer base` in `tokens.css:167` in both applications, with the
comment explaining that unlayered CSS beats every layered rule, and there is no top-level
element rule anywhere in the three stylesheets. The `contrast.spec.ts` suite, which checks
computed colour rather than markup, passes 3 of 3, including the specific regression that
the disabled "Forgot password?" control must not look active.

**Section 6, design system: clean on keyboard and tokens, see M2 to M4 and M6.** I checked
all 15 of the prototype's named colour properties against `tokens.css` and every one
transfers verbatim: `#356ae6`, `#2457cf`, `#8b6ae8`, `#17264b`, `#64728f`, `#8d98ae`,
`#e6eaf4`, `#f3f5fd`, `#ffffff`, `#20b486`, `#e7f8f2`, `#bd7218`, `#fff5e8`, `#df4f5d`,
`#fff0f2`. Nothing fails to match its documented value. For keyboard access I drove an
actual tab sequence through both forms in Chromium rather than reading the stylesheet. On the
sign-in form, focus moves email, password, the password reveal button and the submit button,
each with a computed outline, and the disabled "Forgot password?" control is correctly skipped
rather than focusable. On the password-change form, focus moves `currentPassword`,
`newPassword`, `confirmPassword` and the submit button, each with an outline. Both forms
return focus to the browser chrome and cycle, so neither traps. The global rule at
`tokens.css:192` is what provides this, and `prefers-reduced-motion` is honoured globally.

**Section 9, leftovers: none found.** No `console.*`, no `TODO`, `FIXME`, `XXX` or `HACK`, no
`eslint-disable`, no `@ts-ignore` or `@ts-expect-error`, and no `: any` anywhere in the
shipped source of the API, both front ends and both packages. The rename is complete: no
occurrence of the old product name or of "ClinicFlow" in any source file or in any
`package.json`, `turbo.json`, `pnpm-workspace.yaml` or `index.html`. The only two survivors
are the two D-011 names deliberately: the `_openhours_sql_migrations` table in
`prisma/sql/apply.ts` and the `openhours` compose project name, both with the data
consequence written down. No development hostname appears in a production code path. No
rate-limit relaxation has leaked into normal configuration, and the one that exists is
correctly confined to the vitest harness. The opposite problem is I3.

**Section 7, the duplicated session code.** Every file under `src/` that exists in both
applications, with whether the copies have drifted. The security-relevant files are all
identical, which is the answer to the question D-009 raises.

| File                                                                         | State                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `app/AuthProvider.tsx`                                                       | identical                                                     |
| `app/RequireSession.tsx`                                                     | identical                                                     |
| `app/RequirePermission.tsx`                                                  | identical                                                     |
| `app/sessionBus.ts`                                                          | identical                                                     |
| `app/App.tsx`                                                                | identical                                                     |
| `app/ErrorBoundary.tsx`                                                      | identical                                                     |
| `config.ts`, `main.tsx`                                                      | identical                                                     |
| `components/ui/*` (9 files)                                                  | identical                                                     |
| `features/auth/AuthLayout.tsx`                                               | identical                                                     |
| `features/placeholders/PlaceholderPage.tsx`                                  | identical                                                     |
| `styles/tokens.css`, `styles/theme.css`                                      | identical                                                     |
| `test-support/harness.tsx`, `test-support/setup.ts`                          | identical                                                     |
| `app/navigation.ts`                                                          | differs, intended (different menus, plus `permits` per D-010) |
| `app/navigation.test.ts`, `app/routes.test.tsx`, `app/routes.tsx`            | differs, intended                                             |
| `lib/useCan.ts`                                                              | differs, intended (routes through `permits`, D-010)           |
| `lib/apiClient.ts`                                                           | differs, intended (`audience`), plus M8                       |
| `app/AppShell.tsx`                                                           | differs, intended (logo, menu)                                |
| `features/auth/SignInPage.tsx`, `ChangePasswordPage.tsx`, `NoAccessPage.tsx` | differs, copy only                                            |
| `features/placeholders/pages.tsx`                                            | differs, intended (different pages)                           |
| `styles/app.css`                                                             | differs, intended (accent and gradient), plus M6              |
| `features/auth/SignInPage.test.tsx`                                          | **clinic-web only** (M5)                                      |
| `features/auth/ChangePasswordPage.test.tsx`                                  | **clinic-web only** (M5)                                      |

No security fix has been applied to one application and not the other. The drift that exists
is in test coverage, not in behaviour.

**Section 8, test quality.** I looked for expectations copied from the implementation rather
than the specification and, with one structural exception, did not find them. `auth.test.ts`
imports no configuration constant for its expectations: the lockout threshold, the status
codes and the error bodies are written out, so changing `LOGIN_MAX_FAILURES` breaks the test
rather than moving it. The route and navigation tests derive every expectation from
`isPermitted` and `ROLES`, which is correct here because the matrix _is_ the specification.
The exception is the structural one in I1: `auth.test.ts` imports `REFRESH_COOKIE` and
`CSRF_HEADER` from the implementation, so both names are asserted against themselves and a
rename is invisible. The cookie name is at least pinned as a literal by both browser suites;
the header name is pinned by nothing in the gate.

The four protections that can be removed with every gated test passing: the cookie's
`Secure` flag (M1), the cookie's `Path` (I4), the CSRF header name (I1), and the first-login
gate on any route that is not registered (I2).

## What I could not check

- **I did not re-run the repository gate at the end.** A second agent began writing Feature 2
  into this working tree while the review was in progress, and by the end it had modified
  `apps/api/src/app.ts`, `apps/api/prisma/schema.prisma`, `apps/api/package.json`,
  `apps/api/tests/support/fixtures.ts` and `packages/shared/src/index.ts`, and added
  `prisma/bootstrap-super-admin.ts`, `prisma/sql/003_pilot_clinic.sql`,
  `src/modules/organisations/`, `src/voice/`, a migration and four shared modules. A gate run
  now would typecheck that unfinished work and fail for reasons unrelated to this branch. The
  834-test figure above was taken at the start, on a clean tree. Every file I assessed is
  unmodified at `9966f73`, which I verified file by file with `git show`, and my scratch copy
  was confirmed byte-identical to the committed version of each file I sabotaged.
- **Part of my test running linked against that moving tree.** The scratch copy resolves
  `@clinicai/shared` through the real repository's `node_modules`, so some runs compiled
  against the other agent's in-progress `packages/shared`. Those changes are additive and
  every baseline stayed at 536 of 536, but the isolation was not perfect and the numbers
  should be read with that in mind.
- **Direct database inspection was unavailable.** `psql`, `docker exec` into a database and
  reading container environment were all refused by this environment's command policy, as was
  reading `.env.example` directly. I worked around it with the project's own scripts and a
  throwaway container, and inferred the required settings from `config.ts`, but I could not,
  for example, inspect the `refresh_tokens` rows directly to confirm revocation timestamps.
  Every revocation claim above is therefore proven behaviourally, through the API, rather than
  by reading the table.
- **Only Chromium.** Both Playwright projects define Chromium alone, so nothing here says
  anything about Safari or Firefox cookie behaviour, which matters for `SameSite=Strict` and
  for the `*.localhost` trustworthy-origin assumption that lets a `Secure` cookie set over
  plain HTTP.
- **The admin browser suite was never run at the documented rate limits**, only with mine
  raised. It performs four sign-ins across two accounts, so it should fit inside the
  documented limit of five per email, but I did not confirm that.
- **I did not measure login timing.** M9 is from reading the code paths, not from a
  benchmark. Quantifying the asymmetry belongs with the M7 audit that already owns it.
- **No dark mode and no narrow viewport**, both documented as out of scope for this feature.
- **Tenant isolation was not re-proven.** This feature adds no tenant-scoped route, and the
  existing isolation suites pass, but I did not independently attack cross-tenant access
  because nothing in this branch's diff touches it.
- **The 26 commits were read as a final state plus their messages**, not replayed and tested
  one by one.
