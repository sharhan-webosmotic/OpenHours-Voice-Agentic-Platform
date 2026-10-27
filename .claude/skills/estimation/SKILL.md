---
name: estimation
description: "Produce a simple, defensible effort estimate: scope strategy (full quote, client MVP, or MVP-first by default) with releases (MVP committed, future phases tentative and never blended in), feature prioritization (P0 to P3), task decomposition with typed minimum hours per role (UI/UX, Frontend, Backend, AI, Mobile, DevOps, QA, PM), separate scope buckets, an independent review, a live 15-check Validation sheet and a provisional per-role ETA. No margin, no markup. Also triggers on: 'Generate estimation', 'Estimate project', 'Build XLSX estimation', 'Ballpark this'."
effort: xhigh
next_skill: null
required_gate: null
skill_id: SK-162
context_budget:
  load_kb: 14
  scope: task
version: 6.2.0
dependencies:
  required: [xlsx]  # SK-108
  optional: [requirement-finalization, workscope, tech-specification, task-planner, milestone-planning, change-request]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# Estimation Skill

> **Purpose**: turn a scope source into a feature-prioritized, task-level
> estimate that a client can read and a delivery lead can defend. One number per
> task (the minimum realistic hours, no buffer), an optional max, a confidence
> and an assumption. Totals, buckets and checks are live Excel formulas.
>
> **Releases (v6.1)**: every milestone belongs to a release and is either
> Committed or Tentative. The committed number (the MVP in cases B and C, the
> full scope in case A) is the figure we lead with. Future phases are estimated
> the same way, shown per release with their own hours and upper range, and
> never added into the committed number.
>
> **What this version does not do**: no dual Developer and AI-assisted track, no
> statistical spreads, no calibration store, no margin, no markup, no percentage
> overheads. PM, QA and DevOps are typed hours like every other role. Risk shows
> up as the estimate status per feature and the "Upper range (not committed)"
> line, never as a hidden factor.

---

## Memory Protocol

Scope `task`. Read the global memory files plus the planning artifacts below.
Do not load milestone capsules: the estimate is built from the spec, not from
in-flight task state.

**Read first**
- `AI_DOCS/memory/project-context.md`: identity, platform targets. Confirm what is recorded, never re-ask it.
- `AI_DOCS/memory/stack.md`: confirmed stack and `compliance:`. Read only. Choosing a stack here would bypass Gate 1, so a missing stack routes to stack selection first.
- Scope source, best first: `AI_DOCS/planning/requirements-baseline.md`, `AI_DOCS/planning/workscope.md`, `AI_DOCS/planning/tech-spec.md` with `AI_DOCS/architecture/api-contract.md`, `AI_DOCS/planning/prd.md`, then a feature list from the user.
- `AI_DOCS/design/screens/` when present: the screen inventory sizes UI/UX and Frontend tasks.
- The scope strategy decision card: `AI_DOCS/planning/scope-strategy.md` (read it first), plus `AI_DOCS/planning/workscope-intake.md` for the output choices. The classification rules live in `skills/workscope/SCOPE-STRATEGY.md`. Read the case, the MVP list and the future list from the card, never re-decide them.

**Write**
- `AI_DOCS/estimation/intake-notes.md`: append after every question batch, so a compaction resumes from the file.
- `AI_DOCS/memory/decision-log.md`: one row per estimate version (scope case, Committed hours and upper range, Tentative hours per release, unestimated count, ETA status).
- `AI_DOCS/memory/session-state.md`: next action, when the session ends mid-intake.

Never write `AI_DOCS/architecture/api-contract.md`. It is locked after Gate 1.

---

## Outputs

```
AI_DOCS/estimation/estimation-v<N>.json          input data (schemaVersion 3)
AI_DOCS/estimation/estimation-v<N>.xlsx          the 5-sheet workbook
AI_DOCS/estimation/estimation-summary-v<N>.md    markdown summary (read by project-brief)
AI_DOCS/estimation/intake-notes.md               running log of answered batches
```

Versioning: the first estimate is v1. A re-estimate after a scope change bumps
N and adds a decision-log row naming what changed. Never overwrite a version
that has been shown to anyone, because the next conversation about it will be
about which number was quoted. Scope changes normally arrive through
`/change-request`, which updates the spec first.

---

## Step 1: Intake

**1a. Locate the scope source** (list in Memory Protocol). With no source and no
feature list from the user, stop and run `/workscope` first: an estimate of an
undescribed project traces to nothing and still gets quoted.

**1b. Read the requirements baseline when it exists.** `requirement-finalization`
writes `AI_DOCS/planning/requirements-baseline.md` with:

