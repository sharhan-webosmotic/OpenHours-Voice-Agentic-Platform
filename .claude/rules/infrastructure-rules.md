---
paths:
  - "infrastructure/**"
  - "**/*.tf"
  - "**/cloudformation/**"
---

# Infrastructure Rules

> Canonical ruleset for ALL cloud-infrastructure work (Terraform, provisioning scripts, deployment planning).
> Loaded by: `/deployment-planning`, `/deployment-execution`, `/architecture`, `/infra-cost-guard`, and `/do` whenever a task touches `infrastructure/**` or proposes cloud resources.
> Derived from the working `infrastructure/` setup (dev + production, eu-west-2) and project owner directives (2026-06-04).

---

## Rule 1: Environment First (BLOCKING)

Before ANY infra planning, provisioning, or script generation, ask:

> **"Which environment are you deploying? dev / stage / production"**

Never assume. Every downstream choice (instance sizes, HA, observability, key types, deletion protection) derives from the answer. One environment = one Terraform root directory with its own state backend (`infrastructure/<env>/`).

## Rule 2: Region + Cost Are Mandatory in Every Proposal (BLOCKING)

Every infra recommendation MUST state:

- **Region** (this project: `eu-west-2` London — any deviation needs explicit justification: latency, compliance, or cost)
- **Estimated monthly cost per resource** AND a **total monthly cost**, in a table

A proposal without a cost table and region is incomplete — do not present it.

```markdown
| Resource | Type/Size | Est. cost/month |
|---|---|---|
| EC2 | t3.micro | ~$8.50 |
| RDS PostgreSQL | db.t3.micro, single-AZ | ~$15 |
| ElastiCache Valkey | cache.t3.micro | ~$12 |
| **Total** | | **~$35/month** |
```

## Rule 3: Cost Approval Gate — Anything > $1/month (BLOCKING)

Any single resource estimated to cost **more than $1/month** requires an itemized cost disclosure + explicit user approval BEFORE it is provisioned or added to a Terraform plan. Use the ops-safety warning format (`ops-safety-rules.md`). Group the disclosure per `terraform apply` — list every >$1 resource in the plan, get one approval for the batch.

**Enforcement (not just prose):** the disclosure and approval are produced by the `/infra-cost-guard` skill (SK-146) and recorded as an `APPROVED` line in `AI_DOCS/memory/infra-cost-approvals.md`. The `hooks/infra-cost-gate.sh` PreToolUse hook blocks terraform/tofu/pulumi/cdk/CloudFormation/cloud-CLI provisioning commands when no same-day APPROVED entry exists. Full mechanics: Rule 19.

## Rule 4: Per-Environment Optimization Matrix

Two principles, in tension by design:

- **Dev is minimal cost.** Smallest viable everything. Dev exists to develop, not to mirror production.
- **Staging is production parity.** Staging exists to catch production problems before production. It mirrors production **topology exactly**: same services, same engine versions, same network shape (NAT/subnets/multi-AZ posture), same deploy pipeline, same migration path. Instance SIZE is the only permitted delta, parity is the default, and choosing one size down requires an explicit `/infra-cost-guard` approval logged in the ledger. A staging shortcut that changes topology (different DB engine, skipped queue, no cache, single-AZ when production is multi-AZ) is a defect, not an optimization.

| Concern | dev | stage | production |
|---|---|---|---|
| Instance sizes | smallest viable (t3.micro / db.t3.micro / cache.t3.micro) | production parity by default; one size down ONLY with explicit logged `/infra-cost-guard` approval | sized to load; scale path documented |
| Availability | single-AZ, 1 instance | mirror production (multi-AZ iff production is multi-AZ) | multi-AZ optional — present cost delta, user decides |
| NAT gateway | avoid if possible (public subnet + SG), else single | mirror production topology | single for MVP; per-AZ when HA |
| deletion_protection | `false` | `false` | `true` (RDS + ALB) |
| Stripe/API keys | test keys ONLY (`sk_test_`) | test keys | live keys |
| SES | sandbox | sandbox | production access requested |
| Backups | minimal (1-day retention) | 7-day | ≥7-day + restore tested |
| Observability | basic logs | CloudWatch logs + the production alarm set (thresholds may be relaxed) | **CloudWatch + CloudTrail mandatory (Rule 6)** |
| Billing alarm (Rule 19) | budget alert | budget alert | budget alert + billing alarm |

