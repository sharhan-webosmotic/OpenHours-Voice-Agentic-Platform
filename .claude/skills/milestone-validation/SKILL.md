---
name: milestone-validation
description: "Run the full-suite validation at milestone close: 17-point code quality simulation + security review + QA coverage gate + accessibility audit + performance budget check + bundle-size check. Produces a single pass/fail verdict per milestone. Replaces per-feature heavy validation. Use at milestone completion or before promoting to a release branch. Also triggers on: 'Validate milestone', 'Close milestone', 'Milestone gate', 'Milestone validation', 'Full validation', 'Release readiness check', 'Gate 4.5'."
skip: [Validate single feature, Quick check, Lint only]
next_skill: gate-enforcement
budget_critical: true
allowed-tools: "Read Grep Glob Bash(npm:*) Bash(npx:*) Bash(pytest:*) Bash(playwright:*) Task"
skill_id: SK-015
context_budget:
  load_kb: 30
  scope: global
version: 1.12.3
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [memory-protocol, code-quality, audit, qa-testing, accessibility-audit]
  optional: [gate-enforcement, e2e-testing]
produces:
  - path: AI_DOCS/quality/milestone-N-validation-report.md
    consumers: [gate-enforcement, retrospective]
consumes:
  - path: AI_DOCS/milestones/M<NN>-<slug>/capsule.md
    required_sections: [scope, done-criteria]
  - path: AI_DOCS/memory/gate-status.md
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [sequential, domain-specific]
  gate: "Gate 4.5 — Milestone Validation"
---

# /milestone-validation — Milestone Close Gate

> **Purpose**: One heavy validation pass at milestone close, not N per feature. Ships the milestone-level gate that collapses multiple per-feature checks into a single reviewable verdict.

Replaces the prior practice of running the 17-point SonarQube simulation, security auditor, and coverage gate after every feature. Per-feature work keeps only the fast inline checks (lint + typecheck + unit tests); the heavy passes move here.

> [!IMPORTANT]
> **Output sizing (300-line cap).** If the validation report would exceed ~300 lines (common when merging four parallel validator outputs), split `AI_DOCS/quality/milestone-N-validation-report.md` into a folder `AI_DOCS/quality/milestone-N-validation-report/` containing:
> - `index.md` — pass/fail verdict, blocking-issue summary, sign-off checklist, cross-links (≤300 lines)
> - one file per validator (e.g. `code-quality.md`, `security.md`, `qa-coverage.md`, `accessibility.md`, `performance.md`) — each self-contained, ≤300 lines
>
> Always split into a folder. Never create sibling files at the parent level. `/do` Phase 3, `gate-enforcement` and `/retrospective` consume `index.md` first.

---

## MAVS suite orchestration (machine-checked gate, BLOCKING)

milestone-validation is the MAVS orchestrator at milestone close. The PASS/FAIL verdict is PARSED from test-runner reports by `hooks/mavs-gate.sh`, never asserted in prose. The old self-attested `e2e-result.md` "Verdict: PASS" string is retired.

### Parallel fan-out (the validators are independent)

Run the relevant validator suite as a PARALLEL fan-out, not in sequence. Each validator regenerates its own `AI_DOCS/quality/mavs/<validator>.json` against the current commit, reads different inputs, and writes a different report, so they have no ordering dependency. Wall-clock is the SLOWEST single validator, not the sum.

**Capped fan-out (machine-aware, do NOT over-spawn):** before dispatching, read the host's caps once:

```bash
eval "$(bash .claude/scripts/agent-capacity.sh)"   # -> LIGHT_CAP, HEAVY_CAP for THIS host
```

