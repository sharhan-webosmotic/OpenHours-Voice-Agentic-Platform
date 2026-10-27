---
name: skill-curator
description: "Grade and audit the ADF skill library. Reads catalog.yaml and metrics.jsonl, grades every skill as HEALTHY/NEEDS_IMPROVEMENT/STALE/REDUNDANT, and writes AI_DOCS/memory/curator-report.md. Triggers on: 'audit skill library', 'grade skills', 'check skill quality', 'run skill curator', 'which skills need improvement', 'find stale skills', 'find duplicate skills', 'skill health check'."
next_skill: skill-improve
required_gate: null
skill_id: SK-138
context_budget:
  load_kb: 50
  scope: session
version: 1.0.2
dependencies:
  required: []
  optional: [skill-improve, skill-test]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: framework
  user_facing: true
---

# Skill Curator

> **Purpose**: Grade the ADF skill library and produce an improvement roadmap
> **Audience**: Framework maintainer / team lead
> **Trigger**: User wants to audit skill quality or find underperforming/stale skills

---

## What this skill does

1. Reads `skill-lab/catalog.yaml` (trigger scores, spec status, priority for all skills)
2. Reads last 500 lines of `AI_DOCS/memory/metrics.jsonl` (invocation frequency, if available)
3. Spawns the `skill-curator` agent to grade each skill
4. Agent writes `AI_DOCS/memory/curator-report.md` (structured report)
5. Displays summary to user
6. Offers to run `/skill-improve` on the top-priority failing skill

---

## Step-by-step

### Step 1: Load catalog data

Read `.claude/skill-lab/catalog.yaml`. Extract for each skill:
- `id`, `name`, `category`
- `trigger_status`, `trigger_last_score`, `trigger_last_run`
- `spec_status`, `priority`
- `invocation_count`, `last_invoked` (if present — added in v4.0)

### Step 2: Load invocation data

Read last 500 lines of `AI_DOCS/memory/metrics.jsonl` (if it exists).
Filter for `"event":"skill_invoked"` entries.
Build a frequency map: `{ skill_name: count }`.

### Step 3: Spawn skill-curator agent

Invoke the `skill-curator` agent with:
- The full catalog YAML content (read `.claude/skill-lab/catalog.yaml`)
- The invocation frequency summary
- Today's date (for the 90-day staleness calculation)

The agent will write `AI_DOCS/memory/curator-report.md` directly.

### Step 4: Parse and display summary

Read `AI_DOCS/memory/curator-report.md` and extract the `## Summary` table.
Display to the user:

```
Skill Curator Report — YYYY-MM-DD
  Healthy:            N skills
  Needs improvement:  N skills
  Stale:              N skills
  Redundant pairs:    N

Top priority: SK-NNN <name> (score X/20) — <issue>
```

### Step 5: Offer to improve

If there are NEEDS_IMPROVEMENT or STALE skills, offer:
"Run `/skill-improve <top-failing-skill>` to fix the highest-priority issue?"

---

## When the skill-curator agent is unavailable

If the agent cannot be spawned, fall back to a simpler in-context analysis:
1. Read catalog.yaml
2. Count skills by grade using the rubric (HEALTHY/NEEDS_IMPROVEMENT/STALE)
3. Write a minimal curator-report.md
4. Note "Agent unavailable — simplified report (no redundancy analysis)"

---

Skill skill-curator complete. Memory updated.
Checkpoint: AI_DOCS/memory/curator-report.md, safe to compact.
