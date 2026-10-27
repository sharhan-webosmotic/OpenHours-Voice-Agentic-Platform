# Setup Templates — Post-Scaffold Quality Tooling

> **Parent**: [SKILL.md](SKILL.md) — Session Management, Step 1.6 (Post-Scaffold)

This file contains the scaffold CLI command tables and all post-scaffold setup templates (Husky, ESLint, .env.example, PR template, CI).

---

## Project Scaffolding — Official CLI Commands

> [!CRITICAL]
> **Always use the official framework CLI to scaffold a new project.**
> Never manually create `package.json`, `src/`, `main.ts`, or directory structures by hand when an official CLI exists.
> The CLI creates the correct base structure. We then layer our rules and configs on top.

After tech stack is confirmed, run (or show) the correct scaffold commands:

### Frontend (Web)

| Stack | Official Command |
|---|---|
| **Next.js** | `npx create-next-app@latest [app-name] --typescript --tailwind --eslint --app --src-dir` |
| **React + Vite** | `npm create vite@latest [app-name] -- --template react-ts` |
| **Vue + Nuxt** | `npx nuxi@latest init [app-name]` |
| **Angular** | `npx @angular/cli new [app-name] --routing --style=scss` |

### Backend

| Stack | Official Command |
|---|---|
| **NestJS** | `npm i -g @nestjs/cli` then `nest new [app-name]` |
| **Express** | No official CLI — scaffold manually: `npm init -y && npm install express` |
| **FastAPI** | `pip install fastapi uvicorn` — minimal `main.py` |
| **Django** | `pip install django && django-admin startproject [app-name]` |
| **Go** | `go mod init [module-name]` |

### Mobile

| Stack | Official Command |
|---|---|
| **React Native (Expo)** | `npx create-expo-app@latest [app-name] --template blank-typescript` |
| **React Native (bare)** | `npx @react-native-community/cli@latest init [AppName] --template react-native-template-typescript` |
| **Flutter** | `flutter create [app_name]` |

### Database Setup (after scaffold)

| Database | Setup Command |
|---|---|
| **PostgreSQL (Prisma)** | `npm install prisma @prisma/client && npx prisma init` |
| **MongoDB (Mongoose)** | `npm install mongoose` |
| **MongoDB (Prisma)** | `npm install prisma @prisma/client && npx prisma init --datasource-provider mongodb` |
| **TypeORM + PostgreSQL** | `npm install typeorm pg reflect-metadata` |

---

## Post-Scaffold: Code Quality Tooling (MANDATORY)

### Husky + lint-staged (Pre-commit hooks)

```bash
npm install --save-dev husky lint-staged
npx husky init
```

`.husky/pre-commit`:
```bash
npx lint-staged
```

`.husky/pre-push` (memory sync reminder):
```bash
#!/bin/sh
echo ""
echo "=== PRE-PUSH MEMORY CHECK ==="
echo "Before pushing, verify AI_DOCS/memory/ is up to date:"
echo "  - task.md: completed tasks marked [x]?"
echo "  - project-context.md: current stage/milestone correct?"
echo "  - decision-log.md: new decisions logged?"
echo "  - component-registry.md: new components registered?"
echo ""
# Check for uncommitted changes in AI_DOCS/
if git diff --name-only | grep -q "AI_DOCS/"; then
  echo "WARNING: You have uncommitted changes in AI_DOCS/. Commit them before pushing."
  exit 1
fi
```

`package.json` — add lint-staged config:
```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix --max-warnings 0", "prettier --write"],
    "*.{css,scss}": ["prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### ESLint + Prettier

```bash
npm install --save-dev eslint prettier eslint-config-prettier
```

> [!CRITICAL]
> **This is non-negotiable.** Every project must have Husky + lint-staged + ESLint + Prettier configured before any feature code is written. This ensures:
> - Code is auto-formatted on every commit
> - ESLint errors block commits (--max-warnings 0)
> - Consistent code style across all contributors
> - The `PostToolUse` hook in `.claude/settings.json` also auto-formats, but Husky is the final gate

### .env.example (MANDATORY)

Generate `.env.example` based on the confirmed tech stack. This file is committed to git — real `.env` is not.

```
# .env.example — Copy to .env and fill real values
# Get actual secrets from your team lead

# === Database ===
DATABASE_URL=              # Connection string (e.g., postgresql://user:pass@localhost:5432/db)

# === Auth ===
JWT_SECRET=                # Generate: openssl rand -hex 32
JWT_EXPIRES_IN=24h

# === API ===
API_PORT=3000
API_BASE_URL=http://localhost:3000/api/v1

# === Frontend ===
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_APP_NAME=

