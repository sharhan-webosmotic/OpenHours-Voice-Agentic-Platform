---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# FedRAMP / NIST 800-53 — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `fedramp` or `nist-800-53`. US federal
> cloud authorization, built on NIST SP 800-53 control baselines. This is a heavyweight,
> assessor-driven regime: the checklist below is the code/config-testable subset; full
> authorization requires a 3PAO and an agency ATO.

## Authorization artifacts
- [ ] **Impact level** chosen (Low / Moderate / High) and the matching baseline applied.
- [ ] **System Security Plan (SSP)** documenting the system boundary and control
  implementation.
- [ ] **POA&M** (Plan of Action & Milestones) tracking open findings.
- [ ] **Continuous monitoring** plan (vulnerability scanning cadence, reporting).

## Technical controls (NIST 800-53 families, testable subset)
- [ ] **AC** Access Control: least privilege, RBAC, session lock/expiry.
- [ ] **IA** Identification & Authentication: **MFA** (PIV/phishing-resistant for High),
  unique IDs, no shared accounts.
- [ ] **SC** System & Communications Protection: **FIPS 140-validated cryptography**, TLS
  1.2+, boundary protection.
- [ ] **AU** Audit & Accountability: comprehensive audit logging, tamper protection,
  retention.
- [ ] **SI** System & Information Integrity: flaw remediation (patching SLAs), malware
  protection, monitoring.
- [ ] **CM** Configuration Management: hardened baselines, change control.
- [ ] **CP** Contingency Planning: backups, tested DR, RTO/RPO.

## Verification (lean)
`/audit` checks:
- SSP / control matrix and POA&M documents exist → CONCERNS if missing.
- MFA referenced in auth; FIPS-validated crypto libraries used (not custom crypto) → FAIL
  if `Math.random`/non-validated crypto is used for security values.
- TLS only; audit logging configured + retained (see `audit-logs.md`).
- Dependency/vulnerability scanning in CI with a remediation SLA documented.
- Backup + tested DR plan present (shared with `infrastructure-rules.md` Rule 14).

<!-- Version: 1.0.0 — 2026-06-25 — initial FedRAMP / NIST 800-53 lean checklist: impact baseline + SSP + POA&M + continuous monitoring; AC/IA/SC/AU/SI/CM/CP technical control subset; FIPS crypto + MFA emphasis -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
