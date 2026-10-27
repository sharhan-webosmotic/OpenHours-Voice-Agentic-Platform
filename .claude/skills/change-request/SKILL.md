---
name: change-request
description: "Handle mid-flight feature additions not in the tech spec. Update spec first, then task tracking. Use when a user asks to add a feature during development. Also triggers on: 'Add new feature', 'Change request'."
effort: xhigh
next_skill: null
required_gate: null
skill_id: SK-010
context_budget:
  load_kb: 30
  scope: task
version: 2.2.0
dependencies:
  required: [tech-specification]
  optional: [build, gate-enforcement]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Change Request (CR) Protocol

> **Purpose**: Enforce strict documentation compliance when adding features mid-flight
> **Audience**: All agents responding to ad-hoc feature requests
> **Trigger**: User requests a new feature outside the original `tech-spec.md` scope

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## The Problem: Documentation Drift

In Production-Grade environments, adding features without proper planning leads to:

1. **Ghost Features**: Code exists in `src/` but is not documented in `tech-spec.md` → QA cannot validate
2. **Spec Drift**: UI code written without updating the Technical Specification → frontend/backend misalignment
3. **Guardrail Gap**: New features introduce security/validation requirements that are missed

---

## The Solution: Impact Propagation Protocol

Any change (new feature, changed requirement, removed feature, stack change, compliance change) ripples through the planning artifacts. Old docs in `AI_DOCS/` go stale unless every dependent is found and updated. The **traceability matrix** (`spec/21-traceability.md`) is the index that makes this deterministic: it maps each requirement to its screens, endpoints, tables, tests, and infra, so a change to any node yields the exact set of stale downstream artifacts.

Whenever a change is requested, **STOP** and execute the five steps below.

### *** OPERATIONAL OVERRIDE: IMPACT PROPAGATION PROTOCOL ***

**Objective:** Apply a change while keeping the WHOLE plan (`tech-spec.md` + design + infra + milestones + tests) consistent, not just Section 2.

---

#### Step 1: Classify the change

| Type | Typical blast radius |
|------|----------------------|
| New feature | S2 scope, S5 UI, S6 API, S7 schema, S18 tests, S21 trace, design screens, milestone tasks |
| Changed requirement | the existing trace row + every artifact it points to |
| Removed feature | trace row + its screens/endpoints/tables/tests → mark for removal, not silent delete |
| Stack change | S16, `stack.md`, infra-plan, possibly api-contract + schema |
| Compliance change | S20 matrix, audit-log paths, infra-plan (encryption/residency), Activation Map |

**Intake from the scope check.** A recommendation that arrived labelled `Out of scope: ... Important because ...` (the Rule 9 check in `rules/advisor-stance-rules.md`) enters here. Record in the CR the scope line that was missing (the baseline R-NNN or workscope section checked), the reason it matters (the "Important because" text), and whether the client or the operator raised it. The client addendum in Step 5 quotes both the missing scope line and the reason.

#### Step 2: Walk the traceability matrix to find ALL stale artifacts

1. Open `AI_DOCS/planning/spec/21-traceability.md`. Find the affected requirement row(s).
2. From each row, collect every dependent: tech-spec sections (incl. S20-S23), `architecture/api-contract.md`, `architecture/database-schema.md`, design artifacts (`design/sitemap.md`, `navigation.md`, `onboarding-flow.md`, `screens/`), `infra/infra-plan.md`, milestone `capsule.md` + `tasks.md`, test cases (S18), and the Activation Map (`memory/active-skills.md` — a new LLM/i18n/etc. dimension may arm a new skill).
3. Mark each dependent that needs editing with a `<!-- STALE: <reason>, since <YYYY-MM-DD> -->` marker at the top of the relevant section.

#### Step 3: Produce a Change Impact Report

Write `AI_DOCS/planning/change-impact/CR-<NNN>.md`:

```markdown
# Change Impact Report — CR-<NNN>
Date: <YYYY-MM-DD>  |  Type: <new feature | changed | removed | stack | compliance>
Requested: "<user's words>"
Scope version: v<X.Y> → v<X.Y+1>

## Stale artifacts (must update before code resumes)
| Artifact | Section/file | Edit needed |
|----------|--------------|-------------|
| tech-spec | S6 api-contract | add POST /users/avatar |
| schema | users table | add avatar_url |
| design | screens/profile | add upload control + states |
| trace | R-014 | new endpoint + screen mapping |
| activation map | ai-cost-guard | (only if change adds LLM) |

## Estimate impact (never omit — "no impact" must be stated and justified)
| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Tasks in affected milestone(s) | N | N+x | +x tasks (added/removed/modified listed below) |
| Effort | <hours or task-days> | <hours> | +<delta> |
| Milestone end date(s) | <date> | <date> | +<days> |
| Cost (if billed) | <amount> | <amount> | +<delta> |

Added: <task titles> | Removed: <task titles> | Modified: <task titles>

## Newly armed skills (Activation Map delta)
- <none | skill: why>
```

#### Step 4: Update every stale artifact, then refresh the index

