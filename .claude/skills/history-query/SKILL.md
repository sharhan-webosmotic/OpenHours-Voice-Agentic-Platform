---
name: history-query
description: "Search cross-session project history: decisions, tasks, gate verdicts, via the SQLite state database. Triggers on: 'search history', 'what did we decide about', 'find past decisions', 'search old decisions', 'history query', 'query decisions', 'look up past tasks', 'find when we decided', 'show gate verdicts', 'project stats', 'show analytics'."
effort: medium
next_skill: null
required_gate: null
skill_id: SK-141
context_budget:
  load_kb: 5
  scope: session
version: 1.0.4
dependencies:
  required: []
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: utility
  user_facing: true
---

# History Query

> **Purpose**: Search project history across sessions using the SQLite state database
> **Audience**: End user
> **Trigger**: User wants to find past decisions, tasks, or project analytics

---

## What this skill does

Queries `~/.adf/projects/{project-id}/state.db` (the SQLite state index) using FTS5 full-text search. Returns results from decisions and tasks without loading markdown files into context.

This works even after context compaction — the SQLite database retains full history.

## Step-by-step

### Semantic search (user asks "what did we decide about X?")

1. Extract the search terms from the user's question
2. Run: `python .claude/state/db.py query "<search terms>"`
3. Display the output
4. If no results: "No matching decisions found. The SQLite index may be empty — check `AI_DOCS/memory/decision-log.md` directly."

### Stats / analytics (user asks "show project stats" or "how many tasks?")

1. Run: `python .claude/state/db.py stats`
2. Display the output

### Export (user asks "export this session" or "dump decisions as JSON")

1. Run: `python .claude/state/db.py export-session`
2. Display or save the JSON output

## When state.db doesn't exist yet

If db.py returns an error about missing database:
1. Explain: "The SQLite state database hasn't been initialized yet. Run `python .claude/state/db.py init` to create it."
2. Suggest: "For now, search `AI_DOCS/memory/decision-log.md` directly."

## Example queries

- `/history-query "authentication"` → finds all decisions about auth
- `/history-query "database schema"` → finds schema-related decisions
- `/history-query stats` → shows counts and top skills
- `/history-query "M01"` → finds all tasks and decisions from milestone M01

---

Skill history-query complete. Memory updated.
Checkpoint: read-only, safe to compact.

<!-- Version: 1.0.4 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
