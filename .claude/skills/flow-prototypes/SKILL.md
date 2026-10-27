---
name: flow-prototypes
description: "Triage every feature into Tier S (standard, skips this skill) or Tier F (flow-validated: 3+ screens in sequence, more than one role, branching outcomes, user-visible business calculations or money movement, state machines driving the UI, or cross-entity relations the user must understand to act). For each Tier F flow, generate 3 clickable HTML journey variants in genuinely different interaction models, judge them with the ux-advisor and principal-designer agents against the ux-brief Role and JTBD table, and record the operator's pick as Gate FLOW PASS before any implementation task tagged with that flow may start. Owns AI_DOCS/design/flow-validation-plan.md and AI_DOCS/design/flows/**. Dispatched by /do Phase 0 after tech-spec (triage mode) and per Tier F flow before its build tasks (prototype and judge modes). Triggers on: 'triage the flows', 'which flows need prototypes', 'prototype this journey', 'clickable journey variants', 'approve the flow', 'Gate FLOW', 'waive this flow'."
effort: xhigh
next_skill: design-screens
required_gate: "Gate FLOW (Flow Validated)"
allowed-tools: "Read Write Edit Grep Glob Task"
skill_id: SK-168
context_budget:
  load_kb: 35
  scope: task
version: 1.0.2
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [tech-specification, ux-foundation]
  optional: [design-direction, design-tokens]
produces:
  - path: AI_DOCS/design/flow-validation-plan.md
    consumers: [do, milestone-planning, gate-enforcement]
  - path: AI_DOCS/design/flows/<flow-id>/variant-a/
    consumers: [ux-advisor, principal-designer, design-screens]
  - path: AI_DOCS/design/flows/<flow-id>/variant-b/
    consumers: [ux-advisor, principal-designer, design-screens]
  - path: AI_DOCS/design/flows/<flow-id>/variant-c/
    consumers: [ux-advisor, principal-designer, design-screens]
  - path: AI_DOCS/design/flows/<flow-id>/index.html
    consumers: [operator, ux-advisor, principal-designer]
  - path: AI_DOCS/design/flows/<flow-id>/chosen.md
    consumers: [design-screens, build, ui-review, milestone-validation]
consumes:
  - path: AI_DOCS/planning/tech-spec.md
    required_sections: [user-flows, user-roles]
  - path: AI_DOCS/design/ux-brief.md
    required_sections: [role-jtbd-table]
  - path: AI_DOCS/design/design-directions/chosen.md
  - path: AI_DOCS/design/design-system/tokens.json
  - path: rules/multi-path-rules.md
trigger:
  - "triage the flows for complexity"
  - "prototype this journey before we build it"
  - "generate clickable journey variants"
  - "judge the flow variants and pick one"
  - "approve Gate FLOW for this flow"
  - "waive this flow from prototyping"
skip:
  - "show design directions"          # use /design-direction (visual direction of one screen, not a flow)
  - "build the production screens"    # use /design-screens (derives from the approved journey, doesn't approve it)
  - "decompose the requirement into roles and jobs"  # use /ux-foundation (upstream, produces the brief this skill reads)
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [domain-specific, iterative, context-aware]
  role: "pre-implementation flow validation gate (Gate FLOW)"
---

# /flow-prototypes: Validate the Journey Before It Gets Built

> **ACT AS:** A UX researcher running a clickable-prototype study, not a designer polishing one screen.
> **WHY THIS EXISTS:** Task achievement and testing pass at 80-85% while journey quality lands around 30%. The existing pipeline validates a single representative screen in grayscale, then a document (mermaid maps, screen briefs) after tokens lock. Nobody ever clicks the actual sequence before code exists. This skill closes that gap for the flows that carry the risk: multi-screen, multi-role, branching, money-moving, state-machine-driven, or relation-heavy journeys get three genuinely different clickable HTML prototypes, judged and approved, BEFORE any task for that flow is allowed to start.

---

## When to Run

Two entry points, driven by state, never by a manual toggle:

1. **Triage (Mode 1)**: `/do` Phase 0 dispatches this in checklist mode once per project, right after `/tech-specification` and after `/ux-foundation` has written `AI_DOCS/design/ux-brief.md`. Re-runs incrementally whenever a milestone introduces new features (new rows appended, existing rows never rewritten).
2. **Prototype + Judge (Modes 2-3)**: dispatched per Tier F flow, before `/do`'s Phase 1 build loop opens any task carrying that flow's `flow:` tag in `tasks.md`.

Do not run without `AI_DOCS/design/ux-brief.md` (the Role x JTBD table Mode 3 judges against) and `AI_DOCS/planning/tech-spec.md` (the flow inventory source). If either is missing, hand back to `/ux-foundation` or `/tech-specification` first.

---

## Pre-flight

