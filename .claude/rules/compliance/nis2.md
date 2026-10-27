---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# NIS2 — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `nis2`. EU Directive 2022/2555 on
> network and information security, for essential and important entities in critical
> sectors (energy, transport, health, digital infrastructure, etc.).

## Governance
- [ ] **Management accountability**: leadership approves and oversees the cybersecurity
  risk-management measures (personal liability under NIS2).
- [ ] **Registration** with the national competent authority where required.
- [ ] Entity classified as **essential** or **important** (drives oversight intensity).

## Risk-management measures (Art. 21)
- [ ] Risk analysis and information-system security policies.
- [ ] **Incident handling** (detection, response, recovery).
- [ ] **Business continuity**: backups, disaster recovery, crisis management.
- [ ] **Supply-chain security**: security of suppliers and service providers.
- [ ] Security in acquisition, development, and maintenance (vulnerability handling/disclosure).
- [ ] Policies to assess the effectiveness of measures.
- [ ] **Cyber hygiene** + training; cryptography and encryption policies.
- [ ] **MFA / continuous authentication**, secured communications.

## Incident reporting (Art. 23)
- [ ] **Early warning** to the CSIRT/authority within **24 hours** of a significant incident.
- [ ] **Incident notification** within **72 hours**.
- [ ] **Final report** within **1 month**.

## Verification (lean)
`/audit` checks:
- `docs/security-policy.md`, `docs/risk-register.md`, and an incident-response runbook
  with the 24h/72h/1-month timeline exist → CONCERNS if missing.
- Backup + tested DR plan present (shared with `infrastructure-rules.md` Rule 14).
- MFA referenced in auth; encryption at rest + TLS.
- Supply-chain: dependency scanning in CI; SBOM or pinned lockfile committed.
- Audit logging + monitoring/alerting configured (see `audit-logs.md`).

<!-- Version: 1.0.0 — 2026-06-25 — initial NIS2 lean checklist: management accountability + registration, Art.21 risk-management measures (incident handling, BC/DR, supply chain, crypto, MFA), Art.23 24h/72h/1-month reporting timeline -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
