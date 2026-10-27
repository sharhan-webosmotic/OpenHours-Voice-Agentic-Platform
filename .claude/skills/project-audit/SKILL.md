---
name: project-audit
description: "Scan entire codebase for ghost features, API contract violations, code quality issues, security problems, and documentation drift. Use when auditing the project, running a health check, or finding issues. Also triggers on: 'Audit project', 'Code review', 'Find issues', 'Whats wrong, Project audit, Check codebase, Review code quality'."
next_skill: null
required_gate: null
skill_id: SK-081
context_budget:
  load_kb: 35
  scope: global
version: 1.0.6
context: fork
dependencies:
  required: [session-management]
  optional: [guardrails, tech-specification, build, code-quality]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Project Audit Skill

> **Purpose**: Scan the entire codebase and project against all defined rules, guardrails, tech-spec sections, API contracts, and skill protocols. Find every violation, inconsistency, and loophole. Generate a fix plan.
> **Output**: `AI_DOCS/quality/audit-report.md` + `AI_DOCS/quality/fix-plan.md`
> **When to Use**: End of a milestone, after a period of fast development, when bugs are appearing with no clear cause, or when a new developer joins the project.

---

## Initialization & Memory Logic
> [!NOTE]
> Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Audit Philosophy

> [!IMPORTANT]
> This skill does NOT fix anything. It finds, documents, and plans.
> Fixing is done by running the appropriate skill after the report is reviewed.
>
> An audit should be **brutal and honest** — no softening findings, no skipping uncomfortable issues.
> A clean audit report means the project is actually clean. Not that the auditor was nice.

---

## Phase 1: Load Project Context

Before scanning any code, load all reference files. These are the rules the audit checks against.

### 1.1 Load Reference Documents

Read in this order:

```
1. AI_DOCS/memory/project-context.md
   → Stack, active milestone, overrides, Git state

2. AI_DOCS/planning/tech-spec.md (index)
   → Load section index. Note which sections are APPROVED vs DRAFT.

3. AI_DOCS/architecture/api-contract.md
   → Load all defined API endpoints (method, URL, body, response shape)

4. .claude/rules/*.md
   → Load ALL rules files — these define the check criteria for Categories 2-7
   → api-rules.md (Category 2), development-rules.md (Category 3),
     security-rules.md (Category 7), component-reuse-rules.md (Category 5),
     testing-rules.md (Category 6), frontend-rules.md (Category 5)

5. AI_DOCS/project-guardrails.md (if exists)
   → Load project-specific rules (SEC-*, QUAL-*, PERF-*, etc.) — supplements .claude/rules/

6. AI_DOCS/design/component-registry.md
   → Load all registered UI components

7. AI_DOCS/memory/task-ledger.md, then the active milestone's AI_DOCS/milestones/M<NN>-<slug>/tasks.md
   → Load task completion status — identify any stale in-progress tasks
```

If any file is missing, note it as an audit finding: `[MISSING FILE]: [path]`

### 1.2 Determine Audit Scope

Ask the user:
> "Which scope should the audit cover?
> - **Full** — entire codebase (all features, all layers)
> - **Milestone-scoped** — only code merged in milestone-[N]
> - **Layer-scoped** — Frontend only / Backend only / API contracts only"

---

## Phase 2: Codebase Scan

Run checks across 8 categories. For each finding, record:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **File**: relative path + line number (if applicable)
- **Rule violated**: which guardrail, skill rule, or spec section
- **Description**: what the issue is
- **Fix**: what needs to change

---

### Category 1 — Ghost Features (CRITICAL)

> Ghost Features = code that exists but is NOT documented in tech-spec.md.
> They are unplanned, unreviewed, and untested.

**Check**:
- Scan all `src/` files for API routes, components, and business logic
- For each feature found, verify it traces to a section in `tech-spec.md`
- If no trace exists → `[GHOST FEATURE]` finding

**How to detect**:
- Backend: every `@Controller`, `@Get/@Post/@Put/@Delete`, Express `router.get/post`, FastAPI `@app.get/post` → must map to an endpoint in `api-contract.md`
- Frontend: every page file, screen file, or significant component → must map to a screen in `spec/05-ui-spec.md`
- Business logic functions → must map to a rule in `spec/08-business-logic.md`

---

### Category 2 — API Contract Violations (CRITICAL)

