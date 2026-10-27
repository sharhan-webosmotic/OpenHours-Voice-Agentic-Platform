---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: Education / EdTech

> K-12, higher-ed, corporate LMS. One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is education.

- **Feel:** splits by audience, do not average. K-12: playful, encouraging, safe-to-fail. Higher-ed: focused, credible, low-distraction. Corporate LMS: efficient, get-in-get-out.
- **Color:** young K-12 tolerates large high-saturation surfaces as wayfinding/reward; older bands calmer. Higher-ed/corporate: restrained, institution-branded neutral plus one accent. Distinct achievement axis (progress, badges) separate from the error axis. Avoid red-only "wrong" for young children.
- **Typography:** general-legibility sans (Arial/Verdana per British Dyslexia Association; specialized dyslexia fonts show no benefit). The lever is spacing and size, not typeface. Body 12 to 14pt minimum, larger for early grades.
- **Density and layout:** K-12 spacious, shallow nav. Adults tolerate content density with structure. Course-shell pattern: left module nav, central content, persistent course header, progress/next-up rail. Mobile mandatory for corporate.
- **Signature components:** progress bars/completion rings; gradebook (color plus icon, never color-only); safe-fail quiz cards for K-12; badges/XP with mastery gating; course cards with resume; captioned video; consent gate.
- **Trust signals:** child safety as design for users who cannot advocate for themselves; teacher-created accounts with parental consent codes; granular un-prechecked consent toggles; parent data visibility; grading transparency.
- **Compliance:** WCAG 2.1 AA (DOJ April 2024 Title II extends AA to public-school sites). COPPA verifiable parental consent gate for under-13. FERPA record view/correction. Touch targets >=~2cm for young children.
- **Motion budget:** K-12 generous and reward-oriented; higher-ed/corporate restrained and functional. Reduced-motion across all bands.
- **Common mistakes:** over-gamification without mastery gating; maze LMS; missing captions/color-only grading; wrong touch targets for kids; one tone across age bands; treating dyslexia as a font swap.
- **References:** Duolingo (safe-fail gamification), Khan Academy (mastery gating), Canvas/Instructure (course-shell).

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.3. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