Most MAVS validators are HEAVY (e2e/webapp/ui/fidelity launch a headed Chrome, schema-validation a throwaway DB, api-conformance/auth a running app), so dispatch them in waves of at most `HEAVY_CAP` concurrent agents and start the next as each finishes. Pure-static validators (qa traceability join, security greps) are LIGHT and may run up to `LIGHT_CAP`. On a low-RAM host `HEAVY_CAP` may be 1-2, so the suite runs in several small waves rather than all at once: that is correct, an over-spawn of headed browsers + DBs would exhaust memory and stall the host. See `docs/coordination-rules.md`.

The full validator set and who produces each report:

| Validator | Report | Producer | Applies to |
|---|---|---|---|
| `qa` | `mavs/qa.json` | `qa-testing` | always |
| `traceability` | `mavs/traceability.json` | `qa-testing` (req -> passing-test join) | always |
| `authz` | `mavs/authz.json` | `authz-matrix` (API + Playwright UI + dynamic two-actor permission-change + IDOR/CSRF/refresh chains; 100% role x action x field coverage; three-state PASS/LEAK/INCONCLUSIVE, a LEAK blocks. HEAVY: the UI uses headed Chrome and the dynamic flow TWO headed contexts, obeys `HEAVY_CAP`) | any roles |
| `schema` | `mavs/schema.json` | `schema-validation` | database |
| `api` | `mavs/api.json` | `api-conformance` | API |
| `auth` | `mavs/auth.json` | `e2e-testing` auth suite | auth |
| `e2e` | `mavs/e2e.json` | `e2e-testing` | frontend |
| `a11y` | `mavs/a11y.json` | `accessibility-audit` | frontend |
| `ui` | `mavs/ui.json` | `e2e-testing` (geometry dump -> 6 measured craft sub-checks) | frontend |
| `responsive` | `mavs/responsive.json` | `e2e-testing` responsive sweep (mechanical all-device battery at 375/768/1024/1440/1920 + the 375 touch interaction lane; FAIL on functional-severity findings; also produces the geometry dumps) | frontend |
| `fidelity` | `mavs/fidelity.json` | `e2e-testing` (rendered structure vs design reference + locked-shell composition) | frontend with design screens |
| `visual` | `mavs/visual.json` | `build` Exercise gate (per-task, appended throughout the milestone) consolidated here + `e2e-testing`'s full 5-width sweep (screenshots to `AI_DOCS/quality/visual/milestone-close/`): screenshots judged against `AI_DOCS/design/design-standards-checklist.md` by `component-inspector` (mechanical rows) + `principal-designer` (visual rows), findings cite `DSC-NN` ids. FAIL on any confirmed BLOCKING checklist violation | frontend, required for web |
| `slop` | `mavs/slop.json` | per-task entries from `build`'s Exercise gate consolidated here + a full `npx impeccable detect --json` over the web app source at close (deterministic anti-pattern detector, findings carry the impeccable rule id + file). Advisory: never blocks, not listed in required.txt, top-level status capped at ADVISORY while findings exist, per `docs/mavs-report-schema.md` | frontend with `skills/impeccable/` installed |
| `security` | `mavs/security.json` | `audit` (or `team-security` for compliance) | always |
| `behavior` | `mavs/behavior.json` | `qa-testing` (pagination / search / filter at API + Playwright UI; cache hit/miss/invalidation) against the 10k-row fixture | any list endpoint or list screen |
| `perf` | `mavs/perf.json` | `e2e-testing` (bundle size per route + Core Web Vitals + API p95 vs budget) | frontend (CWV is headed Chrome, HEAVY) |
| `python-test` | `mavs/python-test.json` | `python-testing` (pytest, parsed from `--junitxml`) | Python backend |
| `go-test` | `mavs/go-test.json` | `go-testing` (`go test -race -json`, parsed) | Go backend |
| `fast-validate` | `mavs/fast-validate.json` | re-run lint/typecheck here | always |

The geometry dump (`mavs/geometry.<width>.json` at 375/768/1024/1440/1920) is the shared data artifact the `ui` + `fidelity` validators and `principal-designer` read. It is not a verdict report and `mavs-gate.sh` ignores it.

### Steps at close

