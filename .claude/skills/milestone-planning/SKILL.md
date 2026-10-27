---
name: milestone-planning
description: "Create dependency-ordered milestones, choose development approach, define exit criteria, create git branches. Use when planning milestones, creating a roadmap, or deciding sprint order. Also triggers on: 'Create milestone plan', 'Plan milestones', 'Milestone breakdown', 'Project roadmap'."
next_skill: design-discovery
required_gate: Gate 1 (Planning Completeness)
skill_id: SK-060
context_budget:
  load_kb: 30
  scope: global
version: 1.6.0
dependencies:
  required: [tech-specification]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Milestone & Roadmap Planner

> **Purpose**: Transform Functional Requirements (FRD) into a structured, gated execution roadmap.
> **Output**: `AI_DOCS/planning/milestone-plan.md`
> **Version**: 1.0.0

> [!IMPORTANT]
> **Output sizing (300-line cap).** If `milestone-plan.md` would exceed ~300 lines, split into a folder `AI_DOCS/planning/milestone-plan/` containing:
> - `index.md` — overview table, milestone list, dependency order, cross-links (≤300 lines)
> - one file per milestone (e.g. `m0-foundation.md`, `m1-core-flows.md`) — each self-contained, ≤300 lines, and starts with a back-link to `index.md`
>
> Always split into a folder. Never create sibling files at the parent level (no `milestone-plan-m0.md` next to `milestone-plan.md`). Consumers (`/feature-delivery`, `/deployment-planning`, `/milestone-validation`) read `index.md` first and follow the links.

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Step 0: Pre-Planning Questionnaire (MANDATORY — ask before generating anything)

> [!CRITICAL]
> Do NOT produce a milestone plan until all questions below are answered. These decisions shape the entire execution strategy.

> [!NOTE]
> `sdlc_methodology` and `platform_targets` are already captured by `/do` intake and live in `AI_DOCS/memory/project-context.md`. Read them before planning: they change milestone grouping (sprints vs flow vs phases) and add per-platform mobile work. See the "SDLC methodology consumption" and "Mobile milestones" subsections below.

### Question Set A — Development Approach

Ask the user:

> **"How do you want to approach design and development for each milestone?"**
>
> **Option A — Design-First per Milestone**
> - Design ALL screens for this milestone in Figma / wireframes first
> - Build the full frontend with mock data (no real API yet)
> - User reviews and approves the frontend
> - Then build the backend and connect it
> - Best for: projects where UX quality is critical, client needs to see the UI before backend work begins
>
> **Option B — Feature-by-Feature (End-to-End)**
> - For each feature: design → frontend (may use mocks) → backend → connect → test
> - Features are delivered working end-to-end one at a time
> - Best for: teams who want working software early, agile-style delivery
>
> **Option C — Hybrid (Recommended)**
> - Design the first 2-3 screens for context (shared layout, auth, main nav)
> - Then build feature by feature end-to-end
> - Design leads development by 1-2 features, never the whole milestone upfront
> - Best for: most projects — balances UX quality with delivery speed

Record the answer in `AI_DOCS/memory/project-context.md` under `## Development Approach`.

---

### Question Set B — Mock API Strategy

Ask (only if Option A or Hybrid was chosen above):

> **"Before backend is ready, how should the frontend communicate with data?"**
>
> - **Option 1 — Mock API Server**: Run a local `mock-api-server` (JSON Server / MSW) that mimics the real API contract. Frontend integrates against it from day one.
> - **Option 2 — Hardcoded Mock Data**: Static JSON files in the frontend. Simpler but harder to swap for real API later.
> - **Option 3 — No mocks — build backend first**: Backend and frontend built together, no parallel work.

Record the answer. If Option 1 → trigger `mock-api-server` skill after milestone plan is approved.

---

### Question Set C — Milestone Scope Preference

> **"For each milestone, which scope approach do you prefer?"**
>
> - **Full Feature Set**: Include all planned features for the milestone even if it takes longer
> - **MVP Slice per Milestone**: Ship a smaller working slice, add more in the next milestone
> - **User confirms per milestone**: Ask at the start of each milestone

---

### After Questionnaire → Write to Memory

Write all answers to `AI_DOCS/memory/project-context.md`:

```markdown
## Development Approach
- Mode: [Design-First / Feature-by-Feature / Hybrid]
- Mock Strategy: [Mock API Server / Hardcoded / None]
- Scope Preference: [Full / MVP Slice / Per Milestone]
```