- Section 9 "Readiness verdict" (`Ready to scope`, `Ready with qualified assumptions`, `Not ready`). Read it first. On `Not ready`, warn the user in one line, name the open items it lists, and offer to run `requirement-finalization` before estimating. Proceeding anyway is the user's call, logged in intake-notes.
- A Basis tag on every `R-NNN` row (`Verified`, `Assumption`, `Open`, `Proposed`) and Section 8, a completeness matrix (`Defined`, `Partial`, `Missing` per feature).

Map them to the estimate, never to hours:

| Baseline signal | Estimate effect |
|---|---|
| A feature with any `Missing` cell, or resting on an `Open` row | `estimateStatus: "Awaiting Clarification"`, usually `recommendation: "Needs Clarification"` |
| A feature with `Partial` cells, or resting on `Assumption` rows | `estimateStatus: "Provisional"`, the assumption copied into the task rows |
| All cells `Defined` and rows `Verified` | `estimateStatus: "Confirmed"` |
| A `Proposed` row | a feature with `source: "Recommended"` (only when the client approved it) or an entry in `recommended`. Never silently in committed scope. |

Do not add contingency for any of this. The signal is the estimate status plus
the upper range.

**1c. Confirm the setup in one batch**: project name, client, date, hours per
day (default 8), milestones (id and name, in delivery order), any role outside
the eight fixed ones (for example data migration, which becomes an `otherRoles`
entry), and whether a team plan exists (start date and people per role). No team
plan means no schedule block, and every ETA reads "Pending scheduling inputs".
Never invent dates.

**1d. Scope strategy (BLOCKING, before any feature table).** For a ballpark the
order is scope strategy, then estimate, then the ballpark document. For a final
quote it is scope strategy, workscope, estimate, then the cost cross-check.

- When `AI_DOCS/planning/scope-strategy.md` exists, it sets `project.scopeCase`, each milestone's `release` and `commitment`, and which features sit in the MVP and which in future phases. Reuse it, do not ask again.
- When it is absent (for example estimation runs first for a ballpark), run the same classification defined in `skills/workscope/SCOPE-STRATEGY.md` and show the operator ONE decision card: the case, the proposed MVP list, the proposed future list, the evidence for each feature (source document and line), and the recommended default, before estimating. Save it to `AI_DOCS/planning/scope-strategy.md`. Never decide silently. When the case is ambiguous, the card lists the options instead of picking one.
- **A. Full quote** (the client asked for a quote for everything): one release, `release: "Full scope"`, every milestone Committed.
- **B. Client-defined MVP** (the client named an MVP, first release or phase 1): MVP milestones Committed and strict, the rest Tentative future phases.
- **C. MVP-first, the DEFAULT** whenever the client has not asked for a full quote: we propose the MVP as the features the client most wants to release or validate first (interest signals: repeated, listed first, marked must or priority or launch, emphasized in the latest document, tied to a deadline or a validation goal, each one cited), plus everything that first release needs to run in production. The rest becomes Phase 2, Phase 3, each Tentative.
- **Never strip essentials from the MVP to lower the number**: the primary user journey, authentication, roles, security, privacy, data integrity, deployment and monitoring stay in the committed release. A smaller honest entry number is the goal, a hollow one is not.
- Lead with the committed figure and hide nothing: future phases always appear with their tentative cost. A cost range is shown to the client only when the client asked for one.
- Record the decision in intake-notes and set `project.scopeCase`, each milestone's `release` and `commitment`, and each feature's `scopeDecision`.

MVP changes which tasks exist (fewer edge cases, simpler infrastructure), never a
multiplier on hours.

---

## Step 2: Feature prioritization

Build the feature list from the scope source and present it as one table for
confirmation: ID, name, source, priority, recommendation, reasoning, milestone,
scope status, depends on.

**Priority**

| Priority | Meaning |
|---|---|
| P0 | Product cannot launch or is unsafe without it (core workflow, auth, data protection, legal) |
| P1 | Needed for the first release to deliver its promised value |
| P2 | Valuable, can follow the first release without breaking it |
| P3 | Nice to have, low evidence of demand |

**Recommendation**

| Recommendation | Use when |
|---|---|
| Build Now | P0, or P1 with clear requirements and no blocking dependency |
| Build Next | Valuable but waiting on a dependency, a decision or an evaluation set |
| Defer | Valid but belongs in a later phase. Scope status `Deferred`. |
| Skip | Low value or harmful to the product. Scope status `Excluded`. |
| Needs Clarification | Cannot be sized or prioritized yet. Scope status `Pending`. |

