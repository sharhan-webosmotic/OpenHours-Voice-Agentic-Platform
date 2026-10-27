---
paths:
  - ".mcp.json"
  - "**/.mcp.json"
  - ".mcp-ignore"
---

# MCP Rules

> Always-on baseline rule for Model Context Protocol (MCP) servers. Governs WHICH
> servers a project gets, WHEN they are provisioned, and HOW credentials are
> handled. Loaded by `/do`, `mcp-connector`, `session-management`, `debugger`,
> `e2e-testing`, and `audit`. The operating skill is `mcp-connector` (SK-023).
>
> Goal: use MCP to make three moments faster: stack finalize, project setup, and
> debug/verify. Free servers are enforced automatically. Credentialed servers are
> gated behind approval.

---

## Rule 1: Two tiers, Enforced vs Gated

Every MCP server falls into exactly one tier.

- **Enforced (free).** No credentials, runs locally via `npx`/`uvx`, hits no paid
  or account-bound external system. These are added to the project automatically
  when the stack matches. No prompt, no approval. They only make the agent
  faster, they cannot spend money or leak data.
- **Gated (credentialed).** Needs an API key, token, connection string, or
  account, OR reaches a paid/external system. These are NEVER added silently.
  They require the ops-safety approval flow (Rule 4) and credentials supplied as
  environment-variable references (Rule 5).

A server's tier is fixed by what it needs, not by preference. A free server that
later requires a key for higher limits stays Enforced at its free tier and is
documented as such.

## Rule 2: Enforced (free) catalogue

These are provisioned automatically when their trigger matches. Exact package
ids are verified against the live registry via the `mcp-connector` package-search
step before writing, never assumed.

| Server | Package / command | Trigger | Phase it accelerates |
|---|---|---|---|
| Sequential Thinking | `npx -y @modelcontextprotocol/server-sequential-thinking` | always | planning, debug |
| Context7 | `npx -y @upstash/context7-mcp` | always (any library/framework) | setup, debug (kills hallucinated APIs) |
| Playwright | `npx -y @playwright/mcp@latest` | any web frontend | debug, verify (browser, screenshots, console/network) |
| shadcn | `npx -y shadcn@latest mcp` | shadcn/ui in stack | setup |
| Next.js devtools | `npx -y next-devtools-mcp` | Next.js in stack | setup, debug |
| MUI | `npx -y @mui/mcp` | Material UI in stack | setup |
| Prisma | `npx -y prisma mcp` | Prisma ORM in stack | setup, debug |

`fetch`, `filesystem`, and `git` MCP servers are intentionally NOT enforced:
Claude Code already provides native WebFetch/WebSearch, file, and git access, so
adding them is redundant surface. Add them only on explicit user request.

## Rule 3: Gated (credentialed) catalogue

Provisioned only after Rule 4 approval. Credentials always via `${ENV_VAR}`.

| Server | Trigger | Credential |
|---|---|---|
| Postgres (`postgres-mcp` / archived `@modelcontextprotocol/server-postgres`) | PostgreSQL in stack | `${DATABASE_URL}` |
| `mongodb-mcp-server` | MongoDB in stack | `${MONGODB_URI}` or Atlas key |
| `@supabase/mcp-server-supabase` | Supabase in stack | `${SUPABASE_URL}` + `${SUPABASE_SERVICE_ROLE_KEY}` |
| `@stripe/mcp` | Payment features | `${STRIPE_SECRET_KEY}` |
| `@sentry/mcp-server` | Error monitoring / Sentry in stack | `${SENTRY_AUTH_TOKEN}` |
| `@modelcontextprotocol/server-github` | GitHub Ops enabled | `${GITHUB_PERSONAL_ACCESS_TOKEN}` |
| AWS MCP | AWS deployment | `${AWS_ACCESS_KEY_ID}` + `${AWS_SECRET_ACCESS_KEY}` |
| `slack-mcp-server` | Slack notifications | `${SLACK_BOT_TOKEN}` |
| `gmp-code-assist` (Google Maps) | Maps/Location features | `${GOOGLE_MAPS_API_KEY}` |
| Figma Dev Mode MCP | client-supplied designs (`design-dna.md` Mode: client-design) | none in `.mcp.json`: the local server ships with the Figma DESKTOP app (enable "Dev Mode MCP Server" in the app, the client file open); gated because it reads a client's design account. The REST-token variant (`${FIGMA_ACCESS_TOKEN}`) is the fallback when the desktop app is unavailable |

## Rule 4: Three provisioning triggers

`mcp-connector` runs at three moments. Enforced servers auto-apply at each.
Gated servers are offered (not applied) and require approval.

1. **Stack finalized** (`stack.md` locked, Gate 1). Read the confirmed stack, map
   it to the Enforced catalogue, write the matched free servers into the project
   `.mcp.json`. List any Gated servers the stack implies and ask for approval +
   credentials per Rule 5.
2. **Project setup / scaffold done.** Re-verify `.mcp.json` against the actual
   installed dependencies. Add any newly-relevant free server (e.g. Playwright
   once a web frontend exists).
