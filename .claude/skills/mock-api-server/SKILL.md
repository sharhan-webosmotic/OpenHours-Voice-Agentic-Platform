---
name: mock-api-server
description: "Set up a local JSON-persisted mock API server for frontend development before backend is ready. Use when needing a mock API, fake backend, or mock server for frontend work. Also triggers on: 'Setup mock server', 'Run local API', 'Mock CRUD setup', 'JSON API server'."
next_skill: design-discovery
required_gate: Gate 3 (Design Approved)
skill_id: SK-044
context_budget:
  load_kb: 30
  scope: task
version: 1.1.2
dependencies:
  required: [mock-data, design-discovery, design-tokens, design-screens]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

> **Comments & docs:** Docstrings/JSDoc on every function. No inline comments except a one-line *why* for genuinely complex logic (calculations, time conversions, deliberate workarounds). No commented-out code. Put rationale, decisions, and feature context in `AI_DOCS/planning/` + `AI_DOCS/memory/decision-log.md` and keep it updated in the same change. Full policy: `.claude/rules/development-rules.md` -> Code Comments & Documentation.
# Mock API Server Orchestrator

> **Purpose**: Provide a local, JSON-based CRUD API server that persists data, enabling frontend-first development with a smooth transition path to production backends. This orchestrator directs you to the correct tech-specific implementation.
> **Output**: Tech-specific routing layer (e.g. Next.js Route Handlers, Express Router, or FastAPI endpoints) and API Client.
> **Version**: 1.1.0

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Server Implementation Protocol

### 1. Centralized Data Source
All mock data MUST reside in `AI_DOCS/design/mockdata/`.
- `users.json`
- `posts.json`
- ...etc

### 2. Tech-Stack Routing Directive (MANDATORY)

> [!CRITICAL]
> **DO NOT GENERATE CODE YET.** 
> You MUST determine the project's framework from `AI_DOCS/project-guardrails.md` and read the exact implementation instructions from the `_templates` directory.

**Routing Logic**:
1. If the project uses **Next.js**: 
   👉 Read `mock-api-server/_templates/nextjs.md`
2. If the project uses **Python FastAPI**:
   👉 Read `mock-api-server/_templates/python-fastapi.md`
3. If the project uses **Node/Express**:
   👉 Read `mock-api-server/_templates/express.md`
4. If no template exists for the stack, generate a standard CRUD JSON server using the framework's native routing, adhering strictly to the Core Logic below.

### 3. Core Logic (For all templates)
- **Centralized Data**: All reads and writes (`fs` or `os` operations) MUST target `AI_DOCS/design/mockdata/*.json`.
- **Validation**: All POST / PUT / DELETE operations must validate incoming payloads against the project's schema library (Zod, Pydantic, etc.).
- **Client Abstraction**: Always provide a generic `api_client` (TS/JS) or equivalent fetch wrapper so the frontend components do not hardcode mock endpoints.

---

## Implementation Checklist

- [ ] **Data Setup**: Ensure `AI_DOCS/design/mockdata/*.json` exist and match the FRD entities.
- [ ] **Route Handler**: Create the mock API routing file according to the selected `_template`.
- [ ] **Schema Link**: Link schemas (Zod/Pydantic/etc.) to ensure mock data matches production expectations.
- [ ] **Logger Sync**: All mock server actions should log to the central logger for debugging.
- [ ] **Persistence**: Verify that a `POST` request actually updates the local `.json` files.

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/api-rules.md` — contract-first, response envelope, error codes
> - `.claude/rules/development-rules.md` — naming, architecture

## Critical Rules

1. **PERSISTENCE IS MANDATORY**: Every `POST`/`PUT`/`DELETE` must reflect in the local JSON files. Do not use in-memory state only.
2. **SCHEMA ALIGNMENT**: The mock data MUST use the same interfaces proposed for the production backend.
3. **NO HARDCODED MOCK ENTPODINTS**: The frontend components MUST NOT know they are talking to a mock server. Use the `apiClient` abstraction.
4. **RELATIVE PATHS**: Use root-relative paths for all `fs` operations to ensure portability across developer environments.
5. **LOCK FILES**: If multiple mock entities are related, ensure referential integrity when updating (e.g., updating a `postId` in `comments.json`).