Rules (BLOCKING):
- Never recommend Skip on effort alone. A Skip reason names low value, no evidence of demand, or a risk. Expensive and important means Build Next or a smaller first slice.
- Never Skip or Defer security, privacy, authentication, authorization, compliance or production readiness work (backups, monitoring, release). It is P0 or P1.
- Every Included feature has a priority. A feature that depends on something Deferred, Excluded, Pending or missing is flagged on the Summary.
- Scope status and milestone commitment decide the bucket together: `Included` in a Committed milestone is committed, `Included` in a Tentative milestone is a future phase (tentative), `Pending` is proposed, `Deferred` (not planned in any phase) and `Excluded` are reported separately and never committed.
- An Included feature in a Committed milestone is P0 or P1, or its reasoning says why it belongs in the first release (Validation check 14 turns REVIEW otherwise).
- A feature the scope decision marked Tentative never sits in a Committed milestone (check 13 FAILs, because its hours would leak into the committed number).

**Suggested capabilities checklist.** Judge each item for this project as
mandatory, recommended, optional or not applicable, and record the judgement in
intake-notes. Only recommended and mandatory-but-missing items go into the
`recommended` register (category, problem, priority, release, effort, risk if
omitted, rationale, approval `Proposed`). A register item never adds hours. It
counts only after the client approves it and it is added as a real feature with
`source: "Recommended"` and tasks.

- Loading, empty and error states
- Accessibility and responsive layouts
- Role-based access control
- Audit trail
- AI output evaluation (a labelled test set)
- Prompt and model version tracking
- AI fallback and retry
- AI usage limits and cost monitoring
- AI output feedback from users
- Logging, monitoring and alerts
- Backups and tested recovery
- Product analytics
- Admin and support tools
- Push notifications and offline mode, only when the use case justifies them

---

## Step 3: Work-package decomposition

For each Included, Pending and Deferred feature, list tasks across the full
delivery lifecycle, not development alone. Future-phase features are estimated at
feature level with real tasks, exactly like MVP features, and sit in Tentative
milestones. A future phase gets its own SHARED work (PM cadence, regression,
release) in its own milestone. Checklist from the delivery playbook:

- **Design**: business analysis, UX, solution and technical design
- **Implementation**: development, configuration, scripts, integrations, data migration
- **Testing**: unit, integration, system, regression, performance and UAT support as applicable
- **Defect fixing**: triage, fixes and retest
- **Release**: deployment, rollback plan, release coordination, smoke test
- **Documentation and handover**: user guide, technical notes, training, operational handover
- **Stabilization**: hypercare or warranty, only when agreed

Cross-feature work (project setup, CI/CD, design system, PM cadence, regression,
release, handover) is a task with `feature: "SHARED"` and an explicit milestone,
written once. Never spread it into each feature as well: that is the most common
double count.

**Per-task record**

| Field | Rule |
|---|---|
| task | Names what is built, specific enough that two people would size the same work |
| role | `UIUX`, `Frontend`, `Backend`, `AI`, `Mobile`, `DevOps`, `QA`, `PM`, or an `otherRoles` id |
| minHours | The committed number: minimum realistic hours, no buffer. `null` when it cannot be sized yet (shown as Unestimated, never as zero) |
| maxHours | Optional. The realistic upper bound, used only for the upper range line |
| confidence | `High`, `Medium`, `Low` |
| assumption | What must be true for the hours to hold (scope, basis, dependency) |

Ask for hours the spec-then-options way: state what the task covers (screens,
endpoints, states, rules), propose a minimum, and let the person who will build
it confirm or correct. Never ask an open "how many hours" about an undefined
thing. Answer batches per milestone, appended to intake-notes.

---

## Step 4: Independent estimate review (BLOCKING, before the workbook)

Write the draft `estimation-v<N>.json`, then challenge it. Dispatch a read-only
reviewer subagent (`explorer`, or `qa-lead` when available) with the JSON, the
scope source and this brief, adapted from the delivery playbook:

> Act as a senior business analyst, solution architect, delivery manager and QA
> lead. Review this work breakdown and estimate.
> 1. Name missing tasks and lifecycle activities (design, integration, testing, defect fixing, release, documentation, handover).
> 2. Name assumptions that are not verified by the scope source.
> 3. Find double counting, especially SHARED work repeated inside features.
> 4. Check effort is kept separate from duration: no task hides waiting time.
> 5. Flag tasks needing a spike, code inspection, vendor input or a stakeholder decision.
> 6. Check every Skip has a non-effort reason and no security, privacy, auth, compliance or production-readiness work is skipped or deferred.
> Do not fill gaps silently. Mark unknowns and their impact. Do not invent historical productivity data.

