# Decisions that bind future work

Read this before planning or writing anything. These are settled choices, not suggestions:
a change that contradicts one is a change to the decision, which goes through the person
who owns the ticket, not through code review.

Each entry is the decision and one line of why. Where the code does not yet match, the
entry says so rather than pretending.

---

## D-001 Work feature by feature, not layer by layer

One feature is taken from requirement to working endpoint with tests before the next one
starts: schema, service, route, permissions, audit and tests land together in the same
change.

**Why:** a layer finished across ten features is ten features with no proof any of them
work, and the integration defects all arrive at once, at the end.

---

## D-002 The refresh token lives in an httpOnly cookie; the access token lives in memory only

The refresh token is set as `httpOnly`, `Secure`, `SameSite=Strict`, scoped to
`/api/v1/auth`. The access token is returned in the response body and held in a JavaScript
variable. Neither goes in `localStorage`, `sessionStorage`, IndexedDB or a non-httpOnly
cookie, ever.

**Why:** an injected script can read anything in browser storage, so a token that is
readable by JavaScript is a token that leaves with the first XSS.

**Why `Strict` is free here:** SameSite is evaluated on the registrable domain, not the
origin. The dashboard, the admin console and the API deploy as subdomains of one domain, so
they are same-site despite being different origins, and the cookie is only ever needed by a
same-site `fetch` to the refresh endpoint, never by a top-level navigation. `Lax` relaxes
exactly the case this cookie does not use, so it gave away protection for nothing.

**Moving the dashboard to a different registrable domain is a NEW decision, not an edit to
this one.** It would make the two cross-site, and then neither `Strict` nor `Lax` sends the
cookie on a `fetch`: only `SameSite=None` works cross-site, which is a materially weaker
position and needs deciding on its own terms rather than being absorbed as a tweak here.

---

## D-003 New users get a temporary password until an email provider exists

An admin creates the user with a one-time password handed over out of band, and
`mustChangePassword` forces a change on first sign-in. No invite link, no reset email, no
token-by-email flow is built until a provider is chosen and approved.

**Why:** every email-based flow needs a deliverable, monitored provider, and building one
against a provider that does not exist yet means building it twice.

---

## D-004 One Sarvam agent per clinic, with a per-clinic tool secret

Each organisation has its own Sarvam agent, and the tool endpoints authenticate the agent
with a secret issued per clinic, not one shared across the platform.

**Why:** a shared agent or a shared secret makes one clinic's compromise every clinic's
compromise, and the tenant boundary is the thing this product cannot get wrong.

---

## D-005 Phone numbers are bought inside Sarvam

Numbers are provisioned through Sarvam rather than a separate telephony provider, and the
platform stores the mapping from number to organisation and agent.

**Why:** one provider for the number and the agent removes a second integration, a second
contract and a second place for the number-to-clinic mapping to drift.

---

## D-006 Sarvam webhooks are authenticated by three measures, because Sarvam documents none

Until Sarvam publishes a signature scheme: a long random secret in the webhook URL path, an
IP allowlist in front of the endpoint, and re-fetching the authoritative record from Sarvam
before acting on anything the payload claims.

**Why:** none of the three is sufficient alone, and the third is the one that holds: a
forged payload cannot make the platform act if the platform only ever acts on what it
re-read from the provider.

**Replaces, not supplements:** when Sarvam documents a signature scheme, verify the
signature and keep the re-fetch. Record that as a new decision rather than editing this one.

---

## D-007 Responses are buffered until the transaction commits, so no route may stream

`tenantMiddleware` collects the handler's bytes and sends them only once `COMMIT` has
resolved. Consequences, binding on every route: no route streams a response, and call
recordings and other large media are served as presigned S3 URLs, never proxied through the
API.

**Why:** ending the transaction on the response's `finish` event put `COMMIT` after the
client already held a 201, so a client that wrote and immediately read back did not see its
own row, and a failed `COMMIT` could not change a response that had gone out.

**The longer-term fix is per-operation transactions**, not a request-wide one, which would
remove the streaming ban. Deferred, not forgotten. Detail in `docs/STACK.md`.

---

## D-008 M1-14 lands before the voice work starts

The `app.platform` escape clause is removed from all 25 row-level security policies and
replaced by a separate `app_platform` database role, before M3 begins.

**Why:** the `OR current_setting('app.platform', true) = 'on'` disjunct makes the whole
policy predicate non-indexable, so every tenant query sequentially scans its table, measured
at 32.1 ms against 2.45 ms for an index-only scan on 50,000 rows, and M3's gate requires
voice tool endpoints at p95 under 400 ms with 20 concurrent calls.

**It is also the security fix:** `app.platform` is a client-settable GUC, so the API's own
database role can grant itself cross-tenant access. The current transaction-local reset
contains that per transaction; it does not remove it.

---

## D-009 Each web application holds its own copy of the shared layer

The clinic dashboard and the admin console are standalone React and Vite projects. Neither
imports a shared user-interface package. The design tokens, the primitives, the session
implementation, the shell and the three auth screens exist twice, once in each application.

**Why:** the two applications are to be separated into their own repositories once
development is finished. A shared package would then have to be published to a registry and
versioned, or extracted under deadline. Holding the copies now makes the split a move of a
directory.

**This supersedes part of the sign-in brief**, which said both applications share one design
system and one auth implementation. They share the design, which is the token files and the
component set, and they no longer share the implementation. That was a deliberate change,
not a drift.

