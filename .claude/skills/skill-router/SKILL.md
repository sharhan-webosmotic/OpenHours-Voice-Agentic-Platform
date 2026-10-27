---
name: skill-router
description: "Meta-discovery skill that answers 'which skill?' questions: a meta-index of all framework skills. Trigger on any question that asks WHICH or WHAT skill handles a topic, or requests a list, map, or catalog of skills. Key phrases: 'which skill for X', 'what skill handles X', 'is there a skill for X', 'list the skills'. The user wants a POINTER, so prefer skill-router over any domain skill named in the prompt. Do NOT use when the user asks to PERFORM the task (e.g. 'run a security review' uses audit), scaffold skills (skill-authoring), or fix skills (skill-improve)."
effort: medium
allowed-tools: Read
skill_id: SK-086
context_budget:
  load_kb: 20
  scope: session
version: 1.5.2
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# Skill Router

> **Purpose**: Instant skill awareness and intent-to-skill routing for all 48 skills
> **Loaded**: Automatically via SessionStart hook (condensed version in SKILL-REFERENCE.md)
> **When invoked directly**: Provides detailed routing help and skill discovery

---

## SDLC Flow

```
session-management → [requirement-finalization*] → workscope → [estimation*] → tech-specification → guardrails
  → [design*] → build → qa-testing → deployment-planning

* = optional. requirement-finalization runs when AI_DOCS/requirements/ holds more than one source. estimation is internal (SK-162, since v4.13.0).
```

---

## Quick Routing Table

When the user expresses an intent, route to the matching skill:

| User Intent | Skill | Command |
|---|---|---|
| Start a new project | session-management (SK-001) | `/session-management` |
| Resume previous work | session-management (SK-001) | `/session-management` |
| Finalize conflicting requirement sources | requirement-finalization (SK-163) | `/requirement-finalization` |
| Define project scope | workscope (SK-072) | `/workscope` |
| Estimate effort/hours | estimation (SK-162) | `/estimation` |
| Short project summary / complexity brief | project-brief (SK-164) | `/project-brief` |
| Write the tech spec | tech-specification (SK-070) | `/tech-specification` |
| Plan milestones/sprints | milestone-planning (SK-060) | `/milestone-planning` |
| Set up coding rules | guardrails (SK-006) | `/guardrails` |
| Code quality pre-check | code-quality (SK-071) | `/code-quality` |
| Design UI/screens | design-discovery (SK-004) | `/design-discovery` → `/design-tokens` → `/design-screens` |
| Implement a feature | build (SK-131) | `/build` |
| Write tests | qa-testing (SK-007) | `/qa-testing` |
| Deploy/release | deployment-planning (SK-008) + deployment-execution (SK-045) | `/deployment-planning` → `/deployment-execution` |
| Debug/fix a bug | debugger (SK-041) | `/debugger` |
| Git operations | github-ops (SK-021) | `/github-ops` |
| Security audit | audit (SK-132) | `/audit` |
| Add mid-flight feature | change-request (SK-010) | `/change-request` |
| Generate mock data | mock-data (SK-011) | `/mock-data` |
| Mock API server | mock-api-server (SK-044) | `/mock-api-server` |
| Python backend work | build + fastapi-specialist agent | `/do` |
| AI/LLM/RAG integration | python-ai-services (SK-083) | `/python-ai-services` |
| Python tests | python-testing (SK-084) | `/python-testing` |
| Python deployment | python-deployment (SK-085) | `/python-deployment` |
| Create Word document | docx (SK-047) | `/docx` |
| Create PDF | pdf (SK-048) | `/pdf` |
| Create presentation | pptx (SK-PPTX) | `/pptx` |
| Create spreadsheet | xlsx (SK-XLSX) | `/xlsx` |
| Generate images/logos | image-generation (SK-IMG) | `/image-generation` |
| Optimize images | image-assets (SK-051) | `/image-assets` |
| Audit codebase health | project-audit (SK-081) | `/project-audit` |
| Build feature end-to-end | orchestrator (SK-090) | `/orchestrator` |
| Error handling patterns | error-handling (SK-040) | `/error-handling` |
| Audit trail/compliance | audit-logs (SK-042) | `/audit-logs` |
| Analytics/tracking | analytics (SK-043) | `/analytics` |
| Caching strategy | caching-strategy (SK-031) | `/caching-strategy` |
| SEO setup | seo (SK-033) | `/seo` |
| Multi-language/i18n | i18n (SK-034) | `/i18n` |
| Database migrations | data-migration (SK-022) | `/data-migration` |
| Architecture decisions | architecture (SK-020) | `/architecture` |
| MCP server setup | mcp-connector (SK-023) | `/mcp-connector` |
| Gate validation | gate-enforcement (SK-024) | `/gate-enforcement` |
| Project type classification | project-types (SK-012) | `/project-types` |
| Onboard existing codebase | codebase-migration (SK-053) | `/codebase-migration` |
| Generate CLAUDE.md | project-context (SK-080) | `/project-context` |
| Memory protocol | memory-protocol (SK-000) | `/memory-protocol` |
| Formal PRD | prd-generation (SK-002) | `/prd-generation` |
| Formal FRD | prd-generation (SK-002, FRD Mode) | `/prd-generation` |
| React.js patterns | reactjs (SK-087) | `/reactjs` |
| Next.js patterns | nextjs (SK-NJS) | `/nextjs` |
| shadcn/ui components | shadcn-ui (SK-SUI) | `/shadcn-ui` |
| Test web app in browser | e2e-testing (SK-150) | `/e2e-testing` |
| Explore a business idea / brainstorm | brainstorm (SK-096) | `/brainstorm` |
| Business model / revenue strategy | brainstorm (SK-096) | `/brainstorm` |
| Should I build this? | brainstorm (SK-096) | `/brainstorm` |
| Find a skill | skill-router (SK-086) | `/skill-router` |

