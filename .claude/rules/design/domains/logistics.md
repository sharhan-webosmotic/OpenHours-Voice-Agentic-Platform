---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: Logistics / Operations / Field Tools

> One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is logistics/operations.

- **Feel:** calm certainty under operational pressure, never delight. The UI is a reliable instrument. Zero ambiguity: every status/ETA/action state unmistakable at a glance. Cognitive load (more than ~7 competing elements above the fold) predicts dashboard abandonment.
- **Color:** high-contrast first for sunlight. Strong status axis (green on-route/delivered, amber at-risk/delayed, red exception/offline, blue neutral/in-transit). Colorblind-safe is non-negotiable: every red/green and green/amber carries a distinct icon plus label. Use the Okabe-Ito palette for markers and series.
- **Typography:** large, bold, glanceable; size and weight carry meaning before color. High-legibility sans, statuses and primary numbers at the top of the scale to read in motion and glare. Tabular numerals for number columns. On the field surface, bigger beats denser.
- **Density and layout:** two layouts that must NOT be one screen scaled. Control-room (desktop): dense table plus map, identifier-first columns, frozen header, discoverable filters, nonmodal side panels. Field mobile: large touch targets (48dp Android / 44pt Apple minimum, larger for gloves), single prioritized column, primary actions in the bottom thumb zone.
- **Signature components:** live map with markers/routes/ETAs (shape plus color plus label); status pills; scan-to-action (barcode/QR); identifier-first task lists; prominent ETA/timeline; dispatch boards; signature plus photo proof-of-delivery; offline indicator plus sync state; one dominant bottom-anchored primary CTA per field screen.
- **Trust signals:** confirmation for irreversible ops actions (prefer real-time preview); always-visible offline/sync status (never a blocking modal); GPS accuracy indicator; proof-of-delivery; audit trail; conflict resolution designed up front for concurrent offline edits.
- **Compliance:** WCAG AA, status never color-only. Driver-safety (NHTSA Visual-Manual): in-motion tasks keep one hand free, each off-road glance <=2s and <=12s total, every task interruptible. Provide a Driver Mode that locks complex input while moving and defers POD/notes/scanning to a stopped state.
- **Motion budget:** minimal; speed and glanceability over flourish. Hard ban on attention-grabbing motion in any view reachable while driving. Respect reduced-motion.
- **Common mistakes:** tiny touch targets (worse with gloves); low contrast outdoors; assuming always-online (must queue and sync offline); too much text; no glove support; color-only status; shrinking the desktop dashboard onto mobile; no conflict resolution.
- **References:** Onfleet (unified POD, strong API), Samsara (in-app scanning/document capture), Zebra TC7x rugged family (the hardware class to build for).

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.8. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
