---
name: code-quality
description: "Run mandatory 17-point SonarQube simulation checklist covering security, reliability, clean code, complexity, testing, and logging. Use before coding begins, before merging PRs, or for Gate 1.5 checks. Also triggers on: 'Code quality check', 'Quality gate', 'SonarQube check', 'Pre-coding review'."
next_skill: build
required_gate: Gate 1.5 (Code Quality Pre-Check)
skill_id: SK-071
context_budget:
  load_kb: 30
  scope: milestone
version: 1.2.1
context: fork
dependencies:
  required: [tech-specification]
  optional: [guardrails, qa-testing]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

> **Comments & docs:** Docstrings/JSDoc on every function. No inline comments except a one-line *why* for genuinely complex logic (calculations, time conversions, deliberate workarounds). No commented-out code. Put rationale, decisions, and feature context in `AI_DOCS/planning/` + `AI_DOCS/memory/decision-log.md` and keep it updated in the same change. Full policy: `.claude/rules/development-rules.md` -> Code Comments & Documentation.
# Code Quality Skill

> **Purpose**: Enforce SonarQube-compliant quality standards before and during every implementation.
> **Output**: Code Quality Simulation Report saved to `AI_DOCS/quality/quality-report.md`
> **When to Run**: MANDATORY before any coding starts on a module. Also runs before every PR/commit.

---

## Initialization

> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). This skill must run after Tech Spec is approved and before build begins.

---

## When This Skill Runs

| Trigger | Action |
|---------|--------|
| Project initialized, Tech Spec approved | Run full pre-coding check (establish baseline) |
| Before implementing any module | Run module-specific check against spec sections |
| Before any commit / PR | Run full checklist on changed files |
| User reports a bug | Check if implementation violates a quality rule before fixing |
| New developer joins project | Run orientation check against project guardrails |

---

## The 17-Point SonarQube Simulation Checklist

> [!CRITICAL]
> All 17 points must PASS before coding on any module is permitted.
> Any FAIL is a blocker — do not proceed until resolved.

> [!NOTE]
> **Relationship to `.claude/rules/`**: The rules files define the *ongoing enforcement* (Claude reads them while coding).
> This checklist is the *formal gate check* — run as a structured audit at specific milestones.
> - Security rules (Points 1-5) → detailed in `.claude/rules/security-rules.md`
> - Clean code rules (Points 8-12) → detailed in `.claude/rules/development-rules.md`
> - Testing rules (Points 15-16) → detailed in `.claude/rules/testing-rules.md`
> - Coverage targets by project type → defined in `.claude/rules/testing-rules.md` Section "Coverage Targets"

---

### Security (Points 1–5)

**POINT 1 — No Hardcoded Credentials**
- No API keys, passwords, tokens, or secrets in source code
- All secrets via environment variables only
- Check: Scan for `password =`, `secret =`, `apiKey =` literals in code

**POINT 2 — Input Validation**
- All external inputs validated before use (Joi / Zod / class-validator)
- Validation happens at the API boundary, not inside services
- Check: Every route handler has a validation schema

