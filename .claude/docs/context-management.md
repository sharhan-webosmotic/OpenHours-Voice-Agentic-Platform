# Context Management Protocol
> ADF v3.0 | Critical reading — follow this whenever working on any non-trivial task.

---

## The Core Principle: File is Memory, Not Conversation

Claude Code sessions can be compacted or lost at any time. The conversation is ephemeral. **Only files on disk persist.** Every decision, approval, gate result, and WIP state must be written to `AI_DOCS/memory/` immediately — not held in conversation.

---

## Session State File

**Canonical path**: `AI_DOCS/memory/session-state.md`

This file is the single source of truth for resuming any session. Keep it current. Write to it:
- At the start of any significant work block
- Before deliberately compacting
- Before ending a session
- After any gate verdict

**Template**:
```markdown
# Session State — [date]

## Current Phase
[discovery | specification | design | implementation | testing | deployment | maintenance]

## Active Milestone
[milestone name and number]

## Active Task
[what is being worked on right now]

## Gate Status
- Gate 0 (Project Charter): [APPROVED / PENDING / NOT STARTED]
- Gate 1 (Tech Spec + API Lock): [APPROVED / PENDING / NOT STARTED]
- Gate 1.5 (Code Quality): [APPROVED / PENDING / NOT STARTED]
- Gate 2 (Design System): [APPROVED / PENDING / NOT STARTED]
- Gate 3 (Alpha Ready): [APPROVED / PENDING / NOT STARTED]
- Gate 4 (Beta Ready): [APPROVED / PENDING / NOT STARTED]
- Gate 5 (Production Ready): [APPROVED / PENDING / NOT STARTED]

## Last Decision Made
[What was decided and why]

## WIP / Blocked
[Any work in progress or blockers]

## Next Action
[The very next thing to do when this session resumes]
```

---

## Implementation Anchor Pattern

> [!CRITICAL]
> The #1 cause of context drift is starting to code without re-reading the plan. Sessions are long. The plan written at the start is forgotten by the 10th file edit. The Implementation Anchor prevents this.

Before implementing ANY chunk or feature, take 30 seconds to re-read:

```
1. The specific chunk/feature definition from AI_DOCS/planning/tasks/active-task.md
   → What file? What exact change? What verification?

2. The relevant spec section from AI_DOCS/planning/tech-spec.md
   → What does "correct" look like per the spec?

3. The relevant API contract from AI_DOCS/architecture/api-contract.md
   → What endpoint? What request body? What response shape?
```

If any of those reads changes what you were about to code → you saved yourself a broken feature. The anchor works.

### Context Loss Warning Signs

Stop and re-anchor immediately if you notice:
- Implementing something not explicitly in the plan
- Skipping a step "because it seems obvious"
- Writing `// TODO` or placeholder code
- Not knowing which API endpoint to call
- Copy-pasting a component instead of checking `component-registry.md`
- Running no verification before marking complete

---

## Context Budget Tiers

| Task Type | Max Tokens | Strategy |
|-----------|-----------|---------|
| Bug fix, small edit, quick question | 3k | Inline — use task-planner for tracking |
| Single feature implementation, spec section | 8k | Normal session — task-planner tracks chunks |
| Full milestone delivery, architecture review | 15k | Use **subagent** (fork context) + feature-delivery skill |
| Cross-system refactor, full project audit | 20k+ | Subagent + incremental file writes + task-planner |

When a task exceeds its budget tier, delegate to a subagent via `Agent(Explore)` or `Agent(Plan)`.

---

## Proactive Compaction Triggers

**Do NOT wait until forced.** Compact proactively when:
- Context reaches 60–70% capacity
- About to start a heavy task (full audit, full spec authoring)
- After completing a major phase (all gate docs written, all milestones planned)
- After a long code review or security scan

**Before compacting**:
1. Write `AI_DOCS/memory/session-state.md` with current state
2. Write any in-progress spec sections to their files
3. Commit any AI_DOCS changes to git if appropriate

---

## Incremental File Writing Protocol

For large documents (tech specs, design systems, full audits):

1. **Write the skeleton first** — all section headings, empty content
2. **Work section by section** — complete one section, write it, move to next
3. **Compact after every 3–4 sections** if context is growing
4. **Never hold large content in context** — write it to the file, then move on

This prevents the worst failure mode: spending 10k tokens authoring a doc, then losing it to compaction before writing the file.

---

## Subagent Delegation Strategy

Use subagents (via the `Agent` tool) for:
- **Exploration** — reading and analyzing large codebases (keeps main context clean)
- **Heavy synthesis** — cross-file audits, full security scans, full spec authoring
- **Parallel work** — run multiple independent reviews simultaneously

Do NOT use subagents for:
- Simple file reads you can do directly
- Quick edits
- Single-file work

---

## Recovery Protocol After Compaction or Session Close

1. Check `AI_DOCS/planning/tasks/active-task.md` — is there an unfinished task?
   - If YES: read it, find first unchecked chunk, resume from there
2. Read `AI_DOCS/memory/session-state.md` — current phase and next action
3. Read `AI_DOCS/memory/gate-status.md` — gate approvals still valid
4. Read `AI_DOCS/memory/task.md` — milestone task list
5. Run `/session-management` (restore mode) to rehydrate full context
6. Continue from the "Next Action" field in session-state.md

> The `active-task.md` file is the fastest recovery path. It contains the exact chunk-level state of what was in progress — more precise than session-state.md for implementation work.

---

## What the Compaction Summary Must Preserve

When Claude Code summarizes the conversation, the summary must include:
- Current SDLC phase + active milestone
- Last gate status (gate number + verdict)
- Active task and WIP state
- Key decisions made (tech stack, scope, architecture)
- Which skills were run and their outcomes
- Any BLOCKED or WIP markers

The summary must drop: tool call details, full file content reads, routine confirmations.
