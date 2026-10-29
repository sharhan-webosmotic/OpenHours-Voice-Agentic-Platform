# Sign in and session

How a person gets into OpenHours, how the session stays alive, and how it ends. Covers both
the clinic dashboard and the admin console.

## How the session works

Two credentials, with different lifetimes and different storage, because they have different
jobs.

**The access token** is a JWT with a 15-minute life, returned in the login response body and
held in a JavaScript closure inside `packages/api-client`. Nowhere else. Not `localStorage`,
not `sessionStorage`, not IndexedDB, not a script-readable cookie, not React state, not a
module-level export. This product holds patient health data: anything a script can read
leaves with the first cross-site scripting bug, and a token in React state ends up in a
dev-tools snapshot or an error-tracking payload.

**The refresh token** is an opaque value in a cookie that is `httpOnly`, `Secure`,
`SameSite=Strict` and scoped to `/api/v1/auth`. The front end cannot read it. It rotates on
every use, and presenting a rotated token again is treated as theft: the whole token family
is revoked.

A consequence worth stating because it looks like a bug: **a page reload has no access
token.** That is intended. The application boots, calls `POST /api/v1/auth/refresh` with only
the cookie, and the session comes back. The visible effect is a brief spinner on a cold load,
never the sign-in screen, which is why `AuthStatus` has a distinct `booting` state.

### Why the cookie is Strict and why that is free

`SameSite` is evaluated on the **registrable domain**, not the origin. The dashboard, the
console and the API deploy as subdomains of one domain, so they are same-site even though
they are three different origins. `Strict` therefore costs nothing, and `Lax` would have
relaxed exactly the case this cookie never uses, a top-level navigation.

Moving either application to a different registrable domain would make these cross-site, and
then neither `Strict` nor `Lax` sends the cookie on a fetch: it would force `SameSite=None`.
That is a new decision, not an edit. See `docs/DECISIONS.md` D-002.

## The CSRF scheme

A cookie the browser attaches by itself is a credential an attacker can use without ever
reading it. Two routes carry one: `POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout`.
Every other route authenticates from an `Authorization` header, which a cross-site page
cannot set on the victim's behalf, so there is nothing to forge and nothing to protect.

Those two routes require **two things**:

1. **A custom header, `X-OpenHours-Csrf`.** Any value: its presence is the signal. A
   cross-site HTML form cannot set a custom header at all, and a cross-site `fetch` that sets
   one triggers a CORS preflight that the API's origin allow-list refuses.
2. **Acceptable provenance.** When `Origin` is present it must be in `CORS_ALLOWED_ORIGINS`.
   When `Sec-Fetch-Site` is present it must be `same-origin` or `same-site`.

**The origin assertion is the layer doing the real work**, not a belt on a working control.
The same property that made `Strict` free, same-site being evaluated on the registrable
domain, means any other host under that domain is also same-site and the browser **will**
attach the cookie to a request from it. A hostile or compromised sibling subdomain, a stale
marketing host, a forgotten staging name, a subdomain takeover: that is precisely the case
`SameSite=Strict` does not cover.

**Absent headers pass, deliberately.** Both are set by the browser and cannot be removed by
page script, so a forged cross-site request made through a browser carries at least one. A
caller presenting neither is not a browser, and a non-browser client holds no ambient cookie
to abuse. Refusing on absence would break every server-to-server and command-line caller for
no gain.

The client sends the header itself, so no feature code has to remember it. Full reasoning and
the rejected alternatives, including why there is no double-submit cookie, are in
`docs/architecture/adr-0001-session-and-csrf.md`.

## Which application you signed in to

Login accepts an optional `audience` of `clinic` or `admin`, fixed at client construction so
no screen can override it. A clinic role at the console, or a platform role at the dashboard,
is refused **before any token is issued**, and told where to go instead.

**This is user experience and defence in depth, not a security boundary.** What protects the
admin surface is the permission matrix in `packages/shared`, enforced in the service layer.
No route may ever treat `audience` having been sent as a reason to skip a permission check.
It does not violate the rule that organisation and role come only from the verified token,
because `audience` selects neither: it can only cause a refusal, so a client that lies about
it refuses itself.

