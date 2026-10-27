---
name: landing-page
description: "Design a high-converting, SEO-optimized, analytics-instrumented marketing landing page: hero + value prop + social proof + funnel-mapped sections + one primary CTA, with technical SEO (structured data, Core Web Vitals), and a GTM/GA4 instrumentation spec. Distinct from in-app screens (/design-screens). Produces a live token-driven mockup + landing-spec.md + instrumentation spec. Use for a marketing site, product landing page, or any conversion page. Triggers on: 'landing page', 'marketing page', 'hero section', 'conversion page', 'product page design', 'SEO landing', 'CTA above the fold'."
next_skill: build
required_gate: "Gate 3 (Design System)"
allowed-tools: "Read Write Edit Grep Glob WebSearch Task"
skill_id: SK-151
context_budget:
  load_kb: 35
  scope: task
version: 1.3.0
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [design-tokens]
  optional: [design-direction, seo, analytics, image-generation, image-assets]
produces:
  - path: AI_DOCS/design/landing/landing-spec.md
    consumers: [build, seo, analytics, qa-testing]
  - path: AI_DOCS/design/landing/landing.html
    consumers: [build, design-screens]
  - path: AI_DOCS/design/landing/instrumentation.md
    consumers: [analytics, seo, build]
consumes:
  - path: design-system/tokens.json
  - path: AI_DOCS/design/design-dna.md
    required_sections: [domain-mode, color-palette, typography, brand-voice]
  - path: rules/design/landing-conversion.md
  - path: rules/design/trends-2026.md
    required_sections: [section-d, section-a]
  - path: AI_DOCS/planning/workscope.md
    required_sections: [audience, value-proposition, business-goal]
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [context-aware, conversion-focused]
  role: "design-phase (marketing surface, parallel to design-screens)"
---

# /landing-page: Design the Marketing Landing Page

> **ACT AS:** A conversion-focused product designer who also owns SEO and analytics, not a decorator.
> **WHY THIS EXISTS:** A marketing landing page is a different discipline from in-app screens. Its single job is conversion, and it is measured. `/design-screens` builds the authenticated product; this skill builds the eye-catching, elegant, instrumented page that turns a visitor into a signup. It addresses the marketing, SEO, GTM, and funnel facts that in-app screen design does not.

---

## When to Run

For a marketing or product landing page, a campaign page, or any standalone conversion page. Run after `/design-tokens` has locked the token set, so the page uses the real design. It can run in parallel with `/design-screens` (which owns the in-app surfaces). It is not for authenticated in-app screens.

Do not run without `design-system/tokens.json`. If tokens are not locked, run `/design-tokens` first.

---

## Pre-flight

Read:

1. `design-system/tokens.json`: the locked design tokens. The landing page uses these, it does not invent a parallel look.
2. `AI_DOCS/design/design-dna.md`: brand voice, domain, color, type. The page must sound and feel like the product.
3. `rules/design/landing-conversion.md` (landing/conversion/SEO/analytics) is the knowledge base for this skill; `rules/design/trends-2026.md` drives the modern feel; the product's profile in `rules/design/domains/<domain>.md` drives tone and trust signals. Router: `rules/design-language.md`.
4. `AI_DOCS/planning/workscope.md`: target audience, the core value proposition, and the one business goal of the page (the conversion).
5. `rules/design-rules.md`: the one-clear-CTA minimum, modern-look minimums, and the auth/nav rules for the page's nav bar and footer.

If the value proposition or the page's single conversion goal is unclear, ask the user once (inline) before designing. A landing page with two goals converts on neither.

---

## Instructions

### Step 1: Confirm the one goal and the audience

State the single conversion this page exists to drive (sign up, book a demo, start a trial, buy). One page, one goal. If the user names several, ask which is primary; the rest become secondary CTAs at most. Capture the audience and their main objection. In the same ask, confirm the tone: the brand voice from `design-dna.md` is the default, name it and let the user adjust.

All page copy (hero, value proposition, CTAs, section copy) follows `rules/document-generation-rules.md`: marketing copy is where the banned-phrase list matters most, and every claim traces to the product's real capabilities (Rule 6). Layout, tokens, and instrumentation are exempt.

### Step 2: Lay out the anatomy (funnel-mapped)

Use the canonical section order from `rules/design/landing-conversion.md` D.1, and map each section to the funnel stage it serves. First look up candidate patterns with `bash .claude/scripts/design-lookup.sh "<goal keyword>" --domain landing` (for example `conversion`, `call to action`) and note the matching Pattern IDs with their Section Order and Primary CTA Placement. If a pattern fits the goal better than the default order below, use it and record `Pattern ID: <id>` in `landing-spec.md` with the reason. The dataset seeds the order and never decides:

| Section | Funnel stage | Job |
|---|---|---|
| Hero (above the fold) | Awareness to interest | Value prop + one primary CTA + supporting visual + trust strip |
| Value prop / problem-solution | Interest | Benefit-led, what it does and why it matters |
| Social proof | Interest to decision | Logos, testimonials, ratings, case studies |
| Features / benefits | Decision | Outcomes, not specs |
| Objection handling | Decision | FAQ, comparison, guarantees |
| Pricing (if any) | Decision | Clear, no hidden cost |
| Final CTA | Action | Restate value, single action |
| Footer | Trust / nav | Secondary nav, legal, contact, trust marks |

Drop full-site navigation that competes with the CTA. The page is one page with one goal.

### Step 3: Above the fold and CTA hierarchy

Make the headline, subhead, primary CTA, hero visual, and a trust cue visible without scrolling. Exactly one primary CTA, high-contrast against the page, with action copy ("Start free", "Get a demo"), not "Submit". Repeat it at natural decision points down the page. Secondary actions stay visually quieter (see `rules/design/landing-conversion.md` D.2).

