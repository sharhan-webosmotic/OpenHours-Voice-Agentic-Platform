---
paths:
  - "AI_DOCS/quality/framework-feedback.md"
  - "AI_DOCS/quality/defect-log.md"
---

# Self-Improvement Rules

> Loaded during `/retrospective`, maintenance reviews, and any framework-improvement work.
> Governs how learnings from USING ADF on a project flow back into the shared framework so it
> gets better for every project, WITHOUT one project ever degrading another.
> The operating agent is `learning-curator`; the capture file is `AI_DOCS/quality/framework-feedback.md`.

## Rule 1: The framework is never auto-edited from a project session

A project session writes ONLY to `AI_DOCS/` (already hook-enforced by `enforce-single-aidocs` and the `/do` boundary). It must NEVER edit or commit to the shared `.claude/rules`, `.claude/agents`, or `.claude/skills`. Improving the framework is a separate, deliberate, human-approved action. Auto-editing shared code from inside a project is the one thing this system exists to prevent.

## Rule 2: Capture the pattern, never the instance

Learnings are recorded in `AI_DOCS/quality/framework-feedback.md` as GENERIC, project-agnostic candidates. Strip client names, exact values, project-specific paths, and any regulated or private data. A candidate that only makes sense for one project is not framework-worthy. Record the reusable pattern and the fix, not the incident.

## Rule 3: The pipeline is capture then generalize then human-gate then promote

1. **Capture** (during work): a recurring bug class, a design-taste pattern, a seeding gap, or agent/skill friction is written as a generic candidate. `/retrospective` converts each escaped defect in `defect-log.md` into a candidate (its Prevention column).
2. **Generalize** (curator): the `learning-curator` agent abstracts each candidate, strips project specifics, dedupes against the existing framework, and finds the smallest correct target.
3. **Human-gate**: the curator returns a promotion PROPOSAL (described diffs + blast radius). A human reviews it. The curator never applies it.
4. **Promote** (human): the approved changes are applied to the shared framework deliberately, with a version bump per `skill-versioning-rules` and one `UPGRADING.md` line. Other projects receive them on the next `git pull` / `upgrade.sh` sync.

## Rule 4: Only promote what generalizes

A change is promotable only if it helps essentially every project (or a clearly-named class of projects). A dense-fintech-dashboard taste must not become a rule that fights an airy consumer app. If a learning is shape-specific, gate it behind an existing project-classification switch rather than making it a blanket rule. The curator flags blast radius; the human decides.

## Rule 5: Cross-project registry is generic-only

The `~/.adf/shared/` registry (maintained by `shared-memory-sync.sh` from `[SHARED]`-tagged decisions) carries only generic, cross-project learnings, never project data. It is a convenience index for the curator, not a channel that moves project specifics between projects.

## Rule 6: Prefer extending an existing artifact

When a learning is a near-match to an existing rule, agent, or check, extend that artifact with a small change rather than adding a new one. The framework gets sharper, not bigger. New skills/agents are added only when no existing artifact fits (conservative skill/agent growth).

## Verification (what a framework-improvement review checks)

- Every promoted change traces to a generalized `framework-feedback.md` candidate (or a `defect-log.md` escaped defect), not a raw project incident.
- No project-specific value (client name, exact hex, project path) appears in a promoted rule/agent/skill.
- Each promotion has a version bump and an `UPGRADING.md` note.
- No project session edited or committed to `.claude/` shared code.

<!-- Version: 1.0.0 — 2026-07-02 — initial: cross-project self-improvement loop (capture/generalize/human-gate/promote), isolation-guaranteed -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
