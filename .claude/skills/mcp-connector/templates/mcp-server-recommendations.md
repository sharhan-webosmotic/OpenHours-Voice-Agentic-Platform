# MCP Server Recommendations

> **Purpose**: Central catalog of MCP (Model Context Protocol) servers mapped to technology stacks and SDLC phase.
> **Audience**: AI agents during project init, scaffold, and debug/verify.
> **Governance**: `.claude/rules/mcp-rules.md` (Enforced vs Gated tiers).
> **Triggers**: stack finalized, scaffold done, debug/verify (mcp-rules.md Rule 4).

---

## Overview

MCP servers extend AI capabilities with specialized tools for browsers, databases, UI frameworks, and live docs. Free servers are enforced automatically. Credentialed servers are gated.

> [!IMPORTANT]
> Package ids drift. Verify the current id via the Package Search step in SKILL.md before writing any server to `.mcp.json`. The commands below are the known-good identifiers as of this template version.

---

## 1. MCP Server Catalog

### 1.1 Enforced — Always (free, no credentials)

| Server | Command | Key Capabilities |
|--------|---------|------------------|
| Sequential Thinking | `npx -y @modelcontextprotocol/server-sequential-thinking` | Step-by-step reasoning, problem decomposition |
| Context7 | `npx -y @upstash/context7-mcp` | Up-to-date, version-specific library docs and examples (no key for basic rate limits) |

> `fetch`/`filesystem`/`git` MCP are deliberately omitted: Claude Code provides native WebFetch/WebSearch, file, and git access. (The official `fetch` server is Python-only (`uvx mcp-server-fetch`), not on npm.)

### 1.2 Enforced — Debug / Verify (free)

| Server | Command | Key Capabilities |
|--------|---------|------------------|
| Playwright | `npx -y @playwright/mcp@latest` | Browser automation, screenshots, DOM snapshots, console + network capture, click-through verification |
| Chrome DevTools (optional) | `npx -y chrome-devtools-mcp@latest` | Deeper DevTools protocol: performance traces, precise network/console. Offer for perf/network debugging only. |

### 1.3 Enforced — Stack-matched (free)

| Server | Command | Tech Stack Match |
|--------|---------|------------------|
| shadcn | `npx -y shadcn@latest mcp` | Shadcn/ui, Tailwind |
| Next.js devtools | `npx -y next-devtools-mcp` | Next.js |
| MUI | `npx -y @mui/mcp` | Material UI |
| Prisma | `npx -y prisma mcp` | Prisma ORM |

### 1.4 Gated — Database (credentialed)

| Server | Command | Credential |
|--------|---------|------------|
| Postgres | `npx -y postgres-mcp` (or archived `@modelcontextprotocol/server-postgres`) | `${DATABASE_URL}` |
| MongoDB | `npx -y mongodb-mcp-server` | `${MONGODB_URI}` / Atlas key |
| Supabase | `npx -y @supabase/mcp-server-supabase` | `${SUPABASE_URL}`, `${SUPABASE_SERVICE_ROLE_KEY}` |

### 1.5 Gated — Cloud / API / Tokens (credentialed)

| Server | Command | Credential |
|--------|---------|------------|
| Stripe | `npx -y @stripe/mcp` | `${STRIPE_SECRET_KEY}` |
| Sentry | `npx -y @sentry/mcp-server` | `${SENTRY_AUTH_TOKEN}` |
| GitHub | `npx -y @modelcontextprotocol/server-github` | `${GITHUB_PERSONAL_ACCESS_TOKEN}` |
| Google Maps | `gmp-code-assist` | `${GOOGLE_MAPS_API_KEY}` |
| Slack | `npx -y slack-mcp-server` | `${SLACK_BOT_TOKEN}` |

> `filesystem` / `git` MCP are deliberately omitted: Claude Code provides native file + git access.

---

## 2. Tech Stack → MCP Mapping Matrix

Phase tags: **S** = setup, **D** = debug, **V** = verify.