# === Third-party (get from team lead) ===
# STRIPE_SECRET_KEY=
# SENDGRID_API_KEY=
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
```

> Customize the variables based on the actual tech stack. Add/remove as needed.
> Rule: Every env var used in code MUST exist in `.env.example` with a description.

### PR Review Template (MANDATORY)

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## What changed
<!-- Brief description -->

## Checklist
- [ ] Code follows `.claude/rules/development-rules.md` (naming, architecture, no console.log)
- [ ] API calls match `AI_DOCS/architecture/api-contract.md` (exact URL, method, body, response)
- [ ] UI uses registered components from `AI_DOCS/design/component-registry.md`
- [ ] Design tokens from `AI_DOCS/design/design-dna.md` (no hardcoded colors/spacing)
- [ ] List pages have: pagination, search, filter, sort, empty/loading/error states
- [ ] Tests added for new functionality
- [ ] ESLint passes with zero warnings
- [ ] Responsive: mobile + tablet + desktop verified
- [ ] New env vars added to `.env.example`
```

### Canonical Test Scripts + Configs (MANDATORY)

Every project gets ONE standard way to run the full test scope with a validated report. This is not optional and not inherited from the CLI scaffold.

1. **Add these `scripts` to `package.json`** (adjust the runner: `vitest run --coverage` for Vite/React-SPA, `jest --coverage` for Next.js/CRA/Nest):
```json
{
  "scripts": {
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:full": "node scripts/adf-test.mjs",
    "test:ci": "node scripts/adf-test.mjs --ci",
    "test:validate": "node scripts/validate-test-reports.mjs",
    "deps:check": "knip"
  }
}
```
- `test` runs unit + integration with coverage, gated at 98% (statements/branches/functions/lines) via the config below.
- `deps:check` runs the unused-dependency scan (`knip` with a minimal `knip.json`; Python projects use `deptry .`, Go uses `go mod tidy` + a clean `git diff` on go.mod/go.sum). Scaffolded per the guardrails Dependency-Hygiene Scaffold: an unused production dependency is CONCERNS at /audit and FAIL at /ship without a logged exception (tech-stack-selection-rules Rule 9).
- `test:full` / `test:ci` run the **whole project scope** (JS + Python + Go + Playwright, auto-detected) and **validate the report**, failing on any suite failure or coverage below 98%. `test:ci` adds headless + strict.
- `test:validate` re-checks the last report without re-running (same verdict the merge gate gives).

2. **Copy the config template** matching the runner from `.claude/skills/session-management/templates/`:
   - `vitest.config.ts` (Vite/React-SPA) OR `jest.config.ts` (Next.js/CRA/Nest) — both bake in the 98% four-metric `coverageThreshold` and write coverage into `AI_DOCS/quality/test-artifacts/coverage/`.
   - `playwright.config.ts` — JUnit + HTML reports into `AI_DOCS/quality/test-artifacts/e2e/`, auth-state reuse, headless in CI.

3. **Copy the orchestrator + validator** into the project's `scripts/`:
   - `.claude/skills/session-management/templates/adf-test.mjs` -> `scripts/adf-test.mjs`
   - `.claude/skills/session-management/templates/validate-test-reports.mjs` -> `scripts/validate-test-reports.mjs`
   - For polyglot repos also copy `.claude/skills/python-testing/check_func_coverage.py` and/or `.claude/skills/go-testing/check_func_coverage.sh` into `scripts/`.

4. **All raw test output lands in `AI_DOCS/quality/test-artifacts/` (gitignored)** — never `/tmp`, never project root. The small validated verdict JSON stays in `AI_DOCS/quality/mavs/` (tracked). The gitignore entry is in [SCAFFOLDING.md](SCAFFOLDING.md).

> [!CRITICAL]
> Do NOT leave `test` mapped to the CLI default or to `--passWithNoTests`. A green run must mean the full suite passed AND coverage met the 98% floor. `test:ci` produces the same `AI_DOCS/quality/mavs/*.json` the `mavs-gate.sh` merge gate reads, so local and CI and merge all agree.

### GitHub Actions CI (Ask User)

> Ask the user: **"Do you want me to set up GitHub Actions CI? This will auto-run lint + test on every PR."**
> - **YES** -> Create `.github/workflows/ci.yml` with the template below
> - **NO** -> Skip. Can be added later.

If YES, create `.github/workflows/ci.yml`:

> [!CRITICAL]
> **Before writing this file**: verify the current Node.js LTS version at `https://nodejs.org/en/about/previous-releases` and the latest stable versions of `actions/checkout` and `actions/setup-node` at `https://github.com/actions/checkout/releases` and `https://github.com/actions/setup-node/releases`. Do NOT copy the version numbers below verbatim — they may be outdated. See `.claude/rules/development-rules.md` Rule 31.

```yaml
name: CI
on: [pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v<latest>  # verify at github.com/actions/checkout/releases
      - uses: actions/setup-node@v<latest> # verify at github.com/actions/setup-node/releases
        with:
          node-version: <LTS>             # verify at nodejs.org/en/about/previous-releases
      - run: npm ci
      - run: npx eslint . --max-warnings 0
      - run: npx prettier --check .
      - run: npm run test:ci   # full-scope: unit+coverage (98% gate) + e2e + report validation
```