**The cost, stated plainly:** a change to the session, a guard or a primitive has to be
applied twice, and nothing enforces that. The two will diverge. What stops that mattering is
that the shared pieces are small and finished: the session is the whole of this feature, and
after it the two applications grow apart anyway. If they start sharing new behaviour, this
decision should be revisited rather than worked around.

**What stays shared, and must:** `packages/shared` holds the permission matrix, which the API
also imports. Duplicating it would put a second copy of the authorization rules in a web app,
which root `CLAUDE.md` rule 3 forbids. `packages/api-client` holds the session transport,
because the API surface is one contract and M1-03 generates it from one OpenAPI document.

---

## D-010 The admin console requires a platform role, not only a matrix cell

A sidebar item or page in the admin console is reachable when the role is `SUPER_ADMIN` or
`INTERNAL_ADMIN` **and** the matrix permits the resource. The clinic dashboard needs only the
matrix.

**Why:** two of the console's four resources are readable by a `CLINIC_OWNER`. `organisations`
and `phone_voice_mapping` are both `r()` for that role, and the matrix says beside the first
of them that it means the owner's own organisation, which tenant isolation enforces. That is
not access to the platform-wide list of clinics the console shows. Filtering the console's
menu on the cell alone put "Clinics" and "Settings" into a clinic owner's sidebar.

**It is a presentation decision, not a security one.** The API already refuses a clinic
principal every platform-scoped read, so nothing was exposed. What was wrong was the product
offering a door that the server would not open.

**The predicate is defined once**, as `permits` in the console's `app/navigation.ts`, and used
by the menu, the route guard and `useCan`. The bug it fixes was precisely those three
disagreeing: the menu hid the item and the route let it through, so the page was reachable by
typing the path.

---

## D-011 The product is ClinicAI, and the rename went all the way down

The product, the packages, the cookie, the CSRF header, the problem-type URLs and the
development host names all read ClinicAI. `@clinicai/*`, `clinicai_refresh`,
`X-ClinicAI-Csrf`, `https://clinicai.health/problems/...`, `*.clinicai.localhost`.

**This supersedes the sign-in brief**, which said "Product name in the UI: ClinicAI. One
name everywhere, matching the repo, packages and cookie" with the name ClinicAI in place of
an earlier one. The instruction to use one name everywhere is unchanged and is now honoured
literally: there is no second name anywhere in the tree.

**Two identifiers were deliberately left alone, both because renaming them has a data
consequence rather than a cosmetic one.**

`_openhours_sql_migrations` is a table recording which hand-written SQL files have been
applied. Renaming it leaves the new table empty on any existing database, so every SQL file
re-runs. Closing that needs a migration that copies the rows, not a search and replace. It
is invisible to users and to the API, which never reads it.

The `docker-compose.yml` project name is still `openhours`, which scopes the volume holding
a developer's local database. Renaming it points compose at a fresh empty volume. The old
data is not destroyed, but it looks destroyed, and no developer should discover that by
surprise. Both are worth closing deliberately, together, with the volume rename written
down first.

**The prototype directory keeps its own name**, `ClinicFlow Interactive Prototype`. It is a
third-party artefact kept as the design system's provenance and is not product code.

**One thing the rename surfaced:** `prisma/seed.ts` upserts by email but assigns fixed ids,
so changing a seed email on an existing database fails with a primary-key collision rather
than updating the row. It only bites a developer who re-seeds across a rename, and the fix
is to upsert by id. Not fixed here, because the database it affects is disposable.

---

## What no automated test currently covers

**That the refresh cookie is actually sent: NOW VERIFIED.** This was the open item here and it
is closed. On 2026-10-29 both Playwright suites ran green against a throwaway PostgreSQL
container with the real migrations, the real row-level-security SQL and a provisioned clinic:
8 of 8 in the clinic dashboard, 4 of 4 in the admin console. A real browser was observed
setting the cookie `httpOnly`, `Secure`, `SameSite=Strict`, path `/api/v1/auth`; attaching it
to a same-site fetch from a sibling subdomain; and restoring a session after a reload had
destroyed the in-memory access token. D-002 is now correct by execution, not only by
reasoning.

**The run found a defect nothing else could have.** `clear()` in the auth provider was guarded
by a `live` ref whose effect had only a cleanup function. React's StrictMode runs an effect,
then its cleanup, then the effect again, so the first teardown set the ref to false and nothing
set it back: `clear()` became a permanent no-op in development. Signing out revoked the session
on the server, logged `revoked: 1`, returned 204, and left the user sitting in the dashboard
with the button spinning. The same no-op swallowed the sign-out that must follow a password
change. jsdom could not catch it, because the component suite does not render through
StrictMode, and the API suite could not, because the server did its half correctly. **That is
the argument for keeping the browser tests**: they are the only layer that exercises the two
halves together, so run them after any change to the session.

They remain outside `pnpm check`, because they need the API, a database and a provisioned
clinic, and a gate leg that cannot run on a clean checkout is one that gets skipped. Run them
with `pnpm e2e` from an application directory. The runbook is in `docs/features/sign-in.md`,
and it now works, which it did not before: nothing in the repository loaded `.env`, so every
command in it failed on a fresh shell.

**That a demoted user loses access immediately.** They do not. A role change takes effect at
the next refresh, so a demoted user keeps their previous access for up to the access-token
lifetime of 15 minutes. This is accepted, and recorded here as well as in
`docs/features/sign-in.md` so it is not rediscovered as a defect.