If no subagent is available, run the same brief inline as a separate pass. Fix
the JSON (add tasks, set `minHours: null` where sizing is not possible, move
items between buckets) and keep a short review note: findings, what changed,
what stays open. The note goes into the summary markdown.

---

## Step 5: Effort, person-days and calendar ETA

- **Effort**: person-hours of work. The only thing typed into the workbook.
- **Person-days**: effort / hours per day. Still effort, not elapsed time.
- **Calendar ETA**: elapsed working days. Never total effort divided by team size.

With a `schedule` block, each milestone's working days are the maximum over
roles of `role hours / (people x hours per day)`, rounded up, and milestones run
in sequence from the start date via `WORKDAY` (weekends skipped, no holidays).
Committed milestones are scheduled first and tentative milestones after them.
The table shows a "Committed delivery date (provisional)" and a separate
"Tentative phases end (provisional, not a commitment)". It is labelled
"Provisional: roles in parallel within a milestone, milestones in sequence,
committed milestones first and tentative milestones after". A role with hours and no people is a staffing gap and
turns Validation check 5 to REVIEW. Without a schedule block every ETA cell reads
"Pending scheduling inputs". The feature-level Calendar ETA always reads
"Pending scheduling inputs".

---

## Step 6: Input JSON (schemaVersion 3)

```json
{
  "schemaVersion": 3,
  "project": {"name": "", "client": "", "preparedBy": "WebOsmotic", "date": "YYYY-MM-DD", "hoursPerDay": 8,
    "scopeCase": "C"},
  "milestones": [{"id": "M1", "name": "MVP: Core", "release": "MVP", "commitment": "Committed"},
    {"id": "M3", "name": "Phase 2: Insights", "release": "Phase 2", "commitment": "Tentative"}],
  "otherRoles": [{"id": "Migration", "name": "Data migration"}],
  "features": [{"id": "F01", "name": "", "description": "", "source": "Client Requirement",
    "priority": "P0", "recommendation": "Build Now", "reasoning": "", "milestone": "M1",
    "scopeStatus": "Included", "scopeDecision": "Committed", "dependsOn": ["F02"],
    "estimateStatus": "Confirmed"}],
  "tasks": [{"feature": "F01", "task": "", "role": "Backend", "minHours": 6, "maxHours": 10,
    "confidence": "High", "assumption": ""},
    {"feature": "SHARED", "milestone": "M1", "task": "", "role": "PM", "minHours": 8,
    "confidence": "High", "assumption": ""}],
  "recommended": [{"id": "R01", "feature": "", "category": "Security", "problem": "",
    "priority": "P1", "release": "Initial Release", "effortHours": null, "dependsOn": "",
    "riskIfOmitted": "High", "rationale": "", "approval": "Proposed"}],
  "schedule": {"startDate": "YYYY-MM-DD", "people": {"Frontend": 1, "Backend": 1, "QA": 1}}
}
```

Enums: source `Client Requirement | Recommended | Future Enhancement`, scope
status `Included | Deferred | Excluded | Pending`, estimate status `Confirmed |
Provisional | Awaiting Clarification`, category `Product | UX | AI | Security |
Mobile | Infrastructure | Analytics | Operations`, release `Initial Release |
Phase 2 | Future`, approval `Proposed | Approved | Rejected | Pending`. A feature
task takes its milestone from the feature. A SHARED task must name one.
`schedule` is optional.

Release fields (v6.1, additive, schemaVersion stays 3):
- `milestones[].release`: free text label. The first release is "MVP" in cases B and C, "Full scope" in case A. Defaults to "Full scope" when absent.
- `milestones[].commitment`: `Committed | Tentative`. Defaults to `Committed` when absent, so v6.0 files still build. A defaulted field turns check 15 to REVIEW.
- `project.scopeCase`: `A | B | C`, optional, printed on the Summary.
- `features[].scopeDecision`: `Committed | Tentative`, optional, what the scope strategy decided for the feature. It never moves hours. It lets check 13 catch a tentative feature placed in a committed milestone.

Reference fixtures: `examples/estimation-example-v3.json` (case C: two committed
MVP milestones and a tentative Phase 2, with schedule) and
`examples/estimation-example-v3-no-schedule.json` (no release fields, proves the
defaults).

---

## Step 7: Build and verify the workbook

Run the committed generator. Never write a per-project workbook script: a format
change is a framework change to `EXCEL-FORMAT.md` and the generator together.