Read:
1. `AI_DOCS/planning/tech-spec.md`: user-flows and user-roles sections, the source of the flow inventory.
2. `AI_DOCS/design/ux-brief.md`: the Role x JTBD table Mode 3 scores variants against.
3. `AI_DOCS/design/flow-validation-plan.md` if it already exists: don't re-triage a flow that has a row.
4. `AI_DOCS/design/design-directions/chosen.md` (when `/design-direction` has run): the tokens and interaction philosophy Mode 2 renders on top of.
5. `AI_DOCS/design/design-system/tokens.json` (when `/design-tokens` has run): supersedes the rough direction tokens once locked.
6. `rules/multi-path-rules.md`: the lens catalog and ambiguity-threshold protocol Mode 2 and Mode 3 apply. When a flow lens isn't named there yet, fall back to the vocabulary in Mode 2 below.
7. `AI_DOCS/quality/mock-data/**` or the mock-data conventions (`skills/mock-data/templates/mock-data-standards.md`): realistic seeded data, never Lorem ipsum, for every variant.

---

## Mode 1: Triage (checklist)

Classify every feature in the tech-spec's flow inventory into one of two tiers.

**Tier S (standard)**: single-screen CRUD, plain lists, simple forms, settings pages. Rides the existing design pipeline unchanged and never enters this skill again.

**Tier F (flow-validated)**: promote a feature to Tier F when it matches one or more triggers:
- the journey spans 3 or more screens or steps in sequence
- more than one role participates or hands off within the flow
- branching outcomes exist (approve/reject, retry, partial states, escalations)
- user-visible business calculations or money movement are surfaced to the user
- state machines drive what the user sees (order lifecycle, application status)
- cross-entity relations the user must understand to act (linking, assignment, hierarchies)

Propose the tiering. Do not decide it: present the classification as batched questions, 4-5 flows per batch, and let the operator confirm, promote, demote, or waive each row. A waiver requires a stated reason: capture it, append it to `AI_DOCS/memory/decision-log.md` in the same turn, and append `Gate FLOW <flow-id>: WAIVED (<reason>)` to `AI_DOCS/memory/gate-status.md`, never silently.

When the client supplied designs (Figma branch already fidelity-checked): mark the row `client-gap` instead of Tier S/F when the flow contains journeys the file never drew (mobile behavior, error and edge states, role handoffs). Only client-gap rows get prototyped; the rest of that flow rides the Figma fidelity check.

Write `AI_DOCS/design/flow-validation-plan.md`:

```markdown
# Flow Validation Plan — <project>

| Flow ID | Flow name | Tier | Priority | Status | Chosen variant | Date |
|---|---|---|---|---|---|---|
| flow-order-approval | Multi-step order approval | Tier F | 1 | pending | | 2026-08-20 |
| flow-user-settings | Account settings | Tier S | - | n/a | - | 2026-08-20 |
| flow-refund-request | Refund request | Tier F | 2 | waived | - | 2026-08-20 |

## Waivers
- flow-refund-request: waived by operator, 2026-08-20. Reason: "refund volume is near-zero at launch, revisit post-MVP." Logged in decision-log.md.
```

`Status` moves through `pending -> prototyped -> approved` (or `waived`) as Modes 2-3 complete. This file is the gate's source of truth and survives compaction like every other memory file: never reconstruct it from conversation history, always read it fresh.

**Late promotion owns the retro-tag.** When an incremental re-triage promotes a flow to Tier F after the milestone's tasks were already seeded, this triage session updates the affected tasks' Notes in the milestone's `tasks.md` with the `flow: <flow-id>` tag (milestone-planning's flow-gate tag rule) before the triage session ends. Without the tag, `/do`'s per-task check, `gate-enforcement`, and `hooks/enforce-flow-gate.sh` cannot locate the tasks the promotion is supposed to block, so a promoted flow with untagged tasks is an unenforced gate.

---

## Mode 2: Prototype (per Tier F flow)

Before any implementation task tagged `flow: <flow-id>` may start, generate the clickable variants for that flow.

1. **Frame**: one paragraph stating the flow's requirement (the JTBD it serves, from `ux-brief.md`) and the selection criteria the judge step will score against. Write it before generating a single screen.
2. **Generate 3 journey variants** (raise to 4-5 on operator request for a high-stakes flow). Each variant is a linked set of static HTML pages, hyperlinked so the operator clicks through start to finish, not a single mockup. Every variant covers:
   - the happy path, every branch the triage row identified, and the failure and empty states
   - realistic seeded data per the mock-data conventions, never Lorem ipsum
   - a visible role-switcher bar simulating handoffs when more than one role participates
   - the chosen design direction's tokens (`design-directions/chosen.md` or the locked `tokens.json`) when they exist, or grayscale wireframe fidelity (neutral greys, boxes, real labels, no brand color) when tokens have not landed yet
