---
name: orchestrator
description: "INTERNAL meta-skill and dispatch primitive: coordinates multi-step workflows by invoking sub-skills and subagents (dispatch, fan-out, chain). Not user-facing. Called by /do and team-security. For 'which skill handles X' use skill-router, to build or ship use /do."
skip:
  - "Build feature (use /do)"
  - "End to end (use /do)"
  - "Pre-release (use /do)"
  - "Parallel review (use /team-security)"
user_facing: false
next_skill: null
required_gate: null
allowed-tools: "Read Grep Glob Task"
skill_id: SK-090
context_budget:
  load_kb: 20
  scope: session
version: 2.0.6
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [session-management, build]
  optional: [qa-testing, code-quality, audit, project-audit]
metadata:
  author: WebOsmotic Private Limited
  category: meta
  patterns: [sequential]
  role: "internal-orchestration-primitive"
  demoted_in: 3.1.0
  reason: "Triggers overlapped with the former team-feature and team-release skills (retired in 4.32.0) causing router ambiguity"
---

> **DEMOTION NOTICE (v3.1):** This skill is no longer user-facing. Its trigger phrases moved to the former `team-feature` and `team-release` skills, which were themselves retired in v4.32.0 in favour of `/do` (Phase 1 lead dispatch for features and design, Phase 3 plus `gate-enforcement` Gate 5 for releases). The skill remains as an **internal primitive** invoked by `/do` and `team-security` to dispatch subagent chains. Direct invocation still works but emits a deprecation event; route through `/do` instead.



# Workflow Orchestrator

Coordinate multi-step workflows by dispatching to skills and agents in sequence or parallel.

## Workflow 1: Build Feature End-to-End

**Trigger**: "build feature X", "implement X end-to-end", "full implementation of X"

**Steps**:

1. **Read requirements**: Load `AI_DOCS/planning/tech-spec.md` for the feature
2. **Pre-check**: Invoke `/code-quality` — run 17-point checklist
3. **Implement**: Invoke `/build` — write the code
4. **Parallel checks** (after implementation):
   - Spawn `test-writer` agent — write tests for the new code
   - Spawn `code-reviewer` agent — review the new code
   - Spawn `api-validator` agent — check API contract sync (if API changes)
5. **Collect results**: Present unified status from all agents
6. **Update memory**: Mark task complete in `AI_DOCS/memory/task.md`

```
Feature: $ARGUMENTS

Step 1 — Reading tech-spec for this feature...
Step 2 — Running code quality pre-check...
Step 3 — Implementing feature...
Step 4 — Running parallel checks (tests + review + API sync)...
Step 5 — Results summary...
```

## Workflow 2: Full Quality Check

**Trigger**: "full quality check", "run all checks", "health check everything"

**Steps** (dispatch in parallel, capped at the host concurrency limit):

> Before fanning out, read the host caps once: `eval "$(bash .claude/scripts/agent-capacity.sh)"`. These agents are read-only (LIGHT), so dispatch at most `LIGHT_CAP` at a time and start the next as each finishes. Never spawn an unbounded fan-out (see `docs/coordination-rules.md`).

1. Spawn `code-reviewer` agent — code quality review
2. Spawn `security-auditor` agent — OWASP security check
3. Spawn `api-validator` agent — API contract sync
4. Spawn `component-inspector` agent — UI compliance

**Output**: Unified health dashboard:

```
Quality Dashboard:
  Code Review:     [PASS/FAIL] — X findings
  Security Audit:  [PASS/FAIL] — X findings  
  API Contract:    [IN SYNC/DRIFTED] — X mismatches
  UI Compliance:   [PASS/FAIL] — X violations

Overall: [HEALTHY / NEEDS ATTENTION / CRITICAL]
```

## Workflow 3: Pre-Release Check

**Trigger**: "pre-release check", "ready to deploy?", "pre-deployment validation"

**Steps** (sequential with gates):

1. Invoke `/code-quality` — 17-point checklist must PASS
2. Invoke `/audit` — OWASP audit must PASS
3. Check test coverage meets targets from `.claude/rules/testing-rules.md`
4. Invoke `/gate-enforcement` — validate all gates
5. If all pass: Invoke `/deployment-planning` — prepare runbook

```
Pre-Release Validation:
  [1/5] Code Quality:    checking...
  [2/5] Security Review: checking...
  [3/5] Test Coverage:   checking...
  [4/5] Gate Validation: checking...
  [5/5] Deployment Prep: ready / blocked

Result: READY TO DEPLOY / BLOCKED (reason)
```

## Rules

1. Always read `AI_DOCS/memory/project-context.md` first for current state
2. Report progress at each step — don't go silent
3. If any step fails, stop and report — don't continue blindly
4. Update `AI_DOCS/memory/task.md` after workflow completes

<!-- Version: 2.0.5 | 2026-10-21 | description trimmed per the v4.28.0 cost policy -->
<!-- Version: 2.0.6 | 2026-10-22 | v4.32.0: team-feature, team-design and team-release retired, description, skip list and demotion notice repointed to /do and team-security -->
