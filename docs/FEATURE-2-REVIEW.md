# Feature 2 (pilot clinic setup): review

Review date: 2026-11-03. Reviewer: a fresh session with a review-only mandate, which did not
write this code. Scope: commits `295b96b` (pilot clinic setup) and `5ceeaa2` (its browser
fixes), plus the parts of `ccdfc70` that changed the same module (the webhook secret), all
read as they stand at `f045e71` on `feat/clinic-dashboard`. Every "Verified" below was run,
not reasoned. The probes, sabotage edits and scratch databases lived in a copy of the
repository in a temporary directory, and the working tree here is unchanged apart from this
file.

This file replaces the 2026-10-29 version, which recorded that Feature 2 did not yet exist.

## Status, 2026-11-04

The findings below are recorded as they stood at `f045e71`. Every Important finding has since
been fixed on `feat/clinic-dashboard`, each with tests that fail on the code this review read:

| Finding                                                                                                                                           | Fixed in                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| SHIP-01 phone validation                                                                                                                          | `90a3b8c`, then `8efd5d8` (full metadata on the server, minimal in the browser) |
| SHIP-02 prompt rendering                                                                                                                          | `3385dd2`                                                                       |
| SHIP-03 rename collisions, SHIP-04 secrets, SHIP-05 prompt version, SHIP-06 agent number, SHIP-07 clinics without shell rows, SHIP-09 confinement | `659ecb7`                                                                       |
| SHIP-08 bootstrap lock test, and the guards S21 and S22 showed were blind                                                                         | `c9514d2`                                                                       |

Of the Minor findings, these were fixed as well: the duplicate-name message naming the phone
(`659ecb7`), the console showing a stale webhook secret (`659ecb7`), and
`common/permissions.ts` below its coverage floor (`c9514d2`). These remain open:

- names differing only in spacing count as different clinics, and case-variant service names
  are allowed
- `003_pilot_clinic.sql` has no pre-check for existing case-variant clinic names
- an unknown prompt version answers 409 instead of 400
- the FAQ schema allows a body larger than `BODY_LIMIT`
- time zones are stored in non-canonical forms
- duplicate languages are accepted
- clearing the profile's contact phone leaves the clinic line in place
- the bootstrap's refusal text points to a console screen that does not exist, and it does not
  print the database it is about to write to
- `db:check-policies` checks a policy's name, not its predicate

## Verdict

**Safe to merge: yes, after fixes.** Nothing found breaks tenant isolation, leaks a secret
or makes the bootstrap command reachable or repeatable. Those are the parts this feature
could least afford to get wrong, and each was attacked directly and held: cross-tenant
access answers 404 on every section, neither secret appears in any response or audit row,
the bootstrap refuses a second run, a hand-made super admin, a missing or wrong
confirmation and a three-way race. What does not hold is the claim that validation is
production grade. Indian landline numbers in Mumbai and Delhi cannot be entered at all,
while an Indian toll-free number is silently stored as a US one and an 11-digit typo as an
Iranian one. Clinic-authored text containing `$'` or `{{...}}` corrupts the master prompt
without an error. A rename onto an existing name answers 500. The readiness indicator calls
the prompt version satisfied before anything has been pasted into Sarvam. Regenerating the
tool secret silently replaces the webhook secret too. **SHIP-01 to SHIP-06 should be fixed
before the pilot clinic is configured**, because each one either stores something wrong
about that clinic or tells its operator something untrue. SHIP-07 to SHIP-09 do not touch the
pilot path today but should land before merge, because each leaves a protection that no test
would miss. The test suite is strong
where it was aimed (18 of 22 sabotages failed a named test), but four protections can be
removed with it still green, and one of them, the bootstrap's advisory lock, produced three
super admins from three concurrent runs once removed.

## The gate, as run by this review

