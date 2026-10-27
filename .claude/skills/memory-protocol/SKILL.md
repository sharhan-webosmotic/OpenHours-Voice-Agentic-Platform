---
name: memory-protocol
description: "Defines the canonical memory schema every ADF skill reads from and writes to. Use when restoring context, updating project state, managing AI_DOCS/, or designing a new skill. Triggers on: 'Read memory', 'Write memory', 'Restore context', 'Memory sync', 'Capsule loading'."
effort: medium
next_skill: null
required_gate: null
skill_id: SK-000
version: 2.6.4
context_budget:
  load_kb: 25
  scope: session
dependencies:
  required: []
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Memory Protocol — Canonical Schema (v2)

> **Purpose**: Define how ALL skills read from and write to shared memory. There is ONE schema, not lean vs heavy.
> **This is not a standalone skill** — it is a standard every skill must follow at start and end.
> **Memory root**: `AI_DOCS/`
> **Capsule rule**: working context is scoped to the active milestone. Skills load only what their declared `context_budget.scope` allows.

---

## Why Memory Matters

Each AI session starts with a blank context. Without explicit memory files, Claude:
- Forgets the tech stack chosen 3 sessions ago
- Re-asks questions already answered
- Creates components that already exist
- Loses gate approvals
- Doesn't know which milestone is active

Worse, in big projects (5-6 modules) the working context overflows ~50K and accuracy degrades. The **per-milestone capsule** rule keeps the loaded context small regardless of project size.

The file is the memory, not the conversation.

---

## Canonical File Map

### Root-level (Claude Code session bootstrap)

| File | Location | Purpose | Updated by |
|------|----------|---------|-----------|
| `CLAUDE.md` | Project root | Bootstrap summary for Claude Code; short, mandate-first | `claude-md` skill (SK-080) |

The framework also ships its own `CLAUDE.md` at framework root (`.claude/` install path) with the routing mandate, compaction recovery, and capsule loading rules. The project's `CLAUDE.md` inherits from it.

### Global memory (`AI_DOCS/memory/`)

| File | Purpose | Updated by | Read by |
|------|---------|-----------|---------|
| `project-context.md` | Identity, tech stack, active milestone pointer, gate summary, project overrides | every skill on handoff | every skill at startup |
| `session-state.md` | Active milestone + active task + last decision + next action. Written before every compaction. | `/do`, `/build`, every skill at end | session restore, post-compaction recovery |
| `task-ledger.md` | **Heartbeat** — one-line-per-milestone summary table. Full task tables live in capsules. | `/plan` (seeds), `/do` (updates milestone status), `ledger-writer.sh` (helper) | `/do` every loop, `pre-compact.sh`, `session-start.sh` |
| `decision-log.md` | Project-spanning decisions only (stack, architecture). Append-only. | every skill on a project-level choice | any skill needing project-wide rationale |
| `gate-status.md` | Gate verdicts: PENDING / PASSED / FAILED / LOCKED. | `gate-enforcement`, `/audit`, `/ship`, `/plan` (seeds) | every skill before phase-gated work |
| `review-mode.txt` (at `AI_DOCS/` root, not `memory/`) | Gate strictness for triggered gates: `full` / `lean` (default) / `solo`. Scaffolded with `lean`; default `full` if absent. | `/plan` (seeds), user | `gate-enforcement`, `/do` Phase 3, `session-start.sh` |
| `stack.md` | Tech stack details, compliance flags, deploy target, design tokens path | `/plan` (seeds), `/do switch-stack` | every skill |
| `active-skills.md` | Whitelist of dispatchable skills + the **Activation Map** (skills armed by plan-derived trigger conditions for auto-trigger) | `/plan` + `/do` Phase 0 (seed + compile map), `change-request` (re-derive), `/do switch-stack` | `/do` (enforces + auto-triggers per task) |
| `user-prompts.log` | Append-only log of every user prompt, scrubbed of secrets | `hooks/user-prompt-log.sh` (auto) | `pre-compact.sh`, post-compaction recovery |
| `compaction-snapshot.md` | Audit copy of what `pre-compact.sh` injected | `pre-compact.sh` (auto) | post-compaction audit |
| `curator-suggestions.md` | Memory hygiene advisories | `memory-curator.sh` (24h), `session-start.sh` | session start, hygiene review |

