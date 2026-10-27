---
name: deployment-execution
description: "Assist during a live deployment: the user runs commands, this skill tracks step-by-step progress, diagnoses failed steps, verifies post-deploy health, decides rollback/continue, and drives sign-off. Reads the runbook produced by /deployment-planning. Does NOT run deployment commands. Use during the deploy window after a runbook is ready. Also triggers on: 'Execute deployment', 'Start deployment', 'Monitor deployment', 'Ship it now', 'Deployment in progress', 'Verify deployment', 'Rollback deployment', 'Post-deploy verification'."
mcp_integrations: [aws, sentry]
skip:
  - "Plan deployment (use /deployment-planning)"
  - "Create runbook (use /deployment-planning)"
  - "Write release notes (use /github-ops)"
next_skill: retrospective
required_gate: "Gate 5B Deployment Execution Approval"
budget_critical: true
allowed-tools: "Read Write Edit Grep Glob Bash(git:*) Bash(gh:*) Bash(curl:*) Bash(kubectl:*) Bash(docker:*) WebFetch"
skill_id: SK-045
context_budget:
  load_kb: 30
  scope: task
version: 1.2.1
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [deployment-planning]
  optional: [github-ops, debugger, incident-response]
produces:
  - path: AI_DOCS/deployment/DEPLOYMENT_LOG_[VERSION].md
    consumers: [retrospective, gate-enforcement]
  - path: AI_DOCS/deployment/post-deployment-verification.md
    consumers: [retrospective]
consumes:
  - path: AI_DOCS/deployment/RUNBOOK_[VERSION].md
    required_sections: [pre-deployment-checklist, rollback-commands, smoke-tests]
metadata:
  author: WebOsmotic Private Limited
  category: infrastructure
  patterns: [sequential, domain-specific]
  split_from: deployment
  split_in: 3.1.0
  role: "deployment-execution-phase (phases 3-5)"
---

# /deployment-execution — Live Deployment Support

> **ACT AS:** Senior DevOps Engineer on the deploy call
> **CORE VALUES:** Rollback-ready, observable, calm under incident pressure
> **SCOPE:** Phases 3–5 of the deployment lifecycle (user execution support, post-deploy verification, sign-off). Phases 1–2 (validation + runbook generation) are in `/deployment-planning`.

> [!CRITICAL]
> **Graduated deploy autonomy** (per `rules/ops-safety-rules.md`). Autonomy is tiered by blast radius, not blanket-forbidden:
> - **AI MAY run autonomously:** ephemeral / dev / preview deploys, and READ-ONLY post-deploy verification (health checks, smoke tests, log/metric reads). These are reversible and low-risk.
> - **AI MUST stop for human approval:** any STAGING or PRODUCTION mutation (deploy, migration, scale, DNS, secret change) and EVERY rollback DECISION. Show the command, get explicit confirmation, the user runs it (or approves the AI running it for that one step).
>
> The old blanket rule forbade the AI from even reading prod health. The line is: read freely, mutate prod only with a human in the loop.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials). Wire the stack-conditional ones only when that technology is in `stack.md`:

- `aws` (gated): query infrastructure state during the deploy window.
- `sentry` (gated): post-deploy error verification.

Target the dev environment. Treat staging/production access as a separate approved step.

---

## Quality Gates (from v3.0 original, retained)

### Gate 5B — Deployment Execution Approval

Decision: Is the deployment executing successfully?

- [ ] Health checks passing (`/health` returns 200 OK)
- [ ] Database migrations completed (if any)
- [ ] Application logs show no errors during startup
- [ ] Smoke tests successful

**Approval required:** DevOps Engineer

### Gate 5C — Post-Deployment Monitoring

Decision: Is the deployment stable in production?

- [ ] Error rate ≤ baseline (monitored for 30 minutes)
- [ ] Response time ≤ baseline + 10%
- [ ] CPU/Memory usage stable
- [ ] Critical user flows verified
- [ ] No rollback triggered

**Approval required:** DevOps Engineer + Product Owner

### Gate 5D — Production Sign-Off

Decision: Can we close the deployment?

- [ ] Monitoring stable for 30+ minutes (Production)
- [ ] No user-reported issues
- [ ] Deployment log updated
- [ ] Runbook updated (if new procedures emerged)
- [ ] Stakeholders notified

**Approval required:** Product Owner

