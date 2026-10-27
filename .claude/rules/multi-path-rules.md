---
description: "Multi-path exploration protocol: complexity-gated fan-out into genuinely different parallel candidates, judged against stated criteria and selected (or escalated) before a decision locks in."
paths: ["AI_DOCS/design/flows/**", "AI_DOCS/planning/**", "AI_DOCS/architecture/**"]
---

# Multi-Path Exploration Rules

> Governs the protocol for exploring several genuinely different candidate solutions in
> parallel before committing to one, at decision points where the solution space is wide
> enough to justify it. Companion to `context-efficiency-rules.md` (which governs where
> subagent work runs) and the primary consumer, the Flow Validation Gate under
> `AI_DOCS/design/flows/**`. Origin: PLAN-flow-validation.md Part 3.

## Rule 1: Arm the protocol only at a genuine trigger

Run the multi-path protocol when the current decision matches one of these triggers, because
generating and judging several candidates costs tokens and latency that only pays off when
the solution space is genuinely wide:

- Tier F flow prototyping (the flow validation gate's journey variants)
- an architecture decision with real alternatives (ADR-class)
- complex business logic where the Task Brief's reality-check flags two or more legitimate
  designs
- the operator explicitly asks to explore

Simple, single-answer work never fans out, because there is nothing for parallel candidates
and a judge to compare. When none of the four triggers apply, produce one candidate directly
and skip Frame, Diverge, and Judge entirely.

## Rule 2: Run the five-step protocol in order

1. **Frame**: write one paragraph stating the requirement and the selection criteria before
   generating any candidate, so the criteria a judge scores against are fixed in advance and
   cannot be fitted after the fact to whichever candidate looks best.
2. **Diverge**: dispatch N parallel agents, each assigned a different named lens from the
   catalog in Rule 3, because giving every agent the same prompt produces near-duplicate
   candidates and defeats the purpose of fanning out. N defaults by decision type: journey
   prototyping (the Tier F flow variants `flow-prototypes` generates) defaults to 3, raised
   to 4 or 5 on operator request for a high-stakes flow. Every other decision type defaults
   to 4, and the operator may raise to 5.
3. **Judge**: the matching domain judge (Rule 4) scores every candidate from 1 to 10 against
   the Frame criteria, ranks them, and states what each losing candidate did better than the
   winner, because the winning design often needs to absorb one idea from a runner-up.
4. **Select or ask**: select the clear winner and show the ranking when the judges agree and
   the criteria are met. The ambiguity margin, defined once here for every consumer of this
   protocol: a gap of 1 point or less between the top two candidates' scores, or any judge
   split on the winner. Anything inside that margin goes to the operator as an informed
   question with the concrete trade-off stated (the same informed-question format
   `infrastructure-rules.md` Rule 17 mandates for infra choices), rather than being picked
   silently.
5. **Record**: log the decision, every losing candidate's location, and the reason to
   `AI_DOCS/memory/decision-log.md`. Keep the candidates on disk until the milestone closes
   instead of deleting them, so a later reviewer can see what was considered and why it lost.

## Rule 3: Lens catalog by decision type

Assign each parallel agent a distinct lens from the matching catalog below, so the fan-out
explores genuinely different territory instead of variations on one idea.

| Decision type | Lenses |
|---|---|
| UX flow | guided wizard, single-page progressive disclosure, dashboard-first with drill-in, expert-dense with bulk actions, mobile-first |
| Architecture | simplest-possible, scale-first, cost-first, operability-first |
| Implementation plan | minimal-diff, refactor-first, library-leverage |

## Rule 4: Judge by domain

Route judging to the agent that already owns the domain's verdict, because a domain judge
scores candidates against expertise the framework has already invested in, rather than a
generic reviewer standing in for it:

- UX flow candidates: `principal-designer` together with `ux-advisor`
- Architecture candidates: `solutions-architect`
- Implementation-plan candidates: `quality-lead`

## Rule 5: Candidate and judge agents inherit the session model

Dispatch every candidate and judge agent without a per-agent model override, so each one runs
on whatever model the current session is running. This follows the operator's 2026-08-20
decision to remove model tiering in favor of a single inherited model: quality outranks the
token-cost savings the previous haiku/sonnet/opus tiering bought.

<!-- Version: 1.0.0 | 2026-08-20 | initial: multi-path exploration protocol from PLAN-flow-validation.md Part 3 -->
<!-- Version: 1.1.0 | 2026-08-21 | Rule 2 reconciled with flow-prototypes: journey prototyping defaults to 3 variants (4 or 5 on operator request), every other decision type defaults to 4; judges score 1 to 10 and the ambiguity margin (top-two gap of 1 point or less, or any judge split on the winner) is defined once in step 4 -->
