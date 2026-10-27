---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# COPPA — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `coppa`. US Children's Online Privacy
> Protection Act: applies to online services directed to children under 13, or that
> knowingly collect personal information from them. For EU children (under 16) GDPR-K
> provisions apply: load `gdpr.md` alongside.

## Required controls
- [ ] **Verifiable parental consent** before collecting, using, or disclosing personal
  information from a child (credit card, signed form, government ID, video call, etc.).
- [ ] **Direct notice** to parents + a clear children's privacy policy describing what is
  collected, how it is used, and disclosure practices.
- [ ] **Data minimization**: collect no more than is reasonably necessary to participate;
  do not condition participation on disclosing more than needed.
- [ ] **No behavioral advertising / tracking** to children; no persistent identifiers for
  targeting.
- [ ] **Parental rights**: review the child's data, refuse further collection, and request
  deletion.
- [ ] **Retention limits**: keep a child's data only as long as needed; delete securely.
- [ ] Reasonable security for children's data.

## Verification (lean)
`/audit` checks:
- An **age gate / age-screening** mechanism exists before data collection → FAIL if a
  child-directed service collects PI with no age gate.
- A verifiable-parental-consent flow is present (not a bare checkbox) → CONCERNS if weak.
- A children's privacy policy / parent notice exists (`docs/privacy-policy.md` or a
  dedicated children's notice) → CONCERNS if missing.
- Analytics/ad SDKs are NOT initialized for under-13 sessions → FAIL if behavioral
  tracking fires for a child session.
- Parental access + deletion endpoint or process documented.

<!-- Version: 1.0.0 — 2026-06-25 — initial COPPA lean checklist: verifiable parental consent, age gate, data minimization, no behavioral ads to children, parental review/delete; pairs with gdpr.md for EU under-16 -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
