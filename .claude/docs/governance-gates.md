# Governance Gates Catalog
> ADF v4.5.0 | Central prompt catalog — reference gate IDs from skills, never embed prompts inline.

---

## How to Use This File

Skills never contain gate prompt text. Instead they reference a gate ID:
```
gate-id: PHASE-GATE
```

The `gate-enforcement` skill reads this file, looks up the gate ID, spawns the correct agent(s), and returns a machine-readable verdict on line 1:
```
APPROVE
CONCERNS: [summary]
REJECT: [reason]
```

Gates **trigger** from project state (milestone close, phase transition, a multi-layer feature request), not from a manual "run gates" toggle. Once triggered, `AI_DOCS/review-mode.txt` controls how strictly a gate runs: `full` (all relevant directors), `lean` (the single most-relevant director, the default), or `solo` (advisory only, output APPROVE). For a POC stamped `planning_depth: poc` in `stack.md`, gates run in the reduced form defined per gate.

---

## Gate ID Catalog

---

### SA-ARCH — Solutions Architect: Architecture Review

**Trigger**: Any new system, service, or significant architectural decision.
**Reviewer**: `solutions-architect` agent
**Verdict required before**: Implementation begins.

**Prompt**:
```
You are the solutions-architect reviewing an architectural decision.

Read the proposed architecture or ADR. Evaluate:
1. Does this align with existing system boundaries and API contracts?
2. Are there scalability, security, or maintainability risks?
3. Does this introduce hidden coupling or circular dependencies?
4. Is the data model sound and migration-safe?
5. Are there simpler alternatives that achieve the same goal?

Output format — FIRST LINE must be one of:
  APPROVE
  CONCERNS: [summary]
  REJECT: [reason]

Then provide detailed findings.
```

---

### SA-ADR — Solutions Architect: ADR Sign-Off

**Trigger**: Before any Architecture Decision Record is finalized and implemented.
**Reviewer**: `solutions-architect` agent

**Prompt**:
```
You are the solutions-architect reviewing an Architecture Decision Record (ADR).

Read the ADR. Verify:
1. Context section clearly explains why this decision is needed
2. Decision is specific and unambiguous
3. Consequences (positive AND negative) are honestly stated
4. Alternatives were considered and documented
5. This decision does not contradict an existing approved ADR

FIRST LINE must be:
  APPROVE
  CONCERNS: [what needs clarification]
  REJECT: [reason — cite conflicting ADR if applicable]
```

---

### PD-SCOPE — Product Director: Scope Validation

**Trigger**: New feature request, change request, or scope expansion mid-sprint.
**Reviewer**: `product-director` agent

**Prompt**:
```
You are the product-director validating a scope request.

Read the requested change or feature. Evaluate:
1. Is this in scope for the current milestone? Check AI_DOCS/milestones/.
2. Does this change the tech-spec or API contract? If so, Gate 1 must be re-run.
3. What is the user value? Is it proportionate to the dev cost?
4. Does this introduce risk to the current sprint delivery?
5. Is there a simpler way to achieve the same user outcome?

FIRST LINE must be:
  APPROVE
  CONCERNS: [risk or scope issue]
  REJECT: [out of scope — defer to milestone N]
```

---

### PD-MILESTONE — Product Director: Milestone Transition

**Trigger**: Before advancing to the next milestone (M1 → M2, M2 → M3, etc.).
**Reviewer**: `product-director` agent

**Prompt**:
```
You are the product-director assessing milestone transition readiness.

Read the milestone plan and current completion status. Evaluate:
1. Are all required stories/tasks in this milestone marked done?
2. Are there known bugs that block the next milestone's work?
3. Are acceptance criteria met for this milestone's goals?
4. Is the team's velocity realistic for the next milestone's scope?
5. Are there external dependencies (APIs, design, legal) that must resolve first?

FIRST LINE must be:
  APPROVE
  CONCERNS: [what must be resolved before advancing]
  REJECT: [milestone not ready — list blocking items]
```

---

### EL-FEASIBILITY — Engineering Lead: Implementation Feasibility

**Trigger**: Before sprint starts, after stories are written and acceptance criteria defined.
**Reviewer**: `engineering-lead` agent

