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

## D-012 One Sarvam identifier per clinic, and the platform generates the tool secret

`voice_agents.external_agent_id` is gone, replaced by `sarvam_app_id`. The two named the same
thing, and the per-clinic tool secret (D-004) is minted by the platform, shown exactly once
and stored only as a SHA-256 hash. No endpoint can read it back.

**Why one identifier:** two columns holding one fact, with nothing enforcing that they agree,
drift. The failure mode is a webhook that resolves to no organisation, which is silent until a
patient's call goes nowhere.

**Why the platform generates the secret rather than accepting one:** it is the entire
authentication for the tool endpoints the agent calls. A secret supplied by an operator is as
strong as whoever typed it felt like making it and arrives by whatever channel they chose.
Minted from the CSPRNG and shown once is the same arrangement as a temporary password (D-003),
for the same reason: a secret the platform can read back is a secret an attacker can read back.

**Regenerating is explicit and confirmed**, because a new secret invalidates the one the live
agent is using and takes that clinic's agent off the air until the new value is pasted into
Sarvam. An ordinary save never mints one.

**The drop was safe once and will not be again.** `external_agent_id` was NOT NULL and the
table was empty in every environment, so the migration drops the column. After a real agent is
mapped, the same change would need a copy-then-drop across two migrations.

---

## D-013 A clinic's configuration is five tables, and every field is nullable until collected

Identity and address, booking policy, agent behaviour, telephony consent, and the frequently
asked answers are five tables rather than fifty columns on `organisations`. Opening hours stay
in `clinic_hours` as one row per opening segment. Every field is nullable, and a blank value
submitted by a form is stored as NULL rather than as an empty string.

**Why separate tables:** the sections are collected at different times, by different people,
from different sources. Grouping them means one write touches one section, one audit row names
one section, and one form maps to one row.

**Why nullable, and why blank means not collected:** a clinic is configured over several
conversations, so a half-collected section has to be a storable state. This is not a nicety. An
HTML input has no null, so an uncollected field arrives as `''`, and with the email and phone
validated strictly a clinic whose email nobody had asked for yet could not have its ADDRESS
saved. Whether what has been collected is enough to go live is a separate, advisory question,
answered in one place by `packages/shared/clinic-readiness.ts`.

**A break is the gap between two opening segments and a weekly off is a weekday with none.**
`organisations.opening_hours_collected_at` is what distinguishes a clinic that is closed on
Sunday from one nobody has asked, which row counts alone cannot. The agent is told to state no
hours at all in the second case rather than asserting a closure nobody confirmed. Overnight
hours are refused for now, in the schema and by a CHECK constraint.

---

## D-014 The master prompt is versioned files in the repository, not rows in a table

Each version is a file under `apps/api/src/voice/prompts/`, listed in a registry, and a clinic
stores the version string its Sarvam agent is actually running. Adding a version changes
nothing for a clinic still marked with an older one.

**Why files:** the prompt determines what a machine says to a patient about their healthcare. A
change to it deserves what a change to a permission check gets, which is a diff, an approver and
a commit that says why. A prompt edited through a form by whoever was logged in, with the
previous wording gone, is not reconstructable six months later when a patient says the agent
told them something.

**Why a clinic stores a version:** the platform does not push prompts. A person pastes the
rendered text into Sarvam's console, so the stored version is our record of what was pasted, and
it is how you tell which clinics still owe a re-paste after a prompt change.

**Availability is never rendered into a prompt.** Not which slots are free, not a count, not
today's schedule. A prompt is a snapshot, and an agent answering from a snapshot offers a slot
that was taken an hour ago. Hours, services and policies may be baked in for now because they
change rarely, and `docs/features/pilot-clinic.md` records that this set is expected to shrink
once the tool endpoints exist.

---

## D-015 One data layer: Redux Toolkit and RTK Query, with TanStack Query removed

Server data lives in RTK Query caches. Global client state (the session, user-interface
preferences, filters that cross screens) lives in Redux Toolkit slices. TanStack Query is
removed from the repository, including from the admin console, which had one hook using it.

**Why one and not two:** the clinic dashboard is the first application with enough screens for
the choice to matter, and it arrived with TanStack Query already installed in both web
applications but used by a single hook. Two cache libraries means two invalidation models, two
sets of retry semantics and two answers to "where does this data come from", and every later
feature has to pick. Picking once, now, while the cost of changing is one hook, is cheaper than
picking per feature for a year.

**RTK Query's baseQuery is `packages/api-client`, never `fetch`.** The client holds the
single-flight refresh on 401, the CSRF header and `credentials: 'include'`, and all three were
verified in a real browser in the sign-in feature. A baseQuery that called `fetch` directly
would silently reimplement a session that is already correct, and the failure mode is not a
broken request: it is five parallel queries each triggering a refresh, the refresh token
rotating under them and the user being signed out by their own page load. A test asserts that a
401 inside an RTK Query call produces exactly one refresh and one retry.

**Server data is never copied into a slice.** A slice holding a copy of what a query cache
already holds is a second source of truth with no invalidation, which is the specific bug this
decision exists to prevent.

