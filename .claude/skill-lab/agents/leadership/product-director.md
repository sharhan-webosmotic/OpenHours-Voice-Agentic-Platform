# Agent Test Spec — product-director

**Agent**: `product-director`
**Tier**: leadership
**Agent path**: `.claude/agents/product-director.md`
**Gate verdicts**: PD-SCOPE, PD-MILESTONE
**maxTurns**: 25
**Spec date**: 2026-04-14
**Priority**: 2 — highest quality bar

---

## What This Agent Does

Validates feature scope against workscope.md and current milestone plan. Issues PD-SCOPE verdicts for new features and PD-MILESTONE verdicts for milestone transitions. Ensures product alignment and user value.

## Assertions That Apply to All Test Cases

- [ ] Verdict on FIRST line: `APPROVE`, `CONCERNS`, or `REJECT`
- [ ] Agent reads workscope.md and current milestone plan before issuing verdict
- [ ] Agent cites specific workscope sections or milestone entries
- [ ] Agent escalates architecture questions to solutions-architect (not resolved unilaterally)
- [ ] Agent does NOT approve scope changes without /change-request process

---

## Test Case 1: PD-SCOPE Approve — Feature in Current Milestone

**Context provided**:
```
Gate ID: PD-SCOPE
Feature: "Implement user login with email + password"
workscope.md: "User Authentication" is Feature Group 1 in Milestone 1
Current milestone: Milestone 1 — Authentication
```

**Expected behavior**:
Agent reads workscope.md and milestone plan, confirms the feature is in Milestone 1 scope, verifies it aligns with approved user value, issues APPROVE.

**Assertions**:
- [ ] Output starts with `APPROVE`
- [ ] References specific workscope section: "Feature Group 1: User Authentication"
- [ ] Confirms milestone alignment: "Feature is in Milestone 1 scope"
- [ ] No conditions placed on APPROVE (it's a clean in-scope feature)

---

## Test Case 2: PD-SCOPE Reject — Feature Not in Workscope

**Context provided**:
```
Gate ID: PD-SCOPE
Feature: "Add social media sharing to project tasks"
workscope.md: No mention of social sharing. Out of Scope list includes "social media integrations"
```

**Expected behavior**:
Agent identifies feature is explicitly Out of Scope in workscope.md, issues REJECT.

**Assertions**:
- [ ] Output starts with `REJECT`
- [ ] References workscope.md Out of Scope section
- [ ] Specific reason: "Social media integrations are listed as Out of Scope in workscope.md"
- [ ] Path forward stated: "Submit /change-request if this should be added to scope"
- [ ] Agent does NOT suggest "a small version" — out of scope means out of scope

---

## Test Case 3: PD-SCOPE Concerns — Scope Creep Risk

**Context provided**:
```
Gate ID: PD-SCOPE
Feature: "Enhanced notifications — email, SMS, push, in-app, Slack integration, and webhook support"
workscope.md: "Notifications" is in scope, but workscope only mentions in-app notifications
```

**Expected behavior**:
Agent identifies scope expansion risk — in-app notifications are in scope but the 5 additional channels are not explicitly scoped. Issues CONCERNS.

**Assertions**:
- [ ] Output starts with `CONCERNS`
- [ ] Distinguishes what IS in scope (in-app) vs what is NOT explicitly scoped (email, SMS, push, Slack, webhooks)
- [ ] Recommends: Update workscope.md to include additional channels, or limit feature to in-app only
- [ ] Does NOT reject outright — the core feature is in scope

---

## Test Case 4: PD-MILESTONE — Milestone Transition Approval

**Context provided**:
```
Gate ID: PD-MILESTONE
Transition: Milestone 1 (Authentication) → Milestone 2 (Core Features)
All Milestone 1 stories marked done in task.md.
Gate 4D (QA sign-off) for Milestone 1: APPROVED.
gate-status.md shows all gates passed for Milestone 1.
```

**Expected behavior**:
Agent reviews milestone completion evidence, verifies all Milestone 1 stories are done, confirms QA gate passed, assesses if user value delivered, issues APPROVE for milestone transition.

**Assertions**:
- [ ] Output starts with `APPROVE`
- [ ] References task.md to confirm stories done (not verbal confirmation)
- [ ] Confirms Gate 4D passed (evidence-based)
- [ ] User value assessment included: "Milestone 1 delivers working authentication — user can register and log in"
- [ ] Next milestone kickoff suggested

---

## Test Case 5: Escalation — Architecture Issue Raised During Scope Review

**Context provided**:
```
Gate ID: PD-SCOPE
Feature: "Implement offline mode with local storage sync"
Scope is fine — feature is in workscope.md Milestone 3.
But the feature has significant architecture implications (conflict resolution, sync protocols).
```

**Expected behavior**:
Agent approves scope (PD-SCOPE APPROVE) but flags architecture complexity as requiring SA-ARCH review before implementation.

**Assertions**:
- [ ] Output starts with `APPROVE` (scope IS valid)
- [ ] Architecture concern explicitly flagged: "SA-ARCH review required before implementation"
- [ ] Agent does NOT attempt to resolve architecture question unilaterally
- [ ] Next step stated: "Proceed to SA-ARCH gate before engineering-lead feasibility"
