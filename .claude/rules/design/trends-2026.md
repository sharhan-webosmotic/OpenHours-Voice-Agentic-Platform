---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
---

# 2026 Modern-UI Trend Catalog

> Section A of the design-language knowledge base. Index: `rules/design-language.md`. Read by `design-direction` (trend axes), `design-tokens` (color/motion direction), `landing-page` (modern feel). Each trend carries its concrete token or component implication so it drives real output, not just vocabulary. Grounded in the 2026 design-press trend reports (`rules/design/sources.md`).
>
> **This catalog is the FALLBACK, not the primary source.** `design-direction` Step 2b runs a live per-project trend sweep (WebSearch trend roundups + a Claude-in-Chrome walk of Dribbble/Behance/Awwwards, minimum 8-10 designs reviewed) and writes `AI_DOCS/design/trend-sources.md`. Fresh sourced candidates override this file. Fall back to this catalog only when the live sweep is unavailable (offline, no browser extension), and say so in `trend-sources.md`. A static snapshot ages; the sweep is what keeps the framework's designs from converging to one AI look.

## A.1 Named trends

| Trend | What it is | Token / component implication |
|---|---|---|
| **Bento grids / modular layouts** | Asymmetric modular card groups; large cards lead, small ones support. Compartmentalizes dense dashboards. | Asymmetric CSS grid with `gap` tokens; `Card` gains a size variant (`sm`/`md`/`lg`/`feature`); needs >=3 elevation tiers. Define a single-column mobile collapse order so the narrative survives. |
| **Evolved glassmorphism** | Subtle translucent layers (not heavy blur) with soft shadow and gradient borders. Best on dark, data-rich UIs for overlays. | Tokens: `--surface-glass` (rgba bg + `backdrop-filter: blur()`), `--border-gradient`. Reserve for modal/popover/notification surfaces, not base cards. |
| **Atmospheric depth** | UI as physical space: elements float via lighting and layering, using diffused colored shadows, not harsh black drops. | Shadow tokens carry hue and spread, not only black (`--shadow-glow-primary`). Minimum 3 elevation tiers. Border-only differentiation forbidden. |
| **Dark-first maturity** | Design dark theme first, adapt light second. Hierarchy from elevation/lightness, not saturation. | Author the token set dark-first where the domain suits it; each surface step needs >=1.1:1 luminance delta. |
| **Variable and kinetic typography** | One variable font replaces 6 to 8 statics; weight/width respond to scroll/interaction. Type as a hero. | One variable family with `font-variation-settings` axes (`wght`, `wdth`, `opsz`). Optional scroll-to-weight mapping. Cuts load time. |
| **Neo-brutalism / tactile** | Raw geometry, hard contrast, visible grids, flat or offset hard shadows. | Lower radius tokens, high-contrast borders, offset hard shadow. Project-classification gated: legit for dev-tools and edgy brands, warn-only elsewhere. |
| **Calm / strategic minimalism** | Default views show essentials only, generous whitespace, progressive disclosure, one clear CTA per screen. | Spacing scale weighted to large steps; one `primary` button per view; collapsed "Advanced" sections; explicit empty states. |
| **Invisible / inline AI** | Intelligence inside the workflow (suggestions, auto-classify, ghost text), not a badged side panel. | Inline-suggestion / ghost-text component, subtle "AI-touched" affordance, not a loud badge or bolt-on chat sidebar. |
| **Command palette (Cmd+K)** | Global keyboard shortcut to every action plus fuzzy search; recents surface by default. | `CommandPalette` as a standard primitive; needs a keybinding registry and a fuzzy-search util. Standard for power-user apps. |
| **Role-based / adaptive views** | Same product, different default view per role or behavior. | Layout config keyed to role; conditional default-route, not separate apps. |
| **Emotional design in B2B** | Completion celebrations, human-voiced empty/error/loading copy, personality without humor overload. | Completion-animation component (honors reduced-motion); copy tokens for empty/error/loading states. |
| **Adaptive color systems** | Saturated multi-color, gradients, duotones, neon micro-glow accents; palettes that react to context. | Semantic color axes as tokens; neon reserved for focus rings, badges, CTA outlines on dark. Optional ambient-adaptive hook. |
| **Humanized / imperfect** | Hand-drawn letterforms, organic curves, candid photography, intentional imperfection countering AI gloss. | Optional organic accent font; grain/texture overlay token. Accent layer only, never body. |
| **Scroll-as-navigation / scrollytelling** | Scroll for wayfinding (progress cues) and parallax depth-of-field (layers at different speeds). | Scroll-progress component; layered transform tokens. Common stack: GSAP ScrollTrigger + Lenis. Reduced-motion fallback mandatory. |
| **Functional 3D / spatial** | In-browser 3D via WebGPU/Spline, utility over spectacle. | Component-level, not a token concern. Lazy-load, code-split per route, ship a static poster fallback. |

