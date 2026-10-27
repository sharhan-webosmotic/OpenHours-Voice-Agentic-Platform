---
name: tech-specification
description: "Generate a complete 23-section technical specification with API contracts, database schemas, compliance/security matrix, traceability matrix, and UI specs. Use when creating or updating the tech spec, defining architecture, or establishing the API contract. Also triggers on: 'Start new project', 'Create tech spec', 'Generate spec from workscope'."
effort: xhigh
mcp_integrations: [context7, sequential-thinking]
next_skill: guardrails
required_gate: null
skill_id: SK-070
context_budget:
  load_kb: 35
  scope: task
version: 1.7.4
dependencies:
  required: [session-management]
  optional: [workscope, design-discovery, design-tokens, design-screens]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Technical Specification

> **Purpose**: Generate a complete Technical Specification from the project Workscope, split into focused linked files.
> **Output**: Multiple files under `AI_DOCS/planning/` — see File Structure below.
> **Lifecycle**: Created at project start. Updated (never replaced) when features change. Each file is independently readable and linkable.

Narrative sections (problem statement, overview prose) follow `rules/document-generation-rules.md`. Tables, API contracts, and schemas are mechanical, exempt per Rule 8.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (all free, auto-provisioned in the project `.mcp.json`):

- `context7` (free): stack and component research for the spec.
- `sequential-thinking` (free): complex specification and traceability reasoning.

---

## Output File Structure

The Technical Specification is **split into multiple files** to prevent long-document issues, enable focused updates, and allow skills to read only what they need.

```
AI_DOCS/planning/
├── tech-spec.md              ← Index file — links to all sections below
├── spec/
│   ├── 01-problem.md         ← S1: Problem Definition
│   ├── 02-scope.md           ← S2: Scope (Included / Excluded)
│   ├── 03-roles.md           ← S3: User Roles & Permissions
│   ├── 04-user-flows.md      ← S4: User Flows (all roles)
│   ├── 05-ui-spec.md         ← S5: UI/UX Design Specification (per screen)
│   ├── 07-data-model.md      ← S7: Data Model / Schema
│   ├── 08-business-logic.md  ← S8: Business Logic Rules
│   ├── 09-edge-cases.md      ← S9: Edge Cases
│   ├── 10-state.md           ← S10: State Management
│   ├── 11-validation.md      ← S11: Validation Rules
│   ├── 12-performance.md     ← S12: Performance Expectations
│   ├── 13-logging.md         ← S13: Logging & Monitoring
│   ├── 14-folder-structure.md← S14: Folder Structure
│   ├── 15-coding-rules.md    ← S15: Coding Rules
│   ├── 16-tech-constraints.md← S16: Tech Constraints
│   ├── 17-definition-of-done.md ← S17: Definition of Done
│   ├── 18-test-cases.md      ← S18: Test Cases
│   ├── 19-sequence-diagrams.md← S19: Sequence Diagrams (all Mermaid diagrams MUST follow `rules/mermaid-rules.md`: quote labels with special characters, no bare lowercase `end`, validate in mermaid.live before locking)
│   ├── 20-compliance-security.md← S20: Compliance & Security Matrix (FE + BE)
│   ├── 21-traceability.md    ← S21: Traceability Matrix (idea→FE→BE→DB→infra)
│   ├── 22-cross-cutting.md   ← S22: Cross-Cutting Concerns
│   └── 23-public-surface.md  ← S23: Public & Business Surface
│
AI_DOCS/architecture/
│   ├── api-contract.md       ← S6: API Contract (extracted to its own file — the live contract)
│   ├── database-schema.md    ← Detailed ERD / schema diagrams
│   └── adrs/                 ← Architecture Decision Records
```

> **Note on Section 6 (API Contract)**: It lives in `AI_DOCS/architecture/api-contract.md` — NOT in the spec/ folder. It is the contract file used by build at runtime. It is NOT a static spec section — it is a living document read before every API implementation.

### `tech-spec.md` — The Index File

This is the ONLY file that is required to exist on day one. Sub-files are created as each section is completed.