`npx turbo run build typecheck test --force` from the repository root, exit 0, 2m46s.
16 of 16 tasks succeeded. Tests: API 981 (60 files, including the database suite in a real
PostgreSQL container as `app_user`), shared 292, clinic dashboard 250, admin console 106,
api-client 14. Total 1,643 passed, 0 failed, 0 skipped. `pnpm lint` was not part of the
requested command and was not run.

## Critical

None found. What was checked to reach that, each Verified:

- **Bootstrap reachability.** No file under `apps/api/src` imports
  `prisma/bootstrap-super-admin.ts` or names it, `tsconfig.build.json` builds only `src`,
  and no built file in `apps/api/dist` mentions it. There is no platform-user route of any
  kind (the console's "Internal users" page is a placeholder).
- **Bootstrap behaviour, as the real CLI** against a scratch PostgreSQL with the real
  migrations and policies, connecting as `app_user`. With no confirmation variable, or with
  `yes`, it exits 1 and prints no password. Three concurrent runs created exactly one super
  admin and the other two refused. A second run refused. After demoting that admin and
  inserting a `DEACTIVATED` super admin by hand in SQL, it still refused. The stored hash is
  `$argon2id$v=19$m=65536,p=4,t=3`, matching the pinned parameters. The password comes from
  `randomInt` (the CSPRNG), 24 characters from a 31-letter alphabet, about 119 bits.
  `must_change_password` is true. The audit row is `platform.super_admin.bootstrapped` with
  NULL actor, NULL role, NULL organisation and `{"actor": "bootstrap", "mustChangePassword":
true}`. The printed password was searched for and appears only once on stdout, never in
  `audit_logs`, the PostgreSQL container's log, or any snapshot file (the repository has
  none).
- **Secrets in responses.** After a first save, a second save and a regeneration, neither
  the tool secret nor the webhook secret appeared in the clinic detail or the clinic list,
  and no response field contains the word "hash". A second ordinary save returns `{}`.
- **Cross-tenant.** A clinic owner of clinic A, against clinic B: GET detail, and PUT
  profile, booking policy, agent profile, telephony, FAQs and hours, each answered 404. A
  service of clinic B addressed under clinic A's path answered 404. The owner's clinic list
  contained only their own clinic.
- **RLS on the five new tables.** `db:check-policies` on a freshly migrated scratch database
  reports all 31 tenant tables, including the five new ones, with `tenant_isolation`
  enabled and forced. A sixth tenant table added with no policy made it exit 1, as did the
  same table with the policy enabled but not forced. (See SHIP-12 for the case it misses.)

## Important

### SHIP-01 Phone validation rejects real Indian landlines and silently stores wrong foreign numbers

`packages/shared/src/phone.ts:22` and `:129`. Verified through `POST /api/v1/organisations`:

| Typed                                                                                 | Result                                                                |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `022 2345 6789`, `(022) 2345 6789`, `+91 22 2345 6789` (Mumbai)                       | 400                                                                   |
| `011 2345 6789` (Delhi)                                                               | 400                                                                   |
| `080 2345 6789` (Bengaluru)                                                           | 201, `+918023456789` (correct, but only because 8 is a mobile prefix) |
| `1800 123 4567` (Indian toll-free)                                                    | 201, stored `+18001234567`, a US toll-free number                     |
| `98765432101` (a mobile with one extra digit)                                         | 201, stored `+98765432101`, an Iranian number                         |
| `987654321` (nine digits), `+1`                                                       | 400                                                                   |
| spaces, hyphens, brackets, a trunk `0`, `0091`, `+1 415 555 0100`, `+44 20 7946 0958` | 201, correct E.164                                                    |

`INDIAN_NATIONAL` is `^[6-9]\d{9}$`, which is the mobile range. Fixed-line numbers after the
area code begin with 2 to 5 (Mumbai 22, Delhi 11, Chennai 44, Kolkata 33, Hyderabad 40).
Any digit string of 11 or more without a leading `0` is taken as already international.

