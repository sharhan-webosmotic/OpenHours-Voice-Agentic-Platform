---
name: task-planner
description: "Detailed multi-chunk planner for tasks too large to fit a single capsule row. Creates a persistent plan file (planning/tasks/active/(task-slug)/plan.md + chunk-NN-*.md) referenced from a row in the active milestone's tasks.md. Use when /build picks a task whose acceptance is multi-chunk (5+ steps or more than 2 hours). For simpler tasks, /build executes the row directly. Triggers on: 'Fix', 'Build', 'Add', 'Update', 'Migrate', 'Change', 'Improve' when /do determines chunking is needed."
next_skill: feature-delivery
required_gate: null
skill_id: SK-098
version: 3.3.0
context_budget:
  load_kb: 25
  scope: milestone
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: utility
  previous_id: SK-090
dependencies:
  required: [memory-protocol]
  optional: [feature-delivery, session-management]
---
# Task Planner — Detailed Chunking for Multi-Step Tasks

> **Purpose**: Take a task row from the active milestone's `tasks.md` whose acceptance is multi-chunk (5+ steps or > 2h), and expand it into a chunked plan file under `AI_DOCS/planning/tasks/active/<slug>/`. The capsule's tasks.md row keeps a pointer (`Notes: plan = planning/tasks/active/<slug>/plan.md`); the canonical task registry remains the active milestone's `tasks.md` plus the global `task-ledger.md` summary.

> **v3 schema change**: This skill no longer writes `INDEX.md` or `active-task.md`. The canonical task registry is `task-ledger.md` (global, milestone summary) + per-milestone `tasks.md` (detailed task table inside the capsule). Detailed chunked plans still live under `planning/tasks/active/<slug>/`, referenced from a tasks.md row.

---

## Iron Laws

> [!CRITICAL]
> These rules have zero exceptions.

```
1. NEVER write code before the plan is saved and the Completeness Gate has passed
2. NEVER start a new task without checking the active milestone's tasks.md for an unfinished plan first
3. NEVER mark a task complete without double-checking every acceptance criterion
4. NEVER skip chunks — execute them in order, one at a time
5. ALWAYS update the plan file after completing each chunk (crash recovery)
6. ALWAYS update the milestone's tasks.md row + global task-ledger.md milestone progress on chunk completion and task close
7. NEVER paste spec/API/schema content into the plan — use file:line references
8. PLAN chunks take max 20–30 minutes each — never "implement X feature"
9. ON CLOSE, MOVE plan to planning/tasks/completed/<slug>/ — and update the tasks.md row to Status=DONE with verify-stamp.
```

---

## File Structure

```
AI_DOCS/
├── memory/
│   └── task-ledger.md                           ← GLOBAL milestone summary (one row per milestone)
├── milestones/
│   └── M<NN>-<slug>/
│       ├── capsule.md                            ← active milestone capsule
│       └── tasks.md                              ← per-milestone task table — THE source of truth for task rows
└── planning/
    └── tasks/
        ├── active/                               ← detailed chunked plans (one folder per multi-chunk task)
        │   └── 2026-04-17-add-user-profile/
        │       ├── plan.md                       ← goal, chunk index, acceptance criteria
        │       ├── context.md                    ← reference links (no paste)
        │       ├── chunk-01-schema.md            ← detail for chunk 1
        │       ├── chunk-02-api-endpoints.md     ← detail for chunk 2
        │       ├── chunk-03-ui-component.md      ← detail for chunk 3
        │       └── chunk-04-wiring.md            ← detail for chunk 4
        │
        └── completed/                            ← archive of completed chunked plans
            └── 2026-04-15-add-notifications/
                └── plan.md (Status: DONE)
```

### When to invoke task-planner vs let /build run direct

| Task acceptance | Action |
|---|---|
| 1-4 well-defined steps; fits in a single tasks.md row + acceptance string | `/build` runs the row directly. No chunked plan needed. |
| 5+ chunks OR > 2 hours OR touches multiple subsystems | `task-planner` creates `planning/tasks/active/<slug>/plan.md`; tasks.md row points to it. |
| Plan doc exceeding ~500 lines at any point | **MUST split** into chunk-NN-*.md files in the same folder. |