### Per-milestone capsules (`AI_DOCS/milestones/M<NN>-<slug>/`)

Each milestone has its OWN folder. Working context for milestone-scoped or task-scoped skills loads ONLY this folder (plus the small global files above).

| File | Purpose | Updated by | Read by |
|------|---------|-----------|---------|
| `capsule.md` | Milestone purpose, scope, exit criteria, active task pointer | `/plan` (seeds), `/do` (updates active task), `gate-enforcement` (gate verdict) | every skill working ON this milestone |
| `tasks.md` | Full task table for this milestone (ID, title, acceptance, status, blockedBy, verify, notes) | `/build` (status + verify), `task-planner` (adds rows), `change-request` | `/do`, `/build`, `/audit`, `qa-testing` |
| `decisions.md` | Milestone-local decisions (append-only) | every skill on a milestone-local choice | every skill working on this milestone |
| `spec.md` | Spec slice for this milestone (pointers to architecture + planning/spec) | `tech-specification`, `change-request` | `/build`, `qa-testing`, `code-reviewer` |
| `api.md` | Endpoints introduced/modified in this milestone (references rows in architecture/api-contract.md) | `tech-specification`, `change-request` | `/build`, `build`, `qa-testing` |

Cross-milestone references use stable IDs: `M01:T-03`, `M02:Gate-2`. Never copy content between capsules.

### Architecture (`AI_DOCS/architecture/`)

| File | Purpose | Updated by | Read by |
|------|---------|-----------|---------|
| `api-contract.md` | **Single source of truth for ALL endpoints** across all milestones — method, URL, request body, response shape, auth | `tech-specification` (Gate 1), `change-request` (post-lock changes only) | `/build`, `build`, `/audit` BEFORE any API call or route handler |
| `database-schema.md` | DB schema | `tech-specification`, `data-migration` | `/build`, ORM-touching skills |

> [!CRITICAL]
> `api-contract.md` is locked once `gate-status.md` records `LOCKED`. The PreToolUse hook blocks edits. Use `/change-request` to modify.

### Requirements (`AI_DOCS/requirements/`)

The single canonical home for **raw client source material**: PDFs, Word documents, design exports, images, transcripts, and pasted briefs saved as `.md`. Raw sources are never edited, only ingested.

| Path | Purpose | Updated by | Read by |
|------|---------|-----------|---------|
| `requirements/<original files>` | Client-shared originals, exactly as received | user, `/do` Step 0.5 intake, `session-management` | `markitdown` (ingestion source), `requirement-finalization` |

A legacy root-level `requirement.md` is deprecated: skills move it into `AI_DOCS/requirements/` on first contact and log the move in `decision-log.md`.

### Ingested (`AI_DOCS/ingested/`)

Markdown conversions of the raw sources, produced by the `markitdown` skill. The relationship: `requirements/` holds originals in, `ingested/` holds conversions out, and `manifest.md` joins the two.

| Path | Purpose | Updated by | Read by |
|------|---------|-----------|---------|
| `ingested/<type>/<basename>.md` | Markdown conversion of one source (`<type>`: pdf, docx, pptx, xlsx, image, audio, html, data, zip, youtube, epub) | `markitdown` (idempotent, sha256-keyed) | `requirement-finalization`, `estimation`, any skill needing document content |
| `ingested/manifest.md` | One row per source: raw path, type, .md path, timestamp | `markitdown` | `requirement-finalization`, `/do` Step 0.5 |

Ingestion-first rule: downstream skills read the ingested `.md` or the requirements baseline, never the raw binary.

### Design (`AI_DOCS/design/`)