**Prompt**:
```
You are the engineering-lead assessing implementation feasibility.

Read the sprint plan and story list. Evaluate:
1. Are all stories small enough to complete in one sprint?
2. Are there technical risks or unknowns that need spikes first?
3. Are dependencies between stories ordered correctly?
4. Is the acceptance criteria for each story testable and specific?
5. Does any story require platform-specific expertise? If so, flag the specialist agent to involve.

FIRST LINE must be:
  APPROVE
  CONCERNS: [what needs adjustment]
  REJECT: [blocker — what must happen before sprint starts]
```

---

### QA-STORY-READY — QA Lead: Story Acceptance Criteria Review

**Trigger**: Before a story moves from Ready to In Progress.
**Reviewer**: `qa-lead` agent

**Prompt**:
```
You are the qa-lead validating story acceptance criteria.

Read the story. Evaluate:
1. Does the story have specific, testable acceptance criteria?
2. Is the success condition measurable (not "works correctly")?
3. Are edge cases and error states covered in the criteria?
4. Is there a clear definition of "done" that QA can verify independently?
5. Does the story need any test evidence beyond unit tests? (E2E, visual, contract)

FIRST LINE must be:
  APPROVE
  CONCERNS: [what criteria need sharpening]
  REJECT: [story not ready — missing criteria]
```

---

### QA-TEST-COVERAGE — QA Lead: Test Coverage Gate

**Trigger**: At phase end (pre-Gate 3, pre-Gate 4, pre-Gate 5).
**Reviewer**: `qa-lead` agent

**Prompt**:
```
You are the qa-lead reviewing test coverage before phase advancement.

Check the codebase test status:
1. Are all BLOCKING story types covered? (Logic/Algorithm → unit, Integration → integration/E2E, API → contract check)
2. Are ADVISORY items documented even if not fully covered?
3. Is the coverage target met per .claude/skills/qa-testing/COVERAGE-TARGETS.md (floor: .claude/rules/testing-rules.md Rule 7)?
4. Are there known flaky tests? If so, are they tracked?
5. Is there a regression suite that covers the critical path?

FIRST LINE must be:
  APPROVE
  CONCERNS: [coverage gaps]
  REJECT: [BLOCKING coverage missing — list what's absent]
```

---

### PHASE-GATE — Full Phase Transition Gate

**Trigger**: Gate 0, Gate 1, Gate 1.5, Gate 2, Gate 3, Gate 4, Gate 5 transitions.
**Reviewers**: `solutions-architect` + `product-director` + `engineering-lead` (plus `qa-lead`, `data-architect`, `sre-reliability`, `compliance-officer` per the gate, see the routing note below) spawned **in parallel**.
**Strictest verdict wins**: if any reviewer REJECTs, the gate does not pass.

**Director routing (which director a gate actually needs):**

- Schema or migration in scope -> add `data-architect`.
- Gate 5 / production readiness -> add `sre-reliability`.
- `stack.md` compliance != none -> add `compliance-officer`.
- Test-coverage / release quality -> add `qa-lead`.
A `full` gate spawns the relevant set, not always the same three.

**Adversarial mode (full gates, non-POC):** a leadership team that cannot disagree on the record is a rubber stamp with three signatures. After the first parallel round, run a SECOND round where each director SEES the others' verdicts and findings, and must do one of: hold (restate why), concede (update openly, say what changed the mind), or escalate a specific disagreement on the record (name the other director's claim and why it is wrong). The gate result records the disagreements, not just the merged verdict. A unanimous APPROVE reached without any director engaging another's findings is downgraded to CONCERNS: agreement that costs nothing is not a review.

**Orchestration prompt** (sent to `gate-enforcement` skill):
```
Run PHASE-GATE for [Gate N].

1. Read AI_DOCS/review-mode.txt (setup.sh scaffolds it with "lean". If the file is absent, fall back to "full").
   - If "solo": skip director spawn, output APPROVE (advisory only).
   - If "lean": spawn only the most relevant single director.
   - If "full": spawn all three directors in parallel.
   (For a POC stamped `planning_depth: poc` in stack.md, run the gate in reduced form per gate-enforcement.)

2. Provide each director with:
   - The gate's checklist (from the appropriate Gate N definition below)
   - Links to relevant AI_DOCS files
   Spawn the directors the gate needs (see Director routing above), not always the same three.

3. Round 1 (parallel): collect each director's independent verdict + findings.

4. Round 2 (adversarial, full + non-POC only): give every director the OTHER directors' round-1 verdicts and findings. Each must hold (restate why), concede (update openly), or escalate a specific named disagreement. Record the disagreements.

5. Apply strictest:
   - Any REJECT → gate result is REJECT
   - Any CONCERNS (no REJECT) → gate result is CONCERNS
   - All APPROVE → gate result is APPROVE
   - All APPROVE with NO director having engaged another's findings in round 2 → downgrade to CONCERNS (rubber-stamp guard).

6. Write the result AND the recorded disagreements to AI_DOCS/memory/gate-status.md
```