## Observability Expectations

Before starting a production deployment, confirm the following are wired (per `docs/app-observability-standard.md`, the canonical APP observability standard. Note: `references/observability-standards.md` is ADF skill-execution telemetry, NOT deployed-app observability):

- **Logs**: CloudWatch / Datadog / Elasticsearch + Kibana — searchable, real-time
- **Metrics**: Prometheus + Grafana / Datadog / New Relic — dashboards loaded in tab
- **APM**: New Relic / Datadog APM / Dynatrace — trace live flow
- **Uptime**: Pingdom / Uptime Robot / StatusCake — external probe available

If any are missing, flag in the deployment log as a gap for retrospective.

## Reference Documents

| Doc | Purpose |
|---|---|
| `references/release-protocol.md` | Git merge/tag protocol, SemVer rules, hotfix procedures |
| `docs/app-observability-standard.md` | Deployed-app observability (logs/metrics/traces/alerts/health/error-tracking) — the canonical standard |
| `references/observability-standards.md` | ADF skill-execution telemetry only (NOT app observability) |
| `incident-response` skill | Live incident command (SEV classify, commander loop, comms) when a deploy goes wrong |

---

## When to Run

| Trigger | Timing |
|---|---|
| Runbook ready + deploy window started | User says "start deployment" or "ship it" |
| Step failed during deploy | User reports failure; skill diagnoses |
| Post-deploy verification needed | After the last deploy command succeeded |
| Rollback decision needed | Error rate spike, latency spike, or critical flow broken |

---

## Pre-flight

Read `AI_DOCS/deployment/RUNBOOK_[VERSION].md`. If missing, stop: "No runbook found for this version. Run `/deployment-planning` first."

Verify the pre-deployment checklist is checked (user confirms). Do not proceed without confirmation.

---

## Instructions

### Phase 3 — User Executes (Manual)

**Role:** Tracker + diagnostician.

1. Announce the runbook steps clearly, one at a time:

   ```
   Step 3 of 12: Apply database migration
   User runs: kubectl apply -f k8s/migrations/2026-04-21.yaml
   Expected: migration.batch/2026-04-21 created
   Awaiting user confirmation...
   ```

2. User runs the command and pastes output (or confirms success).

3. Update `AI_DOCS/deployment/DEPLOYMENT_LOG_[VERSION].md`:

   ```markdown
   ## Step 3 — Apply database migration
   - **Started:** 2026-04-21 15:02:14
   - **Completed:** 2026-04-21 15:02:42
   - **Duration:** 28s
   - **Outcome:** SUCCESS
   - **Output:** migration.batch/2026-04-21 created
   ```

4. If a step fails:
   - Match the failure to the "If it fails" section of the runbook
   - Run diagnostic queries if needed (read-only: kubectl describe, docker logs, health endpoints)
   - Propose fix, rollback, or retry — user decides
   - Log the decision in the deployment log

5. After the last step, move to Phase 4.

---

### Phase 4 — Post-Deployment Verification

**Objective:** Confirm deployment stability.

Tasks:

1. **Smoke tests** (from runbook)
   - Trigger the user's smoke-test checklist
   - User runs / verifies; reports results

2. **Performance monitoring (15–30 min)**
   - Pull error rate from monitoring (CloudWatch / Datadog / Prometheus)
   - Compare against baseline (from `AI_DOCS/deployment/baselines.json`)
   - Check response time p50/p95/p99
   - Verify CPU + memory within bands

3. **Log analysis**
   - Read last 500 application log lines
   - Flag unexpected ERROR / WARN patterns
   - Verify no DB connection errors

4. **Metric validation**
   - Custom application metrics tracking (if defined in `tech-spec.md`)
   - Business metrics (e.g., conversion rate unchanged for MVP+)
   - Third-party integration heartbeats

**Rollback Decision Matrix:**

| Condition | Action |
|---|---|
| Error rate > 5% above baseline (sustained 5 min) | ROLLBACK |
| Response time > 2× baseline (sustained 5 min) | ROLLBACK |
| Critical user flow broken | ROLLBACK |
| Warning-level anomalies only | CONTINUE + heightened monitoring |
| Everything within bands | PROCEED TO SIGN-OFF |

If ROLLBACK: walk the user through runbook's rollback section. Same tracking pattern as Phase 3.