### Step 4: Social proof, trust, and friction

Place a light trust strip in the hero and fuller proof (testimonials, case studies, security badges) near the decision points and the pricing/CTA. Specific named proof beats generic praise. At the conversion form, minimize fields (ask only what you need now), offer SSO/guest paths, and use a progress indicator on any multi-step form (Section D.3, D.4). Honor the domain profile's trust signals (for fintech, security cues at the form; for healthcare, plain reassurance; and so on).

### Step 5: Technical SEO spec

Specify, in `landing-spec.md`:

- One `h1` and a correct heading hierarchy, semantic HTML5 landmarks, descriptive alt text, a canonical tag, and Open Graph / Twitter Card tags.
- Title (~60 chars target) and meta description (~155 chars target) written for click-through. These are targets, not hard limits.
- JSON-LD structured data that still earns results: Organization, Product, BreadcrumbList, Article as fits. Do NOT emit `FAQPage` or `HowTo` JSON-LD for SERP gains; those rich results were deprecated through 2026. Keep the FAQ section for UX and objection handling only.
- Core Web Vitals budget the build must meet (75th percentile, mobile and desktop): LCP <=2.5s, INP <=200ms, CLS <=0.1. Hero motion must never delay LCP or cause layout shift.
- Modern image formats, responsive `srcset`, lazy-load below the fold, mobile-first.

### Step 6: Analytics / GTM instrumentation spec

Write `AI_DOCS/design/landing/instrumentation.md`:

- GTM as the container; no hardcoded tags.
- GA4 events with `dataLayer` pushes: page view, scroll depth, each CTA click (labeled per CTA), form start, form submit, video play, outbound click.
- Mark the form-submit/signup as a GA4 key event and define the funnel steps.
- Consent first: Google Consent Mode v2 (default-denied) runs before GTM loads; tags fire only after consent, with an honest refuse path and no dark patterns.
- This skill owns the design and the instrumentation spec. The actual wiring is handed to `/seo` and `/analytics`; do not duplicate their code here.

### Step 7: Build the live mockup (modern, elegant, on-budget)

Produce `AI_DOCS/design/landing/landing.html` (or the stack's native format per `frontend-stack.md`): a single token-driven page using the locked `tokens.json`, emoji-free, with the sections above and real value-prop copy in the brand voice (not lorem). Apply `rules/design/trends-2026.md` within a performance budget: layered depth, a confident variable-font headline, and at most one or two strong motion moments, all behind a `prefers-reduced-motion` fallback and within the CWV targets. The nav bar and footer honor the auth/nav rules in `rules/design-rules.md` (real sign-in entry if the product has auth, reachable footer nav, no dead ends). Responsive at 320 / 768 / 1024+.

### Step 8: A/B test hooks

In `landing-spec.md`, name the highest-leverage tests in order: headline, then primary CTA copy/color, then hero visual. Keep variants structurally identical so the test is clean.

### Step 9: Handoff

```
Landing page designed.
- Spec: AI_DOCS/design/landing/landing-spec.md (anatomy, SEO, A/B plan)
- Mockup: AI_DOCS/design/landing/landing.html
- Instrumentation: AI_DOCS/design/landing/instrumentation.md (GTM/GA4 events, consent, funnel)

Next: /build to implement, then /seo and /analytics to wire SEO + GTM/GA4.
```

---

## Examples

### Example 1: B2B SaaS free-trial landing

1. Goal confirmed: start free trial (one goal). Audience: ops managers.
2. Anatomy mapped; hero leads with the outcome, one "Start free" CTA, logo trust strip.
3. Enterprise domain profile: restrained palette, one accent CTA, social proof near pricing.
4. SEO: Organization + Product JSON-LD, no FAQPage; CWV budget set.
5. Instrumentation: GA4 key event on trial-start, scroll + CTA + form events, Consent Mode v2.
6. Live mockup built from tokens.json; A/B plan names headline first.

### Example 2: Consumer mobile app landing

1. Goal: app install (store links as the action).
2. Consumer/e-commerce domain cues: image-led hero, high-contrast CTA, star-rating proof.
3. Mobile-first; sticky CTA; reduced-motion fallback on the hero animation.
4. SEO + Open Graph for shareability; CWV strict on mobile.
5. Instrumentation: store-link clicks as key events, scroll depth, video play.

---

## Rules

1. **One page, one goal.** A landing page with two primary goals converts on neither. Confirm the single conversion first.
2. **Exactly one primary CTA**, repeated at decision points; secondary actions stay quiet.
3. **Token-driven and on-brand.** Use the locked `tokens.json` and the brand voice; never a parallel look or lorem copy.
4. **SEO and instrumentation are part of the design, not an afterthought.** Every landing ships with the SEO spec and the GTM/GA4 spec.
5. **No deprecated schema for SERP gains** (`FAQPage`/`HowTo`); keep FAQ for UX only.
6. **Consent before tags.** Consent Mode v2 default-denied, honest refuse path, no dark patterns.
7. **Modern within budget.** 2026 trends applied behind reduced-motion and within Core Web Vitals; motion never delays LCP or shifts layout.
8. **Emoji-free, accessible, responsive**, same design rules as the rest of the system. Nav and footer honor the auth/nav non-negotiables.

## Next Step

`/build` implements the page; `/seo` and `/analytics` wire the SEO tags and the GTM/GA4 instrumentation from the specs.
<!-- v1.3.0 (2026-10-22): Step 2 looks up landing Pattern IDs, section orders and CTA placement via scripts/design-lookup.sh and records the chosen Pattern ID in landing-spec.md (v4.31.0). -->
