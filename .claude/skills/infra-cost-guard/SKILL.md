---
name: infra-cost-guard
skill_id: SK-146
context_budget:
  load_kb: 30
  scope: task
version: 1.0.0
description: "Infrastructure cost estimation, risk analysis, and written approval gate before any cloud resource is provisioned, resized, or added to a Terraform plan. Calculates per-resource and total monthly cost, flags high-risk patterns (per-AZ NAT, multi-AZ outside production parity, oversized instances, unbounded autoscaling, missing billing alarms), recommends cheaper equivalents, and requires written user approval. Use before terraform apply, any provisioning script, or any deployment plan that adds cloud resources."
allowed-tools: Read Grep Glob Write
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: []
  optional: [infra-planning, deployment-planning, ask]
metadata:
  author: WebOsmotic Private Limited
  category: utility
---

# /infra-cost-guard — Infra Cost Estimation & Approval Gate

The infrastructure sibling of `/ai-cost-guard`. Before any cloud resource is provisioned, this skill estimates monthly cost, flags risks, gets written approval, and records it in a ledger the `infra-cost-gate` hook enforces.

## When to Run This Skill

Run BEFORE:
- Any `terraform apply` / `terraform destroy` (or tofu/pulumi/cdk equivalent)
- Any provisioning script that creates cloud resources (EC2, RDS, ElastiCache, S3 with replication, load balancers, NAT gateways, clusters)
- Adding or resizing any resource in a Terraform plan or infra proposal
- `/infra-planning` sign-off and `/deployment-planning` runbook finalization for a new environment
- Promoting an environment (dev → stage → production)

`/do` arms this skill in the Activation Map as BLOCKING whenever a task touches `infrastructure/**` or proposes cloud resources. /build must not run the provisioning step until this skill has produced an APPROVED ledger entry.

## Step 1: Inventory the Proposed Change

Read the Terraform diff, plan output, or infra proposal. Extract:
- Which environment? (dev / stage / production: never assume, see infrastructure-rules Rule 1)
- Which region? (deviation from the project default needs justification, Rule 2)
- Every NEW resource with type and size
- Every RESIZED resource with old size → new size
- Every resource being DESTROYED (cost savings count too)
- Recurring per-usage costs: data egress, NAT processing, per-request pricing, storage growth

## Step 2: Cost Estimation

Build the Rule 2 table. Verify pricing online (AWS/GCP/Azure pricing pages or calculator) when the total exceeds $50/month or the service is unfamiliar. Never quote prices from memory for the final approval table.

```markdown
| Resource | Type/Size | Change | Est. cost/month |
|---|---|---|---|
| EC2 | t3.micro | new | ~$8.50 |
| RDS PostgreSQL | db.t3.micro, single-AZ | new | ~$15 |
| NAT gateway | single | new | ~$35 + data processing |
| **Total** | | | **~$58.50/month** |
| **Delta vs current approved spend** | | | **+$58.50/month** |
```

For production plans, include the Rule 18 growth table (launch / 6 months / 1 year) so the user approves the trajectory, not just day one.

## Step 3: Risk Flag Analysis

Flag each of these if present:

| Risk | Pattern | Severity |
|------|---------|---------|
| Per-AZ NAT gateways outside HA production | 2-3 NAT gateways in dev/stage or non-HA prod (~$35/mo each + processing) | CRITICAL |
| Multi-AZ outside production parity | Multi-AZ RDS/cache in dev, or in stage when production is single-AZ | HIGH |
| Oversized instances | Instance class above the Rule 18 launch sizing without load evidence | HIGH |
| Unbounded autoscaling | Autoscaling group or serverless with no max capacity / no spend cap | CRITICAL |
| Per-request pricing without caps | On-demand DynamoDB, Lambda, API Gateway with no budget alarm | HIGH |
| Cross-region traffic | Replication or backups crossing regions (egress charges) without a DR requirement | HIGH |
| Premium managed tiers | Aurora vs RDS, dedicated vs serverless, provisioned IOPS without a measured need | MEDIUM |
| No billing alarm in the plan | Plan provisions resources but no AWS Budgets / billing alarm resource | HIGH |
| No teardown path | Resource without a documented destroy procedure (Rule 12) | MEDIUM |
| Idle-capable dev resources | Dev instances running 24/7 with no scheduled stop | MEDIUM |

