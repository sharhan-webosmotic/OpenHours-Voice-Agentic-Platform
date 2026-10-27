---
name: codebase-migration
description: "Onboard existing codebases into the AI Skills framework. Scan code, generate retroactive specs, extract component registries. Use when migrating an existing project or onboarding a codebase. Also triggers on: 'Migrate project', 'Onboard codebase', 'Scan project'."
mcp_integrations: [context7]
next_skill: null
skill_id: SK-053
context_budget:
  load_kb: 35
  scope: global
version: 1.2.0
dependencies:
  required: [session-management]
  optional: [tech-specification, build, guardrails]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# Codebase Migration Skill

> **Purpose**: Migrate existing developer-built projects into the AI Skills framework
> **Persona**: Senior Migration Architect (24 years)
> **When**: Onboarding a legacy/existing codebase to use AI Skills

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (all free, auto-provisioned in the project `.mcp.json`):

- `context7` (free): framework and stack docs while scanning an existing codebase and generating retroactive specs.

---

## Skill Overview

This skill transforms an existing human-developed codebase into an AI Skills-managed project by:

1. **Analyzing** the existing codebase structure
2. **Creating** AI_DOCS memory files
3. **Generating** retroactive documentation (PRD, FRD from code)
4. **Enabling** skill-based feature additions

```
┌─────────────────────────────────────────────────────────────────┐
│                    CODEBASE MIGRATION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Existing Codebase     ──────────────────►    AI-Managed       │
│   (No AI_DOCS)                                 Project          │
│                                                                  │
│   ┌────────────────┐    ┌────────────────┐   ┌──────────────┐  │
│   │ Scan Codebase  │ ─► │ Generate Docs  │ ─► │ Create Memory│  │
│   │ (Structure,    │    │ (Tech Spec,    │    │ (ledger,     │  │
│   │  Tech Stack,   │    │  Guardrails,   │    │  project-    │  │
│   │  Features)     │    │  component-    │    │  context.md) │  │
│   └────────────────┘    │  registry)     │    └──────────────┘  │
│                         └────────────────┘         │           │
│                                                     ▼           │
│                                            ┌──────────────┐     │
│                                            │ Ready for    │     │
│                                            │ AI Skills!   │     │
│                                            └──────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Gate Requirements

| Gate | Requirement |
|------|-------------|
| **G-M0** | Codebase exists and is accessible |
| **G-M1** | Codebase analysis complete |
| **G-M2** | Memory files created |
| **G-M3** | User approves migration |

---

## Step 1: Codebase Discovery

### 1.1 Scan Project Structure

**AI Agent**: Perform comprehensive codebase analysis:

```markdown
## Codebase Analysis Checklist

### Structure Analysis
- [ ] Identify root directory
- [ ] Map folder structure
- [ ] Identify entry points
- [ ] Detect project type (web, mobile, API, etc.)

### Technology Stack Detection
- [ ] Package manager (npm, yarn, pnpm)
- [ ] Framework (Next.js, React, Vue, etc.)
- [ ] Language (TypeScript, JavaScript, etc.)
- [ ] CSS solution (Tailwind, MUI, etc.)
- [ ] Database (if any)
- [ ] API style (REST, GraphQL, etc.)

### Feature Inventory
- [ ] List all pages/screens
- [ ] List all API routes
- [ ] List all components
- [ ] List all services/utilities
- [ ] Identify authentication method
- [ ] Identify data models
```

### 1.2 Generate Codebase Report

**Output**: `AI_DOCS/migration/codebase-report.md`

```markdown
# Codebase Analysis Report

## Project Overview
- **Name**: [Project Name]
- **Type**: [Web App / Mobile / API / etc.]
- **Framework**: [Framework]
- **Language**: [Language]

## Directory Structure
[Tree structure]

## Technology Stack
| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js | 15.x |
| UI Library | MUI | 6.x |
| ...

## Feature Inventory
| Feature ID | Name | Type | Files |
|------------|------|------|-------|
| EX-001 | User Authentication | Full Stack | [...] |
| EX-002 | Dashboard | Frontend | [...] |

## Identified Entities
| Entity | Fields | Location |
|--------|--------|----------|
| User | id, name, email | /types/user.ts |

## API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| /api/auth/login | POST | User login |

## Components
| Component | Type | Location | Used By |
|-----------|------|----------|---------|
| Header | Layout | /components/Header.tsx | All pages |

## Dependencies
[package.json analysis]

## Observations
- [Key architectural decisions]
- [Patterns detected]
- [Technical debt identified]
```

---

## Step 2: Generate Retroactive Documentation

### 2.1 Reverse-Engineer Tech Spec

**AI Agent**: Create tech spec from existing features:

```markdown
## Reverse-Engineering Process

1. Analyze feature inventory
2. Infer user stories, scope, and flows from code
3. Identify user roles from auth implementation
4. Document API contracts, data models, sequence flows
5. Capture existing tech stack versions from package.json
```

**Output**: `AI_DOCS/planning/tech-spec.md` (using the 23-section tech-specification format)

### 2.2 Extract Component Registry & Design DNA

**AI Agent**: Capture existing design patterns and components:

```markdown
## Component & Design Extraction