**Check frontend → contract alignment**:
- Every `fetch`, `axios`, `useQuery`, RTK Query endpoint in the frontend
- Extract: HTTP method, URL, request body field names, response field names accessed
- Compare against `AI_DOCS/architecture/api-contract.md`

Violations:
- `[URL MISMATCH]`: Frontend calls `/api/users/login`, contract says `/api/v1/auth/login`
- `[METHOD MISMATCH]`: Frontend uses `GET`, contract says `POST`
- `[BODY FIELD MISMATCH]`: Frontend sends `{ username }`, contract expects `{ email }`
- `[RESPONSE FIELD MISMATCH]`: Frontend reads `response.data.userId`, contract returns `response.data.user.id`

**Check backend → contract alignment**:
- Every route handler in the backend
- Extract: HTTP method, URL path, validated body fields, returned response shape
- Compare against `AI_DOCS/architecture/api-contract.md`

Violations:
- `[ROUTE NOT IN CONTRACT]`: Backend has a route not defined in api-contract.md
- `[RESPONSE SHAPE MISMATCH]`: Backend returns `{ userId }`, contract defines `{ user: { id } }`
- `[AUTH MISMATCH]`: Contract says auth required, but no guard on route (or vice versa)

---

### Category 3 — Code Quality Violations (HIGH)

> Check criteria defined in `.claude/rules/development-rules.md`. Below are the specific violation tags to use:

| Check | Violation |
|---|---|
| `console.log` in non-dev files | `[CONSOLE LOG]` |
| TypeScript `any` type | `[ANY TYPE]` |
| Business logic in controller/route handler | `[LOGIC IN CONTROLLER]` |
| Direct DB access from controller (no repository layer) | `[DB IN CONTROLLER]` |
| Hardcoded string values (magic strings) | `[HARDCODED VALUE]` |
| Hardcoded secrets or credentials | `[HARDCODED SECRET]` — CRITICAL |
| Unused variables or imports | `[DEAD CODE]` |
| Functions >50 lines | `[FUNCTION TOO LONG]` |
| Nesting depth >3 levels | `[DEEP NESTING]` |
| Commented-out code | `[COMMENTED CODE]` |

---

### Category 4 — Missing Error Handling (HIGH)

Check for:
- API calls without try/catch or `.catch()` / error boundary
- Async functions that don't handle rejection
- User-facing errors that show raw error messages (stack traces, internal errors)
- Missing loading states (API call with no loading indicator)
- Missing empty states (list component with no empty state UI)

---

### Category 5 — UI/Design Consistency Violations (MEDIUM)

> Check criteria defined in `.claude/rules/component-reuse-rules.md` and `.claude/rules/frontend-rules.md`.
> Check against `AI_DOCS/design/design-dna.md` and `AI_DOCS/design/component-registry.md`:

| Check | Violation |
|---|---|
| Hardcoded hex colors not in design tokens | `[HARDCODED COLOR]` |
| Raw HTML elements (`<button>`, `<input>`) instead of component library | `[RAW HTML ELEMENT]` |
| Components built that already exist in registry | `[DUPLICATE COMPONENT]` |
| Forms not using react-hook-form | `[FORM WITHOUT RHF]` |
| Validation not using Zod | `[VALIDATION WITHOUT ZOD]` |
| Dark mode classes used when design DNA is light-only | `[DARK MODE VIOLATION]` |

---

### Category 6 — Test Coverage Gaps (MEDIUM)

Check against `spec/18-test-cases.md`:
- For each test case defined in the spec, verify a corresponding test exists
- Flag missing tests: `[MISSING TEST]: TC-[ID] — [description]`
- Flag tests that don't match current code (stale tests)

---

### Category 7 — Security Violations (CRITICAL/HIGH)

> Check criteria defined in `.claude/rules/security-rules.md`. Check against guardrails security rules:

| Check | Severity |
|---|---|
| Hardcoded credentials / API keys | CRITICAL |
| Exposed `.env` values in client-side code | CRITICAL |
| SQL/NoSQL injection risk (unvalidated user input in query) | CRITICAL |
| No input validation before DB write | HIGH |
| Auth not checked before sensitive operations | CRITICAL |
| CORS misconfiguration (`*` in production) | HIGH |
| JWT secret hardcoded | CRITICAL |
| PII logged in plain text | HIGH |

---

