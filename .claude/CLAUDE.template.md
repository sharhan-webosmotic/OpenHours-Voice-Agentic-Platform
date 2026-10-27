<!-- adf-version: 4.28.0 -->
# App Development Framework (ADF): project layer

> Version: 4.28.0. The framework's operating rules live in `.claude/CLAUDE.md`, which Claude Code loads with this file: single `/do` interface, routing, compaction recovery, capsule loading, memory essentials, gates, safety and compaction instructions. This file adds only what is specific to working in a project. Full file map: `.claude/docs/memory-map.md`.

---

## Using `/do`

```
/do build me a small URL shortener with stats
/do                                # resumes whatever's in flight
/do status                         # task-ledger summary, no side-effects
/do audit                          # secrets + CVEs + a11y + OWASP (compliance projects)
/do ship                           # /audit then deploy
/do checkpoint                     # thorough session-state.md before compaction
/do switch-stack <frontend>        # change frontend, regenerate active-skills.md
```

`/do` reads `AI_DOCS/` state and dispatches every other skill itself. It asks only at milestone boundaries or true blockers. Full skill list: `.claude/skills/SKILL-REFERENCE.md`.

---

## Agents and models (cost policy, v4.28.0)

`/do` dispatches domain **leads** (`frontend-lead`, `backend-lead`, `quality-lead`, `design-lead`, `research-lead`) that plan in isolated context and never edit. The governed **`builder`** applies a lead's plan, and the same PreToolUse hooks enforce every edit inside it. **Tier-1 authorities** (`solutions-architect`, `product-director`, `engineering-lead`, `qa-lead`, `data-architect`, `sre-reliability`, `compliance-officer`) and reviewers return APPROVE / CONCERNS / REJECT.

**The session model plans and validates. Cheaper models execute.**
- Haiku: `explorer`, the project `Explore` override, `skill-curator` (lookup and grading).
- Sonnet: `builder`, `test-writer`, `research-lead`, the `cq-*` scanners, `ap-data-reconciler`, `api-validator`, `component-inspector`, and the platform specialists (they execute a plan or scan a checklist).
- Session model (no tag): every lead, Tier-1 authority, `code-reviewer`, `security-auditor`, `principal-designer`, `ux-advisor`, `report-editor` and the other judgment roles. Anything a cheaper agent produces is validated by the session model before it counts.
- Skills never carry `model:`. Switching the main conversation's model rebuilds its prompt cache, so delegate to an agent instead.
- Effort: default `high`. Planning and review skills carry `effort: xhigh`, and mechanical skills carry `effort: medium`.
- Long test or build output goes through `bash .claude/scripts/quiet-run.sh <command>`, which prints failures and summaries only and keeps the full log in `AI_DOCS/.temp/quiet-run/`.

---

## Hooks Active in This Project

47 lifecycle hooks live in `.claude/hooks/`, wired via `settings.json` (source of truth for the event map: `settings.template.json`; per-hook detail lives in each script's header). The families:

- **Blocking gates (PreToolUse)**: `/do` routing, single-AI_DOCS, api-contract lock, chunk scope, shell + artifact locks, design gate, flow gate (`enforce-flow-gate.sh`, Gate FLOW), infra-cost gate, ship gate, MAVS merge gate, destructive-git block.
- **Memory + telemetry**: pre-compact snapshot, user-prompt log, task-ledger writer, session-state refresher, agent audit trail, skill-invoke log.
- **Advisory scans**: drift-detector (24h, Phase A/D findings block builds), style-check, memory-curator, detect-gaps, vertical-slice and milestone-order checks.
- **Notifications**: cross-platform toast (`notify.sh`), opt out with `ADF_NOTIFY_DISABLED=1`.

Escapes (each MUST be logged in `decision-log.md`): `ADF_BYPASS`, `ADF_INFRA_APPROVED`, `ADF_SHIP_OVERRIDE`, `ADF_SKIP_MAVS`, `ADF_ALLOW_NESTED_AIDOCS`, `ADF_FLOW_GATE_BYPASS` (same-day decision-log entry required), `CHUNK_SCOPE_ENFORCE=off`. For `ADF_BYPASS` and `ADF_FLOW_GATE_BYPASS` the dated `decision-log.md` entry is what the hooks read, so no variable is needed. The other escapes are environment variables: an `export` inside a session does not reach the hooks, so set them in the `env` block of `.claude/settings.local.json` and restart the session.

---

## Production-Grade Design (Always Active)

Every task with a UI surface ships expert, production-grade design, not "a button that renders." Plain-but-functional UI is a defect, the same as broken code.

First-class, enforced on every UI task:
- Placement and visual hierarchy: one dominant element per view, scannable reading order, primary action obvious.
- Spacing rhythm: one step per relationship, intentional whitespace, no cramped or arbitrarily-gapped layouts.
- Alignment: shared edges and a grid, optical alignment where math looks off, numerics right-aligned.
- Responsive density: correct density across 375/768/1024/1440/1920, not just no-overflow reflow.
- Surface and elevation, contrast, semantic color axes, and uniform UI across the whole milestone.

Full enforceable standard: `rules/design-rules.md` → "Layout craft", plus `rules/frontend-rules.md` and `rules/ui-engineering-rules.md`. Enforced by the `component-inspector` agent (static signals), the `principal-designer` agent (rendered-craft verdict), and the milestone design/accessibility gate.

---

## Cost guards (always active)

- `/ai-cost-guard` before any LLM API integration, with the approval in `AI_DOCS/memory/ai-cost-approvals.md` (`.claude/rules/ai-safety-rules.md`).
- `/infra-cost-guard` before provisioning or resizing cloud resources, with a same-day approval in `AI_DOCS/memory/infra-cost-approvals.md` (`.claude/rules/infrastructure-rules.md`).
- External operations need a warning and an explicit yes (`.claude/rules/ops-safety-rules.md`).
