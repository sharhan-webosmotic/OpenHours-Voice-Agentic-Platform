# Task Brief (the pre-execution alignment gate)

> Produced by `explorer` (or `research-lead` for cross-cutting tasks) BEFORE any non-micro-lane
> task is implemented. Written to `AI_DOCS/planning/tasks/active/<slug>/brief.md` and linked from
> the task row. /do blocks implementation until the brief exists and shows zero DRIFT. The brief's
> restated criteria are the contract the Acceptance Evidence table must satisfy, so a task cannot
> drift from the requirement it came from.

## 1. Requirement slice (quote by ID, never from memory)

| Source | Ref | What it says (one line each) |
|---|---|---|
| Workscope | section / req id | ... |
| Tech-spec | S(NN), row or lines | ... |
| PRD / FRD | story id | (when present) |
| Traceability | S21 row / feature id | the feature this task advances |

Rules: quote the row IDs and the one-line meaning. Never paste whole sections (reference-based,
the same law as task-planner plans). If the requirement names concrete details (formats, hosts,
tenancy, limits, roles), list EVERY one here. A detail not listed here will not get built, so the
re-read is where alignment is won or lost.

## 2. Reality check (plan assumptions vs current code)

| Assumption from the plan / spec | Verified against | OK / DRIFT |
|---|---|---|
| endpoint POST /x exists | api/src/routes/x.ts:12 | OK |
| schema field user.tenantId present | prisma/schema.prisma:34 | OK |
| component DataTable available | AI_DOCS/design/component-registry.md | OK |
| package mailparser installed | package.json | DRIFT: absent |

Any DRIFT → STOP. Route through `change-request` before coding. Building against a stale plan is
the exact defect this section kills (it extends the STALE-marker check to verified-against-reality).

## 3. Acceptance criteria, restated concrete and testable

| # | Original criterion | Restatement (testable, every detail pinned) | Surfaces |
|---|---|---|---|
| 1 | "invite by link" | invite link uses the TENANT SUBDOMAIN (https://tenant.app.tld/invite/token), never the wildcard host | api, web |

Rules: one row per criterion. Pin every concrete detail from section 1 (formats, hosts, roles,
limits, empty/error behavior). Name the surfaces (web / api / worker / mobile) each criterion
spans: the Acceptance Evidence table must later show implementing files on every named surface,
and scope validation returns UNDER when one is missing.

## 4. Files to touch (prediction)

- path, and why
- path, and why

Over-approximate rather than omit: this list feeds the chunk scope AND the parallel-wave
disjointness check (two tasks run concurrently only when these lists do not overlap).

## 5. Verdict

```
Alignment: OK | DRIFT (route to change-request)
<one line: ready to build against sections 1-4, or what drifted>
```
