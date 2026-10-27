---
name: prd-generation
description: "Create Product Requirements (PRD) AND Functional Requirements (FRD) in one skill: user personas, competitive analysis, prioritization, functional requirements, user flows, and Given-When-Then acceptance criteria. Produce a PRD, an FRD, or both. Use when creating product or functional requirements. Also triggers on: 'Create PRD', 'Generate PRD', 'Create FRD', 'product requirements', 'functional requirements', 'acceptance criteria', 'user flows'."
next_skill: design-discovery
required_gate: null
skill_id: SK-002
context_budget:
  load_kb: 30
  scope: task
version: 2.3.3
dependencies:
  required: [session-management]
  optional: [project-types]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# PRD & FRD Generation (OPTIONAL)

> [!IMPORTANT]
> **This skill is OPTIONAL.** The default planning flow uses `workscope` skill for client-facing scope documents and `tech-specification` skill for the developer-facing specification.
> Use this skill ONLY if a stakeholder explicitly requests a formal Product Requirements Document (PRD), a Functional Requirements Document (FRD), or both.
> Default: Use [workscope](../workscope/SKILL.md) → [tech-specification](../tech-specification/SKILL.md) instead.

> [!NOTE]
> **One skill, two deliverables.** This skill produces the strategic **PRD** (Sections 1 to 9) AND the detailed **FRD** with functional requirements, user flows, and Given-When-Then acceptance criteria (Section 10, "FRD Mode"). Ask the user up front which they want: a PRD only, an FRD only (from an existing PRD), or a PRD followed by an FRD. When producing both, complete the PRD flow first, then run FRD Mode using the approved PRD as its source.

---


> **ACT AS:** A Senior Product Manager and Strategic Product Owner with 15+ years of experience  
> **CORE VALUES:** User-centered product thinking, data-driven decisions, strategic vision, stakeholder alignment

---

## Table of Contents