```markdown
# Technical Specification — [Project Name]

> Last Updated: [YYYY-MM-DD]
> Version: [1.0, 1.1, etc.]
> Status: [IN PROGRESS / APPROVED]

## Section Index

| # | Section | File | Status |
|---|---------|------|--------|
| 1 | Problem Definition | [01-problem.md](spec/01-problem.md) | [DRAFT / APPROVED] |
| 2 | Scope | [02-scope.md](spec/02-scope.md) | [DRAFT / APPROVED] |
| 3 | User Roles & Permissions | [03-roles.md](spec/03-roles.md) | [DRAFT / APPROVED] |
| 4 | User Flows | [04-user-flows.md](spec/04-user-flows.md) | [DRAFT / APPROVED] |
| 5 | UI/UX Specification | [05-ui-spec.md](spec/05-ui-spec.md) | [DRAFT / APPROVED] |
| 6 | API Contract | [api-contract.md](../architecture/api-contract.md) | [DRAFT / LOCKED] |
| 7 | Data Model | [07-data-model.md](spec/07-data-model.md) | [DRAFT / APPROVED] |
| 8 | Business Logic | [08-business-logic.md](spec/08-business-logic.md) | [DRAFT / APPROVED] |
| 9 | Edge Cases | [09-edge-cases.md](spec/09-edge-cases.md) | [DRAFT / APPROVED] |
| 10 | State Management | [10-state.md](spec/10-state.md) | [DRAFT / APPROVED] |
| 11 | Validation Rules | [11-validation.md](spec/11-validation.md) | [DRAFT / APPROVED] |
| 12 | Performance | [12-performance.md](spec/12-performance.md) | [DRAFT / APPROVED] |
| 13 | Logging & Monitoring | [13-logging.md](spec/13-logging.md) | [DRAFT / APPROVED] |
| 14 | Folder Structure | [14-folder-structure.md](spec/14-folder-structure.md) | [DRAFT / APPROVED] |
| 15 | Coding Rules | [15-coding-rules.md](spec/15-coding-rules.md) | [DRAFT / APPROVED] |
| 16 | Tech Constraints | [16-tech-constraints.md](spec/16-tech-constraints.md) | [DRAFT / APPROVED] |

> [!CRITICAL]
> **Section 16 version rule**: Before writing any runtime, framework, database, or tooling version into `16-tech-constraints.md`, you MUST verify the current LTS/stable version online (nodejs.org/releases, endoflife.date, `npm view <pkg> version`, PyPI). Do NOT write versions from training-cutoff memory. See `.claude/rules/development-rules.md` Rule 31. If offline, mark as `<LTS-TBD>` and resolve before Gate 1 approval.
| 17 | Definition of Done | [17-definition-of-done.md](spec/17-definition-of-done.md) | [DRAFT / APPROVED] |
| 18 | Test Cases | [18-test-cases.md](spec/18-test-cases.md) | [DRAFT / APPROVED] |
| 19 | Sequence Diagrams | [19-sequence-diagrams.md](spec/19-sequence-diagrams.md) | [DRAFT / APPROVED] |
| 20 | Compliance & Security Matrix | [20-compliance-security.md](spec/20-compliance-security.md) | [DRAFT / APPROVED] |
| 21 | Traceability Matrix | [21-traceability.md](spec/21-traceability.md) | [DRAFT / APPROVED] |
| 22 | Cross-Cutting Concerns | [22-cross-cutting.md](spec/22-cross-cutting.md) | [DRAFT / APPROVED] |
| 23 | Public & Business Surface | [23-public-surface.md](spec/23-public-surface.md) | [DRAFT / APPROVED] |

## Change Log
| Date | Section | Change | Author |
|---|---|---|---|
| [YYYY-MM-DD] | [#] | [what changed] | [User / AI] |
```

### Architecture Diagrams (MANDATORY for multi-service projects)

> [!CRITICAL]
> If the project has **multiple apps/services** (e.g., web + api + mobile, or microservices), architecture documentation is MANDATORY — even if deployment is not planned yet.

**Generate these in `AI_DOCS/architecture/`** (Mermaid source per `rules/mermaid-rules.md`, while any rendered or client-facing version is drawn with the `diagram-design` plugin, see the `architecture` skill):

| Document | When Required | Content |
|----------|---------------|---------|
| `architecture.md` | ALWAYS (multi-service) | System context diagram — what talks to what |
| `api-contract.md` | ALWAYS (has API) | All endpoints, request/response shapes |
| `database-schema.md` | ALWAYS (has DB) | Entity relationships, indexes, constraints |
| `sequence-diagrams.md` | ALWAYS (multi-service) | Key user flows across services |
| `adrs/` | ALWAYS | Architecture Decision Records (ADR format) |