**POINT 3 — Injection Prevention**
- SQL: ORM only, no raw query string interpolation
- NoSQL: No `$where`, no unvalidated input in queries
- Check: Search for `` `SELECT `` patterns, `$where` usage, `eval()`

**POINT 4 — XSS / CSRF Protection**
- All user-generated content sanitized before render
- CSRF tokens on state-changing requests (if applicable)
- Check: No `dangerouslySetInnerHTML`, no unescaped renders

**POINT 5 — Authentication & Authorization**
- Every protected route has middleware-level auth check
- RBAC enforced at middleware, not inline (`requirePermission()` not `if user.role === 'admin'`)
- Check: Every `router.[method]` has auth middleware attached

---

### Reliability (Points 6–7)

**POINT 6 — Async Handling**
- All async operations use `async/await` with `try/catch`
- No unhandled promise rejections
- No floating promises (`.then()` without `.catch()`)
- Check: Search for `.then(` without `.catch(`, `new Promise` patterns

**POINT 7 — Null Safety**
- No unchecked property access on potentially null/undefined values
- Optional chaining (`?.`) used where appropriate
- Nullish coalescing (`??`) for defaults
- Check: Search for patterns like `obj.property` where `obj` could be null

---

### Clean Code (Points 8–12)

**POINT 8 — Function Length**
- Maximum 50 lines per function
- If exceeded: refactor into sub-functions or move to a utility
- Check: Count lines in each function. Flag any > 50.

**POINT 9 — Nesting Depth**
- Maximum 3 levels of nesting (if inside if inside if = 3 = max)
- If exceeded: extract to early return pattern or separate function
- Check: Count indentation depth in conditional blocks

**POINT 10 — Variable Naming**
- Names must be descriptive and unambiguous
- Prohibited: `data`, `obj`, `temp`, `x`, `val`, `userData`, `res` (as variable names)
- Required: `authenticatedUserProfile`, `paginatedReportList`, `generatedReportId`
- Check: Flag single-letter variables outside loop counters, generic names

**POINT 11 — No Dead Code**
- No unused imports
- No unused variables, functions, or types
- No commented-out code blocks
- No placeholder logic (`TODO`, `FIXME`, `mock`, `demo`, `fake`)
- No narrating inline comments — only a one-line *why* for genuinely complex logic is allowed (docstrings/JSDoc are required, not flagged)
- Check: Run lint, search for `// TODO`, `// FIXME`, and commented-out code. Do NOT flag JSDoc (`/** */`) docstrings or a single allowed *why* comment.

**POINT 12 — No Duplication**
- Duplication threshold: ≤ 3%
- Repeated logic must be extracted into shared utilities/services
- Copy-paste coding is prohibited
- Check: Identify copy-pasted blocks > 3 lines

---

### Complexity (Points 13–14)

**POINT 13 — Cyclomatic Complexity**
- Maximum 10 per function
- Cyclomatic complexity = number of decision paths through the function
- If exceeded: split into smaller functions
- Check: Count `if`, `else`, `switch`, `case`, `for`, `while`, `&&`, `||`, `?:` in function

**POINT 14 — Cognitive Complexity**
- Maximum 15 per function
- Cognitive complexity = how hard a human finds the function to understand
- Deeply nested conditions and complex boolean chains increase this
- If exceeded: refactor using early returns, extracted conditions, or strategy pattern

---

### Testing (Points 15–16)

**POINT 15 — Test Coverage**
- Minimum: 98% on lines, branches, and functions (enforced on every stack per `testing-rules.md` Rule 7a) for all project types, POC included
- Every logical branch (if/else/switch case/catch/ternary) must have a test case
- Check: Coverage report from Jest / Vitest (statements/branches/functions/lines all >= 98). Flag uncovered branches and uncalled functions.

**POINT 16 — No Untested Business Logic**
- All business rules from `tech-spec.md` Section 8 must have corresponding test cases
- All test cases from `tech-spec.md` Section 18 must be implemented
- Check: Cross-reference test file against spec Section 18

---

### Logging (Point 17)

**POINT 17 — No console.log in Production**
- All logging via structured logger (`logger.info()`, `logger.error()`, `logger.warn()`)
- `console.log` only allowed in seed scripts and local dev utilities
- Check: Search for `console.log`, `console.error`, `console.warn` in `src/`

---

## CI/CD Integration (Conditional)

> [!IMPORTANT]
> After running the checklist, ask the user:
> *"Does this project have a CI/CD pipeline (GitHub Actions, GitLab CI, Jenkins, etc.)? If yes, would you like me to add quality gate enforcement to the pipeline so PRs are automatically blocked if quality standards fail?"*

**If YES**: Generate the appropriate CI/CD configuration:
- GitHub Actions: Add SonarQube scan step to `.github/workflows/`
- GitLab CI: Add quality gate stage to `.gitlab-ci.yml`
- Manual: Provide pre-commit hook configuration

**If NO**: Checklist runs as manual simulation — AI reviews code against all 17 points before every commit confirmation.

---

## Output Template

Save simulation report to `AI_DOCS/quality/quality-report.md` after each run:

```markdown
# Code Quality Simulation Report

**Date**: [ISO date]
**Module**: [Module name]
**Trigger**: [Pre-coding / Pre-commit / Pre-PR]

## Point-by-Point Results

| # | Rule | Status | Evidence / Finding |
|---|------|--------|--------------------|
| 1 | No hardcoded credentials | PASS | All secrets in .env |
| 2 | Input validation | PASS | Zod schemas on all routes |
| 3 | Injection prevention | PASS | Prisma ORM, no raw queries |
| 4 | XSS/CSRF protection | PASS | No dangerouslySetInnerHTML |
| 5 | Auth & authorization | FAIL | /api/reports missing auth middleware |
| 6 | Async handling | PASS | All async/await with try/catch |
| 7 | Null safety | PASS | Optional chaining used |
| 8 | Function length | FAIL | generateReport() is 73 lines |
| 9 | Nesting depth | PASS | Max depth: 2 |
| 10 | Variable naming | PASS | All names descriptive |
| 11 | No dead code | PASS | No unused imports found |
| 12 | No duplication | PASS | Duplication: 1.2% |
| 13 | Cyclomatic complexity | PASS | Max: 7 |
| 14 | Cognitive complexity | PASS | Max: 11 |
| 15 | Test coverage | FAIL | Current: 62%, Required: 98% (lines, branches, functions) |
| 16 | No untested business logic | FAIL | TC-03, TC-04 not implemented |
| 17 | No console.log | PASS | None found in src/ |

## Overall Result: FAIL

## Blockers (Must Fix Before Proceeding)
1. POINT 5: Add auth middleware to `/api/reports` route
2. POINT 8: Refactor `generateReport()` — split into `validateReportRequest()` + `buildReportPayload()` + `persistReport()`
3. POINT 15: Write missing test cases to reach 98% coverage (lines, branches, functions)
4. POINT 16: Implement TC-03 (API failure) and TC-04 (auth failure) test cases
```

---

## Scoring System

| Area | Requirement | Weight |
|------|-------------|--------|
| Security (Points 1–5) | 100% PASS — zero tolerance | Blocker |
| Reliability (Points 6–7) | 100% PASS | Blocker |
| Clean Code (Points 8–12) | 100% PASS | Blocker |
| Complexity (Points 13–14) | 100% PASS | Blocker |
| Testing (Points 15–16) | >= 98% coverage (lines, branches, functions) | Blocker |
| Logging (Point 17) | 100% PASS | Blocker |

**Result**: PASS only if ALL 17 points are PASS. Any single FAIL = overall FAIL = coding blocked.

---

## Enforcement

> [!WARNING]
> - AI must NOT proceed to implementation if this checklist fails
> - All FAIL items must be remediated BEFORE coding continues
> - This checklist must be re-run after remediation to confirm all points pass

---

## Gate Condition

This skill's output satisfies **Gate 1.5: Code Quality Pre-Check** in [gate-enforcement](../gate-enforcement/SKILL.md).

## Next Step

On PASS → Proceed to [build](../build/SKILL.md).
On FAIL → Remediate blockers and re-run this skill.