3. **Each variant is a different interaction model**, never a re-skin of the same layout. Pull the lens catalog from `rules/multi-path-rules.md` first. Fallback lenses when that file has none named for this flow type: guided wizard (linear, one decision per screen), single-page progressive disclosure (one surface, sections reveal as prior ones complete), dashboard-first with drill-in (overview screen, details on demand), expert-dense with bulk actions (power-user density, multi-select operations), mobile-first (touch-primary layout, bottom-sheet patterns).
4. Write each variant to `AI_DOCS/design/flows/<flow-id>/variant-a/`, `variant-b/`, `variant-c/` (each a self-contained set of linked `.html` pages), plus `AI_DOCS/design/flows/<flow-id>/index.html`: a comparison hub linking all variants side by side with a one-line description of each variant's interaction model and role coverage.
5. Flip the plan-file row's `Status` to `prototyped`.

---

## Mode 3: Judge and Approve

1. Spawn `ux-advisor` and `principal-designer` (read-only) on the variants plus `AI_DOCS/design/ux-brief.md`. Each ranks the variants against the Role and JTBD table and states a reason per rank, naming what a losing variant did better even when it loses overall (the winner often absorbs one idea from a runner-up).
2. Present the comparison hub plus the ranked recommendation to the operator. A clear winner (both judges agree, criteria met) is proposed with the ranking shown. Ambiguity, meaning the top two variants are close or the judges split, goes to the operator as an explicit question stating the concrete trade-off. Never pick silently on their behalf.
3. Record the operator's pick in `AI_DOCS/design/flows/<flow-id>/chosen.md`:

```markdown
# Chosen Journey — <flow-id>
Date: YYYY-MM-DD
Picked: Variant <A|B|C>

## Click-path map
1. <role> lands on <screen>, sees <state>
2. <role> takes <action>, branches to <outcome>
...

## Interaction model
<the lens this variant embodies, e.g. "guided wizard">

## Why
- ux-advisor: <ranking + reason>
- principal-designer: <ranking + reason>
- Operator: <what tipped the decision, especially if ambiguous>

## Source
AI_DOCS/design/flows/<flow-id>/variant-<x>/
```

4. Flip the plan-file row's `Status` to `approved`, fill `Chosen variant`, and append `Gate FLOW <flow-id>: PASS (variant <x>)` to `AI_DOCS/memory/gate-status.md` (the canonical spelling `gate-enforcement` reads: colon after the flow id).

### Gate FLOW — Flow Validated (BLOCKING, per flow)

| # | Check | Fail condition |
|---|-------|----------------|
| 1 | Triage row exists | Flow has no row in `flow-validation-plan.md` |
| 2 | Three variants generated | Fewer than 3 (or the operator-requested 4-5) linked HTML variant sets exist |
| 3 | Genuinely different interaction models | Two or more variants share the same lens (a re-skin, not a variant) |
| 4 | Full state coverage per variant | Any variant missing the happy path, an identified branch, or a failure/empty state |
| 5 | Realistic seeded data | Lorem ipsum, `test@test.com`, or placeholder numbers found in any variant |
| 6 | Role handoffs visible | A multi-role flow with no role-switcher bar |
| 7 | Judged with stated reasons | `ux-advisor` or `principal-designer` ranking missing, or a rank with no reason |
| 8 | Operator decided | Ambiguity resolved by a silent pick instead of an explicit question |
| 9 | chosen.md complete | Missing click-path map, interaction model, or reasons |

FAIL blocks the flow's tasks from starting. `/do`'s per-task loop checks the flow's row status in `flow-validation-plan.md` before opening a Task Brief for any task tagged `flow: <flow-id>`, and refuses when the row is not `approved` or `waived`.

---

## Boundaries

- Never generates production code. The output is static HTML for comparison, not a component to ship.
- Never edits locked artifacts (`api-contract.md` after Gate 1 lock, `tokens.json` after Gate 3).
- Tier S flows never pass through Modes 2-3. They ride the existing pipeline unchanged.
- The approved variant becomes the fidelity reference for `AI_DOCS/quality/mavs/fidelity.json` (the same machinery that compares built screens against a client-supplied Figma reference, reused here for the no-client-designs branch) and the click-path `ui-review` walks against the built app.
- This skill does not choose the tech stack, define tokens, or map full-product UX flows (`design-screens` does that downstream, deriving its mermaid flow maps from the approved click-path rather than authoring the approval itself).

---

## Handoff

