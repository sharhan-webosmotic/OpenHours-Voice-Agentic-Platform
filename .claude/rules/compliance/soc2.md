---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# SOC 2 — Trust Services Criteria (checklist)

> Loaded by `/audit` when `compliance:` includes `soc2`. Maps to the five criteria. Lean version: enforces what's testable in code/config.

## CC1–CC2 — Control environment, communication
- [ ] Security policy + acceptable use policy documented in repo (`docs/security-policy.md`).
- [ ] On/off-boarding checklist for accounts and access.
- [ ] Change management: PRs reviewed by ≥1 person, CI required to merge.

## CC3–CC4 — Risk assessment & monitoring
- [ ] Risk register exists (`docs/risk-register.md`).
- [ ] Vulnerability management: dependency scanning (`pnpm audit`/`pip-audit`) in CI; track findings.
- [ ] Production monitoring: error rate, latency, auth-failure rate alerting configured.

## CC5–CC9 — Control activities, logical access, system operations, change management, risk mitigation
- [ ] MFA enforced for production access.
- [ ] SSH keys / API tokens rotated annually or on departure.
- [ ] Backups tested at least quarterly.
- [ ] Disaster recovery plan documented; RTO and RPO declared.
- [ ] Incident response runbook tested.
- [ ] Audit logs retained ≥ 1 year, immutable.
- [ ] Encryption at rest for production data.
- [ ] Encryption in transit (TLS 1.2+).
- [ ] Vendors with access to customer data: list + reviews + SOC 2 reports collected.

## Availability (A1) — if Availability is in scope
- [ ] Capacity monitoring + scaling plan.
- [ ] Backup strategy + tested restore.
- [ ] Multi-AZ / multi-region as declared.

## Confidentiality (C1)
- [ ] Data classification policy.
- [ ] Customer data segregation (tenants isolated).
- [ ] Access logs to confidential data.

## Processing integrity (PI1)
- [ ] Input validation at every trust boundary.
- [ ] Reconciliation: payment / financial flows have a reconciliation step.

## Privacy (P1) — if Privacy is in scope
- [ ] Privacy policy published and current.
- [ ] Subject access requests have a documented process.

## Verification (lean)
`/audit` checks:
- `docs/security-policy.md`, `docs/risk-register.md` exist (CONCERNS if missing).
- CI config requires PR review.
- TLS only.
- Audit logs configured (see `audit-logs.md`).
- Dependency scan in CI.
- MFA referenced in admin auth flow code (CONCERNS if absent).
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
