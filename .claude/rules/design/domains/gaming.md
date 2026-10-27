---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: Gaming

> In-game HUD + platforms/launchers. One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is gaming.

- **Feel:** two targets. In-game: immersion, mastery, excitement, HUD stays out of the world. Launchers (Steam/Discord/consoles): comfort, control, "home base", browsing and social presence.
- **Color:** dark themes dominate both (let neon accents and cover art pop). One brand accent plus high-saturation status. Loot-rarity ladder near-universal (gray common, green uncommon, blue rare, purple epic, orange legendary). Rarity/team/status never color-only: add icon, label, or border.
- **Typography:** two-tier (themed display for titles vs plain legible sans for anything read under pressure). HUD legibility over busy art via glyph stroke/outline and a faded dark polygon behind text. Subtitles large, high-contrast, outlined, user-adjustable size.
- **Density and layout:** in-game HUD edge-anchored to corners, center clear for the world. Launchers use card/cover grids, rearrangeable widgets, explicit density modes, summonable/dismissable overlay panels.
- **Signature components:** the four UI categories are the mental model (diegetic, non-diegetic, spatial, meta); HUD overlays (health/ammo/minimap/objective/crosshair); inventory grids; skill trees; rarity borders/glows; achievement toasts. Real UIs are hybrids.
- **Trust signals:** explicit purchase confirmation and clear pricing before any real-money spend; loot-box odds disclosure; parental controls; anti-cheat indicators; premium currency clearly separated from real money.
- **Compliance:** anchor to the Game Accessibility Guidelines. Never color-only; provide >=3 colorblind modes plus high-contrast; contrast 3:1 large HUD, 4.5:1 standard critical text. Fix the four top complaints first: control remapping, text size, colorblindness, subtitles. Loot-box odds disclosure is law in China and South Korea.
- **Motion budget:** generous; the one domain where animation is a feature ("juice"). Ship a reduced-motion toggle that dampens non-essential motion while keeping essential feedback; hold frame rate.
- **Common mistakes:** HUD clutter obstructing the world; unreadable themed fonts with no outline; breaking immersion (wrong UI category); color-only rarity/status; hidden loot-box odds and unconfirmed purchases.
- **References:** Dead Space (diegetic HUD), Steam, Discord, World of Warcraft (non-diegetic HUD and the rarity ladder origin).

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.4. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
