---
name: gate-enforcement
description: "Validate gate conditions and produce a PASS/FAIL verdict that authorizes or blocks phase transitions (Gate 0 through Gate 5). Use when asking 'has the gate passed?', 'can we move on to the next phase?', 'what's the gate status?', or when a phase-transition approval verdict is needed. For merely detecting which SDLC phase the project is currently in (no verdict), use project-stage-detect instead. Also triggers on: 'Check gate', 'Ready to proceed', 'Gate report'."
effort: xhigh
allowed-tools: Read Grep Glob Write
skill_id: SK-024
context_budget:
  load_kb: 30
  scope: milestone
version: 2.7.1
next_skill: [Routes dynamically based on gate]
required_gate: null
dependencies:
  required: [session-management, milestone-planning]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Gate Enforcement & Validator

> **Purpose**: Ensure all technical, functional, and documentation quality bars are met before moving to the next phase.
> **Output**: Gate Validation Report (Chat/Log) + `AI_DOCS/memory/gate-status.md` update.

> **PHASE-GATE adversarial mode (full gates, non-POC):** when running a PHASE-GATE with the directors, follow `docs/governance-gates.md` PHASE-GATE: spawn the directors the gate actually needs (add `data-architect` for schema/migration, `sre-reliability` for Gate 5, `compliance-officer` when `stack.md` compliance is non-empty, `qa-lead` for coverage), then run a SECOND adversarial round where each director sees the others' verdicts and must hold, concede, or escalate a named disagreement. A unanimous APPROVE where no director engaged another's findings is downgraded to CONCERNS (rubber-stamp guard). Record the disagreements in `gate-status.md`, not just the merged verdict.

---

## Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Gate Registry & Conditions

### Gate 1: Planning Completeness (formerly "Tech Spec Approved")

The single mandatory planning gate. Replaces the former PRD and FRD gates. It now blocks the Phase 0 → Phase 1 (Build) transition until EVERY planning dimension is present, OR explicitly marked `N/A (reason)`. A blank dimension is a FAIL; an honest `N/A (reason)` is a PASS. This is the gate `/do` runs at the end of Phase 0 before any code is written.

**Part A — Tech spec (all 23 sections present and populated; TBDs only if labelled with a module deadline):**

> **Depth, not just presence:** the section-existence checks below are necessary but not sufficient. The depth assertions on S18, S20, and S21 (see those rows) must also pass. A shallow inline reimplementation that has only headers or a single token row does not satisfy this gate.

