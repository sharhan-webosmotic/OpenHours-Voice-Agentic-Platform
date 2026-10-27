---
name: architecture
description: "Create Architecture Decision Records (ADR), document system design choices and trade-offs. Use when making architecture decisions, choosing technologies, or documenting system design. Also triggers on: 'Tech decision', 'How should we build', 'AWS', 'Azure', 'GCP', 'design system'."
effort: xhigh
mcp_integrations: [context7, sequential-thinking]
next_skill: null
skill_id: SK-020
context_budget:
  load_kb: 35
  scope: global
version: 1.6.1
dependencies:
  required: [session-management]
  optional: [tech-specification, workscope]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Architecture

> Make and document architecture decisions using ADRs.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (all free, auto-provisioned in the project `.mcp.json`):

- `context7` (free): framework and tech research during ADR reasoning.
- `sequential-thinking` (free): structured reasoning for multi-layer architecture decisions.

---

## Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## ADR Template

```markdown
# ADR-[NUMBER]: [Title]

## Status
Proposed / Accepted / Deprecated

## Context
[What is the issue that we're seeing that is motivating this decision?]

## Decision
[What is the change that we're proposing/doing?]

## Options Considered
| Option | Pros | Cons |
|--------|------|------|
| A | ... | ... |
| B | ... | ... |

## Consequences
[What becomes easier/harder because of this change?]

## Dependency constraints (conditional — include when the decision adds a library/service)
- Processing location: [in-region | self-hosted | external API — MANDATORY for any library that
  processes user documents/data (parsers, OCR, transcription, AI/LLM SDKs) when stack.md declares
  a compliance regime. An external-processing choice on a gdpr/hipaa/dpdp project needs the
  explicit justification here, or a different library.]
- Runtime fit: [for a native-binary dependency on a Lambda/container target: the required base
  image + libc (e.g. needs glibc >= 2.36 → node:20-slim, not Amazon Linux 2). /audit check 12
  flags a native dep with no recorded base-image requirement.]
```

## Common ADRs

| ADR | Question | Options |
|-----|----------|---------|
| ADR-000 | Stack Selection (MANDATORY, every project) | Overall tech-stack: frontend / backend / database / hosting. Capture options considered + decision + architecture reasoning |
| ADR-001 | Architecture Style | Monolith / Modular / Microservices |
| ADR-002 | Database | PostgreSQL / MongoDB / Hybrid |
| ADR-003 | Caching | None / In-process / Redis cache-aside / Redis+CDN — with TTL, invalidation, stale-tolerance |
| ADR-004 | Offline | None / Cache-first / Offline-first |
| ADR-005 | Auth | JWT / Session / OAuth |
| ADR-006 | Deployment | Single / Multi-region |
| ADR-007 | Scaling strategy | Vertical only / Horizontal (stateless replicas + LB) / Serverless auto-scale / Read-replicas + partitioning |
| ADR-008 | Messaging / async work | Inline / Cron / Queue+worker / Pipeline / Stream — with idempotency, retry+backoff, dead-letter, timeout |
| ADR-009 | Real-time transport | None / Polling / SSE / WebSocket / Webhook — with auth-on-connect, reconnect/back-pressure, heartbeat |

> ADR-000 (Stack Selection) is required for EVERY project, single-service included, not only multi-service ones. It records the overall tech-stack choice (frontend, backend, database, hosting) with the options considered, the decision, and the architecture reasoning: the scale path to the 6-month and 1-year targets, the data shape, the service boundaries, the failure modes, and operability. This ADR is produced as part of `/do` Step 1.7 (workscope tech-stack selection) and pairs with `AI_DOCS/memory/stack.md`, which holds the concrete stack details. See `rules/tech-stack-selection-rules.md` for the full mandate. The no-defaults, present-options-with-pros-cons, user-picks stance below applies here too.

> ADR-007 (Scaling) pairs with tech-spec S12 (scalability numbers + triggers) and the `infra-planning` hosting topology. Decide the scaling approach here; record the concrete capacity numbers in S12 and the hosting placement in `infra/infra-plan.md`. Do not split the same decision across all three with different answers.

> **Runtime ADRs (003 Caching, 008 Messaging/async, 009 Real-time) are the data-flow topology.** They are decided in `/do` Step 1.8 per `rules/runtime-architecture-rules.md`, using the catalogue `skills/tech-specification/ARCH-PATTERNS.md`, and recorded in tech-spec S22. Required for EVERY project (single-service included) that uses the corresponding axis: a project with a queue MUST have ADR-008, a project with a socket MUST have ADR-009, a project with Redis MUST have ADR-003. There is no default infrastructure (Rule 2): an ADR for a pattern exists only because a requirement signal earned it. Each runtime ADR's **Consequences** section MUST name the code-level obligations the pattern forces (idempotency key, retry/backoff, dead-letter, bounded timeout, TTL+invalidation, auth-on-connect, reconnect, correlation-id logging) and the failure-mode mitigations (worker crash mid-job, socket silent-drop, cache serving stale money). Those obligations are what `/build`'s runtime-pattern fidelity gate enforces in the implementation. A runtime ADR that lists a pattern but no obligations is incomplete.

## Decision Process

```
1. Identify decision needed
2. Present options with pros/cons
3. User picks (never assume a default)
4. Document in ADR
5. Append to AI_DOCS/memory/decision-log.md
```

## Rules
1. ALWAYS document decisions as ADRs
2. Present options with trade-offs
3. Ask user before deciding — no defaults
4. Store ADRs in AI_DOCS/architecture/adrs/
5. Append every decision to decision-log.md

## Diagrams (system context, sequence)

> Diagrams authored in Mermaid MUST follow `rules/mermaid-rules.md` (quote labels with special characters, no bare lowercase `end`, validate in mermaid.live).

Mermaid stays the source inside `AI_DOCS/architecture/` because it diffs in review. When the diagram goes in front of a stakeholder (an ADR review, a deck, a client brief), draw it with the `diagram-design` plugin: Architecture or Deployment for system context, Sequence for flows, IT current-state plus Architecture delta for a migration ADR. `/diagram-design:import-mermaid` redraws an existing Mermaid block, and `/diagram-design:export-diagram` produces SVG/PNG.

## Rules Integration
> - `.claude/rules/development-rules.md` — architecture decisions must align with spec-first, naming conventions
> - `.claude/rules/api-rules.md` — API architecture must follow contract-first patterns
> - `.claude/rules/security-rules.md` — security architecture decisions (auth, encryption)
> - `.claude/rules/runtime-architecture-rules.md` — the data-flow topology discipline behind ADR-003/008/009 (caching, async/messaging, real-time); catalogue in `skills/tech-specification/ARCH-PATTERNS.md`
<!-- Version: 1.6.0 | 2026-10-14 | Stakeholder-facing diagrams drawn with the diagram-design plugin. Mermaid remains the AI_DOCS source. -->

<!-- Version: 1.6.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
