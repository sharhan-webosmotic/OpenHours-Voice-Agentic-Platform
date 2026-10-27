# Framework Feedback (generalized improvement candidates)

> Project-local capture of GENERIC learnings that could make ADF better for EVERY project.
> Scaffolded per project at `AI_DOCS/quality/framework-feedback.md`. This file NEVER leaves the project on its own.
> The `learning-curator` agent reads it, abstracts each row further, strips anything project-specific, and produces a promotion proposal for human review. Nothing here is auto-committed to the shared framework.

## The one rule: record the pattern, never the instance

Each row must be a generic, reusable learning. Strip client names, exact values, file paths specific to this project, and any regulated or private data. If a row only makes sense for this one project, it does not belong here.

| Bad (project-specific, do NOT record) | Good (generic, promotable) |
|---|---|
| "Acme dashboard primary is #1E40AF" | "Border-only cards read as flat: enforce surface-differentiation" |
| "The invoices list N+1'd on line 88" | "List endpoints keep shipping N+1s: strengthen the code-reviewer smell catalog" |
| "Forgot seed data for the orders demo" | "Entity-producing features shipping without seed data: vertical-slice-check gap" |

## Candidates

| ID | Date | Category | Generic learning (pattern, not instance) | Evidence class | Proposed target | Status |
|----|------|----------|------------------------------------------|----------------|-----------------|--------|
| FB-001 | YYYY-MM-DD | design-taste / recurring-bug / seeding / agent-friction / skill-friction / rule-gap | one line, generic | review-reject / regression / qa / audit / design-QA / operator-note | rule:`X` \| agent:`Y` \| skill:`Z` \| new | open / curated / promoted / rejected |

## Categories (what to watch for while working)

- **design-taste**: a design pattern that repeatedly reads as junior/flat/inconsistent, and the craft move that fixes it (generalize to a design-rule or the principal-designer heuristics).
- **recurring-bug**: a bug CLASS that shows up across tasks (not a single bug). Generalize to a code-reviewer smell, a verify-battery check, or a rule.
- **seeding**: a data-seeding or fixture gap that broke demos/E2E. Generalize to the vertical-slice or mock-data discipline.
- **agent-friction / skill-friction**: an agent or skill that consistently under-delivers, over-flags, or is dispatched wrongly. Generalize to a prompt/description fix.
- **rule-gap**: a situation the rules did not cover that caused rework.

## Isolation guarantee

Project sessions write ONLY here (under `AI_DOCS/`). Promotion to the shared framework (`.claude/rules|agents|skills`) is a separate, human-approved action, never an auto-commit from a project session. See `rules/self-improvement-rules.md`.
