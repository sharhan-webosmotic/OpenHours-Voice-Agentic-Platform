---
name: ux-foundation
description: "Phase 0 of the design pipeline: decompose the requirement into roles, jobs-to-be-done (outcomes not features), the functional/non-functional split (per-flow perf budgets, accessibility target, security/auth UX, audit/compliance, data residency, i18n), constraints, and measurable UX success metrics. BLOCKING gate: if the roles and their primary jobs cannot be named, stop. Runs after tech-spec, before design-discovery. Triggers on: 'ux brief', 'decompose the requirement', 'who needs to do what', 'jobs to be done', 'define success metrics'."
next_skill: design-discovery
required_gate: "Gate UX-0 (Requirement Decomposed)"
allowed-tools: "Read Write Edit Grep Glob"
skill_id: SK-152
context_budget:
  load_kb: 30
  scope: task
version: 1.0.2
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [tech-specification]
  optional: [prd-generation, workscope]
produces:
  - path: AI_DOCS/design/ux-brief.md
    consumers: [design-discovery, design-direction, design-screens, ux-advisor, accessibility-audit, principal-designer]
consumes:
  - path: AI_DOCS/planning/tech-spec.md
    required_sections: [user-roles, user-flows, ui-ux-requirements, performance, compliance-security]
  - path: AI_DOCS/architecture/database-schema.md
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [sequential, domain-specific]
  role: "design-phase (gate 0, requirement decomposition)"
---

# /ux-foundation: Decompose the Requirement Before Any Design

> **ACT AS:** A principal UX architect who refuses to draw a screen until the requirement is decomposed into who needs to accomplish what, with what permissions, and how success is measured.
> **WHY THIS EXISTS:** Requirement -> UX -> UI is three GATES, not three tasks. The way enterprise UX goes wrong is someone jumping to screens before the structure is settled. This skill is the gate most teams skip: it forces out roles, jobs-to-be-done, the non-functional contract, and success metrics, so every later design decision is arguable against something. A multi-role enterprise app is effectively several products sharing a codebase: an admin, a manager, and an end user are not one design.

This is **Phase 0** of the gated design pipeline:

```
ux-foundation (Phase 0)  ->  design-discovery -> design-direction (grayscale, Gate UX-1) -> design-tokens -> design-screens
   Gate UX-0                                       Gate UX-1                                                 Gate UX-2
```

/ do dispatches this first whenever a frontend is in the stack, after the tech-spec is approved and before any visual work.

---

## What this skill produces

`AI_DOCS/design/ux-brief.md` (template: `templates/ux-brief.md`). It MUST contain, before exit, every section below. A missing section is a Gate UX-0 FAIL.

### 1. Role x JTBD table (outcomes, not features)

One row per role from tech-spec S3. Each job is phrased as an OUTCOME the role needs, not a feature or a screen.

| Role | Job (outcome) | Context (when/where) | Permission scope (from S3 RBAC) | Done-signal (how they know it worked) |
|---|---|---|---|---|
| Manager | Reconcile the day's transactions before close | End of shift, on desktop | read all branch txns, approve adjustments | Ledger balances, zero unresolved exceptions |

Rule: if a "job" reads like a screen ("transactions page") or a feature ("export button"), rewrite it as the outcome the role is trying to reach. **If you cannot name the roles and their primary jobs, STOP: the requirement is not yet designable.**

### 2. Functional vs non-functional split (the UX contract)

- **Functional:** the role-jobs grouped, each traceable to a tech-spec FR.
- **Non-functional contract (where enterprise lives):**
  - **Performance budget per primary flow:** target time-on-task and interaction latency (not just bundle size).
  - **Accessibility target:** WCAG 2.2 AA baseline for the product. Name any flows that require AAA (healthtech/fintech contracts often demand AAA on specific flows: medication, payment, consent). List those flows explicitly.
  - **Security UX obligations:** which fields are sensitive and need masking, which actions need step-up re-authentication, session-handling expectations.
  - **Audit/compliance:** which actions must be logged/visible to the user, which need confirmation or an audit trail.
  - **Data residency:** any region constraint that changes UX (region selector, residency notice).
  - **i18n:** locales, RTL? text-expansion budget (German/Finnish run long)?

### 3. Constraints

Platform targets, greenfield vs an existing design system to extend, tech stack, timeline.

### 4. Success metrics (how you know it worked)

Per top flow, a MEASURABLE target so UX decisions are arguable: task-completion rate, time-on-task, error rate. "Works correctly" is not a metric.

### 5. Multi-role product note

State explicitly that the distinct roles are treated as distinct products sharing a codebase, with the surface count per role. This sizes the design work honestly.

---

## Gate UX-0 — Requirement Decomposed (BLOCKING)

Cannot enter Phase 1 (UX structure) until every row is PASS or `N/A (reason)`.

| # | Check | Fail condition |
|---|-------|----------------|
| 1 | Roles named | Fewer roles than tech-spec S3, or a role with no entry |
| 2 | JTBD per role (outcomes) | Any role whose jobs are written as features or screens, not outcomes |
| 3 | Context + permission per job | A job with no context or no RBAC scope from S3 |
| 4 | Done-signal per job | A job with no observable success signal |
| 5 | Functional/non-functional split present | NFR contract missing perf budget, a11y target, or security-UX obligations |
| 6 | Accessibility target set | No AA baseline, or healthtech/fintech sensitive flows not marked for AAA |
| 7 | Security-UX obligations named | Masking targets and step-up-auth actions not identified |
| 8 | i18n / residency obligations | RTL/text-expansion and data-residency not stated (or N/A with reason) |
| 9 | Success metrics measurable | Any top flow with no task-completion / time-on-task / error-rate target |
| 10 | Multi-role surface count | Per-role surface count not stated |

**STOP RULE:** if checks 1-2 fail (cannot name roles and their primary jobs), halt the whole pipeline. Do not proceed to discovery. The requirement must be sharpened first.

On PASS, write a verdict block to the brief and record `Gate UX-0: PASS` in `AI_DOCS/memory/gate-status.md`, then hand off to `/design-discovery`.

---

## How to run

1. Read `tech-spec.md` (S3 roles, user-flows, ui-ux-requirements, performance, compliance-security) and `architecture/database-schema.md` (entities, for the role-to-data sanity check).
2. Draft `ux-brief.md` from the template, filling every section. Pull roles + RBAC from S3, not from a guess.
3. Where the tech-spec is silent on a non-functional (a11y target, residency, i18n), ASK the user one focused question rather than inventing it, and record the answer in `decision-log.md`.
4. Run Gate UX-0. On FAIL, fix the brief (or stop on the role/JTBD stop-rule). On PASS, record the verdict and hand off.

---

## Boundaries

- Produces the decomposition artifact only. Does NOT pick visual direction (that is `/design-direction`), define tokens (`/design-tokens`), or build screens (`/design-screens`).
- Does NOT choose the tech stack (that is `/do` Step 1.7).
- Reads RBAC from tech-spec S3, never invents roles or permissions.

## Skill Handoff Format

```
Skill ux-foundation complete. Memory updated.
Checkpoint: AI_DOCS/design/ux-brief.md written, Gate UX-0 PASS recorded, safe to compact.

Handing off to: design-discovery

Summary of what was decided:
- Roles and primary jobs: <list>
- Non-functional contract: <a11y target, security-UX, i18n, residency>
- Success metrics per top flow: <list>
```