| File | Purpose | Updated by | Read by |
|------|---------|-----------|---------|
| `design-dna.md` | Theme, colors, typography, density | `design-discovery` (Phase 0) | `design-tokens`, `build` |
| `component-registry.md` | UI components — source, import path, status | `design-tokens`, `/build` (when adding components) | `/build` BEFORE writing any UI |
| `screens/`, `ux-flows/` | Screen mockups & flow diagrams | `design-screens` | `/build`, QA |
| `flow-validation-plan.md` | Gate FLOW's source of truth: one row per flow (Flow ID, Flow name, Tier, Priority, Status `pending`/`prototyped`/`approved`/`waived`, Chosen variant, Date), plus a `## Waivers` log | `flow-prototypes` | `do`, `milestone-planning`, `gate-enforcement` |
| `flows/<flow-id>/**` | Journey-prototype tree: the clickable HTML variants (`variant-a/`, `variant-b/`, `variant-c/`), the `index.html` comparison hub, and `chosen.md` (click-path map, interaction model, reasons) | `flow-prototypes` | `ux-advisor`, `principal-designer`, `design-screens`, `ui-review`, `milestone-validation` |

### Planning (`AI_DOCS/planning/`)

| File / Path | Purpose | Updated by | Read by |
|-------------|---------|-----------|---------|
| `requirements-baseline.md` | Finalized requirements reconciled from every source in `AI_DOCS/requirements/`: statements with source refs, conflict register, decision log, open items | `requirement-finalization` | `workscope`, `tech-specification`, `estimation`, `prd-generation`, `project-brief` |
| `workscope.md` | Client-facing scope doc | `workscope` | `tech-specification`, `estimation`, `project-brief` |
| `project-brief.md` | Short complexity brief (client or team variant) | `project-brief` | `docx-from-markdown`, `pptx` |
| `tech-spec.md`, `spec/<section>.md` | 23-section developer spec, chunked by section | `tech-specification` | `/build`, capsule `spec.md` files |
| `tasks/active/<slug>/{plan.md, chunk-NN-*.md, context.md}` | Multi-chunk task plans (referenced from a `tasks.md` row in a capsule, not a separate INDEX) | `task-planner` | only the chunk currently being executed |

### Audit (`AI_DOCS/audit/`)

| File | Purpose | Updated by |
|------|---------|-----------|
| `audit-report.md` | Latest audit verdict (overwritten each run) | `/audit` |
| `agent-log.md` | Agent invocation audit trail | hooks (auto) |

### Deployment (`AI_DOCS/deployment/`)

| File | Purpose | Updated by |
|------|---------|-----------|
| `RUNBOOK_<version>.md` | Per-release runbook | `deployment-planning` |
| `DEPLOYMENT_LOG_<version>.md` | Append-only execution log per release | `deployment-execution`, `/ship` |

### Quality / hooks (`AI_DOCS/quality/`)

| File | Format | Purpose | Updated by |
|------|--------|---------|-----------|
| `drift-report.md` | Markdown | Route + test coverage drift | `drift-detector.sh` (24h) |
| `defect-log.md` | Markdown table | One row per defect found AFTER its task was DONE (phase found, severity, root cause, escaped flag, prevention). Source of the escaped-defect rate (target <1%). | `/do` (review REJECT, regression), `/debugger`, `/qa-testing`; read by `/retrospective`, `/milestone-validation`, Gate 5 |
| `pending-reviews.jsonl` | JSONL | Chunks DONE awaiting review | `post-chunk-review-detect.sh` |
| `milestone-audit-queue.jsonl` | JSONL | PHASE-GATE approvals awaiting `/project-audit` | `milestone-audit-detect.sh` |
| `accessibility-report.md` | Markdown | A11y audit output | `accessibility-audit` |

### Scratch (`AI_DOCS/.temp/`)

Gitignored per-project working directory for framework scripts: unpacked XML trees, intermediate PDFs/images, and generated helper scripts. Scripts resolve it by walking up from cwd to the first directory containing `AI_DOCS`, creating `.temp/` if missing, falling back to the OS temp dir only when run outside any project. Safe to delete at any time. Never a source of truth, so nothing reads it as an input to a decision.

