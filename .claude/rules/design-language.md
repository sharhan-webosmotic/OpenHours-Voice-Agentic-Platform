---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Design Language Reference (index)

Knowledge base for the design skills, split into focused files under `rules/design/` so each consumer loads only the slice it needs instead of the whole 40KB+ reference. This file is the router. It is reference material, not a gate.

The enforceable subset lives in `rules/design-rules.md` (bans and minimums that `component-inspector` checks). Implementation-level UI quality (spacing, forms, animation, hydration) lives in `rules/ui-engineering-rules.md`. Responsive, state, and performance rules live in `rules/frontend-rules.md`. Compliance checklists live in `rules/compliance/*`. These files complement those; they do not repeat them.

## What to load for which need

| You are doing | Load |
|---|---|
| Trend direction, "make it look 2026" | `rules/design/trends-2026.md` (Section A) |
| Grounding feel/color/density in the product's industry | the ONE matching profile in `rules/design/domains/` plus `rules/design/domains/_defaults.md` (Section B) |
| Auth, navigation, exit-path principles | `rules/design/auth-nav.md` (Section C) |
| Landing page, conversion, SEO, analytics | `rules/design/landing-conversion.md` (Section D) |
| Citing a source | `rules/design/sources.md` |

## Domain profiles (`rules/design/domains/`)

Detect the product's domain in `design-discovery` Step 0 and load the matching profile file plus `_defaults.md`. Do not load all ten.

| Domain | File |
|---|---|
| Finance / FinTech | `domains/fintech.md` |
| Healthcare / HealthTech | `domains/healthcare.md` |
| Education / EdTech | `domains/edtech.md` |
| Gaming | `domains/gaming.md` |
| Enterprise / B2B SaaS / Admin | `domains/enterprise.md` |
| E-commerce / Consumer retail | `domains/ecommerce.md` |
| Social / Community | `domains/social.md` |
| Logistics / Operations / Field | `domains/logistics.md` |
| Government / Civic | `domains/government.md` |
| Media / Entertainment / Streaming | `domains/media.md` |
| Cross-domain defaults (always) | `domains/_defaults.md` |

## Read by

- `design-discovery`: the detected `domains/<domain>.md` + `_defaults.md` (feel proposal), and `trends-2026.md` for currency.
- `design-direction`: `trends-2026.md` (trend axes) + the detected `domains/<domain>.md` (domain cues).
- `design-tokens`: the detected `domains/<domain>.md` (color/density/elevation/motion) + `trends-2026.md` (A.4 color/type direction).
- `design-screens`: `auth-nav.md` (auth/nav/exit principles) + the detected `domains/<domain>.md` (domain patterns).
- `landing-page`: `landing-conversion.md` (primary) + `trends-2026.md` (modern feel) + the detected `domains/<domain>.md` (tone, trust).

<!-- Version: 2.0.0 (2026-06-30): split the monolith into rules/design/{trends-2026, domains/<10>+_defaults, auth-nav, landing-conversion, sources}.md; this file is now a thin router. Consumers load only their slice (domain-aware skills load one profile, not all ten). -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