---

## Full Skill Catalog by Category

### Core SDLC (14 skills)

| ID | Skill | Description |
|---|---|---|
| SK-000 | `memory-protocol` | Read/write/sync shared memory — every skill follows this protocol |
| SK-001 | `session-management` | Entry point for ALL workflows — init, restore, handoff, routing |
| SK-072 | `workscope` | Client-facing scope document, discovery questions, tech selection |
| SK-073 | `estimation` | RETIRED, superseded by SK-162 (v4.13.0). ID never reused |
| SK-162 | `estimation` | Simple 5-sheet workbook: role hours per feature, priority, scope buckets, validation, no margin |
| SK-163 | `requirement-finalization` | Reconcile AI_DOCS/requirements/ sources into requirements-baseline.md via decision cards |
| SK-164 | `project-brief` | Short complexity brief, client/team variants, ask-first intake |
| SK-070 | `tech-specification` | 23-section developer spec, API contract, schema, test cases |
| SK-060 | `milestone-planning` | Execution roadmap, gate checklist, Git branch creation |
| SK-006 | `guardrails` | Generate 80+ project coding rules, ESLint/Prettier config |
| SK-071 | `code-quality` | 17-point SonarQube-sim pre-check before every coding session |
| SK-004 | `design-discovery` | Design DNA + stack lock. Split 3.1.0 into design-discovery/design-tokens/design-screens |
| SK-131 | `build` | Feature implementation, tech routing, mobile patterns |
| SK-007 | `qa-testing` | Test planning, execution, coverage reporting |
| SK-132 | `audit` | OWASP audit, secret scanning, auth review |
| SK-008 | `deployment-planning` | Plan deploy strategy + runbook. Split 3.1.0; runtime steps in deployment-execution |
| SK-080 | `project-context` | Generate/sync CLAUDE.md. Renamed from claude-md (3.1.0) |

### Requirements (1 skill)

| ID | Skill | Description |
|---|---|---|
| SK-002 | `prd-generation` | Formal product AND functional requirements (PRD + FRD mode) |

### Utility (5 skills)

| ID | Skill | Description |
|---|---|---|
| SK-096 | `brainstorm` | Pre-requirements ideation — business model, ICP, revenue, MVP options |
| SK-010 | `change-request` | Mid-flight feature additions — update spec first |
| SK-011 | `mock-data` | Realistic test data, seed data, JSON fixtures |
| SK-012 | `project-types` | Classify as POC/MVP/Production, set rigor levels |
| SK-024 | `gate-enforcement` | Validate gate conditions before phase transitions |

### Infrastructure (4 skills)

| ID | Skill | Description |
|---|---|---|
| SK-020 | `architecture` | ADRs, system design, diagrams |
| SK-021 | `github-ops` | Branching, commits, PRs, releases, SemVer tags |
| SK-022 | `data-migration` | Schema migrations, rollbacks, seeding |
| SK-023 | `mcp-connector` | MCP server setup and configuration |

**Diagrams of any kind** (architecture, IT current-state, flowchart, sequence, state machine, ER, swimlane, journey, deployment, Gantt, Sankey, Wardley and the rest of its 45 types) route to the `diagram-design` plugin (`diagram-design:diagram-design`), the framework's only diagram generator. PNG/SVG export: `/diagram-design:export-diagram`. Mermaid, draw.io, Excalidraw sources: `/diagram-design:import-mermaid`, `import-drawio`, `import-excalidraw`. The old `diagram-creator` name resolves here via `docs/skill-deprecations.md`.

### Python Backend (3 skills)

| ID | Skill | Description |
|---|---|---|
| SK-083 | `python-ai-services` | LLM providers, RAG, embeddings, vector stores, agents |
| SK-084 | `python-testing` | pytest, async testing, coverage, fixtures |
| SK-085 | `python-deployment` | uvicorn/gunicorn config, Docker, zero-downtime |

