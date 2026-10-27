---
paths:
  - "AI_DOCS/milestones/**"
  - "AI_DOCS/planning/tasks/**"
---

# Vertical-Slice Rules

> Loaded by `task-planner`, `feature-delivery`, and `/build`. Defines the ordered
> layers every feature is decomposed into, and makes layer-completeness the
> definition of DONE. A feature that ships UI with no backend RBAC, or an entity
> with no seed data, is not done: it is a half-built slice. These rules are
> hard-blocking (a task does not reach DONE until every applicable layer exists
> and verifies), consistent with the existing `/build` RBAC gates.

## Rule 1: The seven layers, in this order

Every feature decomposes into a vertical slice built bottom-up. The order is not
optional: each layer depends on the one before it.

1. **DB schema**: migration + model for the entity the feature owns (`rules/data-migration-rules.md`).
2. **API endpoint**: route handler(s) matching the entry in `architecture/api-contract.md`. Contract first, then handler.
3. **Backend RBAC**: role/permission guard on the endpoint + soft-delete filter on fetches (`/build` Checks A and B).
4. **Seed data**: representative rows for the entity AND at least one test user per role that can exercise it, written so E2E and dashboards have data (`mock-data` / `data-migration`, surfaced into `AI_DOCS/quality/test-fixtures.md`).
5. **Frontend UI**: the screen/component, reusing an existing component from the registry before building new (`rules/component-reuse-rules.md`).
6. **API integration**: the frontend calls the real endpoint from the contract. No hardcoded mock array left where a live call belongs.
7. **Frontend RBAC**: role-conditional rendering on action elements + required-field markers, matching the role matrix in tech-spec S3 (`/build` Checks C and D).

## Rule 2: Layer-completeness is the definition of DONE (BLOCKING)

A feature task cannot be stamped DONE until every layer that applies to it exists
and passes verification. `/build` enforces the per-layer gates, `feature-delivery`
sequences the layers, and `task-planner` writes them as ordered chunks. The
`vertical-slice-check.sh` hook is the backstop: on task close it greps for the
presence markers of each applicable layer and exits 2 if one is missing.

## Rule 3: Applicability (not every feature has all seven)

- **Backend-only feature** (no UI in scope): layers 5-7 are marked `N/A (backend-only)`.
- **Read/aggregation feature** (dashboard, report, stats): layer 1 is usually `N/A (no new entity)` and layer 4 is `N/A (consumes existing seed)`, but layers 2, 3, 6, 7 still apply: a dashboard still needs an endpoint, backend authorization, real integration, and role-gated display.
- **Pure static UI** (marketing page, no data): layers 1-4 and 6 are `N/A`. Only 5 and 7 (if any action) apply.

Mark each non-applicable layer `N/A (reason)` explicitly in the task. A blank layer is treated as missing (blocking), an `N/A (reason)` is treated as resolved.

## Rule 4: Per-platform expansion for mobile

When `platform_targets` (in `project-context.md`) includes a native target
(iOS/Android), layers 5, 6, and 7 are emitted once per surface: a web screen AND
a native screen, each with its own integration and RBAC. Layers 1-4 stay shared
(one schema, one API, one seed set, one backend RBAC serve every surface, do not
fork the contract). The native surface gets its own E2E lane at milestone close
(`rules/mobile-rules.md`).

## Rule 5: Ordering is enforced across milestones too

The layer order is the within-feature order. The across-feature order (which
entity's slice is built first) comes from the data-dependency graph in
`milestone-planning` (`milestone-order-check.sh`): a slice that consumes another
entity is built after the slice that produces it. Layers and milestones use the
same producer-before-consumer principle.

## Rule 6: How the layers appear in `task-planner` chunks

A multi-chunk feature plan uses this chunk skeleton (omit `N/A` layers):

```markdown
- [ ] C1: Schema + migration            → chunk-01-schema.md
- [ ] C2: API endpoint (contract-first) → chunk-02-api.md
- [ ] C3: Backend RBAC + soft-delete    → chunk-03-rbac-api.md
- [ ] C4: Seed data + test users        → chunk-04-seed.md
- [ ] C5: Frontend UI (reuse first)     → chunk-05-ui.md
- [ ] C6: API integration (no mock leak)→ chunk-06-integration.md
- [ ] C7: Frontend RBAC + required marks → chunk-07-rbac-ui.md
```

Simple features collapse this into one `tasks.md` row whose acceptance names the
applicable layers, but `/build` still runs every applicable layer gate before DONE.

## Rule 7: Multi-surface input symmetry (BLOCKING)

When a feature spans more than one executing surface (web FE, API, worker / Lambda / cron), the
accepted-input matrix must MATCH across every surface: file formats, size limits, content types,
and enum values are either identical on all surfaces (prefer ONE shared constant or schema that
every surface imports) or each divergence is an explicit, user-visible rejection with a test. A
surface that advertises an input another surface never handles (the FE accepts .zip while the
worker has no zip path) is a blocked task, not a warning. This is the cross-service extension of
layer 6: integration is not "the FE calls the API", it is "every hop handles or explicitly
rejects the same inputs".

How it is checked:

- The Task Brief names the surfaces each criterion spans, and the Acceptance Evidence table must
  show implementing files on EVERY named surface (a missing surface = UNDER at scope validation).
- `code-reviewer` acceptance coverage flags a criterion delivered on fewer surfaces than it names
  as CRITICAL.
- Multi-surface task rows carry Notes tags `surfaces:<a,b,c>` plus `symmetry:verified` (the
  matrix was checked to match, or divergences reject explicitly) or `symmetry:na (reason)`.
  `hooks/vertical-slice-check.sh` blocks a DONE multi-surface row that carries neither.
- `e2e-testing`'s format-conformance check asserts FE accept-list == API accept-list == worker
  handled-list for upload/format features.

<!-- Version: 1.1.0 - 2026-07-09 - Rule 7: multi-surface input symmetry (accepted-input matrix parity across FE/API/worker, surfaces:/symmetry: tags, hook backstop). From field finding: ZIP accepted at FE+API while the Lambda never handled bundles. -->
<!-- Version: 1.0.0 - 2026-06-23 - New rule: 7-layer vertical slice (schema to API to backend RBAC to seed to UI to integration to frontend RBAC) as the definition of DONE, enforced by /build gates + vertical-slice-check.sh. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
