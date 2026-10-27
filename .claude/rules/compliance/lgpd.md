---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# LGPD — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `lgpd`. Brazil's Lei Geral de Proteção
> de Dados (Lei 13.709/2018). Mirrors GDPR closely: if `gdpr` is also in scope, the
> rights engine is shared and these are the Brazil-specific deltas.

## Legal basis & consent
- [ ] Processing rests on one of the 10 legal bases (Art. 7): consent, legal obligation,
  legitimate interest, contract execution, etc. The basis per processing activity is
  documented.
- [ ] Consent is free, informed, unambiguous, and for a specific purpose. Withdrawal is
  as easy as granting.

## Data subject rights (Art. 18)
- [ ] Confirmation of processing and **access** to the data.
- [ ] **Correction** of incomplete/inaccurate data.
- [ ] **Anonymization, blocking, or deletion** of unnecessary or non-compliant data.
- [ ] **Portability** to another provider (machine-readable).
- [ ] **Deletion** of data processed with consent.
- [ ] Information on public/private entities the data was shared with.
- [ ] Right to review automated decisions.

## Governance
- [ ] **Encarregado (DPO)** appointed and contact published.
- [ ] Records of processing activities maintained.
- [ ] International transfer only to countries with adequate protection or with specific
  safeguards (standard contractual clauses, specific consent).
- [ ] Breach notification to **ANPD** and affected subjects within a reasonable period.

## Verification (lean)
`/audit` checks:
- `docs/privacy-policy.md` exists (Portuguese-language obligation noted) → CONCERNS if missing.
- Rights endpoints exist: export (`GET /me/export`), delete (`DELETE /me`), correction →
  CONCERNS if absent.
- Consent capture records timestamp, purpose, and policy version (shared check with `gdpr.md`).
- Retention config present in `stack.md → retention` or `docs/retention.md`.
- No `Math.random` for security-sensitive values (RNG check, shared with `gdpr.md`).

<!-- Version: 1.0.0 — 2026-06-25 — initial LGPD lean checklist: 10 legal bases, Art.18 rights, encarregado/DPO, ANPD breach notice, shares export/delete/consent engine with gdpr.md -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
