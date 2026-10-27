---
name: feature-delivery
description: "Library skill (not user-facing): the per-feature implementation methodology applied inside /do's build phase, never invoked directly. Reads planning docs first, makes a no-placeholder plan, implements feature by feature, updates AI_DOCS after each. Direct invocation would bypass /do and Gate 1."
mcp_integrations: [context7, playwright]
next_skill: qa-testing
required_gate: EL-FEASIBILITY
skill_id: SK-097
context_budget:
  load_kb: 30
  scope: task
version: 1.5.1
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: utility
  user_facing: false
  patterns: [sequential]
  previous_id: SK-092
# SK-097 assigned in v3.1 to resolve SK-092 collision with project-stage-detect.
dependencies:
  required: [memory-protocol, task-planner]
  optional: [code-quality, qa-testing, github-ops]
---

> **Comments & docs:** Docstrings/JSDoc on every function. No inline comments except a one-line *why* for genuinely complex logic (calculations, time conversions, deliberate workarounds). No commented-out code. Put rationale, decisions, and feature context in `AI_DOCS/planning/` + `AI_DOCS/memory/decision-log.md` and keep it updated in the same change. Full policy: `.claude/rules/development-rules.md` -> Code Comments & Documentation.
# Feature Delivery

> **Purpose**: Implement features correctly — with the right context, right plan, right verification, and right memory updates. Borrowed best practices from battle-tested implementation methodologies.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials):

- `context7` (free): current library/framework docs during feature-by-feature coding.
- `playwright` (free): post-feature browser verification (screenshot + console + network).

Target the project's dev URL/port and dev database only. Never point a debug/verify MCP at staging or production.

---

## Iron Laws

> [!CRITICAL]

```
1. NEVER start coding without reading AI_DOCS/planning/ AND AI_DOCS/architecture/ first
2. NEVER write a plan step with TBD, "implement as needed", or any placeholder
3. NEVER claim a feature is complete without running a verification command and seeing its output
4. NEVER move to the next feature before updating AI_DOCS/memory/
5. ALWAYS check schema/API contract before writing any frontend ↔ backend connection
6. ALWAYS use task-planner to track each feature as a chunk
```

> [!IMPORTANT]
> **Output sizing (300-line cap).** Per-feature and per-epic implementation plans (the Phase 2 "no-placeholder plan" doc and any feature-plan file under `AI_DOCS/planning/`) must stay ≤300 lines. For large epics that exceed this, split into a folder `AI_DOCS/planning/<epic-or-feature-slug>/` containing:
> - `index.md` — epic summary, feature list, verification checklist, cross-links (≤300 lines)
> - one file per feature (e.g. `feature-auth-login.md`, `feature-password-reset.md`) — each self-contained, ≤300 lines, and starts with a back-link to `index.md`
>
> Always split into a folder. Never create sibling files at the parent level. Downstream consumers (`/qa-testing`, `/code-quality`, `/milestone-validation`) read `index.md` first.

---

## Phase 1: Context Load (Mandatory Before Any Code)

> [!CRITICAL]
> This phase is non-negotiable. Skip it and the feature will drift from the plan.

Read these files in order. If any are missing, **stop and run the skill that creates them first**.

| File | If Missing |
|---|---|
| `AI_DOCS/memory/project-context.md` | Run `/session-management` |
| `AI_DOCS/planning/milestone-plan.md` | Run `/milestone-planning` |
| `AI_DOCS/planning/tech-spec.md` | Run `/tech-specification` |
| `AI_DOCS/architecture/api-contract.md` | Run `/tech-specification` Section 6 |
| `AI_DOCS/memory/gate-status.md` | Run `/gate-enforcement` |
| `.claude/rules/` | Run `/guardrails` |
| active milestone's `AI_DOCS/milestones/M<NN>-<slug>/tasks.md` | Run `/plan` (or `/milestone-planning`) to seed milestone capsules |

After reading, announce loaded context:
```
Context loaded:
- Project: [name] ([type])
- Stack: [frontend] + [backend] + [database]
- Active Milestone: M[#] — [name]
- Features in this milestone: [list from milestone-plan.md]
- Gate EL-FEASIBILITY: [PASSED / PENDING]
- API contract: [found at AI_DOCS/architecture/api-contract.md — N endpoints]
```

---

## Phase 2: Build a No-Placeholder Feature Plan

For each feature in the current milestone:

### Plan Entry Format

```markdown
## Feature: [name]

**Goal**: [one sentence — what done looks like]
**Spec reference**: [tech-spec.md section + line range]
**API endpoints used**: [list from api-contract.md]
**Schema touched**: [DB tables/models affected]
**Components reused**: [from AI_DOCS/design/component-registry.md]
**Slice layers (build in order, per `rules/vertical-slice-rules.md`)**: schema → API → backend RBAC → seed → UI → integration → frontend RBAC. Mark any non-applicable layer `N/A (reason)`. For native `platform_targets`, layers UI/integration/RBAC repeat per surface (web + native).

### Implementation Steps
1. [exact file] — [exact change] — [verification command]
2. [exact file] — [exact change] — [verification command]
...

### Acceptance Criteria
- [ ] [testable criterion]
- [ ] [testable criterion]
```

> [!IMPORTANT]
> **Self-review before executing:**
> - Does every step have complete code (no TBD)?
> - Does every API call have a matching entry in `api-contract.md`?
> - Does every new component check `component-registry.md` for reuse first?
> - Are all schema changes reflected in a migration file?

---

## Phase 3: Feature-by-Feature Execution

For **each feature**, execute this cycle:

### 3.1 — Context Anchor

Re-read before touching any code:
1. The feature's spec section from `tech-spec.md`
2. The relevant API endpoints from `api-contract.md`
3. Existing components from `component-registry.md`

