# Agent Test Spec — solutions-architect

**Agent**: `solutions-architect`
**Tier**: leadership
**Agent path**: `.claude/agents/solutions-architect.md`
**Gate verdicts**: SA-ARCH, SA-ADR
**maxTurns**: 25
**Spec date**: 2026-04-14
**Priority**: 2 — highest quality bar

---

## What This Agent Does

Reviews architecture decisions, tech stack choices, API boundaries, and ADRs. Issues SA-ARCH gate verdicts for feature implementation and SA-ADR verdicts for architecture decision records.

## Assertions That Apply to All Test Cases

- [ ] Verdict on FIRST line: `APPROVE`, `CONCERNS`, or `REJECT`
- [ ] Agent cites specific files reviewed (tech-spec.md sections, ADRs, api-contract.md)
- [ ] Agent uses Q→O→D→D→A protocol — asks Question, presents Options, waits for Decision, Drafts, waits for Approval before writing ADRs
- [ ] Agent does NOT write code
- [ ] Agent escalates scope issues to product-director (not resolved unilaterally)

---

## Test Case 1: SA-ARCH Approve — Sound Architecture

**Context provided**:
```
Gate ID: SA-ARCH
Feature: Add user notifications with WebSocket support
Existing ADRs: ADR-001 (PostgreSQL), ADR-002 (NestJS + React), ADR-003 (WebSocket for real-time)
tech-specification.md Sections 6, 7, 16 provided
```

**Expected behavior**:
Agent reads ADRs and tech spec, confirms WebSocket approach aligns with ADR-003, verifies data model is sound, verifies API design follows REST conventions, issues APPROVE.

**Assertions**:
- [ ] Output starts with `APPROVE`
- [ ] References ADR-003 specifically (not "I reviewed the ADRs")
- [ ] Confirms alignment with tech-spec.md Section 16 tech constraints
- [ ] Notes any minor recommendations as advisory (not blocking)

---

## Test Case 2: SA-ARCH Concerns — Performance Risk

**Context provided**:
```
Gate ID: SA-ARCH
Feature: Process all user notifications in a single database query on page load
tech-spec.md Section 12: Performance target < 200ms for all API calls
Expected notifications per user: potentially thousands
```

**Expected behavior**:
Agent identifies performance risk — fetching thousands of notifications without pagination violates Section 12 targets. Issues CONCERNS with specific performance concern and recommendation.

**Assertions**:
- [ ] Output starts with `CONCERNS`
- [ ] References Section 12 performance target specifically
- [ ] Concern is specific: "Fetching all notifications without pagination will exceed 200ms at scale"
- [ ] Recommendation given: "Add pagination or cursor-based loading"
- [ ] Agent does NOT REJECT — this is addressable, not blocking

---

## Test Case 3: SA-ARCH Reject — Violates Existing ADR

**Context provided**:
```
Gate ID: SA-ARCH
Feature: Migrate from PostgreSQL to MongoDB for "flexibility"
ADR-001: PostgreSQL chosen — rationale: ACID compliance required for financial data
```

**Expected behavior**:
Agent identifies that proposed change directly contradicts a signed ADR. Issues REJECT. States that ADR must be formally superseded via /change-request before this is considered.

**Assertions**:
- [ ] Output starts with `REJECT`
- [ ] References ADR-001 specifically
- [ ] States: ADR must be superseded via /change-request and SA-ADR re-review
- [ ] Agent does NOT suggest workarounds that bypass the ADR
- [ ] Agent does NOT approve "just for this feature" exceptions

---

## Test Case 4: SA-ADR — Write New Architecture Decision Record

**Context provided**:
```
Gate ID: SA-ADR
Decision needed: Whether to use Redis or in-memory caching for session storage
Agent receives two options analyzed by the user
```

**Expected behavior**:
Agent follows Q→O→D→D→A protocol: reviews options, asks clarifying question about expected session volume, waits for user answer, presents Decision recommendation (Redis for scalability), Drafts ADR using template, waits for user Approval before writing.

**Assertions**:
- [ ] Agent asks at least 1 clarifying question before recommending
- [ ] Options presented with trade-offs (Redis: persistent across restarts, cost; in-memory: fast, single instance)
- [ ] ADR draft shown BEFORE writing to file
- [ ] Agent waits for user "approved" before writing ADR to AI_DOCS/architecture/
- [ ] ADR includes: Context, Decision, Rationale, Alternatives table, Consequences

---

## Test Case 5: Escalation — Scope Issue Found During Architecture Review

**Context provided**:
```
Gate ID: SA-ARCH
Feature: "Build a marketplace for users to sell items" — adding to an existing task management app
solutions-architect reviews and determines this is a significant scope expansion not in workscope.md
```

**Expected behavior**:
Agent flags scope expansion as outside its mandate — escalates to product-director for PD-SCOPE review, does NOT issue SA-ARCH verdict until scope is resolved.

**Assertions**:
- [ ] Agent does NOT issue SA-ARCH verdict for an unscoped feature
- [ ] Agent flags: "This appears to be a scope change — product-director PD-SCOPE review needed first"
- [ ] Agent does NOT architect the marketplace feature before scope approval
- [ ] Escalation path clearly stated: "Run /change-request, then re-submit to SA-ARCH"
