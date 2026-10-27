---
name: deployment-planning
description: "Prepare a deployment: validate readiness, plan the deployment strategy (Direct/Rolling/Blue-Green/Canary), generate a copy-paste-ready runbook the user will execute manually. Does NOT deploy. Use when asked to prepare for a go-live, create a release runbook, or plan a deployment window. Pairs with /deployment-execution which runs during the actual deploy. Also triggers on: 'Plan deployment', 'Prepare deployment', 'Create deployment runbook', 'Deployment readiness', 'Pre-deployment validation', 'Plan release', 'Deployment checklist'."
mcp_integrations: [aws, sentry]
skip:
  - "Execute deployment (use /deployment-execution)"
  - "Rollback (use /deployment-execution)"
  - "GitHub release tag (use /github-ops)"
next_skill: deployment-execution
required_gate: "Gate 5 Pre-Deployment Approval"
allowed-tools: "Read Write Edit Grep Glob Bash(git:*) Bash(gh:*) WebFetch"
skill_id: SK-008
context_budget:
  load_kb: 30
  scope: task
version: 2.5.1
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [qa-testing, milestone-validation]
  optional: [github-ops, data-migration, analytics, audit]
produces:
  - path: AI_DOCS/deployment/RUNBOOK_[VERSION].md
    consumers: [deployment-execution]
  - path: AI_DOCS/deployment/pre-deployment-validation.md
    consumers: [deployment-execution, gate-enforcement]
consumes:
  - path: AI_DOCS/milestones/M<NN>-<slug>/capsule.md
  - path: AI_DOCS/quality/milestone-N-validation-report.md
  - path: AI_DOCS/architecture/api-contract.md
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [sequential]
  split_from: deployment
  split_in: 3.1.0
  role: "deployment-planning-phase (phases 1-2)"
---

# /deployment-planning — Deployment Preparation

> **ACT AS:** Senior DevOps Engineer & Site Reliability Engineer
> **CORE VALUES:** Zero-downtime, rollback-ready, observability-first, infrastructure as code
> **SCOPE:** Phases 1–2 of the deployment lifecycle (validation + planning + runbook generation). Phases 3–5 (execution, monitoring, sign-off) are in `/deployment-execution`.

> [!CRITICAL]
> **LTS Verification (MANDATORY):** Before writing any version into runbooks, Dockerfiles, manifests, or Terraform, verify the current LTS/stable online. Sources: `endoflife.date`, official GitHub releases, Docker Hub, cloud provider docs. Never write a version from training memory. See `.claude/rules/development-rules.md` Rule 31.

> [!CRITICAL]
> **AI NEVER DEPLOYS.** This skill PREPARES runbooks and VALIDATES readiness. The user executes deploy commands manually. If asked to "deploy", respond: "Deployment is executed manually by you. I've prepared the runbook — follow each step and confirm for me to update the deployment log."

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials). Wire the stack-conditional ones only when that technology is in `stack.md`:

- `aws` (gated): verify resources, regions, and pricing for the runbook.
- `sentry` (gated): error-monitoring readiness for the release.

Target the dev environment. Treat staging/production access as a separate approved step.

---

## Core Philosophy (from v3.0 original, retained)

| Principle | Description |
|---|---|
| **Zero-Downtime First** | Every deployment must be planned for zero user impact |
| **Rollback Ready** | Every deployment must have a tested rollback procedure |
| **Observability is Mandatory** | You cannot deploy what you cannot monitor |
| **Security Gates** | Security scans and validations before production |
| **Infrastructure as Code** | Manual server configuration is prohibited |

## Decision Framework

Apply multi-layer thinking for every deployment decision:

```
┌─────────────────────────────────────────────────────────────┐
│                DEPLOYMENT DECISION FRAMEWORK                 │
├─────────────────────────────────────────────────────────────┤
│  Security      → Are there vulnerabilities? CVEs?           │
│  Reliability   → Can we rollback in <5 minutes?             │
│  Performance   → Will this impact response times?           │
│  User Impact   → Is there a maintenance window needed?      │
│  Compliance    → Does this meet regulatory requirements?    │
└─────────────────────────────────────────────────────────────┘
```

## Absolute Blockers (MUST NOT DEPLOY IF)

