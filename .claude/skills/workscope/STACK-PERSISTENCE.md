# Stack Persistence Reference (Signals Table, stack.md Schema, ADR Fields)

> Extracted from [SKILL.md](SKILL.md) Phase 2: the discovery-signal lookup table, the exact stack.md schema (MANDATORY, Step 6a), and the stack ADR capture fields (Step 6b).

---

## Signals from Discovery That Narrow Options

| Requirement Signal | Narrows Options |
|---|---|
| Mobile apps required | React Native vs Flutter vs Native (Swift/Kotlin) — all viable |
| Real-time features | Rules out simple REST-only backends; prefer Node.js/NestJS or Go |
| High user volume (10k+) | Rules out shared hosting; needs AWS/GCP/Azure with auto-scaling |
| Payment processing | Depends on geography — different providers per region |
| RTL / Arabic required | React Native handles better than Flutter out of the box |
| HIPAA / GDPR | Affects database hosting and cloud region selection |
| Team has existing stack | Do not suggest a complete rewrite; build on what's there |
| Python team | FastAPI or Django — do not suggest Node without flagging the tradeoff |

## stack.md Schema (MANDATORY, write verbatim structure)

```markdown
---
frontend: <name or "none">
backend: <name or "none">
database: <name or "none">
mobile: <name or "none">
hosting: <name or "none">
stack_confirmed: true
stack_confirmed_date: <YYYY-MM-DD>
---

## Selection rationale

### Frontend
- Chosen: <name> — <one-line reason tied to this project's requirements>
- Alternatives considered: <options that were on the table>
- Revisit trigger: <the condition that would reopen this choice, e.g. "if SEO is dropped">

### Backend
- Chosen: <name> — <reason>
- Alternatives considered: <...>
- Revisit trigger: <...>

### Database
- Chosen: <name> — <reason, naming the data-shape answers that drove it>
- Alternatives considered: <...>
- Revisit trigger: <...>

### Mobile
- Chosen: <name or "none — no mobile app in scope">
- Alternatives considered: <...>
- Revisit trigger: <...>

### Hosting
- Chosen: <name> — <reason>
- Alternatives considered: <...>
- Revisit trigger: <...>
```

## Stack ADR Capture Fields (Step 6b)

- **Context**: the requirement signals and architecture-lens findings that shaped the decision.
- **Options considered**: per category, the realistic alternatives and why each was or was not chosen.
- **Decision**: the confirmed stack.
- **Architecture reasoning**: scale path (launch to 6 to 12 months, what changes by config not rewrite), data shape match, service and module boundaries, and the main failure modes the stack must survive.
- **Consequences**: what this locks in and what it leaves open.
