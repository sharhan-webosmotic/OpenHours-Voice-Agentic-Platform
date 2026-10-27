---
name: operations
description: "Day-2 operations: owns the project after it ships. Hotfix workflow, monitoring-review cadence, on-call handoff, post-incident actions, and recurring maintenance (dependency updates, secret rotation, TLS cert-expiry, FinOps actual-vs-approved and AI-token spend reconciliation). Use after go-live, for a hotfix, a monitoring review, a rotation, or any production-operations task. Do NOT use for active incident triage (use incident-response) or planning a fresh deployment (use deployment-planning). Also triggers on: 'Hotfix', 'Rotate secret', 'Cert expiry', 'Dependency update', 'On-call', 'FinOps'."
mcp_integrations: [aws, sentry]
skip:
  - "Active incident triage (use /incident-response)"
  - "Plan a fresh deployment (use /deployment-planning)"
  - "Execute a deploy window (use /deployment-execution)"
next_skill: null
required_gate: null
allowed-tools: "Read Write Edit Grep Glob Bash(git:*) Bash(gh:*) WebFetch"
skill_id: SK-156
context_budget:
  load_kb: 30
  scope: task
version: 1.0.0
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [memory-protocol]
  optional: [incident-response, deployment-planning, deployment-execution, schedule, infra-cost-guard, retrospective, data-migration]
produces:
  - path: AI_DOCS/operations/maintenance-log.md
    consumers: [retrospective]
  - path: AI_DOCS/operations/oncall-handoff.md
metadata:
  author: WebOsmotic Private Limited
  category: infrastructure
  user_facing: true
  role: "day-2-operations"
---

# /operations — own the project after it ships

> The framework plans and ships well, then historically dropped the project at go-live. This skill is the maintenance phase: the project is a living system once it is in production, and someone has to own hotfixes, monitoring, rotations, cost, and the path into an incident. That owner is `/operations`, dispatched by `/do` Phase 4.

## What it owns

1. **Hotfix workflow** — an urgent production fix outside the milestone cadence.
2. **Monitoring-review cadence** — a recurring read of error rate, latency, saturation, and the alert backlog.
3. **On-call handoff** — who holds the pager, what is open, what to watch.
4. **Recurring maintenance jobs** — seeded into `/schedule` at ship so they actually run.
5. **FinOps** — actual cloud + AI spend reconciled against the approved estimate.

## 1. Hotfix workflow (BLOCKING discipline)

A hotfix is not a normal task. It skips the milestone branch and goes straight from `main`, so it carries extra risk and needs a tighter loop.

1. **Branch from `main`** (not from a milestone branch): `hotfix/<short-slug>`.
2. **Reproduce + write a failing test first.** A hotfix with no regression test is how the same fire restarts next week.
3. **Fast-track gate (not a skipped gate):** run the MAVS validators relevant to the touched surface (`mavs-gate.sh` must be green for the changed area), plus the `/build` battery. Speed comes from scope, not from skipping verification.
4. **Deploy** via `/deployment-execution` graduated-autonomy tiers (`rules/ops-safety-rules.md`): the AI may run the dev/preview verify, the human approves the prod mutation.
5. **Backport** the fix onto the active milestone branch and `develop` so the next release does not regress it. Record the hotfix + backport in `AI_DOCS/operations/maintenance-log.md`.
6. If the hotfix is for a SEV1/SEV2 incident, `/incident-response` runs the incident; `/operations` runs the fix.

## 2. Monitoring-review cadence

On each review (default weekly, seeded as a `/schedule` job): read error rate, p95/p99 latency, saturation (CPU/mem/disk), the 5xx rate, and open alerts against the thresholds in `docs/app-observability-standard.md`. Anything past threshold opens a maintenance-log entry with an owner. A review that finds nothing still logs "reviewed, green" so the cadence is auditable.

## 3. On-call handoff

Write `AI_DOCS/operations/oncall-handoff.md`: current on-call, open incidents, recently shipped changes to watch, known-fragile areas, and the runbook links. Updated at each handoff. The next responder reads ONE file.

## 4. Recurring maintenance jobs (seeded at ship)

At go-live, `/operations` seeds these default `/schedule` jobs so day-2 work is not left to memory:

| Job | Default cadence | What it does |
|---|---|---|
| Dependency refresh | weekly | Dependabot/Renovate config check + `pnpm audit` / `pip-audit`; opens a maintenance entry on new HIGH/CRITICAL |
| Secret rotation | quarterly | Re-checks secret age in the secret store; flags any past its rotation window |
| TLS cert expiry | weekly | Checks cert expiry on the prod domains; alerts at 30 days remaining |
| FinOps reconciliation | monthly | Actual cloud invoice + AI-token spend vs the approved estimate in `infra-cost-approvals.md` / `ai-cost-approvals.md`; flags drift > 20% |

Dependency updates use Dependabot or Renovate (recommend Renovate for grouped, scheduled PRs). Never auto-merge a dependency PR that touches an auth, crypto, or payment dependency without review.

## 5. FinOps (cost does not stop at provisioning)

`infra-cost-guard` and `ai-cost-guard` gate spend BEFORE it happens. `/operations` closes the loop AFTER: reconcile the actual monthly cloud invoice and the runtime AI-token spend against the last approved figure. Drift over 20% opens a maintenance entry and, for cloud, a re-run of `/infra-cost-guard`. The **billing alarm must be a verified resource**, not a plan mention: confirm the AWS Budgets alert (or provider equivalent) at 120% of the approved total actually exists in the account before sign-off. A plan that names a billing alarm but has not provisioned one is a Gate 5 CONCERNS.

## Verification before maintenance sign-off

- Hotfixes: regression test present, fast-track MAVS green, backported.
- Monitoring review: every past-threshold metric has an owner.
- Rotations: nothing past its rotation window.
- FinOps: actual vs approved within 20%, billing alarm confirmed live.

<!-- Version: 1.0.0 — 2026-06-29 — New skill (Track E T-E.2/E.6/E.7): day-2 operations owner dispatched by /do Phase 4 (hotfix, monitoring cadence, on-call, seeded maintenance jobs, FinOps reconciliation, verified billing alarm). -->