Refusing before a token is issued is the point. Checking in the front end alone would leave a
valid refresh cookie set for a session the application then rejects, and the user would be
half signed in: refused at the screen and holding a credential that works.

## First sign-in with a temporary password

There is no email provider (D-003), so a new user is created with a one-time password handed
over out of band, stored only as an argon2 hash, with `mustChangePassword` set.

Until it is replaced, the API refuses that user **every route but four**: `GET /auth/me` to
discover the state, `POST /auth/change-password` to leave it, and refresh and logout. The
refusal carries its own problem type, `.../password-change-required`, so the client can route
to the change screen rather than meeting a generic 403 it cannot act on.

Three other routes take no user access token at all and so have no gate to apply: login,
`POST /devices/pair` (which redeems a pairing code a gated user cannot obtain) and
`GET /forwarding/schedules` (which authenticates a device). `apps/api/tests/password-change-gate.test.ts`
walks the whole route registry and drives each of those to prove a user token is not a
credential there.

Changing the password revokes every session for that user, this one included, so they sign in
again afterwards. That is not a rough edge: it is also the only proof the new password took
effect.

**Forgot password is visible and disabled, labelled coming soon.** There is nothing to send a
reset link with. The ClinicFlow prototype implements a flow that simulates sending an email,
which is fine in a prototype and a lie in a product holding patient records. Until an email
provider is in scope, the way back in is an administrator issuing a new temporary password.

## Permissions in the interface

The sidebar is the permission matrix. Each item in `src/app/navigation.ts` names a resource
and an action, and the menu is `isPermitted` over them. **There is no second copy of the
authorization rules in either web application.**

**Hiding a control is never the control.** The API enforces the same matrix in its service
layer, and a user who types a hidden path reaches a page whose data calls are refused. The
interface layer exists so the product does not show people doors that are locked, and so a
refusal is an explanation rather than a screen of failed requests.

Two consequences that look odd until you read the matrix:

- **The landing route is computed, not `/overview`.** `analytics` is denied to STAFF, so
  Overview and Reports do not exist for a staff member. A fixed redirect would have dropped
  every staff member on the no-access page at every sign-in.
- **The admin console requires a platform role as well as the matrix cell.** `CLINIC_OWNER`
  holds `organisations:read` and `phone_voice_mapping:read`, meaning their own clinic, which
  tenant isolation enforces. That is not access to the platform-wide list the console shows.
  See D-010.

### About the "granted reaches it, denied does not" requirement

**This feature exposes no matrix permission of its own.** No route it adds declares one:
`/auth/me` and `/auth/change-password` act on your own account, which needs no matrix cell,
and login, refresh and logout are the session itself. So the API's registry-walking guard,
`declared-permissions-are-enforced.test.ts`, has nothing new to assert, and it is left in
force unchanged.

The requirement is satisfied at the interface instead, and it was not skipped:

- `apps/*/src/app/navigation.test.ts` drives the real `PERMISSIONS` table for all six roles
  against every menu item.
- `apps/*/src/app/routes.test.tsx` renders every role against every page: 54 combinations in
  the dashboard, 24 in the console. Every expectation is derived from the matrix predicate
  rather than transcribed, so a permission change moves the test with the product.

## Running it locally

### 1. Two host names, for browsing by hand

`SameSite` needs the applications and the API to be siblings under one registrable domain.
`localhost:5173` and `localhost:3000` are the same host and would prove nothing about the
arrangement that ships.

**The Playwright tests do not need this step.** Chromium is launched with
`--host-resolver-rules=MAP *.openhours.localhost 127.0.0.1`, so it resolves the names itself.
The names are still sent, the browser still sees three origins, and SameSite is still applied
on the shared registrable domain, so nothing about the test is weakened; it just does not
require a machine that somebody set up by hand.

**To browse by hand you do need it**, because `*.openhours.localhost` does not resolve on
macOS. Add to `/etc/hosts`:

```
127.0.0.1 app.openhours.localhost
127.0.0.1 admin.openhours.localhost
127.0.0.1 api.openhours.localhost
```

The dev servers bind `127.0.0.1` rather than the name, because `listen()` on an unresolvable
name fails with `ENOTFOUND` and that made the dev server unstartable on a fresh machine. Vite
accepts the name through `server.allowedHosts`.

