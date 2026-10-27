---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: Social / Community

> One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is social.

- **Feel:** belonging, self-expression, fresh and alive. Posting frictionless, payoff is social signals. Chrome recedes so user content carries the energy.
- **Color:** light-first with one bold brand accent and neutral chrome so UGC pops. Notification red reserved for unseen-count, not decoration. Dark mode is an expectation (ship a full parallel dark palette as a peer, not an afterthought).
- **Typography:** optimize dense UGC at small sizes. Prefer the platform system font stack for scroll performance. Full emoji glyph support is mandatory. Body >=4.5:1.
- **Density and layout:** feed/timeline spine fed by infinite scroll. Mobile bottom tab bar (Home, Search, Compose, Notifications, Profile). Desktop three-column (left nav rail, center feed, right trends rail). Stories tray above the feed. 8-point grid. Persistent nav must replace the unreachable footer.
- **Signature components:** feed card (avatar/name/handle/timestamp header, body, action bar); action bar with optimistic counts; avatars with presence dot; always-reachable compose with @mentions/#hashtags; notifications list plus red badge; chat bubbles (sent vs received, typing/read indicators); stories tray with seen/unseen rings; profile header; stateful follow button.
- **Trust signals:** core UI, not buried settings: inline verification badges; report/block/mute from per-post and per-user overflow menus; content-warning blur-and-reveal; moderation transparency (tell the user why); visible privacy controls.
- **Compliance:** WCAG AA in both themes. GDPR granular consent and access/delete. COPPA age gate. DSA (EU): easy per-post flagging, a statement-of-reasons UI on removals, a non-personalized (chronological) feed toggle for very large platforms, and a dark-pattern ban that constrains consent/opt-out flows to be symmetric.
- **Motion budget:** lively micro-interactions are part of the brand (like-burst, reaction pop, pull-to-refresh, skeleton-to-content). Ethical cap: pull-to-refresh and never-ending autoplay are named attention-capturing dark patterns. Budget motion for delight and feedback, not compulsion. Honor reduced-motion.
- **Common mistakes:** dark patterns (infinite scroll plus casino pull-to-refresh plus autoplay, now DSA legal risk); cluttered chrome; dead/empty feeds for new users; weak moderation tools; orphaned footer; missing or broken dark mode.
- **References:** Instagram (content-forward model), Discord (dark-default, moderation), Reddit (threading, three-column).

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.7. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
