---
name: plan
description: "Initializes a fresh project from a one-line requirement via brief Q&A, then generates the canonical AI_DOCS state files, the design-token code file (if UI) and per-milestone capsules with task tables. Runs once per project. Has a --migrate sub-mode for legacy api.md / .adf-mode layouts. Invoked by /do. Not user-facing."
skill_id: SK-134
version: 2.3.5
context_budget:
  load_kb: 30
  scope: global
dependencies:
  required: [ask]
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: core
  user_facing: false
---

# /plan — initialize the project

> Run once per project. Output: the canonical state files in `AI_DOCS/memory/`, the per-milestone capsules in `AI_DOCS/milestones/`, the design-token code file (if UI), and a seeded global `task-ledger.md` ready for `/do`'s outer loop. For deep-governance projects (compliance, multi-team), `/plan` still runs first; the `/do` Phase 1 lead dispatch and Phase 3 plus `gate-enforcement` Gate 5 run when state demands them. There is no separate "heavy mode."

## Inputs
- The user's one-line requirement (free text).
- (Optional) any existing `.claude/templates/*.md` — copied as starting points.

## Process

### Step 1 — Capture intent (≤5 questions)
Always one question at a time, with recommended default. Each answer is logged to `decision-log.md`. Do not move to step 2 until intent is clear.