## A.2 Looks 2026 vs looks dated

**Do (modern):** layered depth (tint + diffused/hued shadow + >=3 elevation tiers); asymmetric bento grids with deliberate size hierarchy; dark-first palettes where the domain suits it; one variable font driving multiple weights; neon/glow used surgically (focus, badges, CTA outline) on dark surfaces; one clear CTA per screen; progressive disclosure of advanced controls; functional motion only.

**Avoid (dated):** flat border-only cards with no surface or shadow delta; "corporate soft UI" (heavy uniform black shadows plus extreme radius everywhere); 6 to 8 static font files instead of one variable file; sterile pure-white (`#FFFFFF`) canvases (creamy off-whites read more current); loud badged AI panels bolted beside the workflow; saturation chaos (neon everywhere); decorative motion with no purpose.

## A.3 Motion and micro-interactions

- Functional, not decorative: every hover, click, type, and scroll gets an immediate proportional response. This is the single biggest premium-feel differentiator.
- Scroll-driven animation has matured: parallax depth-of-field (layers at different speeds) reads as 3D without a 3D engine.
- Kinetic type: font weight/width mapped to scroll position.
- Reduced-motion is mandatory. Honor `prefers-reduced-motion: reduce` (WCAG 2.3.3). Disable, shorten, or replace non-essential motion; do not strip all polish. Large-scale movement (parallax, zoom, sliding panels) is the highest risk and must sit behind the query. Duration bounds: micro 100 to 200ms, enter/exit 150 to 300ms.

## A.4 Color and typography direction (2026)

- **Color:** creamy off-whites (oat, limestone, undyed wool) replacing sterile bright white; earthy browns for warmth; wellness greens as fresh accents on dark; neon as micro-glow only (focus, badges, CTA outline on dark); adaptive palettes that respond to context. Pantone 2026 Color of the Year is Cloud Dancer (a soft near-white signaling simplification and focus).
- **Typography:** variable fonts as default (one file, axes for `wght`/`wdth`/`opsz`); expressive-plus-readable pairing (a bold display font with a clean body); modern serif revival for editorial contexts; type as hero (stacked, stretched, kinetic headlines).

## A.5 AI-era UI patterns

- **Generative UI spectrum:** controlled (agent fills a fixed template), declarative (agent picks from known components), open-ended (agent renders freely). Core contract: the agent controls intent and data, the developer controls rendering.
- **Affordances are invisible by default in genUI.** Making them visible is the designer's job: expose hover-reveal controls, edit handles, and "regenerate" affordances on AI-rendered blocks.
- **Invisible AI beats badged AI:** contextual suggestions and ghost text inside the existing workflow.
- **Conversational UI is still too linear:** chatbots break when users deviate. Design for flexibility without losing clarity.
- **Trust and transparency:** users must always know when AI is involved. Surface inline citations and an expandable "why" affordance even if seldom opened.

<!-- Version: 1.0.0 (2026-06-30): split from design-language.md Section A into a standalone trends file. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
