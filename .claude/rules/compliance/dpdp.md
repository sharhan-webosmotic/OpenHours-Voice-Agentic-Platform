---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# India DPDP — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `dpdp`. India's Digital Personal Data
> Protection Act, 2023. Governs digital personal data of individuals (Data Principals)
> processed by Data Fiduciaries.

## Notice & consent
- [ ] **Notice** at or before collection: what data, purpose, how to exercise rights,
  how to complain to the Data Protection Board. Available in English + the 22 scheduled
  languages on request.
- [ ] **Consent** is free, specific, informed, unconditional, with a clear affirmative
  action; itemized per purpose; withdrawable as easily as given.
- [ ] A **Consent Manager** (registered with the Board) is supported where used.
- [ ] Legitimate uses (Sec. 7) documented where consent is not the basis.

## Data Principal rights
- [ ] **Access**: summary of personal data processed and processing activities.
- [ ] **Correction & erasure** of personal data.
- [ ] **Grievance redressal**: a reachable channel, responded to in the prescribed time.
- [ ] **Nominate** another person to exercise rights (death/incapacity).

## Data Fiduciary obligations
- [ ] Security safeguards to prevent breach (encryption, access control).
- [ ] **Breach notification** to the Data Protection Board and affected principals.
- [ ] Erase data when purpose is served or consent withdrawn (retention limit).
- [ ] **Children (under 18)**: verifiable parental consent; no tracking, behavioral
  monitoring, or targeted ads to children.
- [ ] Significant Data Fiduciaries (if designated): DPO in India, DPIA, independent audit.

## Verification (lean)
`/audit` checks:
- `docs/privacy-policy.md` / notice exists with grievance contact → CONCERNS if missing.
- Consent capture records timestamp, itemized purpose, and is withdrawable.
- Rights endpoints exist: access/export, correction, erasure → CONCERNS if absent.
- Age-gate + parental-consent flow present if the product serves minors.
- Retention/erasure config present in `stack.md → retention` or `docs/retention.md`.

<!-- Version: 1.0.0 — 2026-06-25 — initial India DPDP Act 2023 lean checklist: notice+consent (consent manager), data principal rights + grievance, fiduciary obligations, children under-18 parental consent, Board breach notice -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
