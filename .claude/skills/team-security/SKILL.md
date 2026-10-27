---
name: team-security
skill_id: SK-099
context_budget:
  load_kb: 35
  scope: global
version: 1.2.0
description: "Orchestrate a parallel security review. Spawns security-auditor (OWASP Top 10 + secrets) + api-validator (contract drift + auth mismatches) + code-reviewer (XSS, injection, input validation) simultaneously. Use for pre-release security gates, after auth/payment changes, or after dependency updates."
allowed-tools: "Read Grep Glob Task"
budget_critical: true
compatibility: "Claude Code 1.x"
license: Proprietary
context: fork
outputs_to: AI_DOCS/memory/security-findings.md
metadata:
  author: WebOsmotic Private Limited
  category: orchestration
  patterns: [sequential, domain-specific]
  previous_id: SK-090
# SK-099 assigned in v3.1 to resolve 3-way SK-090 collision with orchestrator + task-planner.
---

# /team-security — Parallel Security Review

Run a comprehensive security review by spawning three specialized agents in parallel.

## When to Use

- Pre-release security gate (Gate 4 / Gate 5)
- After implementing auth, payment, or data-handling features
- After a dependency update (new packages may introduce vulnerabilities)
- Periodic security health check

> **Need depth, not breadth?** This is a one-pass review by three agents. For a coverage-tracked audit where every finding is proven from source and independently verified, use `deep-security-audit` (SK-169). Its committed `AI_DOCS/audit/security-summary.md` feeds `/audit` check 13. The two run side by side: this review for the quick release gate, the deep audit when a merge, an auth or payment feature, a milestone close or the first production release triggers its offer.

## Process

### Step 1 — Parallel Security Sweep

Spawn all three in **parallel** (issue all Agent calls before waiting for any):

**Agent 1 — security-auditor**:
- Full OWASP Top 10 scan
- Hardcoded secrets check
- Auth implementation review
- `npm audit` / dependency vulnerabilities

**Agent 2 — api-validator**:
- API contract drift check
- Auth requirement mismatches (contract says auth required, no guard found)
- Orphan endpoints (backend routes not in contract)

**Agent 3 — code-reviewer** (security focus):
- Input validation gaps
- XSS vulnerabilities
- SQL/NoSQL injection risks
- Error messages leaking internals

### Step 2 — Consolidate Findings

Merge all findings. Deduplicate. Categorize:
- CRITICAL: Must fix before any deployment
- HIGH: Must fix before production (staging OK)
- MEDIUM: Fix in next sprint
- LOW: Track as tech debt

### Step 3 — Verdict

If any CRITICAL findings: **FAIL — block deployment**
If HIGH findings only: **CONCERNS — fix before production**
If MEDIUM/LOW only: **PASS with advisory items**

Write findings summary to `AI_DOCS/memory/security-findings.md`.

### Step 4 — After Findings Protocol

| Severity | Action Required | Timeline |
|----------|----------------|---------|
| CRITICAL | BLOCK all PRs and deployment. Fix immediately. No exceptions. | Before any next deploy |
| HIGH | Create tracking issue. Fix before next release to production. | Next sprint |
| MEDIUM | Add to security backlog. Plan for next 2 sprints. | Within 2 sprints |
| LOW | Document as known tech debt. Review quarterly. | Quarterly |

### Step 5 — Retest After Fixes

After fixing CRITICAL or HIGH findings:
1. Re-run `/team-security` to confirm resolution
2. Do NOT self-certify — the agents must re-verify
3. Update `AI_DOCS/memory/security-findings.md` with "RESOLVED: [date]" notation

## Output Format

```
## /team-security Report — [date]

### Overall Verdict: [PASS / CONCERNS / FAIL]

### OWASP Scan (security-auditor)
- [findings or CLEAN]

### API Contract Drift (api-validator)
- [mismatches or IN SYNC]

### Code Security Review (code-reviewer)
- [findings or CLEAN]

### Consolidated Findings
| Severity | Count | Must Fix By |
|----------|-------|-------------|
| CRITICAL | N | Before any deployment |
| HIGH | N | Before production |
| MEDIUM | N | Next sprint |
| LOW | N | Tech debt backlog |

### Next Steps
- [specific files and fixes required]
```

<!-- Version: 1.2.0 | 2026-10-22 | points to deep-security-audit (SK-169) for coverage-tracked, independently verified audits -->