3. **Debug / verify.** `debugger`, `e2e-testing`, `verify`, and `audit` check
   for the relevant Enforced server before reasoning blind. Web bug or
   verification → use Playwright MCP. DB-state question → use the (approved) DB
   MCP. Unknown library behaviour → use Context7. If the server is absent and
   free, provision it on the spot.

## Rule 5: Credentials are env-var references, never literals

A `.mcp.json` is committed to the repo. It MUST NOT contain a secret literal.
Every credential is an `${ENV_VAR}` reference resolved from the environment.
Secret values live in `.env.local` (gitignored) or a managed store, per
`secrets.md`. Writing a token, key, or connection string literal into `.mcp.json`
is a hard-fail defect, the same as committing a secret.

```jsonc
// CORRECT: reference, value supplied by env
"supabase": {
  "command": "npx",
  "args": ["-y", "@supabase/mcp-server-supabase"],
  "env": { "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}" }
}
```

## Rule 6: `.mcp.json` is the provisioning target

Provisioning means writing a project-root `.mcp.json` (Claude Code reads it as
project-scoped MCP config). `mcp-connector` generates and updates it. Free
servers are written directly. Gated servers are appended only after Rule 4
approval. The framework enforces the free set by setting
`enableAllProjectMcpServers: true` in `settings.template.json` so matched servers
load without a per-server trust prompt. Show the user the resulting server list
after any write.

## Rule 6b: Environment and port awareness

MCP servers must be wired to the project's actual environment, not generic
defaults. When provisioning, read the project's environment + port config and
configure each server accordingly.

- **Source of truth for URL/port:** the dev script (`package.json` scripts,
  `next.config`, `vite.config`, framework default), `.env.local`, and
  `AI_DOCS/infra/infra-plan.md` if present. Record the resolved dev base URL +
  port in `stack.md` → `## MCP Servers`.
- **Browser servers (Playwright, Chrome DevTools, next-devtools):** always target
  the project's dev URL + port (e.g. `http://localhost:3000`). Never a hardcoded
  guess. If the port is non-default, pass it explicitly. `next-devtools`
  discovers the running server, but still confirm the port matches the project.
- **Database / Stripe / cloud servers:** bind to the **dev/local environment
  only** by default. Use the dev connection string (`${DATABASE_URL}` pointing at
  the local/dev DB). NEVER point a debug/verify MCP at staging or production
  without explicit, logged user approval. This mirrors `ops-safety-rules.md`
  (Category B): a DB MCP against a non-local database is an external operation.
- **Per-environment configs:** if the project has dev/stage/prod environments,
  the committed `.mcp.json` carries the **dev** wiring. Staging/production MCP
  access, if ever needed, is a separate gated, approved, and logged step, not the
  default committed config.
- A `.mcp.json` whose browser server points at a port the app does not run on, or
  whose DB server points at a non-dev environment by default, is a defect.

## Rule 6c: Opt-out via `.mcp-ignore`

A project (or a whole machine) can permanently disable a free server. List server
names, one per line (`#` comments allowed), in either:

- `~/.adf/mcp-ignore`: machine-wide, a server you never want in any project.
- `<project>/.mcp-ignore`: project-level.

The two lists are merged. A listed name is never auto-provisioned, and a
framework-written free entry matching it is removed on the next sync so it stays
gone. A user's own or modified entry of the same name is never touched. This is
the supported way to keep a free server off, since the migration otherwise tops
the free set back up on every pull.

## Rule 7: Record what is active

After every `.mcp.json` write, record the active server list in
`AI_DOCS/memory/stack.md` under an `## MCP Servers` section: server name, tier
(enforced/gated), status (active/declined), and the phase it serves. This is the
single source of truth for which MCP servers a project uses. Do NOT write to the
deprecated `implementation-plan.md`.

## Rule 8: Free-first, never the expensive path silently

When a task could use either a free Enforced server or a paid/Gated one, prefer
the free one and only surface the Gated option with its cost/credential
requirement. Never reach for a credentialed external server when a free local one
answers the question.

## Verification (what /audit checks)

- No secret literal in `.mcp.json` (Rule 5): same grep set as `secrets.md`.
- `.mcp.json` server list matches the `## MCP Servers` table in `stack.md` (Rule 7).
- Every Gated server present in `.mcp.json` has a same-project approval on record.
- No `filesystem`/`git` MCP added without an explicit user request (Rule 2).

<!-- Version: 1.1.3 - 2026-06-26 - Rule 6c opt-out now also reads machine-wide ~/.adf/mcp-ignore (merged with project .mcp-ignore). -->
<!-- Version: 1.1.1 - 2026-06-26 - Drop fetch from enforced set (redundant with native WebFetch, official server is Python-only, not on npm). Free ids verified against npm registry before write. -->
<!-- Version: 1.1.0 - 2026-06-26 - Add Rule 6b: environment + port awareness (dev URL/port targeting, dev-only DB binding, per-environment configs). -->
<!-- Version: 1.0.0 - 2026-06-26 - Initial MCP governance: enforced/gated tiers, 3 triggers, .mcp.json target, env-var creds. -->
<!-- Version: 1.2.0 | 2026-08-06 | Gated catalogue gains the Figma Dev Mode MCP (client-supplied designs: local server via the Figma desktop app with the client file open, REST-token variant as fallback), triggered by design-discovery Step 0 Mode: client-design. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
