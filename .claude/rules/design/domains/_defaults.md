---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Cross-Domain Design Defaults

> Section B.11 of the design-language knowledge base. Index: `rules/design-language.md`. The domain-aware skills (`design-discovery`, `design-tokens`, `design-direction`, `landing-page`) load the ONE detected domain profile from this directory plus this defaults file. Each domain file follows the same field order (Feel, Color, Typography, Density and layout, Signature components, Trust signals, Compliance, Motion budget, Common mistakes, References) so the token/component generator can parse it.

These recur across nearly every domain and are safe global defaults unless a domain file explicitly overrides them:

- **Never encode meaning in color alone.** Pair every status color with an icon, label, sign, or pattern. This is WCAG 1.4.1 and domain-correctness at once.
- **Tabular numerals** wherever numbers align in columns or update in place (fintech, enterprise tables, e-commerce prices, logistics counts).
- **WCAG 2.1 AA is the floor everywhere.** Government and healthcare push toward AAA; gaming uses the Game Accessibility Guidelines; media adds CVAA captioning.
- **Reduced-motion is universal**, but the motion budget itself is a domain-driven axis: near-zero (government, clinical healthcare, driving logistics), functional-only (fintech, enterprise, e-commerce), generous (gaming, media, K-12, social micro-interactions).
- **Density is a deliberate axis, not a quality bar.** Data-dense is correct for fintech, enterprise, clinician EHR, and control-room logistics; spacious is correct for government, patient healthcare, K-12, and field-mobile.
- **Dark-theme-default** is correct for gaming and media, an option for social, and wrong as a default for government, patient healthcare, and most e-commerce.

## Domain file index

| Domain | File |
|---|---|
| Finance / FinTech | `fintech.md` |
| Healthcare / HealthTech | `healthcare.md` |
| Education / EdTech | `edtech.md` |
| Gaming | `gaming.md` |
| Enterprise / B2B SaaS / Admin | `enterprise.md` |
| E-commerce / Consumer retail | `ecommerce.md` |
| Social / Community | `social.md` |
| Logistics / Operations / Field | `logistics.md` |
| Government / Civic | `government.md` |
| Media / Entertainment / Streaming | `media.md` |

If the product spans two domains, load both files and state which leads. If none fit cleanly, proceed from first principles plus the closest profile and these defaults.

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.11; added the domain file index + shared field schema. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
