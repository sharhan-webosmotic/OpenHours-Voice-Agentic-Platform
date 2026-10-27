---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Landing Page, Conversion, SEO, and Analytics

> Section D of the design-language knowledge base. Index: `rules/design-language.md`. The knowledge base for the `landing-page` skill. A marketing landing page is a different discipline from in-app screens: its single job is conversion, and it is measured. Source-verified facts are tagged. Pair this with `rules/design/trends-2026.md` (modern feel) and the product's domain profile (tone, trust signals).

## D.1 Landing-page anatomy (canonical high-converting order)

1. **Hero / above the fold:** the value proposition, one primary CTA, a supporting visual, and a trust strip. The single most important section.
2. **Value proposition / problem-solution:** what it does and why it matters, benefit-led.
3. **Social proof:** logos, testimonials, ratings, case studies.
4. **Features / benefits:** framed as outcomes, not specs.
5. **Objection handling:** FAQ, comparison, guarantees.
6. **Pricing** (if applicable): clear, no hidden cost.
7. **Final CTA:** restate the value and the single action.
8. **Footer:** secondary nav, legal, contact, trust marks.

Dataset cross-check: the vendored landing dataset carries named patterns with a Pattern ID, Section Order, Primary CTA Placement and Color Strategy (for example `hero-features-cta`, `funnel-3-step-conversion`, `pricing-page-cta`). Look one up with `bash .claude/scripts/design-lookup.sh "<short keyword>" --domain landing` (short keywords such as `conversion` or `call to action` match best, a miss lists the closest pattern names). Cite the Pattern ID in `landing-spec.md` when a pattern informs the section order. The dataset seeds the order, this D.1 anatomy and the one-goal rule still govern.

A landing page is one page with one goal: avoid full-site navigation that competes with the CTA. (The one-page-one-goal principle is sound; do not cite a hard "attention ratio" number, it is not from a primary source.)

## D.2 Above the fold and CTA

- Make the headline, subhead, primary CTA, hero visual, and a trust cue visible without scrolling.
- Exactly one primary CTA, repeated down the page at natural decision points. Make it high-contrast against the page, with clear action copy ("Start free", "Get a demo"), not "Submit".
- Secondary actions stay visually quieter so they never compete.

## D.3 Social proof and trust

- Place a light trust strip in the hero (logos or a rating) and fuller proof (testimonials, case studies, security badges) deeper down near decision points and the pricing/CTA.
- Specific named proof beats generic praise.

## D.4 Conversion funnel

- Map awareness to interest to decision to action onto the section order: hero and value prop create interest, social proof and objection handling drive decision, the CTAs and form drive action.
- Reduce friction at the action: minimize form fields (ask only what you need now), offer guest/SSO paths, and make multi-step forms feel short with a progress indicator.
- Conversion-lift case studies (first-person CTA copy, a human face, multi-step forms, guarantees) are directional vendor data. Use them as design rationale, never as hard facts quoted to a client.

## D.5 Technical SEO (2026)

- Title and meta description: write for click-through. Treat the ~60-char title and ~155-char meta as targets, not hard rules (Google states no character limit; truncation is by device width).
- One `h1`, a correct heading hierarchy, semantic HTML5 landmarks, descriptive alt text, a canonical tag, and Open Graph / Twitter Card tags for sharing.
- **Structured data:** use JSON-LD (Organization, Product, BreadcrumbList, Article as fits). Do NOT emit `FAQPage` or `HowTo` JSON-LD for SERP gains: FAQ rich results stopped appearing in Search on 2026-05-07 and support was removed through 2026; HowTo is also deprecated. Keep FAQ sections for UX and objection handling, not schema. [Certain]
- **Core Web Vitals (2026, 75th percentile, mobile and desktop separately):** LCP good <=2.5s (poor >4.0s), INP good <=200ms (poor >500ms), CLS good <=0.1 (poor >0.25). INP replaced FID on 2024-03-12. [Certain]
- Image optimization (modern formats, responsive `srcset`, lazy-load below the fold), mobile-first, and crawlability.

## D.6 Analytics and instrumentation

- Use Google Tag Manager as the container; do not hardcode tags in markup.
- **GA4 events to track:** page view, scroll depth, CTA clicks, form start, form submit, video play, and outbound clicks. Push a `dataLayer` event per interaction.
- GA4 "conversions" were renamed to "key events" on 2024-03-21; mark the form-submit/signup as a key event and map funnel steps. [Certain]
- **Consent first:** Google Consent Mode v2 has been enforced for EEA/UK/CH since March 2024. Default-denied consent must run before GTM loads; tags fire only after consent. A working refuse path with no dark patterns. [Certain]
- This skill owns the design and the instrumentation spec. Hand the actual wiring to the existing `seo` and `analytics` skills rather than duplicating their code.

## D.7 A/B testing

- Test one variable at a time, highest-leverage first: headline, then primary CTA copy/color, then hero visual. Keep variants structurally identical so the test is clean.

## D.8 Modern, elegant 2026 landing feel (without hurting performance/SEO)

- Apply the `rules/design/trends-2026.md` trends in a performance budget: layered depth and a confident variable-font headline read premium; scroll-telling and parallax add motion only behind a reduced-motion fallback and within the CWV targets above. Motion must never delay LCP or cause layout shift (CLS). Elegance here is restraint plus one or two strong moments, not effects on every section.

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section D; repointed Section A reference to rules/design/trends-2026.md. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
<!-- Version: 1.1.0 | 2026-10-22 | D.1 gains the landing Pattern ID and section-order lookup via scripts/design-lookup.sh (v4.31.0) -->