Present the staging cost consequence explicitly when the plan is proposed: parity staging costs roughly what production costs. The user decides with the number in front of them, never discovers it on the invoice.

Document the scale-up path (the "3 lines to change") in the environment README.

## Rule 5: Valkey over Redis (DEFAULT)

ElastiCache engine = **Valkey** (~20% cheaper than Redis OSS, drop-in compatible — `redis://` URLs unchanged). Choosing Redis OSS instead requires written justification in an ADR. Apply the same cheapest-equivalent thinking everywhere: gp3 over gp2, t3/t4g burstable instances, `PAY_PER_REQUEST` DynamoDB, S3 lifecycle policies, single NAT for MVP. Surface every tradeoff to the user; never silently pick the expensive option.

## Rule 6: Production Observability Is Mandatory (BLOCKING for production)

A production plan is INCOMPLETE without:

- **CloudWatch**: log shipping from the app host (agent or awslogs driver), key metric alarms (CPU, memory, disk, 5xx rate, health-check failures)
- **CloudTrail**: account-level audit trail enabled, logging to an S3 bucket
- Log retention declared (≥30 days app logs; CloudTrail ≥1 year)

If the user declines (cost), record the explicit override in `AI_DOCS/memory/decision-log.md`.

> **Known gap (tracked):** the current EC2-based dev/production stacks have neither CloudWatch agent nor CloudTrail — only the unused ECS module has a log group. Any next infra iteration must close this for production.

## Rule 7: Mandatory Items Confirmed Per Environment (BLOCKING)

Before generating a plan or runbook, present the mandatory checklist WITH a suggested approach per item, and get user confirmation:

1. Environment (Rule 1)
2. Region + total cost (Rule 2)
3. Cache engine (Valkey — Rule 5)
4. Observability (Rule 6 — mandatory for production)
5. Backups + retention
6. Secrets management (AWS Secrets Manager path, e.g. `mabel/<env>/*`)
7. SSL/TLS + DNS plan
8. Deletion protection + teardown procedure
9. Troubleshooting needs (Rule 13 — live incidents, past events, or both?)
10. Disaster recovery — RTO/RPO targets (Rule 14)
11. Compliance regime (Rule 15 — drives must-have items)
12. Codebase revalidation if compliance declared (Rule 16)
13. Infra cost approval (Rule 19 — `/infra-cost-guard` run, APPROVED ledger entry, billing alarm in plan)

Format: item → suggested approach → cost impact → user confirms/overrides. Log overrides in `decision-log.md`.

## Rule 8: Script Idempotency + Resume (BLOCKING)

Every infra script MUST be safe to re-run after a partial failure and must NEVER duplicate an environment:

- **Check-before-create** on every resource (`secret_exists`, `head-bucket`, `describe-table`, `get-user` — the patterns in `bootstrap.sh`)
- **Persist generated values** to a gitignored state file (`.generated-secrets.env`) and re-use them on re-run — never regenerate passwords/secrets that are already live
- On re-run, **report state**: what already exists (skipped), what was just created, what is still pending
- Terraform is the source of truth for TF-managed resources: remote state (S3) + lock (DynamoDB), separate state per environment, never two roots writing one state

## Rule 9: Sequence Transparency (script UX contract)

Every infra script must, IN THIS ORDER:

1. **Open with the full sequence** — numbered list of every step it will perform and which need user input
2. **List required inputs upfront** (which secrets/values the user must have ready) before doing any work
3. **Confirm account + region + estimated cost** with a typed confirmation before the first mutating call
4. **Show progress** step by step (`section`/`ok`/`warn` pattern)
5. **End with "what was done / what's next"** — explicit next-step commands and pending manual actions

## Rule 10: Automate Maximally, Inform Always

