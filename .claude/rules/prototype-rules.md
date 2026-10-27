---
description: "Prototype and spike isolation rules. Prevents throwaway code from leaking into production."
paths: ["spikes/**", "prototypes/**", "poc/**", "experiments/**"]
---

# Prototype & Spike Isolation Rules

Prototypes, spikes, and POCs are valuable for learning — but they have a documented history of leaking into production codebases and becoming permanent. These rules prevent that.

## Core Rule: Isolation

All spike / POC / experimental code MUST live in one of:
- `/spikes/[name]/`
- `/prototypes/[name]/`
- `/poc/[name]/`
- `/experiments/[name]/`

**No exceptions.** If it starts as a spike, it must be in one of these folders. If it graduates to production, it is REWRITTEN in `src/` — not moved.

## Time-Boxing

Every spike must have a time-box declared in its `README.md`:

```markdown
# Spike: [name]
Time-box: [N days — max 5 for a sprint spike]
Goal: [specific question this spike answers]
Decision by: [date]
Owner: [who runs this spike]
```

If the time-box expires without a decision, the spike is automatically DELETED.

## Merge Prohibition

**Spike code MUST NEVER be merged to `main` or `develop`.**

The purpose of a spike is to answer a question. The answer to the question is documented. The spike code is then deleted.

If the approach is validated, the production implementation is written from scratch in `src/` following all production rules, not ported from the spike.

## Import Prohibition

**Production code (`src/`, `app/`, `lib/`, `pages/`) MUST NEVER import from spike folders.**

If a reviewer finds:
```typescript
import { something } from '../../spikes/my-idea/utils'
```
This is a CRITICAL violation. Reject the PR immediately.

## No Production Patterns Required

Inside spike folders, the following production rules are SUSPENDED:
- API contract compliance
- Component registry requirements
- CI/CD pipeline requirements

Inside spike folders, these rules STILL APPLY:
- Test coverage: the framework floor of minimum 98% on lines, branches, and functions applies even in spike folders (no coverage exemption)
- No hardcoded production credentials
- No calls to production databases
- No `git push` of secrets

## Decision Output

Every spike ends with one of:
1. **ADOPT** — Write the production implementation from scratch in `src/`. Delete the spike.
2. **DISCARD** — The approach doesn't work. Document why. Delete the spike.
3. **EXTEND** — Need more time. Re-set time-box (max one extension). Must have engineering-lead approval.

Document the outcome in `AI_DOCS/architecture/` as an ADR or decision note.

## Cleanup

Spike directories older than 30 days with no activity are automatically candidates for deletion.
Run `/project-audit` to find stale spikes.

<!-- Version: 1.1.0 — 2026-07-07 — removed the test-coverage exemption for spike folders: the framework-wide 98% floor (lines, branches, functions) now applies everywhere, including spikes. API-contract/component-registry/CI suspensions unchanged. -->