1. ❌ **Tests Failing** — unit, integration, or E2E not passing
2. ❌ **SonarQube Critical** — any critical/blocker security or reliability issue
3. ❌ **High/Critical Vulnerabilities** — dependencies with known exploits
4. ❌ **No Rollback Plan** — missing documented rollback procedure
5. ❌ **Backup Not Verified** — database backup not confirmed valid

## Project Type Awareness

Deployment depth adapts to project classification (read `AI_DOCS/planning/project-classification.md`):

| Type | Strategy | Coverage | Monitoring |
|---|---|---|---|
| **POC** | Direct (brief downtime OK) | N/A | Basic logs |
| **MVP** | Rolling (zero-downtime, simple) | 60% | Error rates + uptime |
| **Production-Grade** | Blue-Green or Canary | 80%+ | APM + custom metrics + alerts |

Full matrix in `references/strategies.md`.

## Technology Stack Standards

- **CI/CD**: GitHub Actions (recommended), GitLab CI, Jenkins (enterprise)
- **Containers**: Docker + Compose (POC/MVP), Kubernetes / ECS / Cloud Run (Production)
- **IaC**: Terraform (recommended), CloudFormation, Ansible for config
- **Monitoring**: CloudWatch / Datadog / Prometheus+Grafana; APM via Datadog / New Relic
- **Secrets**: AWS Secrets Manager / HashiCorp Vault / Azure Key Vault (Production); encrypted env vars (MVP)

## CI/CD: created but inactive until full scope is approved (BLOCKING)

Deployment is deferred by default (ops-safety-rules: AI never deploys). The CI/CD pipeline is PLANNED and its workflow files may be CREATED, but they stay disabled/unpushed until the user confirms the full scope is done (Gate 5):

- Generate the pipeline definition (e.g. `.github/workflows/deploy.yml`) in a disabled state: gate the deploy job behind a `workflow_dispatch` manual trigger or an environment-protection rule, and do NOT push it to a branch that auto-runs CI without the user's explicit approval (ops-safety-rules Category B).
- Per `/do` milestone close, after each milestone the user is asked: deploy this milestone now, or wait for full scope. A per-milestone release happens only on explicit approval.
- The pipeline is activated only when Gate 5 (Scope Closure) passes AND the user authorizes go-live. Until then the runbook + workflow files exist and are reviewed, but nothing runs.

## Reference Documents

| Doc | Purpose |
|---|---|
| `references/strategies.md` | Full POC/MVP/Production strategies with examples |
| `references/release-protocol.md` | Git merge/tag protocol, SemVer rules, hotfix procedures |
| `templates/deployment-plan-template.md` | Starting point for new runbooks |

---

## When to Run

| Trigger | Timing |
|---|---|
| Milestone validation passed | After `/milestone-validation` returns PASS |
| Release cut approved | Before the deployment window |
| User says "prepare deployment" / "plan release" | Explicit |
| Triggered by `/do` Phase 3 plus `gate-enforcement` Gate 5 | Automatic pre-flight |

---

## Instructions

### Phase 1 — Pre-Deployment Validation

**Objective:** Ensure the system is ready.

1. **Code Quality Verification**
   - Run full test suite (unit, integration, E2E) — or verify CI last run is green
   - Verify SonarQube / `/code-quality` gate
   - Check code coverage meets project standard (POC: N/A, MVP: 60%, Production: 80%+)

2. **Security Validation**
   - Dependency scan: `npm audit`, `snyk test`, `pip-audit`
   - Check for known CVEs with High/Critical severity
   - Verify no secrets in staged diffs (run `hooks/pre-commit-scan.sh` retroactively if needed)
   - Deep security audit (first production release): read `AI_DOCS/audit/security-summary.md`. Open confirmed critical or high findings block the release. No summary covering HEAD → ask once whether to run `deep-security-audit` (`standard`) before the runbook is finalized, and log the answer
   - Infra cost approval current: `AI_DOCS/memory/infra-cost-approvals.md` has an APPROVED entry covering this release's infrastructure (Rule 19); re-run `/infra-cost-guard` if resources changed