---

### Gate FLOW: Flow Prototype Approval (per flow)

**Trigger**: Before any Tier F flow's implementation tasks begin. One gate instance per flow, owned by the `flow-prototypes` skill (SK-168).
**Reviewer**: The operator, via flow-prototypes' judged variant selection. The variants are pre-judged by the `ux-advisor` and `principal-designer` agents against the ux-brief's Role and JTBD table, but the verdict itself is the operator's pick: the operator clicks through the flow's clickable prototype variants (`AI_DOCS/design/flows/<flow-id>/`) and either approves a chosen variant or waives the flow's row in `AI_DOCS/design/flow-validation-plan.md`.
**Verdict format**: one row per flow in `AI_DOCS/memory/gate-status.md`:

```
Gate FLOW <flow-id>: PASS      (a variant was approved and chosen.md written)
Gate FLOW <flow-id>: PENDING   (variants exist but no approval yet)
Gate FLOW <flow-id>: WAIVED    (operator waived the flow with a logged reason)
```

**Enforcement**: `hooks/enforce-flow-gate.sh` blocks the flow's Tier F implementation tasks while its plan row is neither approved nor waived. Escape: `ADF_FLOW_GATE_BYPASS=on`, logged in `decision-log.md` the same UTC day.
**Regression**: a PASS regresses to PENDING when the flow's prototype variants or its requirement slice are edited after approval. Re-approve (or re-waive) before implementation resumes.

---

## Gate N Checklists (for PHASE-GATE)

### Gate 0 — Project Charter
- [ ] Workscope document approved by all stakeholders
- [ ] Tech stack decided and documented
- [ ] Estimation completed with AI + human benchmarks
- [ ] Project type classified (POC / MVP / Production-Grade)
- [ ] Team roles assigned

### Gate 1 — Planning Completeness
> Full checklist (Parts A-D) lives in `skills/gate-enforcement/SKILL.md`. Summary below.
- [ ] Tech specification complete (all 23 sections, S1-S23)
- [ ] API contract finalized, peer-reviewed, and marked LOCKED in gate-status.md
- [ ] DB schema (`architecture/database-schema.md`) finalized and `SCHEMA LOCKED` recorded in gate-status.md (frozen by `hooks/enforce-artifact-lock.sh`; changes via /change-request)
- [ ] Authorization matrix (`architecture/authz-matrix.yaml`, if the project has roles) generated from S3 + S7 + api-contract, with BOTH the action matrix (role x resource.action) AND the field matrix (role x resource.field: read/write/masked/none), and `AUTHZ MATRIX LOCKED` recorded in gate-status.md (frozen by `hooks/enforce-artifact-lock.sh`)
- [ ] Architecture Decision Records written for major choices (incl. scaling-strategy ADR)
- [ ] Design IA present (if frontend): `design/sitemap.md`, `design/navigation.md`, `design/onboarding-flow.md`
- [ ] **Gate UX-0 (if frontend):** UX brief present (`AI_DOCS/design/ux-brief.md`) with roles x JTBD (outcomes), the functional/non-functional contract (per-flow perf budget, WCAG 2.2 AA target + named AAA flows, security-UX, i18n, residency), and measurable success metrics. STOP if roles + primary jobs cannot be named. (Full 10-row checklist in `skills/ux-foundation/SKILL.md`.)
- [ ] Infra plan present: `AI_DOCS/infra/infra-plan.md`
- [ ] Compliance + security matrix (S20), traceability matrix (S21), cross-cutting (S22), public surface (S23)
- [ ] Security threat model drafted
- [ ] Every blank dimension is explicitly marked `N/A (reason)` or the gate is FAIL

### Gate 1.5 — Code Quality (per session/PR)
- [ ] 17-point code quality check passed
- [ ] No CRITICAL or HIGH security findings open
- [ ] API contract in sync with implementation
- [ ] No dead code or ghost features introduced