Browsers treat `*.localhost` as a trustworthy origin, so a `Secure` cookie does set over
plain HTTP there. **Do not set `COOKIE_SECURE=false` to work around a cookie problem**: that
is the one setting the browser tests exist to exercise.

### 2. Database and API

```
docker compose up -d postgres
pnpm db:migrate
pnpm --filter @openhours/api dev
```

The API needs `CORS_ALLOWED_ORIGINS` to include both application origins, and `COOKIE_SECURE`
left true.

`.env` lives at the repository root and is read by `prisma.config.ts` and by the `tsx`-based
scripts through `--env-file-if-exists`. Nothing loaded it before, so every one of these
commands failed on a fresh shell with "expected string, received undefined". `pnpm start`
deliberately does not load it: in production the environment comes from the secret manager
and a file must not be consulted.

### 3. A clinic to sign in to

```
pnpm provision:clinic "Test Clinic"
```

This prints three accounts, an owner, a manager and a staff user, each with a one-time
password **shown once and stored only as a hash**. A lost one cannot be recovered; provision
again. It refuses to run against anything but a local database.

### 4. The applications

```
pnpm --filter @openhours/clinic-web dev   # app.openhours.localhost:5173
pnpm --filter @openhours/admin-web dev    # admin.openhours.localhost:5174
```

Each needs `VITE_API_URL=http://api.openhours.localhost:3000`, parsed with zod at import, so
a missing value fails on load rather than as a fetch to `undefined/...`.

### 5. The browser tests

```
E2E_EMAIL=owner@clinic-123456.test \
E2E_TEMP_PASSWORD='ABCD-EFGH-...' \
pnpm --filter @openhours/clinic-web e2e
```

The clinic suite walks the first-login change itself, so it **spends the temporary password**
and needs a fresh `pnpm provision:clinic` for each run.

The console suite needs a platform account, which only `pnpm db:seed` creates today:

```
E2E_EMAIL=owner@clinic-123456.test \
E2E_CLINIC_PASSWORD='the-password-you-set-above' \
E2E_ADMIN_EMAIL=super.admin@openhours.test \
E2E_ADMIN_PASSWORD=openhours-dev-password \
pnpm --filter @openhours/admin-web e2e
```

Each `test.describe` there skips itself if its variables are absent, so the clinic-refusal
test runs on its own without an admin account.

## Known gaps

🔴 **The browser tests have never been run.** They are written and they typecheck, and they
are the only thing that can prove the cookie is actually sent, because supertest sends no
`Origin` header and jsdom has no cookie jar shared with a server. Until a run is green on a
machine, **the cookie arrangement is reasoned and not verified.** They are not in
`pnpm check`, because they need the API, a database and the host names above, and a gate leg
that cannot run on a clean checkout is one that gets skipped.

**A demoted user keeps their old access for up to 15 minutes.** A role change takes effect at
the next refresh, not immediately, because the role is a claim in the access token. This is
accepted. A deactivated user, by contrast, is refused at the next refresh and the family is
revoked.

**Nothing provisions a platform user properly.** `pnpm provision:clinic` creates clinic
accounts only, and the console's own "Internal users" page is a placeholder. The only
SUPER_ADMIN comes from `pnpm db:seed`, as `super.admin@openhours.test` with the password
written in that file's source and `mustChangePassword` left false. That is fine for
development and is not an account-creation path: it would hand every installation the same
known credential. A real one is owed with the platform users feature.

**No email provider**, so forgot-password is disabled and a locked-out user needs an
administrator.

**Login timing is claimed as a control and asserted nowhere.** The source and the foundation
report describe equal timing between an unknown email and a wrong password as protection
against account enumeration. Two asymmetries exist and are unmeasured. Owed to the M7
security audit, recorded in `docs/BACKLOG.md`.

**`packages/api-client` is hand-written**, though the repository describes it as generated
from an OpenAPI document. The problem-type strings are duplicated across the boundary and can
drift; a test pins them. M1-03 owes the generator, recorded in `docs/BACKLOG.md`.

**The two applications hold duplicate copies** of the session, the guards and the primitives
(D-009). A change to one has to be applied to the other, and nothing enforces it.

**No dark mode, and no narrow viewport.** See `docs/design-system.md`.