Automate everything that can be automated — but the user must be aware of every mutating action. Steps that cannot be automated (console clicks, third-party dashboards, DNS at the registrar) live in a **"Manual Steps — Human Action Required"** table in the README with their automation potential (see `infrastructure/README.md` for the canonical format). Never bury a manual step in prose.

## Rule 11: Documentation Always Current (BLOCKING)

Any infra change updates, in the SAME change set:

- `infrastructure/README.md` (architecture diagram, cost figures, outputs)
- `infrastructure/<env>/SETUP.md` or the environment runbook
- `AI_DOCS/deployment/` runbook/steps doc for the environment
- Secret tables when secrets are added/removed (count + names)

Stale cost figures or secret counts in docs = a defect, same severity as broken code.

## Rule 12: Destroy Protection

- Teardown requires **double typed confirmation** (`destroy <env>` then `yes, destroy everything`) and shows the destroy plan in between
- Production keeps `deletion_protection = true`; the destroy script documents the exact console/CLI steps to lift it
- Never script a force-destroy path that bypasses the confirmations

## Rule 13: Troubleshootability — Live Runs AND Past Events (BLOCKING question)

Infra must be easy to debug both **while a script/deploy is running** and **after the fact**. During intake, ALWAYS ask:

> **"What do you need to troubleshoot — live incidents as they happen, past events (forensics/audit), or both?"**

Then provision accordingly:

| Need | Suggested approach | Cost impact |
|---|---|---|
| **During-run** (script failures) | Every script tees output to a timestamped log file (`logs/<script>-YYYYMMDD-HHMMSS.log`); each step prints `section`/`ok`/`fail` markers; failures show the exact failed command + recovery step (never bare exit) | $0 |
| **Live incidents** (app/infra down) | CloudWatch agent (logs + metrics), health-check alarms, `journalctl -u mabel-api` access documented, SSH runbook | ~$3–10/mo |
| **Past events** (who did what, when) | CloudTrail (≥1 yr retention), CloudWatch Logs retention ≥30 days, structured app logs with request/correlation IDs, deployment logs kept in `AI_DOCS/deployment/DEPLOYMENT_LOG_*.md` | ~$1–5/mo |

Every runbook step must carry an **"If it fails"** entry with a concrete diagnostic command — "check the logs" is not acceptable; name the log and the grep.

## Rule 14: Disaster Recovery (BLOCKING for production)

A production plan is INCOMPLETE without a DR section. During intake, ask the user for targets and suggest defaults:

> **"What RTO (max acceptable downtime) and RPO (max acceptable data loss) do you need?"** — suggested MVP default: RTO ≤ 4h, RPO ≤ 24h.

Required per environment:

| Item | dev | stage | production |
|---|---|---|---|
| RDS automated backups | 1 day | 7 days | ≥7 days + **restore actually tested** (not assumed) |
| Manual snapshot before risky change | optional | yes | MANDATORY (migrations, upgrades, destroys) |
| Valkey persistence | none | none | AOF/snapshot if cache loss hurts (else document "cache is rebuildable") |
| Infra rebuild path | `terraform apply` from clean state | same | same — Terraform IS the DR plan for stateless infra; verify state bucket versioning is on |
| Secrets recovery | `.generated-secrets.env` + Secrets Manager | same | Secrets Manager is the source of truth; document recovery order |
| DR runbook | — | — | `AI_DOCS/deployment/DR_RUNBOOK.md`: scenario → steps → owner → last tested date |

Multi-AZ / cross-region replicas are OPTIONAL cost upgrades — present the cost delta (Rule 2/3), user decides. An untested backup is treated as no backup.

## Rule 15: Compliance-Driven Infra (BLOCKING question)

During intake, ALWAYS ask:

> **"Which compliance regime applies? gdpr / hipaa / soc2 / pci / none"**

Based on the answer, present the split — **must-have** items (non-negotiable for that regime) vs **optional** items (recommended, user decides):