Then proceed to the planning algorithm below.

### Alignment with the client workscope

When `AI_DOCS/planning/workscope.md` exists and is approved, its Section 5
milestones (dated from the tentative kick-off, each ending with a
`Deliverables on completion` lane) and its Section 6 payment schedule are the
client commitment. This skill does not write those client milestones: the
`workscope` skill owns them (`skills/workscope/WORKSCOPE-TEMPLATE.md`, the
ZENi5 structure). The internal plan built here maps every internal milestone to
exactly one workscope milestone, keeps its work inside that milestone's dated
window, and makes each workscope deliverable an exit criterion of the internal
milestone that produces it. If the dependency ordering below cannot fit a
workscope window, raise it with the operator as a change request against the
workscope rather than silently moving a client date.

---

## Core Planning Algorithm

Follow these steps to generate the roadmap:

### 1. Dependency Discovery + Data-Dependency Ordering (BLOCKING)

Milestones MUST be ordered so the data a feature needs exists before that feature is built. A dashboard planned before the entities it charts is a planning defect. Build the order from the data, not from a fixed template.

**1a. Build the dependency graph.** Read `architecture/database-schema.md` (entities + foreign keys) and `architecture/api-contract.md` (endpoints + the entities they read/write). For each feature in the tech-spec, record:
- `produces:` the entities/tables it creates or owns (a CRUD module produces its entity).
- `consumes:` the entities it reads (a dashboard consumes the entities it aggregates; a feature with a FK consumes the parent entity).

Write the graph to `AI_DOCS/planning/dependency-graph.md` (template below): one node per entity and per feature, edges = "requires", and the milestone each node is assigned to.

**1b. Topologically order into milestones**, every producer before every consumer:
- **M0 — Setup**: environment, DB schema scaffold, CI/CD (planned, not run), guardrails (incl. audit-log middleware scaffold), git branches.
- **M1 — Security / Core**: Auth, RBAC (the role matrix), shared components, seed users. Everything downstream consumes identity and roles, so this is always early.
- **M2..M[k] — Entity layers, producers first**: core entities that nothing depends on, then entities that depend on them (FK direction = build order). Each entity milestone delivers the full vertical slice for its entities (schema → API → backend RBAC → seed → UI → integration → frontend RBAC, per `rules/vertical-slice-rules.md`).
- **M[k+1]..M[n] — Aggregation / reporting LAST**: dashboards, statistics, analytics, reports, exports. These consume many entities, so they come after every entity they read. This is the fix for "dashboard built before its data".
- **M[Final] — Finalization**: performance tuning, SEO, production readiness.

**1c. Cycle check.** If two features `consume` each other, break the cycle: split one into a producer half (earlier) and a consumer half (later), or merge them into one milestone. Never leave a cycle in the order.

### 1.5. Auto-populate `blockedBy` from the graph (MANDATORY)

When seeding `tasks.md`, set each task's `blockedBy` from the graph edges — do not leave it to memory. A task tagged `consumes:<entity>` is `blockedBy` the task tagged `produces:<entity>`. Tag every produced/consumed entity in the task's Notes column (`produces:order`, `consumes:user,product`) so the `milestone-order-check.sh` hook can verify a consumer never lands in an earlier milestone than its producer (same milestone is fine, intra-milestone order is handled by `blockedBy` + the vertical slice; the hook exits 2 only when a consumer precedes its producer across milestones).

