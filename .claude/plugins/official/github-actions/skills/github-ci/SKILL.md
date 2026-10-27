---
name: github-ci
description: "Generate and manage GitHub Actions CI/CD workflows. Triggers on: 'add GitHub Actions', 'set up CI/CD', 'create workflow', 'add CI pipeline', 'configure GitHub workflows', 'set up automated testing in CI'."
next_skill: null
required_gate: null
skill_id: SK-200
context_budget:
  load_kb: 20
  scope: task
version: 1.0.2
dependencies:
  required: []
  optional: [qa-testing, deployment-planning]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: infrastructure
  user_facing: true
  plugin: github-actions
---

# GitHub CI — GitHub Actions Integration

> **Purpose**: Generate, validate, and manage GitHub Actions CI/CD workflows
> **Audience**: End user
> **Trigger**: User wants to set up GitHub Actions CI/CD pipelines

---

## What this skill does

1. Reads the project stack from `AI_DOCS/memory/stack.md`
2. Generates appropriate `.github/workflows/` files based on the stack
3. Includes: lint, test, build, deploy stages appropriate to the tech
4. Follows ADF's deployment runbook patterns

## Standard workflow templates

### Node.js / Next.js
- Lint (ESLint) + Test (Jest/Vitest) + Build on PR and main push
- Deploy preview on PR, deploy production on main merge

### Python / FastAPI
- Lint (ruff/flake8) + Test (pytest) + Type check (mypy) on PR and main push
- Docker build + push on main merge

### Flutter
- Analyze + Test + Build APK/IPA on PR and main push

## Output

- `.github/workflows/ci.yml` — main CI pipeline
- `.github/workflows/deploy.yml` — deployment pipeline (if deploy config exists)
- Updates `AI_DOCS/deployment/` with CI/CD runbook entries

---

Skill github-ci complete. Memory updated.
Checkpoint: .github/workflows/, safe to compact.