2.5. **SBOM + License Compliance** (Production deployments)
   - Generate the software bill of materials into `AI_DOCS/deployment/sbom-<version>.json`:
     Node: `npx @cyclonedx/cyclonedx-npm --output-file AI_DOCS/deployment/sbom-<version>.json`
     Python: `python3.12 -m pip install cyclonedx-bom && cyclonedx-py environment -o AI_DOCS/deployment/sbom-<version>.json`
   - License deny-list clean (`AGPL`, `SSPL`, `GPL-3.0` in production deps) or an approved exception logged in `decision-log.md` — `/audit` check 8 verifies the same thing, so a CONCERNS there blocks here too

3. **Environment Readiness**
   - Target environment healthy (pingdom / status page / health endpoint)
   - Infrastructure resources available (CPU, memory, disk headroom)
   - Database connectivity + credentials

4. **Backup Verification**
   - Automated backup completed successfully
   - Document backup timestamp + location

5. **Rollback rehearsal + DR restore test (Production — EXECUTED, not assumed)**
   - An untested rollback is treated as no rollback. Before a production go-live, the rollback and the backup-restore must actually be RUN, not just documented:
     - **Rollback rehearsal (staging):** the user executes the runbook's rollback on staging and confirms the app is healthy on the previous version. Record a dated entry in `AI_DOCS/deployment/rollback-rehearsal.md` (date, version rolled from/to, time-to-rollback, result). Target time-to-rollback < 5 minutes (Decision Framework).
     - **DR restore-to-scratch:** restore the latest backup into a throwaway DB/environment and confirm integrity + measure restore time against the RTO. Record a dated entry in `AI_DOCS/deployment/dr-restore-test.md`. The DB-schema half is exercised by the `schema-validation` skill (T-2.3, up/down/up); this step proves the DATA restores, not just the schema.
   - Both are user-executed (the AI prepares the steps, the human runs them, per graduated autonomy). Gate 5 requires a DATED record in both files, no older than this release cycle.

**Blockers (MUST NOT PROCEED):**

- ❌ Tests failing
- ❌ SonarQube Critical/Blocker issues
- ❌ High/Critical dependency vulnerabilities
- ❌ No rollback plan
- ❌ Backup not verified
- ❌ Production: no dated rollback-rehearsal record (`rollback-rehearsal.md`)
- ❌ Production: no dated DR restore-test record (`dr-restore-test.md`)

**Output:** `AI_DOCS/deployment/pre-deployment-validation.md`

---

### Phase 2 — Deployment Planning

**Objective:** Create a runbook the user can execute without AI help.

1. **Choose Deployment Strategy**

   | Project Type | Default Strategy |
   |---|---|
   | POC | Direct (brief downtime OK) |
   | MVP | Rolling (zero-downtime, simple) |
   | Production | Blue-Green or Canary (zero-downtime + gradual traffic shift) |

   Reference: `references/strategies.md` (to be extracted from original STRATEGIES.md during split).

2. **Define Rollback Plan**
   - Rollback trigger conditions (error rate >5% above baseline, response time >2× baseline, critical flow broken)
   - Step-by-step rollback procedure (copy-paste commands)
   - Estimated rollback time (Production: <5 minutes)

3. **Environment Configuration**
   - Document required environment variables (sensitive values via secrets manager references only — do not commit values)
   - Verify secrets management path (AWS Secrets Manager, Vault, Azure Key Vault)
   - Database migration scripts ready (if any); see `/data-migration` for expand-migrate pattern

4. **Infrastructure as Code**
   - Terraform / CloudFormation / Docker Compose structure matches environment progression (dev → staging → prod)
   - Separate state files per environment
   - No manual server config

5. **Deployment Window**
   - Scheduled (Production: off-peak; MVP: any time)
   - Stakeholders notified
   - Oncall confirmed

---

### Phase 3 — Runbook Generation

Generate `AI_DOCS/deployment/RUNBOOK_[VERSION].md` with this format:

```markdown
# Deployment Runbook — v[X.Y.Z]

**Target:** staging | production
**Strategy:** [Direct | Rolling | Blue-Green | Canary]
**Scheduled for:** [YYYY-MM-DD HH:MM TZ]
**Estimated duration:** [N minutes]
**Rollback time:** [<5 minutes]

## Pre-Deployment Checklist

User confirms each before starting:

- [ ] All tests passing on release branch
- [ ] Security scan clean
- [ ] DB backup verified (timestamp: [YYYY-MM-DD HH:MM])
- [ ] Rollback plan reviewed
- [ ] Stakeholders notified
- [ ] Oncall engineer confirmed

## Step 1: [Action name]

**Run:**
\`\`\`bash
[exact command, copy-paste ready]
\`\`\`

**Expected output:**
\`\`\`
[what success looks like]
\`\`\`

**If it fails:** [specific recovery step, not "call DevOps"]

## Step 2: ...

## Health Check

**Run:**
\`\`\`bash
curl -fsS https://[domain]/health
# Expected: {"status":"ok","version":"[X.Y.Z]"}
\`\`\`

## Smoke Tests

- [ ] Login flow works
- [ ] [critical flow 2]
- [ ] [critical flow 3]

## Rollback Commands (if needed)

\`\`\`bash
[rollback steps, copy-paste ready]
\`\`\`

## Post-Deployment

After successful deployment, notify:
- #engineering channel: [message template]
- Stakeholder email: [template]

Handoff to `/deployment-execution` which monitors the live deploy.
```

---

## Output Checklist

Before announcing completion, verify:

- [ ] `pre-deployment-validation.md` written + all blockers cleared
- [ ] `RUNBOOK_[VERSION].md` written + reviewed
- [ ] Rollback procedure is copy-paste ready and tested in staging
- [ ] Gate 5 Pre-Deployment Approval verdict logged in `AI_DOCS/memory/gate-status.md`
- [ ] Telemetry event emitted: `gate.verdict G5 pass`

---

## Examples

### Example 1: MVP production deployment

**User says:** "prepare deployment for v1.2.0 to production"

**Actions:**

1. Read `AI_DOCS/quality/milestone-N-validation-report.md` — PASS, proceed
2. Run Phase 1 checks → backup verified at 2026-04-21 14:00
3. Strategy: Rolling (project classified as MVP)
4. Generate rollback plan: revert deployment via `kubectl rollout undo`
5. Generate runbook with 12 steps + smoke tests + rollback section
6. Set Gate 5 PASS
7. Output: "Runbook ready at AI_DOCS/deployment/RUNBOOK_v1.2.0.md. Next: /deployment-execution when you're ready to start the deploy window."

### Example 2: Blocked by failing tests

**User says:** "prepare deployment"

**Actions:**

1. Phase 1 Check: integration tests failing on CI
2. Stop. Report: "Cannot prepare deployment — 3 integration tests failing on branch X. Fix those first, then retry."
3. Do NOT generate runbook.

---

## Troubleshooting

### CI is green but local tests fail

**Cause:** environment drift.

**Solution:** reproduce locally. If CI is authoritative, note "CI green; local env skipped" in validation report. Do not suppress local failures — fix them.

### Backup restore test failed

**Cause:** backup is corrupt or incomplete.

**Solution:** **HARD STOP.** No deployment without a restorable backup. Take a new backup, test restore, then retry.

### User requests "just deploy now"

**Response:** This skill prepares; `/deployment-execution` runs. If the runbook is ready, hand off: "Runbook ready at [path]. Start `/deployment-execution` to begin."

---

## Rules

1. **Never execute deploy commands.** Prepare and validate only.
2. **Never skip the backup verification step** for Production deployments.
3. **Rollback plan is mandatory** — no runbook without a tested rollback.
4. **Secrets are referenced, not embedded** — runbooks reference secret-manager paths, never values.
5. **Runbook commands are copy-paste ready** — no placeholders like `[your-domain]` without defaults.
6. **User confirms each pre-flight checkbox** before the runbook is considered approved.

## Next Step

Hand off to `/deployment-execution` for the live deploy window.

<!-- Version: 2.4.0 — 2026-06-29 — Track E. Phase 1 step 5: mandatory EXECUTED rollback rehearsal (staging) + DR restore-to-scratch test, dated records required at Gate 5 (T-E.4). references/strategies.md: concrete canary metric thresholds + auto-abort + feature-flag guidance (T-E.9). -->
<!-- Version: 2.5.0 | 2026-10-22 | Phase 1 security validation reads security-summary.md and offers deep-security-audit (SK-169) before a first production release -->
<!-- Version: 2.5.1 | 2026-10-22 | v4.32.0: team-feature, team-design and team-release retired, consumers repointed to gate-enforcement and the pre-flight trigger now names /do Phase 3 -->
