---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: Healthcare / HealthTech

> Patient-facing + clinician EHR. One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is healthcare.

- **Feel:** a hard split one token set must serve. Patient: calm, reassuring, low-anxiety, plain-spoken. Clinician EHR: fast, efficient, low-friction (EHR inefficiency correlates most with burnout). "Get me to the next decision with least clicks," not warmth.
- **Color:** patient gets trustworthy blues, soft wellness greens, generous neutral greys (NHS blue #005eb8). Reserve red for urgent/error. Triage tiered by color AND non-color signal. Never color-only (NHS pairs every tag with a text label).
- **Typography:** sans-serif. Patient: larger base (16px min, often 18 to 19px), high line-height. Clinician tolerates denser. Safety controls: tall-man lettering (DOPamine vs DOBUTamine), lead decimals with zero (0.5 mg, never .5 mg).
- **Density and layout:** patient spacious, single-task-per-screen, 44x44 targets. Clinician data-dense but with a problem-oriented shell plus a persistent patient banner (name/MRN/allergies). Filter and rank, do not show everything.
- **Signature components:** vitals as value + sparkline + normal range (abnormal distinguishable without color); guarded dosage inputs; medication lists separating active/discontinued with allergy cross-check; tiered clinical alerts (interruptive only for hard stops).
- **Trust signals:** hard stops for contraindications; override-with-typed-reason; always-visible patient context to prevent wrong-patient actions; status text beside every status color; audit logging.
- **Compliance:** WCAG 2.2 AA minimum, never color-only. HIPAA automatic logoff (2 to 5 min shared, 10 to 15 min private), minimum-necessary PHI display, no PHI in URLs/titles/notifications. GDPR. See `rules/compliance/hipaa.md`.
- **Motion budget:** minimal and cautious near clinical data; motion must never delay a critical value or mask an alert.
- **Common mistakes:** alert fatigue from over-interruptive popups; EHR information overload; naked decimals/ambiguous units; color-only status; jargon-heavy anxious patient copy; applying the wrong half of the split.
- **References:** NHS App + NHS Design System, Epic and Oracle Health (Cerner), Ro, Healthcare.gov/USWDS.

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.2. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