1. **Component Inventory** (for component-registry.md):
   - List all UI components (atoms, molecules, organisms)
   - Capture import paths and prop signatures
   - Mark which are from library vs custom

2. **Design DNA Extraction** (for design-dna.md):
   - Detect current colors (from CSS/Tailwind config)
   - Detect typography (font family, sizes from config)
   - Detect spacing scale
   - Detect theme mode (light/dark)
   - Note: This is a best-effort extraction — confirm with user
```

**Output**:
- `AI_DOCS/design/component-registry.md` (Extracted component inventory)
- `AI_DOCS/design/design-dna.md` (Extracted design system — user must approve)

### 2.3 Generate Project Guardrails

**AI Agent**: Create guardrails based on existing patterns:

```markdown
## Guardrails Inference

- Detect existing code style (ESLint, Prettier config)
- Identify naming conventions
- Document folder structure rules
- Capture technology constraints
- Check if Husky + lint-staged exists; if not, flag as missing
```

**Output**: `AI_DOCS/project-guardrails.md`

---

## Step 3: Create Memory Files

### 3.1 Initialize Project Context

**AI Agent**: Create `AI_DOCS/memory/project-context.md` with the extracted state:

```markdown
# Project Context

## Identity
- Project Name: [Detected from package.json / repo name]
- Project Type: [Detected: MVP / Production-Grade]
- Started: [from git log first commit or package.json]
- Last Updated: [today]

## Tech Stack (Detected)
- Frontend (Web): [detected]
- Backend: [detected]
- Database (Primary): [detected]
- Component Library: [detected]
- Form Library: [detected or MISSING — flag]
- Validation Library: [detected or MISSING — flag]

## Source Documents
- Tech Spec: AI_DOCS/planning/tech-spec.md
- Design DNA: AI_DOCS/design/design-dna.md (extracted — needs user approval)
- Component Registry: AI_DOCS/design/component-registry.md

## SDLC State
- Current Stage: Migration Complete — Ready for Feature Additions
- Active Milestone: M00-migration

## Gate Summary
- Gate 1 (Tech Spec): PASSED (retroactive)
- Gate 1.5 (Code Quality Pre-Check): [check if husky exists]
- Gate 2 (Component Library): PASSED (library detected)
- Gate 3 (Design Approved): PENDING — needs design-dna user approval
```

### 3.2 Initialize Task Tracking

**AI Agent**: Create task tracking with migrated status, using the canonical milestone schema (`memory-protocol` SK-000). Treat the migration itself as milestone `M00-migration`.

**Output**: `AI_DOCS/memory/task-ledger.md` (global one-line-per-milestone summary)

```markdown
# Task Ledger

| Milestone | Title | Status | Progress | Exit gate | Notes |
|-----------|-------|--------|----------|-----------|-------|
| M00-migration | Codebase migration | DONE | 6/6 | PASSED (retroactive) | |

## Active milestone
M00-migration

## Next action
Use any skill to add features:
- `@build` for new features
- `@change-request` for modifications
- `@design-system` for UI changes
```

**Output**: `AI_DOCS/milestones/M00-migration/capsule.md`

```markdown
# M00-migration

## Purpose
Onboard the existing codebase into the framework.

## Scope
Codebase analysis, retroactive documentation, memory initialization.

## Exit criteria
All tasks in `tasks.md` are DONE and the user has approved the extracted design DNA.

## Active task pointer
None: milestone complete, ready for feature additions.
```

**Output**: `AI_DOCS/milestones/M00-migration/tasks.md` (full task table for this milestone)

```markdown
# M00-migration tasks

| ID | Title | Acceptance | Status | BlockedBy | Verify | Notes |
|----|-------|-----------|--------|-----------|--------|-------|
| T-01 | Codebase analysis | codebase-report.md written | DONE | - | - | |
| T-02 | Tech spec generated (retroactive) | tech-spec.md written | DONE | - | - | |
| T-03 | Component registry extracted | component-registry.md written | DONE | - | - | |
| T-04 | Design DNA extracted | design-dna.md written | DONE | - | - | pending user approval |
| T-05 | Guardrails generated | project-guardrails.md written | DONE | - | - | |
| T-06 | Memory initialized | project-context.md, task-ledger.md, decision-log.md written | DONE | - | - | |
```

**Also update**: `AI_DOCS/memory/session-state.md` with the active milestone pointer, last decision, and next action, per the shutdown protocol in `memory-protocol` SK-000.

### 3.3 Initialize Decision Log

**Output**: `AI_DOCS/memory/decision-log.md`

```markdown
# Decision Log

| # | Date | Skill | Decision | Options Considered | Rationale | Decided By |
|---|------|-------|----------|--------------------|-----------|------------|
| 1 | [today] | codebase-migration | Tech Stack: [detected] | N/A — detected from existing code | Migrated from existing project | System |
```

---

## Step 4: Prepare for Skill Usage

### 4.1 Skill Readiness Check

```markdown
## Skill Readiness Checklist

