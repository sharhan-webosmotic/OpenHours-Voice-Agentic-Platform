# Agent Coordination Map
> ADF v4.4.1 | Hierarchy, delegation rules, escalation paths, and named workflow patterns.

---

## Agent Hierarchy

```
                    [Human Developer]
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
solutions-architect   product-director   engineering-lead
                               
        │                  │                  │
   ┌────┘          ┌───────┘         ┌────────┼────────┐
   │               │                 │        │        │
sa-adr          pd-scope        qa-lead  code-reviewer  security-auditor
sa-arch       pd-milestone               
                                  │
                         ┌────────┼────────┐
                         │                 │
                    api-validator    component-inspector
                                  
                         │
               ┌─────────┴──────────────┐
     test-writer        Platform Specialists 
                              react │ nextjs │ angular │ vue
                              nodejs│nestjs │ fastapi
                              flutter │ react-native
```

---

## Delegation Rules

| Agent | Delegates to | Must NOT do |
|-------|-------------|-------------|
| `solutions-architect` | `engineering-lead` (feasibility), platform specialists (design patterns), `security-auditor` (threat model) | Write code, make scope decisions |
| `product-director` | `engineering-lead` (cost estimate), `qa-lead` (criteria review), `solutions-architect` (tech feasibility) | Make architectural decisions, write code |
| `engineering-lead` | Platform specialists (implementation), `code-reviewer` (reviews), `test-writer` (tests), `security-auditor` (security) | Make arch decisions, make scope decisions |
| `qa-lead` | `test-writer` (test authoring), `api-validator` (contract check), `component-inspector` (UI compliance) | Write production code |
| `code-reviewer` | — (read-only) | Write code, make architectural decisions |
| `security-auditor` | — (read-only) | Write code, make scope decisions |
| `api-validator` | — (read-only) | Write code, make architectural decisions |
| Platform specialists | — (implementation) | Make scope decisions, override architecture |

---

## Escalation Paths by Situation

| Situation | Route to |
|-----------|---------|
| New service or significant new dependency | `solutions-architect` |
| Feature request mid-sprint | `product-director` |
| Story blocks due to missing external API | `engineering-lead` → `product-director` |
| Security vulnerability found in review | `security-auditor` → `engineering-lead` |
| Cross-service data model conflict | `solutions-architect` |
| Test coverage below target | `qa-lead` → `engineering-lead` |
| Platform specialist disagrees with another | `engineering-lead` arbitrates |
| API contract needs to change post-lock | `product-director` → `solutions-architect` (via `/change-request`) |
| Performance regression | `engineering-lead` + relevant platform specialist |
| Schema design, indexing, or a migration on a large table | `data-architect` |
| Production readiness, observability, rollback/DR, capacity (Gate 5) | `sre-reliability` |
| Regulated data handling, a compliance control verdict (`stack.md` compliance != none) | `compliance-officer` |

---

## 7 Named Workflow Patterns

---

### Pattern 1 — New Feature (Full Pipeline)

For features of significant scope (>3 stories, cross-cutting concerns).

```
product-director (PD-SCOPE gate)
    │
    ↓
solutions-architect (SA-ARCH gate)
    │
    ↓
engineering-lead (EL-FEASIBILITY gate + sprint plan)
    │
    ↓ (parallel)
[platform specialists implement stories]    [qa-lead (QA-STORY-READY per story)]
    │
    ↓
code-reviewer (each PR)
    │
    ↓
security-auditor (if auth or data changes)
    │
    ↓
qa-lead (QA-TEST-COVERAGE gate)
    │
    ↓
PHASE-GATE (if milestone transition)
```

**Skills to use**: `/tech-specification` → `/build` → `/qa-testing` → `/gate-enforcement`

---

### Pattern 2 — Bug Fix

For bugs found in testing or production.

```
Report bug → /debugger skill
    │
    ↓
engineering-lead (assess scope: hotfix or sprint work)
    │
    ├─ Simple fix → developer implements → code-reviewer → merge
    │
    └─ Complex fix → solutions-architect (if architectural cause)
                        → sprint plan adjustment → product-director
```