**System context diagram must show:**
```
[Web App] → [API Server] → [Database]
              ↓
          [Mobile App]
              ↓
          [Third-party APIs (payment, auth, etc.)]
```

**Run the `architecture` skill** alongside tech-specification to document:
- Which services exist and how they communicate
- Auth flow across services (who issues tokens, who validates)
- Shared vs separate databases
- Key ADRs (monolith vs microservices, DB choice, caching, auth strategy)

### Rules for Multi-File Output

1. **Create `tech-spec.md` index first** — then fill in section files as they are generated
2. **Never merge sections back** into a single file — the split is permanent
3. **Update the index Status column** as each section is approved (`DRAFT` → `APPROVED`)
4. **Section 6 (API Contract)** goes to `AI_DOCS/architecture/api-contract.md` — always — not into spec/
5. **When a skill needs a specific section**, it reads that file directly — not the whole spec
6. **When a section changes**, update only that file + the Change Log in `tech-spec.md`

### Which Skills Read Which Files

| Skill | Files It Reads |
|---|---|
| `build` | `tech-spec.md` (index), `spec/05-ui-spec.md`, `spec/08-business-logic.md`, `spec/14-folder-structure.md`, `spec/15-coding-rules.md`, **`api-contract.md`** |
| `qa-testing` | `spec/09-edge-cases.md`, `spec/17-definition-of-done.md`, `spec/18-test-cases.md` |
| `design-system` | `spec/05-ui-spec.md`, `spec/03-roles.md`, `spec/04-user-flows.md` |
| `data-migration` | `spec/07-data-model.md` |
| `guardrails` | `spec/15-coding-rules.md`, `spec/16-tech-constraints.md` |
| `deployment` | `spec/12-performance.md`, `spec/13-logging.md` |
| `change-request` | `tech-spec.md` (index + relevant section file) |
| `milestone-planning` | `tech-spec.md` (index), `spec/02-scope.md` |

---

## Initialization

> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Lifecycle Rules

> [!CRITICAL]
> **These rules govern the entire existence of `tech-spec.md`.**

| Scenario | Action |
|----------|--------|
| New project with Workscope | Read Workscope (+ `AI_DOCS/planning/requirements-baseline.md` when present, for decision and conflict context) → Generate full spec (all 23 sections) in one pass |
| New feature request | Update relevant sections first → Log in Change Log → Implement after approval |
| Bug report | Check if behavior matches spec → If yes, ask user: requirement wrong or implementation wrong? |
| Requirements change | Amend affected sections → Version-stamp → Re-approve changed sections only |
| Session restore | Read existing `tech-spec.md` as source of truth |

> [!CAUTION]
> - NEVER create a new `tech-spec.md` — always update the existing one
> - NEVER implement a feature before updating the spec
> - NEVER skip a section — mark as `[TBD - required before this module's implementation]` if unknown

---

## Mandatory Pre-Generation Questions

Read `AI_DOCS/planning/requirements-baseline.md` first when it exists: its decision and conflict registers give spec decision context the workscope alone lacks. Check its Section 9 readiness verdict. On "Not ready", list the blocking High-impact questions and do not spec those areas as decided. Never spec an Open or Proposed requirement as a decision: carry it as an open item or an assumption with its Basis tag.

Before generating the spec, verify the following are known. If any are missing, ask:

1. **Project Name & Objective** — What does this system do in 1-2 sentences?
2. **Tech Stack** — Frontend, Backend, Database, Auth?
3. **User Roles & the permission model (S3 is the CANONICAL RBAC source)** — who uses this system, and how is access modeled? S3 (`spec/03-roles.md`) is the single source the `authz-matrix.yaml` is generated from, so it must define: the access MODE (static fixed-role, or dynamic permission-based / PBAC where roles are custom and permissions are toggled per role/user), the PERMISSIONS catalog (atomic capabilities), each role as a BUNDLE of permissions, permission DEPENDENCIES (e.g. `project.assign` needs `user.read`), and FIELD-LEVEL access (read/write/masked/none per sensitive field). Ask the user whether the model is static or dynamic if unclear. In dynamic mode, access is decided by permission, never by role name.
4. **Project Type** — POC / MVP / Production-Grade?
5. **Multi-Dev Setup** — Will frontend and backend be worked on by different developers/teams?
   - If yes: *"How would you like to share the Technical Specification — same repo, separate shared repo, or shared docs folder?"*