> `test:ci` runs the whole project scope and validates the report (fails the job on any suite failure or coverage below 98%). For polyglot repos add the matching setup steps BEFORE `test:ci` so the orchestrator's backend gates can run: Python -> `actions/setup-python@v<latest>` (`python-version: <LTS>`) + `pip install`, Go -> `actions/setup-go@v<latest>`. Add `- run: npx playwright install --with-deps chromium` before `test:ci` when an E2E suite exists. Always verify action + runtime versions online before writing.

After tooling setup, make the **first commit**:
```bash
git add .
git commit -m "chore: scaffold [stack] base project with quality tooling"
```

---

## Claude Code Settings Initialization (NEW PROJECT ONLY)

> [!CRITICAL]
> **Create `.claude/settings.json` before any git or scaffold operations.**
> This file configures Claude Code's permissions, denies destructive commands, and excludes sensitive files from context.

**Create the directory and file:**
```bash
mkdir -p .claude
```

**Copy the template from the AI_SKILLS framework:**
```
Source: .claude/skills/session-management/templates/claude-settings.json
Target: .claude/settings.json
```

**What the settings enforce:**

| Category | Rule |
|---|---|
| **Allowed** | Read, Edit, Write, Glob, Grep — all file operations |
| **Allowed** | npm, npx, node, pip, python, nest, prisma, flutter — all build tools |
| **Allowed** | git status/log/diff/branch/checkout/add/commit/merge/tag/pull — all safe git ops |
| **Allowed** | WebFetch to docs sites (github, npm, nestjs, nextjs, tailwind, shadcn) |
| **DENIED** | `git push` — all pushes are manual by the user |
| **DENIED** | `git reset --hard` — destructive resets blocked |
| **DENIED** | `rm -rf` — bulk deletion blocked |
| **DENIED** | `docker`, `kubectl`, `terraform`, `ssh` — infra commands blocked |
| **DENIED** | Editing `.env`, `.env.*`, `*.pem`, `*.key`, `.git/**` — secrets and git internals protected |
| **Excluded** | `.env*`, `*.pem`, `*.key`, `node_modules/`, `dist/`, `.next/`, `.git/` — never loaded into context |

**Append to `.gitignore`:**
```
# Claude Code — skills are NOT committed (copy-pasted from shared location)
# Rules and settings ARE committed (team-wide enforcement)
.claude/skills/
.claude/settings.local.json
```

> [!NOTE]
> **Committed** (shared with all developers):
> - `.claude/settings.json` — hooks and permissions (team-wide)
> - `.claude/rules/` — 8 rule files (auto-enforced for everyone)
>
> **Gitignored** (per-developer):
> - `.claude/skills/` — AI SDLC framework (copy-paste from shared location if needed)
> - `.claude/settings.local.json` — personal overrides

---

## Claude Code Rules & Skills (NEW PROJECT ONLY)

> [!CRITICAL]
> **Rules are per-directory enforcement files** that Claude Code loads automatically based on file paths.
> **Skills are custom slash commands** (e.g., `/session`, `/audit`) that map to AI_SKILLS workflows.
> These are created alongside settings.json to complete the Claude Code integration.

**Create the rules directory and copy relevant rule files:**

```bash
mkdir -p .claude/rules
```

**Copy rules based on tech stack** (from `.claude/rules/` (source templates)):

| Rule File | Copy When | Purpose |
|---|---|---|
| `development-rules.md` | **ALWAYS** | Spec-first coding, architecture, naming, git discipline |
| `security-rules.md` | **ALWAYS** | OWASP Top 10, auth, input validation, secrets |
| `api-rules.md` | Backend selected | Contract-first API development, error handling |
| `frontend-rules.md` | Frontend selected | Component reuse, responsive design, accessibility |
| `component-reuse-rules.md` | Frontend OR Mobile selected | Registry check, design tokens, atomic design |
| `testing-rules.md` | MVP or Production-Grade | Test quality, coverage targets, traceability |
| `mobile-rules.md` | Mobile selected | Platform-specific handling, performance, offline |

```
Source: .claude/rules/[rule-file].md
Target: .claude/rules/[rule-file].md
```

> [!NOTE]
> Rules use `paths:` frontmatter to activate only for matching files.
> For example, `api-rules.md` only activates when editing files in `**/api/**` or `**/*.controller.*`.
> This means they don't add noise when working on unrelated files.

**After creation, inform the user:**
> "Claude Code integration complete. You now have:
> - **Settings** (.claude/settings.json) — permissions, hooks, auto-formatting
> - **Rules** (.claude/rules/) — auto-enforced per directory (API, frontend, security, etc.)
>
> The `.claude/skills/` folder contains the full AI_SKILLS framework.
> Copy it into any new project's `.claude/` directory. Each SKILL.md becomes a Claude Code skill.
> Each skill's `name:` field in its frontmatter becomes the slash command (e.g., `/session-management`, `/workscope`)."