1. Edit each artifact listed in the report. Honor api-contract.md lock: if it is LOCKED, this protocol IS the authorized path to change it (record the change in the report + spec Change Log). `hooks/enforce-api-contract-lock.sh` blocks the edit while the lock is armed, so lift it, edit, and restore it in ONE commit:
   - Lift: add this row to `AI_DOCS/memory/gate-status.md`, or set an existing `api-contract.md lock` row to it: `| api-contract.md lock | CR-<NNN> | LIFTED |`. A dedicated LIFTED row wins over a `Gate 1 | LOCKED` row.
   - Edit `AI_DOCS/architecture/api-contract.md`.
   - Restore: change the same row to `| api-contract.md lock | CR-<NNN> | LOCKED |`.
   - Record the change request id and reason in `AI_DOCS/memory/decision-log.md`. Never write the contract through a Bash redirect to get past the lock.
2. Refresh `spec/21-traceability.md` so the new/changed rows are accurate.
3. Re-derive the Activation Map if the change adds a dimension (LLM, i18n, payments, compliance).
4. Remove every `<!-- STALE -->` marker you resolved.
5. Append a spec Change Log entry (version, date, sections changed, reason).

#### Step 5: Re-baseline the plan + scope version + client addendum

A change request that updates the spec but not the timeline is a hidden slip. After the artifacts are updated:

1. **Re-baseline milestones**: add/remove/adjust the affected `tasks.md` rows, write the new task IDs into the S21 Task ID column, and recompute the affected milestone's task count and end date. If a CR adds more than ~20% to a milestone's tasks, re-run `milestone-planning` for that milestone instead of patching it.
2. **Bump the scope version**: append one row to `AI_DOCS/planning/requirement-changelog.md` (template in this skill's `templates/`): version, date, CR ID, type (added/removed/modified), summary, estimate delta, approval status. Removals get a row too — scope that quietly shrinks is as much a drift as scope that grows, and removals need the same PD-SCOPE sign-off as additions.
3. **Client addendum** (whenever the project has a client-facing workscope OR any timeline/cost delta is non-zero): write `AI_DOCS/planning/change-requests/CR-<NNN>-addendum.md` in client language: what was agreed (scope version reference), what changes (for a Rule 9 intake, quoting the missing scope line and the reason it matters), the new timeline/cost, and an approval line. Offer to convert it via `docx-from-markdown` for sign-off. The CR is not APPLIED until the user confirms the addendum was accepted (or explicitly waives client sign-off, logged in decision-log).

#### Step 6: Re-run the Planning Completeness Gate, then resume

1. Run `gate-enforcement` Gate 1 (Planning Completeness). It must PASS (no blank dimension, no leftover STALE marker) before code resumes.
2. Only then let `/build` proceed against the re-baselined tasks.

**You are PROHIBITED from writing production code until Steps 1-6 are complete and the user approves the impact report.**

---

## Usage Example

**User Request (mid-build):** "Add profile picture upload"

**Agent Response:**
```
Impact Propagation Protocol triggered. Classifying: new feature.

Walked traceability (R-014 Profile). Stale artifacts:
- S6 api-contract: + POST /api/users/avatar
- S7 schema: users.avatar_url
- S5 UI / design/screens/profile: upload control + loading/empty/error states
- S18: TC-USER-012 (upload ok) + TC-USER-013 (size validation)
- S21 trace: new endpoint + screen mapping
- Activation map: no new skill armed (no LLM/i18n added)

Wrote AI_DOCS/planning/change-impact/CR-007.md.
Estimate impact: +2 tasks in M02, +1 day on the M02 end date. Scope v1.2 → v1.3.
Updating the 5 stale artifacts, re-baselining M02 tasks.md, appending the
changelog row, and drafting CR-007-addendum.md for your client sign-off.
Then re-running Gate 1.
Please confirm the impact report before I proceed to implementation.
```

---

## Critical Rules

| Rule | Description |
|------|-------------|
| **Propagate, don't patch** | A change updates EVERY dependent artifact found via the traceability matrix, not just S2 scope |
| **Traceability is the index** | Always walk `spec/21-traceability.md`; never guess the blast radius |
| **STALE then clean** | Mark dependents STALE, update them, then clear the markers — leftover STALE markers fail Gate 1 and block /build and /ship |
| **No Code Without Sync** | Production code is prohibited until the impact report is applied and Gate 1 re-passes |
| **Change Log** | Every change appends a Change Log entry (version, date, sections, reason) |
| **Re-arm skills** | If the change adds a dimension (LLM, i18n, payments, compliance), re-derive the Activation Map so the right skill auto-triggers |
| **Re-baseline, always** | Every CR states its estimate impact (tasks, effort, dates, cost) — "no impact" must be stated and justified, never implied by omission |
| **Removals are CRs too** | Dropping a feature walks the same protocol: trace walk, PD-SCOPE sign-off, changelog row, client addendum |
| **Scope is versioned** | requirement-changelog.md carries one row per CR with a version bump — the delivered scope at ship time is the latest version the client approved, verified by Gate 5 |

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/development-rules.md` — spec-first (CR must update spec before coding)

## Integration Points

- **Developer Skill**: `build` (Phase 3.5: Check for CR before execution)
- **Designer Skill**: `design-system` (Gate 5: Verify FR-ID exists)
- **QA Skill**: `qa-testing` (Phase 2: Reject tasks without FR-ID)

---

*Last Updated: 2026-01-30*  
*Version: 1.0.0*  
*Part of AI_PROMPT Framework*

## Next Step
Proceed to the next skill in the workflow as indicated in the YAML frontmatter.

<!-- Version: 2.1.3 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 2.2.0 | 2026-10-22 | Step 1 intake for Out-of-scope recommendations from the Rule 9 scope check -->
