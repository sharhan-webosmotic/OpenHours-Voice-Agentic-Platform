---
name: project-stage-detect
skill_id: SK-092
context_budget:
  load_kb: 30
  scope: task
version: 1.0.3
description: "Automatically analyze project state and detect current SDLC phase. Scans AI_DOCS/, codebase structure, gate-status.md, and package.json. Reports current phase, missing artifacts per phase, and recommends next skill. Use when you don't know what phase you're in or what to do next."
allowed-tools: Read Grep Glob Bash(ls *) Bash(find *)
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# /project-stage-detect — SDLC Phase Detection

Scan the project and determine exactly where you are in the development lifecycle.

## Detection Process

### Step 1 — Read Gate Status
Read `AI_DOCS/memory/gate-status.md` if it exists.
Gate approvals are the most reliable phase signal.

### Step 2 — Scan AI_DOCS Structure
Check which directories and files exist:
```
AI_DOCS/
├── planning/
│   ├── workscope.md       → Phase 1 (Discovery) started (split layout: workscope/index.md)
│   ├── tech-spec.md       → Phase 2 (Specification) started
│   └── milestone-plan.md  → Milestone planning done (split layout: milestone-plan/index.md)
├── architecture/
│   └── api-contract.md    → Gate 1 passed
├── design/
│   └── design-dna.md      → Phase 3 (Design) started
├── milestones/
│   └── M<NN>-<slug>/      → Milestone capsules seeded by /plan
└── memory/
    └── gate-status.md     → Gate tracking active
```

### Step 3 — Scan Codebase
```bash
ls src/ app/ lib/ pages/ components/ 2>/dev/null  # Frontend code
find . -name "*.py" -not -path "*/node_modules/*"  # Python code
find . -name "*.ts" -not -path "*/node_modules/*"  # TypeScript code
ls tests/ __tests__/ 2>/dev/null                    # Tests
ls .github/workflows/ 2>/dev/null                   # CI/CD
```

### Step 4 — Check package.json / pyproject.toml
Detect tech stack and whether test scripts are configured.

### Step 5 — Determine Phase (use workflow-catalog.yaml heuristics)

Apply phase detection in reverse order (highest phase first, fall back):

| Detected Signal | Phase |
|----------------|-------|
| Gate 5 APPROVED | Maintenance |
| Gate 4 APPROVED | Deployment |
| Gate 3 APPROVED OR tests exist | Testing |
| Gate 2 APPROVED OR src/ code exists | Implementation |
| Gate 1 APPROVED OR design docs exist | Design |
| Gate 0 APPROVED OR tech-spec exists | Specification |
| No gates, no code | Discovery |

### Step 6 — Check Missing Artifacts for Detected Phase

For each required artifact in the current phase (from workflow-catalog.yaml), check if it exists.
List what's present and what's missing.

## Output Format

```
## Project Stage Detection Report

### Detected Phase: [PHASE NAME]
Confidence: [HIGH / MEDIUM / LOW]
Evidence: [key signals that determined this]

### Gate Status Summary
- Gate 0: [APPROVED / PENDING / NOT STARTED]
- Gate 1: [APPROVED / PENDING / NOT STARTED]
- Gate 1.5: [APPROVED / PENDING / NOT STARTED]
- Gate 2: [APPROVED / PENDING / NOT STARTED]
- Gate 3: [APPROVED / PENDING / NOT STARTED]
- Gate 4: [APPROVED / PENDING / NOT STARTED]
- Gate 5: [APPROVED / PENDING / NOT STARTED]

### Phase Artifacts Status
| Artifact | Status |
|----------|--------|
| workscope document | [EXISTS / MISSING] |
| tech-spec.md | [EXISTS / MISSING] |
| api-contract.md | [EXISTS / MISSING] |
| design-dna.md | [EXISTS / MISSING] |
| milestone plan | [EXISTS / MISSING] |
| test suite | [EXISTS / MISSING] |
| deployment runbook | [EXISTS / MISSING] |

### Missing Required Artifacts
[List of required artifacts for current phase that don't exist]

### Recommended Next Skill
[Specific skill to run next, with brief reason]

### Tech Stack Detected
- Frontend: [React / Next.js / Angular / Vue / Nuxt / Flutter / React Native / unknown]
- Backend: [NestJS / FastAPI / Node.js / unknown]
- Database: [Postgres / MySQL / MongoDB / SQLite / unknown]
- Testing: [Jest / Vitest / pytest / unknown]
```