**Failure scenario.** A Mumbai clinic whose front desk is `022 ...` cannot be created,
because the clinic phone is required at create. An operator who types the clinic's
`1800` helpline gets a 201, and the master prompt then tells callers that the "telephone for
a human" is a US number.

**The test pins the defect.** `packages/shared/src/phone.test.ts:46` says "Indian subscriber
numbers never begin with 0 to 5" and asserts the rejection. That is the implementation's
mobile-only assumption written down as a fact, the class of test this review was asked to
look for.

**Fix.** Accept Indian fixed-line numbers (`+91` followed by an area code and subscriber
number, 10 national digits beginning 1 to 5, excluding known invalid prefixes), refuse
`1800`/`1860` without a `+91` rather than reading them as `+1`, and refuse an unprefixed
11-digit number that does not begin with `0` instead of guessing a country. Replace the
"never begin with 0 to 5" cases with real landline numbers that must be accepted.

### SHIP-02 Clinic text containing `$'`, `$&` or `{{...}}` corrupts the master prompt

`apps/api/src/voice/prompts/registry.ts:127`. Verified with the real renderer and through
the API.

`renderPromptTemplate` substitutes with `text.replaceAll('{{name}}', value)` once per
placeholder in sequence. That has three consequences for text a clinic types:

1. A string replacement expands `$'`, `` $` `` and `$&`. A greeting of
   `Namaste! Consultations from $' onwards` truncated the greeting and spliced the rest of the
   template into the prompt: 53 lines became 93, "Telephone for a human" appeared twice, and
   no error was raised.
2. A greeting of `Hello, our doctors: {{doctors}}` was rewritten by the later `doctors`
   substitution. The prompt read "Hello, our doctors: (not recorded yet, so do not answer
   questions about it: offer to take a message)".
3. An FAQ answer of `See {{price}} list` made the render throw ("still contains unfilled
   placeholders"), so `pnpm prompt:render` cannot produce a prompt for that clinic at all.

**Failure scenario.** The prompt is what a machine says to patients (D-014). An operator
pastes a corrupted prompt into Sarvam: instructions duplicated, the greeting cut short,
nothing flagged. Item 3 blocks the render outright.

**Not a secret leak.** The placeholder set is closed (`PROMPT_PLACEHOLDERS`) and the
renderer's input type, `ClinicConfiguration`, carries no secret, hash, token, organisation
id or patient field, so no template edit can reach one. A rendered prompt contained no
organisation id.

**Fix.** One pass with a function replacement, so values are never re-scanned and never
interpreted: `template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key])`, with the
unknown-key check done on the template alone. Add renderer tests with `$'`, `$&` and
`{{doctors}}` in clinic text.

### SHIP-03 Renaming a clinic or a service onto an existing name answers 500

`apps/api/src/modules/organisations/organisations.service.ts:261` and `:472`. Verified.

`PATCH /api/v1/organisations/:id` with another clinic's name answered **500**, and so did
`PATCH .../services/:serviceId` with a sibling service's name. Create catches the unique
violation and answers 409. Update does not, and the error handler has no mapping for
Prisma's `P2002`. Both transactions rolled back, so nothing was half-written.

**Failure scenario.** An operator correcting a clinic's name gets "something went wrong",
and the error log gains an unhandled exception for a predictable user mistake. This also
breaks the CLAUDE.md rule that errors are `AppError` subclasses.

**Fix.** Map `uniqueViolationTarget` to `ConflictError` in `updateOrganisation` and
`updateService`, as the creates do. Better, map `P2002` to 409 once in the error handler.
Add the two cases to `tests/clinic-configuration.test.ts`.

### SHIP-04 Regenerating the tool secret silently replaces the webhook secret, and older clinics can never get one

`apps/api/src/modules/organisations/organisations.service.ts:648` and `:664`. Verified.

The webhook secret is minted when, and only when, the tool secret is.

- **Regeneration.** `regenerateToolSecret: true` returned a new `toolSecret` and a new
  `webhookSecret`. The confirmation the console shows
  (`apps/admin-web/src/features/clinics/sections/SarvamMappingSection.tsx:247`) warns only
  that tool calls will fail. The webhook URL configured in Sarvam stops matching too, and
  call events then go nowhere.
- **A clinic whose tool secret predates the webhook secret** (any clinic mapped before
  `ccdfc70`). With `webhook_secret_hash` set to NULL and a tool secret present, an ordinary
  save returned `{}`. The only way to get a webhook secret is to regenerate the tool secret
  and break the live agent.
- **Readiness does not know about it.** That clinic's readiness lists no Sarvam item as
  missing.

**Failure scenario.** An operator regenerates the tool secret after a suspected leak,
pastes it into the tool configuration as told, and the clinic's call history goes silent.
The webhook's own design note says this symptom "is not a failure anybody notices quickly".

**Fix.** Mint each secret on its own condition (webhook secret when absent or when its own
regenerate flag is set). Say in the confirmation exactly which secrets will change. Add
`sarvamMapping.webhookSecret` to `clinic-readiness.ts`.

### SHIP-05 The prompt version is set when a clinic is created, so readiness and D-014's record are wrong from day one

`organisations.service.ts:212` (`promptVersion: DEFAULT_PROMPT_VERSION` at create) and
`packages/shared/src/clinic-readiness.ts:210`. Verified: a newly created clinic stores
`v0-placeholder`, and its readiness `missing` list has no `sarvamMapping.promptVersion`.

D-014 says the stored version is "our record of what was pasted" and "how you tell which
clinics still owe a re-paste". The readiness label reads "Which master prompt version is
loaded in Sarvam". Both are satisfied before anyone has opened Sarvam. Once a second version
exists, a clinic that was never pasted is indistinguishable from one running v0.

The prompt version is shown on each clinic's own detail page only. Nothing (list column,
filter or command) finds the clinics on an old version, short of SQL against
`voice_agents.prompt_version`.

