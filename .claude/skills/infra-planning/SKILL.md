---
name: infra-planning
description: "Plan the infrastructure for BOTH frontend and backend before implementation: environments (dev/staging/prod), hosting topology, secrets/config management, CI/CD pipeline, monitoring/alerting, disaster recovery, and cost-at-scale. Produces AI_DOCS/infra/infra-plan.md. Use during planning, after the tech spec, before milestones are seeded. Also triggers on: 'Plan infrastructure', 'Infra plan', 'Hosting topology', 'Environment setup plan', 'CI/CD design'."
next_skill: milestone-planning
required_gate: null
skill_id: SK-144
context_budget:
  load_kb: 20
  scope: task
version: 1.4.0
dependencies:
  required: [tech-specification]
  optional: [architecture, deployment-planning]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: planning
---
# Infrastructure Planning

> **Purpose**: Produce the infrastructure plan for the WHOLE system (frontend AND backend) so that deployment, scaling, secrets, monitoring, and recovery are decided during planning, not improvised at ship time.
> **Output**: `AI_DOCS/infra/infra-plan.md`
> **Lifecycle**: Created once during Phase 0 planning (after the tech spec, before milestones). Updated via `change-request` whenever the stack, scale targets, or compliance change.

This skill closes a real gap: the framework historically captured only a single "deploy target?" answer. Hosting topology for the frontend, environment strategy, secrets management, CI/CD, monitoring, and disaster recovery went unplanned. `deployment-planning` and `deployment-execution` run at ship time and assume these decisions already exist. This skill makes them.

---

## When this runs

- Dispatched by `/do` Phase 0 for every non-POC project (`planning_depth: standard`).
- Skipped on the POC fast-path (`planning_depth: poc` in `stack.md`).
- Re-run by `change-request` when the stack, scale targets, or compliance regime changes.

## Inputs to read first

- `AI_DOCS/memory/stack.md` — frontend, backend, database, deploy target, compliance
- `AI_DOCS/planning/spec/12-performance.md` — scalability numbers and triggers (S12)
- `AI_DOCS/planning/spec/20-compliance-security.md` — controls that drive infra (encryption at rest, data residency, audit-log storage)
- `AI_DOCS/architecture/adrs/` — any deployment/scaling ADR

## Mandatory pre-generation questions (ask only if not already answered)

1. **Environments** — which environments do you need? (dev only / dev + prod / dev + staging + prod) *(dev + staging + prod recommended for anything beyond a POC)*
2. **Hosting** — confirm or refine the `stack.md` deploy target for frontend and backend separately (they may differ, e.g. Vercel frontend + Fly.io backend).
3. **Secrets** — where do secrets live? (platform env vars / Doppler / Vault / AWS Secrets Manager) *(platform env vars acceptable for small projects; managed store for compliance projects)*
4. **CI/CD** — do you want a CI/CD pipeline planned now? (yes / later) — if yes, this is a Category B operation: planning the YAML is fine, but creating `.github/workflows/` and pushing requires the user's approval per `ops-safety-rules.md`.

---

## Output format: `AI_DOCS/infra/infra-plan.md`

Generate exactly this structure. Mark any section `N/A (reason)` rather than leaving it blank (the Planning Completeness Gate checks presence).