The questions to ask (skip a question if answered in the user's initial requirement):
1. **What is this product, in one paragraph, and who uses it?** (free text — used to fill intent.md > Goal + Users)
2. **Stack constraints to feed selection?** (free text: team skills, mandated tech, existing codebase, or 'recommend best fit'). The stack is NOT picked here from a menu of defaults. It is selected requirement-first per `rules/tech-stack-selection-rules.md`: options plus an architecture-reasoned recommendation plus user confirmation, with no house default. This answer is captured as input to that selection, which `/do` runs once the requirement and dimensions are known. Do NOT anchor on any particular framework, database, or host here.
3. **Compliance flags?** Multi-select: hipaa, soc2, gdpr, pci, none (recommended for POCs).
4. **Does the app need real-time updates: live notifications, collaborative editing, live feeds, or chat?** (yes / no / decide later)
   - **yes** → tech-spec and M01-setup tasks will include WebSocket or SSE setup (e.g., Socket.io, native WebSocket, Ably, Pusher). Polling is NOT an acceptable substitute for real-time features; it will be flagged as a defect in `/audit`. Seed one M01-setup task: "Configure WebSocket/SSE infrastructure — do NOT use polling for real-time features."
   - **no** → standard HTTP polling (if needed) is acceptable for non-real-time refresh.
   - **decide later** → record in `decision-log.md`; default to 30s long-poll placeholder; do NOT architect a feature on polling if the requirement says "live". Revisit before M02.
   - Skip this question if the product description contains no mention of notifications, feeds, chat, or collaborative features.

If the user gave enough in the initial requirement to skip any, do skip — don't re-ask.

### Step 2 — Write canonical state files

Use `.claude/templates/` as the source. Write to (creating directories as needed):

**Global memory** (`AI_DOCS/memory/`):
- `project-context.md` — from `templates/intent.md`, filled in. Include the Project Overrides section.
- `stack.md` — from `templates/stack.md`, filled in. Frontmatter `compliance:` set from answers. Per `rules/tech-stack-selection-rules.md`, also write: `planning_depth` (standard|poc), `stack_confirmed: false` initially (set true only after `/do` runs requirement-first selection and the user confirms), and a `## Selection rationale` section with, per category (frontend, backend, database, hosting), the reason chosen, alternatives considered, and the revisit trigger. Do NOT write a house-default stack here. The chosen stack and its rationale are populated by the requirement-first selection step, not by a menu pick in `/plan`.
- `task-ledger.md` — from `templates/task-ledger.md`. After step 4, this contains a one-line-per-milestone summary table.
- `decision-log.md` — append the answers from step 1.
- `active-skills.md` — from `templates/active-skills.md`, with stack-section filled in based on answers. Set the Activation Map `Status` column (armed/dormant) per row from the stack/compliance answers; `/do` Phase 0 Step 2.5 refines it once the tech-spec dimensions exist.
- `gate-status.md` — seed with the standard gate registry, all PENDING. Format: `| Gate | Status | Date | Notes |`.
- `session-state.md` — seed with `Active milestone: M01`, `Active task: T-01`, `Last decision: project initialized`, `Next action: /do (will pick up T-01 and start building)`.

**Architecture** (`AI_DOCS/architecture/`):
- `api-contract.md` — from `templates/api-contract.md`, with placeholder rows refined in step 4. This is the single source of truth for endpoints; locked once Gate 1 records `LOCKED` in `gate-status.md`.
- `database-schema.md` — only if a DB was chosen. From `templates/database-schema.md`.

**Design** (`AI_DOCS/design/`, only if frontend in stack):
- `component-registry.md` — empty registry; `/build` and `design-tokens` populate it as components are added.
- `design-dna.md` — placeholder; `/design-discovery` fills it if invoked.

> **Do NOT** write `AI_DOCS/memory/.adf-mode`, `architecture/api.md`, or `memory/task.md`. Those are the deprecated names from the old dual-schema framework.

### Step 3 — Generate the design-token file (UI projects only)

Skip if there is no frontend in the chosen stack.

Pick by stack:
- Next.js + Tailwind (default for shadcn): create `tailwind.config.ts` with theme.extend.colors, spacing, fontFamily, borderRadius, fontSize maps; create `app/globals.css` with CSS-variable tokens for shadcn theme.
- Next.js without Tailwind: create `src/design/tokens.ts` exporting typed token objects (`colors`, `spacing`, `radii`, `typography`).
- Other: create `src/design/tokens.ts` similarly.

Default token set (MVP — user can refine later):
- colors: `bg`, `fg`, `muted`, `accent`, `success`, `warning`, `danger`, `border` (each with `-fg` variant)
- spacing scale: 0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32 (× 4px)
- typography: `sans`, `mono`, sizes `xs|sm|base|lg|xl|2xl|3xl`
- radii: `none, sm, md, lg, full`

Then scaffold 3 base components:
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Card.tsx`
Each imports from the tokens file. No hardcoded values.

Record the token file path in `stack.md → Design tokens`.

### Step 4 — Seed per-milestone capsules

Take the MVP-scope bullets from `project-context.md`. For each bullet, decompose into ordered tasks across milestones. Default milestone shape (rename slugs to fit the project — e.g. `M01-auth`, `M02-billing`):
- **M01-setup**: env, schema, auth, base UI shell, deploy pipeline (≤6 tasks)
- **M02-core**: each MVP feature → 1–3 tasks (FE + BE pair where applicable). For projects with ≥3 distinct modules, split into one milestone per module: `M02-<feature1>`, `M03-<feature2>`, etc.
- **M<final>-polish**: a11y pass, perf budget, smoke tests, README

For each milestone, create the capsule directory and files (using `templates/milestone-capsule.md` as the structure):

```
AI_DOCS/milestones/M<NN>-<slug>/
  capsule.md      # purpose, scope, exit criteria, active task pointer
  tasks.md        # full task table for THIS milestone (ID, title, acceptance, status, blockedBy, verify, notes)
  decisions.md    # milestone-local decisions (empty initially, append-only)
  spec.md         # spec slice for this milestone (placeholder; tech-specification fills it if invoked)
  api.md          # endpoints introduced/modified in this milestone (references rows in architecture/api-contract.md)
```

For each task in a milestone's `tasks.md`: assign ID (T-01, T-02, … per milestone, NOT global), title, one-line acceptance, blockedBy if known. Status = TODO. Verify column blank.

Plan stays at one-line acceptance. The per-task `Review Focus` field (up to 5 inputs or states the spec does not cover, each with a pinning test, feeding the risk-class edge battery) is added by `task-planner` when the task is expanded, so do not invent it here.

Then write the **global summary** to `AI_DOCS/memory/task-ledger.md` — one line per milestone:

```
| Milestone | Title | Status | Progress | Exit gate | Notes |
|-----------|-------|--------|----------|-----------|-------|
| M01-setup | Setup & auth | TODO | 0/6 | Gate-1 PENDING | |
| M02-core  | Core CRUD    | TODO | 0/5 | Gate-2 PENDING | |
| M03-polish| Polish & a11y| TODO | 0/3 | QA-TEST-COVERAGE PENDING | |

## Active milestone
M01-setup

## Next action
Start M01-setup → T-01 (<title>)
```

Cross-milestone task references use the form `M02:T-03`. The full per-task detail lives ONLY in the milestone capsule's `tasks.md`. Do NOT duplicate task tables in the global `task-ledger.md`.

### Step 5 — Final summary to user

Print a short recap:
```
✓ Project initialized.
  intent:     AI_DOCS/memory/project-context.md
  stack:      AI_DOCS/memory/stack.md
  api:        AI_DOCS/architecture/api-contract.md
  milestones: <N> capsules under AI_DOCS/milestones/
  tasks:      <total> seeded across <N> milestones
  tokens:     <path>  (locked, /build will enforce)

Next: /do  (will pick up M01-setup → T-01 and start building)
```

Hand back to `/do`.

## --migrate mode (for legacy projects)

If invoked as `/plan --migrate`, do not run intake. Instead:
1. Detect legacy markers: `AI_DOCS/memory/.adf-mode`, `AI_DOCS/architecture/api.md`, `AI_DOCS/memory/task.md`, `AI_DOCS/planning/tasks/INDEX.md`.
2. For each legacy file present, rename/migrate to canonical:
   - `architecture/api.md` → `architecture/api-contract.md` (preserve content).
   - `memory/task.md` rows → split by milestone into `milestones/M<NN>/tasks.md`. Original file is deleted after split.
   - `planning/tasks/INDEX.md` → reference rows replaced with milestone-summary rows in `task-ledger.md`. Active rows kept as pointers in capsule.md.
   - `memory/.adf-mode` → deleted (the framework no longer has modes).
3. Seed the missing canonical files: `gate-status.md` (with current gate verdicts inferred from `gate-status.md` if present, else PENDING), `session-state.md` (resume from last `INDEX.md` active row), milestone capsules (one per existing milestone).
4. Append a `## Migration` entry to `decision-log.md` listing every renamed/created file.
5. Run a self-check: grep `AI_DOCS/` and the framework's `skills/` for any remaining `api.md`, `task.md`, `.adf-mode`, `INDEX.md` references; surface any hits to the user.

## Rules loaded
- `rules/tech-stack-selection-rules.md` — stack is chosen requirement-first (options plus reasoned recommendation plus confirmation, no house default); `/plan` only captures stack constraints and seeds `stack.md` with `stack_confirmed: false` and a `## Selection rationale` section.

## Boundaries
- Asks at most 5 questions. If the user expresses they want to "just go", skip to defaults and proceed.
- Does NOT write any application code beyond the token file + 3 base UI components.
- Re-running `/plan` on an existing project: refuse and route the user to `/do switch-stack`, `/plan --migrate` (for legacy schema), or a manual edit, unless the user passes `--reset` and confirms via `/ask` (logs a `## Reset` entry in decision-log).

## Verification (of /plan itself)
- All canonical global files exist: `project-context.md`, `stack.md`, `task-ledger.md`, `decision-log.md`, `active-skills.md`, `gate-status.md`, `session-state.md`, `architecture/api-contract.md` (+ `database-schema.md` if DB).
- At least one milestone capsule exists at `AI_DOCS/milestones/M01-*/` with all 5 files.
- `task-ledger.md` has one row per milestone (NOT one row per task).
- Token file imports resolve in TypeScript (or python equivalent).
- `decision-log.md` has one entry per question asked.
- No `.adf-mode` file written. No `architecture/api.md` written.

<!-- v2.3.1 - 2026-06-29 - DB schema artifact canonicalized to database-schema.md (was schema.md). -->

<!-- Version: 2.3.3 | 2026-10-21 | description trimmed per the v4.28.0 cost policy -->
<!-- Version: 2.3.4 | 2026-10-22 | Notes that the Review Focus field lives in task-planner's templates. -->
<!-- Version: 2.3.5 | 2026-10-22 | v4.32.0: team-feature, team-design and team-release retired, dispatch note repointed to /do -->