**Missed by the test.** `tests/clinic-configuration.test.ts:718` checks a new clinic's
missing items but never asserts the prompt version is among them.

**Fix.** Leave `prompt_version` NULL at create, so it is set only when the operator records
what was pasted. Add a test that a new clinic reports it missing. Expose the version on the
clinic list, or as a filter, so "who owes a re-paste" has an answer that is not SQL.

### SHIP-06 An agent number equal to the clinic's own line silently deletes the clinic line

`apps/api/src/modules/organisations/organisations.repository.ts:806`. Verified.

`replaceNumberOfKind` upserts on `(organisation_id, e164)` and updates `kind`. Saving the
Sarvam mapping with `agentPhone` equal to the clinic's existing line returned 200. Afterwards
the clinic's `clinicPhone` was NULL and the number existed only as the agent number.

**Failure scenario.** An operator who misreads the form enters the clinic's own number as
the agent number. The clinic loses its public line with no error, and the prompt's
"Telephone for a human" becomes "not recorded". Readiness does flag the missing phone, which
is the only signal.

**Fix.** Refuse a mapping whose agent number equals the clinic line (and the reverse in the
profile save) with a 409 that says why, rather than re-kinding the row.

### SHIP-07 Section saves fail on a clinic that has no shell rows, and the Sarvam save hands out secrets it never stored

`organisations.repository.ts:463`, `:471`, `:486`, `:504` (`update` on rows that may not
exist) and `:729` (`updateMany`). Verified against an organisation inserted without the
shell rows, which is what `prisma/seed.ts` and `prisma/provision-clinic.ts` both produce.

- PUT profile, booking policy, agent profile and telephony each answered **500**
  (Prisma `P2025`, unmapped).
- PUT sarvam-mapping answered **200 with a `toolSecret` and a `webhookSecret`**, and the
  organisation has zero `voice_agents` rows: `updateMany` matched nothing and the secrets
  authenticate nothing.