| Regime | MUST-have infra | Optional |
|---|---|---|
| **none** | Secrets in Secrets Manager, TLS, encrypted state bucket | everything else |
| **gdpr** | EU region (eu-west-2 ✓), encryption at rest (RDS/S3/EBS), data-export + delete endpoints reachable, retention policy configured, CloudTrail | cross-region DR (must stay EU), DPO tooling |
| **soc2** | CloudTrail ≥1 yr immutable, CloudWatch alerting (error/auth-failure rates), MFA on AWS access, tested backups, audit logs separate from app data | APM, anomaly detection |
| **hipaa** | BAA-eligible services only, encryption at rest+transit (TLS 1.2+), audit logs 6 yr, ≤15 min idle session, no PHI on dev machines | dedicated tenancy |
| **pci** | Network segmentation, no card data at rest (use Stripe tokens ✓), quarterly scans, WAF | dedicated subnets per tier |

Checklists live in `.claude/rules/compliance/{gdpr,ccpa,hipaa,pci-dss,soc2,owasp,audit-logs,secrets}.md`, indexed by `.claude/rules/compliance/README.md` (which also maps first-principles regimes such as UK-GDPR, ISO 27001, LGPD, FedRAMP, COPPA, GLBA to their source + sibling checklist) — load the matching one and map each unchecked item to an infra resource or an explicit user override.

## Rule 16: Compliance → Codebase Revalidation (BLOCKING)

Whenever a compliance regime is **declared or changed** during infra planning, the infra plan alone is NOT enough — ask the user:

> **"Compliance `<regime>` affects the codebase too, not just infra. Run a codebase revalidation (`/audit` with the `<regime>` checklist) before we sign off the infra plan? [recommended: yes]"**

If yes → run the audit and attach the verdict to the infra plan. If no → log the explicit skip in `decision-log.md` with the user's phrase. Infra sign-off for a compliance project with no codebase audit on record = CONCERNS in the next `/audit` run.

## Rule 17: Informed Questions — Every Infra Question Carries Context (FORMAT contract)

Never ask a bare infra question. EVERY intake/confirmation question must include, inline:

1. **What the options are and how they differ** (1 line per option)
2. **Cost impact of each option** ($/month, or $0)
3. **A recommendation with a one-line why**

Format:

```
? Multi-AZ for RDS?
  - single-AZ: one DB instance; ~2-5 min downtime on AZ failure — ~$15/mo
  - multi-AZ: hot standby, automatic failover <60s — ~$30/mo (2× cost)
  Recommended: single-AZ for MVP (downtime tolerance is hours, not seconds) — upgrade is one line later.
```

A question without differences + cost + recommendation is a defect. This applies to skill intake questions AND interactive script prompts (`ask` helper output).

## Rule 18: Scalability Intake — Size from Expected Load, Not Guesses (BLOCKING)

Before planning ANY infra, ask capacity questions and size the proposal from the answers (Rule 17 format — with differences, cost impact, recommendation):

1. **"How many active users do you expect at launch?"** (concurrent + daily)
2. **"What user base do you expect at 6 months? At 1 year?"**
3. **"What's the expected traffic shape?"** — steady / business-hours peaks / spiky events (vending: lunch rushes)
4. **"Any known heavy operations?"** — image uploads, exports, cron syncs, webhooks bursts

Then:

- **Size for launch + ~2× headroom, not for year-1.** Present the year-1 target as a documented **scale-up path** (the "3 lines to change" — instance class, desired_count, node_type) with its cost at each step, NOT as day-one spend.
- Show a small growth table in every infra plan:

```markdown
| Stage | Users (DAU / concurrent) | Config | Est. cost/month |
|---|---|---|---|
| Launch | 500 / 50 | t3.micro, db.t3.micro, single-AZ | ~$35 |
| 6 months | 5k / 300 | t3.small, db.t3.small | ~$70 |
| 1 year | 20k / 1k | t3.medium ×2, db.t3.medium multi-AZ | ~$185 |
```

- If the user doesn't know, propose conservative defaults from the project's workscope and log them as assumptions in `decision-log.md` — assumptions are revisited at each milestone.
- Never let cost optimization (Rule 5) break the declared scale path — the cheapest option must still reach the 6-month target via config change, not re-architecture.