```
Skill flow-prototypes complete. Memory updated.
Checkpoint: AI_DOCS/design/flow-validation-plan.md, AI_DOCS/design/flows/<flow-id>/** written, Gate FLOW <flow-id>: PASS recorded, safe to compact.

Handing off to: design-screens

Summary of what was decided:
- Flows triaged: <N Tier F, M Tier S, K waived>
- <flow-id>: Variant <X> approved (<interaction model>), reasons in chosen.md
- Gate FLOW <flow-id>: PASS recorded in gate-status.md
```

---

## Examples

### Example 1: Tier F approval walk-through

**User says:** "We're past tech-spec, triage the flows and get the order-approval journey prototyped."

**Actions:**
1. Mode 1: read the tech-spec flow inventory, propose tiers in a batch of 4-5. `flow-order-approval` (requester submits, manager approves or escalates, finance releases payment) matches three triggers: 3+ screens, more than one role, branching outcomes, money movement. Operator confirms Tier F, priority 1.
2. Mode 2: frame the requirement ("a requester submits an order, a manager approves/rejects/escalates it, finance releases payment on approval"). Generate variant-a (guided wizard, one step per screen), variant-b (dashboard-first with drill-in from a pending-approvals queue), variant-c (mobile-first, bottom-sheet approve/reject). Each covers happy path, reject, escalate, and the zero-pending-approvals empty state, with a role-switcher bar for requester/manager/finance.
3. Mode 3: `ux-advisor` ranks B first (matches the manager's stated JTBD: "clear the approval queue fast"), `principal-designer` ranks B first too, agreeing on hierarchy and density. No ambiguity: winner is B.
4. Write `chosen.md`, flip the plan row to `approved`, append `Gate FLOW flow-order-approval: PASS (variant b)` to `gate-status.md`.

**Result:** the operator has a clicked-through, judged journey on record before a single implementation task for `flow-order-approval` opens.

### Example 2: Waiver

**User says:** "Skip prototyping the refund flow for now, it's near-zero volume at launch."

**Actions:**
1. Mode 1 proposed `flow-refund-request` as Tier F (branching outcomes, money movement).
2. Operator declines prototyping with a stated reason.
3. Set `Status: waived` in `flow-validation-plan.md`, append the waiver line under `## Waivers`, append a decision-log.md entry with the exact reason and date, and append `Gate FLOW flow-refund-request: WAIVED (near-zero volume at launch)` to `AI_DOCS/memory/gate-status.md`.
4. `/do`'s per-task check treats `waived` the same as `approved`: tasks tagged `flow: flow-refund-request` are allowed to start.

---

## Troubleshooting

### Error: no ux-brief.md found

**Cause:** `/ux-foundation` has not run yet, so there is no Role x JTBD table for Mode 3 to judge against.

**Solution:** hand off to `/ux-foundation` first. Do not invent roles or jobs to fill the gap.

### Error: two variants converge on the same layout

**Cause:** Mode 2 generated a re-skin (same lens, different colors) instead of a genuinely different interaction model.

**Solution:** regenerate the weaker variant against an unused lens from `rules/multi-path-rules.md` or the fallback list. Gate FLOW check 3 exists precisely to catch this before it reaches the judge step.

### Error: judges disagree and the operator wants a fast answer anyway

**Cause:** a real split between `ux-advisor` and `principal-designer`, not a close-but-ranked case.

**Solution:** do not average the disagreement into a silent pick. Present both rankings with their stated reasons and the specific trade-off (for example, "variant A is faster to build and lower-risk, variant B tests better against the manager's stated JTBD") and let the operator decide with the trade-off in front of them.

## Rules

1. **Triage proposes, the operator decides.** The classifier never silently promotes or demotes a flow.
2. **Always 3 variants minimum, always linked HTML.** A single mockup or a document is not a clickable journey.
3. **Every variant is a different interaction model.** Vary the lens, not just the color or copy.
4. **Waivers require a stated reason, logged.** A silent skip is not a waiver.
5. **Ambiguity goes to the operator with the trade-off stated.** Never a silent pick between close variants.
6. **Gate FLOW blocks per flow, not per project.** A Tier S flow, or an approved/waived Tier F flow, never waits on this skill.

## Next Step

`/design-screens`: derive the full screen inventory and per-role UX flow maps from the approved journey's click-path, rather than authoring the approval itself.

<!-- Version: 1.0.0 — 2026-08-20 — Initial authoring per PLAN-flow-validation.md Part 2 and Part 4 item 1. -->
<!-- Version: 1.0.1 | 2026-08-21 | Canonical gate-status spelling Gate FLOW <flow-id>: PASS (colon after the flow id, matching gate-enforcement), waivers now also write the Gate FLOW <flow-id>: WAIVED line to gate-status.md (waiver path + Example 2), Mode 1 owns the retro-tag for late-promoted Tier F flows (milestone-planning's flow: tag rule), estimation dropped from flow-validation-plan.md consumers. -->

<!-- Version: 1.0.2 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
