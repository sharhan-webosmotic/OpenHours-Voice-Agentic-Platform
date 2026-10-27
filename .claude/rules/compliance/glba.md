---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# GLBA — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `glba`. US Gramm-Leach-Bliley Act:
> applies to financial institutions handling consumers' nonpublic personal information
> (NPI). Two operative rules: the Safeguards Rule and the Privacy Rule.

## Safeguards Rule (information security program)
- [ ] A written information security program with a **designated qualified individual**
  accountable for it.
- [ ] **Risk assessment** of NPI processing, periodically updated.
- [ ] **Access controls**: least privilege on systems holding NPI; authenticate users.
- [ ] **Encryption** of NPI at rest and in transit (or a documented compensating control).
- [ ] **MFA** for any access to systems holding NPI.
- [ ] **Monitoring and logging** of access to NPI; change management.
- [ ] **Incident response** plan; **secure disposal** of NPI no longer needed.
- [ ] Oversight of **service providers** that handle NPI (contractual safeguards).

## Privacy Rule
- [ ] **Privacy notices** at the start of the relationship and annually thereafter,
  describing information-sharing practices.
- [ ] **Opt-out**: consumers can opt out of sharing NPI with nonaffiliated third parties.
- [ ] **Pretexting** protections: guard against social-engineering access to NPI.

## Verification (lean)
`/audit` checks:
- `docs/security-policy.md` exists and names a responsible individual → CONCERNS if missing.
- Encryption-at-rest + TLS config present for NPI stores → FAIL if NPI in plaintext.
- MFA referenced in the auth flow for privileged/NPI access → CONCERNS if absent.
- Audit logging on NPI access (see `audit-logs.md`) → FAIL if absent.
- A privacy notice + opt-out mechanism is present (`docs/privacy-policy.md`).
- Dependency scan + incident-response runbook present (shared with `soc2.md`).

<!-- Version: 1.0.0 — 2026-06-25 — initial GLBA lean checklist: Safeguards Rule (qualified individual, risk assessment, encryption, MFA, monitoring, IR, vendor oversight) + Privacy Rule (notices, opt-out, anti-pretexting) -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
