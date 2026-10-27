---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: Government / Civic

> One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is government/civic. This is the strictest accessibility domain.

- **Feel:** trust, authority, calm. The user must feel this is the legitimate official source that will not trick them and that any citizen can complete the task regardless of device, literacy, or ability. "Do the hard work to make it simple" and "this is for everyone." Plain, reassuring, do-not-make-me-think.
- **Color:** restrained, official, low-decoration, token-based (USWDS `[family]-[grade]` scale, e.g. blue-50 #2378c3). Color is functional; reserve saturation for state and action. Semantic alerts map to USWDS variants (info/warning/success/error/emergency), each with a fixed icon. High contrast (WCAG 2.1 AA) mandatory, never color-only.
- **Typography:** highly legible humanist sans, generously sized (Public Sans; Source Sans Pro; Merriweather for dense reading). Base body >=16px effective, line-height >=1.5, measure 45 to 90 chars. GOV.UK scale: body 19px, every line-height a multiple of 5px, sizes in rem. Plain language is a legal target (Plain Writing Act).
- **Density and layout:** single readable column at constrained measure (GOV.UK caps question content to two-thirds width). Generous spacing, flush-left type. The dominant form pattern is one-thing-per-page: a single question per page.
- **Signature components:** one-question-per-page flow (back link at top, single question heading, left-aligned Continue), start page then question pages then "Check your answers"; step indicators/task lists; alert and site-alert banners with ARIA roles; the official-website banner; accessible address lookup, eligibility checkers, document upload, multi-language toggle.
- **Trust signals:** the official-website banner (flag icon, expandable accordion teaching that .gov/.mil is real and that https is safe); visible official identity; explicit HTTPS/lock messaging; plain consent; no dark patterns; save-and-return so a citizen never loses a half-finished application.
- **Compliance (strictest accessibility domain):** WCAG 2.1 AA is legally backed; Section 508 legally requires accessible federal ICT. Plain language is law. Every interactive element keyboard-reachable with visible focus, correct ARIA roles on alerts (`role="alert"` for errors), labels on every input, never color-only, multilingual support.
- **Motion budget:** minimal to none. Animation competes with accessibility, low bandwidth, and old devices that "for everyone" must serve. Motion only for genuine feedback. No carousels, parallax, or autoplay.
- **Common mistakes:** jargon and legalese (a legal failure); multiple questions per page; inaccessible PDFs as the real form; decorative clutter hurting contrast and load; color-only state, placeholder-as-label, missing focus; assuming modern devices/high literacy; free-picking hex instead of the sanctioned tokens.
- **References:** GOV.UK + GOV.UK Design System, USWDS-based federal sites, Login.gov (civic identity/auth).

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.9. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