```markdown
# Infrastructure Plan — [Project Name]

> Last Updated: [YYYY-MM-DD]  |  planning_depth: [standard]

## 1. Environment Strategy

| Environment | Purpose | Frontend URL | Backend URL | Database | Who can deploy |
|-------------|---------|--------------|-------------|----------|----------------|
| dev | local + integration | localhost | localhost | local/branch DB | any dev |
| staging | pre-prod validation | [url] | [url] | staging DB (prod-like) | any dev |
| prod | live | [url] | [url] | prod DB | release owner |

**Parity rules**: [how staging mirrors prod — same image tag, same migrations, seeded with prod-like data]

**Disposable test database (required for schema-validation):** the dev environment must be able to spin up a THROWAWAY DB of the same engine (a local container, or SQLite for simple stacks), created fresh and dropped each run, never a shared dev/staging/prod DB. The `schema-validation` skill uses it to run migrations `up -> down -> up` and diff the result against `database-schema.md` at milestone close. Document the one-liner to create/drop it (e.g. a `docker compose` test-db service or a `createdb <name>_test` step).

## 2. Hosting Topology

[Diagram or description showing frontend host → backend host → database → cache → queue → object store → third-party services. Use the `architecture` skill's system context diagram if one exists; this section adds the HOSTING placement of each box.]

| Component | Host / service | Region(s) | Notes |
|-----------|----------------|-----------|-------|
| Frontend | [Vercel / CF Pages / S3+CDN] | [region] | [CDN, edge] |
| Backend API | [Fly.io / Railway / ECS / Cloud Run] | [region] | [replicas] |
| Database | [Neon / RDS / managed PG] | [region] | [primary + read replicas] |
| Cache | [Valkey (default) / Upstash] | [region] | Valkey is the default: ~20% cheaper than Redis OSS, drop-in compatible (redis:// URLs unchanged). Redis OSS is an option only with written justification (Rule 5). [or N/A] |
| Queue / workers | [BullMQ / Celery / SQS] | [region] | [or N/A] |
| Object storage | [S3 / R2 / GCS] | [region] | [or N/A] |

## 3. Secrets & Config Management

- **Store**: [platform env vars / Doppler / Vault / AWS Secrets Manager]
- **Per-environment injection**: [how dev/staging/prod each get their values]
- **Rotation**: [policy + trigger]
- **What is NEVER committed**: confirm `.env.local` gitignored, `.env.example` (placeholders) committed
- **Config (non-secret)**: [where feature flags / tunables live]

## 4. CI/CD Pipeline Design

> Planning only. Creating `.github/workflows/` and pushing is a Category B operation requiring user approval (ops-safety-rules.md).
>
> **Created but inactive.** When the user approves creating the workflow files, generate them DISABLED (manual `workflow_dispatch` or environment-protection gate) and do not push to an auto-running branch. The deploy pipeline is activated only when the full scope is done (Gate 5) and the user authorizes go-live. After each milestone, `/do` asks whether to release that milestone now or wait for full scope: a per-milestone deploy happens only on explicit approval. See `deployment-planning`.

| Stage | Trigger | Steps | Gate |
|-------|---------|-------|------|
| CI | PR open/update | install, typecheck, test, build, secrets scan, dep audit | all green to merge |
| Deploy staging | merge to develop | build image (pinned tag), migrate (staging), deploy, smoke test | health check |
| Deploy prod | tag / manual | reuse SAME image tag, migrate (prod), deploy, smoke test | health check + manual approve |

**Migration policy**: ref `data-migration-rules.md` — idempotent, rollback tested on staging, expand/contract for large tables, same image tag for migrate and app.

## 5. Monitoring, Metrics & Alerting

| Signal | Tool | Alert threshold | Who is paged |
|--------|------|-----------------|--------------|
| Error rate | [Sentry] | [> X% 5xx over 5 min] | [on-call] |
| Latency p95 | [provider metrics] | [> target from S12] | [on-call] |
| Auth-failure rate | [logs] | [spike threshold] | [security] |
| Uptime | [healthcheck/Pingdom] | [down 2 consecutive] | [on-call] |

- **Logs**: [structured logger + aggregation destination]
- **Tracing**: [OpenTelemetry / vendor / N/A]
- **Dashboards**: [link or "to create"]
- **Production audit trail (REQUIRED for prod, Rule 6)**: CloudTrail (or provider equivalent) enabled at the account level, shipping to S3, retention >= 1 year. Mandatory alongside CloudWatch for production. If the user declines on cost, record the explicit override in `decision-log.md`.

## 6. Disaster Recovery

- **Backups**: [DB backup frequency + retention + tested restore date]
- **RTO** (recovery time objective): [target]
- **RPO** (recovery point objective): [target]
- **Rollback runbook**: [app rollback = redeploy previous tag; DB rollback = down migration; link to runbook]
- **Single points of failure**: [identified + mitigation, or accepted with reason]

## 7. Cost-at-Scale Estimate

| Component | At launch (monthly) | At 12-month scale (monthly) | Notes |
|-----------|--------------------|-----------------------------|-------|
| Frontend host | [$] | [$] | [free tier limits] |
| Backend host | [$] | [$] | [per replica] |
| Database | [$] | [$] | [storage + compute] |
| Other (cache/queue/storage/LLM) | [$] | [$] | [drivers] |
| **Total** | [$] | [$] | |
```

---

## Critical rules

- Plan frontend AND backend hosting explicitly. Do not let "Vercel" stand in for the whole system.
- Every secret has a home that is not the repo.
- Tie scalability numbers back to S12 — do not invent different targets here.
- Compliance-driven infra (encryption at rest, data residency, audit-log storage, BAA-eligible services) is pulled from S20 and `stack.md → compliance`.
- **Environment sizing follows infrastructure-rules Rule 4**: dev is minimal cost. Staging mirrors production topology (same services, engine versions, network shape, deploy pipeline). Instance size is the only permitted staging delta, parity is the default, and a size delta needs a logged `/infra-cost-guard` approval.
- **Cost sign-off**: before this plan is marked complete, run `/infra-cost-guard` on the Section 7 table. The plan is incomplete without an APPROVED entry in `AI_DOCS/memory/infra-cost-approvals.md` covering it, and without a billing alarm / budget alert row per environment (Rule 19).
- This skill PLANS. It never creates `.github/workflows/`, runs a deploy, or provisions cloud resources. Those are Category B operations owned by `deployment-planning` / `deployment-execution` with explicit user approval.

## Rules Integration

> - `.claude/rules/ops-safety-rules.md` — CI/CD and deployment are Category B (approval required)
> - `.claude/rules/infrastructure-rules.md` — Valkey-over-Redis default (Rule 5), production observability with CloudWatch + CloudTrail (Rule 6), environment matrix (Rule 4 staging parity), cost approval gate (Rules 3 + 19), scalability intake (Rule 18)
> - `.claude/rules/data-migration-rules.md` — migration policy in the CI/CD section
> - `.claude/rules/compliance/*.md` — encryption-at-rest, audit-log storage, data residency where compliance is set

## Gate Condition

Contributes to the **Planning Completeness Gate** (Gate 1) enforced by `gate-enforcement`: `AI_DOCS/infra/infra-plan.md` must exist with no blank section (sections may be `N/A (reason)`).

## Next Step

Proceed to [milestone-planning](../milestone-planning/SKILL.md) — milestones reference the infra plan for the setup/deploy-pipeline tasks.
