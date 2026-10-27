---
name: project-brief
description: "Produce a short document (2 to 4 pages) that explains the full complexity of a project to a chosen audience: what is being built, why it is harder than it looks (hidden challenges, integrations, compliance, scale), the key decisions and their consequences, the live risks, and what the client or team must provide. Always asks audience, purpose, length, and tone before writing a word. Use when someone needs to understand the project fast. Also triggers on: 'project brief', 'summary of the project', 'summary document', 'explain the complexity', 'stakeholder summary', 'onboarding brief'."
next_skill: null
required_gate: null
skill_id: SK-164
context_budget:
  load_kb: 25
  scope: global
version: 1.0.3
dependencies:
  required: []
  optional: [requirement-finalization, workscope, estimation, docx-from-markdown, pptx]
license: Proprietary
compatibility: "Claude Code 1.x"
consumes:
  - path: "AI_DOCS/planning/requirements-baseline.md"
  - path: "AI_DOCS/planning/workscope.md"
  - path: "AI_DOCS/estimation/"
  - path: "AI_DOCS/memory/decision-log.md"
  - path: "AI_DOCS/memory/stack.md"
produces:
  - path: "AI_DOCS/planning/project-brief.md"
    consumers: [docx-from-markdown, pptx]
skip:
  - "full scope document or proposal (use workscope)"
  - "formal PRD or FRD (use prd-generation)"
  - "effort or cost numbers (use estimation)"
  - "summarize one file (use markitdown)"
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  tags: [summary, brief, communication, planning]
---

# Project Brief

A short document that makes one reader understand the project fast: what is
being built, why it is a serious build, what was decided, what could go wrong,
and what happens next. It is the purest exercise of
`rules/document-generation-rules.md`: nothing about it is boilerplate, and its
whole value is that a specific audience can act on it after one read.

`scope: global` is read-only breadth: this skill reads across planning
artifacts and never writes any of them. Its only output is the brief.

## Intake gate (MANDATORY, ask first)

One inline batch, per the intake-gate contract in
`rules/document-generation-rules.md`. Skip anything already evident from the
request, confirm anything inherited from memory:

1. **Audience**: client-facing or team-facing?
2. **Purpose**: build confidence, set expectations, onboard someone, or
   unblock a decision?
3. **Length**: 1-page executive or the standard 2 to 4 pages?
4. **Tone**: client default is plain, confident business English. Team default
   is direct and technical. Confirm, do not assume.
5. **Emphasis**: anything to highlight or leave out?

Two standing rules: pricing and effort numbers are NEVER included unless the
user explicitly asks (route them to the estimation summary instead), and the
brief never breaks client confidentiality boundaries when team-facing content
quotes client material.

## Source harvest

Read in this order, taking what exists and noting what does not:

1. `AI_DOCS/planning/requirements-baseline.md`: decisions, conflicts resolved,
   open items (the complexity story often lives here), and the Section 9
   readiness verdict, which the brief states plainly.
2. `AI_DOCS/planning/workscope.md`: scope fence, milestones, hidden-challenge
   resolutions, NFRs.
3. `AI_DOCS/estimation/estimation-summary-v<N>.md` (latest): assumptions,
   open clarifications, features awaiting clarification, the upper range, and
   the independent-review note. Numbers stay out unless asked.
4. `AI_DOCS/memory/decision-log.md`: project-spanning decisions and their why.
5. `AI_DOCS/memory/stack.md`: the stack and its selection rationale.

Never invent complexity the sources do not support. If the sources are thin
(no workscope yet, empty decision log), say which are missing and either
proceed with the gap flagged in the brief or stop and recommend running the
upstream skill first. A brief built on nothing is fiction with headings.

## Document structure

Both variants share a spine. The vocabulary and the closing sections diverge.

### Client variant

1. **What we are building**: one paragraph, plus who uses it and for what.
2. **Why this is a serious build**: the complexity, stated as consequences,
   not jargon. "Payments settle in two currencies, which doubles the
   reconciliation and compliance surface" rather than "multi-gateway PCI
   scope". Draw from hidden challenges, integrations, compliance, scale.
3. **The decisions that shaped it**: 3 to 6 decisions, each with what was
   decided, why, and what it means for the client.
4. **Risks we are watching**: the top risks and what is being done about each.
   A risk with no mitigation line does not appear.
5. **What we need from you**: credentials, approvals, content, decision
   deadlines, each with when it is needed.
6. **Where it stands**: current stage, next milestone, what happens next.

### Team variant

Sections 1 to 4 as above, in technical vocabulary, then:

5. **What the team must not break**: locked contracts (api-contract.md),
   compliance constraints, architectural invariants, conventions that look
   optional and are not.
6. **Where it stands**: active milestone, active task, how to pick up work
   (pointer to `session-state.md`, not a copy of it).

## Writing standards

`rules/document-generation-rules.md` applies in full: the purpose sentence
before drafting, the human writing standard, the banned-phrase list, evidence
over assertion (every claim traces to a harvested artifact).

The hard length rule: a brief that wants more than 300 lines is not a brief.
Cut it. Never split it into an index and parts. The discipline of cutting is
the product: if something cannot be dropped, it replaces something less
important.

## Validation before delivery

Run the Rule 7 checklist from `rules/document-generation-rules.md`, plus the
brief-specific test: could the named audience repeat the three most important
points after one read? If you cannot name the three points yourself, the brief
does not have them yet.

## Output and handoff

Write `AI_DOCS/planning/project-brief.md`. When both variants are requested,
write `project-brief-client.md` and `project-brief-team.md` instead, and never
let one leak the other's content.

Offer the render path: `/docx-from-markdown` for a client-facing Word document,
`/pptx` when the user wants it as slides (the section spine maps one section
per slide), or leave it as markdown for the team.

```
Skill project-brief complete. Memory updated.
Checkpoint: AI_DOCS/planning/project-brief.md, safe to compact.

Handing off to: (none, on-demand skill)

Summary of what was decided:
- Audience: <client/team>, length: <choice>, tone: <choice>
- <anything emphasized or omitted on request>
```

## Troubleshooting

- **No workscope or baseline exists yet.** Offer two honest options: run
  `/workscope` (or `/requirement-finalization`) first, or write a thin brief
  from the conversation alone with a visible "sources pending" note. Never
  fake depth.
- **The audience wants pricing.** Point at the estimation summary
  (`AI_DOCS/estimation/`). If none exists, offer `/estimation`. The brief
  itself stays number-free unless the user overrides explicitly.
- **The brief keeps growing.** That is scope creep in prose form. Return to
  the purpose sentence, cut every section that does not serve it, and offer
  the overflow as an appendix pointer to the full workscope instead.
- **Both variants requested "quickly".** Write the client variant first, get
  it approved, then derive the team variant. Deriving both at once produces a
  muddled middle tone.
<!-- Version: 1.0.2 | 2026-10-14 | States the requirements-baseline readiness verdict. -->
<!-- Version: 1.0.3 | 2026-10-14 | Reads the estimation v6 summary headings (assumptions, open clarifications, estimate status, upper range, review note). -->
