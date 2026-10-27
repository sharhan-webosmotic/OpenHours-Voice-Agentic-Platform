# Milestone capsule template

> Each milestone gets its own folder: `AI_DOCS/milestones/M<NN>-<slug>/`
> Files inside:
> - `capsule.md`  — this file (purpose, scope, exit criteria, active task pointer)
> - `tasks.md`    — full task table for THIS milestone
> - `decisions.md` — milestone-local decisions (append-only)
> - `spec.md`     — spec slice (or pointers to architecture/api-contract.md + planning/spec/)
> - `api.md`      — endpoints introduced/modified in this milestone (refs to architecture/api-contract.md)

---

## capsule.md (this file's structure)

```markdown
# M<NN>-<slug> — <Title>

## Purpose
<one paragraph: what this milestone delivers, why it matters>

## Scope (in)
- <feature 1>
- <feature 2>

## Scope (out)
- <explicitly deferred>

## Exit criteria
- All tasks DONE in tasks.md
- <verification gate, e.g. Gate-1 APPROVED, QA-TEST-COVERAGE PASS>

## Source fingerprint (only when this milestone is planned against an external document)

Required whenever the milestone's scope comes from a file that someone else maintains: a findings
document, a QA tracker export, a requirements baseline. Record its state at plan time on one line,
exactly in this shape, so `hooks/drift-detector.sh` Phase J can re-check it:

```
Source fingerprint: `<path>` · <N> items · <YYYY-MM-DD>
```

Why it is required. A milestone planned against a 28-row findings document stayed internally
consistent and green on every gate while the document grew to 50 rows, because every gate compares
the plan against the CODE and none compares it against its SOURCE. The 22 new rows were invisible
to the process until a human happened to re-read the file. A grown source is usually not a problem,
it usually means a new milestone, but it must be SEEN rather than discovered.
- <any milestone-specific success criterion from intent.md>

## Active task
T-<NN> (<title>)

## Dependencies
- Blocks: M<XX>, M<YY>
- Blocked by: M<ZZ> (must be DONE first)
```

## tasks.md (per-milestone task table)

```markdown
# M<NN>-<slug> — Tasks

| ID    | Title | Status | Acceptance | blockedBy | Verify | Notes |
|-------|-------|--------|------------|-----------|--------|-------|
| T-01  | Postgres schema | TODO | `pnpm db:test` passes | | | |
| T-02  | Auth signup     | TODO | E2E: link → log in | T-01 | | |
| T-03  | Order approval screen | TODO | matches chosen.md click-path | T-01 | | `flow: flow-order-approval` |

> Optional Notes-column tag `flow: <flow-id>` marks a task as belonging to a Tier F flow (see `AI_DOCS/design/flow-validation-plan.md`). Gate FLOW and `hooks/enforce-flow-gate.sh` block Edit/Write on that task until the flow's row reads `approved` or `waived`.

## Verification log
<append-only; latest at top>
```

## decisions.md (milestone-local decisions)

```markdown
# M<NN>-<slug> — Decisions

| # | Date | Skill | Decision | Rationale | Decided By |
|---|------|-------|----------|-----------|------------|
| 1 | YYYY-MM-DD | /build | Use bcrypt for password hashing | legacy compat | User |
```

## spec.md (milestone spec slice)

```markdown
# M<NN>-<slug> — Spec

> The slice of the project tech-spec that pertains to this milestone.
> Cross-references are file:line — do NOT paste content from other capsules.

## API endpoints (this milestone)
See `api.md` in this folder. Master contract: `AI_DOCS/architecture/api-contract.md` rows <ranges>.

## DB models (this milestone)
See `AI_DOCS/architecture/database-schema.md` rows <ranges>.

## User flows
- <flow 1, with file pointers>

## Acceptance scenarios
- <Given/When/Then if FRD-style>
```

## api.md (milestone-scoped API list)

```markdown
# M<NN>-<slug> — API endpoints

> Endpoints introduced or modified in this milestone. Each row references the canonical row in `AI_DOCS/architecture/api-contract.md`.

| Method | Path | Origin | Status |
|--------|------|--------|--------|
| POST | /auth/signup | new | TODO |
| GET  | /me          | new | TODO |
```
