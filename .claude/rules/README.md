---
paths:
  - ".claude/rules/**"
  - "rules/**"
  - "**/SKILL.md"
---
# Rules index — load only what the task needs

> Single source of truth for rule loading. `CLAUDE.md` (global) and the project
> `CLAUDE.md` (from `CLAUDE.template.md`) reference this file instead of restating it.
>
> **Discipline:** do NOT load every rule file into context. Load the always-on
> baseline, then load a domain rule ONLY when the current task actually touches
> that domain. Writing a backend API must not pull React/UI rules. Building a
> React screen must not pull Python or data-migration rules. Pure documentation
> tasks (workscope, specs, proposals, `.md`/`.docx`) load the always-on
> baseline plus `document-generation-rules.md`, no stack rules.

## Tier 0 — always-on (every session, regardless of task)

Tiny chat-governance rules. Always loaded.

| Rule file | Governs |
|-----------|---------|
| `writing-style-rules.md` | Prose style for all output (no em/en-dashes, etc.) |
| `advisor-stance-rules.md` | Operator-facing chat posture: challenge first, confidence tags, no sycophancy. Never overrides skill output formats or client deliverables. |
| `response-markers-rules.md` | Colored status markers (🔴/🟡/🟢) in CLI chat replies ONLY. Never in files, deliverables, or code. |

## Tier 1 — load when the task writes/reviews code, ships, or calls external services

Safety and baseline-quality rules. Load whenever the task is hands-on engineering
or an external operation. Skipping one of these to save tokens is not allowed.

| Rule file | Governs |
|-----------|---------|
| `document-generation-rules.md` | Generating any client- or team-facing document (workscope, PRD/FRD, tech-spec prose, estimation prose, requirement baseline, project brief, decks, docx, landing copy): intake before ink, human writing standard, banned AI phrases, validation gate |
| `development-rules.md` | Baseline code rules (`/build`, `/audit` load this): code quality, types and contracts, lint discipline, comments→AI_DOCS, Docker pinning |
| `security-rules.md` + `secrets-patterns.md` | OWASP, auth, secrets (pattern catalogue and compliance controls) |
| `ops-safety-rules.md` | External-operation warnings (CI/CD, deploy, third-party APIs) |
| `ai-safety-rules.md` | LLM API cost and safety |
| `context-efficiency-rules.md` | Any hands-on/investigation task, or when the session is under context pressure: cheap and read-heavy work runs as isolated subagents (not inline) to protect the main context |
| `self-improvement-rules.md` | Retrospectives, maintenance reviews, and framework-improvement work: capture generalized learnings project-locally, human-gate promotion to the shared framework, never auto-edit `.claude/` from a project |
| `skill-versioning-rules.md` | Editing a SKILL.md or a rule file |

## Tier 2 — load only when the task/file matches the domain

| Load this rule | When the task involves |
|----------------|------------------------|
| `api-rules.md` | API endpoints, route handlers, backend contracts |
| `python-rules.md` | Python / FastAPI / `*.py` |
| `go-rules.md` | Go backend / `*.go` |
| `nextjs-rules.md` | Next.js (`app/`, RSC, route handlers) |
| `frontend-rules.md` + `ui-engineering-rules.md` + `component-reuse-rules.md` + `design-rules.md` | Web UI: React components, screens, styling, design tokens |
| `design-language.md` + `design/` | Design DNA, domain design language, landing/conversion patterns |
| `mobile-rules.md` | React Native / Flutter / mobile |
| `desktop-rules.md` | Electron / Tauri desktop apps |
| `testing-rules.md` | Writing or reviewing tests |
| `data-migration-rules.md` | DB schema changes, migrations, seeding |
| `vertical-slice-rules.md` | Milestone/feature slicing (producer-before-consumer, seed data) |
| `sdlc-methodology-rules.md` | Choosing or applying the SDLC methodology |
| `tech-stack-selection-rules.md` | Planning: choosing/confirming the tech stack |
| `runtime-architecture-rules.md` | Planning: data-flow topology (caching, real-time, queues/workers, API style, idempotency). Catalogue: `skills/tech-specification/ARCH-PATTERNS.md` |
| `infrastructure-rules.md` | Cloud infra, provisioning, deployment planning, cost gates |
| `mcp-rules.md` | Configuring MCP servers / `.mcp.json` |
| `mermaid-rules.md` | Authoring any ` ```mermaid ` diagram (sequence/flow/ER/state) |
| `multi-path-rules.md` | Multi-candidate exploration at flow prototyping and ADR-class decisions (paths: `AI_DOCS/design/flows/**`, `AI_DOCS/planning/**`, `AI_DOCS/architecture/**`) |
| `prototype-rules.md` | Spikes / POCs / experiments |
| `platform-rules.md` | Non-Unix shell (Windows / Git Bash) |
| `compliance/<regime>.md` | ONLY the regime(s) in `stack.md → compliance:`. Never the whole folder. Baseline always: `secrets-patterns.md`, `compliance/audit-logs.md`. `compliance/owasp.md` when any regime is set. Full discipline: `compliance/README.md`. |

## How loading actually works (the mechanics, v4.18.0)

Claude Code auto-loads every UNSCOPED `.md` under `.claude/rules/` at session
start together with CLAUDE.md. A rule with `paths:` YAML frontmatter loads
on demand instead: when a matching file is read or edited. An explicit Read by
a skill always works regardless of scoping. The key is `paths:` (a `globs:`
key is ignored and the file autoloads).

The framework therefore enforces the tiers mechanically:

- **Always-on (unscoped, load every session):** `writing-style-rules.md`,
  `advisor-stance-rules.md`, `response-markers-rules.md` (Tier 0),
  `ops-safety-rules.md` (external-op safety) and `context-efficiency-rules.md`.
  This index is path-scoped since v4.28.0 and loads when a rule or skill file is touched. Everything else is scoped.
- **Path-scoped (load on matching files):** all stack, domain, design,
  infra, and compliance rules carry `paths:` frontmatter tuned to the files
  they govern. Knowledge-class files (compliance checklists, design domain
  profiles) carry narrow paths and are primarily loaded by their owning
  skills (`/audit`, the design skills) via explicit Read.
- A new rule file MUST declare `paths:` unless it genuinely belongs in every
  session. An unscoped rule is a per-session context tax on every project.

<!-- Version: 1.0.1 | 2026-08-21 | Tier 2 gains the multi-path-rules.md row (multi-candidate exploration at flow prototyping and ADR-class decisions) -->
<!-- Version: 2026-10-21 | index is now path-scoped (loads when rules or SKILL.md files are touched), saving about 1,500 tokens per session -->
