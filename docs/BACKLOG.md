# Backlog

Work that is owed, committed to the repository so it is visible to everyone rather than only
to the machine holding `docs/ROADMAP.md`, which is git-ignored.

This file is for debt with a due point. It is not a ticket tracker and not a wish list: an
entry earns its place by naming what is missing, why it is owed, and the point by which it
must land. A settled choice goes in `docs/DECISIONS.md` instead. An entry is deleted when
the work lands, not marked done.

---

## M1-03 OpenAPI document and generated client

**Due: before the third feature slice.**

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

**Blocking detail:** the zod-4 compatibility of `@asteasolutions/zod-to-openapi` 9.1,
`openapi-typescript` 7.13 and `openapi-fetch` 0.17 has never been exercised. That is the
open "VERIFY zod 4 compatibility on Day 1" item in `docs/STACK.md`, and it is the first
thing M1-03 has to settle, because an incompatible generator changes the approach rather
than the schedule.

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
