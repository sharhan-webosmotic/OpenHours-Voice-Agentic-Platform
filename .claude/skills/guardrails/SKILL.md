---
name: guardrails
description: "Generate project-specific coding rules and quality standards (80+ rules). Configure ESLint, Prettier, and project guardrails. Use when setting up coding standards or generating project rules. Also triggers on: 'Generate guardrails', 'Project standards'."
next_skill: milestone-planning
required_gate: null
skill_id: SK-006
context_budget:
  load_kb: 30
  scope: task
version: 1.4.1
dependencies:
  required: [tech-specification]
  optional: [session-management]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# Guardrail Generator Prompt

> **Purpose**: Generate comprehensive, tech-stack-specific guardrails for your project  
> **Output**: `AI_DOCS/project-guardrails.md` - Your project's single source of truth for standards  
> **Version**: 1.0.0

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Relationship to `.claude/rules/`

> [!NOTE]
> **`.claude/rules/`** = Claude Code auto-enforcement (loaded per directory, enforced during editing)
> **`AI_DOCS/project-guardrails.md`** = Project-specific instantiation with IDs (SEC-001, QUAL-003, TEST-001)
>
> This skill GENERATES the project-guardrails.md using `.claude/rules/` as a baseline.
> Where a rule exists in `.claude/rules/`, cite it by filename and section instead of restating it.
> Add project-specific rules (e.g., "Use AWS Secrets Manager for production") that go beyond the baseline.

---

## How to Use This Prompt

1. **Smart Context Injection (Recommended)**:
    - **Step 1**: Read `.claude/rules/` files for baseline rules
    - **Step 2**: Read `session-management/templates/technology-standards.md` (if exists)
    - **Step 3**: Read `package.json` (if exists) or other config files
    - **Step 4**: AUTO-FILL Section 1 based on findings, referencing rules files for baseline
2. **Manual Override**: If no config exists, manually fill Section 1.
3. **Run this prompt** to generate `AI_DOCS/project-guardrails.md`.

---

## Section 1: Tech Stack Configuration

Please provide your project's technology stack:

> [!CRITICAL]
> **LTS Verification (MANDATORY before filling this section)**: The version examples below are ILLUSTRATIVE ONLY and may be outdated. Before writing any version number into `AI_DOCS/project-guardrails.md`, verify the current LTS/stable version online. Sources: nodejs.org/releases, endoflife.date, `npm view <pkg> version`, PyPI, official release pages. Never copy the example versions verbatim. See `.claude/rules/development-rules.md` Rule 31.

### Backend
- **Language & Framework**: (e.g., Node.js <LTS> + Express <stable>, Python <LTS> + FastAPI <stable>, Java <LTS> + Spring Boot <stable>) — verify versions online before writing
- **Database**: (e.g., PostgreSQL <stable>, MongoDB <stable>, MySQL <stable>) — verify versions online before writing
- **ORM/ODM**: (e.g., Prisma, Mongoose, TypeORM, SQLAlchemy) — pin to latest stable at project start
- **Validation Library**: (e.g., Zod, Joi, Yup, class-validator, Pydantic)

### Frontend
- **Framework**: (e.g., Next.js <stable> + React <stable>, Vue <stable> + Nuxt <stable>, Angular <stable>, Vanilla TypeScript) — verify versions online before writing
- **Styling**: (e.g., Tailwind CSS <stable>, CSS Modules, Styled Components, Vanilla CSS) — verify versions online before writing
- **State Management**: (e.g., Zustand, Redux Toolkit, Pinia, Context API)
- **Component Library**: (e.g., shadcn/ui, Material-UI <stable>, Ant Design <stable>, Custom) — verify versions online before writing

### Infrastructure
- **Caching Layer**: (e.g., Redis <stable>, Memcached, In-Memory, none) — verify versions online before writing
- **Authentication**: (e.g., JWT + Clerk, OAuth2, NextAuth.js, Session-based)
- **Logging**: (e.g., Winston, Pino, Bunyan, log4js, Python logging)
- **Testing**: (e.g., Jest <stable> + Playwright <stable>, pytest + Selenium, JUnit + Cypress) — verify versions online before writing

---

## Performance Targets (Merged from performance skill)

| Metric | Target |
|--------|--------|
| Lighthouse | >90 all categories |
| LCP | <2.5s |
| FID | <100ms |
| CLS | <0.1 |
| Bundle | <200KB initial |

**Audit Process**: Measure (Lighthouse) → Identify bottlenecks → Optimize highest-impact first → Re-audit → Document results.

> Detailed performance rules in `.claude/rules/ui-engineering-rules.md` Section "Core Web Vitals".

## Audit-Log Scaffold (baseline — every project, not only compliance)

Per `docs/audit-log-standard.md`, scaffold a minimal audit trail at setup so handlers have a sink to call from day one. For EVERY project with accounts/roles, not just compliance ones:

1. Create the audit store: an `AuditLog` model/table with the canonical fields (timestamp, event, actorId, actorIp, targetType, targetId, outcome, reason, metadata), append-only, separate from app data.
2. Create the sink helper: an `auditLog(event, ctx)` function (and/or an `@audited('<resource>.<action>')` decorator / interceptor) wired to the store, with redaction so secrets and full bodies never land in `metadata`.
3. Add the event enum stub (`<resource>.<action>`) and the always-log list (auth, account, sensitive-data access, admin actions, config changes).
4. Set retention: 90 days baseline; if a compliance regime is declared in `stack.md`, apply its retention from `rules/compliance/audit-logs.md`.

`/build` blocks any sensitive endpoint that does not call this sink; `/audit` verifies it. Generating the scaffold here is what makes those gates satisfiable.

## Dependency-Hygiene Scaffold (baseline — every project)

Installed = used, unused = removed (`tech-stack-selection-rules.md` Rule 9). Scaffold the unused-dependency tooling at setup so `/build`'s added-must-be-used gate and `/audit` check 12 have a tool to run:

1. **JS/TS**: add `knip` as a devDependency with a minimal `knip.json` (entry: the app entrypoints, project: `src/**`, ignore: generated code), and a script `"deps:check": "knip"` in `package.json`.
2. **Python**: add `deptry` to the dev group with a `[tool.deptry]` block in `pyproject.toml` (per-project ignores only when justified), runnable as `deptry .`.
3. **Go**: no extra tool. The check is `go mod tidy` followed by `git diff --exit-code go.mod go.sum`.
4. Wire `deps:check` into the CI quality step next to lint/typecheck (it runs in `/audit` and at milestone close either way).

An unused production dependency found by these tools is CONCERNS at `/audit` and FAIL at `/ship` without a logged exception. Removal is always a reviewed edit, never automatic.

## Section 2: Generator Instructions

> [!IMPORTANT]
> **AI Agent Instructions**: Based on the tech stack provided above, generate a comprehensive `project-guardrails.md` file with the following 8 sections.

---

### Output Format Template

```markdown
# Project Guardrails

> **Tech Stack**: [Auto-fill from Section 1]  
> **Generated**: [Current Date]  
> **Version**: 1.0.0

---

## Quick Reference: Rule Index

| Rule ID | Category | Description | Priority |
|---------|----------|-------------|----------|
| SEC-001 | Security | Input Validation | Critical |
| SEC-002 | Security | SQL/NoSQL Injection Prevention | Critical |
| CACHE-001 | Caching | Cache Layer Setup | High |
| PERM-001 | Permissions | RBAC Implementation | Critical |
| PERF-001 | Performance | Database Indexes | High |
| QUAL-001 | Code Quality | Linting Configuration | Medium |
| OBS-001 | Observability | Structured Logging | High |
| TEST-001 | Testing | Unit Test Coverage | High |
| QA-001 | QA Process | Code Review Checklist | High |

[Auto-generate full index based on all rules below]

---

See [RULE-DETAILS.md](RULE-DETAILS.md) for detailed rule definitions and implementation examples, including:

- **SEC-001 to SEC-012**: Security rules (input validation, injection prevention, secrets management, HTTPS, auth, CSRF, XSS, rate limiting, CORS, headers, SSRF, PRNG)
- **CACHE-001 to CACHE-010**: Caching strategy (cache setup, TTL/invalidation, cache-aside, stampede prevention, warming, consistency, monitoring, eviction, read/write-through, CDN)
- **PERM-001 to PERM-010**: Permissions & RBAC (backend RBAC, frontend guards, ownership validation, hierarchy, role assignment, permission caching, audit logging, dynamic loading, menu filtering, multi-tenancy)
- **PERF-001 to PERF-020**: Performance optimization (query optimization, connection pooling, async/await, lazy loading, compression, images, code splitting, bundle size, SSR, pagination, debouncing, background jobs, transactions, memory leaks, Web Vitals, tree shaking)
- **QUAL-001 to QUAL-020**: Code quality (linting, formatting, naming, file org, function length, complexity, magic numbers, DRY, SOLID, error handling, dead code, strict typing, no console.log, no business logic in controllers, comments, API docs, dependency management)
- **UI-CON-001 to UI-CON-005**: UI consistency (mandatory field markers, icon placement, spacing tokens, component naming, lazy loading)
- **OBS-001 to OBS-010**: Observability (structured logging, error tracking, APM, health checks, metrics, distributed tracing, log aggregation, alerts, dashboards, audit trail)
- **TEST-001 to TEST-020**: Testing requirements (unit coverage, integration, E2E, test data, mocking, isolation, naming, AAA, performance, regression, API contract, DB rollback, snapshot, visual regression, input validation, error scenarios, security, load, accessibility, SQL injection)
- **QA-001 to QA-015**: QA standards (code review checklist, defect severity, pre-deployment, acceptance criteria, test strategy, regression, UAT, release sign-off, hotfix, debugging, error reproduction, environment parity, data migration, rollback, access control)
- **COMP-001 to COMP-002**: Compliance (PII data protection, SOC2 audit logging)
- **Cross-references**: Security-Testing, Caching-Performance, Permissions-QA, Performance-Observability mappings

---

## Usage in Development Workflow

### 1. Task Planning (execution-plan.md)
```markdown
##### 3. Security Context
*   **Validation:** Input validation using [Library]
*   **Guardrail References:** SEC-001, SEC-002

