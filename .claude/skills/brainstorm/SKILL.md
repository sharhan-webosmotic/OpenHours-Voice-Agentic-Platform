---
name: brainstorm
description: "Pre-requirements ideation skill. Explore an idea from multiple angles before committing to workscope. Covers business model, customer segmentation, revenue models, hosting cost-at-scale, MVP prioritization, and competitive positioning. Use before workscope when answering 'should we build this and how?'"
allowed-tools: Read Grep Glob Write
skill_id: SK-096
context_budget:
  load_kb: 30
  scope: task
version: 1.1.0
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# /brainstorm — Pre-Requirements Ideation

> **Purpose**: Explore an idea from multiple angles before the scope is fixed. Answer "should we build this, and if so, how?" before touching workscope.
> **Output**: `AI_DOCS/brainstorm/[kebab-topic]-brainstorm.md`
> **SDLC phase**: discovery (pre-specification)
> **Next skill**: `/workscope` — once the idea is validated and the decision to build is made

---

## When to Use This Skill

| Scenario | Use /brainstorm? |
|----------|-----------------|
| Before workscope — exploring "should we build this?" | YES |
| Evaluating a new feature or product pivot mid-project | YES |
| Standalone business model or monetization strategy session | YES |
| UI/UX concept exploration with no clear tech direction yet | YES |
| Already decided to build — need a scope document | NO → use `/workscope` |
| Already have workscope — new feature arrived mid-project | NO → use `/change-request` |
| Already have workscope — need the technical spec | NO → use `/tech-specification` |

---

## Phase 1: Idea Capture

Ask all 5 questions in a single conversational message. Do NOT proceed to Phase 2 until all are answered.

```
I'll help you explore this idea thoroughly. To start:

1. Describe the idea in 2–3 sentences. What does it do and for whom?
2. What problem does it solve? Who suffers from this problem today?
3. What triggered this idea? (frustration you experienced, market gap observed, competitor weakness, personal need?)
4. What is your rough revenue intent? (e.g., charge users monthly, charge businesses, take a marketplace cut, usage-based, free with ads, enterprise deals)
5. What stage is this idea at? (raw idea / seen some competitors / validated with real users / partially built already)
```

---

## Phase 2: Business Strategy Analysis

Spawn the `business-strategist` agent (AG-028) with the user's Phase 1 answers as context. Wait for the agent's complete output before proceeding to Phase 3.

**Prompt to pass to the agent:**
```
You are the business-strategist. Analyze this idea and produce your full 5-section Business Strategy Analysis.

IDEA: [user's 2–3 sentence description]
PROBLEM: [problem statement + who has it]
TRIGGER: [what prompted the idea]
REVENUE INTENT: [stated monetization direction]
STAGE: [how far along the idea is]

Produce all 5 sections in order: Business Model Canvas, ICP Definition, Revenue Model Options, Hosting Cost-at-Scale, Biggest Assumption to Validate.
```

---

## Phase 3: Ideation Expansion

Using the business-strategist's output as the foundation, expand the idea across 4 dimensions. Provide 2–3 concrete, specific options per section — not generic advice.

### 3a — MVP Approaches

Present 2–3 distinct MVP cuts ranked by: speed-to-validate, cost, and risk reduction. For each:

```
MVP Option [N]: [Name]
What gets built:  [specific scope]
What gets deferred: [specific deferrals]
Assumption it tests: [specific hypothesis]
Build complexity: [Low / Medium / High]
Best for: [scenario where this option wins]
```

### 3b — Feature Inventory

List 10–15 potential features. Tag each as Core (MVP must-have), Differentiating (sets apart from competitors), or Deferred (Phase 2+).

```
[Feature name] — [one-line description]
Value: [why users care]  |  Build: [Low/Med/High]  |  Priority: [Core/Diff/Defer]
```

### 3c — UI/UX Direction

Suggest 2–3 UI/UX directions that match the ICP identified by the business-strategist:
- **Platform**: Web / Mobile / Both — and the specific reason for each option
- **Design feel**: Reference a real product (e.g., "Clean and focused like Linear", "Warm consumer-facing like Notion", "Data-dense like Stripe Dashboard")
- **Key screens for MVP**: List the 3–5 screens that make the core loop work

### 3d — Competitive Landscape

Name 3–5 real or likely competitors. For each:
- What they do well
- Where they fall short or leave users underserved
- The gap the user's idea could exploit

---

## Phase 4: Synthesis & Recommendation

Output this summary block in the chat before writing any document:

```
BRAINSTORM SUMMARY — [Idea Name]

Strongest MVP approach: [name it]
Why: [2–3 sentences]

Primary customer: [ICP from business-strategist]
Revenue model recommended: [from business-strategist]
Biggest risk to validate first: [specific assumption]

Hosting cost risk: [Low / Medium / High] — [one-line reason]
Margin model: [works / tight / needs validation]

Recommended next step:
  → Proceed to build: run /workscope
  → More validation needed: [specific action — interview N customers / build landing page / etc.]
  → Consider a pivot: [direction if applicable]
```

Then ask: "Are you ready to proceed to `/workscope`, or would you like to explore any of these angles further?"

---

## Phase 5: Write Output Document

The document's prose follows `rules/document-generation-rules.md` (human writing standard, banned phrases, Rule 7 validation).

After user confirms, write `AI_DOCS/brainstorm/[kebab-case-topic]-brainstorm.md`:

```markdown
# [Idea Name] — Brainstorm

**Date**: [YYYY-MM-DD]
**Status**: [Exploring / Validated / Proceeding to Workscope / Paused]

---

## The Idea
[2–3 sentence description from Phase 1]

## Problem Statement
[The problem, who has it, and how acute it is]

---

## Business Model Analysis
[Business-strategist's Business Model Canvas output]

## Customer Segments
[ICP definition + secondary segments from business-strategist]

## Revenue Model Options
[3 revenue options with recommendation from business-strategist]

## Hosting & Infrastructure Cost-at-Scale
[3-stage cost table from business-strategist + margin risk rating]

---

## MVP Approaches
[Phase 3a output — 2–3 ranked options with tradeoff notes]

## Feature Inventory
### Core (MVP)
[list]
### Differentiating
[list]
### Deferred (Phase 2+)
[list]

## UI/UX Direction
[Phase 3c output — platform, design feel, key screens]

## Competitive Landscape
[Phase 3d output — competitor table]

---

## Brainstorm Recommendation
[Phase 4 BRAINSTORM SUMMARY block]

## Next Steps
- [ ] Proceed to `/workscope` once decision to build is confirmed
- [ ] Validate assumption: [specific action]
- [ ] Research gap: [specific gap if any]
```

After writing, confirm the file path to the user. If `AI_DOCS/memory/session-state.md` exists, add a line: `Brainstorm complete: [idea name] — [date] — Status: [status]`.

---

## Critical Rules

1. Do NOT define a tech stack — that belongs in `/workscope` → `/tech-specification`
2. Do NOT produce development cost or hour estimates — that belongs in the `estimation` skill (claude-sales-skills collection)
3. Do NOT create a formal scope document here — this is pre-commitment ideation only
4. ALWAYS surface the single biggest risk/assumption before recommending build
5. If the user already has a workscope and a new feature arrived: redirect to `/change-request`
6. If the user skips Phase 1 and jumps ahead: re-ask the 5 questions — they are required inputs for the business-strategist
