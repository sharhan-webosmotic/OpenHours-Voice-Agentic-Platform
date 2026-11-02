# Backlog

Work that is owed, committed to the repository so it is visible to everyone rather than only
to the machine holding `docs/ROADMAP.md`, which is git-ignored.

This file is for debt with a due point. It is not a ticket tracker and not a wish list: an
entry earns its place by naming what is missing, why it is owed, and the point by which it
must land. A settled choice goes in `docs/DECISIONS.md` instead. An entry is deleted when
the work lands, not marked done.

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