### Gate 2 — Design System
- [ ] **Gate UX-1 (UX Structure Validated, BLOCKING before color/tokens):** grayscale UX structure approved, IA reconciled to the data model (`database-schema.md`), flows per role trace to `ux-brief.md` jobs, enterprise state coverage complete per surface (first-run vs filtered-empty, realistic 10k density, the four error types, read-only per role, bulk), Nielsen heuristic pass, WCAG 2.2 structural pass. Recorded as `Gate UX-1: PASS` in `gate-status.md` (enforced by `hooks/design-gate.sh`).
- [ ] Design DNA document approved
- [ ] Component registry up to date
- [ ] All UI components have accessibility compliance (WCAG 2.2 AA)
- [ ] Design tokens defined and applied consistently
- [ ] **Gate UX-2 (UI System Complete):** tokens before screens, semantic tokens (no raw hex), theming infra (light/dark + per-tenant where required), every component covers default/hover/focus-visible/active/disabled/error/loading, data-dense patterns (DataTable sort/filter/saved-views/column-mgmt), multi-step forms, keyboard-first, contrast + focus meet WCAG 2.2 AA (target size 24x24), responsive/adaptive defined, motion purposeful + reduced-motion, security UX (masking + step-up re-auth), error prevention (undo over confirm). (Full 12-row checklist in `skills/gate-enforcement/SKILL.md`.)
- [ ] App-shell decisions recorded (`AI_DOCS/design/app-shell-decisions.md`, reason-first per structural element)
- [ ] Locked app-shell built on the chosen vetted library, craft-reviewed (principal-designer APPROVE), registered under "Locked app-shell (frozen)", and `SHELL LOCKED` recorded in `gate-status.md` (Track H, before feature screens)

### Gate 3 — Alpha Ready
- [ ] All Milestone 1 stories complete
- [ ] Core user flows work end-to-end
- [ ] No CRITICAL bugs open
- [ ] Integration tests passing
- [ ] Deployment runbook drafted

### Gate 4 — Beta Ready
- [ ] All Milestone 2 stories complete
- [ ] Performance targets met: `AI_DOCS/quality/mavs/perf.json` `status: PASS` — bundle size per route within budget (FAIL > 250kb gzipped), Core Web Vitals in range, API p95 within the S12 budget
- [ ] Security review passed
- [ ] Full E2E test suite passing
- [ ] Staging deployment successful