- [ ] AI_DOCS/memory/project-context.md exists
- [ ] AI_DOCS/memory/task-ledger.md exists (M00-migration row)
- [ ] AI_DOCS/milestones/M00-migration/{capsule.md, tasks.md} exist
- [ ] AI_DOCS/memory/decision-log.md exists
- [ ] AI_DOCS/planning/tech-spec.md exists
- [ ] AI_DOCS/project-guardrails.md exists
- [ ] AI_DOCS/design/component-registry.md exists
- [ ] AI_DOCS/design/design-dna.md exists (pending user approval)
- [ ] Codebase structure documented
- [ ] Tech stack documented
- [ ] Feature inventory complete
```

### 4.2 Migration Complete Message

**AI Agent**: Announce migration completion:

```markdown
## Codebase Migration Complete!

Your existing codebase has been migrated to the AI Skills framework.

### What Was Created
- `AI_DOCS/migration/codebase-report.md` - Full analysis
- `AI_DOCS/planning/tech-spec.md` - Retroactive Tech Spec (23 sections)
- `AI_DOCS/design/component-registry.md` - Extracted component inventory
- `AI_DOCS/design/design-dna.md` - Extracted design system (needs your approval)
- `AI_DOCS/project-guardrails.md` - Extracted code rules
- `AI_DOCS/memory/project-context.md` - Project state memory
- `AI_DOCS/memory/task-ledger.md` - Milestone summary (M00-migration)
- `AI_DOCS/milestones/M00-migration/{capsule.md, tasks.md}` - Migration task tracking
- `AI_DOCS/memory/decision-log.md` - Decision history

### Action Required
1. Review `AI_DOCS/design/design-dna.md` and approve or correct
2. Review `AI_DOCS/design/component-registry.md` and confirm

### What You Can Do Now
| Action | Command |
|--------|---------|
| Add new feature | `@build Add [feature]` |
| Modify existing | `@change-request Modify [feature]` |
| Add UI screens | `@design-system Design [screen]` |
| Resume later | `@session-management Resume` |

### Your Codebase Understands
- [X] Technology stack
- [X] Existing features
- [X] Code patterns
- [X] Folder structure
- [X] API contracts
- [X] Component library
```

---

## Step 5: Continuous Sync

### 5.1 Monitor External Changes

If human developers make changes outside the AI workflow:

```markdown
## External Change Detection

1. Compare last-known state with current
2. Identify new/modified files
3. Update codebase report
4. Sync PRD/FRD if needed
```

### 5.2 Re-Sync Command

```
@codebase-migration Sync
```

---

## Usage Examples

### Example 1: Full Migration

```
User: @codebase-migration Migrate this project

AI:
1. Scanning codebase...
2. Detected: Next.js 15 + MUI + TypeScript
3. Found: 12 pages, 45 components, 8 API routes
4. Generated: PRD, FRD, Guardrails
5. Created: Memory files
6. ✅ Migration complete!

Ready to use AI Skills for feature additions.
```

### Example 2: Partial Sync

```
User: @codebase-migration Sync - I added a new page

AI:
1. Scanning for changes...
2. Detected: New file - /app/settings/page.tsx
3. Updated: FRD with new route
4. Updated: Codebase report
5. ✅ Sync complete!
```

---

## Migration Output Structure

```
AI_DOCS/
├── migration/
│   ├── codebase-report.md     ← Full analysis
│   └── sync-history.md        ← Change tracking
├── planning/
│   └── tech-spec.md           ← Retroactive Tech Spec (23 sections)
├── memory/
│   ├── project-context.md     ← Master project state
│   ├── task-ledger.md         ← Milestone summary (M00-migration)
│   ├── session-state.md       ← Active milestone/task, last decision, next action
│   ├── decision-log.md        ← Decision history
│   └── gate-status.md         ← Gate status (retroactive)
├── milestones/
│   └── M00-migration/
│       ├── capsule.md         ← Migration milestone purpose, scope, exit criteria
│       └── tasks.md           ← Migration task table
├── design/
│   ├── design-dna.md          ← Extracted design system (needs approval)
│   └── component-registry.md  ← Extracted component inventory
└── project-guardrails.md      ← Extracted code rules
```

---

## Error Handling

| Error | Recovery |
|-------|----------|
| No package.json | Ask user for tech stack |
| Unrecognized framework | Default to generic patterns |
| Permission denied | Request access, skip files |
| Large codebase | Paginate analysis, summarize |

---

## Integration with Other Skills

| Skill | How It Uses Migration Data |
|-------|---------------------------|
| `session-management` | Reads memory files |
| `build` | Uses codebase report for context |
| `change-request` | References existing features |
| `design-system` | Inherits existing component patterns |
| `guardrails` | Extends extracted guardrails |

## Rules Integration
> - `.claude/rules/development-rules.md` — migrated code must meet spec-first, naming, architecture standards
> - `.claude/rules/security-rules.md` — scan migrated code for security violations
> - `.claude/rules/testing-rules.md` — verify test coverage after migration

---

*Skill ID: SK-053*