1. Fan out the applicable validators (per the table + stack); each regenerates its `mavs/<validator>.json` fresh, stamping `source_commit = git rev-parse HEAD` and a real `generated_at` per `docs/mavs-report-schema.md`.
2. Re-run a full lint/typecheck and write `mavs/fast-validate.json` with the current `source_commit`, so the per-edit advisory signal is authoritative at close (never falsely stale at merge).
3. Write `AI_DOCS/quality/mavs/required.txt`, one validator per line, from the stack: frontend -> `e2e`, `a11y`, `ui`, `responsive`, `perf`, `visual` (and `fidelity` when `AI_DOCS/design/screens/` reference screens exist); backend -> `api`, `schema`, `authz`, `auth`; Python backend -> also `python-test`; Go backend -> also `go-test`; any list endpoint or list screen -> `behavior`; always -> `qa`, `traceability`, `security`. (The `qa` validator is the JS/TS test report from `qa-testing`; on a backend-only Python/Go project with no JS/TS tests, the stack's `python-test`/`go-test` is the unit-test gate and `qa` records `MISSING_TOOL` rather than blocking.) A required validator with no report BLOCKS the merge.
4. A check that cannot run is recorded `MISSING_TOOL`, never `PASS` (Rule 1). `MISSING_TOOL` and `SKIP` are surfaced but do not block by themselves.
5. Write the unified human summary `AI_DOCS/quality/mavs/SUMMARY.md`: one table (validator | status | passed/failed | top finding) so the operator reviews ONE artifact at the milestone boundary. The MACHINE verdict still comes from the JSON reports via `mavs-gate.sh`, never from this summary.

The gate then blocks the promotion merge on any `FAIL` (`failed > 0`), any STALE report (`source_commit != HEAD`), or any missing required report. Escape: `ADF_SKIP_MAVS=on` + a logged decision-log entry. `/do` milestone close depends on this parsed verdict (mavs-gate green) before promoting.

---

## When to Run

| Trigger | Timing |
|---|---|
| All milestone features implemented | At milestone close, before merge to `develop` |
| Release candidate cut | Before promoting to `main` |
| User says "validate milestone" | Explicit invocation |
| `/do` Phase 3 starts | Automatic pre-flight |

Do **not** run this per-feature. Per-feature validation is the build task's own verify battery + `/code-quality --quick`.

---

## Pre-flight

Read:

1. `AI_DOCS/milestones/M<NN>-<slug>/capsule.md` and `tasks.md` for the active milestone: what was in scope and its exit criteria
2. `AI_DOCS/memory/gate-status.md` — which gates are already passed
3. `AI_DOCS/planning/tech-spec.md` — what "correct" looks like
4. `AI_DOCS/architecture/api-contract.md` — API contract baseline
5. `design-system/tokens.json` — design-system source of truth

Refuse to run if:

- No milestone is active (`AI_DOCS/memory/session-state.md` names no active milestone)
- Prior gates (0, 1, 1.5, 2, 3) are not all passed — must fix those first
- Working tree is dirty (`git status` shows changes) — commit first so artifacts are reproducible

---

## Instructions

### Phase 1 — Spawn parallel validators (run concurrently)

Dispatch the validator subagents in parallel (this is the MAVS fan-out above; each also writes its `mavs/<validator>.json`):

1. **code-quality agent** (`/code-quality --milestone`): 17-point SonarQube simulation
2. **security-auditor agent** (`/audit --comprehensive`): OWASP + secrets + dependencies + threat surface -> `mavs/security.json`
3. **qa-lead agent** (`/qa-testing --coverage-gate`): unit + integration + E2E coverage -> `mavs/qa.json` + the requirement-to-passing-test join -> `mavs/traceability.json`
4. **accessibility-auditor agent** (`/accessibility-audit --full`): WCAG 2.2 AA full audit -> `mavs/a11y.json`
5. **UI-craft + fidelity validator** (`e2e-testing`, frontend): run the responsive sweep (every delivered screen at 375/768/1024/1440/1920 + the 375 touch interaction lane driving drawer/menus/sort/filter/pagination/row-actions), which emits the geometry dump (`mavs/geometry.<width>.json` at 5 breakpoints) AND the mechanical responsive verdict -> `mavs/responsive.json`; then the 6 measured craft sub-checks -> `mavs/ui.json`, and the rendered-structure-vs-design-reference + locked-shell-composition check -> `mavs/fidelity.json`. `principal-designer` reads the dump + `ui.json` to author its craft verdict as `[Certain]`.
5b. **Visual-QA consolidation** (frontend): the responsive sweep's screenshots (written to `AI_DOCS/quality/visual/milestone-close/`) plus every per-task `AI_DOCS/quality/visual/<task-id>/` bucket the `/build` Exercise gate wrote during the milestone are judged against `AI_DOCS/design/design-standards-checklist.md` (`component-inspector` mechanical rows, `principal-designer` visual rows), and the per-task `mavs/visual.json` entries are consolidated with this full-sweep judgment into the finalized report. `FAIL` on any confirmed BLOCKING checklist row still violated; `MISSING_TOOL` only when neither Playwright nor Claude-in-Chrome was ever available during the milestone.
6. **backend validators** (per stack): `authz-matrix` -> `mavs/authz.json`, `schema-validation` -> `mavs/schema.json`, `api-conformance` -> `mavs/api.json`, `e2e-testing` auth suite -> `mavs/auth.json`

Each produces a report in `AI_DOCS/quality/` and its `mavs/<validator>.json`. Wait for all, then parse via `mavs-gate.sh` and write `mavs/SUMMARY.md`.

### Phase 1b — End-to-end suite with real auth (BLOCKING, non-POC)

The milestone does not pass without its E2E suite green. Run `e2e-testing` against the milestone's `AI_DOCS/quality/e2e-suite.md` critical flows:

- Read `AI_DOCS/quality/test-fixtures.md` — test users + mock-service config must exist. If missing, the milestone delivered no usable seed → FAIL, route to `mock-data` to seed + write fixtures.
- Run the suite headless on every declared surface: web (Playwright) and, when `platform_targets` includes a native target, mobile (Detox / Flutter integration).
- Authentication flows (including MFA/OTP/email verification via the mock service or TEST_MODE) must pass, and test-data isolation must be verified (no cross-test bleed).

Verdict: `e2e-testing` writes it to `AI_DOCS/quality/mavs/e2e.json`, and `hooks/mavs-gate.sh` parses that report at merge time. The older self-written `AI_DOCS/quality/e2e-result.md` is retired and is not read by any hook:
- **PASS**: every flow green on every surface, isolation verified.
- **FAIL**: any flow red, fixtures missing, or no isolation — name the failing flow + surface.

For `planning_depth: poc` this phase is advisory (run if a suite exists, never block). For every other project it is BLOCKING: `hooks/mavs-gate.sh` blocks the milestone → develop merge until a current `mavs/e2e.json` with status PASS exists.

### Phase 2 — Performance + bundle budget (sequential, after Phase 1)

Only if project is web-facing (check `AI_DOCS/planning/project-classification.md`):

- **Bundle size**: `npm run build` then compare dist/ size to `AI_DOCS/quality/budgets.json` thresholds
- **Lighthouse** (if available): performance ≥80, best-practices ≥90, SEO ≥80
- **Core Web Vitals**: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at p75

Skip this phase for library / CLI / backend-only projects.

### Phase 3 — Cross-cut: Contract stability

For every skill or service that changed during the milestone:

- Read `produces:` declarations from SKILL.md / service OpenAPI spec
- Compare current output against the declared schema
- Break = major version bump required

If any breaking contract change was introduced without a major version bump → **fail**.

### Phase 4 — Synthesize verdict

Tabulate results:

| Check | Source | Verdict | Blocking? |
|---|---|---|---|
| Code Quality (17pt) | `/code-quality` | [PASS/FAIL] | Yes |
| Security | `/audit` | [PASS/FAIL] | Yes |
| QA coverage | `/qa-testing` | [PASS/FAIL] | Yes |
| E2E suite (real auth) | `/e2e-testing` Phase 1b | [PASS/FAIL] | Yes (non-POC) |
| Accessibility (WCAG AA) | `/accessibility-audit` | [PASS/FAIL] | Yes for web |
| Bundle budget | build output | [PASS/FAIL] | Yes for web |
| Lighthouse | lighthouse CLI | [PASS/WARN/FAIL] | No (warning only) |
| Contract stability | AST/OpenAPI diff | [PASS/FAIL] | Yes |
| Defect density | `AI_DOCS/quality/defect-log.md` rows for this milestone | [PASS/WARN/FAIL] | FAIL on any open critical/high defect. WARN if escaped-defect rate exceeds 1% of delivered tasks (report the rate either way). |

**Overall verdict:**

- **PASS** — all blocking checks PASS
- **PASS-WITH-WARNINGS** — all blocking PASS; non-blocking has warnings
- **FAIL** — any blocking check FAIL

### Phase 5 — Produce the report

Write `AI_DOCS/quality/milestone-N-validation-report.md`:

```markdown
# Milestone [N] Validation Report

**Date**: [YYYY-MM-DD]
**Milestone**: M[N] — [name]
**Scope**: [commits / feature list]
**Verdict**: [PASS / PASS-WITH-WARNINGS / FAIL]

## Summary

| Check | Verdict | Report |
|---|---|---|
| Code Quality | [✓/✗] | [link] |
| Security | [✓/✗] | [link] |
| QA coverage | [✓/✗] | [link] |
| Accessibility | [✓/✗] | [link] |
| Bundle budget | [✓/✗] | [link] |
| Lighthouse | [✓/⚠] | [link] |
| Contract stability | [✓/✗] | [details] |
| Defect density | [✓/⚠/✗] | [N defects this milestone, M escaped, rate X% vs <1% target] |

## Blocking issues

[List every blocker with owner + path]

## Non-blocking warnings

[List warnings that should be addressed but don't block the gate]

## Sign-off checklist

- [ ] All blocking issues resolved or explicitly waived with owner + justification
- [ ] Report committed to `AI_DOCS/quality/`
- [ ] `AI_DOCS/memory/gate-status.md` updated: Gate 4.5 → PASS
- [ ] Ready to advance to `/do` Phase 3 plus `gate-enforcement` Gate 5

## References

- Milestone plan: `AI_DOCS/planning/milestone-plan.md`, and the capsule `AI_DOCS/milestones/M<NN>-<slug>/capsule.md`
- Per-check reports: `AI_DOCS/quality/milestone-N-*`
- Tech spec: `AI_DOCS/planning/tech-spec.md`
```

### Phase 6 — Update gate status + telemetry

```bash
# Update gate status
# ... edit AI_DOCS/memory/gate-status.md to set Gate 4.5 verdict

# Telemetry
bash hooks/log-event.sh "\"event\":\"gate.verdict\",\"gate\":\"G4.5\",\"milestone\":\"$MILESTONE\",\"verdict\":\"$VERDICT\""
```

### Phase 7 — Announce

```
Milestone [N] validation: [VERDICT]

Report: AI_DOCS/quality/milestone-N-validation-report.md

[If PASS]   Gate 4.5 PASSED. Next: /do Phase 3 plus gate-enforcement Gate 5
[If FAIL]   Gate 4.5 FAILED. Fix blockers listed in report before retrying.
```

---

## Examples

### Example 1: Green milestone

**User says:** "validate milestone 2"

**Actions:**

1. Read milestone-2.md — 8 features, all marked complete
2. Spawn 4 parallel validators
3. Bundle check: 512KB vs. 600KB budget → PASS
4. Lighthouse: 84/95/82 → PASS with warnings (SEO could improve)
5. Contracts: `/workscope` changed description → minor bump detected → PASS
6. Write report, update gate-status, emit telemetry
7. Announce: Gate 4.5 PASSED. Next: `/do` Phase 3 plus `gate-enforcement` Gate 5

### Example 2: Red milestone

**User says:** "validate milestone 3"

**Actions:**

1. Parallel validators run
2. Security finds 1 critical: hardcoded API key in a test file committed to repo
3. Accessibility finds 2 critical: missing form labels on signup
4. Coverage: 62% vs. 98% target (lines, branches, functions) → FAIL
5. Verdict: FAIL
6. Report lists 3 blockers with file paths + owner hints
7. Announce: Gate 4.5 FAILED. Fix blockers and retry.

---

## Troubleshooting

### One validator takes >10 minutes

**Cause:** likely `/qa-testing` running full E2E suite on large project.

**Solution:** `/qa-testing` should use `--coverage-gate` mode which trusts existing test results rather than re-running. Ensure CI has run first.

### Working tree is dirty

**Cause:** uncommitted changes.

**Solution:** commit first. Validation reports should be reproducible from a specific commit.

### Contract stability check blocks on legitimate evolution

**Cause:** a breaking contract change was introduced without a major version bump.

**Solution:** bump the major version of the producer; document the break in `CHANGELOG.md`; update all consumers in the same milestone.

### Validators can't find the project classification

**Cause:** `/project-types` was never run.

**Solution:** run `/project-types` first to classify the project — this informs bundle/lighthouse checks.

---

## Rules

1. **Never skip a blocking check.** If a check can't run (e.g., axe-core not installed), mark it FAIL + MISSING_TOOL, not PASS.
2. **Never pass with unresolved critical findings.** Warnings are fine; critical issues block the gate.
3. **Validation reports are immutable.** Once written, they're not edited — a re-run produces a new report.
4. **Always update `AI_DOCS/memory/gate-status.md`.** Other skills rely on this to know the milestone state.

<!-- v1.12.1 (2026-08-21): Impeccable slop lane (advisory pilot). New `slop` row in the MAVS validator table: per-task entries from /build's Exercise gate consolidated with a full `npx impeccable detect --json` over the web app source at close into mavs/slop.json. Deterministic, never blocks, not in required.txt. Runs only when skills/impeccable/ is installed. -->
<!-- v1.12.0 (2026-08-20): Visual-QA lane added to the validator list (PLAN-testing-matrix Part 2.2/2.3). New `visual` row in the MAVS validator table (mavs/visual.json), added to required.txt for web frontends, and a new Phase 1 step 5b consolidating the per-task visual.json entries (from /build's Exercise gate) with the milestone-close full-sweep judgment into the finalized report. -->
<!-- v1.5.0 (2026-06-29): MAVS Wave 2 geometry validators. Added ui (6 craft sub-checks from the geometry dump) + fidelity (rendered structure vs design reference) to the parallel suite + required.txt (frontend); e2e-testing produces both via the geometry.<width>.json dump. v1.4.0: MAVS Wave 2 orchestration (T-4.4). Documented the parallel validator fan-out (authz/schema/api/auth/e2e/qa/a11y/security/traceability per stack, wall-clock = slowest validator); required.txt always includes qa/traceability/security; writes the unified mavs/SUMMARY.md; /do milestone close depends on the parsed mavs-gate verdict. WCAG 2.1 -> 2.2 AA. v1.3.0: MAVS Wave 1 machine-checked reports + required.txt. -->
<!-- Version: 1.12.3 | 2026-10-22 | v4.32.0: team-feature, team-design and team-release retired (next_skill and consumers now gate-enforcement, Gate 5 handoff text repointed). fast-validate.sh hook retired, per-feature validation points at the build verify battery -->
