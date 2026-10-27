---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: Enterprise / B2B SaaS / Admin

> Dashboards, CRM, ERP. One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is enterprise/admin.

- **Feel:** efficiency, trust, learnability over delight, for trained repeat power users. Calm competence and control. Build for the thousandth use, not the first.
- **Color:** restrained, neutral-dominant (large gray ramp plus ONE brand accent for primary actions and selection, per IBM Carbon). Fixed closed semantic set (error/success/warning/info/neutral). Charts use a dedicated categorical data-viz palette separate from UI color. Color is role-based via tokens, never raw hex.
- **Typography:** neutral sans (IBM Plex Sans, Inter, system). A dense "productive" set for chrome distinct from an "expressive" marketing set. Tabular lining numerals in all tables/dashboards/prices. Hierarchy from size/weight, not color.
- **Density and layout:** high density is a feature; offer selectable row density (Carbon ships 5 row heights). Shell: persistent left nav plus top bar, content in the main region, master-detail panes. 4/8px spacing. Data tables are the central primitive (server-side sort/filter/pagination past ~500 rows; right-align numerics).
- **Signature components:** data tables with sort/filter/pagination/row-select and bulk actions; KPI cards; faceted search plus saved views; forms and wizards with staged disclosure; side drawers; command palette (Cmd+K, now standard and doubles as a shortcut teacher); RBAC views; CSV/Excel export; empty states.
- **Trust signals:** confirmation modals before destructive actions; a distinct destructive/danger button style separate from primary; undo for reversible actions; explicit save states (saved/saving/unsaved); visible permission/role indicators and audit trails.
- **Compliance:** WCAG 2.1 AA as procurement baseline (documented via VPAT/ACR). Full keyboard operability for every table action, filter, and command. SOC2/GDPR push audit-log views, consent, export/delete, session-timeout indicators. See `rules/compliance/soc2.md`.
- **Motion budget:** minimal and functional; speed beats flourish. Delight motion only as a small post-trust celebration.
- **Common mistakes:** consumer-style over-design (hero imagery, marketing motion); low density wasting screen; no keyboard support; no bulk actions; proportional numerals in tables; destructive actions with no confirm/undo/danger styling; rainbow brand color instead of one accent plus semantic status; exposing every feature instead of staged disclosure.
- **References:** Linear (keyboard-first, Cmd+K), Stripe Dashboard, Salesforce Lightning/SLDS, Retool.

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.5. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