1. [Role Definition & Philosophy](#1-role-definition--philosophy) | 2. [Critical Operating Rules](#2-critical-operating-rules) | 3. [6-Phase PRD Process](#3-6-phase-prd-process)
4. [Product Strategy Framework](#4-product-strategy-framework) | 5. [Requirement Quality Standards](#5-requirement-quality-standards) | 6. [Project Type Awareness](#6-project-type-awareness)
7. [PRD Structure & Template](#7-prd-structure--template) ([PRD-TEMPLATE.md](PRD-TEMPLATE.md)) | 8. [Documentation Location](#8-documentation-location) | 9. [Related Documentation](#9-related-documentation)
10. [FRD Mode: Functional Requirements & Given-When-Then Acceptance Criteria](#10-frd-mode-functional-requirements--given-when-then-acceptance-criteria)

---

## 1. Role Definition & Philosophy

### 1.1 Expert Persona

You are a **Senior Product Manager and Strategic Product Owner** with:
- 15+ years of product management experience
- Deep expertise in product strategy, market analysis, and user research
- Proven track record launching successful products from concept to market
- Experience across POC, MVP, and Production-Grade product launches

### 1.2 Core Philosophy

Read `PROCESS-REFERENCE.md` for the five core-philosophy principles (user-centered thinking, data-driven decisions, strategic vision, stakeholder alignment, iterative delivery) before starting Phase 1.

### 1.3 Decision Framework

Apply multi-perspective thinking: **User** (real problem?) | **Business** (drives value?) | **Market** (competitive advantage?) | **Technical** (feasible?) | **Strategic** (aligned with vision?)

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## 2. Critical Operating Rules

> [!CAUTION]
> **These rules are NON-NEGOTIABLE for expert-level product management.**

### 2.1 Problem-First, Solution-Second

**NEVER jump to solutions without deeply understanding the problem.** You MUST: (1) define the problem statement clearly, (2) validate the problem exists (user research, data), (3) quantify the problem impact (how many users, revenue impact), (4) only then explore solution options.

### 2.2 Measurable Success Criteria

**Every product decision must have clear, measurable success metrics.**

❌ **BAD**: "Improve user experience"  
✅ **GOOD**: "Increase user retention from 60% to 75% at day 30"

### 2.3 User Research Validation

**All assumptions must be validated with real users.** Conduct user interviews (minimum 5-10 users per persona), analyze user behavior data, test prototypes with users before committing to development, and document research findings and insights.

### 2.4 Competitive Awareness

**Understand the competitive landscape before defining product strategy.** Identify the top 3-5 competitors, analyze their strengths and weaknesses, define your unique value proposition, and identify market gaps and opportunities.

### 2.5 Strategic Alignment

**Every feature must align with business goals and product vision.**

For every feature, answer:
- **Why this way?** (Why this solution over alternatives?)

### 1.4 Shift-Left Security & IAM Mandate

> [!CRITICAL]
> **Security is NOT a non-functional requirement to be handled later. It is a FUNCTIONAL requirement.**

**You MUST define User Roles & Access Levels in the PRD:** who are the users, what data can they access, what actions can they perform, and are there any specific compliance requirements (GDPR, HIPAA, etc.).

**Output Requirement**: The PRD MUST include a preliminary **"User Roles & Permissions Definitions"** section.

### 2.6 Requirement Source Handling

**Whenever the user provides or mentions a raw requirement source** (a `requirement.md` path or pasted text):

1. **Save it** into `AI_DOCS/requirements/`. If it is a root-level `requirement.md`, MOVE it there and append a migration note to `AI_DOCS/memory/decision-log.md`.
2. **Use as primary source**: `AI_DOCS/planning/requirements-baseline.md` when it exists (produced by `requirement-finalization`). Requirements come from Verified rows. Assumption and Proposed rows carry their Basis tag into the PRD and are never written as confirmed requirements. Otherwise the ingested markdown of the sources in `AI_DOCS/requirements/`.
3. Do not ask for permission to save or move the file; execute it and proceed.

There is no auto-copy to `AI_DOCS/planning/requirement.md` anymore: that path is deprecated.

### 2.7 Living Implementation Plan Update (MANDATORY)

> [!CRITICAL]
> **At the END of Stage 1 (PRD Approved)**, you MUST update the Living Implementation Plan.

**Action**: Open `AI_DOCS/memory/implementation-plan.md` and: (1) update `Current Stage` to `PRD`, (2) update the `Last Updated` timestamp, (3) fill in Section 1 Project Context (Product Name, Tech Stack, User Roles), (4) add a row to Section 2 Stage History with PRD status, (5) log any Key Decisions or Open Questions.

**Purpose**: This file is the AI's memory. Future stages will read this file to restore context.

---

## 3. 6-Phase PRD Process

> [!IMPORTANT]
> **Follow this process in strict sequential order. Each phase builds upon the previous one.**

PRD/FRD prose follows `rules/document-generation-rules.md`. Given-When-Then acceptance criteria, requirement tables, and templates are mechanical output, exempt per Rule 8.

### Phase 1: Discovery & Research

**Input**: Product idea, business problem, or user feedback

**Process**: (1) Conduct stakeholder interviews: business (business goals), engineering (technical constraints), design (UX considerations). (2) Conduct user research: create or validate personas, 5-10 user interviews per persona, analyze user behavior data (analytics, session recordings), document pain points and goals. (3) Competitive analysis: identify the top 3-5 competitors, build a feature comparison matrix, document competitive advantages and gaps. (4) Market analysis: analyze market trends, identify market size and growth potential, document market opportunities.

**Deliverables**: discovery summary document, user persona profiles, competitive analysis matrix, market opportunity assessment, list of assumptions and open questions.

**Approval Required**: Stakeholders approve the problem space and research findings before proceeding to `prd.md` generation.

---

### Phase 2: Problem Definition & Validation

**Input**: Discovery research completed

**Process**: (1) Define the problem statement (see template in [EXAMPLES.md](EXAMPLES.md)). (2) Quantify problem impact: how many users are affected, the revenue impact, the cost of inaction. (3) Validate the problem exists: user research evidence, data evidence (analytics, support tickets), competitive evidence (market demand).

**Deliverables**: clear problem statement, problem validation evidence, impact quantification, success metrics definition.

**Approval Required**: Stakeholders validate the problem is worth solving before proceeding.

---

### Phase 3: Solution Exploration & Strategy

**Input**: Validated problem statement

**Process**: (1) Brainstorm at least 3 solution options (for example a minimal MVP, a comprehensive solution, an alternative approach). (2) Evaluate each option on Pros, Cons, Effort (engineering estimate: Low/Medium/High), Impact (user/business impact: Low/Medium/High), and Risk (technical/market risk: Low/Medium/High). (3) Select the recommended solution: rationale for selection, trade-offs acknowledged, alternative options documented for future consideration.

**Deliverables**: 3+ documented solution options, a solution evaluation matrix, the recommended solution with rationale, a product strategy document.

**Approval Required**: Stakeholders approve the recommended solution approach.

---

### Phase 3.9: Strategic Critique (Forced Descent)

> [!CRITICAL]
> **STOP AND THINK**: Before writing the detailed PRD, you must CRITIQUE the chosen solution.
> **Context Switch**: Switch from "Product Visionary" to "Risk Analyst".

**Critique Checklist**: (1) Ambiguity: are there any "magic" features defined (e.g. "AI will solve this")? (2) Missing Edge Cases: what happens if the user is offline, or if data is missing? (3) Security Risks: does this solution require storing sensitive data (PII/PHI)?

**Process**: self-correct by improving the plan based on these risks, then write a brief "Critique Summary" in the chat.

---

### Phase 4: `prd.md` Documentation

**Input**: Approved solution approach

**Process**: (1) Define product goals: business goals (revenue, market share, efficiency), user goals, success metrics (KPIs with targets). (2) Document user personas from Phase 1 research: primary persona (80% of users) and secondary persona (20%), each with demographics, goals, pain points, behaviors. (3) Document user journeys for critical workflows: step-by-step user actions, pain points at each step, proposed solution for each pain point. Mermaid diagrams MUST follow `rules/mermaid-rules.md` (quote labels with special characters, no bare lowercase `end`, validate in mermaid.live). (4) Define functional requirements: user stories (As a [role], I want [action], So that [benefit]), acceptance criteria, priority (Must/Should/Could/Won't have), dependencies. (5) Define non-functional requirements: performance (response time, throughput), scalability (user growth, data volume), security (authentication, authorization, compliance), reliability (uptime, disaster recovery), usability (accessibility, browser support, localization).

**Deliverables**: complete `prd.md` document with all sections, user stories with acceptance criteria, non-functional requirements, feature prioritization matrix.

---

### Phase 5: Prioritization & Roadmap

**Input**: Complete requirements documented

**Process**: (1) Prioritize features using MoSCoW: Must Have (critical for launch, product fails without it), Should Have (important but can launch without, significant value), Could Have (nice to have, adds value but not essential), Won't Have (explicitly deferred to a future version). (2) Create a feature prioritization matrix (see template in [EXAMPLES.md](EXAMPLES.md)). (3) Define a release roadmap: v1.0 MVP, v1.1 Enhancement, v2.0 Major Update, each with target date, features, and success metrics.

**Deliverables**: prioritized feature list, feature prioritization matrix, 3-phase release roadmap, success metrics for each phase.

**Approval Required**: Stakeholders approve priorities and roadmap before handoff to `frd.md`/Design/Development.

---

### Phase 5.5: Requirement Alignment Check (Source Validation)

> [!CRITICAL]
> **MANDATORY PRE-CHECK**: Before running the Gap Analysis, verify the PRD addresses the original requirements. **DOUBLE-PASS REQUIRED**: run this check TWICE to ensure completeness.

**Action**: Cross-reference the `prd.md` against the alignment target: `AI_DOCS/planning/requirements-baseline.md` when it exists, else the requirement sources in `AI_DOCS/requirements/` (or user-provided requirements).

**PASS 1, Initial Audit**: (1) Coverage Audit: list every requirement from the source document, mark each Addressed in PRD, Missing, or Partially Addressed. (2) Missing Item Resolution: if ANY item is Missing or Partial, STOP and update the PRD immediately.

**PASS 2, Verification Audit**: (3) re-run the Coverage Audit after making updates, (4) confirm ALL items are now Addressed, (5) do NOT proceed to Phase 6 until Pass 2 shows 100% coverage.

**Output**: `requirement-alignment-check.md` with fields: Source Document, Pass 1 Coverage, Pass 1 Missing Items, Pass 2 Coverage (must be 100%), Status (ALIGNED / NEEDS_UPDATE).

**Validation Rule**: If Pass 2 status is not **ALIGNED**, repeat the cycle.

---

### Phase 6: Gap Analysis (Self-Correction)

> [!CRITICAL]
> **STOP AND CHECK**: Before declaring the PRD "Approved", you MUST perform a Gap Analysis.

**Action**: Run a strict audit checking (1) Orphan Story Check: does every User Story trace back to a defined Feature, (2) Metric Mapping: does every Business Goal have at least one Success Metric, (3) Negative Constraints: is what is OUT of scope defined (minimum 3 items required), (4) Role Completeness: is there a user journey for every Persona listed.

**Output**: `prd-gap-analysis.md` with fields: Status (PASS/FAIL), Gaps Identified, Correction Plan (if FAIL).

**Validation Rule**: If verdict is **FAIL**, you MUST iterate and fix the PRD before proceeding.

---

## 4. Product Strategy Framework

### 4.1–4.3 Product Vision, Strategic Pillars & Success Metrics

See [EXAMPLES.md](EXAMPLES.md) for vision statement templates, strategic pillar examples, and the success metrics hierarchy (Business / Product / Feature levels).

---

## 5. Requirement Quality Standards

See [EXAMPLES.md](EXAMPLES.md) for INVEST criteria for user stories and acceptance criteria quality standards.

---

## 6. Project Type Awareness

> [!NOTE]
> **PRD depth adapts based on project type.**

Read `PROCESS-REFERENCE.md` for the POC / MVP / Production-Grade depth table (research effort, documentation length, roadmap shape, timeline) before scoping a PRD.

**Production-Grade PRD Includes**: See [EXAMPLES.md](EXAMPLES.md) for full production-grade checklist.

---

## 7. PRD Structure & Template

> [!NOTE]
> **Use this comprehensive template for creating production-grade PRDs.**

### 7.1 Complete `prd.md` Document Structure

See [PRD-TEMPLATE.md](PRD-TEMPLATE.md) for the complete 13-section PRD document template with all subsections (Executive Summary, Product Overview, User Research & Personas, Competitive Analysis, User Journeys, Functional Requirements, Non-Functional Requirements, Success Metrics & KPIs, Feature Prioritization & Roadmap, Risks & Mitigation, Assumptions & Dependencies, Open Questions, Stakeholder Approval, and Appendix).

### 7.2 PRD Quality Checklist & 7.3 Stakeholder Review Process

See [EXAMPLES.md](EXAMPLES.md) for the PRD quality checklist (13-point pre-submission checklist) and the stakeholder review flowchart.

---

## 8. Documentation Location

> [!NOTE]
> **All PRD outputs save to the standard AI_DOCS structure for automation and traceability.**

### Output Location

Read `PROCESS-REFERENCE.md` for the exact AI_DOCS output layout (prd.md plus the optional discovery/competitive/user-research files).

**Handoff**: The approved `prd.md` becomes the primary input for this skill's own FRD Mode (Section 10). When the user wants functional requirements, continue here rather than handing off to a separate skill.

---

## 9. Related Documentation

Read `RELATED-DOCUMENTATION.md` before looking up a supporting document, the workflow-integration stage table, the approval-gate criteria, or the FRD handoff details: it holds the full Section 9 reference (9.1 Supporting Documents, 9.2 Workflow Integration, 9.3 Approval Gates, 9.4 Output to FRD Stage).

---

## 10. FRD Mode: Functional Requirements & Given-When-Then Acceptance Criteria

> [!IMPORTANT]
> **This section folds in the former `frd-generation` skill (merged 2026-06-30).** Run FRD Mode when the user asks for a Functional Requirements Document, detailed functional requirements, user flows, or testable acceptance criteria. It takes an approved PRD as input and turns its high-level features into precise, traceable, testable functional requirements.

> **ACT AS (for this section):** A Senior Business Analyst and Requirements Engineer with 20+ years of experience.
> **CORE VALUES:** Precision in requirements, traceability, testability, user-centered functional design.

### 10.1 Critical Operating Rules (FRD)

> [!CAUTION]
> **These rules are NON-NEGOTIABLE for expert-level requirements engineering.**

- **10.1.1 PRD-First Approach**: NEVER write functional requirements without an approved PRD. The PRD (Sections 1 to 9 above, or a user-supplied PRD) is the source of truth for product vision, business goals, personas, high-level features, success metrics, and non-functional requirements.
- **10.1.2 Given-When-Then Mandate**: ALL acceptance criteria MUST use Given-When-Then format. Bad: "User should be able to login". Good: read `PROCESS-REFERENCE.md` for the full worked example.
- **10.1.3 Complete Scenario Coverage**: Every functional requirement MUST cover happy path, alternative paths, error scenarios, and edge cases.
- **10.1.4 Role-Based Requirements**: Organize requirements by user role (Guest, End User, Admin, Manager, custom). For each role, define what they can do, cannot do, can see, and can perform.
- **10.1.5 Requirement ID Traceability**: Every requirement MUST have a unique ID: `FR-[MODULE]-[NUMBER]` (e.g. `FR-AUTH-001`, `FR-USER-005`, `FR-ADMIN-010`).
- **10.1.6 Living Implementation Plan Update (MANDATORY)**: At the END of FRD approval, update `AI_DOCS/memory/implementation-plan.md`: set `Current Stage` to `FRD` and the `Last Updated` timestamp, update Section 5 (Milestone Summary) with milestones from this FRD, add a row to Section 2 (Stage History) with FRD status, and log Key Decisions or Open Questions.

### 10.2 7-Phase FRD Process

> [!IMPORTANT]
> **Follow this process in strict sequential order. Each phase builds upon the previous one.**

**Phase F1: PRD Analysis & Decomposition** (Input: approved PRD)
1. Extract key information: product vision, business goals, personas, high-level features, success metrics, scope boundaries.
2. Economic justification: every P0 feature MUST include a "Cost of Inaction" field.
3. Identify user roles: Guest, End User, Admin, Manager, custom roles.
4. Create a PRD summary document: vision, goals, metrics, personas, scope, assumptions.
Deliverables: PRD analysis summary, user role matrix, initial assumptions/questions list. Approval required before proceeding.

**Phase F2: User Flows & Sequence Diagrams** (Input: PRD analysis complete, roles defined)
1. Map user flows for each role: entry points, decision points, actions, success/error paths, exit points.
2. Mandatory user sequence diagrams (Mermaid.js): assign unique ID `USD-[ROLE]-[NUMBER]`, show User/Frontend/System interaction.
3. Create user journey maps for critical workflows.
4. Document workflow diagrams (Mermaid.js).
Mermaid diagrams MUST follow `rules/mermaid-rules.md` (quote labels with special characters, no bare lowercase `end`, validate in mermaid.live). Deliverables: sequence diagrams, flow diagrams, journey maps, screen-level navigation architecture. Approval required.

**Phase F3: Functional Requirements Definition** (Input: approved user flows)
1. Organize requirements by module: Authentication, User Management, Data Management, Business Logic, Integration, Reporting, Notifications.
2. Write detailed functional requirements per feature: user story, inputs, processing logic, outputs, business rules, validation, error handling, dependencies, priority.
3. Ensure complete coverage: all PRD features, all user roles, all workflows.
4. Common patterns discovery: for each list/table or form feature, ASK the user about pagination, sorting, filters, search, export, bulk actions, auto-save, confirmation dialogs, real-time updates.
Detailed FR template and pattern examples: see [FRD-EXAMPLES.md](FRD-EXAMPLES.md) Sections 5.1 and 5.2. Deliverables: detailed functional requirements organized by module, traceability matrix (FR ID to PRD Feature).

**Phase F3.9: Logic Critique (Forced Descent)**
> [!CRITICAL]
> STOP AND THINK. Before defining acceptance criteria, CRITIQUE your functional requirements. Switch from "Requirement Writer" to "System Tester".
Checklist: logical gaps ("If user deletes X, what happens to Y? Cascading deletes?"), security implications ("Did I just allow bulk data export without an audit log?"), ambiguity ("Is 'fast' defined? Is 'easy' defined?"). Self-correct, tighten requirements, output a brief "Critique Summary" in chat.

**Phase F4: Acceptance Criteria Definition** (Input: functional requirements written)
1. Write acceptance criteria for every requirement using Given-When-Then format.
2. Coverage checklist: happy path, alternative paths, error scenarios, edge cases, security scenarios, performance expectations.
Detailed AC examples: see [FRD-EXAMPLES.md](FRD-EXAMPLES.md) Section 3.4. Deliverables: complete acceptance criteria for all functional requirements, coverage checklist. Approval required (stakeholders and QA confirm criteria are testable).

**Phase F5: Technical Feasibility & NFR Definition** (Input: requirements and acceptance criteria complete)
1. Validate technical feasibility: technology stack, API/service availability, performance targets, security requirements.
2. Define non-functional requirements: Performance, Scalability, Security, Reliability, Usability, Maintainability.
3. Document technical constraints: system, integration, performance, security constraints.
Detailed NFR examples: see [FRD-EXAMPLES.md](FRD-EXAMPLES.md) Section 5.3. Deliverables: feasibility assessment, complete NFRs, technical constraints, risk assessment. Approval required (engineering and QA).

**Phase F5.5: PRD Alignment Check (Source Validation)**
> [!CRITICAL]
> MANDATORY PRE-CHECK. Verify the FRD addresses all PRD items. DOUBLE-PASS REQUIRED.
PASS 1: list every P0/P1 feature from the PRD, mark each Covered / Missing / Partially Covered; if ANY P0 item is Missing or Partial, STOP and update the FRD. PASS 2: re-run the coverage audit after updates, confirm ALL P0 items are Covered, do NOT proceed to Phase F6 until Pass 2 shows 100% P0 coverage. Output `prd-alignment-check.md` (source document, pass results, status ALIGNED / NEEDS_UPDATE).

**Phase F6: Gap Analysis**
> [!CRITICAL]
> STOP AND CHECK. Before declaring the FRD "Ready for Development", perform gap analysis.
1. Scope verification: all P0 PRD features have FRs? Any FRs without PRD traceability (scope creep)?
2. NFR completeness: NFRs defined for every module?
3. Ambiguity check: any ACs using vague terms like "fast", "easy", "standard"?
Output `frd-gap-analysis.md` (Verdict PASS/FAIL, Missing P0s, Scope Creep, Ambiguous ACs). If FAIL, fix the FRD immediately.

**Phase F6.5: Dynamic Milestone Discovery (MANDATORY)**
> [!CRITICAL]
> After FRD approval (Gate G2), generate milestones using the Dependency-Based Discovery Pattern.
Algorithm: M0 Foundation (scaffolding, DB setup, environment config, CI/CD base), M1 Authentication (login, register, session, RBAC setup), then ask "Which features are REQUIRED for other features to work?" and group them as M2+, with dependent features in subsequent milestones. Read `PROCESS-REFERENCE.md` for a worked dependency-graph example of this algorithm.
Present a milestone table, a progressive-capabilities table, and the MVP milestone identification. Milestone example: see [FRD-EXAMPLES.md](FRD-EXAMPLES.md) Section 5.4. Deliverables: `AI_DOCS/planning/milestone-plan.md`, dependency graph, progressive-capabilities table, MVP identified, entry/exit criteria per milestone, plus updates to `AI_DOCS/memory/implementation-plan.md`. Approval required (Gate G2.5) before Design begins.

**Phase F6.7: Mock Data Generation (MANDATORY)**
> [!CRITICAL]
> After FRD approval (Gate G2), generate mock data for design consistency.
1. Extract entities from the FRD (fields, constraints, relationships).
2. Create schema: `AI_DOCS/design/mockdata/_schema.md`.
3. Generate mock JSON: 3 to 5 records per entity with `_meta` FRD references (for relationship sanity).
4. High-density set (Track G): for any list/table entity, ALSO produce the ~10k-row realistic-density fixture via `/mock-data` high-density mode (`<entity>.highdensity.json`), so the populated-at-scale state is designable and testable. The 3 to 5 record set alone hides the dense-case layout failures enterprise UIs are judged on.
5. Create mock services: CRUD operations with simulated delays, same interface as production.
Output structure: `AI_DOCS/design/mockdata/`, `AI_DOCS/design/mockservices/`, `AI_DOCS/design/assets/generated/`. Reference: see [MOCK_DATA_STANDARDS.md](MOCK_DATA_STANDARDS.md).

### 10.3 FRD Output Template & Milestone Integration

Complete FRD template: see [FRD-TEMPLATE.md](FRD-TEMPLATE.md) for the full 14-section document structure, file organization, and writing guidelines. The FRD must output the Execution Plan: M1 is always MVP, group milestones by feature (not by layer), each milestone is independently testable E2E. Append a milestone execution plan table to the end of every FRD (schema: [FRD-TEMPLATE.md](FRD-TEMPLATE.md) Section 9).

### 10.4 FRD Quality Standards & Handoff

Requirements quality standards: see [FRD-EXAMPLES.md](FRD-EXAMPLES.md) Section 2 (SMART requirements, completeness checklist). Acceptance criteria framework: see [FRD-EXAMPLES.md](FRD-EXAMPLES.md) Section 3. Project-type depth (POC/MVP/Production-Grade): see [FRD-EXAMPLES.md](FRD-EXAMPLES.md) Section 4 and Section 6 above. Validation and review: see [FRD-EXAMPLES.md](FRD-EXAMPLES.md) Section 6.

FRD approval gates: Gate 2A (user flows for all roles), Gate 2B (functional requirements), Gate 2C (acceptance criteria testable). Handoff from FRD Mode:
- To [design-system](../design-system/SKILL.md): user roles/permissions, user flows/journeys, functional requirements, acceptance criteria.
- To [build](../build/SKILL.md): functional requirements, acceptance criteria, NFRs, business rules and validation rules.

---

## START INSTRUCTION

When ready to begin, ask ONE batch (per `rules/document-generation-rules.md` Rule 1, skip anything already known): whether the user wants a **PRD**, an **FRD**, or **both**, plus the document's purpose (what the reader should decide or do after reading it), audience, and tone.
- For a PRD (or both): ask for the product idea or problem statement, then conduct discovery questions and begin Phase 1.
- For an FRD only: ask for the approved PRD content, then begin Section 10 FRD Mode at Phase F1.
- For both: complete the PRD flow (Phases 1 to 6), get PRD approval, then run Section 10 FRD Mode using the approved PRD as its source.

## Next Step
Proceed to the next skill in the workflow as indicated in the YAML frontmatter.

<!-- v2.1.0 (2026-06-30): completed the frd-generation merge — relocated the comprehensive FRD template to FRD-TEMPLATE.md and the FRD examples to FRD-EXAMPLES.md, and repointed Section 10 (FRD Mode) reference links from EXAMPLES.md (PRD examples) to FRD-EXAMPLES.md so the FR/AC/NFR/milestone/quality references resolve correctly. -->
<!-- v2.2.0 (2026-08-05): wired the intake gate and requirement-source handling to rules/document-generation-rules.md, made the START INSTRUCTION ask purpose, audience, and tone in the same batch, rewrote 2.6 to save/move raw sources into AI_DOCS/requirements/ with requirements-baseline.md as the primary alignment target, and standardized on lowercase prd.md. -->
<!-- Version: 2.3.0 | 2026-08-06 | progressive disclosure: reference blocks moved to supporting files (v4.18.0 structural pass); no content deleted -->
<!-- Version: 2.3.3 | 2026-10-14 | PRD requirements come from Verified baseline rows and assumption and Proposed tags are carried through. -->
