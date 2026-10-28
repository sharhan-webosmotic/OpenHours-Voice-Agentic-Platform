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