**Failure scenario.** Production clinics come from the console's create, which does write
the shells, so the pilot path is not affected today. Every seeded or provisioned clinic in
development and in the browser tests is, and the "secret shown once" screen there shows
secrets that do not exist. That is the same silent failure the bootstrap test file warns
about ("a command that writes an unusable account has failed while appearing to succeed").

**Fix.** Use `upsert` for the four one-row sections. In `updateSarvamMapping`, check the
count and fail (or create the agent row) when it is 0, before any secret is returned.
Optionally have `provision-clinic.ts` create the shells.

### SHIP-08 The bootstrap race test passes with the advisory lock removed

`apps/api/tests/bootstrap-super-admin.test.ts:199`. Verified by sabotage S1: with
`pg_advisory_xact_lock` deleted from `bootstrap-super-admin.ts:139`, "leaves exactly one
winner when two runs race" still passed (7 of 7).

With that lock removed the whole database suite (34 files, 648 tests) also stayed green.
The real CLI was then run against the scratch database without the lock: five rounds, each
starting from zero super admins and launching three concurrent runs. **Every round created
three super admins.** With the lock in place, the same three-way race created one. So the
lock is essential, it works, and nothing in the suite would notice its removal. The test
passes because its two contenders run in one Node process, where the timing happens to
serialise them.

