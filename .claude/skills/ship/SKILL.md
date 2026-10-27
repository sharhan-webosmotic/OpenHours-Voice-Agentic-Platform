---
name: ship
description: "Deploys the project to its configured target. Pre-flight refuses unless the last /audit verdict is PASS (or user override), Gate 5 is PASSED, the drift report is clean and all tasks are DONE. Runs the stack.md deploy commands, verifies health, logs to decision-log.md. Invoked by /do in the ship phase."
skill_id: SK-133
version: 2.3.0
context_budget:
  load_kb: 25
  scope: global
dependencies:
  required: [audit, ask]
  optional: [github-ops]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: release
  user_facing: false
---

# /ship — deploy with pre-flight + health verify

> One skill, one verb. Reads the deployment target from `stack.md`. Refuses to ship a project that hasn't passed `/audit` or has unfinished tasks.

## Pre-flight (refuse unless ALL pass)

| Check | Source | Block on |
|-------|--------|----------|
| Audit verdict | `AI_DOCS/audit/audit-report.md` | absent, FAIL, or older than 24h. CONCERNS allowed only after `/ask` override. |
| Scope closure (Gate 5) | `AI_DOCS/memory/gate-status.md` + `AI_DOCS/audit/scope-closure-report.md` | Gate 5 not PASSED, report absent, or report older than the last `task-ledger.md` change. Run `gate-enforcement` Gate 5 first. |
| Drift | `AI_DOCS/quality/drift-report.md` | report exists with unacknowledged findings. Force a fresh scan first: `rm AI_DOCS/memory/.drift-last-run` then `bash .claude/hooks/drift-detector.sh`. Findings acknowledged in the scope-closure report do not block. |
| Task completeness | `AI_DOCS/memory/task-ledger.md` | any Status ∈ {TODO, DOING, BLOCKED} that is in the current milestone or earlier. SKIPPED is allowed (must have a Notes reason). |
| Working tree | git | uncommitted changes (offer to commit via `/github-ops` first). |
| Branch | git | not on the deploy branch declared in `stack.md` (`main` by default). |
| Tests | `pnpm test` / `pytest` | any failure. |
| First-release security offer | `decision-log.md` + `AI_DOCS/audit/security-summary.md` | never blocks by itself. On the first production deploy (no earlier `Shipped to` production entry) with no summary covering HEAD, ask once whether to run `deep-security-audit` (`standard`) and log the answer. Open confirmed critical or high findings block through the Audit verdict row (`/audit` check 13). |
| E2E golden path | `tests/e2e/` or `tests/smoke/` | any failure. UI project with no E2E suite at all: blocked — golden-path coverage is mandatory before production (write it via `qa-testing` / `e2e-testing`, or `/ask` override, logged). |

If any check fails, return a one-line summary: which check, what to do. Do NOT prompt the user — `/do` will route via `/ask` if appropriate.

## Deploy

Read deploy target from `stack.md`. Supported targets and the command each runs:

| Target | Command(s) | Health check |
|--------|------------|--------------|
| Vercel | `vercel --prod` | `curl -fsS https://<domain>/api/health` (200) |
| Fly.io | `fly deploy` | `fly status` shows all machines healthy |
| Railway | `railway up` | dashboard URL probe (200) |
| Cloudflare Pages | `wrangler pages deploy` | URL probe |
| Docker Compose (self-host) | `docker compose pull && docker compose up -d` | `docker compose ps` all healthy + URL probe |
| Custom | run the script declared in `stack.md → deploy.script` | run the check declared in `stack.md → deploy.health` |

Streaming output is captured. On non-zero exit → STOP, do not attempt rollback automatically; surface the error and the last 30 lines of output, leave it to `/do` → `/ask`.

## Post-deploy verify
1. Run the health check above; retry up to 3 times with 10s backoff.
2. Smoke-test the golden path declared in `intent.md → success criteria` if a smoke test exists at `tests/smoke/` or `tests/e2e/smoke.*`.
3. On all green → record success.

## Record outcome

Append one entry to `AI_DOCS/memory/decision-log.md`:

```
## YYYY-MM-DD HH:MM — Shipped <project> to <target>
- **Branch:** <git branch>  **Commit:** <short sha>
- **Audit:** PASS (<report timestamp>)
- **Health:** ✓
- **URL:** <prod URL>
- **Notes:** <skipped tasks summary, if any>
```

If the deploy fails: same format with `- **Status:** FAILED — <one-line cause>` and stop. No silent rollback.

## Boundaries
- Does not run audits inline — call `/audit` first via `/do`.
- Does not push to git or open PRs — that's `/github-ops`.
- Does not modify code. If a config file (e.g., `vercel.json`) is missing, return BLOCKED with a suggested `/ask` question.
- One environment per invocation. To ship to staging, set `stack.md → deploy.target=staging` first.

## Verification (of /ship itself)
- Returns within 30s on a pre-flight failure (does not start the deploy command).
- On success: the deploy command exits 0, health probe returns 200, decision-log gets one new entry.
- On failure: decision-log gets a FAILED entry; no other side-effects.

<!-- Version: 2.2.2 | 2026-10-21 | description trimmed per the v4.28.0 cost policy -->
<!-- Version: 2.3.0 | 2026-10-22 | first-release security offer row in pre-flight (deep-security-audit, SK-169) -->