### Deprecated (do NOT create)

| Old path | Replacement |
|---------|-------------|
| `AI_DOCS/memory/.adf-mode` | (deleted — no modes) |
| `AI_DOCS/memory/task.md` | per-milestone `tasks.md` inside the capsule |
| `AI_DOCS/planning/tasks/INDEX.md` | `task-ledger.md` (milestone summary) + capsule pointers |
| `AI_DOCS/planning/tasks/active-task.md` | task-planner writes its plan.md inside `planning/tasks/active/<slug>/` referenced from a capsule's `tasks.md` row |
| `AI_DOCS/architecture/api.md` | `AI_DOCS/architecture/api-contract.md` |
| root `requirement.md` (project root) | `AI_DOCS/requirements/requirement.md` (skills auto-move it there and log the move) |
| `AI_DOCS/planning/requirement.md` (raw source copy) | raw sources live in `AI_DOCS/requirements/`; the reconciled document is `AI_DOCS/planning/requirements-baseline.md` |

`/plan --migrate` renames legacy projects automatically.

---

## Capsule Loading Rules (CRITICAL for big projects)

Every SKILL.md declares its `context_budget` in frontmatter:

```yaml
context_budget:
  load_kb: 30          # max KB to load at startup (rough guideline)
  scope: milestone     # one of: task | milestone | global | session
```

### Allowed reads by scope

| `scope` | Default skills | May load |
|---------|----------------|----------|
| `task` | `/build`, `build`, single-task specialists | global memory (small files) + active milestone's `capsule.md` + the SPECIFIC task row from `tasks.md` (use Read offset/limit, not whole file) + active chunk file from `planning/tasks/active/<slug>/` |
| `milestone` | `/audit`, `gate-enforcement`, `qa-testing`, `code-reviewer` | all of the above PLUS the entire active milestone capsule directory. NEVER load other milestones. |
| `global` | `/plan`, `/do` Phase 3, `project-audit`, `architecture` | may load multiple milestone capsules, but via Read offset/limit. NEVER `cat` whole capsules. |
| `session` | `/do`, `session-management`, `memory-protocol` | global memory files + session-state. Capsule contents loaded lazily as a milestone is selected. |

### Loading patterns

- **Read sections, not files**: when you need the M01 task with ID T-03, do `Read milestones/M01-auth/tasks.md offset N limit M` (where the offset is the line of T-03 plus a few). Don't read the whole tasks.md.
- **Grep before read**: when looking for a prior decision keyword, `Grep` `decision-log.md` and only Read the matching rows.
- **Stable IDs over inline copies**: write `see M01:T-03` in capsule files. Never paste content from another capsule.

---

## `project-context.md` — Required Sections

Skills MUST check `project-context.md` for `## Project Overrides` before applying any default rule:

```markdown
## Project Overrides
<!-- User-defined overrides. Skills MUST respect these. -->
<!-- Format: [Rule]: [DISABLED / ENABLED / PARTIAL — reason] -->
- Unit Testing: [ENABLED / DISABLED — reason]
- E2E Testing: [ENABLED / DISABLED — reason]
- i18n: [ENABLED / DISABLED — reason]
- Design System: [FULL / PARTIAL — which screens are designed]
- Code Comments: [DISABLED / ALLOWED — reason]
```

When a skill reads an override, it silently skips the corresponding default behavior. No warnings.

Other required sections: `Identity`, `Tech Stack`, `Source Documents`, `SDLC State` (Active milestone, Active task), `Gate Summary`, `Git State`, `Open Questions`.

---

## Startup Protocol (every skill — non-negotiable)

> The first action of every skill, before asking any questions or generating any output, is to read memory consistent with its `context_budget.scope`.
> If a memory file doesn't exist yet, note that and proceed — but do NOT skip the check.

### Step 1 — Read global memory (every skill)

- `project-context.md` (identity, stack, active milestone pointer, gate summary)
- `session-state.md` (active task, last decision, next action)
- `gate-status.md` (any gates relevant to this skill)