**Skills to use**: `/debugger` → `/build` → `/github-ops`

---

### Pattern 3 — Breaking API Change

For changes that alter the API contract after Gate 1 lock.

```
/change-request skill (required — API contract is locked)
    │
    ↓
product-director (PD-SCOPE — is this scope creep?)
    │
    ↓
solutions-architect (SA-ARCH — is the new design correct?)
    │
    ↓
api-validator (check all callers of the changed endpoint)
    │
    ↓
engineering-lead (coordinate: all affected teams update together)
    │
    ↓
qa-lead (QA-TEST-COVERAGE — contract tests updated?)
```

**Skills to use**: `/change-request` → `/gate-enforcement` (PHASE-GATE re-check)

---

### Pattern 4 — New Screen / User Flow

For UI-heavy features requiring design system work.

```
product-director (PD-SCOPE — user value check)
    │
    ↓
[parallel]
component-inspector (existing components?)  +  platform specialist (implementation plan)
    │
    ↓
engineering-lead (sprint feasibility)
    │
    ↓
[implement] → component-inspector (compliance check) → qa-lead (visual acceptance)
```

**Skills to use**: `/design-discovery` → `/design-tokens` → `/design-screens` → `/build` → `/e2e-testing`

---

### Pattern 5 — Sprint Cycle

Standard sprint execution pattern.

```
product-director (sprint scope confirmation)
    │
    ↓
engineering-lead (EL-FEASIBILITY — story sizing, ordering)
    │
    ↓
qa-lead (QA-STORY-READY — per story, before dev starts)
    │
    ↓
[implement sprint stories in parallel by platform specialists]
    │
    ↓
code-reviewer (each PR)
    │
    ↓
qa-lead (QA-TEST-COVERAGE — sprint close)
    │
    ↓
/retrospective skill → /milestone-planning (if milestone end)
```

---

### Pattern 6 — Milestone Transition

Moving from one major milestone to the next (triggers PHASE-GATE).

```
qa-lead (QA-TEST-COVERAGE gate — all tests passing?)
    │
    ↓
[parallel] product-director (PD-MILESTONE) + solutions-architect (SA-ARCH review)
    │
    ↓
engineering-lead (EL-FEASIBILITY for next milestone)
    │
    ↓
PHASE-GATE (all 3 directors in parallel, strictest verdict wins)
    │
    ↓ APPROVE
Update gate-status.md → /deployment-planning (if production)
```

**Skills to use**: `/gate-enforcement` → `/deployment-planning` → `/deployment-execution`

---

### Pattern 7 — Production Hotfix

Emergency fix for production incident. Bypasses normal sprint flow.

```
Incident detected
    │
    ↓
engineering-lead (assess: hotfix or rollback?)
    │
    ├─ Rollback → /deployment-execution (rollback runbook)
    │
    └─ Hotfix
            │
            ↓
        security-auditor (is this a security incident?)
            │
            ↓
        [implement on hotfix branch — minimal change]
            │
            ↓
        code-reviewer (mandatory review even for hotfix)
            │
            ↓
        /deployment-planning (emergency deploy runbook)
            │
            ↓
        /retrospective (post-mortem within 48 hours)
```

**Skills to use**: `/debugger` → `/build` → `/deployment-execution` → `/retrospective`

---

## Anti-Patterns (Never Do These)

| Anti-Pattern | Why It Fails |
|-------------|-------------|
| Bypassing gate hierarchy | Gates exist because earlier phases catch errors cheaper |
| Shadow decisions | Implementing architectural choices without `solutions-architect` sign-off creates divergence |
| Monolithic agent tasks | Giving one agent a task spanning 5+ subsystems causes context overflow and poor quality |
| Inline gate prompts in skills | Copy-pasted gate prompts drift over time — always reference from `governance-gates.md` |
| Skipping session-state.md | WIP state held only in conversation is lost to compaction |
| Parallel agents with dependencies | If agent B needs agent A's output, run them sequentially |
| Skipping QA-STORY-READY | Stories without testable acceptance criteria produce undiscoverable bugs |