### Gate 4.5 — Milestone Closure (per milestone, runs at each milestone close)
> Enforced by `milestone-validation` (Gate 4.5). Runs at EVERY milestone close, not only at Beta. See `skills/milestone-validation/SKILL.md`.
- [ ] All tasks in the milestone are DONE (none DOING/BLOCKED) or SKIPPED with a logged reason
- [ ] milestone-validation verdict PASS: code-quality + security + QA coverage + accessibility. The verdict is MACHINE-PARSED from `AI_DOCS/quality/mavs/*.json` by `hooks/mavs-gate.sh` (MAVS Wave 1), not a self-written string. See `docs/mavs-report-schema.md`.
- [ ] Milestone E2E suite PASS (Phase 1b) on every declared surface — `AI_DOCS/quality/mavs/e2e.json` `status: PASS`, fresh against the current commit (not stale), enforced by the milestone merge gate
- [ ] RBAC PASS (projects with roles): `AI_DOCS/quality/mavs/authz.json` `status: PASS` at **100% coverage** — every role x action AND role x field cell tested at BOTH layers (API denial + Playwright UI element-finding), the cross-tenant negative, the masked/none field cases, PLUS the dynamic two-actor permission-change flow (grant/revoke propagation, no stale role), cross-user IDOR chains, and CSRF on mutations (AuthMatrix methodology). `cells_tested == cells_total`; results are three-state and any `LEAK` (a deny control clickable for a forbidden role, B keeps access after a revoke, IDOR reaches another user's resource, a mutation without a valid CSRF token) is a FAIL that blocks. An `INCONCLUSIVE` cell is surfaced for re-run, not shipped as PASS. (`authz-matrix` skill)
- [ ] DB schema PASS (projects with a database): `AI_DOCS/quality/mavs/schema.json` `status: PASS` — migrations up/down/up clean and the schema matches `database-schema.md` (`schema-validation` skill)
- [ ] API conformance PASS (projects with an API): `AI_DOCS/quality/mavs/api.json` `status: PASS` — OpenAPI diffs clean against the contract and every endpoint's runtime status code + standard envelope match (`api-conformance` skill)
- [ ] List behavior PASS (projects with list endpoints/screens): `AI_DOCS/quality/mavs/behavior.json` `status: PASS` — pagination (no dropped/duplicate rows across pages), search, filter, and cache hit/miss/invalidation correct against the 10k-row fixture, at API + Playwright UI (`qa-testing`)
- [ ] Performance budget PASS (frontend): `AI_DOCS/quality/mavs/perf.json` `status: PASS` — bundle/CWV/p95 within budget (`e2e-testing`)
- [ ] Auth flows PASS (projects with auth): `AI_DOCS/quality/mavs/auth.json` `status: PASS` — password-reset single-use/expiry, session-expiry, refresh rotation + reuse-revokes-family, MFA, and the stale-role (Rule 34) revocation test (`e2e-testing` required auth suite)
- [ ] Accessibility PASS (frontend): `AI_DOCS/quality/mavs/a11y.json` `status: PASS` — axe-core + keyboard + contrast, WCAG 2.2 AA (`accessibility-audit`)
- [ ] UI craft PASS (frontend): `AI_DOCS/quality/mavs/ui.json` `status: PASS`. Six measured sub-checks from the rendered geometry dump (alignment, spacing rhythm, hierarchy ladder, density, cross-screen uniformity, state quality), not a grep (`e2e-testing` V2).
- [ ] Design-to-code fidelity PASS (frontend with design screens): `AI_DOCS/quality/mavs/fidelity.json` `status: PASS`. The coded screen's structure matches the design reference and composes from the locked app-shell, not just tokens (`e2e-testing` V11).
- [ ] Security PASS (always): `AI_DOCS/quality/mavs/security.json` `status: PASS` — secrets + CVE + OWASP + audit-log paths (`audit`, or `team-security` for compliance projects)
- [ ] Traceability PASS (always): `AI_DOCS/quality/mavs/traceability.json` `status: PASS` — every in-scope requirement (S21) resolves to a test that EXECUTED and PASSED, not just a referenced test-case ID (`qa-testing` traceability executor)
- [ ] The full suite is run as a PARALLEL fan-out by `milestone-validation` (wall-clock = slowest validator); the operator reviews the single unified `AI_DOCS/quality/mavs/SUMMARY.md`; the machine verdict is parsed by `mavs-gate.sh`, never self-reported
- [ ] No gold-plating: every change maps to a milestone task (traceability)
- [ ] All change requests for this milestone propagated (no open `<!-- STALE -->` markers)
- [ ] Compliance matrix re-validated (if a regime is declared) — no `missing` controls for delivered features
- [ ] Promotion + deploy decision recorded in `AI_DOCS/deployment/git-strategy.md` (see `/do` milestone close). Deployment is DEFERRED until full scope (Gate 5) unless the user explicitly approves a per-milestone release.

### Gate 5 — Scope Closure & Production Ready
- [ ] Scope-closure report PASS (`AI_DOCS/audit/scope-closure-report.md`): every scoped feature maps to a DONE task, no unmapped code (gold-plating), all change requests propagated, drift scan clean — checklist in `skills/gate-enforcement/SKILL.md` Gate 5
- [ ] Full-scope deploy authorization: the user has confirmed the full scope is done. CI/CD pipeline files may be created earlier but stay disabled/unpushed until this point (see `deployment-planning` / `infra-planning`).
- [ ] All Milestone 3+ stories complete
- [ ] Load testing passed
- [ ] **Observability readiness VERIFIED** (not just configured): error tracker + `/health` route + structured logger present (`/audit` check 11), and a dashboard + alert wiring confirmed by `/operations`, per `docs/app-observability-standard.md`. Missing on a compliance project → FAIL.
- [ ] **Billing alarm is a VERIFIED resource** (provider budget alert actually exists in the account at the approved ceiling, confirmed by `/operations`), not just a plan mention (infrastructure-rules Rule 19)
- [ ] **Rollback REHEARSED**: a dated `AI_DOCS/deployment/rollback-rehearsal.md` record (staging rollback executed, time-to-rollback measured < 5 min), not just a documented plan
- [ ] **DR restore TESTED**: a dated `AI_DOCS/deployment/dr-restore-test.md` record (backup restored to scratch, integrity + restore-time vs RTO), an untested backup counts as no backup
- [ ] Legal/compliance review complete (if applicable)
- [ ] Go-live runbook approved
- [ ] Maintenance ownership set: `/operations` seeds the `/schedule` jobs (dependency/secret/cert/FinOps) and `/incident-response` is available for day-2 (Track E)