6. **GitHub Ops** — Do you want to enable GitHub operations (commit, branch, PR) for this project?
7. **MongoDB in Stack** — If yes: *"Do you want to clone https://github.com/mongodb/agent-skills for MongoDB-specific AI skills?"*

---

## The 23 Sections (Mandatory Output Format)

Generate `AI_DOCS/planning/tech-spec.md` using exactly this structure. See [SECTION-TEMPLATES.md](SECTION-TEMPLATES.md) for the content format template of each section (S1-S5, S7-S23).

> Sections 20-23 were added to close planning gaps: S20 unified frontend+backend compliance/security, S21 the traceability spine (also the index `change-request` walks for stale-doc propagation), S22 cross-cutting concerns, S23 the public/business surface. Navigation, sitemap, and onboarding artifacts are produced by `design-screens` (Gate 3.5), and the infrastructure plan by `infra-planning`; S21 references all of them.

### Section 6: API Contract

See [API-FORMAT.md](API-FORMAT.md) for the full API contract format, example endpoints, post-approval steps, and mismatch prevention rules.

**Key rules for Section 6:**
- It is the **source of truth** for all API endpoints
- Lives in `AI_DOCS/architecture/api-contract.md` — NOT in the spec/ folder
- Base URL: `/api/v1/` unless specified otherwise
- Response envelope: `{ success: boolean, data: T, message?: string }`
- Any endpoint change requires a Change Request updating BOTH this section AND `api-contract.md`

---

## Change Log (Mandatory — Maintained at Bottom of Generated File)

```markdown
## Change Log

| Version | Date | Sections Changed | Reason | Approved By |
|---------|------|-----------------|--------|-------------|
| v1.0 | [date] | All | Initial creation from Workscope | [User] |
```

---

## Critical Rules

> [!CAUTION]
> 1. NEVER skip a section. If unknown, mark as `[TBD - must complete before [module] implementation]`
> 2. NEVER start coding a module before its spec sections are approved
> 3. NEVER implement what is not in the spec without updating the spec first
> 4. ALWAYS update the Change Log when any section is modified
> 5. The spec is the single source of truth — code must match it, not the other way around

---

## Gate Condition

This skill's output satisfies the spec portion of **Gate 1: Planning Completeness** in [gate-enforcement](../gate-enforcement/SKILL.md). The full gate also checks the design IA artifacts and the infra plan.

Gate passes when:
- All 23 sections present in `AI_DOCS/planning/tech-spec.md`
- No section is blank (TBDs are acceptable only with a module deadline noted; S20-S23 rows may be `N/A (reason)` but not empty)
- S21 Traceability Matrix lists every `api-contract.md` endpoint (mapped to a screen or tagged `backend-only`)
- Change Log initialized

> Note: the full Planning Completeness Gate (which also checks the `design-screens` IA artifacts and `infra-planning` output) is enforced by `gate-enforcement`. This skill's local gate covers the spec file itself.

## Rules Integration
> - `.claude/rules/api-rules.md` — Section 6 (API Contract) must follow contract-first patterns
> - `.claude/rules/development-rules.md` — Section 15 (Coding Rules) must align with development rules
> - `.claude/rules/testing-rules.md` — Section 18 (Test Cases) must follow testing standards
> - `.claude/rules/security-rules.md` — security requirements must align with OWASP rules

## Next Step

Proceed to [guardrails](../guardrails/SKILL.md) skill, then [code-quality](../code-quality/SKILL.md) before any implementation begins.

<!-- Version: 1.7.0 | 2026-08-06 | S7 Data Model template gains the mandatory Time fields rule: timestamptz/UTC for every moment-in-time column, prefer timestamp over date (date-only needs a documented calendar-concept reason), IANA zone stored alongside when scheduling in local time, ISO 8601 with offset at the API (development-rules 48-52) -->
<!-- Version: 1.7.2 | 2026-10-14 | Points rendered architecture diagrams at the diagram-design plugin. -->
<!-- Version: 1.7.3 | 2026-10-14 | Honors the requirements-baseline readiness verdict and Basis tags. -->

<!-- Version: 1.7.4 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