**Parallelizable annotation (feeds /do's Parallel wave lane).** While seeding, mark each task `parallelizable: yes` in Notes when, against every OTHER task of its milestone, it has: no blockedBy edge (direct or transitive), no shared produced/consumed entity WRITE, and a file scope expected to be disjoint (different feature slice, different route group, different component tree). Everything else gets `parallelizable: no` or no tag (treated as no). This is a planning HINT: /do re-verifies disjointness at build time from the Task Briefs' files-to-touch predictions before actually running a wave, and multi-surface tasks additionally carry `surfaces:<a,b>` tags (vertical-slice-rules Rule 7).

**Flow gate tag (`flow: <flow-id>` tag, MANDATORY when seeding Tier F tasks).** Read `AI_DOCS/design/flow-validation-plan.md` before seeding a milestone's `tasks.md`. Any task implementing a flow whose row is tiered Tier F carries `flow: <flow-id>` in its Notes column, using that row's `Flow ID`. A Tier S flow, or a flow with no row yet, gets no tag. The tag is how Gate FLOW (`gate-enforcement`) and `hooks/enforce-flow-gate.sh` find the tasks a flow's approval status blocks: an untagged task for a Tier F flow is invisible to the gate and would start without the required prototype approval.

#### Dependency graph template (`AI_DOCS/planning/dependency-graph.md`)

```markdown
# Dependency Graph

## Entities (producer order)
| Entity | Produced by (feature) | Milestone | Depends on (FK) |
|---|---|---|---|
| User | Auth | M1 | — |
| Product | Product CRUD | M2 | — |
| Order | Order CRUD | M3 | User, Product |

## Features
| Feature | Produces | Consumes | Milestone | blockedBy |
|---|---|---|---|---|
| Auth | User | — | M1 | — |
| Product CRUD | Product | — | M2 | M1 (roles) |
| Order CRUD | Order | User, Product | M3 | M1, M2 |
| Sales Dashboard | — | Order, Product, User | M4 (last) | M3 |
```

The graph is the knowledge-base spine for ordering. Milestone capsules reference it by stable ID (never copy it) and it is threaded into the S21 traceability matrix.

### Mobile milestones (when `platform_targets` includes iOS/Android)

Read `platform_targets` from `project-context.md`. For each native target, the feature vertical slice gains per-platform UI + integration + RBAC layers (web screen AND native screen), per `rules/vertical-slice-rules.md`. Plan:
- A shared backend: one API serves web + native, do not fork the contract.
- Native design screens: `design-screens` runs for mobile surfaces too, not web only.
- A native E2E lane at milestone close (Detox for React Native, integration tests for Flutter) in addition to web Playwright. `milestone-validation` spawns the mobile validator when `platform_targets` includes a native target.
- A different release path: native targets end in app-store submission, not a web deploy. Note this in the milestone's exit criteria; `deployment-planning` handles the store runbook.

### SDLC methodology consumption (read `sdlc_methodology`)

Apply `rules/sdlc-methodology-rules.md` to the milestone shape:
- `agile-scrum-devops` / `scrum`: size each milestone to ~1 sprint (1-2 weeks), add a sprint goal + per-task acceptance, keep ≤2 milestones in flight.
- `kanban`: order milestones as flow buckets by the dependency graph, enforce a WIP limit (≤2 features DOING), no sprint headers.
- `waterfall`: milestones map to sequential phases (requirements → design → build → test → deploy), exactly one active at a time, full design before build.

### 2. Apply Development Approach to Each Milestone

Based on the chosen approach (Question Set A), define the **execution order within each milestone**:

#### If Design-First:
```
For each milestone:
1. Design — All screens for this milestone (design-system skill)
2. Mock setup — mock-api-server or hardcoded data (if applicable)
3. Frontend — Build all screens against mocks
4. User review — Approve frontend before backend starts
5. Backend — Build APIs, business logic, DB operations
6. Integration — Connect frontend to real backend
7. QA — Test end-to-end
```

#### If Feature-by-Feature:
```
For each feature within a milestone:
1. Design — 1-2 screens for this feature only
2. Backend — API contract, service, repository
3. Frontend — Connect to real API (or mock if backend not ready)
4. QA — Test this feature before starting next
```

#### If Hybrid:
```
For each milestone:
1. Design — First 2-3 screens (shared layout + first feature)
2. Feature loop (repeat for each feature):
   a. Design next feature screens (1 feature ahead)
   b. Build feature end-to-end (backend + frontend)
   c. QA feature
3. Integration QA — test all features together
```

### 3. Exit Criteria Definition
For EVERY milestone, you must define:
- **Functional**: What features are "Done"?
- **Technical**: SonarQube score, Coverage %, Security check.
- **Documentation**: Updated `task.md`, `AI_DOCS/memory/`.

### 4. Branch Tracking in the Plan

Every milestone must have its corresponding git branch listed in the plan. The plan is the authoritative source of branch names.

Format for milestone-plan.md roadmap table:
```markdown
| ID | Milestone | Branch | Dev Mode | Dependency | Est. Effort | Status |
|---|---|---|---|---|---|---|
| M0 | Setup & Foundation | milestone-0 | N/A | develop | [X] days | PENDING |
| M1 | Auth & Core | milestone-1 | Hybrid | milestone-0 | [X] days | PENDING |
| M2 | [Name] | milestone-2 | Feature-by-Feature | milestone-1 | [X] days | PENDING |
```

And each milestone detail section must include:
```markdown
### Milestone M[N] — [Name]

**Branch**: `milestone-[N]` (branched from `milestone-[N-1]`)
**Development Mode**: [Design-First / Feature-by-Feature / Hybrid]
**Mock Strategy**: [Mock API Server / Hardcoded / None]
**Active Feature Branches**: (filled in during development)
  - [ ] feat/m[N]-[feature-name]
  - [ ] feat/m[N]-[feature-name]
```

Update this section in `AI_DOCS/memory/project-context.md` under `## Git State` as branches are created and merged.

---

## Output Template: `AI_DOCS/planning/milestone-plan.md`

```markdown
# Project Milestone Plan

> **Project Name**: [Project Name]
> **Status**: 🔵 NOT STARTED
> **Current Milestone**: M0

---

## 🗺️ Roadmap Overview

| ID | Milestone Name | Description | Dependency | Est. Effort |
|---|---|---|---|---|
| M0 | Setup & Foundation | Project init, schema, and guardrails | None | [X] days |
| M1 | [Name] | [Description] | M0 | [X] days |
| ... | ... | ... | ... | ... |

---

## 🎯 Milestone Details

### Milestone: [M-ID] - [Name]

**Description**: [1-2 sentences]

**FRD Requirements Covered**:
- [ ] [FR-ID]: [Title]
- [ ] [FR-ID]: [Title]

**Entry Criteria**:
- [ ] Milestone [M-X] Completed
- [ ] [Specific tech requirement]

**Exit Criteria (Definition of Done)**:
- [ ] All functional requirements above implemented & tested
- [ ] Zero critical defects in QA
- [ ] Documentation updated

**Gate Check**: [Gate ID] (e.g., G4A)

**Skill triggers (`needs:` tags)**: when seeding this milestone's task rows, tag any task that will trigger a specialist skill so the Activation Map can auto-trigger it. Put the tag in the task's Notes column, e.g. `needs:data-migration` (task changes the schema), `needs:ai-cost-guard` (task touches an LLM SDK — BLOCKING), `needs:infra-cost-guard` (task provisions cloud resources — BLOCKING), `needs:i18n`, `needs:caching-strategy`, `needs:audit-logs`. `/do` compiles these tags + the spec dimensions into `AI_DOCS/memory/active-skills.md` (see memory-protocol).

**Traceability write-back (MANDATORY after seeding)**: once task rows exist, write each task's stable ID (`M<NN>:T-<NN>`) into the matching Req row's **Task ID(s)** column in `spec/21-traceability.md`. Every Req row gets at least one Task ID and every task maps back to a Req row — a feature without a task will never be built, a task without a feature is unscoped work. Gate 2 verifies both directions, and Gate 5 builds the scope-closure map from this column at ship time.

**Security acceptance injection (MANDATORY at seeding)**: security requirements live in the task acceptance, not in the developer's memory. When a task title/acceptance matches these keyword groups, inject the corresponding acceptance criteria into the task row. Where tech-spec S20 has a row for the feature, copy its Frontend check + Backend check verbatim instead of the generic set:

| Task matches | Injected acceptance criteria |
|---|---|
| auth, login, signup, password, session, token, OTP | rate limit on the endpoint, generic error messages (no user enumeration), audit log on success AND failure, argon2id/bcrypt hashing where credentials are stored, session/token expiry per security-rules 36-42 |
| payment, billing, checkout, refund, subscription | server-side amount validation, idempotency key, no card data stored or logged (tokenized fields only), webhook signature verification, audit log |
| upload, file, media, import, attachment | size limit, MIME allowlist, server-generated filenames (no client paths), storage outside webroot or signed URLs, malware-scan step or explicit `N/A (reason)` |
| export, report, download (touching PII) | owner/admin authorization check, audit log row per export, rate limit |

A security-sensitive task seeded without its injected criteria is a Gate 2 finding. The criteria become testable items: `/build` verifies them like any other acceptance, and S18 needs a matching test case.

**Flow gate tag (`flow:` tag, MANDATORY for Tier F flows)**: when seeding task rows, cross-reference `AI_DOCS/design/flow-validation-plan.md`. Any task belonging to a flow tiered Tier F in that plan carries `flow: <flow-id>` in its Notes column (the row's `Flow ID`, e.g. `flow: flow-order-approval`). This is how Gate FLOW (`gate-enforcement`) and `hooks/enforce-flow-gate.sh` locate the tasks a flow's approval status blocks. Tier S tasks, and flows with no plan row, carry no tag.

---

## 🚪 Gate Checklist Registry

Define the gates that must be passed to proceed between milestones.

| Gate | Name | Requirement |
|---|---|---|
| **Gate 0** | Workscope Approved | Workscope signed off by stakeholder |
| **Gate 1** | Planning Completeness | All 23 sections of tech-spec.md + design IA (sitemap/navigation/onboarding) + infra-plan + Activation Map present and approved |
| **Gate 1.5** | Code Quality Pre-Check | 17-point checklist passes before coding |
| **Gate 2** | Component Library Ready | Design DNA + component registry ready |
| **Gate 3** | Design Approved | All screens for current milestone approved |
| **Gate 4** | QA Sign-off | All test cases pass, no critical defects |
| **Gate 5** | Production Sign-off | Deployment checklist cleared |
```

---

## Git Branch Creation (MANDATORY on Milestone Plan Approval)

> [!CRITICAL]
> When the milestone plan is approved by the user, immediately create the git branches for all planned milestones.

### Branch Creation Protocol

After the user approves the milestone plan, run (or show if git-ops consent is NO):

```bash
# Create all milestone branches — each from the previous one
git checkout develop
git checkout -b milestone-1        # M1 branches from develop
git push origin milestone-1

git checkout milestone-1
git checkout -b milestone-2        # M2 branches from milestone-1
git push origin milestone-2

# Continue for each additional milestone...
# git checkout milestone-N && git checkout -b milestone-(N+1)
```

> **Rule**: `milestone-2` branches FROM `milestone-1` (not from develop). This ensures all M1 features are inherited when M2 development starts.

Then update `AI_DOCS/memory/project-context.md`:
```
## Git State
- Current Milestone Branch: milestone-1
- All Milestone Branches: milestone-1, milestone-2, ...
- Branch Creation Date: [YYYY-MM-DD]
```

And update `AI_DOCS/planning/milestone-plan.md` — add a `Branch` column to the roadmap table:

```markdown
| ID | Milestone Name | Branch | Dependency | Status |
|---|---|---|---|---|
| M1 | [Name] | milestone-1 | develop | PENDING |
| M2 | [Name] | milestone-2 | milestone-1 | PENDING |
```

---

## Milestone Transition Protocol

When a milestone completes, follow the full transition checklist in:
`milestone-planning/templates/milestone-transition.md`

Summary:
1. Verify all features merged to `milestone-N` via PRs
2. QA gate passed (Gate 4)
3. Merge `milestone-N` → `develop` with `--no-ff`
4. Tag release on develop (e.g., `v0.N.0`)
5. New work starts on `milestone-N+1` (already branched from `milestone-N`)
6. Update `AI_DOCS/memory/` and regenerate `CLAUDE.md`

---

## Critical Rules

1. **NO ALL-AT-ONCE**: Never plan more than 2 milestones for concurrent development.
2. **GATE LOCK**: A milestone is NOT complete until all its Gate Checks are marked as passed in `gate-status.md`.
3. **TECH DEBT CAP**: If a milestone ends with >5 non-critical bugs, the next milestone CANNOT start until they are resolved.
4. **MVP FOCUS**: Clearly identify which milestone constitutes the "Minimum Viable Product".
5. **BRANCHES ON APPROVAL**: Create all milestone git branches immediately when the plan is approved — not when development starts. The branching model (one-branch-per-milestone, promotion tiers) is read from `AI_DOCS/deployment/git-strategy.md`, set in `/do` intake; do not hardcode it here. `github-ops` owns branch creation.
6. **SEQUENTIAL BRANCHING**: `milestone-N+1` ALWAYS branches from `milestone-N`. Never from `develop` or `main`.
7. **DATA BEFORE DISPLAY (BLOCKING)**: a milestone that consumes an entity (dashboard, report, stats, any FK child) is ordered no earlier than the milestone that produces it (same milestone is fine; intra-milestone order is handled by `blockedBy` + the vertical slice). The dependency graph + `milestone-order-check.sh` enforce this. Aggregation/reporting milestones, which consume many entities, are always last.

<!-- Version: 1.6.0 | 2026-10-05 | Added "Alignment with the client workscope": internal milestones map to the approved workscope's dated Section 5 milestones (ZENi5 structure, owned by the workscope skill), workscope deliverables become exit criteria, and a window that cannot hold is raised as a change request. -->
