---
name: retrospective
description: "Run a post-milestone retrospective to capture what went well, what went wrong, and what to change. Produces a structured retro doc in AI_DOCS/retrospectives/ that feeds into future brainstorm sessions as prior-art warnings. Use at milestone close, after a production incident, or when lessons learned would prevent a future mistake. Also triggers on: 'Postmortem', 'Post-mortem', 'After action review', 'Milestone review'."
skip: [Plan milestone, Start new milestone, Implement feature]
next_skill: brainstorm
allowed-tools: "Read Write Edit Grep Glob WebSearch"
skill_id: SK-013
context_budget:
  load_kb: 30
  scope: task
version: 1.5.0
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [memory-protocol]
  optional: [milestone-planning, brainstorm, project-audit, estimation-feedback]
produces:
  - path: AI_DOCS/retrospectives/milestone-N-retro.md
    consumers: [brainstorm, milestone-planning]
consumes:
  - path: AI_DOCS/memory/metrics.jsonl
    required_sections: []
  - path: AI_DOCS/memory/decision-log.md
    required_sections: []
  - path: AI_DOCS/quality/defect-log.md
    required_sections: []
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [iterative, domain-specific]
---

# /retrospective — Milestone Retrospective

> **Purpose**: Close the learning loop. Capture what actually happened, compare with what was planned, and extract lessons that feed into the next milestone's planning.

Every project produces data about what worked. Without a retro step, that data is lost on the next project — teams repeat the same mistakes. This skill makes the loop explicit.

> [!IMPORTANT]
> **Output sizing (300-line cap).** If the retro doc would exceed ~300 lines (long milestones, multiple incidents, many action items), split `AI_DOCS/retrospectives/milestone-N-retro.md` into a folder `AI_DOCS/retrospectives/milestone-N-retro/` containing:
> - `index.md` — planned vs shipped summary, key findings, cross-links (≤300 lines)
> - one file per theme (e.g. `what-went-well.md`, `what-went-wrong.md`, `surprises.md`, `metrics.md`, `action-items.md`) — each self-contained, ≤300 lines
>
> Always split into a folder. Never create sibling files at the parent level. `/brainstorm` and `/milestone-planning` consume `index.md` first as prior-art input.

---

## When to Run

| Trigger | Timing |
|---|---|
| Milestone complete | Immediately after `/milestone-validation` passes |
| Production incident | Within 48 hours of resolution |
| Feature cancellation | At the decision point |
| Team retrospective cadence | Weekly / bi-weekly if the team runs a regular cadence |

Do **not** run this during implementation — context is too hot.

---

## Instructions

### Step 1 — Gather objective data

Read (in this order):

1. `AI_DOCS/memory/metrics.jsonl` — event stream: skill invocations, abandonment, errors, gate verdicts
2. `AI_DOCS/memory/decision-log.md` — decisions and their rationale
3. `AI_DOCS/planning/milestones/milestone-N.md` — planned scope vs. actual
4. `AI_DOCS/quality/milestone-N-report.md` (if exists) — validation results
5. `AI_DOCS/quality/defect-log.md` — every defect found since the last retro, especially rows with `Escaped? = yes` or `Prevention = pending retro`
6. `.git log --since=<milestone-start>` — commit cadence, revert frequency
7. Any incident records in `AI_DOCS/incidents/` (v3.2) — relevant if retro is incident-driven

### Step 1.5: Transcript pass (OPTIONAL, ask before running)

`metrics.jsonl` records what skills ran. It does not show where a session burned tokens, redid work, or stumbled over the same obstacle twice. The session transcripts do. Run this pass when the milestone felt slow or expensive, when the operator asks, or when Step 1 shows a high error or abandonment count. Skip it otherwise, because transcripts are large.

**Where they are:** one `.jsonl` file per session under `~/.claude/projects/<project>/` (the project folder name is the working directory path with separators turned into dashes). Pick the sessions that overlap the milestone dates by file modification time.

**How to read them (never whole):** a transcript can run to many megabytes. Use Grep with a pattern and a small `-C`, or Read with `offset` and `limit`, and keep every pull to a few hundred lines. To keep the main context lean, hand the pass to an `explorer` or `research-lead` agent and take back only the findings. Look for:

| Signal | What to search for |
|---|---|
| Cost | The largest tool results (long `tool_result` bodies, full-file reads, unscoped test output), and any session that was compacted more than once |
| Repeated work | The same file read or the same command run three or more times, and agent dispatches that re-read what an earlier dispatch already returned |
| Stumbles | Errors followed by retries, hook blocks that were hit repeatedly, the same fix attempted more than once, user corrections ("no, not that") |

**Every finding cites `path:line`:** the transcript file path and the line number of the entry that shows it (the `.jsonl` line number, which the Grep tool output provides). A finding without a citation is dropped, because the reader must be able to open the evidence. Quote at most one short line per finding and never paste transcript bodies into the retro, since transcripts can hold secrets and client data.

Fold the findings into Section 4 (what went wrong) and Section 7 (action items) of the retro. Each should end in a concrete change: a rule, a scoped-read habit, or a skill edit. Transcripts stay where they are and are never copied into `AI_DOCS/`.

### Step 2 — Synthesize the retro

Write to `AI_DOCS/retrospectives/milestone-N-retro.md`:

```markdown
# Retrospective — Milestone [N] ([Milestone Name])

**Date**: [YYYY-MM-DD]
**Scope**: [date range]
**Facilitator**: [user / agent]

## 1. What we planned

- [list of planned features / scope]
- Originally estimated: [X story points / Y weeks]

## 2. What we shipped

- [actual delivered features]
- Shipped: [X story points / Y weeks]
- Variance: [+/- %]

## 3. What went well

- [✓ bullet 1 — specific, not generic "teamwork was good"]
- [✓ bullet 2 — traceable to data (metrics.jsonl shows...)]
- [✓ bullet 3]

## 4. What went wrong

For each issue, capture: **what happened → root cause → impact → what we'd do differently**.

### Issue 1: [short title]
- **What**: [description]
- **Root cause**: [not the proximate cause — the upstream cause]
- **Impact**: [hours lost / bugs introduced / customer-facing delay]
- **Prevent next time**: [specific action, not "communicate better"]

### Issue 2: ...

## 5. Surprises

- [things we didn't anticipate, positive or negative]
- [new risks surfaced]
- [assumptions that turned out wrong]

## 6. Metrics

| Metric | Value | Trend |
|---|---|---|
| Skills invoked | [from metrics.jsonl] | [vs last milestone] |
| Skills abandoned | [count / %] | |
| Anchor-hook blocks | [count] | |
| Gate failures | [list] | |
| Total wall-clock | [hours] | |
| Planned vs actual | [variance %] | |
| Defects total (from defect-log) | [count by phase: review/regression/qa/audit/staging/production] | [vs last milestone] |
| Escaped defects | [count] | |
| Escaped-defect rate | [escaped / delivered tasks, %] — target < 1% | |

## 7. Action items

Each action item has an owner and a target date:

- [ ] [action] — owner: [name/skill] — by: [date]
- [ ] ...

## 8. Inputs for next milestone

What this retro tells `/brainstorm` and `/milestone-planning` when next milestone starts:

- **Warnings** (prior art to avoid): [bulleted list]
- **Patterns that worked** (repeat these): [bulleted list]
- **Unknowns to resolve first**: [list]

## 9. References

- Metrics snapshot: `AI_DOCS/memory/metrics-milestone-N.json`
- Related incidents: [links or paths]
- Related decisions: [entries in decision-log]
```

### Step 2.5 — Defect feedback loop (MANDATORY, the rule-update step)

This is what makes the <1% escaped-defect target reachable: every escaped defect becomes a permanent check, or it will recur.

For EACH defect-log row with `Escaped? = yes` or `Prevention = pending retro`:

1. Ask: "which rule, gate item, or grep check would have caught this BEFORE the phase where it was found?" Name a specific artifact: a row in a rules file, a /build gate pattern, a Gate 4D/5 checklist item, an acceptance-criteria template, a test the spec should have required.
2. MAKE the edit now if it is small (add the rule row, the grep pattern, the checklist item) — do not defer one-line prevention to a backlog.
3. If the edit is structural (new skill behavior, new hook), create an action item in section 7 with owner + date.
4. Stamp the defect row's `Prevention` column with what was changed (file + one line) or the action-item reference. No row may leave the retro still saying `pending retro`.