## Rule 19: Infra Cost Guard (BLOCKING)

The infra sibling of `/ai-cost-guard`. Every change that provisions or resizes cloud resources runs `/infra-cost-guard` (SK-146) BEFORE the provisioning command:

1. **Estimate**: per-resource + total monthly cost table, delta vs current approved spend, growth table for production (Rules 2 and 18).
2. **Flag risks**: per-AZ NAT, multi-AZ outside production parity, oversized instances, unbounded autoscaling, per-request pricing without caps, missing billing alarm, idle dev resources.
3. **Approve in writing**: the user answers yes / no / modify. The outcome is appended to `AI_DOCS/memory/infra-cost-approvals.md` as a dated `APPROVED` / `DECLINED` / `MODIFIED` line.
4. **Hook enforcement**: `hooks/infra-cost-gate.sh` (PreToolUse on Bash) blocks `terraform|tofu apply|destroy`, `pulumi up`, `cdk deploy`, CloudFormation stack mutations, and direct `aws`/`gcloud`/`az` instance/db/cluster creation unless the ledger has an `APPROVED` entry dated today (UTC). Emergency escape `ADF_INFRA_APPROVED=on` MUST be logged in `decision-log.md` with the user's exact phrase.
5. **Billing alarm mandatory in every environment plan**: an AWS Budgets monthly alert (or provider equivalent) at 120% of the approved total. Production additionally gets a billing alarm with notification. A plan without one is incomplete.
6. **Re-approval triggers**: any new >$1/month resource, projected total drifting >20% above the last approved figure, environment promotion, or region change.

`/deployment-planning` re-verifies the cost table against the ledger before generating a runbook. A runbook whose cost does not match an APPROVED entry is incomplete.

---

## Verification (what /audit checks for infra changes)

- `terraform validate` passes in every touched root
- `bash -n` passes on every touched script
- Cost table present in the proposal/runbook for any new resource
- For production plans: CloudWatch + CloudTrail present or explicit logged override
- For production plans: DR section with RTO/RPO + backup restore evidence (Rule 14)
- Compliance regime asked + must-have items mapped (Rule 15); codebase audit on record or logged skip (Rule 16)
- README/SETUP docs updated in the same diff
- `AI_DOCS/memory/infra-cost-approvals.md` has an APPROVED entry covering the current plan (Rule 19)
- Billing alarm / budget alert present in every environment plan (Rule 19)
- Staging topology matches production (Rule 4 parity); any size delta has a logged approval

<!-- Version: 1.4.1 — 2026-06-25 — Rule 15 compliance-checklist enumeration extended (ccpa, pci-dss added; index README.md referenced for first-principles regimes) -->
<!-- Version: 1.4.0 — 2026-06-12 — Rule 4 staging rewritten to production parity (topology mirror, size-only delta with logged approval, parity default); added Rule 19: infra cost guard (skill SK-146 + infra-cost-approvals.md ledger + infra-cost-gate.sh hook + mandatory billing alarms + re-approval triggers); Rule 3 wired to the skill/ledger/hook; Rule 7 checklist gains item 13; /audit verification extended -->
<!-- Version: 1.3.0 — 2026-06-04 — added Rule 18: scalability intake (launch/6mo/1yr user expectations, traffic shape, growth table, size for launch+2x with documented scale path) -->
<!-- Version: 1.2.0 — 2026-06-04 — added Rule 17: informed-questions format contract (every infra question states option differences + cost impact + recommendation) -->
<!-- Version: 1.1.0 — 2026-06-04 — added Rules 13–16: troubleshootability intake (live/past/both), disaster recovery (RTO/RPO + tested restore), compliance-driven must-have vs optional matrix, compliance → codebase revalidation gate -->
<!-- Version: 1.0.0 — 2026-06-04 — initial: codified from working infrastructure/ + owner directives (env-first, cost+region mandatory, >$1/mo approval, Valkey default, prod observability, idempotent scripts, sequence transparency, docs-current) -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