This takes 30 seconds. It prevents building the wrong thing.

### 3.2 — Schema / Backend Linkage Check

> [!CRITICAL]
> This check prevents the #1 failure mode: building a UI that doesn't match the backend.

Before writing any code that crosses frontend/backend:

**Frontend side:**
- Which endpoint will this call? → Check it exists in `api-contract.md`
- What request body does it expect? → Match exactly
- What response shape does it return? → Type it correctly

**Backend side:**
- Does the route exist? If not, create it now (don't leave frontend calling a non-existent API)
- Does the DB schema have all required fields? If not, create the migration first
- Are all types defined in a shared types file?

**If any mismatch found:** STOP. Fix the api-contract.md and schema FIRST, then implement.

### 3.3 — Implement

Follow the plan steps exactly. Write complete code:
- No `// TODO: implement` 
- No `// placeholder`
- No hardcoded mock data that won't be replaced
- No `console.log` left in production paths
- Reuse existing components from `component-registry.md` — never duplicate

### 3.4 — Verify

Run the verification command specified in the plan. Read the full output:
- Test command → must show 0 failures
- API call → must return expected shape
- UI check → must render correctly, no console errors
- Build → must complete with exit code 0

Never claim "it should work" without running the command and reading the output.

### 3.5 — Code Quality Self-Review (5 Questions)

Before marking complete, answer these 5 questions:
1. **Spec match**: Does what I built match the spec section referenced in Phase 2?
2. **Reuse**: Did I check `component-registry.md` before creating anything new?
3. **Linkage**: Is every frontend→backend connection verified against `api-contract.md`?
4. **Spacing**: If UI changed, does it pass the Spacing Audit (see `ui-engineering-rules.md` S7)?
   - Every modal has `p-4`/`p-6` internal padding
   - Every page root has responsive horizontal padding (`px-4 sm:px-6 lg:px-8`)
   - Every button group has `gap-2` or more — no buttons touching
   - All spacing uses design tokens, no raw px values
5. **Slice completeness**: Are all applicable layers present — schema, API, backend RBAC, seed data, UI, real integration, frontend RBAC — or explicitly `N/A (reason)`? A feature with UI but no backend RBAC, or an entity with no seed, is not done (see `rules/vertical-slice-rules.md`).

If any answer is "no" → fix it before proceeding.

### 3.6 — Update AI_DOCS Memory

After each feature, before starting the next:

```
Update the active milestone's AI_DOCS/milestones/M<NN>-<slug>/tasks.md:
  → Mark this feature's task row Status: DONE (+ verify-stamp)
  → Set the next task row Status: DOING

Update AI_DOCS/memory/task-ledger.md:
  → Bump the milestone's Progress count (e.g. 3/6 → 4/6)

Update AI_DOCS/memory/session-state.md:
  → Active Task: [next feature name]
  → Last Decision Made: [any notable decision during implementation]
  → Next Action: [what to do next session if this one ends]
```

### 3.7 — Git Checkpoint

After memory is updated, ask:
```
Feature "[name]" complete ✓
Memory updated. Commit?

1. Yes — commit now
2. Batch — commit all at milestone end
3. Skip commit
```

If yes:
```bash
git add [feature files] AI_DOCS/memory/
git commit -m "feat([milestone]): [feature name] — [one line summary]"
```

---

## Phase 4: Milestone Linkage Audit

After ALL features in the milestone are built and verified:

### 4.1 — Frontend ↔ API Audit

For every screen/component built:
- Find every API call in the code
- Verify it matches an entry in `api-contract.md` (method, URL, body, response)
- Flag any that don't match

### 4.2 — API ↔ Schema Audit

For every API endpoint in `api-contract.md` that was implemented:
- Verify the DB query uses the correct table/collection and fields
- Verify any new fields have a migration file
- Flag schema fields referenced in code but not in the schema definition

### 4.3 — Component Registry Sync

For every new component created:
- Verify it's registered in `AI_DOCS/design/component-registry.md`
- Verify its import path is correct
- Verify it's not a duplicate of an existing component

### 4.4 — Audit Report

Write findings to `AI_DOCS/memory/session-state.md`:
```
## Linkage Audit — M[#] [name]
Date: YYYY-MM-DD
Frontend ↔ API gaps: [none | list]
API ↔ Schema gaps: [none | list]
Missing component registry entries: [none | list]
```

If gaps found → fix them before moving to QA. Do NOT hand off to QA with known integration gaps.

---

## Phase 5: Milestone Handoff

When all features are built, verified, and the linkage audit is clean:

1. Update `AI_DOCS/memory/gate-status.md` — set Gate 1.5 (Code Quality) to PENDING
2. Run `code-quality` skill for the 17-point pre-QA checklist
3. When code quality passes → hand off to `qa-testing` skill
4. Offer final milestone commit:
```
Milestone M[#] "[name]" complete.
All [N] features built and verified.
Linkage audit: clean.

Final commit?
git commit -m "feat: milestone-[N] complete — [milestone name]"
```

---

## Common Failure Patterns to Avoid

| Pattern | What to do instead |
|---|---|
| Building frontend before backend route exists | Create backend route first, test it, then build frontend |
| Using mock data "for now" | Either use real API or mark feature as incomplete — never ship mocks |
| "I'll add the schema migration later" | Do it in the same chunk as the code that needs it |
| Checking all acceptance criteria by "reading the code" | Run the actual commands — code reading is not verification |
| Skipping the context anchor "because I remember the plan" | Re-read the spec. Always. Memory fades mid-session. |
| Marking a feature done before updating AI_DOCS | Update memory first, then move to next feature |

<!-- Version: 1.5.1 | 2026-10-21 | description trimmed per the v4.28.0 cost policy -->