A retro that reports escaped defects but changes no rule, gate, or check is incomplete — the loop is the deliverable, not the document.

### Step 3 — Feed future skills

After writing the retro, update `AI_DOCS/memory/prior-art-warnings.md` (create if absent). This file is read by `/brainstorm` at the start of every new ideation:

```markdown
# Prior-Art Warnings

Extracted from retrospectives. `/brainstorm` reads this to avoid repeating known pitfalls.

## From Milestone [N] retro ([date])

- ⚠ [warning 1 — one-liner]
- ⚠ [warning 2]
```

Keep each warning to one line. The detail is in the source retro.

### Step 3.5: Record estimate vs actual hours

If this milestone or project was estimated (an `AI_DOCS/estimation/estimation-v<N>.json` exists), add a short table to the retro: per role (UI/UX, Frontend, Backend, AI, Mobile, DevOps, QA, PM), the estimate's Approved hours for this milestone beside the actual hours, and the features that ran more than 25 percent over with the reason. Section 2 (planned vs shipped) already has the variance. The next estimate's independent review reads these retros, so this is how estimates improve. Skipping actuals capture is the most common reason they never do.

---

### Step 4 — Announce

Print a concise summary for the user:

```
Retrospective captured for Milestone [N].
Saved to: AI_DOCS/retrospectives/milestone-N-retro.md

Top 3 action items:
  1. [...]
  2. [...]
  3. [...]

Prior-art warnings added to: AI_DOCS/memory/prior-art-warnings.md
```

---

## Examples

### Example 1: Milestone close retro

**User says:** "run a retro on milestone 2"

**Actions:**

1. Read metrics.jsonl for milestone 2 date range
2. Read milestone-2.md planned vs shipped
3. Identify 3 things that went well, 3 issues with root causes
4. Write retrospective doc
5. Update prior-art-warnings.md

**Result:** Structured retro saved; warnings flagged for next milestone.

### Example 2: Incident-driven retro

**User says:** "we had a prod incident yesterday — let's retro it"

**Actions:**

1. Ask user for incident details (time, duration, root cause, customer impact)
2. Cross-reference with decision-log + recent commits
3. Focus the retro on one issue + prevention measures
4. Update prior-art-warnings with the specific pattern to avoid
5. Suggest immediate action items (e.g., add monitoring, add test case)

---

## Troubleshooting

### Retro is too generic ("we should communicate better")

**Cause:** not grounded in objective data.

**Solution:** every bullet in sections 3–5 must cite a metrics.jsonl event, a decision-log entry, or a git commit. Reject vague claims.

### Too many action items (>8)

**Cause:** trying to fix everything at once.

**Solution:** prioritize top 3–5. Move the rest to `AI_DOCS/backlog/retro-actions.md` for future consideration.

### Retro becomes blame session

**Cause:** framing focuses on who, not what.

**Solution:** every issue must go through the "root cause" framework. If the root cause is "X person didn't do Y," the real root cause is upstream (no process, no review, no tooling).

---

## Rules

1. One retro per milestone, one retro per incident. No combined retros.
2. Action items are written with owner + date. "TBD" owners = not an action item.
3. Retro docs are committed to git (reviewable by team).
4. Prior-art warnings are one-liners only — detail lives in source retros.
5. Retros reference evidence (metrics, commits, decisions) — never unsupported opinion.
<!-- Version: 1.4.0 | 2026-10-14 | Step 3.5 records estimate vs actual hours per role in the retro (estimation v6 has no calibration store). -->
<!-- Version: 1.5.0 | 2026-10-22 | Step 1.5 optional transcript pass: read session .jsonl transcripts under ~/.claude/projects/<project>/ with Grep or offset/limit for cost, repeated work and stumbles, every finding cites path:line. Idea from obra/superpowers diagnosing-superpowers. -->
