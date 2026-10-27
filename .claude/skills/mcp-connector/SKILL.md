---
name: mcp-connector
description: "Configure MCP servers for database access, browser verification, and tool connections. Enforces free no-credential servers automatically and gates credentialed ones. Use when setting up MCP servers, connecting databases, accelerating debug/verify, or configuring an MCP. Also triggers on: 'Search', 'Find package', 'Latest version', 'Connect MCP', 'Setup MCP'."
next_skill: null
skill_id: SK-023
mcp_integrations: [sequential-thinking, context7, playwright]
context_budget:
  load_kb: 30
  scope: task
version: 1.2.1
dependencies:
  required: []
  optional: [session-management, tech-specification]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---
# MCP Connector

> Connect to MCP servers. Find the right server for your tech stack. Manage packages.

---

## Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## Governance

This skill operates under `.claude/rules/mcp-rules.md` (loaded by `/do`). Two tiers:

- **Enforced (free):** no credentials, local `npx`/`uvx`, no paid/external system. Auto-provisioned when the stack matches. No prompt.
- **Gated (credentialed):** needs a key/token/connection string or hits a paid system. Offered, never applied silently. Requires approval + `${ENV_VAR}` credentials.

The provisioning target is a project-root `.mcp.json`. Active servers are recorded in `AI_DOCS/memory/stack.md` under `## MCP Servers`. Never write to the deprecated `implementation-plan.md`.

> [!IMPORTANT]
> Exact package ids drift. Before writing any server into `.mcp.json`, verify the current package id with the Package Search step below. The commands here are the known-good identifiers as of this skill version, not a substitute for verification.

---

## When This Runs — Three Triggers

`mcp-connector` fires at three moments to make each faster (per mcp-rules.md Rule 4):

1. **Stack finalized** (`stack.md` locked at Gate 1). Map the confirmed stack to the Enforced catalogue, write matched free servers to `.mcp.json`. List Gated servers the stack implies and ask for approval + credentials.
2. **Setup / scaffold done.** Re-verify `.mcp.json` against installed dependencies. Add newly-relevant free servers (e.g. Playwright once a web frontend exists).
3. **Debug / verify.** `debugger`, `e2e-testing`, `verify`, `audit` reach for the relevant Enforced server before reasoning blind. If a free server is needed and absent, provision it on the spot.

**Process at trigger 1/2:**
1. Read the confirmed stack from `AI_DOCS/memory/stack.md`
2. Match against the Enforced + Gated catalogues below
3. Write all matched **Enforced** servers to `.mcp.json` (no prompt)
4. For each matched **Gated** server: *"[server] needs [credential]. Provide it as `${ENV_VAR}` and I'll wire it, or skip?"*
5. Append approved Gated servers to `.mcp.json` with `${ENV_VAR}` references (never literals)
6. Record the active set in `stack.md` → `## MCP Servers`
7. Show the resulting server list

---

## Enforced Registry (Free — auto-provisioned)

| MCP Server | Command | Tech Trigger | Accelerates |
|---|---|---|---|
| Sequential Thinking | `npx -y @modelcontextprotocol/server-sequential-thinking` | always | planning, debug |
| Context7 | `npx -y @upstash/context7-mcp` | always | setup, debug (up-to-date docs, no hallucinated APIs) |
| Playwright | `npx -y @playwright/mcp@latest` | any web frontend | debug, verify (browser, screenshots, console/network) |
| shadcn | `npx -y shadcn@latest mcp` | Shadcn/ui in stack | setup |
| Next.js devtools | `npx -y next-devtools-mcp` | Next.js in stack | setup, debug |
| MUI | `npx -y @mui/mcp` | Material UI in stack | setup |
| Prisma | `npx -y prisma mcp` | Prisma ORM in stack | setup, debug |

> `fetch`, `filesystem`, `git` MCP are NOT enforced: Claude Code already provides native WebFetch/WebSearch, file, and git access. Add only on explicit request.