- [ ] Tech stack confirmed requirement-first: `stack.md` has `stack_confirmed: true`, the confirmed names, and a `## Selection rationale` block (reason + alternatives + revisit trigger per category), AND a stack ADR exists in `architecture/adrs/`. Blank, names-only, or a default stack with no requirement justification = FAIL (non-POC). Waived only when `planning_depth: poc` (recorded thin pick still required). See `rules/tech-stack-selection-rules.md`.
- [ ] `AI_DOCS/planning/tech-spec.md` exists
- [ ] Section 1: Problem Definition — objective and success metrics defined
- [ ] Section 2: Scope — included and excluded features explicitly listed
- [ ] Section 3: User Roles — all actors and permissions defined
- [ ] Section 4: User Flow — happy path, edge paths, error paths, back navigation
- [ ] Section 5: UI/UX — per-screen component specs, field mapping, and ALL FOUR states (loading/empty/error/first-run)
- [ ] Section 6: API Contract — all endpoints with request/response/error codes
- [ ] Section 7: Data Model — all collections/tables with fields, types, indexes, lifecycle/retention, concurrency, multi-tenancy (if SaaS), AND the stack-reconciliation outcome recorded (drafted schema vs locked DB choice — a contradiction unresolved here is a FAIL)
- [ ] Section 8: Business Logic — rules written as explicit conditions
- [ ] Section 9: Edge Cases — all failure/unusual scenarios documented
- [ ] Section 10: State Management — global vs local, cache strategy
- [ ] Section 11: Validation Rules — all fields with error messages
- [ ] Section 12: Performance Expectations — response time, pagination targets, scalability numbers + scaling triggers
- [ ] Section 13: Logging & Monitoring — audit trail and error tracking defined
- [ ] Section 14: Folder Structure — pre-defined per module
- [ ] Section 15: Coding Rules — no comments, no emojis, no mock data rules confirmed
- [ ] Section 16: Tech Constraints — stack, architecture, typing
- [ ] Section 17: Definition of Done — complete checklist
- [ ] Section 18: Test Cases — at minimum one success and one failure scenario per feature, tied to acceptance criteria. Depth check: S18 must contain at least one real success case AND one real failure case for every feature (not just a header). A feature with no failure case = FAIL.
- [ ] Section 19: Sequence Diagrams — Mermaid.js diagrams for all critical flows (SD-[MODULE]-[NUMBER])
- [ ] Section 20: Compliance & Security Matrix — one row per sensitive feature with FE check + BE check + test case (or `N/A (reason)`), AND STRIDE-lite threat entries for every critical flow (auth, payment, upload, export, admin) with each threat mapped to a mitigation + S18 test case. Depth check: for any project with sensitive features, S20 must contain at least one real compliance or STRIDE-lite row (not just a header). A header-only S20 on a project with sensitive features = FAIL.
- [ ] Section 21: Traceability Matrix — every api-contract endpoint mapped to a screen or tagged `backend-only`, every screen mapped to an endpoint. Depth check: S21 must contain at least one real Req-to-API-to-Screen row (not just a header). A header-only traceability matrix = FAIL.
- [ ] Section 22: Cross-Cutting Concerns — each row planned or `N/A (reason)`
- [ ] Section 23: Public & Business Surface — each row planned or `N/A (reason)`
- [ ] Change Log initialized at bottom of spec

**Part B — Design / IA (UI projects; else `N/A (reason)`):**

- [ ] **Gate UX-0 (Requirement Decomposed):** `AI_DOCS/design/ux-brief.md` exists and passes all 10 rows: (1) roles named (>= S3), (2) JTBD per role as outcomes not features, (3) context + RBAC permission per job, (4) done-signal per job, (5) functional/non-functional split present, (6) accessibility target set (WCAG 2.2 AA + named AAA flows), (7) security-UX obligations named (masking, step-up auth), (8) i18n/residency stated or N/A, (9) measurable success metrics per top flow, (10) multi-role surface count. STOP-rule: if rows 1-2 fail (cannot name roles + primary jobs), halt the pipeline.
- [ ] `AI_DOCS/design/sitemap.md` exists — no orphan page, no dead end, post-login default marked
- [ ] `AI_DOCS/design/navigation.md` exists AND reconciles with RBAC: every role named in any nav row's "Visible to roles" must exist in tech-spec Section 3 (RBAC). This is a reconcile check, not an existence check. A nav row referencing a role not defined in S3 = FAIL.
- [ ] `AI_DOCS/design/onboarding-flow.md` exists — first-run / zero-to-value path

**Part C — Infrastructure (non-POC; else `N/A (reason)`):**

- [ ] `AI_DOCS/infra/infra-plan.md` exists with no blank section (environments, FE+BE topology, secrets, CI/CD, monitoring, DR, cost)

**Part D — Skill Activation Map + sign-off:**

- [ ] `AI_DOCS/memory/active-skills.md` Activation Map populated (armed skills + trigger evidence) — see Phase G
- [ ] No unresolved `<!-- STALE -->` markers in any planning artifact
- [ ] Multi-role acceptance: if S3 declares 2 or more non-admin roles, S18 test cases for multi-role features must reference per-role acceptance criteria (from prd-generation). If the project is multi-role and no per-role acceptance criteria exist anywhere = FAIL.
- [ ] User has reviewed and approved the plan

> **POC fast-path:** if `stack.md` has `planning_depth: poc`, this gate runs in reduced form — Part A sections 1-9 + 16-18 required, Parts B/C may be `N/A (POC)`. The POC exemption is recorded, so audit treats skipped planning as intentional.

