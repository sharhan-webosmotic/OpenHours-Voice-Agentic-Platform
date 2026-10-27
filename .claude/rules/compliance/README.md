---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# Compliance regime index

> The lookup `/do` Step 1.9 (security + compliance verification) and `/audit` use to
> resolve a triggered regime to its checklist. A regime is added to `stack.md →
> compliance:` only after the requirement signal is confirmed with the user. Governing
> flow: `/do` Step 1.9; infra mapping: `rules/infrastructure-rules.md` Rule 15.

## Conditional loading (BLOCKING discipline)

**Load ONLY the compliance files and skills that match the project's declared
`stack.md → compliance:` value. Never load the whole `rules/compliance/` folder.**

This is a context-budget and correctness rule, not a preference. A project that is not
PCI does not load `pci-dss.md`; a project with `compliance: none` loads none of the
regime files at all.

- **Resolve the regime first.** Read `stack.md → compliance:` (a list, e.g. `[hipaa, gdpr]`,
  or `none`). For each listed regime, load ONLY its row's file from the tables below (and
  the sibling file a first-principles regime points to). Load nothing else from this folder.
- **Always-on baseline (independent of regime):** `secrets.md` (secret scanning) and the
  `audit-logs.md` path check run on every project per their own triggers. `owasp.md` loads
  whenever `compliance:` is non-empty (any regime implies the app-security baseline). These
  three are the only compliance files that load without a specific regime match.
- **Skills follow the same gate.** `audit` and `audit-logs` are armed in the
  Activation Map (`active-skills.md`) only when `stack.md compliance` is non-empty or S20
  has rows; `accessibility-audit` only when an accessibility obligation (or a frontend) is
  in scope. Do not dispatch a compliance skill for a regime the project did not declare.
- **If `compliance: none`:** load no regime file and arm no compliance skill. The baseline
  `../secrets-patterns.md` + `audit-logs.md` + `owasp` (only if later a regime is added) still apply.
- **Adding a regime mid-project** goes through `/change-request`: it updates `stack.md
  compliance`, which re-derives the Activation Map and the set of loaded files.

> "Has checklist" = a `.md` in this folder enforces it. "First-principles" = no dedicated
> file: load the sibling it points to and add the regime-specific deltas. The absence of a
> dedicated file is never a reason to skip a triggered regime.

## Privacy / data protection

| Regime | Trigger (data subject region / data type) | Load | Source · key controls |
|---|---|---|---|
| **GDPR** | EU/EEA personal data | `gdpr.md` | EU 2016/679 · lawful basis + consent, access/erasure/portability/rectification, DPO/RoPA, breach 72h |
| **UK-GDPR / DPA 2018** | UK personal data | `gdpr.md` (sibling) | same controls as GDPR; ICO is the supervisory authority |
| **CCPA / CPRA** | California consumers | `ccpa.md` | know/delete/correct, Do-Not-Sell-or-Share + GPC signal, limit sensitive PI |
| **Other US-state (VCDPA, CPA, CTDPA, UCPA)** | Virginia/Colorado/Connecticut/Utah consumers | `ccpa.md` (sibling) | same rights engine; opt-out of targeted advertising + sale |
| **LGPD** | Brazil personal data | `lgpd.md` | Lei 13.709/2018 · 10 legal bases, Art.18 rights, encarregado, ANPD breach notice |
| **PIPEDA** | Canada personal data | `pipeda.md` | 10 fair information principles, OPC breach reporting; Quebec Law 25 adds |
| **India DPDP 2023** | India personal data | `dpdp.md` | notice+consent (consent manager), principal rights+grievance, under-18 parental consent |
| **Australia Privacy Act / APPs** | Australian personal data | `au-privacy.md` | 13 APPs · notice, use, marketing opt-out, cross-border, access/correction; NDB scheme |
| **COPPA** | children under 13 (US); GDPR-K under 16 (EU) | `coppa.md` (+`gdpr.md` for EU) | verifiable parental consent, age gate, no behavioral ads to children |

## Security / trust frameworks

| Regime | Trigger | Load | Source · key controls |
|---|---|---|---|
| **SOC 2** | SaaS handling customer data; enterprise buyers | `soc2.md` | Trust Services Criteria · access control, change mgmt, monitoring, tested backups, audit logs ≥1yr |
| **ISO 27001** | international enterprise buyers | `iso-27001.md` | ISMS + Annex A 2022 (4 themes); overlaps SOC 2 |
| **FedRAMP / NIST 800-53** | US federal / government cloud | `fedramp.md` | impact baseline, SSP + POA&M, FIPS crypto, MFA, continuous monitoring |
| **NIS2** | EU critical-infrastructure / essential services | `nis2.md` | risk-management measures, 24h/72h/1-month incident reporting, supply-chain security |
| **OWASP Top 10** | every app (baseline, when any regime set) | `owasp.md` | the always-on application-security grep checklist |

## Sector-specific

| Regime | Trigger | Load | Source · key controls |
|---|---|---|---|
| **HIPAA** | PHI / health data (US) | `hipaa.md` | safeguards, BAAs, audit logs 6yr, ≤15min idle session, encryption |
| **PCI-DSS** | cardholder data | `pci-dss.md` | scope reduction (SAQ-A via tokenized processor), no PAN/CVV at rest/in logs, TLS |
| **GLBA** | consumer financial data / lending | `glba.md` | Safeguards Rule + Privacy Rule (notices, opt-out, anti-pretexting) |
| **FERPA** | US education records | `ferpa.md` | consent-before-disclosure, access/amendment, disclosure recordkeeping |
| **FDA / IEC 62304** | medical-device software | `fda-62304.md` | software safety class, lifecycle artifacts, ISO 14971 risk, SOUP/SBOM |

## Cross-cutting (often a legal obligation, not optional)

| Area | Trigger | Load | Source · key controls |
|---|---|---|---|
| **Accessibility** | government, EU market, large US enterprise, public sector | `../design-rules.md` + `/accessibility-audit` | WCAG 2.1/2.2 AA, ADA, Section 508, EN 301 549 / EAA |
| **Audit logging** | any regime with an access-log requirement | `audit-logs.md` | who/what/when, append-only, retention per regime |
| **Secrets handling** | every project (baseline) | `../secrets-patterns.md` | no hardcoded secrets, managed store, rotation on leak |

<!-- Version: 1.1.0 — 2026-06-25 — added conditional-loading discipline (load only the declared regime's file + skills, never the whole folder; baseline = secrets/audit-logs/owasp); flipped lgpd/pipeda/dpdp/au-privacy/coppa/glba/ferpa/iso-27001/fedramp/nis2/fda-62304 from first-principles to shipping checklists -->
<!-- Version: 1.0.0 — 2026-06-25 — initial compliance index -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
<!-- Version: 1.1.1 | 2026-10-22 | v4.32.0: compliance/secrets.md merged into ../secrets-patterns.md, baseline references repointed -->