### Step 2 — Resolve active milestone (skills with scope ≠ global)

Read the active milestone slug from `session-state.md → Active milestone` (or fall back to `task-ledger.md → ## Active milestone`).

### Step 3 — Load scope-appropriate context

Per the table in "Capsule Loading Rules". `task`-scoped skills should load the smallest possible slice — typically the SPECIFIC task row plus the active chunk file. Use `Read offset+limit`.

### Step 4 — Skill-specific reads

| Skill | Additional files |
|-------|-----------------|
| `requirement-finalization` | `requirements/` (all sources), `ingested/manifest.md`, `ingested/**`. Outputs: `planning/requirements-baseline.md`. |
| `workscope` | `planning/requirements-baseline.md` if present, else `requirements/` + `ingested/manifest.md` (pre-fill discovery, confirm instead of re-ask) |
| `project-brief` | `planning/requirements-baseline.md`, `planning/workscope.md`, `estimation/` summaries, `memory/decision-log.md`, `memory/stack.md`. Outputs: `planning/project-brief.md`. |
| `tech-specification` | `project-context.md`, `planning/workscope.md`, `planning/requirements-baseline.md` (decision + conflict context). Outputs: `planning/tech-spec.md` (index) + `planning/spec/<section>.md` files + `architecture/api-contract.md`. Per-milestone slices echoed into each capsule's `spec.md` and `api.md`. |
| `design-discovery` | `project-context.md`, `planning/tech-spec.md` (Sections 4 & 5) |
| `design-tokens` | `design/design-dna.md`, `design/component-registry.md` |
| `/build` | `project-context.md`, `session-state.md`, active capsule's `capsule.md` + specific task row from `tasks.md`, `architecture/api-contract.md` if API touched, `design/component-registry.md` if UI |
| `qa-testing` | `project-context.md`, active milestone capsule, `gate-status.md` |
| `code-quality` | `project-context.md`, `design/component-registry.md` |
| `change-request` | `project-context.md`, active capsule, `decision-log.md`, `architecture/api-contract.md` |
| `session-management (restore)` | `project-context.md`, `session-state.md`, `task-ledger.md`, `decision-log.md` (last 10), `user-prompts.log` (last 10) |

### Step 5 — Announce loaded context

After reading, briefly confirm to the user what was loaded:

```
Memory loaded:
- Project: <name> (<type>)
- Active milestone: M<NN>-<slug>
- Active task: T-<NN>
- Stack: <frontend> + <backend> + <database>
- Gates passed: <list>
```

If anything critical is missing, ask the user to provide it before proceeding.

---

## Shutdown Protocol (every skill — non-negotiable)

> The last action of every skill before handing off is to update memory.
> Never complete a skill without writing what was decided.

### What to write

#### Always update `session-state.md`
- Active task (ID + title)
- Last decision (one line)
- Next action (one line)
- Capsule pointer if active milestone changed

#### Always update `project-context.md` when these change
- Tech stack confirmed
- Active milestone changes
- SDLC stage advances
- Gate status changes

#### Always append to milestone-local `decisions.md` when
- A milestone-local choice is made (lib pick within this milestone, naming convention, test approach)
- A user expresses a preference scoped to THIS milestone in chat

#### Append to global `decision-log.md` when
- A project-spanning choice is made (DB engine, framework version, deployment target)
- A user expresses a preference that affects ALL milestones
- A gate passes/fails

#### Update milestone capsule's `tasks.md` when
- A task starts (Status: TODO → DOING)
- A task completes (DONE + verify-stamp)
- A task is blocked (BLOCKED + Notes)
- A new task is added (via change-request)

#### Update `task-ledger.md` (global summary) when
- A milestone moves between Status states (TODO → DOING → DONE)
- Progress count changes meaningfully (e.g. 3/8 → 6/8)
- A milestone exit gate is approved/blocked

---

## Handoff format (the `Checkpoint:` line is non-negotiable)

When one skill completes and hands off:

```
Skill <current-skill> complete. Memory updated.
Checkpoint: <files written>, safe to compact.

Handing off to: <next-skill>

Summary of what was decided:
- <Decision 1>
- <Decision 2>
- <Decision N>

Context written to:
- AI_DOCS/memory/session-state.md
- AI_DOCS/milestones/M<NN>-<slug>/<files>
- AI_DOCS/memory/decision-log.md (if project-spanning)

Ready to start <next-skill>? Or type a command.
```

The `Checkpoint:` line tells a re-entering Claude that state is consistent. Without it, assume the skill is mid-execution and do not proceed past it.

---

## Session Restore Quick Protocol

When the user says "continue", "resume", or starts a new session:

```
1. Read AI_DOCS/memory/project-context.md → identity, stack, stage, active milestone, gate summary
2. Read AI_DOCS/memory/session-state.md → active task, last decision, next action
3. Read AI_DOCS/milestones/M<NN>-<slug>/capsule.md → exit criteria, active task pointer
4. Read AI_DOCS/memory/decision-log.md (last 5 rows) → project-spanning rationale
5. Read AI_DOCS/memory/user-prompts.log (last 5 lines) → user's recent intent
6. Announce restored state (see Step 5 of Startup)
7. Ask: "Ready to continue with <next task from capsule>?"
```

If `project-context.md` does not exist → treat as new project → run `/plan`.
If `project-context.md` exists but has the deprecated `.adf-mode` flag → run `/plan --migrate` first.

---

## Compaction Recovery (after auto-compact)

When you see `<compaction-summary>` in your context (Claude Code just compacted):

1. **STOP**. Do not respond to the user yet.
2. Read in order:
   - `AI_DOCS/memory/session-state.md`
   - `AI_DOCS/memory/task-ledger.md`
   - The active milestone's `capsule.md` and `tasks.md`
   - `AI_DOCS/memory/decision-log.md` last 10 rows
   - `AI_DOCS/memory/user-prompts.log` last 10 lines
3. Acknowledge in one line: `Recovered: <active milestone> / <active task> / <last decision> / <next action>.`
4. THEN respond to the user's actual request.

This is the same rule as in the framework `CLAUDE.md`. It's repeated here so skill authors see it.

---

## Rules integration

Claude Code auto-loads these rules when editing matching files:
- `.claude/rules/development-rules.md` — memory law (update AI_DOCS/ after every session)

## Token budgets

| Session type | Budget |
|--------------|--------|
| Quick task (status check, small edit) | < 5,000 tokens |
| Single-task work (within one milestone) | < 30,000 tokens (capsule + task row + small global) |
| Cross-milestone work (rare — global scope only) | < 50,000 tokens (multiple capsules summarized) |
| Deep audit / architecture review | < 50,000 tokens; use a subagent if exceeded |

If a skill's `context_budget.load_kb` is exceeded at startup, the skill should warn `Context budget exceeded — consider /do checkpoint.` and proceed cautiously.

## Pruning (monthly hygiene)

1. Archive completed milestones — move `AI_DOCS/milestones/M<NN>-<slug>/` to `AI_DOCS/milestones/_archive/`. Keep a one-line summary in `task-ledger.md`.
2. Summarize `decision-log.md` (keep last 15 rows verbatim, compress older by quarter).
3. Update `project-context.md` to reflect the current active milestone.

<!-- v2.3.4 - 2026-06-29 - DB schema artifact canonicalized to database-schema.md (was schema.md). -->
<!-- v2.5.0 - 2026-08-20 - documented AI_DOCS/.temp/ as the gitignored per-project scratch directory for framework scripts. -->
<!-- v2.6.0 - 2026-08-20 - registered AI_DOCS/design/flow-validation-plan.md (Gate FLOW source of truth, owner flow-prototypes) and AI_DOCS/design/flows/** (journey-prototype tree) in the canonical Design file map. Per PLAN-flow-validation.md Part 4 item 11. -->

<!-- Version: 2.6.3 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 2.6.4 | 2026-10-22 | v4.32.0: team-feature, team-design and team-release retired, consumer lists repointed -->
