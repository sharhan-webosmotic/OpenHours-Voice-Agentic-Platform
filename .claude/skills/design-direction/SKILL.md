---
name: design-direction
description: "Render 2-3 live HTML/Tailwind mockups of the Design DNA so the user picks ONE concrete visual direction BEFORE tokens lock, so what they pick is what gets built. Also flags requirement-document gaps and weak UX (wrong control patterns, missing states) as Recommended-vs-Current deltas via the ux-advisor agent. Runs after /design-discovery, before /design-tokens. Triggers on: 'show design directions', 'design samples', 'pick a direction', 'mockups to choose from', 'how should it look'."
next_skill: design-tokens
required_gate: "Gate 2 (Design System)"
mcp_integrations: [claude-in-chrome]
allowed-tools: "Read Write Edit Grep Glob WebSearch Task"
skill_id: SK-149
context_budget:
  load_kb: 30
  scope: task
version: 1.6.0
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [design-discovery]
  optional: [ux-advisor, image-generation]
produces:
  - path: AI_DOCS/design/design-directions/
    consumers: [design-tokens, design-screens]
  - path: AI_DOCS/design/design-directions/chosen.md
    consumers: [design-tokens, design-screens, build]
  - path: AI_DOCS/design/trend-sources.md
    consumers: [design-tokens, design-screens, principal-designer]
  - path: AI_DOCS/design/ux-recommendations.md
    consumers: [workscope, change-request, design-screens]
consumes:
  - path: AI_DOCS/design/design-dna.md
    required_sections: [brand-identity, color-palette, typography, shape-spacing, brand-voice]
  - path: AI_DOCS/design/design-research.md
  - path: rules/design/trends-2026.md
  - path: rules/design-language.md
  - path: AI_DOCS/planning/tech-spec.md
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [context-aware, sequential]
  role: "design-phase (between discovery and tokens)"
---

# /design-direction: Pick a Concrete Direction Before Tokens Lock

> **ACT AS:** Senior product designer presenting real options, not a swatch.
> **WHY THIS EXISTS:** Past builds scored low on UIUX because the user only ever saw the final result, never a choice. Capturing "how should it feel" in words is not enough. This skill turns the Design DNA into 2-3 living mockups so the user picks the direction that will actually be built. It also catches requirement and UX gaps (a filter built as toggle-chips when a dropdown fit the data) before code exists.

---

## When to Run

After `/design-discovery` has locked the Design DNA, before `/design-tokens`. The Design DNA describes the feel. This skill makes it visible and gets a decision.

Do not run without `AI_DOCS/design/design-dna.md`. If it is missing, run `/design-discovery` first.

---

## Pre-flight

