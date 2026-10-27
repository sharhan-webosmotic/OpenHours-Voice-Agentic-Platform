# Structure Patterns by Document Type

> Part of [/markdown-creator](../SKILL.md). Canonical heading structures and ordering per document type.

Pick the pattern that matches the doc, adapt section names to the domain, keep the order.

---

## 1. How-to / tutorial

Reader comes with a goal; wants to accomplish it step-by-step.

```
# <Goal as a verb phrase, e.g. "Deploy the staging cluster">

Purpose + outcome (one paragraph)

## Prerequisites

## Steps

### Step 1 - <verb>
### Step 2 - <verb>
...

## Verification

## Troubleshooting

## Next steps (optional)
```

Rules:
- Use numbered steps in H3 (`### Step 1 — Install deps`), not in prose.
- Verification section shows exactly what success looks like (command output, URL to visit, etc.).
- Troubleshooting covers the top 2–5 real failure modes you've seen.

---

## 2. Reference

Reader comes looking up a specific thing; scanning, not reading linearly.

```
# <Subject>

Purpose (one-line)

## Synopsis / Quick reference

## <Section per concept, A-Z or grouped by category>

### <Item>
- Signature / syntax
- Description
- Parameters
- Returns
- Example
- See also

## Index / cross-reference
```

Rules:
- Consistent template per item — every entry has the same fields in the same order.
- TOC mandatory (reference docs are scanned, not read).
- Stable heading anchors so external links survive edits.

---

## 3. Runbook

Reader is responding to an incident or executing an operation. Must work under stress.

```
# <Operation> Runbook

## Purpose
One sentence.

## When to run
- Trigger conditions, paging criteria

## Pre-flight
- Access required
- Tools required
- Backout plan

## Procedure

### Step 1 - <verb>
### Step 2 - <verb>

## Verification

## Rollback

## Escalation
- Who to page, when, how
```

Rules:
- Absolute imperative voice ("Run X", not "You should run X").
- Every command in a fenced block with language tag.
- Rollback is mandatory — if there's no rollback, say so explicitly.
- Time-critical info near the top.

---

## 4. Architecture Decision Record (ADR)

A single decision captured for posterity. See `templates/adr.md` for the ready-to-use skeleton.

```
# ADR-NNNN: <Decision title>

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-MMMM

## Context
Why are we deciding this? What changed?

## Decision
What did we decide?

## Consequences
What becomes easier / harder? What are we betting on?

## Alternatives considered
Option A, Option B, why not.
```

Rules:
- One decision per ADR. If you need two, write two ADRs.
- Don't edit old ADRs — supersede them with a new one and mark the old as Superseded.
- Keep ADRs ≤200 lines; if longer, the decision is probably several decisions.

---

## 5. Specification / design doc

Reader needs to understand a proposed system and its trade-offs.

```
# <System name> — Design

## Summary
TL;DR in 2-3 sentences.

## Goals
- Goal 1
- Goal 2

## Non-goals
- What this explicitly won't do

## Context
Current state, constraints, relevant history.

## Proposed design

### High-level architecture
Diagram + prose.

### <Component>

### Data model

### API / contract

### Error handling

## Trade-offs

## Alternatives considered

## Open questions

## Rollout plan

## References
```

Rules:
- Non-goals explicit — they're as load-bearing as goals.
- Open questions section is fine; it's honest. "TBD" inside a section body is not fine.
- Link to prototypes, prior art, related ADRs.

---

## 6. Release notes / changelog

Reader is deciding whether to upgrade.

```
# Release notes - <version>

Date: YYYY-MM-DD

## Highlights
2-3 bullet points of what matters most.

## Breaking changes

## New features

## Bug fixes

## Deprecations

## Migration notes
```

Rules:
- Breaking changes first (readers skim for these).
- Each item links to the PR or issue.
- Stable entry format so changelog aggregators can parse.

---

## 7. API documentation (endpoint-style)

Reader is integrating with an API.

```
# <API name>

## Overview

## Authentication

## Rate limits

## Endpoints

### `GET /resource`

Description.

**Parameters:**

| Name | In | Type | Required | Description |
|------|----|----|----------|-------------|

**Response:**

```json
{
  "example": "response"
}
```

**Errors:**

| Status | Code | Description |
|--------|------|-------------|

**Examples:**
...

### `POST /resource`
...
```

Rules:
- Every endpoint has the same sub-sections in the same order.
- Request + response examples are real, not placeholders.
- Error table is exhaustive for that endpoint.

---

## 8. Generic doc (none of the above)

When the doc doesn't fit a named pattern.

```
# <Title>

Purpose (2-3 sentences)

## Table of contents (if >150 lines)

## <Main sections, ordered by reader priority>

## References / related
```

Rules:
- Start with purpose; never jump into the middle.
- Order sections by what a first-time reader needs first.
- End with references so readers know where to go next.

---

## TOC generation

For any doc above ~150 lines, include a TOC after the purpose. Two options:

### Hand-written

```markdown
## Contents
- [Prerequisites](#prerequisites)
- [Steps](#steps)
- [Troubleshooting](#troubleshooting)
```

Verify anchors match heading text (lowercase, spaces → hyphens, punctuation dropped).

### Auto-generated

`markdown-toc` CLI or VS Code "Markdown All in One" → Create Table of Contents. Use fenced markers so it regenerates cleanly:

```markdown
<!-- toc -->

- [auto-generated]

<!-- tocstop -->
```

---

## Cross-file navigation

When splitting a doc per the 300-line rule, the folder layout:

```
<doc-name>/
  index.md              # H1 + purpose + TOC linking parts
  part-1-<slug>.md
  part-2-<slug>.md
```

Each `part-*.md` starts with:

```markdown
> Part of [<Doc Title>](./index.md)

# <Part title>
```

And the `index.md` TOC:

```markdown
## Contents
- [Part 1 — Setup](./part-1-setup.md)
- [Part 2 — Configuration](./part-2-configuration.md)
- [Part 3 — Deployment](./part-3-deployment.md)
```

Never link between parts without going through `index.md` unless the link is genuinely about cross-referencing a specific section (e.g., "see [rollback procedure](./part-4-ops.md#rollback)").
