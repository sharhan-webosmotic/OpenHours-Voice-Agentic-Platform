---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# Australia Privacy Act / APPs — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `au-privacy` or `apps`. Australia's
> Privacy Act 1988 and the 13 Australian Privacy Principles (APPs).

## The 13 APPs (code/config-testable subset)
- [ ] **APP 1** Open, transparent management: a clear, up-to-date privacy policy.
- [ ] **APP 2** Anonymity / pseudonymity option where practicable.
- [ ] **APP 3** Collect only solicited personal information that is reasonably necessary.
- [ ] **APP 5** Notify the individual at collection (purpose, recipients, complaints).
- [ ] **APP 6** Use/disclose only for the primary purpose or a compatible secondary one.
- [ ] **APP 7** Direct marketing only with an opt-out mechanism.
- [ ] **APP 8** Cross-border disclosure: ensure the overseas recipient meets APP standards.
- [ ] **APP 10** Data quality: accurate, complete, up to date.
- [ ] **APP 11** Security: protect from misuse, loss, unauthorized access; destroy/de-identify
  when no longer needed.
- [ ] **APP 12** Access: an individual can access their personal information.
- [ ] **APP 13** Correction of personal information.

## Breach
- [ ] **Notifiable Data Breaches (NDB) scheme**: eligible breaches reported to the OAIC and
  affected individuals as soon as practicable.

## Verification (lean)
`/audit` checks:
- `docs/privacy-policy.md` exists (APP 1) with a complaints contact → CONCERNS if missing.
- Access + correction endpoints exist (`GET /me/export`, correction) → CONCERNS if absent.
- Direct-marketing paths include an opt-out (APP 7) → CONCERNS if absent.
- Encryption-at-rest + TLS for personal information (APP 11).
- Retention/destruction config present in `stack.md → retention` or `docs/retention.md`.

<!-- Version: 1.0.0 — 2026-06-25 — initial Australia Privacy Act / 13 APPs lean checklist: collection/notification/use/marketing-opt-out/cross-border/security/access/correction, NDB scheme breach reporting -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