##### 8. Test Coverage Strategy
*   **Unit Tests:** 98% coverage (lines, branches, functions) per TEST-001
*   **Security Tests:** Injection tests per TEST-020
*   **Guardrail References:** TEST-001, TEST-015, TEST-020
```

### 2. Code Review
- Reference specific rule IDs in PR comments
- Use Quick Reference table to find applicable rules
- Cross-check implementation against rule examples

### 3. CI/CD Pipeline
- Automated checks for QUAL-001 (linting)
- Coverage reports for TEST-001 (98% lines, branches, functions)
- Security scans for SEC-XXX rules

---

*Generated by AI_PROMPT Guardrail Generator*  
*Version 1.0.0*  
*Last Updated: [Date]*
```

---

## Section 3: Generation Rules

**AI Agent**: When generating `project-guardrails.md`, follow these rules:

1. **Tech-Stack Specificity**:
   - Use actual library names from tech stack (e.g., "Zod" not "validation library")
   - Provide concrete code examples in the project's language
   - Reference actual package names and versions

2. **Consistency**:
   - Use consistent rule ID format (CATEGORY-NNN, zero-padded)
   - Maintain consistent section structure for all rules
   - Cross-reference related rules

3. **Comprehensiveness**:
   - Generate AT LEAST 10 rules per category (total 80+ rules)
   - **MANDATORY**: Include "Category 9: Compliance (COMP-XXX)" specifically for GDPR/SOC2/PII.
   - **MANDATORY**: SEC-003 MUST explicitly require AWS Secrets Manager or HashiCorp Vault for Production/Enterprise.
   - Cover all input parameters (caching, auth, database, etc.)
   - Include practical examples for each rule


4. **Searchability**:
   - Create complete Rule Index table at top
   - Use markdown anchors for navigation
   - Add "Related Rules" to every rule

5. **Actionability**:
   - Every rule must have:
     - Clear "Rule" statement
     - Tech-stack-specific "Implementation" example
     - "Common Violations" list
     - "Testing" guidance
     - "Related Rules" references

---

## Section 3: Generation Rules

**AI Agent**: When generating `project-guardrails.md`, follow these rules:

1. **Tech-Stack Specificity**:
   - Use actual library names from tech stack (e.g., "Zod" not "validation library")
   - Provide concrete code examples in the project's language
   - Reference actual package names and versions

2. **Consistency**:
   - Use consistent rule ID format (CATEGORY-NNN, zero-padded)
   - Maintain consistent section structure for all rules
   - Cross-reference related rules

3. **Comprehensiveness**:
   - Generate AT LEAST 10 rules per category (total 80+ rules)
   - **MANDATORY**: Include "Category 9: Compliance (COMP-XXX)" specifically for GDPR/SOC2/PII.
   - **MANDATORY**: SEC-003 MUST explicitly require AWS Secrets Manager or HashiCorp Vault for Production/Enterprise.
   - Cover all input parameters (caching, auth, database, etc.)
   - Include practical examples for each rule


4. **Searchability**:
   - Create complete Rule Index table at top
   - Use markdown anchors for navigation
   - Add "Related Rules" to every rule

5. **Actionability**:
   - Every rule must have:
     - Clear "Rule" statement
     - Tech-stack-specific "Implementation" example
     - "Common Violations" list
     - "Testing" guidance
     - "Related Rules" references

---

## Section 4: Example Output Structure

See examples section above for complete examples.
- `nodejs-express-guardrails.md`
- `python-django-guardrails.md`
- `nextjs-react-guardrails.md`

---

## Section 4: Latest Packages Enforcement (Nova Integration)

> [!CRITICAL]
> **ALL package installations must follow these rules:**

### Package Selection Rules

1. **@latest stable only** - No beta, RC, or alpha versions
2. **Zero vulnerabilities** - Run `npm audit` before installing
3. **MIT/OSS preferred** - Check license compatibility
4. **One per use case** - Avoid duplicate functionality

### Pre-Installation Check

```bash
# Search for latest version
npm view [package] version

# Check vulnerabilities
npm audit [package]

# Verify license
npm view [package] license
```

### Update Package Registry

After installing ANY package:
1. Open `AI_DOCS/memory/package-registry.md`
2. Add entry with: name, version, license, use case
3. Verify no duplicate functionality exists

---

*Part of AI_PROMPT Common Core Architecture*  
*Referenced by: build/SKILL.md, design-system/SKILL.md, qa-testing/SKILL.md*

## Next Step
Proceed to the next skill in the workflow as indicated in the YAML frontmatter.