### Gate 1.5: Code Quality Pre-Check

Mandatory before any coding begins on a module.

- [ ] `code-quality` skill simulation report generated
- [ ] All 17 points show PASS in `AI_DOCS/quality/quality-report.md`
- [ ] Zero blockers outstanding
- [ ] CI/CD integration question asked and answered (integrated if applicable)

### Gate 2: Milestone Plan Approved

- [ ] `AI_DOCS/planning/milestone-plan.md` exists
- [ ] All milestones mapped to sections in `tech-spec.md`
- [ ] Dependencies between milestones mapped correctly
- [ ] Exit criteria defined for all milestones
- [ ] Task IDs (T-M#-##) assigned to all planned work items
- [ ] S21 Traceability closed both ways: every S21 Req row carries at least one seeded Task ID (a feature with no task will never be built), and every task maps back to an S21 Req row (an orphan task is unscoped work)
- [ ] Security acceptance injected: every task matching the auth/payment/upload/export keyword groups carries its injected security acceptance criteria (S20 controls copied into the task row — see milestone-planning)

### Gate 3: Design Approved

**Gate UX-1 (UX Structure Validated) — BLOCKING before any color/tokens:**

- [ ] Grayscale only: no brand color, final type, or surface styling in the Phase-1 artifacts
- [ ] IA built: `sitemap.md` / `navigation.md` / `onboarding-flow.md` present (Gate 3.5)
- [ ] IA reconciled to data model: no nav domain object without a `database-schema.md` entity, no core entity unreachable from nav
- [ ] Flows per role include branch + failure paths
- [ ] Flows trace to a job in `ux-brief.md`
- [ ] Enterprise state coverage per surface: first-run AND filtered-empty (distinct), loading/skeleton/partial, realistic density (~10k), error network/validation/server/permission-denied (distinct), read-only per role, bulk select/action
- [ ] Nielsen heuristic pass (one dominant element, clear primary action, control fits data shape)
- [ ] WCAG 2.2 structural pass (focus order, landmarks, keyboard reachability) — decidable pre-visual
- [ ] `Gate UX-1: PASS` recorded in `gate-status.md` (enforced by `hooks/design-gate.sh`)

**Gate UX-2 (UI System Complete) — BLOCKING before build:**

- [ ] Tokens before screens; semantic tokens, no raw hex/px
- [ ] Theming infra: light/dark pairs (when DNA=Both), per-tenant white-label hook where required
- [ ] Every component covers default/hover/focus-visible/active/disabled/error/loading
- [ ] Data-dense patterns: DataTable sort/filter/saved-views/column-management where the brief needs them
- [ ] Multi-step forms (wizard + progressive disclosure + inline validation) where the brief needs them
- [ ] Keyboard-first: tables/forms fully keyboard-operable, visible focus ring
- [ ] Contrast + focus meet WCAG 2.2 AA; target size >= 24x24 CSS px (SC 2.5.8)
- [ ] Responsive/adaptive defined across breakpoints; density tuned per breakpoint
- [ ] Motion purposeful + `prefers-reduced-motion` fallback
- [ ] Security UX: sensitive fields masked, step-up re-auth on sensitive actions
- [ ] Error prevention: destructive actions have confirm AND/OR an undo path (undo preferred when reversible)

**General design checks:**

- [ ] `AI_DOCS/design/specs/` folder contains approved UI modules
- [ ] Design matches Section 5 of `tech-spec.md` for each screen
- [ ] All screen states documented (the enterprise state set above)
- [ ] No placeholder or mock data in design outputs
- [ ] No emojis in any UI labels, button text, or placeholder text
- [ ] Accessibility check (WCAG 2.2 AA) passed
- [ ] User has reviewed and approved all screen designs

### Gate FLOW: Flow Validated (per flow, not per milestone)

Unlike every other gate in this registry, Gate FLOW does not gate a phase transition for the whole milestone. It gates one flow at a time, identified by its `Flow ID` row in `AI_DOCS/design/flow-validation-plan.md`. An implementation task carries a `flow: <flow-id>` tag (seeded by `milestone-planning`) when it belongs to a Tier F flow. A task with no `flow:` tag never touches this gate. Owner skill: `flow-prototypes` (SK-168) triages the flow, generates the three-plus clickable variants, runs the judged selection, and writes the row.

- [ ] The flow has a row in `AI_DOCS/design/flow-validation-plan.md`
- [ ] That row's `Status` reads `approved` (three-plus judged variants generated, `chosen.md` recorded) or `waived` (a stated reason logged under `## Waivers` in the plan file AND in `decision-log.md`)

**Verdict**: `PASS` when the row is `approved` or `waived` with a logged reason. `PENDING` for every other status (`pending`, `prototyped`, or the flow having no row at all).

**Recorded**: one line per flow in `AI_DOCS/memory/gate-status.md`, never merged into a single project-wide row:

```
Gate FLOW <flow-id>: PASS | PENDING | WAIVED
```

**Checked by**: `/do`'s per-task loop, before it opens a Task Brief for any task tagged `flow: <flow-id>`, AND `hooks/enforce-flow-gate.sh` (the same recorded-override PreToolUse pattern as the other locks), which blocks Edit/Write on that task's files until the row reads `approved` or `waived`.

### Gate 4C: Code Review Passed

- [ ] `code-quality` simulation report re-run on completed implementation — all 17 points PASS
- [ ] No `console.log` in production source files
- [ ] No dead code, unused imports, or commented-out blocks
- [ ] No placeholder logic (TODO, mock, demo, fake)
- [ ] Test coverage: lines, branches, AND functions each >= 98% on code touched this milestone, every stack and every project type incl POC (testing-rules 7a — Jest four-metric, pytest lines+branches plus the function-coverage helper, Go `-func` total plus the per-function called check)
- [ ] All test cases from `tech-spec.md` Section 18 implemented and passing
- [ ] Implementation matches API contract in `tech-spec.md` Section 6
- [ ] No TypeScript `any` types
- [ ] Code reviewed against `AI_DOCS/project-guardrails.md` rule IDs

### Gate 4D: QA Sign-off

- [ ] All test cases from `tech-spec.md` Section 18 have green results
- [ ] All edge cases from Section 9 handled and verified
- [ ] All high/critical bugs resolved
- [ ] Regression suite passed
- [ ] Performance meets targets from `tech-spec.md` Section 12
- [ ] User acceptance testing (UAT) completed
- [ ] Drift scan fresh and clean for this milestone: force a re-run (`rm AI_DOCS/memory/.drift-last-run` then `bash .claude/hooks/drift-detector.sh`), then verify Phase A = 0 (no undocumented routes), Phase C = 0 for this milestone's features (no acceptance criterion without a test), Phase D = 0 (no unresolved STALE markers). Do NOT rely on the 24h-cached report.

### Gate 5: Scope Closure & Production Readiness

The final gate before `/ship` deploys to production. Verifies the delivered product matches the agreed scope: nothing dropped, nothing invented, every change request propagated. Output: `AI_DOCS/audit/scope-closure-report.md` + verdict in `gate-status.md`. `/ship` and `/do` Phase 3 REFUSE to deploy without a PASS dated after the last `task-ledger.md` change.

**Part A — Scope delivered (nothing dropped):**

- [ ] Build the closure mapping table from S21 (the Task ID column seeded at Gate 2): every included feature in the scope source (workscope doc if present, else `tech-spec.md` Section 2) → spec section → task IDs → status. Every feature maps to at least one DONE task.
- [ ] Any SKIPPED task has a written reason AND the user has acknowledged the resulting scope gap in this report
- [ ] `task-ledger.md`: every milestone Status=DONE with its exit gate verdict recorded

**Part B — Nothing invented (no gold-plating):**

- [ ] Drift Phase A = 0: every route in code appears in `api-contract.md`
- [ ] Every screen in the codebase maps to a `tech-spec.md` S5 row or S21 traceability entry; unmapped screens are listed in the report for explicit user accept-or-remove

**Part C — Change requests propagated:**

- [ ] `requirement-changelog.md` (if any change requests occurred): every row is APPLIED, none PENDING
- [ ] Drift Phase D = 0: zero unresolved `<!-- STALE -->` markers in planning artifacts
- [ ] If any change request occurred: a client-facing scope delta summary exists in the report (originally agreed vs delivered, with CR references)

**Part D — Verification freshness:**

- [ ] Drift scan force-re-run for this gate; the report is clean or every finding is explicitly acknowledged in the closure report with a reason
- [ ] `/audit` verdict is PASS (or CONCERNS with a logged user override)
- [ ] Gate 4D verdict still APPROVED (not regressed)
- [ ] Golden-path E2E suite green (`tests/e2e/` or `tests/smoke/`). A UI project with no E2E suite at all FAILS this item (override only via `/ask`, logged)
- [ ] Defect ledger reviewed (`AI_DOCS/quality/defect-log.md`): no open critical/high defect, and the escaped-defect rate is reported in the closure report against the <1% target

**Part E — Production operability (Track E — VERIFIED, not checkboxes):**

- [ ] **Observability ready:** `/audit` check 11 passes (error tracker + `/health` route + structured logger per `docs/app-observability-standard.md`); dashboard + alert wiring confirmed by `/operations`. Missing on a compliance project → FAIL.
- [ ] **Billing alarm is a real resource:** the provider budget alert exists in the account at the approved ceiling (confirmed by `/operations`), not just named in the plan (infrastructure-rules Rule 19).
- [ ] **Rollback rehearsed:** a dated `AI_DOCS/deployment/rollback-rehearsal.md` record exists for this release cycle (staging rollback executed, time-to-rollback < 5 min).
- [ ] **DR restore tested:** a dated `AI_DOCS/deployment/dr-restore-test.md` record exists (backup restored to scratch, integrity + restore time vs RTO). An untested backup is no backup.
- [ ] **Day-2 ownership set:** `/operations` has seeded the `/schedule` maintenance jobs (dependency/secret/cert/FinOps) and `/incident-response` is wired for incidents.

**Report format** (`AI_DOCS/audit/scope-closure-report.md`, overwrite each run):

```markdown
# Scope Closure Report
Date: YYYY-MM-DD HH:MM
Verdict: PASS | FAIL
Scope source: <workscope path | tech-spec.md S2>

## A. Feature delivery map
| Feature | Spec section | Task IDs | Status |
|---|---|---|---|

## B. Unmapped code (gold-plating check)
<list with file refs, each marked: user-accepted | to-remove | none found>

## C. Change requests
<CR ID → summary → APPLIED date, plus the client-facing scope delta summary; or "none">

## D. Acknowledged exceptions
<SKIPPED tasks with reasons, acknowledged drift findings; or "none">
```

---

## Evaluation Process

1. **Gate Identification**: Detect the current gate from `AI_DOCS/memory/gate-status.md`
2. **Evidence Check**: Scan `AI_DOCS/` for documentation evidence and source code for technical evidence
3. **Spec Cross-Reference**: Verify code/design artifacts match the corresponding `tech-spec.md` sections
4. **Execution Verification**: If in Gate 4, run static analysis simulation via `code-quality` skill
5. **Report Generation**: Provide a structured PASS/FAIL report

---

## Output Template: PASS/FAIL Report

```markdown
# Gate Validation Report: [GATE-ID]

**Status**: FAILED | PASSED
**Target Phase**: [Next Phase Name]

## Condition Checklist

| Rule | Status | Evidence |
|------|--------|----------|
| tech-spec.md Section 6 (API) present | Pass / Fail | [File link or finding] |
| ... | ... | ... |

## Blockers (if FAILED)
- [Issue 1]: Description + Remediation step
- [Issue 2]: Description + Remediation step

## Next Steps (if PASSED)
- Handoff to: [Next Skill Name]
```

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/development-rules.md` — spec-first enforcement
> - `.claude/rules/testing-rules.md` — coverage targets for gate checks

## Critical Rules

1. **NO BYPASS**: Never suggest starting code if Gate 1 (Tech Spec) or Gate 1.5 (Code Quality) has failed
2. **EVIDENCE-ONLY**: Do not mark a gate as complete based on verbal confirmation — the file MUST exist in the workspace
3. **TECH STACK SYNC**: Ensure all artifacts match the tech constraints in `tech-spec.md` Section 16
4. **SPEC SYNC**: Verify every code artifact traces back to a section in `tech-spec.md`
5. **AUTO-UPDATE**: On a PASSED result, update `AI_DOCS/memory/gate-status.md` and the active milestone's capsule `capsule.md` (gate verdict) + `task-ledger.md` milestone exit gate column
6. **FEATURE GUARD**: If user requests something not in `tech-spec.md`, block implementation and trigger spec update flow first

---

## Gate Regression Protocol

A gate can regress from APPROVED back to PENDING if its conditions are violated after approval.

### What Causes Regression

| Gate | Regression Trigger |
|------|--------------------|
| Gate 1 (Planning Completeness) | any planning artifact (tech-spec, design IA, infra-plan, traceability) edited without `/change-request` sign-off, OR an unresolved `<!-- STALE -->` marker appears in a planning artifact |
| Gate 1.5 (Code Quality) | `code-quality` skill run detects new violations (run at every session start) |
| Gate FLOW (Flow Validated) | Editing an approved flow's prototype (`AI_DOCS/design/flows/<flow-id>/**`) or its requirement slice (the tech-spec/ux-brief content the flow was triaged and judged against) after approval regresses that flow's row, and only that flow's row, back to pending |
| Gate 4C (Code Review) | New code merged that fails code review checks |
| Gate 4D (QA Sign-off) | Previously passing tests start failing |
| Gate 5 (Scope Closure & Production) | `task-ledger.md` or any milestone `tasks.md` changes after the closure report's date, a new change request opens, OR a production incident reveals an undetected defect (triggers post-mortem) |

### How Regression Is Detected

- **detect-gaps.sh hook** — runs at SessionStart, checks for code without spec, tests without coverage, etc.
- **code-quality skill** — run explicitly before each coding session (Gate 1.5 is not a one-time check)
- **User reports** — user observes failing tests or production issues

### Regression Response

When a gate regresses:
1. Update `AI_DOCS/memory/gate-status.md` → mark gate as PENDING (not APPROVED)
2. Identify root cause: what violated the gate condition?
3. Fix the violation
4. Re-run the appropriate gate check
5. Update gate-status.md back to APPROVED only after re-check passes

**The same agent that originally approved re-validates the gate.**
Do NOT self-certify gate restoration — the agent must re-run the check.

<!-- Version: 2.7.0, 2026-08-20: Register Gate FLOW (Flow Validated), a per-flow verdict (not per-milestone). PASS on an approved/waived row in flow-validation-plan.md, recorded as one gate-status.md line per flow, checked by /do's per-task loop and hooks/enforce-flow-gate.sh. Placed after Gate 3 (design), before Gate 4C (post-build). Regression row added: editing an approved flow's prototype or requirement slice regresses only that flow's row. Per PLAN-flow-validation.md Part 4 item 6. -->
<!-- Version: 2.4.0 — 2026-06-29 — Track E: Gate 5 Part E Production operability (VERIFIED observability + real billing alarm + rehearsed rollback + tested DR restore + day-2 ownership), replacing the old unverified monitoring/rollback checkboxes. -->
<!-- Version: 2.3.0 — 2026-06-29 — Track G: Gate 1 Part B gains Gate UX-0 (Requirement Decomposed, 10 rows, stop-rule on roles+JTBD); Gate 3 gains the full Gate UX-1 (UX Structure Validated, grayscale + IA-to-data + enterprise state coverage + WCAG 2.2 structural) and Gate UX-2 (UI System Complete, 12 rows) checklists; WCAG 2.1 -> 2.2 AA. -->

<!-- Version: 2.7.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
