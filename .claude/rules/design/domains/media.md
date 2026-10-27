---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: Media / Entertainment / Streaming

> One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is media/streaming.

- **Feel:** immersion and escapism. The UI is the theater, the content is the movie: chrome recedes, artwork carries emotion ("content over chrome"). Effortless discovery is the second pillar. Two postures govern everything: lean-forward (phone/web, active) vs lean-back (TV/console, D-pad, ~3m/10ft).
- **Color:** dark theme dominant, not optional (near-black neutrals let artwork pop; Spotify #121212 base, raised surfaces lighter). One saturated brand accent reserved strictly for primary action and active state (Spotify green, Netflix red), tuned for OLED legibility. Gradient scrims between thumbnail artwork and overlaid title text guarantee legibility.
- **Typography:** clean high-legibility sans (Netflix Sans, Spotify Circular). Strong size hierarchy (oversized hero, scannable row labels, restrained body). On TV size up aggressively (body min ~29pt) and keep reading minimal.
- **Density and layout:** horizontally scrolling rails stacked vertically (up/down between categories, left/right within), with a hero/billboard at top. Lean-back is sparse with one clear focus target per screen; lean-forward is denser and pointer-driven. Respect 10-foot overscan safe margins.
- **Signature components:** content rails (lazy-loaded, edge-peeking); hero/billboard (full-bleed, autoplay-on-focus, gradient scrim, Play plus Add-to-list); thumbnail cards with focus/hover preview; video player (scrubber, skip-intro, 10s seek, quality/caption/audio selectors, next-episode countdown); continue-watching and recommendation rows; now-playing bar plus queue for music; D-pad focus states on every element (scale plus elevation plus brightness plus subtle parallax).
- **Trust signals:** maturity ratings and content warnings on detail/play; multiple profiles with a Kids mode and PIN-gated parental controls; clear non-dark-pattern subscription/billing with easy cancel; user-disableable autoplay.
- **Compliance:** WCAG 2.1 AA baseline applied especially to titles over artwork (why the scrim exists). FCC CVAA: streamed programming must carry captions; caption customization must be a first-class settings panel with live preview by the Aug 17 2026 standard; audio-description track support. D-pad must be fully keyboard-equivalent with visible focus.
- **Motion budget:** generous and cinematic but disciplined (smooth focus transitions, focus preview, subtle parallax). TV hardware is underpowered: cap simultaneous animations, favor GPU-cheap transforms, hold 60fps. Honor reduced-motion (disable autoplay previews and parallax).
- **Common mistakes:** title text unreadable over busy thumbnails (missing scrim); poor/ambiguous D-pad focus; autoplay abuse; chrome competing with content; tiny TV text and dense mobile-ported layouts illegible at 10ft; low contrast that survives a monitor but collapses at distance; buried caption settings (breaks CVAA).
- **References:** Netflix (billboard plus personalized rails), Spotify (content-first darkness, one tuned accent), Apple TV/tvOS (10-foot focus interaction).

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.10. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
