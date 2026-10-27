---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# Domain Profile: E-commerce / Consumer Retail

> One of the domain profiles indexed by `rules/design/domains/_defaults.md`. Load this with the defaults file when the detected domain is e-commerce.

- **Feel:** desire plus confidence. Make the product desirable and buying feel safe and effortless. Imagery carries desire, trust signals and a clean checkout carry confidence. Aspirational on browse/PDP, calm and reassuring at checkout.
- **Color:** brand-forward neutrals for chrome plus ONE reserved high-contrast accent for the commerce CTA (Add to Cart/Buy Now). What matters is contrast against the page, not the hue. Reserve red for sale price and urgency, not the primary CTA.
- **Typography:** scannable hierarchy, price as first-class (current price largest, compare-at de-emphasized, savings colored). Product title second, then short benefit-led copy. Tabular numerals for prices/ratings. Mobile is the majority surface.
- **Density and layout:** mobile-first. PLP responsive grid with reachable faceted filters (filters let users finish 25 to 50% faster). PDP gallery-led with an adjacent prominent buy box, then trust block, then details/reviews. Sticky Add-to-Cart on mobile.
- **Signature components:** product card (image, title, price with strikethrough plus discount badge, stars plus count, quick-add); image gallery with zoom/video; high-contrast Add to Cart; cart drawer; short checkout flow with prominent guest checkout; faceted filters with applied-filter chips; reviews near title; trust badges near price and payment.
- **Trust signals:** star ratings plus counts; security badge and HTTPS at checkout; payment-method icons; return/refund and shipping surfaced early; prominent guest checkout (forced account creation drives 26% of abandonment); all-in pricing with no late surprise fees (unexpected cost is the #1 abandonment reason at 48%).
- **Compliance:** WCAG 2.1 AA is the de facto legal standard (do not let a low-contrast brand CTA fail it). E-commerce is ~70% of ADA web cases; do not rely on overlay widgets, build accessibility into components. PCI-DSS tokenized/hosted payment fields. GDPR/cookie consent with a working refuse path.
- **Motion budget:** subtle and conversion-supportive only (fly-to-cart, drawer slide). Never block or delay the path to purchase. No scroll-hijack or autoplay carousels.
- **Common mistakes (Baymard):** hidden costs late; forced account creation; overlong checkout; weak product imagery; poor mobile checkout; low-trust payment step; low-contrast CTAs blending into chrome.
- **References:** Apple, Allbirds, Glossier, Amazon (functional faceted-search/reviews/guest-checkout benchmark).

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section B.6. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