### Category 8 — Memory / Documentation Drift (LOW/MEDIUM)

Check for documentation that no longer matches the code:
- `component-registry.md` has components that no longer exist in code
- `task.md` has tasks marked `[/]` (in progress) for >3 days
- `api-contract.md` has endpoints that don't exist in backend code
- Tech spec sections marked APPROVED but code diverges from them
- `project-context.md` has stale active milestone or active task

---

## Phase 3: Audit Report

Generate `AI_DOCS/quality/audit-report.md`:

```markdown
# Project Audit Report

> **Date**: [YYYY-MM-DD]
> **Scope**: [Full / Milestone-N / Layer]
> **Auditor**: AI — project-audit skill (SK-081)

## Summary

| Severity | Count | Fixed | Remaining |
|---|---|---|---|
| CRITICAL | [N] | 0 | [N] |
| HIGH | [N] | 0 | [N] |
| MEDIUM | [N] | 0 | [N] |
| LOW | [N] | 0 | [N] |
| **Total** | **[N]** | **0** | **[N]** |

**Overall Health**: [RED / YELLOW / GREEN]
- RED: Any CRITICAL issues unresolved
- YELLOW: HIGH issues present, no CRITICAL
- GREEN: Only MEDIUM/LOW issues

---

## CRITICAL Issues

### [ISSUE-ID]: [Title]
**Category**: [Ghost Feature / API Contract / Security / Code Quality / ...]
**File**: `[relative/path/to/file.ts]:[line]`
**Rule Violated**: `[guardrail ID or spec section]`
**Description**: [What is wrong and why it matters]
**Fix**: [Exactly what needs to change]
**Skill to use**: [build / change-request / audit / ...]

---

## HIGH Issues
[same format]

## MEDIUM Issues
[same format]

## LOW Issues
[same format]

---

## Missing Files Found
| File | Impact |
|---|---|
| `AI_DOCS/architecture/api-contract.md` | [CRITICAL — no API contract, frontend-backend drift risk] |
| `AI_DOCS/project-guardrails.md` | [HIGH — no project rules generated] |
```

---

## Phase 4: Fix Plan

Generate `AI_DOCS/quality/fix-plan.md`:

```markdown
# Fix Plan — [Date]

> Generated from: AI_DOCS/quality/audit-report.md
> Total issues: [N] | Estimated effort: [X hours/days]

## Execution Order

Fixes are ordered: CRITICAL first, then HIGH, then MEDIUM, then LOW.
Within same severity: security first, API contract second, code quality third.

| # | Issue ID | Severity | File | Fix Summary | Skill | Effort |
|---|---|---|---|---|---|---|
| 1 | ISSUE-001 | CRITICAL | `src/auth/auth.controller.ts:42` | Remove hardcoded JWT secret, move to env | build | 30 min |
| 2 | ISSUE-002 | CRITICAL | `src/api/users.ts:15` | Fix URL mismatch: /api/users/login → /api/v1/auth/login | build | 15 min |
| ... | | | | | | |

## Fixes That Require Change Request

These fixes change the tech-spec or API contract and require user approval before coding:

| Issue | Why CR needed | Action |
|---|---|---|
| [ISSUE-ID] | Route needs to be added to api-contract.md | Run change-request skill first |

## Recommended Skill Sequence

1. `audit` — fix all CRITICAL security issues first
2. `build` — fix API contract mismatches
3. `build` — fix code quality violations
4. `qa-testing` — add missing test cases
5. Re-run `project-audit` — confirm all issues resolved
```

---

## Phase 5: Confirm & Assign

After both files are generated:

1. Present the summary table to the user
2. Ask: "Which issues do you want to fix first?"
3. Route to the appropriate skill for each fix
4. After fixes are applied, re-run Phase 2 to verify the issue is resolved
5. Update `AI_DOCS/quality/audit-report.md` — mark resolved issues as `[FIXED]`

---

## Rules

1. **Never soften findings** — if code has a hardcoded password, say it. Don't say "potential concern".
2. **Always include file + line** — a finding without a location cannot be fixed.
3. **Always reference the violated rule** — link to guardrail ID, spec section, or skill rule.
4. **Always include the fix** — don't just find problems, describe the solution.
5. **Re-audit after fixes** — don't close the loop until Phase 2 is re-run.
6. **Respect overrides** — if `project-context.md` disables unit testing, don't flag missing unit tests.