### Go Backend (2 skills)

| ID | Skill | Description |
|---|---|---|
| SK-160 | `go-testing` | table-driven tests, httptest, testify/gomock, race detector, coverage |
| SK-161 | `go-deployment` | static binary, distroless/scratch Docker, health/readiness, zero-downtime |

### Optimization (3 skills)

| ID | Skill | Description |
|---|---|---|
| SK-031 | `caching-strategy` | Multi-layer cache, Redis, CDN, React Query |
| SK-033 | `seo` | Meta tags, sitemaps, structured data, Open Graph |
| SK-034 | `i18n` | Multi-language, RTL, locale-aware formatting |

### Reliability (4 skills)

| ID | Skill | Description |
|---|---|---|
| SK-040 | `error-handling` | Error boundaries, global handlers, structured logging |
| SK-041 | `debugger` | Trace issues across code/design/build/runtime layers |
| SK-042 | `audit-logs` | Immutable audit trail for compliance |
| SK-043 | `analytics` | Event tracking, KPI dashboards, GA4/PostHog/Mixpanel |

### Document & Asset Skills (5 skills)

| ID | Skill | Description |
|---|---|---|
| SK-047 | `docx` | Create/read/edit Word documents |
| SK-048 | `pdf` | Create/read/extract/merge PDFs |
| SK-PPTX | `pptx` | Create/edit PowerPoint presentations |
| SK-XLSX | `xlsx` | Create/edit spreadsheets, formulas, charts |
| SK-051 | `image-assets` | Image optimization, WebP/AVIF, lazy loading |

### Quality & Audit (1 skill)

| ID | Skill | Description |
|---|---|---|
| SK-081 | `project-audit` | Full codebase scan, guardrail check, API contract validation |

### Meta Skills (3 skills)

| ID | Skill | Description |
|---|---|---|
| SK-044 | `mock-api-server` | Local JSON-persisted mock API for frontend dev |
| SK-053 | `codebase-migration` | Onboard existing codebases into AI Skills framework |
| SK-090 | `orchestrator` | Multi-step workflows: build feature, run all checks |

### Platform-Specific (4 skills)

| ID | Skill | Description |
|---|---|---|
| SK-087 | `reactjs` | Hooks, RHF+Zod forms, performance, Context, Zustand, composition, React 18/19 |
| SK-NJS | `nextjs` | RSC boundaries, async patterns, metadata, hydration |
| SK-SUI | `shadcn-ui` | Component management, forms, styling, icons |
| SK-150 | `e2e-testing` | Playwright browser testing, screenshots, visual regression |

---

## Technology → Skill Routing

| Tech Stack Includes | Suggest Skill |
|---|---|
| React Native | `build` + `rules/mobile-rules.md` |
| PostgreSQL / MySQL / MongoDB | `data-migration` (SK-022) |
| Any frontend | `design-discovery` (SK-004) + `design-tokens` + `design-screens` |
| Next.js | `nextjs` + `shadcn-ui` |
| Python / FastAPI | build + `fastapi-specialist` → `python-ai-services`* → `python-testing` → `python-deployment` |
| Go (net/http, chi, echo, gin) | build + `go-specialist` → `go-testing` → `go-deployment` |
| LLM / RAG / AI | `python-ai-services` (SK-083) |
| Multi-language | `i18n` (SK-034) |
| SEO requirement | `seo` (SK-033) |
| Compliance | `audit-logs` (SK-042) |

---

## Agents (5 specialist subagents)

| Agent | Triggers on | Purpose |
|---|---|---|
| code-reviewer | "review this code", "check this file" | Review against all project rules |
| security-auditor | "security check", "is this secure" | OWASP security audit |
| api-validator | "check API contract", "API mismatch" | API contract sync validation |
| test-writer | "write tests for", "add tests" | Generate tests for modules |
| component-inspector | "check components", "design compliance" | UI/design token compliance |

---

## Forked Skills (run in isolated context)

These skills run as subagents to avoid polluting main conversation:
- `project-audit` (SK-081), `audit` (SK-132), `code-quality` (SK-071)

---

## Instructions

When this skill is invoked directly:
1. Ask the user what they're trying to accomplish
2. Match their intent against the Quick Routing Table
3. Suggest the best skill(s) and explain why
4. If multiple skills apply, recommend the execution order based on SDLC flow
5. Offer to invoke the skill via its slash command
<!-- Version: 1.5.0 | 2026-10-14 | Diagram requests route to the diagram-design plugin. diagram-creator retired. -->
<!-- Version: 1.5.1 | 2026-10-14 | SK-162 row describes estimation v6. -->

<!-- Version: 1.5.2 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
