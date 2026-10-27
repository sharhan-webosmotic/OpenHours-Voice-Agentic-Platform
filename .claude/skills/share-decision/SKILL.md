---
name: share-decision
description: "Share and import cross-project memory at ~/.adf/shared/. Share mode promotes an architectural decision from this project to shared memory (decisions.md). Import mode pulls shared conventions and past decisions into a new project. Triggers on: 'share this decision', 'promote decision to shared', 'add to shared memory', 'share across projects', 'mark decision as shared', 'global decision', 'share last decision', 'import conventions', 'load shared conventions', 'import team standards', 'bootstrap from shared memory', 'load past decisions', 'reuse team conventions', 'pull in shared decisions', 'import architectural decisions from other projects'."
next_skill: null
required_gate: null
skill_id: SK-139
context_budget:
  load_kb: 20
  scope: task
version: 1.1.0
dependencies:
  required: []
  optional: [project-context]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: utility
  user_facing: true
---

# Share Decision

> **Purpose**: Move knowledge between ADF projects through shared cross-project memory
> **Audience**: End user / team lead
> **Trigger**: User wants to share a decision across projects (`share`), or bootstrap a new project from shared memory (`import`)

---

## Modes

| Mode | Triggered by | What it does |
|---|---|---|
| `share` (default) | "share this decision", "promote to shared", "share the last decision" | Tags a decision `[SHARED]` and syncs it to `~/.adf/shared/decisions.md` |
| `import` | "import conventions", "load shared conventions", "bootstrap from shared memory", `/share-decision import` | Pulls shared decisions and conventions from `~/.adf/shared/` into this project |

`import` replaces the retired `import-conventions` skill (v4.32.0). Pick the mode from the request. When the request is ambiguous ("shared memory"), ask which one is meant in one inline question.

---

## Mode: share

Tags a decision in `AI_DOCS/memory/decision-log.md` with `[SHARED]`, then syncs it immediately to `~/.adf/shared/decisions.md`.

The sync runs automatically on every session end via `hooks/shared-memory-sync.sh`. This mode triggers an immediate sync without waiting for the session to end.

### When user says "share this decision" or "share the last decision"

1. Read the last 10 rows of `AI_DOCS/memory/decision-log.md`
2. Identify the most recent decision row
3. Ask the user to confirm: "Share this decision cross-project: `<decision text>`?"
4. If confirmed: append `[SHARED]` to that row in decision-log.md
5. Run sync: `bash .claude/hooks/shared-memory-sync.sh`
6. Confirm: "Decision promoted to shared memory. Find it at `~/.adf/shared/decisions.md`."

### When user specifies a decision (by date, text, or row number)

1. Read `AI_DOCS/memory/decision-log.md`
2. Find the matching row
3. Append `[SHARED]` tag to the row (use Edit tool, modify the exact line)
4. Run sync: `bash .claude/hooks/shared-memory-sync.sh`
5. Confirm: "Decision shared. It will appear in all future projects via `/share-decision import`."

### Tagging format

Add `[SHARED]` at the end of the decision row. Do not modify any other part of the row.

Before: `| 2026-05-13 | Use JWT for auth | Stateless, easy to scale |`
After:  `| 2026-05-13 | Use JWT for auth [SHARED] | Stateless, easy to scale |`

### What gets synced

Only rows containing `[SHARED]` are synced. Everything else stays local.
Sync is deduplicated: the same decision is never written twice to shared memory.

---

## Mode: import

Bootstrap a new project with shared team conventions and past decisions. Reads `~/.adf/shared/` and pulls relevant content into the current project:
- Shared decisions are prepended to `AI_DOCS/memory/decision-log.md`
- Conventions are copied to `AI_DOCS/architecture/conventions.md` (if not present)
- Stack defaults are displayed as suggestions for `AI_DOCS/memory/stack.md`

### Step 1: Check what's available

1. Check if `~/.adf/shared/` exists
   - If not: "No shared memory found. Run `/share-decision` in an existing project to build it."
   - Exit if no shared data.

2. Read `~/.adf/shared/decisions.md` (if exists)
3. Read `~/.adf/shared/conventions.md` (if exists)
4. Count how many shared decisions and conventions are available
5. Display a preview: "Found N shared decisions and conventions from past projects."

### Step 2: Confirm with user

Ask: "Import these into this project? (decisions will be prepended to decision-log.md, conventions copied to AI_DOCS/architecture/conventions.md)"

### Step 3: Import decisions

If `~/.adf/shared/decisions.md` has content AND user confirmed:
1. Read current `AI_DOCS/memory/decision-log.md` (may not exist yet)
2. Extract shared decision rows (skip the `<!-- hash:... -->` metadata comments)
3. Prepend them to decision-log.md with a header: `## Imported from shared memory (YYYY-MM-DD)`
4. Note: these are READ-ONLY imports, mark each with `[IMPORTED]` tag

### Step 4: Import conventions

If `AI_DOCS/architecture/conventions.md` does NOT exist:
1. Copy `~/.adf/shared/conventions.md` to `AI_DOCS/architecture/conventions.md`
2. Report: "Conventions file created at AI_DOCS/architecture/conventions.md"

If it DOES exist:
- Do not overwrite, report: "conventions.md already exists, skipped"

### Step 5: Display summary

```
Imported from shared memory:
  - N architectural decisions -> AI_DOCS/memory/decision-log.md
  - Team conventions -> AI_DOCS/architecture/conventions.md (new)

These reflect your team's past decisions. Review before treating as binding.
To add more shared context, use /share-decision in any project.
```

When the import succeeded on a fresh project, the natural next step is `/project-context` to fold the imported conventions into the project identity file.

### When there is nothing to import

If `~/.adf/shared/` is empty or missing:
1. Explain what shared memory is
2. Tell the user how to build it: `/share-decision` in existing projects
3. Show the location: `~/.adf/shared/decisions.md` and `~/.adf/shared/conventions.md`

---

Skill share-decision complete. Memory updated.
Checkpoint: share mode tags AI_DOCS/memory/decision-log.md and updates ~/.adf/shared/decisions.md, import mode writes AI_DOCS/memory/decision-log.md and AI_DOCS/architecture/conventions.md, safe to compact.

<!-- Version: 1.0.2 | 2026-10-21 | prior state: share-only skill -->
<!-- Version: 1.1.0 | 2026-10-22 | v4.32.0: import-conventions merged in as `import` mode, optional dependency on project-context kept from the retired skill -->