| If the project has... | Provision | Tier | Phase |
|-----------------------|-----------|------|-------|
| **Any project** | Sequential Thinking, Context7 | Enforced | S/D |
| **Any web frontend** | Playwright | Enforced | D/V |
| **Frontend: Next.js** | next-devtools-mcp | Enforced | S/D |
| **Styling: Shadcn/ui** | shadcn | Enforced | S |
| **Styling: MUI** | @mui/mcp | Enforced | S |
| **ORM: Prisma** | prisma mcp | Enforced | S/D |
| **DB: PostgreSQL** | postgres-mcp | Gated | D/V |
| **DB: MongoDB** | mongodb-mcp-server | Gated | D/V |
| **DB: Supabase** | @supabase/mcp-server-supabase | Gated | D/V |
| **Payments** | @stripe/mcp | Gated | D/V |
| **Error monitoring** | @sentry/mcp-server | Gated | D |
| **GitHub Ops** | server-github | Gated | S/V |
| **AWS deploy** | AWS MCP | Gated | V |
| **Maps/Location** | gmp-code-assist | Gated | S |

---

## 3. Provisioning Protocol

### Step 1: Read the confirmed stack
From `AI_DOCS/memory/stack.md` (NOT tech-spec.md Section 16 — deprecated).

### Step 2: Match
Cross-reference the stack against the matrix above.

### Step 3: Write Enforced servers
Write every matched Enforced (free) server into project-root `.mcp.json`. No prompt.

### Step 4: Offer Gated servers
For each matched Gated server:

```markdown
## MCP — credentialed server available

Your stack implies **[server]** ([capability]). It needs `${ENV_VAR}`.
- Reply **"wire it"** to add it (credential read from env, never stored in the file)
- Reply **"skip"** to proceed without it
```

### Step 5: Record
Write the active set to `AI_DOCS/memory/stack.md` → `## MCP Servers`.

---

## 4. `.mcp.json` Template

Project-root `.mcp.json`. Credentials are `${ENV_VAR}` references only.

```jsonc
{
  "mcpServers": {
    "sequential-thinking": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"] },
    "context7":            { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
    "playwright":          { "command": "npx", "args": ["-y", "@playwright/mcp@latest"] },

    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}"
      }
    }
  }
}
```

Free servers carry no `env` block. Gated servers always do, and every value is a `${...}` reference. A literal secret here is a hard-fail defect.

### Environment + port (mcp-rules.md Rule 6b)

Wire servers to the project's real environment, not generic defaults:

- Resolve the dev base URL + port from the dev script / `.env.local` / infra plan, and record it in `stack.md` → `## MCP Servers` (e.g. `dev URL: http://localhost:3000`).
- Browser servers (Playwright, Chrome DevTools, next-devtools) navigate to that dev URL+port. If the app runs on a non-default port, pass it explicitly at call time.
- DB / Stripe / cloud servers bind to the **dev** environment only by default (`${DATABASE_URL}` → local/dev DB). Pointing a debug/verify MCP at staging or production is a separate gated, logged step (ops-safety Category B), never the committed default.
- The committed `.mcp.json` carries dev wiring. Staging/prod MCP access is provisioned separately when explicitly approved.

---

## 5. Recording MCP Configuration

After writing `.mcp.json`, record in `AI_DOCS/memory/stack.md`:

```markdown
## MCP Servers

| Server | Tier | Status | Serves |
|--------|------|--------|--------|
| context7 | enforced | active | up-to-date docs |
| playwright | enforced | active | debug/verify |
| supabase | gated | active | DB queries |
| stripe | gated | declined | (no key yet) |
```

---

## 6. Quick Reference

### When to act

| Trigger | Action |
|---------|--------|
| Stack finalized (Gate 1) | Write Enforced servers, offer Gated (Rule 4.1) |
| Scaffold done | Re-verify `.mcp.json` vs installed deps (Rule 4.2) |
| Debug / verify | Reach for Playwright / DB / Context7 before guessing (Rule 4.3) |
| Session restore | Read `## MCP Servers` in stack.md |

### Debug / verify pairing

| Symptom | Server |
|---------|--------|
| Web UI bug, "is it actually rendering?" | Playwright |
| Verify a fix in the browser | Playwright |
| "What's in the DB right now?" | DB MCP (approved) |
| Unknown library API behaviour | Context7 |
| Performance / network trace | Chrome DevTools |
| Production error triage | Sentry (approved) |

---

*Part of ADF Framework*
*Last Updated: 2026-06-26*