**Output:** `AI_DOCS/deployment/post-deployment-verification.md`

---

### Phase 5 — Sign-Off & Documentation

1. **Finalize deployment log**
   - Start time, end time, total duration
   - Step-by-step outcomes
   - Any issues encountered + how resolved
   - Rollback actions (if any)
   - Link to monitoring dashboards

2. **Update operational runbook**
   - If new procedures emerged, update
   - Document any environment-specific quirks discovered
   - Add troubleshooting steps for new failure modes

3. **Team communication**
   - Post deployment summary to #engineering (or configured channel)
   - Share: version, features included, downtime if any, monitoring link
   - Update the active milestone's `tasks.md` deployment task → DONE (summary row in `AI_DOCS/memory/task-ledger.md`)

4. **Post-mortem (if incident occurred)**
   - Document incident: root cause, impact, timeline
   - Action items to prevent recurrence (goes to next retrospective)
   - Update deployment checklist based on learnings

5. **Gate status update**
   - `gate-status.md`: Gate 5 (Production Sign-off) → PASS

6. **Telemetry**
   ```bash
   bash hooks/log-event.sh "\"event\":\"gate.verdict\",\"gate\":\"G5\",\"verdict\":\"pass\",\"version\":\"$VERSION\""
   ```

---

## Examples

### Example 1: Smooth deployment

**User says:** "start deployment of v1.2.0"

**Actions:**

1. Read runbook at `AI_DOCS/deployment/RUNBOOK_v1.2.0.md`
2. Confirm pre-deployment checklist with user (all [x])
3. Walk through 12 steps — each user-executed, each logged
4. Smoke tests pass, error rate baseline+0.2%, latency baseline+50ms
5. Monitor 30 min — stable
6. Sign off: Gate 5 PASS, log finalized, #engineering notified
7. Next step: suggest `/retrospective`

### Example 2: Rollback

**User says:** "start deployment of v1.2.0"

**Actions:**

1. Steps 1–7 succeed
2. Step 8 (app rollout): health check returns 503 for 3 minutes
3. Match failure to runbook "If it fails" → health check must return 200
4. Diagnose: `kubectl logs` shows DB migration incomplete
5. User decision: rollback
6. Execute rollback section of runbook (user runs; skill tracks)
7. Post-rollback: health 200, baseline restored within 4 minutes
8. Incident logged; action items: "Migration timeout too short — raise before retry."

---

## Troubleshooting

### User paste shows mixed output

**Cause:** multiple commands run in one step or shell noise included.

**Solution:** ask user to separate by step. "Paste the output for Step 4 only, please."

### Monitoring dashboard unavailable

**Cause:** observability isn't wired yet or URL changed.

**Solution:** fall back to app logs + health endpoint. Flag that proper monitoring is a gap for the retrospective.

### User wants to continue past a failure threshold

**Cause:** schedule pressure.

**Solution:** state the risk clearly, ask for explicit override phrase ("I accept the risk and continue despite error rate 8%"). Log the override. Do NOT silently proceed.

### Rollback commands fail

**Cause:** rollback path not tested.

**Solution:** escalate. Most rollback failures cascade into a second incident. Bring the oncall lead into the loop, switch to manual recovery, document the event as a critical gap for retrospective.

---

## Rules

1. **Never execute deploy/rollback commands.** User executes, skill tracks.
2. **Rollback decisions are driven by thresholds**, not gut feel. Log the metric values that justified the call.
3. **Every step is logged** with timestamp + duration + outcome.
4. **Smoke tests are mandatory** — no sign-off without them passing.
5. **Post-mortem is required for any rollback or incident.** No "we'll write it later."
6. **The deployment log is immutable** once signed off — rewrites happen in a new log.

## Next Step

After sign-off, suggest `/retrospective` to capture learnings. For any incident, run `/incident-response` (live command) and then `/retrospective` within 48 hours.

<!-- Version: 1.2.0 — 2026-06-29 — Track E. Graduated deploy autonomy (read-only + dev/preview autonomous, staging/prod mutation + rollback human-approved); repointed app-observability to docs/app-observability-standard.md (references/observability-standards.md is skill telemetry); wired the incident-response skill; swept deprecated memory/task.md ref. -->
<!-- Version: 1.2.1 | 2026-10-22 | v4.32.0: team-feature, team-design and team-release retired, consumers list repointed to gate-enforcement -->
