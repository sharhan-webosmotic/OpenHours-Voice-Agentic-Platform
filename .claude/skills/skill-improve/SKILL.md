---
name: skill-improve
skill_id: SK-094
context_budget:
  load_kb: 30
  scope: task
version: 1.0.4
description: "REPAIR LOOP for an EXISTING failing skill or agent file: full test-diagnose-fix-retest cycle. Runs /skill-test static + category + trigger checks, diagnoses failures, proposes targeted fixes (including frontmatter description rewrites for trigger misses), applies them, retests, and reports verdict. Use when a skill is broken, failing static/behavioral/auto-trigger tests, or needs iterative repair. Max 2 failed fix attempts before escalating. Do NOT use for scaffolding a brand-new skill, use skill-authoring instead. Do NOT use for read-only validation without fixing, use skill-test instead."
allowed-tools: Read Grep Glob Edit Write
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# /skill-improve — Skill Improvement Loop

Runs a complete test → diagnose → fix → retest cycle for a skill or agent.

## Usage

```
/skill-improve [skill-name]
/skill-improve [agent-name]
```

## Process

### Step 1 — Read the File
Read `.claude/skills/[name]/skill.md` or `.claude/agents/[name].md`.

### Step 2 — Run Static Check
Apply all 7 static checks (from `/skill-test static`).
Record: which checks pass, which fail, what specifically is wrong.

### Step 3 — Run Category Check (if applicable)
Look up the skill's category. Apply the relevant rubric from `skill-lab/quality-rubric.md`.
Record: which metrics pass, which fail.

### Step 3b — Run Trigger Check (if spec exists)
Read `skill-lab/catalog.yaml` for this skill's `trigger_last_score`.

- If `trigger_last_score >= 18` → skip this step (skill auto-triggers correctly).
- If `trigger_last_score < 18` → read the latest `skill-lab/results/trigger-*.md` for this skill's miss details. Tally which sibling skills it misfired to.
- If `trigger_last_score` is null but `trigger_spec` is set → run `bash skill-lab/run-trigger-tests.sh --skill [name]` to populate it.
- If no `trigger_spec` at all → skip (no test to fail).

Produce a miss summary:
```
Trigger: 16/20 — missed 4 prompts.
Misfires: 2 -> audit, 1 -> guardrails, 1 -> simplify (over-trigger).
Likely fix: add a distinguishing verb/noun to description to disambiguate from audit.
```

### Step 4 — Diagnose Root Cause
For each failure:
- Is it a missing field? (easy fix)
- Is it a structural pattern problem? (requires rewrite of a section)
- Is it an inline gate prompt? (extract to governance-gates.md, reference by ID)
- Is a `model:` tag present? (the tag itself is the finding: remove it, because agents and skills carry no model tags and inherit the session model from the Claude CLI default settings)
- Is it a trigger miss? (frontmatter `description:` is not distinctive — rewrite it)

### Step 5 — Propose Fix

Before writing anything:
```
I found N issues in [skill-name]:
1. [issue]: [proposed fix]
2. [issue]: [proposed fix]

Shall I apply these fixes?
```

**Wait for user approval before writing.**

### Step 6 — Apply Fixes
Make targeted edits. Prefer the minimum change needed — don't rewrite sections that are passing.

### Step 7 — Retest
Re-run static + category checks on the updated file. If the fix touched the frontmatter `description:`, also run `bash skill-lab/run-trigger-tests.sh --skill [name]` to verify the new description scores >=18/20.

### Step 8 — Verdict
```
IMPROVED: [skill-name]
- Before: N/7 static, N/5 category, N/20 trigger
- After:  N/7 static, N/5 category, N/20 trigger
- Changes made: [list of specific edits]
```

If the retest still fails:
```
STILL FAILING: [skill-name]
- Remaining issues: [list]
- Recommendation: [what needs to change]
```

Do NOT repeatedly rewrite the same file — after 2 failed attempts, stop and surface to user.

## Rules

- Never rewrite a passing section to fix a failing one — surgical edits only
- Never remove documented behavior to make a check pass — fix the actual problem
- Always show the user what changed before writing
- If fixing requires moving gate prompts to governance-gates.md, do that in the same session
- Trigger fixes are scoped to the frontmatter `description:` line only — never rewrite the skill body to fix a trigger miss. The body doesn't affect auto-triggering.
