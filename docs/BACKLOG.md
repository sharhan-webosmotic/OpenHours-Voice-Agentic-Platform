# Backlog

Work that is owed, committed to the repository so it is visible to everyone rather than only
to the machine holding `docs/ROADMAP.md`, which is git-ignored.

This file is for debt with a due point. It is not a ticket tracker and not a wish list: an
entry earns its place by naming what is missing, why it is owed, and the point by which it
must land. A settled choice goes in `docs/DECISIONS.md` instead. An entry is deleted when
the work lands, not marked done.

## Everything owed, at a glance

| Entry                                                                                    | What                                                           | Due                                                               |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| [M1-03](#m1-03-openapi-document-and-generated-client)                                    | OpenAPI document, drift check and generated client             | With M1-14, right after the first real call. Slipped twice        |
| [M1-14](#m1-14-replace-the-appplatform-guc-with-a-separate-platform-database-role)       | The platform database role replacing `app.platform`            | After the first real call, before a load test or a second clinic  |
| [V2](#v2-a-racing-voice-booking-can-answer-call-you-back-instead-of-slot-taken)          | Racing voice bookings occasionally answer "call you back"      | **Must be understood before a second clinic**                     |
| [T1](#t1-foreign-keys-do-not-carry-the-organisation-so-a-scalar-id-can-link-two-clinics) | Composite tenant foreign keys                                  | Before a second clinic                                            |
| [V1](#v1-the-audit-trail-cannot-name-the-voice-agent-as-an-actor)                        | The audit trail cannot name the voice agent                    | Before a second clinic takes live calls                           |
| [R1](#r1-r2-gives-no-data-residency-guarantee-and-nobody-has-accepted-that)              | R2 data residency, an open product decision                    | Before a second clinic is onboarded or a hospital group is quoted |
| [B1](#b1-the-nightly-backup-has-never-been-restored)                                     | The nightly backup has never been restored                     | Before go-live, and monthly after                                 |
| [S1](#s1-whether-sarvams-interactions-list-tells-an-unknown-call-apart)                  | Whether Sarvam's interactions list tells an unknown call apart | The first Sarvam session with credentials                         |
| [S2](#s2-four-sarvam-behaviours-the-design-rests-on-are-undocumented)                    | Four undocumented Sarvam behaviours the design rests on        | The first real call, answered before a second clinic              |
| [P1](#p1-the-built-screens-have-not-been-reviewed-against-the-prototype)                 | Prototype fidelity review of the built screens                 | Before the dashboard is shown to a second clinic                  |
| [F3R](#f3r-what-the-trimmed-feature-3-review-did-not-cover)                              | The rest of what the trimmed Feature 3 review did not cover    | Before go-live                                                    |
| [F2M](#f2m-feature-2-minor-findings-left-open)                                           | Feature 2 Minor findings left open                             | Before a second clinic                                            |
| [I10](#i10-uniform-login-timing-is-claimed-as-a-control-and-asserted-nowhere)            | Uniform login timing claimed and not asserted                  | With the M7 security audit                                        |

---

## M1-03 OpenAPI document and generated client

**Due: in the same slot as M1-14, immediately after the pilot clinic's first real call
works. This is its SECOND slip.**

**The slips, recorded honestly.** It was first due before the third feature slice. The third
feature slice is the clinic dashboard, and it did not land there either: the dashboard's
patients, appointments, availability, agenda and call endpoints were hand-written into
`packages/api-client` in the same pattern as `clinics.ts`, on the reasoning that RTK Query's
code generation works from an OpenAPI document, so building the document after the pilot call
is also when the generator pays off most rather than merely when it is convenient.

**The cost is growing, and it is now the largest single piece of debt in this repository.**
Five auth endpoints became twenty when the pilot clinic feature added fifteen, and the clinic
dashboard adds roughly twenty more across patients, appointments, availability, agenda and
calls. Every one of them is a hand-maintained description of a contract the API already
describes in zod, which means every one is a place the two can disagree silently. The gate
cannot catch that, because the drift leg is exactly what this ticket owes.

`packages/api-client` is described throughout the repository as generated from an OpenAPI
document. Neither exists. The document was to be generated from the zod schemas that every
route already registers through `registerRoute` (`apps/api/src/common/route-registry.ts`),
and the client was to be generated from the document.

**Why it is owed now:** `pnpm check` used to end with an `openapi:check` leg that was a stub
printing "not yet implemented" and exiting 0. The gate therefore reported an OpenAPI drift
check it was not performing. The leg and both stub scripts were removed in the sign-in
feature rather than made to fail, because a leg that fails on every commit until M1-03 lands
would have made the gate red for the whole feature and a permanently red gate is ignored in
the same way a permanently green one is. So the gate now asserts exactly what it runs, and
the drift check is owed back.

**What landing it means:** generate the document from the registry, commit it, add a drift
leg to `pnpm check` and to CI that fails when the committed document and the registry
disagree, generate `packages/api-client` from it, and replace the hand-written client the
sign-in feature added for the five auth endpoints.

**It now owes more than five endpoints.** The pilot clinic feature added
`packages/api-client/src/clinics.ts` by hand: fifteen clinic configuration endpoints, their
request and response types, and a second copy of the four-line problem+json parser from
`client.ts`. Written by hand for the same reason as the auth five, which is that the front-end
rules forbid a raw `fetch` in a feature and the generator does not exist, and recorded here
rather than left for whoever picks this ticket up to discover. The request types are at least
not a new description of anything: they are the zod-inferred types from `@clinicai/shared`
that the API parses with.

**Blocking detail:** the zod-4 compatibility of `@asteasolutions/zod-to-openapi` 9.1,
`openapi-typescript` 7.13 and `openapi-fetch` 0.17 has never been exercised. That is the
open "VERIFY zod 4 compatibility on Day 1" item in `docs/STACK.md`, and it is the first
thing M1-03 has to settle, because an incompatible generator changes the approach rather
than the schedule.

---

## M1-14 Replace the app.platform GUC with a separate platform database role

**Due: immediately after the real call works, and before either a load test or a second
clinic.**

D-008 says this lands before the voice work starts. It did not, and that was a deliberate
decision taken with the measurements in front of us rather than a thing that was forgotten.

**Why it was not blocking at pilot scale.** The 13x figure in D-008, 32.1 ms against 2.45 ms,
was measured on 50,000 rows. The pilot is one clinic with a handful of patients, where a
sequential scan over a tiny table costs microseconds, so the non-indexable policy predicate
does not threaten M3's requirement of voice tool endpoints at p95 under 400 ms. The
self-escalation half of D-008 is not reachable from outside the API process. Landing a change
to all 25 row-level security policies in the middle of the dashboard feature would have delayed
the pilot call for a risk that the pilot's own shape does not carry.

**Why the condition is a load test or a second clinic, not a date.** Both are the points at
which the reasoning above stops being true. A load test is run against row counts where the
sequential scan is the measured problem, and a second clinic is the point at which one tenant's
compromise reaching another stops being hypothetical. Either one arriving before this lands
means this lands first.

**What landing it means:** remove the `OR current_setting('app.platform', true) = 'on'`
disjunct from all 25 policies in `apps/api/prisma/sql/`, add an `app_platform` database role
with its own policies, and point the three scripts that currently set the GUC
(`seed.ts`, `bootstrap-super-admin.ts`, `provision-clinic.ts`) and the test support in
`apps/api/tests/support/db.ts` at that role instead.

**IT ALSO BREAKS EVERY PLATFORM READ OF A CLINIC UNLESS IT IS CHANGED IN THE SAME COMMIT.**
`asOrganisationSystem` (D-017), which serves a platform role's masked read of a clinic's
patients and appointments, sets `app.platform = 'on'` precisely so row-level security lets the
query through, and relies on the client extension to confine it to the named clinic. Remove the
GUC without pointing that function at the `app_platform` role and those reads return nothing.

The failure is fail-closed, so nothing leaks, and that is also why it would not be noticed
quickly: an internal admin would see an empty patient list and assume the clinic has no
patients. The tests that catch it are the positive controls in
`tests/platform-scope-isolation.test.ts` and `tests/clinic-dashboard.test.ts`, each of which
asserts that the clinic a platform role actually named is still readable. Run both after the
migration, not only the isolation assertions.

**WHAT M1-14 MUST PRESERVE, as acceptance criteria rather than as advice:**

1. A platform principal can still READ one named clinic's patients and appointments, masked.
   `asOrganisationSystem` must open whatever scope replaces `app.platform = 'on'`, which means
   connecting as, or switching to, the `app_platform` role for the life of that transaction.
2. The client extension must still INJECT `organisation_id` under the
   `platform-organisation` scope. The new role must not be given a policy so permissive that
   the injection becomes the only lock by accident: both locks, as for a clinic user.
3. A platform principal still cannot read a clinic it did not name. That is what the whole of
   `tests/platform-scope-isolation.test.ts` asserts, and it must pass unchanged.
4. The positive controls must pass, not merely the negative ones. A migration that makes every
   platform read return nothing satisfies every isolation assertion in the suite and breaks the
   product.
5. `tests/tenant-guc-reset.test.ts` must still pass or be replaced deliberately. It proves that
   a leaked session-level `app.platform` cannot widen a later transaction, and if the GUC is
   gone the test is about a mechanism that no longer exists: deleting it is correct, deleting
   it without replacing the property it protected is not.

---

## I10 Uniform login timing is claimed as a control and asserted nowhere

**Due: with the M7 security audit.**

`apps/api/src/common/passwords.ts`, `docs/FOUNDATION-REPORT.md` and the M1-01 ticket all treat
equal response timing between an unknown email and a wrong password as a control that stops an
attacker enumerating which addresses hold accounts. No test measures it. The test that covers
the two cases compares status, title and detail only, and the sole timing assertion anywhere in
the repository is in `src/common/uuid.test.ts`.

**Why it is owed:** two real asymmetries exist and are unmeasured. The known-email path performs
a database write, `recordFailedLogin`, that the unknown path does not. The decoy hash the
unknown path verifies against is built lazily on first use, so the first unknown-email request
in a fresh process pays an argon2 hash on top of the verify. Either could be large enough to
distinguish the paths, and neither is bounded by anything.

**Deliberately not fixed in the sign-in feature.** A timing test needs a tolerance, and a
tolerance picked without measuring on representative hardware is either so wide it asserts
nothing or so narrow it fails intermittently in CI, which is worse than no test. The decision
was to leave the behaviour as it stands rather than add a test of that shape mid-feature.

**What landing it means:** either add a test with an explicit, measured tolerance and warm the
decoy hash at startup so the first request is not an outlier, or stop describing uniform timing
as a verified control and record it in the source and the report as a best-effort mitigation.
One of the two must happen. What must not survive the audit is the present state, where the
comments claim a control the suite does not check.

## V1 The audit trail cannot name the voice agent as an actor

**Due: before a second clinic takes live calls.** Not before the pilot call, because the
information is recorded today, in the wrong place.

`audit_logs.actor_user_id` points at a user and `audit_logs.actor_role` IS the database's
`role` enum, which has six values and deliberately no `VOICE_AGENT` (D-021). So an
appointment booked, moved or cancelled by the agent is audited with no actor at all. Who did
it is recoverable only from `metadata.source` on a booking and `metadata.actorSource` on a
reschedule or a cancellation, both of which are conventions that nothing enforces.

**Why it matters:** this is a regulated domain and "who changed this appointment" is the
question an audit trail exists to answer. A convention answers it until somebody adds a write
path and forgets the metadata, and then the row is silently anonymous.

**What the fix probably is**, in order of preference:

1. An `actor_kind` column (`USER`, `VOICE_AGENT`, `SYSTEM`) with `actor_role` and
   `actor_user_id` nullable as now. Additive, and it makes the absence of a user explicit
   rather than indistinguishable from a bug.
2. Add `VOICE_AGENT` to the database `role` enum AND a CHECK constraint on `users.role`
   forbidding it. Smaller, but it puts a non-user value in a column named for users and
   relies on a constraint to keep it out of the one table that must not have it.

Either is a migration reviewed by a second person, and option 1 changes the audit reader and
its tests. `tests/voice-tools.test.ts` asserts the current shape, including the nulls, so the
test that has to change is the one that documents the gap.

---

## T1 Foreign keys do not carry the organisation, so a scalar id can link two clinics

**Due: before a second clinic, the same point as M1-14 (D-016).**

Every foreign key is single-column (`appointments.patient_id` references `patients(id)` alone).
PostgreSQL checks a foreign key without row-level security, so `appointment.update({ data: {
patientId: <another clinic's patient> } })` succeeds on any scope, including an ordinary clinic
user's. The tenant extension cannot see it: it is a scalar column write, not the nested
`connect` the extension now refuses (Feature 3 review, I3, recorded in D-017).

**The control today** is that every service resolves such an id inside its own scope before
writing it, so a foreign id is "not found" first. That is a convention, which is the thing
D-017 exists to replace.

**What is owed:** composite foreign keys, `(organisation_id, patient_id)` referencing
`patients (organisation_id, id)` and the same for every tenant-to-tenant reference, which needs
a unique index on `(organisation_id, id)` per parent table. Additive, and checked against
existing rows first, because a row already linked across clinics would make the constraint fail
to apply, which is itself worth knowing.

---

## V2 A racing voice booking can answer "call you back" instead of "slot taken"

**Due: must be understood before a second clinic, and before the M3 load test.** Not fixed, and
deliberately not chased locally: the behaviour depends on how connections are handed out, which
the production pooler changes.

**What was observed, 2026-11-04.** `tests/voice-tools.test.ts`, "one NEW caller whose booking is
retried ten times without a key: one record", failed once in three runs of `turbo run test`
with every suite running at once (load average 7 to 10 on six cores). Ten concurrent `book`
calls for one new caller and one slot. Data integrity held: one patient and one appointment,
exactly as asserted. What differed was one of the ten answers. One call booked, eight were told
the slot was taken, and one said "I am not able to do that right now. I can have somebody call you back.", which is the
sentence `toSpokenError` (`apps/api/src/voice/tools.routes.ts`) gives for an error nothing
anticipated. It did not happen in 150 further ten-way races run on their own on a quiet
machine, and the error behind it was not captured, because the test setup silences the logger.

**The hypothesis, unconfirmed.** Each `book` call runs in an interactive transaction, and an
interactive transaction first waits for a pooled connection. Prisma gives up after two seconds
(`maxWait`) with "Unable to start a transaction in the given time" (P2028). Ten bookings at once
on a loaded machine is the shape that runs out that wait, and the same error stopped another
suite's setup under load on 2026-11-03. Nothing maps it to a speakable answer, so it falls through
to the generic sentence.

**Why it matters.** A caller racing for a slot hears "call you back" instead of being offered
another time, and a staff member then rings back about a booking that was never made. At one
clinic that is rare. At M3's target of twenty concurrent calls it is the expected case.

**Re-test it against Supabase's transaction pooler (D-019), not only locally.** The pooler
changes exactly what the hypothesis is about: how many server connections exist and how long a
client waits for one. It may make this disappear, because transactions hold server connections
only briefly, or make it worse, because the free tier allows few. A local result answers neither.

**What must be true before it is done:**

1. The real error is captured: reproduce under load with logging on, against the pooler.
2. Either that error is mapped to a sentence a caller can act on ("that time has just gone, shall
   I find another?") and the pool size and `maxWait` are set deliberately, or the cause is shown
   to be something else and fixed there.
3. A test reproduces it deterministically (for example, by holding connections so the wait is
   exhausted), rather than depending on machine load to show it.

---

## R1 R2 gives no data-residency guarantee, and nobody has accepted that

**Due: before a second clinic is onboarded or a hospital group is quoted (D-018).**

Recordings and database dumps live in Cloudflare R2, which can be given a location hint but makes
no commitment that objects stay in India. The platform holds Indian patients' health data and
recordings of their voices.

**Why it was deferred.** It is a product decision, not an engineering one: it belongs to whoever
owns the product's commitments to clinics. R2 stays in use meanwhile because the pilot holds one
clinic's data and no contract says otherwise. D-018 records it as an open question so it cannot
be mistaken for a settled one.

**What must be true before it is done:** the owner decides, in writing, either that no residency
guarantee is acceptable (and on what basis, for DPDP), or that data must stay in India. If the
second, move to AWS S3 in `ap-south-1` (four environment variables plus a data migration) or price
R2's jurisdictional restriction. Either way D-018's open question is replaced by a decision.

---

## B1 The nightly backup has never been restored

**Due: before go-live, and monthly after (`docs/operations/backup-and-restore.md`).**

The nightly dump to R2 is the only copy of the database, because Supabase's free tier has no
automated backups or point-in-time recovery (D-019). The job is written and its logic is tested,
but the dump-and-restore cycle has never run end to end, because the machine it was written on
has no `pg_dump` or `psql`.

**Why it was deferred.** The tooling was missing, not the code. Nothing about the job is known to
be wrong. Nothing about it is known to be right either: a backup nobody has restored is a
hypothesis.

**What must be true before it is done:** `pnpm db:restore-check` has run on a host with `pg_dump`
and `psql` (the Lightsail instance, or locally through the compose container), restoring a real
dump into a scratch database, and its output is pasted into `backup-and-restore.md` with the date.
Then the STATUS banner at the top of that file comes down.

---

## S1 Whether Sarvam's interactions list tells an unknown call apart

**Due: the first Sarvam session with credentials, before `NOT_FOUND` is treated as evidence of
anything (`docs/operations/first-real-call.md`, step 12).**

Call verification (D-006, amended 2026-11-04) looks each webhook's interaction up in Sarvam's
interactions list and marks the call `VERIFIED` or `NOT_FOUND`. That rests on an assumption
`docs/sarvam-contract.md` section 7 marks UNCONFIRMED: that a known interaction appears once the
60-second cache has passed, and that an id Sarvam does not have is simply absent.

**Why it was deferred.** Only a session with real Sarvam credentials can answer it, and none has
run. Until it does, a `NOT_FOUND` is a reason to look, not proof of forgery.

**What must be true before it is done:** step 12 of the first-real-call runbook has run. Look up
the real test call's id and a made-up one after the cache has passed, record exactly what comes
back for each, how long the real call took to appear, and whether `filter_conditions` can look an
id up directly. Then replace UNCONFIRMED in section 7 with what was observed, and change the
verification job if the assumption was wrong.

---

## S2 Four Sarvam behaviours the design rests on are undocumented

**Due: answered at the first real call, and settled before a second clinic.**

`docs/sarvam-contract.md` writes only what Sarvam documents as fact and marks the rest UNKNOWN.
Four of the questions in its section 9 change the design rather than the wording, and
`docs/operations/first-real-call.md` lists them as the ones the first call must answer:

1. Is a webhook signed, and do the published source addresses (`4.213.167.70`,
   `35.154.84.150`) apply to webhooks? This decides whether D-006 can verify a signature instead
   of relying on a path secret and an allow-list.
2. Are webhook deliveries retried, and what counts as a success? This decides whether a missed
   delivery is lost or recovered, and how hard the catch-up job has to work.
3. What exactly does an API tool send, and what does it do on a timeout or a non-2xx answer?
   D-022's "almost always 200" assumes the agent treats an error as silence. It is also where
   D-022's open question lives: whether a tool can send a custom `Authorization` header at all.
4. Can a tool receive the dialled number or the deployment metadata? This decides whether one
   shared agent is possible instead of one per clinic (D-004).

**Why they were deferred.** They are Sarvam's to answer, and each is hidden behind the
`VoiceProvider` adapter and a design that works without the answer, so the pilot is not blocked.

**What must be true before it is done:** each has an answer from Sarvam or an observation from a
real call, written into `sarvam-contract.md` in place of UNKNOWN, and any decision it changes
(D-004, D-006, D-022) amended as a new decision.

---

## P1 The built screens have not been reviewed against the prototype

**Due: before the dashboard is shown to a second clinic.**

`docs/features/clinic-dashboard.md` makes the prototype the specification and captures every
built screen beside it in `docs/prototype/built/`. The Feature 3 review was trimmed to five
sections, and comparing the built screens with the prototype was one of the parts cut, so no
independent session has compared them.

**Why it was deferred.** The review's time went on the voice path, where a defect reaches a
patient on the telephone. A screen that differs from the prototype is visible to the clinic and
recoverable. The deviations the clinic asked for on 2026-11-03 are already recorded, with
reasons, in the dashboard document.

**What must be true before it is done:** a fresh session compares each captured screen with its
prototype at the three widths, confirms every difference is either listed in the deviation
tables with a reason or fixed, and records the result in the dashboard document.

---

## F3R What the trimmed Feature 3 review did not cover

**Due: before go-live.**

Beyond the prototype comparison (P1), `docs/FEATURE-3-REVIEW.md` lists what it did not review at
all: the analytics overview, the call history API and its presigned recording URLs, the patients
and appointments endpoints other than booking, the agenda, permissions and the masking of
platform reads beyond the voice agent's token, the performance of the tool endpoints against the
p95 under 400 ms target, and the real Sarvam adapter against a real account. It also lists what
it could not verify, including pg-boss job failure records, which could carry a Prisma error's
query arguments into `pgboss.job.output`.

**Why it was deferred.** The brief was cut to five sections to finish the review in one session.

**What must be true before it is done:** each area has had an independent review, or its absence
is accepted in writing for the pilot. The pg-boss failure record and the p95 measurement are the
two that most need doing before real calls, because one could store patient data where nothing
reads it and the other is M3's gate.

---

## F2M Feature 2 Minor findings left open

**Due: before a second clinic.**

`docs/FEATURE-2-REVIEW.md`, section "Status, 2026-11-04", lists the Minor findings not fixed with
the Important ones: names that differ only in spacing, case-variant service names, no pre-check
in `003_pilot_clinic.sql` for existing duplicate names, an unknown prompt version answering 409
instead of 400, an FAQ schema allowing a body larger than `BODY_LIMIT`, non-canonical time zones,
duplicate languages, clearing the profile's contact phone leaving the clinic line, the bootstrap
not printing the database it writes to, and `db:check-policies` checking a policy's name rather
than its predicate.

**Why they were deferred.** None changes what is stored about the pilot clinic or what its
operator is told in a way that matters with one clinic. Each is small.

**What must be true before it is done:** each is fixed with a test, or recorded as accepted with
its reason. The last one matters most, because `db:check-policies` is the only isolation check
that runs against a deployed database.