## Gated Registry (Credentialed — approval required)

| MCP Server | Tech Trigger | Credential (`${ENV_VAR}`) |
|---|---|---|
| Postgres (`postgres-mcp` / archived `@modelcontextprotocol/server-postgres`) | PostgreSQL in stack | `${DATABASE_URL}` |
| `mongodb-mcp-server` | MongoDB in stack | `${MONGODB_URI}` or Atlas key |
| `@supabase/mcp-server-supabase` | Supabase in stack | `${SUPABASE_URL}` + `${SUPABASE_SERVICE_ROLE_KEY}` |
| `@stripe/mcp` | Payment features | `${STRIPE_SECRET_KEY}` |
| `@sentry/mcp-server` | Error monitoring | `${SENTRY_AUTH_TOKEN}` |
| `@modelcontextprotocol/server-github` | GitHub Ops enabled | `${GITHUB_PERSONAL_ACCESS_TOKEN}` |
| AWS MCP | AWS deployment | `${AWS_ACCESS_KEY_ID}` + `${AWS_SECRET_ACCESS_KEY}` |
| `slack-mcp-server` | Slack notifications | `${SLACK_BOT_TOKEN}` |
| `gmp-code-assist` | Maps/Location features | `${GOOGLE_MAPS_API_KEY}` |

See `templates/mcp-server-recommendations.md` for per-server tool lists and the `.mcp.json` template.

---

## MongoDB Agent Skills (Special Case)

> [!IMPORTANT]
> If MongoDB is in the tech stack, ask the user:
>
> *"MongoDB is in your tech stack. There is a dedicated set of MongoDB AI skills available at https://github.com/mongodb/agent-skills that provide advanced MongoDB-specific capabilities (schema design, query optimization, Atlas Stream Processing, etc.).*
> *Do you want to clone this repository for use in this project? (Recommended)"*

If YES:
```
git clone https://github.com/mongodb/agent-skills
```
Then integrate the cloned skills into the project's AI skills setup.

---

## GitHub Ops (Special Case)

> [!IMPORTANT]
> At project start, ask the user:
>
> *"Do you want to enable GitHub operations for this project? This allows me to create commits, branches, and pull requests on your behalf. (Y/N)"*

- If YES → Enable `github-ops` skill and `github-mcp-server` (requires GitHub PAT)
- If NO → `github-ops` skill is dormant for this session

---

## Package Search

When the user needs a package for a specific use case:

```
1. Identify the use case
2. Search npm / PyPI / crates.io for options
3. Find latest stable version (@latest, not beta/RC)
4. Check for known vulnerabilities (zero tolerance)
5. Present top 2–3 options with license info
6. User confirms selection
7. Add to AI_DOCS/memory/package-registry.md
```

**Output Template:**
```markdown
## Package Search: [Use Case]

| Package | Version | License | Downloads | Vulnerabilities |
|---------|---------|---------|-----------|-----------------|
| option-a | 1.2.3 | MIT | 1M/week | 0 |
| option-b | 2.0.0 | MIT | 500K/week | 0 |

**Recommendation**: [Package] because [reason]

Confirm install? (Y/N)
```

---

## Rules

1. Latest stable only — no beta, RC, or alpha versions
2. Zero known vulnerabilities required
3. MIT or permissive OSS license preferred
4. One package per use case — no redundant dependencies
5. Update `AI_DOCS/memory/package-registry.md` after every install
6. Enforced (free) servers are provisioned automatically when the stack matches. Never gate a free server behind a prompt.
7. Gated (credentialed) servers are NEVER written to `.mcp.json` without approval, and ALWAYS use `${ENV_VAR}` references. A secret literal in `.mcp.json` is a hard-fail defect (see `mcp-rules.md` Rule 5).
8. Record the active server set in `AI_DOCS/memory/stack.md` → `## MCP Servers`. Never use `implementation-plan.md`.
9. Prefer the free local server over a paid/external one whenever both answer the question.