```bash
python3 .claude/skills/estimation/scripts/build_workbook.py \
    AI_DOCS/estimation/estimation-v<N>.json AI_DOCS/estimation/estimation-v<N>.xlsx
python3 .claude/skills/estimation/scripts/build_workbook.py --selftest
```

The build prints input warnings (unknown role, unknown feature, Skip on an
Included feature), then evaluates every formula in Python
(`scripts/formula_eval.py`) and compares each total, bucket, count, ETA date and
Validation result with a recomputation from the JSON. Any mismatch raises
instead of writing a quietly wrong file. Sheets and checks: `EXCEL-FORMAT.md`.

**Excel recalculation check.** openpyxl writes formulas without cached values,
so open the file once in Excel (or LibreOffice) before sharing. On Windows the
check can be scripted through COM: open, `CalculateFull()`, scan every UsedRange
for `#REF!`, `#NAME?`, `#VALUE!`, `#N/A`, `#DIV/0!`, read the Validation results
and the Summary buckets, save, then `Quit()` and release the COM object. Any
FAIL is fixed in the JSON before the estimate goes anywhere. A REVIEW is allowed
when it is explained in the summary (for example an unestimated task waiting on
a vendor decision).

---

## Step 8: Summary markdown

Write `AI_DOCS/estimation/estimation-summary-v<N>.md`. `project-brief` reads the
latest one for risks, confidence drivers and assumptions, so keep these headings:

```
# <Project> estimate v<N>
## Scope strategy       the case (A, B or C), why, and the evidence behind the MVP list
## Releases             per release: commitment, hours, person-days, upper range. The Committed figure first,
                        then each tentative phase. Never one blended number (a combined figure only when
                        labelled "Committed + tentative (not a commitment)")
## Scope buckets        Committed, Future phases (tentative), Proposed (Pending + recommended),
                        Deferred (not planned in any phase), Excluded hours, Unestimated count
## Role totals          committed hours and person-days per role, plus the total
## Features by estimate status   Confirmed / Provisional / Awaiting Clarification, with priority and recommendation
## Assumptions          the load-bearing task and feature assumptions
## Open clarifications  Pending features, null-hour tasks, unresolved dependencies, baseline open items
## Upper range          the "Upper range (not committed)" figure and what drives it
## ETA status           provisional milestone dates, or "Pending scheduling inputs"
## Independent review   the Step 4 note: findings, what changed, what stays open
## Validation           the 15 results from the recalculated workbook
```

Every number in it comes from the recalculated workbook. No margin, no markup,
and no figure that does not trace to a task row.

---

## Critical rules

- Tasks is the only place hours are typed. Every other number is a formula.
- `minHours` is committed, `maxHours` only feeds the upper range. A null is Unestimated, never zero.
- No margin, markup, buffer, contingency percentage or role percentage, anywhere.
- SHARED work is written once with an explicit milestone.
- A recommended item is never in committed hours until it becomes a feature with tasks.
- Tentative future-phase hours are always shown and never added into the committed number.
- MVP-first is the default when the client has not asked for a full quote, and the MVP never loses auth, roles, security, privacy, data integrity, deployment or monitoring to look cheaper.
- Never invent dates, team sizes or historical productivity.
- Never Skip on effort alone, and never Skip or Defer security, privacy, auth, compliance or production readiness.

## Inspect before handoff

The Excel recalculation check above (COM `CalculateFull()`, error-cell scan, Validation read) is the inspection for the workbook. Report it in the handoff block of `rules/document-generation-rules.md`: Opened (sheets, formulas recalculated, 0 error cells, result of the 15 Validation checks), Found and fixed, and Please verify items only the operator can judge: 1) hour totals per role against their sense of the work, 2) the milestone split, 3) which items are labeled committed and which tentative.

<!-- Version: 6.1.0 | 2026-10-14 | MINOR: releases (MVP committed, future phases tentative), scope strategy intake (cases A, B, C, MVP-first default, workscope SCOPE-STRATEGY.md), milestone release and commitment, project.scopeCase, feature scopeDecision, Committed and Tentative subtotals, per-release buckets, committed-first ETA, Validation checks 13 to 15, five negative selftests. -->
<!-- Version: 6.0.0 | 2026-10-14 | MAJOR rewrite: simple 5-sheet workbook (Summary, Features, Tasks, Recommended, Validation), schemaVersion 3, feature prioritization, scope buckets, live validation, provisional per-role ETA, independent estimate review, requirements-baseline readiness mapping. Removed dual track, PERT stats, calibration, margin. -->

<!-- Version: 6.1.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 6.2.0 | 2026-10-22 | Inspect before handoff: cites Excel recalculation and Validation sheet, adds Please verify items -->
