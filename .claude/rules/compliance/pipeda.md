---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# PIPEDA — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `pipeda`. Canada's Personal Information
> Protection and Electronic Documents Act. Built on 10 fair information principles.
> Quebec's Law 25 is stricter: flag it separately if users are in Quebec.

## The 10 fair information principles
- [ ] **Accountability**: a designated privacy officer is responsible for compliance.
- [ ] **Identifying purposes**: the purpose is identified at or before collection.
- [ ] **Consent**: meaningful consent for collection, use, and disclosure.
- [ ] **Limiting collection**: collect only what is necessary for the stated purpose.
- [ ] **Limiting use, disclosure, retention**: use only for the consented purpose;
  retention period defined and enforced.
- [ ] **Accuracy**: data kept accurate and up to date.
- [ ] **Safeguards**: security proportional to sensitivity (encryption, access control).
- [ ] **Openness**: privacy policy is readily available.
- [ ] **Individual access**: a person can access their data and challenge its accuracy.
- [ ] **Challenging compliance**: a complaint channel to the privacy officer exists.

## Breach
- [ ] Breaches posing real risk of significant harm are reported to the **OPC** and
  affected individuals, and a record of all breaches is kept.

## Verification (lean)
`/audit` checks:
- `docs/privacy-policy.md` exists and names a privacy officer → CONCERNS if missing.
- Data export and access endpoint exists (`GET /me/export`) → CONCERNS if absent.
- Retention config present in `stack.md → retention` or `docs/retention.md`.
- Encryption-at-rest + TLS config present for personal information.
- A complaint/contact channel for privacy is documented.

<!-- Version: 1.0.0 — 2026-06-25 — initial PIPEDA lean checklist: 10 fair information principles, OPC breach reporting + breach register, Quebec Law 25 flag -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