Read:
1. `AI_DOCS/design/design-dna.md`: mood, colors, typography, density, radius, brand voice, motion.
2. `AI_DOCS/design/design-research.md`: reference products + observed patterns.
3. `AI_DOCS/planning/tech-spec.md`: sections 4 (flows) and 5 (UI/UX), to pick the representative screen and know the real data shapes.
4. `AI_DOCS/planning/project-classification.md`: strict vs advisory design rules.
5. `AI_DOCS/design/frontend-stack.md`: the locked component library (mockups should look like that library's output).
6. `rules/design/trends-2026.md` (the 2026 trend catalog) and the product's profile in `rules/design/domains/<domain>.md` (router: `rules/design-language.md`). The directions you render must look current and domain-appropriate, not generic.
7. `AI_DOCS/design/ux-brief.md` (from `/ux-foundation`): the role x JTBD table and the non-functional contract. Phase 1 structure is validated against these jobs, not against taste.

---

## Step 0: Grayscale UX structure FIRST (Gate UX-1) — before any color

> Track G: Requirement -> UX -> UI is three gates. The UI gate (color, tokens, the directions in Step 3) does NOT open until the UX STRUCTURE is validated in grayscale. This prevents the classic failure: debating color while the structure is wrong, and shipping a happy-path-only screen that dies on a real tenant's data.

Render the representative screen(s) as **grayscale wireframes** (no brand color, no final type, no surface styling: neutral greys, boxes, real labels). For each meaningful surface, lay out the FULL enterprise state set, not just the populated happy path:

- empty: first-run AND filtered-to-zero (distinct, different copy and action)
- loading / skeleton / partial-load
- populated at REALISTIC density (design for ~10,000 rows, not 3)
- error: network, validation, server, permission-denied (distinct treatments)
- no-permission / read-only variant per role (from the ux-brief roles)
- bulk-selection and bulk-action (where lists allow multi-select)

Then run **Gate UX-1 (UX Structure Validated)** below. Only on PASS do you proceed to Step 1 (tokens) and Step 3 (color directions). Record the verdict in `AI_DOCS/memory/gate-status.md` as `Gate UX-1: PASS` (the `design-gate.sh` hook blocks `design-system/**` and token writes until this marker exists).

### Gate UX-1 — UX Structure Validated (BLOCKING, no color until PASS)

| # | Check | Fail condition |
|---|-------|----------------|
| 1 | Grayscale only | Any Phase-1 artifact uses brand color, final type, or surface styling |
| 2 | IA built | `sitemap.md` / `navigation.md` / `onboarding-flow.md` present (design-screens Gate 3.5) |
| 3 | IA reconciled to data model | A nav domain object with no schema entity, or a core `database-schema.md` entity unreachable from nav |
| 4 | Flows per role | Any role from `ux-brief.md` without a flow including branch + failure paths |
| 5 | Flows trace to JTBD | Any flow not traceable to a job in `ux-brief.md` |
| 6 | Enterprise state coverage per surface | Any surface missing any required state above (first-run vs filtered-empty, realistic density, the four error types, read-only per role, bulk) |
| 7 | Nielsen heuristic pass | No single dominant element, no clear primary action, or a control that fights its data shape |
| 8 | WCAG 2.2 structural pass (pre-visual) | Focus order undefined, landmarks absent, any interactive node keyboard-unreachable |

FAIL blocks color and tokens. `N/A` carries a one-line reason. This is decidable entirely in grayscale, before a single token is chosen.

---

## Step 1: Derive preliminary tokens from the DNA

Tokens are not locked yet (that is `/design-tokens`). Derive a ROUGH token set from the DNA so the mockups are real, not lorem boxes:
- primary + one accent + neutral ramp (from the DNA primary color)
- font family + a 4-step type scale
- radius + spacing base (from the DNA shape/density)
- 3 elevation tiers (bg-tint + shadow, never border-only, per `rules/design-rules.md`)

Write them as CSS variables at the top of each mockup. The chosen direction's rough tokens become the seed for `/design-tokens`.

## Step 2: Pick the representative screen

Choose the ONE screen that best reveals UX quality: usually the primary data screen (main dashboard, the central list/table, or the core workflow), not the login page. This is where control-pattern mistakes show up. Populate it with realistic data drawn from the tech-spec entities, not placeholder text.

## Step 2b: Live trend sweep (source what is CURRENT, not what the catalog remembers)

> Why this step exists: `rules/design/trends-2026.md` is a snapshot written once. Directions generated only from a static catalog converge to the same AI look across projects. This step sources what is trending NOW, per project, so the directions carry fresh market language.

Two mechanisms, combined when both are available:

1. **WebSearch (always available):** search current trend roundups and award galleries (Awwwards, Dribbble blog, Behance curated galleries, design-week style reports) filtered by the product's domain profile keywords. This gives the trend LANDSCAPE in words.
2. **Claude-in-Chrome walk (when the extension + a live Chrome session are available):** navigate Dribbble / Behance / Awwwards search results for the domain keywords and actually LOOK: screenshot the strongest work and analyze it visually. If a platform limits anonymous browsing, ask the operator to log in in that Chrome session for full access. **Review at least 8-10 distinct designs** before forming candidates; fewer is a thin sample and the step is not done. Record every reviewed shot's source URL.

**Buildability screen (the concept-art filter).** A shot survives as a candidate only when BOTH hold:
- A real philosophy is extractable: color strategy, type system, density posture, elevation approach, motion budget, signature components. "Looks cool" with no articulable system is dropped.
- It can satisfy the enforceable minimums in `rules/design-rules.md`: state coverage (empty/loading/error), the responsive contracts, tokenizable values, accessibility, and realistic data density (would this survive a 10,000-row table). Dashboard concept art with three fake rows and no states is dropped, with the reason logged.

Write `AI_DOCS/design/trend-sources.md`:

```markdown
# Trend Sources — <project> (<date>)
Reviewed: <N> designs (list every source URL)

## Candidate 1: <name the aesthetic>
- Sources: <urls>
- Philosophy: <color strategy, type, density, elevation, motion, signature components>
- Fits this project because: <domain + requirement signal>
- Cost: <fonts, motion budget, build effort>
- Buildability: PASS (<one line>)

## Dropped
- <url>: <why it failed the buildability screen>
```

**Extraction, never cloning.** Candidates contribute a named aesthetic + craft moves, per `rules/design-rules.md` "Extract the thinking, never clone the artifact". Never copy a specific shot's exact colors, spacing, or composition into the mockups.

**Fallback:** when neither mechanism is available (offline, no extension, no results), fall back to `rules/design/trends-2026.md` and say so in `trend-sources.md`. The static catalog is the floor, not the primary source.

## Step 2c: Seed from the design dataset (offline, optional but default)

Before rendering, query the vendored design knowledge base for the product type so each direction starts from a real palette and font pairing instead of a hand-picked guess. Run these from the project root (read-only, no network, never `--persist`):

```bash
bash .claude/scripts/design-lookup.sh "<product type + mood keywords>" --design-system -f markdown -p "<project>"
bash .claude/scripts/design-lookup.sh "<product type>" --domain color -n 5
bash .claude/scripts/design-lookup.sh "<mood keywords>" --domain typography -n 5
```

Rules for using the output:
- The dataset SEEDS options and never decides. Each of the 2-3 directions takes a different seed (a different palette row and a different font pairing), so the set still spans a real range.
- Each direction states which dataset rows seeded it: palette row (`colors.csv` Product Type), font pairing name (`typography.csv`), and style row (`styles.csv` Style ID or the design-system Pattern name), written in the mockup header comment and in `chosen.md` under "Why".
- A seeded value that conflicts with the Design DNA, the domain profile, or the sourced trend philosophy (Step 2b) is dropped or adjusted, with the reason recorded. Contrast still has to pass `rules/design-rules.md`.
- If a seed pulls a generic default (glassmorphism, indigo or purple AI gradient, flat generic SaaS), it needs an explicit product reason in `design-dna.md`, per the guard in `rules/design-rules.md`.
- `design-system/tokens.json` stays the single source of truth. Nothing from the lookup is written to disk as a design system file.

## Step 3: Render 2-3 genuinely different directions (live HTML)

Produce 2-3 self-contained mockups of the SAME screen so the user compares like for like. Write each to `AI_DOCS/design/design-directions/direction-a.html`, `direction-b.html`, `direction-c.html`.

Each mockup is:
- a single self-contained `.html` file (Tailwind via CDN + the preliminary CSS-variable tokens inline), opens in any browser, no build step.
- the SAME screen and data, varied on a MEANINGFUL axis, not just color. Vary things like: information density (spacious vs compact), surface treatment (cards vs flat table vs panels), navigation (sidebar vs top vs split), and especially **control patterns**.
- emoji-free (Zero Emoji rule), uses Lucide-style inline SVG icons.
- honoring the strict design rules for data-heavy classifications (surface elevation, semantic color axis, contrast).

**Trend-direction axis (so directions look current, not like every AI build).** Draw the trend axes from the SURVIVING candidates in `AI_DOCS/design/trend-sources.md` (Step 2b) first; `rules/design/trends-2026.md` is the fallback vocabulary when the live sweep was unavailable. At least one direction explores a sourced candidate's aesthetic, and the set spans a real range rather than three recolors. Classic axes when falling back:
- **Layered-depth / bento**: asymmetric modular card grid, tinted surfaces, diffused (hued) shadows, ≥3 elevation tiers.
- **Calm / strategic-minimal**: generous whitespace, one clear CTA, progressive disclosure, type carrying the hierarchy.
- **Expressive / editorial**: a strong variable-font display layer, confident headline scale, controlled accent energy.

Each direction must still honor the chosen **domain profile** (Section B): a fintech direction shows trust signals and clear numeric hierarchy, a healthcare direction prioritizes legibility and calm, a gaming direction can carry more atmosphere. Never apply a trend that fights the domain (no neon-brutalist healthcare console). State, per direction, which trend axis and which domain cues it uses.

**Control-pattern discipline (the chip-filter fix).** Pick each control by the data shape, and make the three directions show defensibly different choices so the user sees the tradeoff:
- low-cardinality single-select (status, type): segmented control or dropdown, not a row of toggle-chips.
- high-cardinality multi-select (tags, categories): faceted checklist or a search-select, not chips that overflow.
- boolean: a single toggle.
- date/number range: a range control.
- free text: a search box with clear affordance.
Toggle-chips are appropriate only for a SMALL fixed multi-select set. If a direction uses chips, it must be the right case, and the rationale says why.

**Craft rubric (so "current-looking" is an explicit axis, not luck).** Each direction must demonstrate the craft moves from `rules/design-rules.md` → "Craft defaults", and the user picks against them. Honor the universal/dashboard-class split: the dashboard-only items apply only when the product is `data-dashboard` / `consumer-app` / `stats-heavy` / `fintech` / `analytics`. Check, per direction:
- elevation ladder visible (no border-only surfaces) and an interactive hover-lift present
- one confident accent applied as a gradient on named hero moments, neutral elsewhere; accent is not data
- tabular numerals on figures, tight heading tracking
- one restrained always-on live signal (if the product is real-time), with reduced-motion noted
- (dashboard-class) at least one real data-viz primitive rendered with tokenized inline SVG, chart color equal to status color
- (dashboard-class) identity treatment on any user-bearing view (gradient-initials avatar + name/role tooltip, `+N` stack)

Keep the control-pattern discipline below (no toggle-chips where a dropdown fits): it is good and stays.

> Optional: if the user prefers a faster first pass, use the `image-generation` skill to render static concept images first, then build the live HTML mockup of the chosen direction. The live HTML is still produced for whichever direction wins, since `/design-tokens` seeds from it.

## Step 4: Present and capture the choice

Show the user the three directions with a one-line rationale each (what axis each explores, what control patterns it uses, who it suits). Ask them to pick one, or to mix ("A's layout with B's filters"). Do not default silently.

Write `AI_DOCS/design/design-directions/chosen.md`:
```markdown
# Chosen Design Direction
Date: YYYY-MM-DD
Picked: Direction <A|B|C> (or a described blend)

## Why
- <user's reason / what they liked>

## Locked-in patterns (seed for /design-tokens)
- Density: <compact|comfortable|spacious>
- Surface: <cards|panels|flat>
- Navigation: <sidebar|top|split>
- Filter/control patterns: <per data shape>
- Preliminary tokens: <primary, accent, font, radius, spacing base>

## Sourced philosophy (the generative source)
- Candidate: <name from trend-sources.md, or "catalog fallback">
- Philosophy: <the extracted system: color strategy, type, density, elevation, motion, signature components>
- Sources: <urls>

## Source mockup
AI_DOCS/design/design-directions/direction-<x>.html
```

The **Sourced philosophy block is the generative source**: every subsequent page, screen, and component (`/design-tokens`, `/design-screens`, `/build`) derives from THIS philosophy and the tokens it seeds, never from a fresh aesthetic improvised mid-build. That is what keeps twenty screens looking like one product and keeps the product from looking like every other AI build.
Also update `design-dna.md` "Chosen Design Direction" pointer to this file.

## Step 5: Requirement-gap + weak-UX review (advisory, never silent)

Spawn the `ux-advisor` agent (read-only) on the tech-spec + the chosen direction. It returns a "Recommended vs Current" delta: places where the requirement document (the sources in `AI_DOCS/requirements/` or the requirements baseline) is thin or where the proposed UX is weak (wrong control for the data, missing empty/loading/error state, unclear primary action, poor information hierarchy, accessibility gap).

Write `AI_DOCS/design/ux-recommendations.md`:
```markdown
# UX & Requirement Recommendations
Date: YYYY-MM-DD

| # | Area | Current (per requirement) | Recommended change | Why |
|---|------|---------------------------|--------------------|-----|
| 1 | Orders filter | toggle-chips for 40+ statuses | searchable multi-select | chips overflow, no scan order |
| 2 | Dashboard empty state | not specified | define empty + first-run | screen breaks on zero data |
```
Present the top items to the user as advice (advisor stance: lead with the gap). The user decides what to adopt. Adopted changes route through `/change-request` so the spec, not just the design, is updated. Nothing here blocks: it is a recommendation, surfaced before code makes the mistake expensive.

## Step 6: Handoff

```
Design direction picked: Direction <X> (chosen.md written).
- Mockups: AI_DOCS/design/design-directions/direction-{a,b,c}.html
- Chosen: AI_DOCS/design/design-directions/chosen.md
- UX recommendations: AI_DOCS/design/ux-recommendations.md (N items)

Next: /design-tokens to lock the full token set from the chosen direction, then build core components.
```

---

## Rules

1. **Always 2-3 directions, always live HTML.** One option is not a choice. A description is not a mockup.
2. **Same screen, same data across directions**: vary on a meaningful axis, never just color.
3. **Controls follow the data shape**: never default to toggle-chips. Show the tradeoff across directions.
4. **The chosen direction seeds `/design-tokens`**: what the user picks is what gets built.
5. **UX recommendations are advisory**: surface gaps, never block. Adopted ones go through `/change-request`.
6. **Emoji-free, token-driven, strict-mode-aware**: same design rules as the rest of the system.

## Next Step

`/design-tokens`: finalize `design-system/tokens.json` from the chosen direction and build the core reusable components.

<!-- Version: 1.3.0 — 2026-06-29 — Track G: added Step 0 grayscale-first UX structure with the enterprise state set and Gate UX-1 (UX Structure Validated) before any color/tokens. Color directions (Step 3) gate on UX-1 PASS, enforced by hooks/design-gate.sh. -->
<!-- Version: 1.5.0 | 2026-08-06 | Step 2b live trend sweep: WebSearch trend roundups + Claude-in-Chrome walk of Dribbble/Behance/Awwwards (operator may log in for full access), minimum 8-10 designs reviewed with source URLs, buildability screen (extractable philosophy + design-rules minimums, concept art dropped with reason), writes AI_DOCS/design/trend-sources.md; Step 3 draws trend axes from surviving candidates with trends-2026.md demoted to fallback; chosen.md gains the Sourced philosophy block as the generative source for all subsequent screens/components. -->
<!-- Version: 1.6.0 | 2026-10-22 | Step 2c seeds each direction's palette, font pairing and style from the vendored ui-ux-pro-max dataset via scripts/design-lookup.sh (v4.31.0). Directions record the seeding rows. The dataset seeds options and never decides. -->