### Deprecated (do NOT create)

- `AI_DOCS/planning/tasks/INDEX.md` — replaced by `task-ledger.md` (milestone summary) + per-capsule `tasks.md`.
- `AI_DOCS/planning/tasks/active-task.md` — single tasks live as a row in the milestone's `tasks.md`. Multi-chunk tasks use `active/<slug>/plan.md`.

---

## Task Registry (v4 — capsule schema)

Tasks live in the **active milestone's capsule**, not in a global INDEX.md. The registry is:
- **`AI_DOCS/memory/task-ledger.md`** — one-line-per-milestone summary (global heartbeat).
- **`AI_DOCS/milestones/M<NN>-<slug>/tasks.md`** — full task table for the active milestone.
- **`AI_DOCS/planning/tasks/active/<slug>/plan.md`** — detailed chunked plan for multi-step tasks (referenced from a `tasks.md` row's Notes column).

### tasks.md row format (per milestone)

```markdown
| ID    | Title | Status | Acceptance | blockedBy | Verify | Notes |
|-------|-------|--------|------------|-----------|--------|-------|
| T-01  | Add user profile page | DOING | E2E: profile saves + reloads | | | plan: planning/tasks/active/2026-04-17-add-user-profile/plan.md |
| T-02  | Implement notifications | TODO  | Badge count increments on new msg | T-01 | | |
| T-03  | Fix login redirect bug  | DONE  | Manual: /auth → /dashboard | | ✓ tsc ✓ test | |
```

Status values: `TODO` | `DOING` | `DONE` | `BLOCKED` | `SKIPPED`

---

## Phase 1: Check Active Milestone Tasks for Unfinished Work

**BEFORE doing anything else:**

```
1. Read AI_DOCS/memory/session-state.md → get active milestone slug
2. Read AI_DOCS/milestones/<slug>/tasks.md → scan for Status=DOING or Status=BLOCKED
```

**If a DOING task exists:**
> Show the user:
> ```
> ⚠ Unfinished task: "[title]" — Status: DOING
> Notes: [plan path if multi-chunk]
>
> Options:
> 1. Resume this task (recommended)
> 2. Pause it (mark Status=TODO) and start a new one
> 3. Show me the task row and plan first
> ```

**If tasks.md doesn't exist or milestone capsule is missing:** the project hasn't been initialized — tell the user to run `/plan` first, then `/do`.

**If a task is `Status: BLOCKED`:** show the Notes column block reason before asking how to proceed.

---

## Phase 2: Capture & Clarify

Before writing the plan, ensure the requirement is clear.

> **Task Brief first (alignment gate).** For every non-micro-lane task, /do produces a Task Brief
> (template: `TASK-BRIEF.md` in this skill folder, written by `explorer`/`research-lead` to
> `planning/tasks/active/<slug>/brief.md`) BEFORE execution: the requirement slice quoted by ID,
> a reality check of every plan assumption against the current code (OK/DRIFT), the acceptance
> criteria restated concrete + testable with their surfaces named, and the files-to-touch
> prediction. Any DRIFT routes through `change-request` before coding. When the brief exists,
> Phase 2's clarification starts from it instead of re-deriving the requirement.

**Bug:** What's broken? What's expected? Which file/route?
**Feature:** What does "done" look like? Any pattern to follow?
**Refactor:** Why now? What must not break?
**Migration:** Source → target? Backwards compat needed?

> [!NOTE]
> Max 3 clarifying questions. If clear, skip to Phase 3.

---

## Phase 3: Write the Plan (Reference-Based, Size-Aware)

### Step 3.1 — Decide structure

Count expected chunks and scope. Use the table in "When to invoke task-planner vs let /build run direct" above.

- **Simple task (≤ 4 steps)**: just add/update a row in the milestone's `tasks.md`. No separate plan file.
- **Multi-chunk task (5+ steps)**: create `AI_DOCS/planning/tasks/active/YYYY-MM-DD-{slug}/` and add a reference in the tasks.md row's Notes column: `plan: planning/tasks/active/YYYY-MM-DD-{slug}/plan.md`.

### Step 3.2 — Write the plan with references, not copies

> [!CRITICAL]
> Plan files must **link** to spec/API/schema/code — never paste content. Pasting blows the context window and creates drift when the source changes.

**Use this pattern everywhere:**
```markdown
Spec: AI_DOCS/planning/tech-spec.md Section 4.2 (lines 120–145)
API:  AI_DOCS/architecture/api-contract.md — POST /api/users/:id/profile
Code: src/services/authService.ts:45–80 (existing pattern to follow)
Schema: prisma/schema.prisma — User model, lines 12–34
```

**Never do this:**
```markdown
## Spec (copied from tech-spec)
The user profile endpoint should accept...  ❌ content pasted — forbidden
```

### Step 3.3a — Simple task (tasks.md row — no separate plan file)

Add or update a row in `AI_DOCS/milestones/M<NN>-<slug>/tasks.md`:

```markdown
| T-NN | [title] | DOING | [one-line acceptance criterion] | [blockedBy T-XX or empty] | | [brief notes if any] |
```

The acceptance criterion IS the plan for simple tasks. `/build` reads the row and implements. No plan.md needed. Put the Review Focus (below) in the row's Notes col when the task has any.

**Review Focus (optional on simple tasks, expected on complex ones).** Name up to 5 inputs or states the spec does NOT cover that are most likely to break this task. A spec describes the happy path and a few stated errors. The defects that escape are usually in the gaps, such as an empty list, a value at a limit, a second tenant, a retry after failure, or a role the spec never mentions. Listing them at planning time costs a minute, and finding them in production costs far more. Each item gets a pinning test in the task that owns the code, and the test name or id is written next to the item. The list feeds the risk-class edge battery in `rules/testing-rules.md` (Risk-Class Edge Battery): the battery gives the per-code-shape cases that always apply, and Review Focus adds the task-specific ones the battery cannot know about. An item with no pinning test is not reviewed, only noted.

```markdown
Review Focus:
1. [input or state the spec does not cover] -> pinned by [test name / file]
2. [...]
```

Also append the decision/context to `AI_DOCS/milestones/M<NN>-<slug>/decisions.md` if there is a meaningful choice:

```markdown
| N | YYYY-MM-DD | task-planner | [decision] | [rationale] | User |
```

### Step 3.3b — Complex task template (folder structure)

**`plan.md`** (the folder's main index):
```markdown
# Task: [title]
ID: T-YYYY-MM-DD-NNN
Date: YYYY-MM-DD
Type: [feature | bug | refactor | migration]
Status: IN_PROGRESS
Estimated: [time]

## Goal
[One sentence]

## References
[See context.md for full list — kept separate so this file stays scannable]

## Chunk Index (vertical slice — omit N/A layers, see `rules/vertical-slice-rules.md`)
- [ ] **C1**: Schema + migration → `chunk-01-schema.md`
- [ ] **C2**: API endpoint (contract-first) → `chunk-02-api.md`
- [ ] **C3**: Backend RBAC + soft-delete → `chunk-03-rbac-api.md`
- [ ] **C4**: Seed data + test users → `chunk-04-seed.md`
- [ ] **C5**: Frontend UI (reuse first) → `chunk-05-ui.md`
- [ ] **C6**: API integration (no mock leak) → `chunk-06-integration.md`
- [ ] **C7**: Frontend RBAC + required marks → `chunk-07-rbac-ui.md`
- [ ] **C8**: Tests → `chunk-08-tests.md`

## Acceptance Criteria
- [ ] [high-level criterion]
- [ ] [...]

## Review Focus
<!-- Up to 5 inputs or states the spec does not cover that are most likely to break this task.
     Each gets a pinning test in the chunk that owns it. Feeds the risk-class edge battery
     (rules/testing-rules.md). Omit the section only when the spec is genuinely exhaustive. -->
1. [uncovered input or state] -> pinned by [test, chunk]

## Global Schema / API Dependencies
[list — detailed specs live in per-chunk files]

## Notes
[top-level decisions — per-chunk decisions live in chunk files]
```

**`context.md`** (reference bundle, not content):
```markdown
# Context for Task [ID]

## Spec Sections
- Feature overview: AI_DOCS/planning/tech-spec.md Section 4.2 (lines 120–145)
- Acceptance criteria: AI_DOCS/planning/tech-spec.md Section 18 (lines 890–920)

## API Contract
- POST /api/users/:id/profile: AI_DOCS/architecture/api-contract.md (lines 234–260)

## Existing Code Patterns
- Auth service reuse: src/services/authService.ts:45–80
- Form pattern: src/components/forms/ContactForm.tsx (mirror its structure)

## Design References
- Component: AI_DOCS/design/component-registry.md — UserCard (reuse)
- Tokens: AI_DOCS/design/design-dna.md — spacing scale

## Decision Log
- Entry #14: chose Prisma migrations over Knex (2026-04-10)
- Entry #22: profile images stored in S3 (2026-04-12)
```

**`chunk-NN-*.md`** (per-chunk detail — read ONLY when executing that chunk):
```markdown
# Chunk [N]: [title]
Status: PENDING
Parent: ../plan.md

## Change
[Specific, exact description of what to do in this chunk]

## Files Affected
- CREATE: [exact path]
- MODIFY: [exact path:line-range]

## Dependencies
Requires: Chunk [M] complete
Blocks: Chunk [P]

## References Needed
- [file:line specific to this chunk only — keeps context small]

## Implementation Notes
[Any gotchas, exact code snippets if known, library quirks]

## Verification
Command: `npm test services/profile.test.ts`
Expected: 0 failures, profile test suite passes
OR
Manual: Open /profile/me, verify avatar renders

## Done Check
- [ ] Change applied
- [ ] Verification passed (output captured below)
- [ ] Linked files updated where needed
```

### Step 3.4 — Register the task in the milestone capsule

For **multi-chunk tasks**: add a row to `AI_DOCS/milestones/M<NN>-<slug>/tasks.md` pointing to the plan:

```markdown
| T-NN | [title] | DOING | [acceptance] | [blockedBy] | | plan: planning/tasks/active/YYYY-MM-DD-{slug}/plan.md |
```

Also update `AI_DOCS/memory/task-ledger.md` (global milestone summary) to reflect the milestone as DOING if it was still TODO:

```markdown
| M<NN>-<slug> | [Milestone title] | DOING | 1/N | [gate] | |
```

And update `AI_DOCS/memory/session-state.md`:
```
Active task: T-NN ([title])
Next action: Execute chunk C1 — [chunk title]
```

If no milestone capsule exists yet, the project hasn't run `/plan` — tell the user to run `/plan` first.

### Step 3.5 — Chunk Writing Rules

Each chunk MUST have:
- **Exact file path** (`src/services/authService.ts:L45`, not "the auth file")
- **Specific change** ("add `redirectUrl` param to `loginUser()` and pass to `router.push()`")
- **Verification command** (`npm test auth` and expect 0 failures, not "check it works")
- **Self-contained context** (the chunk file has all refs needed to execute it)
- **Accurate `## Files Affected`** — this list is a contract, not a note: it feeds chunk-scope
  enforcement (`enforce-chunk-scope.sh`) AND the parallel-wave disjointness check in /do Phase 1
  (two tasks run concurrently only when their file lists do not overlap). Over-approximate rather
  than omit: a missed file blocks the edit, and a missed overlap breaks a wave.

Chunk size examples:
- ✅ "Add `lastLoginAt` field to User schema in `prisma/schema.prisma` lines 12–34"
- ✅ "Create `GET /api/users/:id/profile` endpoint in `src/api/users.ts`"
- ✅ "Wire profile API in `ProfilePage` — replace mock data with `useProfile()` hook"
- ❌ "Implement user profile feature" (too big — split)
- ❌ "Fix the backend" (too vague)

---

## Phase 3.6: Completeness Gate (BLOCKING before execution)

Before writing ANY code, verify the plan passes all of these:

- [ ] **Goal** is one clear sentence
- [ ] **References** section has file paths + line numbers (no pasted content)
- [ ] **Every chunk** has: file path, specific change, verification command
- [ ] **Every acceptance criterion** has a verification command or manual check
- [ ] **Schema / API dependencies** are listed and each one verified to exist (or explicitly marked "to be created in chunk X")
- [ ] **Chunk ordering** respects the vertical slice (schema → API → backend RBAC → seed → UI → integration → frontend RBAC → tests), per `rules/vertical-slice-rules.md`. Omit layers marked `N/A (reason)`; never skip seed or either RBAC layer for a feature that needs them.
- [ ] **No chunk is vague** — a fresh session should be able to execute each one without asking questions
- [ ] Milestone's `tasks.md` row has been added/updated with Status=DOING and plan path (for multi-chunk tasks)
- [ ] `task-ledger.md` milestone row reflects DOING status
- [ ] `session-state.md` has been updated with Active task + Next action
- [ ] For complex tasks: every `chunk-NN-*.md` file exists before execution starts

**If any box is unchecked** → complete the plan before moving to Phase 4. Do NOT start coding.

---

## Phase 4: Execute Chunk by Chunk

For **each chunk**, in order:

### 4.1 — Context Anchor (read before coding)
Before implementing the chunk:
1. Read the chunk file (`chunk-NN-*.md`) — **not** the whole plan
2. Read only the specific references listed in that chunk file
3. Read the code at target file paths

> This keeps the working context small per chunk — the main advantage of the multi-file structure.

### 4.2 — Schema / Backend Linkage Check
If the chunk touches API / DB / types:
- Endpoint exists in `api-contract.md` (or is the one being created this chunk)
- Schema fields exist (or are the ones being created)
- TypeScript types align with API response shape

Mismatch? STOP and fix the contract/schema first.

### 4.3 — Implement
Complete code. No TODOs, no placeholders, no "later".

### 4.4 — Verify
Run the verification command. Read full output. Capture it in the chunk file:
```markdown
## Verification Evidence
Command: npm test services/profile.test.ts
Output: 12 passed, 0 failed (run at 2026-04-17 14:45)
```

### 4.5 — Mark Chunk Done
Update three things:
1. **Chunk file** (`chunk-NN-*.md`): `Status: DONE`, check the Done Check boxes.
2. **Plan file** (`plan.md`): mark `[x]` on that chunk's line in the Chunk Index.
3. **Milestone tasks.md row** (Notes column): update chunk progress note, e.g. `3/8 chunks done`.

> [!CRITICAL]
> This update must happen after EVERY chunk. Crash recovery depends on it.

> [!WARNING]
> Chunk completion only updates the plan + tasks.md progress note. **Do not move plan files to `completed/` until ALL chunks are done and Phase 5 runs.** Do not change the tasks.md row Status to DONE until Phase 5.

---

## Phase 5: Double-Check & Close

After ALL chunks are checked off:

### 5.1 — Re-read Goal
Does what was built actually achieve the `## Goal` statement? If uncertain, list gaps.

### 5.2 — Run Acceptance Criteria Fresh
For each criterion, run the verification **fresh** (don't rely on earlier runs — state may have changed). Mark `[x]` when confirmed.

### 5.3 — Linkage Audit
If task touched frontend ↔ backend:
- Frontend calls the correct endpoint (matches `api-contract.md`)
- Response shape handled correctly
- No mock data left in production code

### 5.4 — Close the Task

**For simple tasks** (no plan file): update the milestone's tasks.md row Status=DONE and add the verify-stamp. No files to move.

**For multi-chunk tasks** (plan.md + chunk files): update plan.md in place first:
```markdown
Status: DONE
Completed: YYYY-MM-DD
```
Then move the plan folder to completed/ (use `git mv` or `mv` — never `cp`):
```bash
git mv AI_DOCS/planning/tasks/active/YYYY-MM-DD-{slug} \
       AI_DOCS/planning/tasks/completed/YYYY-MM-DD-{slug}
```

**Post-condition:**
- [ ] `AI_DOCS/planning/tasks/active/YYYY-MM-DD-{slug}/` does NOT exist — `test ! -d ...`
- [ ] `AI_DOCS/planning/tasks/completed/YYYY-MM-DD-{slug}/` DOES exist

If any post-condition fails: STOP. Do not proceed to 5.5. Most likely `cp` was used instead of `mv`.

### 5.5 — Update milestone capsule and global ledger (single atomic Edit)

In **one Edit** per file, do the following — not as separate edits:

**`AI_DOCS/milestones/M<NN>-<slug>/tasks.md`:**
1. Set the task row Status = DONE.
2. Add the verify-stamp to the Verify column.
3. Update `capsule.md` → Active task pointer to the next TODO task (or "all done").

**`AI_DOCS/memory/task-ledger.md`** (global milestone summary):
1. Update the milestone row's Progress count (e.g. `3/6` → `4/6`).
2. If ALL tasks in the milestone are DONE: set milestone Status = DONE, note the exit gate.

**Post-condition:**
- [ ] The closed task's row in tasks.md has Status=DONE + verify-stamp.
- [ ] task-ledger.md milestone row shows updated progress.

### 5.6 — Update Memory

`AI_DOCS/memory/session-state.md` (update Active task + Last decision + Next action):
```
Active task: T-NN+1 ([next task title], or "M<NN> complete — awaiting /audit")
Last decision: Closed T-NN: [title] — DONE
Next action: [what's next]
```

If any meaningful decision was made during implementation, append to `AI_DOCS/milestones/M<NN>-<slug>/decisions.md`.

### 5.7 — Git Checkpoint
Ask the user:
```
Task complete: "[title]" (T-NN)
Memory updated. Commit?

1. Yes — commit now
2. Batch — commit with later tasks
3. No
```

If yes:
```bash
git add AI_DOCS/milestones/ AI_DOCS/memory/ AI_DOCS/planning/tasks/completed/ [feature files]
git commit -m "feat(M<NN>): T-NN [title] — [one-line summary]"
```

---

## Session Resume Protocol

When a session starts (session-start.sh hook):

```
1. Read AI_DOCS/memory/session-state.md → get active milestone slug + active task
2. Read AI_DOCS/milestones/M<NN>-<slug>/tasks.md → find Status=DOING row
3. If Notes column has a plan path → load the next PENDING chunk file
4. Surface to the user:

   📋 Resuming task: "[title]" (T-NN)
   Milestone: M<NN>-<slug>
   Next chunk: chunk-NN-*.md — [title]

   Reading chunk file only (minimal context load)...
```

Only the specific chunk file is loaded — the full plan, context.md, and other chunks stay on disk until needed. This is what keeps the working context under ~50K even on long tasks.

---

## Context Budget Rules

| Loaded file | Typical size | When |
|---|---|---|
| INDEX.md | < 50 lines | Every session start |
| plan.md (complex) | 100–200 lines | When resuming/reviewing task |
| context.md | 50–150 lines | Once, at task start |
| chunk-NN-*.md | 50–200 lines | Only while executing that chunk |
| Spec / API / code references | load the specific line range only | Per chunk need |

> Total working context for a single chunk should stay under ~2k tokens of planning data. Everything else is loaded on-demand via file:line references.

---

## Backlog Management

When a user mentions future work but doesn't want it now:
1. Add a row to **Backlog** table in INDEX.md with ID, title, priority, notes
2. Do NOT create a plan file yet — the plan is only written when the task becomes active
3. When user later says "let's do the notifications thing" → move from Backlog to Active, run Phase 2 onward
<!-- Version: 3.3.0 | 2026-10-22 | Review Focus field: up to 5 inputs or states the spec does not cover, each with a pinning test, on the simple-task row and the complex plan.md template. Feeds the risk-class edge battery. Idea from obra/superpowers writing-plans. -->