**Failure scenario.** The lock is the only thing standing between two operators and two
super admins, and the test that claims to prove it ("this is what proves it rather than the
comment claiming it") does not. A refactor that drops it ships green.

**Fix.** Make the race deterministic. For example, open a transaction that takes the same
advisory lock, start both runs, assert both are blocked, release, then assert one created and
one refused. Or hold one run's transaction open between its count and its insert with a hook.

### SHIP-09 Platform roles read and write one clinic under unbounded `asSystem`, which D-017 says is not a control

`apps/api/src/db/principal-scope.ts` (`withPrincipalScope`), used by every function in
`organisations.service.ts` (e.g. `:297`). Code read, plus sabotage S18.

D-017 (settled after this feature landed) says a platform role touching one clinic runs
under `asOrganisationSystem`, because under `asSystem` row-level security is off and only
each repository function's own `organisationId` filter keeps the write inside the clinic:
"a convention, not a control". This module was not moved. Every repository function filters
correctly today, and I checked each one.

Sabotage S18 removed `organisationId` from the `where` of `updateService`
(`organisations.repository.ts`). The whole database suite (648 tests) stayed green. With that
edit applied, a super admin's `PATCH /api/v1/organisations/<clinic A>/services/<clinic B's
service id>` answered **204 and renamed clinic B's service**. Verified. Under
`asOrganisationSystem` the client extension would have confined that write to clinic A, which
is the point of D-017.

**Failure scenario.** A later repository function in this module that forgets its filter
lets a super admin, acting on clinic A's URL, modify clinic B's rows. No test notices.

**Fix.** Use `withOrganisationScope(principal, organisationId, ...)` for every per-clinic
function and keep `withPrincipalScope` for the list and create.

## Minor

- **The duplicate-name 409 names the wrong field.** `organisations.service.ts:225` says "A
  clinic with that phone number already exists", and the comment at `:192` says the guard is
  a phone index. The index is on `lower(name)` (`003_pilot_clinic.sql:70`). Verified: the
  duplicate and the case-variant duplicate both got the phone message. The operator searches
  by phone and finds nothing. The test (`tests/clinic-configuration.test.ts:210`) matches
  only `/already exists/`, so it accepts the wrong text. Fix: name the clinic name in the
  message and correct the comment. The double-submit guard itself works: a replayed
  identical POST got 409, and two concurrent creates got 201 and 409.
- **Names that differ only in spacing are different clinics.** `Probe Dup X` and
  `Probe  Dup X` both got 201. Services `Cleaning` and `cleaning` both got 201 at one
  clinic. Fix: normalise internal whitespace before the unique check, and make the service
  name index case-insensitive. Verified.
- **`003_pilot_clinic.sql` aborts on existing case-variant clinic names.** Verified on a
  scratch database at the pre-feature state: with one clinic it applied cleanly and kept the
  existing hours and services. With `Demo Clinic` and `demo clinic` it failed on
  `organisations_name_unique`. `apply.ts` rolls the file back, so nothing is half-applied,
  but the deploy stops with no hint. The sign-in runbook's `pnpm provision:clinic "Test
Clinic"`, run twice, produces exactly that state. Fix: a pre-check in the file that names
  the duplicates.
- **An unknown prompt version answers 409.** `organisations.service.ts:636`. It is a
  validation failure (400 or 422), not a conflict. The test pins 409
  (`tests/clinic-configuration.test.ts:713`), copied from the implementation. Verified.
- **The FAQ schema allows a body the server will not accept.** 50 FAQs of 300 + 2,000
  characters is valid under `clinicFaqsSchema` (`packages/shared/src/clinic.ts:391`), but the
  request is about 115 KB and `BODY_LIMIT` is 100 KB. Verified: 413 "The request body is too
  large". Fix: lower the per-FAQ limits or raise the route's limit.
- **Time zones are accepted in non-canonical forms.** `asia/kolkata` got 201 and is stored
  lowercase. `Etc/GMT-5` and `Etc/GMT+5` (whose signs are inverted relative to their names)
  and `US/Eastern` are accepted. `EST`, `IST`, `GMT+5:30` and `+05:30` are refused. Fix:
  store `Intl.DateTimeFormat(...).resolvedOptions().timeZone`, and consider refusing `Etc/`.
  Verified.
- **Duplicate languages are accepted and counted.** `["en-IN","en-IN","en-IN"]` got 204.
  Readiness counts languages, so this is harmless today, but the prompt lists the tag three
  times. Fix: dedupe in the schema. Verified.
- **Clearing the profile's contact phone leaves the clinic line.** `organisations.service.ts:333`.
  Verified: after saving the profile with `contactPhone: null`, the profile showed no contact
  phone while the clinic line, readiness and the prompt kept the old number. The two fields
  the comment says are "kept in step" are not. Fix: either clear the line too or make the
  profile field read-only and edit the line in one place.
- **The console keeps showing an old webhook secret.** `SarvamMappingSection.tsx:67` clears
  the issued tool secret at the start of each submit but not the issued webhook secret. Code
  read, not run in a browser. Unverified.
- **The bootstrap's refusal text points somewhere that does not exist.**
  `bootstrap-super-admin.ts:146` says "Create further platform users through the admin
  console". No such screen or route exists. Verified by search. Also, nothing prints which
  database host the command is about to write to, and the refusal message prints the
  confirmation phrase. The real protection against an accidental production run is the
  refusal once a super admin exists, which held. Fix: print the target host and database
  before writing, and correct the advice.
- **`db:check-policies` checks the policy's name, not its predicate.**
  `prisma/sql/check-policies.ts:59`. Verified: a sixth tenant table with a policy named
  `tenant_isolation` of `USING (true)`, enabled and forced, made it print OK. On a fresh
  database `tests/tenant-isolation.test.ts` would catch it behaviourally, because it reads
  the catalog and drives every table cross-tenant. The gap is on deployed databases, where
  `check-policies` is the only check. Fix: compare `pg_get_expr(polqual, polrelid)` with the
  expected predicate.
- **`apps/api/src/common/permissions.ts` is at 84.84% lines,** under the 90% floor for
  permissions. Not introduced by this feature (its last changes are `a0dc197`, `9193ab2`,
  `9e3d426`), but it is the file every check here depends on.

## Permissions and audit

Verified for this feature's cells:

- An internal admin read a clinic's detail (200) and replaced its hours (204), and was
  refused creating a service or a doctor (403 each), which is the matrix. A clinic owner was
  refused the Sarvam mapping on their own clinic (403, the matrix gives them read), clinic
  create (403) and the organisation patch (403). `docs/features/pilot-clinic.md:95-99` and
  `:187` record that the internal-admin limit needs revisiting when support staff onboard
  clinics, and the console shows the section read-only.
- `tests/declared-permissions-are-enforced.test.ts` drives all 15 organisation routes as all
  six user roles through the real middleware chain. See the sabotage table for what it
  catches. Two weaknesses: it reads the expected cell from each route's own declaration
  rather than from the section table in the feature doc (S22), and it counts any status other
  than 403, including a 500, as "granted" (`:666`).
- Every configuration write is audited. Sabotage S8 (no audit record) failed a named test.
  The tool secret is checked to be absent from the audit row. The webhook secret is not
  checked (S21).

## Sabotage: protections removed, one at a time, then reverted

Each edit was applied in the scratch copy, the named suites were run against a fresh
container, and the copy was reset before the next. "Caught" means at least one named test
failed.

| #   | Protection removed                                                                                                          | Caught by                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| S1  | Advisory lock in the bootstrap                                                                                              | **Nothing.** Whole database suite green. See SHIP-08                                                                   |
| S2  | Bootstrap confirmation check                                                                                                | "refuses without the confirmation variable, and writes nothing"                                                        |
| S3  | Bootstrap sets `mustChangePassword`                                                                                         | "creates the first super admin, and the printed password authenticates"                                                |
| S4  | Service create checks `clinic_settings` instead of `doctors_services_hours` (service only)                                  | "POST .../services enforces doctors_services_hours:write for all 6 user roles"                                         |
| S5  | `requirePermission` removed from `writeSection` (every section)                                                             | 11 route cases in `declared-permissions-are-enforced`                                                                  |
| S6  | `requirePermission` removed from `saveSarvamMapping` only                                                                   | "PUT .../sarvam-mapping enforces phone_voice_mapping:write for all 6 user roles"                                       |
| S7  | `reachableOrganisation` removed from `writeSection`                                                                         | "answers a cross-tenant section write with 404 and changes nothing"                                                    |
| S8  | Audit row removed from `writeSection`                                                                                       | 12 cases in `clinic-configuration-is-audited`                                                                          |
| S9  | Tool secret hash added to the detail response                                                                               | "mints the tool secret once, returns it once, and never returns it again"                                              |
| S10 | Every save mints a new tool secret                                                                                          | the same test                                                                                                          |
| S11 | Tool secret written into the audit metadata                                                                                 | "records that a tool secret was issued, and never the secret"                                                          |
| S12 | Overlapping-segment rule removed from the hours schema                                                                      | "rejects overlapping segments", "rejects touching segments"                                                            |
| S13 | Indian number check removed                                                                                                 | three `normalisePhone` rejection cases                                                                                 |
| S14 | Blank-to-null removed from the contact email                                                                                | "treats a blank field as not collected"                                                                                |
| S15 | Duplicate clinic name no longer mapped to 409                                                                               | "refuses a second clinic with the same name", and two more                                                             |
| S16 | Uncollected hours rendered as closed days                                                                                   | "distinguishes hours never collected from a clinic that is closed"                                                     |
| S17 | Password-change gate removed from the organisations routes                                                                  | "refuses a gated user on every non-exempt route"                                                                       |
| S18 | `organisationId` removed from `updateService`'s filter                                                                      | **Nothing.** Whole database suite green. See SHIP-09                                                                   |
| S19 | Announcement-required rule removed from telephony                                                                           | "refuses an announcement mode with nothing to announce"                                                                |
| S20 | Readiness prompt-version rule forced unsatisfied                                                                            | four `clinic-readiness` cases                                                                                          |
| S21 | Webhook secret written into the audit metadata                                                                              | **Nothing** (`clinic-configuration-is-audited`, `clinic-configuration`, `calls` all green)                             |
| S22 | Services moved to `clinic_settings` in BOTH the route declaration and the service, so an internal admin can create services | **Nothing** (`declared-permissions-are-enforced`, `clinic-configuration`, `clinic-configuration-is-audited` all green) |

18 of 22 caught. The four that are not:

- **S1 and S18** are covered under SHIP-08 and SHIP-09.
- **S21.** The audit test checks only the tool secret. Fix: assert the webhook secret is
  absent too, and better, assert the metadata keys equal an allow-list.
- **S22** is the class this review was asked to look for. The permission guard reads the
  expected cell from the route's own `permission` field, so it checks that the code agrees
  with itself. Change both together and an internal admin gains write on services and doctors
  with every test green. Nothing asserts the section-to-cell table in
  `docs/features/pilot-clinic.md:88-93`. Fix: a test that pins that table independently
  (for example, an internal admin creating a service gets 403, and a hard-coded map from
  route to expected cell checked against the registry).

## Coverage, measured by this review

`vitest run --coverage` in `apps/api` (both projects) and `packages/shared`. API total
92.7% lines.

| File                              | Lines      | Branches | Floor                      |
| --------------------------------- | ---------- | -------- | -------------------------- |
| `organisations.service.ts`        | 96.42%     | 86.59%   | 90% (tenancy, permissions) |
| `organisations.repository.ts`     | 95.74%     | 77.08%   | 90% (tenancy)              |
| `organisations.routes.ts`         | 100%       | 83.33%   | 80%                        |
| `organisations.presenter.ts`      | 100%       | 62.50%   | 80%                        |
| `organisations.schemas.ts`        | 100%       | 100%     | 80%                        |
| `voice/prompts/render.ts`         | 97.29%     | 80.00%   | 80%                        |
| `voice/prompts/registry.ts`       | 95.45%     | 83.33%   | 80%                        |
| `db/principal-scope.ts`           | 91.66%     | 87.50%   | 90% (tenancy)              |
| `common/permissions.ts`           | **84.84%** | 84.21%   | 90% (permissions), below   |
| `shared/clinic.ts`                | 94.11%     | 91.89%   |                            |
| `shared/clinic-readiness.ts`      | 100%       | 100%     |                            |
| `shared/phone.ts`                 | 97.50%     | 93.33%   |                            |
| `shared/timezone.ts`              | 100%       | 100%     |                            |
| `prisma/bootstrap-super-admin.ts` | **43.07%** | 55%      | outside the measured set   |
| `prisma/render-prompt.ts`         | **0%**     | 0%       | outside the measured set   |

The coverage configuration includes only `src/**`, so the two commands are never measured
by the gate. I measured them separately. `bootstrapSuperAdmin` is tested, but `main()` (argument
handling, the printing, the direct-run guard) never runs under test, and no test runs
`prompt:render` at all, including its ambiguous-name refusal.

## What this review could not check

- **The browser.** The admin console screens were read and their component tests ran in
  the gate, but `pnpm e2e` was not run, so nothing here was observed in a real browser. The
  stale webhook-secret display above is Unverified for that reason.
- **Sarvam.** No call was placed, no prompt was loaded into Sarvam, and whether Sarvam can
  send the bearer header remains the open question in `docs/sarvam-contract.md`.
- **Production configuration.** Whether the deployed `DATABASE_URL` role has the rights the
  bootstrap needs was not checked against any real environment. Everything ran on local
  containers.
- **The migration against real pre-feature data.** The "existing data" run used a
  hand-built database matching the old seed (one clinic, hours, a service). It was not run
  against a copy of any real environment.
- **The readiness experiment as literally described** ("add a required field and see").
  Readiness is computed once in `packages/shared/src/clinic-readiness.ts`, returned by the
  API and rendered by `ReadinessPanel.tsx` from the response, with no list of requirements
  in the console, so a new rule reaches the screen without a second edit. That was
  established by reading the code and by sabotage S20 (changing one rule failed shared
  tests), not by adding a rule and watching the page.
- **`pnpm lint`** was outside the requested gate command and was not run.
