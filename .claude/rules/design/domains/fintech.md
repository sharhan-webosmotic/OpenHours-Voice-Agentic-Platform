---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: Finance / FinTech

> Banking, investing, payments. One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is finance.

- **Feel:** calm, controlled, credible. Quiet competence over delight. The job is to reduce anxiety around irreversible money actions. Trust outweighs polish.
- **Color:** blue dominates (calm, trustworthy, colorblind-safe anchor). Green for success and up/profit, red for error and down/loss. Never encode credit/debit or profit/loss on color alone (pair with sign, arrow, or label). In charts, color carries categorical grouping only, not magnitude.
- **Typography:** sans-serif (Stripe Sohne, Inter as substitute). Tabular numerals mandatory for all money and counts (`font-feature-settings: "tnum"`) so digits align. Body contrast >=4.5:1.
- **Density and layout:** data-dense, not spacious. Persistent sidebar, dashboard widget grids, compact tables. Progressive disclosure (expandable rows, drill-down). Critical KPI top-left for F-scan.
- **Signature components:** bar and line charts (avoid pie/donut/gauge/3D); auto-grouping money inputs; review-before-submit confirmation restating exact amount and recipient; dense exportable transaction tables; encapsulated, visually bounded payment fields.
- **Trust signals:** encapsulated fields, lock/security icons, undo/cancel window, explicit per-transaction state (pending/sent/failed), reviewable immutable history, partner logos.
- **Compliance:** WCAG 2.1 AA. PSD2/SCA step-up MFA that restates exact amount and payee verbatim. PCI-DSS via hosted/iframe fields (Stripe Elements) so PAN never touches your DOM. GDPR consent/export/delete in-UI. See `rules/compliance/`.
- **Motion budget:** minimal, functional. Motion confirms state, never decorates.
- **Common mistakes:** color-only profit/loss; proportional numerals; pie/gauge/3D for comparison; vague transaction loading; no review/undo before transfers; over-animation.
- **References:** Stripe (dashboard, Elements, checkout), mature mobile banking apps, Stripe design system.

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.1. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