---

## D-016 M1-14 moves to after the pilot call, which amends D-008

D-008 said the `app.platform` escape clause is removed from all 25 row-level security policies
before the voice work begins. It was not, and the voice work proceeded. This entry records that
as a decision taken with the measurements in view, not as a decision that was skipped.

**Why the risk does not bite at pilot scale:** the 13x penalty in D-008 was measured on 50,000
rows. The pilot is one clinic with a handful of patients, where a sequential scan over a tiny
table costs microseconds, so the non-indexable predicate does not threaten the requirement of
voice tool endpoints at p95 under 400 ms. The self-escalation half of D-008 is not reachable
from outside the API process.

**What it is now gated on, in place of "before M3":** M1-14 lands immediately after the real
call works, and before either a load test or a second clinic. Those two events are precisely
the points at which the reasoning above stops holding: a load test runs against the row counts
where the sequential scan was measured, and a second clinic is where one tenant's compromise
reaching another stops being hypothetical.

**D-008 is not deleted and its reasoning is not weakened.** Both halves of it remain true at
scale. What changed is the ordering, and the condition that replaces it is written in
`docs/BACKLOG.md` as well, because that is where whoever picks the ticket up will look.

---

## D-017 A platform read of one clinic is confined by the application lock, not by convention

`asSystem` is for the paths that have no single organisation: login, resolving a provider
webhook, the clinic list, jobs. A platform role reading ONE clinic's patients or appointments,
which the matrix grants as `read: 'masked'`, runs under a third scope kind,
`platform-organisation`, served by `asOrganisationSystem`.

It is platform scope in the DATABASE, because `app.platform = 'on'` is what lets the query
past row-level security, and tenant scope in the APPLICATION, because the client extension
injects `organisation_id` from the named clinic exactly as it does for a clinic user.

**Why it exists.** The first version of the dashboard's patient and appointment reads used
unbounded `asSystem` and relied on every repository function filtering by organisation itself.
That is a convention, not a control: row-level security is off for those connections, so a
function added in a later feature without the filter returns every clinic's patients, and no
existing test fails. The lock belongs in the one place it cannot be forgotten.

**The repository filters stay**, as a second layer, and the tests say which layer is which.
`tests/platform-scope-isolation.test.ts` drives every repository read under this scope, and
also issues the queries a function that forgot its filter would issue. Deleting the
`platform-organisation` branch from the extension fails six named cases; deleting one
repository function's filter fails none, which is the demonstration that the extension is the
control.

**A clinic principal cannot be scoped to another organisation at all.** `withOrganisationScope`
refuses it rather than opening a scope, because reaching that line means an organisation came
from something other than the token.

**What the extension does with each operation, measured rather than assumed.** `findUnique`
needs no rewrite to `findFirst`: Prisma 7 accepts the injected non-unique condition, so a
foreign id answers null and `findUniqueOrThrow` raises not-found. `create`, `createMany` and an
`upsert`'s create half are verified against the scope and refused outright, because organisation
never comes from input. `update`, `updateMany`, `delete` and `deleteMany` are injected, so they
touch nothing. Every one of those is a case in `tests/platform-scope-isolation.test.ts`,
including a check that the other clinic's row was not quietly modified, because a write that
reports nothing and still happens is the failure that matters.

**The `Organisation` model was the one real hole, and it is closed.** It is scoped by its
primary key, so a supplied `where.id` used to pass straight through on the reasoning that
row-level security would answer. That reasoning held only while every cross-tenant read ran
with row-level security ON. This scope sets `app.platform = 'on'`, which switches it off, so
`organisation.findUnique({ where: { id: someoneElse } })` returned the other clinic's name, time
zone and settings. The extension now appends the scoped id to `where.AND`, which answers null
instead: still the "not found" rule 7 asks for, with no error that would itself disclose
whether the row exists.

**Raw SQL is outside this extension and cannot be made safe by it.** `$queryRaw` and
`$executeRaw` bypass every injection above. There is none on this path, and a test asserts that
by scanning `src/modules`: the only raw statements in the application are the `set_config` calls
that establish a scope and the health probe's `SELECT 1`, neither of which reads a tenant table.
A repository that needs raw SQL on a tenant table has to put `organisation_id` in the statement
itself and say so.

**THIS SCOPE DEPENDS ON `app.platform`, WHICH M1-14 REMOVES.** `asOrganisationSystem` sets
`app.platform = 'on'` so row-level security lets a platform read through, and the extension's
injection is what confines it to one clinic. When M1-14 replaces that GUC with an `app_platform`
database role, this path must switch to that role in the same change, or every platform read of
a clinic returns nothing.

The failure is fail-closed, which is the right direction and also the reason it would not be
noticed quickly: the dashboard would simply show an internal admin an empty patient list. The
tests that catch it are the positive controls in `tests/platform-scope-isolation.test.ts`, which
assert that the clinic actually named is still readable. `docs/BACKLOG.md` carries the same
warning on the M1-14 entry.

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