## Step 4: Cost Optimization Recommendations

Always check these before presenting the approval request (infrastructure-rules Rule 5):

1. **Valkey over Redis OSS** for ElastiCache (~20% cheaper, drop-in)
2. **gp3 over gp2**, **t3/t4g burstable** over fixed-performance instances
3. **Single NAT or none** (public subnet + security groups) outside HA production
4. **S3 lifecycle policies** for logs and backups
5. **Scheduled stop/start** for dev instances (nights + weekends saves ~65%)
6. **Spot/preemptible** for non-production batch or CI workers
7. **Right-size from Rule 18 intake**: launch + 2x headroom, not the year-1 target
8. **Reserved/savings plans** only AFTER one month of stable production usage, never day one

Per Rule 4: dev is the smallest viable configuration. Staging mirrors production topology exactly (same services, same engine versions, same network shape) with instance size as the only permitted delta, and parity is the default. Surface every tradeoff. Never silently pick the expensive option.

## Step 5: Written Approval Required (BLOCKING)

Present this request and WAIT for a written answer. Do not run or generate the provisioning command before approval.

```markdown
## Infra Cost Approval Required

### Change: [one-line summary]
### Environment: [dev | stage | production]   Region: [region]
### Cost:
[the Step 2 table, including total and delta]

### Risk Flags: [list or NONE]
### Optimizations applied: [list]
### Optimizations declined (with reason): [list or NONE]
### Billing alarm in plan: [yes: details | NO (must justify)]

**Do you approve this provisioning? (yes / no / modify)**
```

On approval, append one line to `AI_DOCS/memory/infra-cost-approvals.md` (create the file with a `# Infra Cost Approvals` heading if missing):

```
[YYYY-MM-DD] <env> <change summary> — APPROVED by user — Est. $<total>/month (delta +$<X>) — <N> resources — plan: <terraform root or doc ref>
```

The date MUST be today's UTC date in `[YYYY-MM-DD]` form and the word `APPROVED` must appear on the line. The `infra-cost-gate` hook greps for exactly this. A declined or modified outcome is also logged, with `DECLINED` or `MODIFIED` instead.

## Step 6: Post-Approval Requirements

1. **Billing alarm is part of the plan, every environment**: an AWS Budgets monthly alert (or provider equivalent) at 120% of the approved total. Production additionally gets a billing alarm with notification. A plan without one is incomplete.
2. **Approval freshness**: the hook requires an APPROVED entry dated the same UTC day as the provisioning command. Applying on a later day means re-presenting the table (it takes one message) and appending a fresh entry.
3. **Re-approval triggers** (run this skill again when any occurs):
   - Any new resource estimated above $1/month (Rule 3)
   - Projected total drifts more than 20% above the last approved figure
   - Environment promotion (dev → stage → production)
   - Region change
4. **Record overrides**: if the user bypasses the gate with `ADF_INFRA_APPROVED=on`, append the override and their exact phrase to `AI_DOCS/memory/decision-log.md`.

## Hook Enforcement

`hooks/infra-cost-gate.sh` (PreToolUse on Bash) blocks `terraform|tofu apply|destroy`, `pulumi up|destroy`, `cdk deploy|destroy`, CloudFormation stack mutations, and direct instance/database/cluster creation via `aws`/`gcloud`/`az` unless `AI_DOCS/memory/infra-cost-approvals.md` contains an `APPROVED` entry dated today (UTC). Escape hatch for emergencies: `ADF_INFRA_APPROVED=on`, which MUST be logged in `decision-log.md`. Non-ADF projects (no `AI_DOCS/`) pass through untouched.

## Boundaries

- Estimates and approves. Does NOT run terraform, does NOT edit infra code, does NOT create the billing alarm itself (it verifies the plan contains one).
- One approval covers one batch (one `terraform apply`). Group all >$1/month resources of the plan into a single disclosure (Rule 3).
- Cost figures are estimates. The ledger records what the user approved, not a billing guarantee. The billing alarm is the runtime safety net.

## Verification (of /infra-cost-guard itself)

- Every run ends with either an APPROVED/DECLINED/MODIFIED ledger line or an explicit user stop.
- The approval table always contains: per-resource rows, a total, a delta, the environment, and the region.
- After approval, `terraform apply` passes the hook on the same UTC day without manual intervention.
