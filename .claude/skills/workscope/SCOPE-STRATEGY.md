# Scope Strategy: Releases Before Ink (shared reference)

> Shared by `workscope` (Phase 0.5) and `estimation`. Decided BEFORE any
> workscope, ballpark or estimate is written. Never decided silently: the
> operator sees one decision card and picks.

## The three cases

| Case | Trigger in the client's material | Releases | Commitment |
|---|---|---|---|
| **A. Full quote** | The client explicitly asks for a quote for the whole thing or all features | One release, labelled `Full scope` | Everything Committed |
| **B. Client-defined MVP** | The client names an MVP, a first release or a phase 1 | `MVP` (strict, exactly what they named, plus the essentials below), then `Phase 2`, `Phase 3` | MVP Committed, every later phase Tentative |
| **C. MVP-first (DEFAULT)** | The client has not asked for a full quote | `MVP` (what they most want to release or validate first, plus the essentials), then `Phase 2`, `Phase 3` | MVP Committed, every later phase Tentative |

Case C applies whenever A and B do not. If the material supports more than one
case (for example one document asks for "everything" and a later one talks
about "launching with bookings first"), the card lists the options and does not
pick.

## Essentials that are never cut

The first release must work in production, so these stay in the MVP in cases B
and C, whatever the number:

1. **The primary user journey** end to end, for every role it needs
2. **Authentication and roles** the journey depends on
3. **Security and privacy** controls the data requires
4. **Data integrity:** validation, backups, the records the business relies on
5. **Deployment** to a production environment
6. **Monitoring** enough to know the release is up and working

Never move an essential to a later phase to lower the entry number. A smaller
number built on a release that cannot go live is not honest.

## Interest signals (cases B and C)

Read every document in `AI_DOCS/requirements/` (or the requirements baseline)
and score each feature. Cite each signal as `source + line` (or `R-NNN`).

| Signal | Example |
|---|---|
| **Repeated** across documents or meetings | Named in the brief, the call notes and the email |
| **Listed first** in a list or a document | First bullet of "what we need" |
| **Marked** must, first, priority, launch, critical | "Bookings must be live for launch" |
| **Emphasized in the most recent document** | The latest email returns to it |
| **Tied to a deadline** | "before the trade fair in March" |
| **Tied to a validation goal** | "we want to test whether vendors will pay" |

A feature with strong signals goes to the MVP. A feature with no signal and no
essential role goes to a later phase. When two documents disagree about a
feature, the card says so (see Conflicts in `SKILL.md`), it never picks.

## Commercial intent

- **Lead with the MVP figure.** The operator wants a smaller, honest entry
  number to win the project.
- **Hide nothing.** Every future phase is shown with its tentative cost,
  labelled tentative, never folded into the committed number.
- **A cost range only when the client asked for one.** Otherwise one figure
  per release.

## Operator decision card (chat, then wait)

```markdown
## Scope strategy: decision card

**Case:** C. MVP-first (default, the client has not asked for a full quote)

### Proposed MVP (Committed)
| Feature | Why it is in the MVP | Evidence |
|---|---|---|
| Booking and payment | Strongest interest signal, tied to the March launch | brief.md L12, call-notes.md L40 |
| Login and roles | Essential: the booking journey needs it | essential 2 |

### Proposed future phases (Tentative)
| Phase | Feature | Why it waits | Evidence |
|---|---|---|---|
| Phase 2 | Loyalty points | Mentioned once, no deadline | brief.md L58 |

**Recommended default:** C as above.
**Options (only when ambiguous):** A. Full quote, because email-2.md L3 says "quote everything". C. MVP-first, because the latest document stresses the launch.

Reply with the case, and any feature to move between MVP and a later phase.
```

The card is written to `AI_DOCS/planning/scope-strategy.md` and shown in chat.
Nothing else is drafted until the operator answers. The answer sets the
estimate's milestones (`release`, `commitment`, `project.scopeCase`) and the
document's release blocks.

<!-- Version: 1.0.0 | 2026-10-14 | New shared reference (workscope 3.0.0, estimation 6.1): cases A, B, C with MVP-first as the default, essentials never cut, interest signals cited per feature, commercial intent, operator decision card. -->
