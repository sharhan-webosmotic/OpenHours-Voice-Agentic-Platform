---
name: design-discovery
description: "Design discovery phase: capture Design DNA (brand mood, colors, typography, audience, density), conduct stakeholder interviews, and lock the frontend stack + component library. Produces AI_DOCS/design/design-dna.md and confirms chosen component library. Use at project start after tech-spec is approved, before any tokens or screens are designed. Pairs with /design-tokens (next) and /design-screens (final). Also triggers on: 'Start design', 'Choose component library', 'Frontend stack confirmation', 'Pick design direction'."
mcp_integrations: [context7]
skip:
  - "Create tokens (use /design-tokens)"
  - "Build screens (use /design-screens)"
next_skill: design-direction
required_gate: "Gate 2 (Design System)"
allowed-tools: "Read Write Edit Grep Glob WebSearch WebFetch"
skill_id: SK-004
context_budget:
  load_kb: 30
  scope: task
version: 2.8.1
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [tech-specification]
  optional: [project-types, prd-generation]
produces:
  - path: AI_DOCS/design/design-dna.md
    consumers: [design-direction, design-tokens, design-screens, component-inspector]
  - path: AI_DOCS/design/frontend-stack.md
    consumers: [design-tokens, build, reactjs, nextjs]
  - path: AI_DOCS/design/component-registry.md
    consumers: [design-tokens, design-screens]
consumes:
  - path: AI_DOCS/planning/tech-spec.md
    required_sections: [user-roles, user-flows, ui-ux-requirements]
  - path: AI_DOCS/planning/project-classification.md
  - path: rules/design-language.md
  - path: rules/design/domains/_defaults.md
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [context-aware]
  split_from: design-system
  split_in: 3.1.0
  role: "design-phase (gates 1-2)"
---

# /design-discovery — Design Discovery + Stack Lock

> **ACT AS:** Expert UI/UX Designer in the discovery phase
> **CORE VALUES:** User-centered, accessibility-first, research-grounded
> **SCOPE:** Gates 1–2 of the 5-gate design process. Tokens are `/design-tokens`; screens are `/design-screens`.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (all free, auto-provisioned in the project `.mcp.json`):

- `context7` (free): current docs on candidate component libraries (shadcn, Radix, MUI, Mantine) for an informed stack pick.

---

## Non-Negotiable Rules (from v3.0 original, retained)

### Tech-Spec-First Approach

**NEVER start discovery without an approved Technical Specification.**

The tech-spec is the source of truth for:

- User roles and permissions (Section 3)
- User flows and journeys (Section 4)
- Screen-level UI/UX requirements (Section 5)
- Functional requirements and acceptance criteria
- Non-functional requirements (performance, accessibility)

### Zero Emoji Rule (NON-NEGOTIABLE)

> [!CRITICAL]
> **Emojis are PROHIBITED in all design output.**
> No emojis in UI labels, button text, form placeholders, error messages, navigation items, tooltips, or notifications. Professional text only. Icon system (Lucide by default) covers any visual reinforcement needed.

### Zero Code Comments Rule (NON-NEGOTIABLE)

> [!CRITICAL]
> **No comments in design component files.**
> Code must be self-documenting via naming. Exception: file-path header (`// PATH: src/...`) is allowed.

### Theme Discovery (ask BEFORE Batch A)

Three questions to lock before the main brand interview:

1. **Color Mode**: Light only | Dark only | Both (with toggle) | System preference
2. **Primary Brand Color**: Hex code or description (if known)
3. **Mood / Feel**: Professional/Corporate | Playful/Creative | Minimal/Clean | Bold/Energetic

Answers go into `AI_DOCS/design/design-dna.md` before Batch A extends them.

## Reference Documents

| Doc | Purpose |
|---|---|
| `templates/consistency-manifest.md` | Template for AI_DOCS/memory/consistency-manifest.md (design pattern consistency rules) |

---

## When to Run

| Trigger | Timing |
|---|---|
| Tech spec approved | Immediately after `/tech-specification` + Gate 1 passed |
| New project | After `/session-management` triage routing completes |
| User says "start design" / "discovery" | Explicit |

Do **not** run without an approved tech-spec — without user roles, flows, and UI requirements, discovery is guessing.

---

## Pre-flight

Read:

1. `AI_DOCS/planning/tech-spec.md` — sections 3 (roles), 4 (flows), 5 (UI/UX)
2. `AI_DOCS/planning/project-classification.md` — POC / MVP / Production-Grade
3. `AI_DOCS/planning/workscope.md` — industry, target audience, business goals
4. `AI_DOCS/design/design-research.md` (if produced earlier) — reference products, visual patterns. Otherwise this skill gathers them inline via WebSearch in the discovery step.
5. `rules/design-language.md` (router) — the per-domain design-language profiles in `rules/design/domains/` and the 2026 trend catalog `rules/design/trends-2026.md`. Load only the matching domain profile (see Step 0) plus `rules/design/domains/_defaults.md`. Used to ground the feel proposal in the product's industry, not a generic default.

---

## Instructions

### Gate 1 — Discovery

**Objective:** Lock the Design DNA.

#### Step 0 — Detect domain + mode (do this before anything else)

1. **Detect the domain.** From `workscope.md` (industry), `tech-spec`, and `project-classification.md`, identify which domain profile under `rules/design/domains/` fits: `fintech`, `healthcare`, `edtech`, `gaming`, `enterprise`, `ecommerce`, `social`, `logistics`, `government`, or `media`. Load that ONE file plus `rules/design/domains/_defaults.md`. It anchors the feel proposal, the color strategy, the density, the trust signals, the compliance overlay, and the motion budget. If the product spans two domains, load both and state which leads. If none fit cleanly, say so and proceed from first principles plus the closest profile. For a product outside those profiles, also run `bash .claude/scripts/design-lookup.sh "<product type>" --domain product` and use the nearest dataset product rule (its style, palette focus and landing pattern) as a POINTER only, recorded in `design-dna.md` as "nearest dataset rule: <Product Type>".

2. **Detect the design source: is design OUR scope, or client-supplied?** Ask when not already answered by the workscope/requirements:
   - **Design in scope (ours):** proceed with the mode detection below, then the full discovery. Downstream, `/design-direction` runs its live trend sweep (Dribbble/Behance/Awwwards via Claude-in-Chrome + WebSearch, minimum 8-10 designs reviewed) so the directions the user picks from are sourced from the current market, not a static catalog.
   - **Client-supplied designs (usually Figma):** do NOT invent a direction and SKIP `/design-direction`'s trend sweep: the client design IS the direction. Connect the **Figma Dev Mode MCP server** (gated, per `rules/mcp-rules.md`: the Figma desktop app running with the client file open), then hand ingestion to `/design-tokens` extraction mode (Figma variant): it pulls the screens, components, text content, image assets, and token values (colors, type, spacing, radii) into `design-dna.md`, the component-registry seed, and the screen inventory under `AI_DOCS/design/screens/`. Record `Mode: client-design (figma)` in `design-dna.md`. Downstream, the `fidelity` validator (`mavs/fidelity.json`) compares every built screen against the Figma-derived reference, so "follow the client's design" is machine-checked. Client-supplied non-Figma designs (images, PDFs) follow the same path with `markitdown`/image ingestion instead of the MCP.

3. **Detect the mode: greenfield vs migration.**
   - **Greenfield** (no existing UI code): proceed with normal discovery below.
   - **Migration / onboarding existing code** (an existing `src/`, a Tailwind config, a CSS-variable theme, or `codebase-migration` artifacts present): do NOT propose a fresh palette. The existing product already has a design. Hand token extraction to `/design-tokens` extraction mode (it samples the real colors, spacing, fonts, radii and writes `tokens.json` from them), then return here to *confirm* the extracted DNA with the user and fill only the genuine gaps from the domain profile. Record `Mode: migration (extracted)` in `design-dna.md`. The goal is continuity: the new work must match what the user already built, not replace its look.

**Reference research (MANDATORY — do this first, every project).** Before Batch A, ground the direction in real products. Using WebSearch, pull 3-5 reference products in the user's vertical, note their common moods, color strategies, layout and density patterns, and one differentiator each. Write findings to `AI_DOCS/design/design-research.md`. This is not "only if the user has no preference": even a user with a strong opinion gets sharper options when the choices are grounded in what real products do. Never invent a direction from scratch.

Ask questions in **two batches** (don't mix them):

#### Batch A — Brand Identity & Feel

1. **Design Feel / Mood** — "How should users FEEL when they use this?"

   | Project Type | Recommendation |
   |---|---|
   | Healthcare / Medical | Clean, calm, trustworthy — soft blues, whites, subtle greens |
   | Finance / Banking | Professional, secure, reliable — dark blues, grays, gold accents |
   | E-commerce / Consumer | Vibrant, friendly — bold colors, rounded shapes |
   | B2B SaaS / Admin | Efficient, focused, minimal — neutral palette, compact layout |
   | Education / Learning | Warm, inviting — warm colors, spacious layout |
   | Logistics / Operations | Functional, data-focused — muted colors, compact density |
   | Social / Community | Fun, approachable — bright accents, playful shapes |

   Always propose a direction with rationale, never ask blankly.

   The table above is a starting point. Ground the proposal in the **domain profile** loaded in Step 0 (`rules/design/domains/<domain>.md`): use its Feel, Color strategy, Density, Trust signals, and Common mistakes to make a specific, defensible recommendation, then ask the user to confirm or redirect. Probe the feel concretely rather than abstractly: "should this read more like [reference product A] or [reference product B]?", "calm and spacious, or dense and powerful?", "should it feel premium and quiet, or energetic and bold?" Capture the answer in the user's own words.

2. **Brand Colors** — existing guidelines? If not, AI proposes palette with WCAG AA verification and color-blind safety.

3. **Target Audience** — age range, tech literacy, device context (mobile-first? desktop at work?)

4. **Favicon / App Icon** — existing? If not, AI proposes + specifies sizes.

5. **Theme Mode** — Light only | Dark only | Both (with toggle) | System preference. Default: Light only.

#### Batch A2 — Brand Voice, Motion & Accessibility

A1. **Brand voice / tone** — how should the copy read? Professional | Friendly | Playful | Technical | Warm | Direct. Drives button labels, empty-state copy, and error messages (no emojis, per the Zero Emoji rule).
A2. **Micro-interaction style** — how should motion feel? Snappy/minimal | Smooth/elegant | Playful/bouncy. Honors `prefers-reduced-motion` regardless (see `rules/design-rules.md` Motion).
A3. **Accessibility as a brand value** — is visible accessibility a priority (high-contrast defaults, large touch targets, clear focus)? If yes, the Design DNA records it and `/accessibility-audit` holds a higher bar.

#### Batch B — Technical Design Choices

6. **Typography**: preferred font family. Do not hand-pick: run `bash .claude/scripts/design-lookup.sh "<mood and domain keywords>" --domain typography -n 5` and present 2-3 pairings from the result, each with heading font, body font, and the Google Fonts import line (`CSS Import` or `Google Fonts URL` column). Recommend one with a one-line reason tied to the mood and domain, and let the user confirm or redirect. Record the chosen pairing and its source row in `design-dna.md`. The dataset seeds the options, the user and the domain profile decide. If the lookup returns nothing relevant, say so and fall back to the domain profile.
7. **Border Radius Style** — Sharp (0px) | Rounded (4-8px) | Pill (12-16px+)
8. **UI Density** — Compact | Comfortable | Spacious
9. **Form Style** — Bordered | Filled | Underline
10. **Sidebar Layout** — Left sidebar | Top navigation | Both
11. **Icon Set** — default: Lucide React (pairs with Shadcn/ui)

#### Project-classification gating (Issue 2 integration)

If `project-classification.md` indicates `data-dashboard`, `consumer-app`, `stats-heavy`, `fintech`, or `analytics`:

- Apply `rules/design-rules.md` strict mode — border-only cards are forbidden
- Require surface-elevation strategy (tinted bg / shadow / gradient) in the Design DNA
- Require at least one semantic color axis (positive/negative/neutral)

Otherwise `dev-tool` / `minimal-utility` — rules apply as warnings only.

### Design DNA output

Write `AI_DOCS/design/design-dna.md` with sections:

- **Domain & Mode** — the domain profile applied (from `rules/design/domains/<domain>.md`) and `Mode: greenfield`, `Mode: migration (extracted)`, or `Mode: client-design (figma)` (from Step 0)
- **Brand Identity** — mood, keywords, reference feel (grounded in `design-research.md`), in the user's own feel-words
- **Craft Target (REQUIRED)** — the named aesthetic this product is aiming for, captured so every later skill honors it:
  - **Reference aesthetic (named):** name a real reference product family from the Phase 1 research (for example Linear/Vercel, Stripe, Notion, Figma) plus a one-line description of the feel (such as "calm, precise, depth from light and shadow, confident accent, rich data-viz, not a flat or border-only admin look"). This is the craft target, not a layout to copy: see the extract-not-clone principle in `rules/design-rules.md`.
  - **Depth & data-viz stance:** state the elevation strategy explicitly (flat / subtle / elevated-with-hover-lift) and, for any stats-heavy product, the data-viz stance (hand-rolled tokenized SVG vs a charting library). This is what lets `/design-tokens` carry `chart.*` and the hover-lift token rather than inventing them per project.
- **Brand Voice & Tone** — copy personality keywords; the voice for labels, empty states, errors
- **Micro-interaction & Motion** — motion style + reduced-motion behavior
- **Accessibility Commitment** — whether a11y is a stated brand value + the resulting defaults
- **Chosen Design Direction** — pointer to the picked `AI_DOCS/design/design-directions/chosen.md` (filled by `/design-direction`)
- **Color Palette** — primary / secondary / neutral / semantic (positive/negative/neutral if applicable) with hex values and token names
- **Typography** — font families, full scale (xs/sm/base/lg/xl/2xl/3xl/4xl/5xl), weights, line heights
- **Shape & Spacing** — radius tokens, spacing scale (4px base), breakpoints
- **Elevation & Surfaces** — 3-tier elevation system (0/1/2) with mechanism (bg-tint + shadow), not border-only
- **Components** — shadcn / MUI / etc.
- **Layout** — shell structure, sidebar vs top nav
- **Responsive Breakpoints** — desktop / tablet / mobile / RN if applicable
- **Icons** — set + library import
- **Favicon & App Icons** — sizes required
- **Approved status** — timestamp + approver

Present it to the user. Get **explicit approval** before moving to Gate 2.

**Impeccable PRODUCT.md (when `skills/impeccable/` is installed):** once the Design DNA is approved, generate `PRODUCT.md` at the project root FROM `design-dna.md`, `AI_DOCS/memory/project-context.md`, and `ux-brief.md` content (platform, audience, brand commitments, accessibility requirements). Do NOT run `/impeccable init`'s interview: the facts already exist in AI_DOCS, and a second interview would drift from the first. Regenerate the file the same way whenever those sources change.

### Gate 2 — Component Library & Frontend Stack Confirmation

**Objective:** Lock stack before any UI code.

1. **Ask stack questions:**
   - Framework (React / Next.js / Angular / Vue / RN / Flutter / SwiftUI)
   - Styling (Tailwind / CSS-in-JS / CSS Modules / Styled Components)
   - State (Redux / Zustand / Context / RTK Query / Pinia / etc.)
   - Existing libraries already in the codebase?

2. **Present component library options:**

   | Library | Best For | Notes |
   |---|---|---|
   | Shadcn/ui + Tailwind | Next.js, React | Copy-paste components, full Design DNA integration |
   | MUI | React enterprise / admin | Mature, heavy |
   | Ant Design | Enterprise / B2B | Feature-rich |
   | Chakra UI | React | Accessibility-first |
   | React Native Paper | RN | Material 3 |
   | Vuetify | Vue | Material |
   | Angular Material | Angular | First-party |

3. **Coverage Check:** verify the chosen library covers all UI atoms needed by tech-spec (tables, layouts, avatars, badges, forms, pickers, charts).

4. **Document:**
   - `AI_DOCS/design/frontend-stack.md` — locked stack decisions
   - `AI_DOCS/design/component-registry.md` — initialize empty registry; will be populated by `/design-tokens` + `/design-screens`

### Update gate status + telemetry

- `AI_DOCS/memory/gate-status.md`: Gate 2 → PASS
- Emit telemetry:
  ```bash
  bash hooks/log-event.sh "\"event\":\"gate.verdict\",\"gate\":\"G2\",\"verdict\":\"pass\""
  ```

### Handoff

Print:

```
Design DNA captured + frontend stack locked.
- design-dna.md: AI_DOCS/design/design-dna.md
- frontend-stack.md: AI_DOCS/design/frontend-stack.md
- component-registry.md: AI_DOCS/design/component-registry.md (empty, ready)

Next: /design-direction to render 2-3 live mockups of the Design DNA so the user picks a concrete direction BEFORE tokens lock. Then /design-tokens.
```

---

## Examples

### Example 1: Fintech dashboard

**User says:** "start design for the Acme Invest dashboard"

**Actions:**

1. Read tech-spec: B2C fintech, retail investors, 3 user roles
2. Read project-classification: `fintech` + `data-dashboard` → strict design rules
3. Batch A: recommend dark-blues + gold accent, professional mood, mobile + desktop parity
4. User approves mood, picks navy #0A2540 as primary
5. Batch B: Inter + Manrope, rounded 8px, comfortable density, filled forms, left sidebar + mobile bottom tabs
6. Write design-dna.md with 3-tier elevation (card=tinted, modal=shadow, popover=shadow+border-radius) + semantic colors (positive=#0f8f3e, negative=#c62828, neutral=#64748b)
7. Gate 2: stack is Next.js 15 + Tailwind + shadcn/ui + Zustand
8. Component registry initialized
9. Handoff to `/design-tokens`

### Example 2: Internal dev tool

**User says:** "design the internal test-runner UI"

**Actions:**

1. Tech-spec: internal tool, engineers only
2. Project-classification: `dev-tool` / `minimal-utility` → design rules are warnings only
3. Batch A: minimal, functional — monochrome palette fine; AI explicitly notes that border-only cards are OK for this project type
4. User confirms: grayscale + single accent, dense layout
5. Batch B: JetBrains Mono + system font, sharp 2px radius, compact density
6. Write design-dna.md with 2-tier elevation (or 1-tier; flat is OK here)
7. Gate 2: stack is React + Tailwind + headless
8. Handoff

---

## Troubleshooting

### User has no preference and no reference products

**Solution:** gather reference products inline first. Using WebSearch, pull 3-5 reference products in the same vertical and propose a feel based on observed patterns. Write them to `AI_DOCS/design/design-research.md`. Never invent from scratch.

### User skips Batch B questions

**Solution:** propose defaults based on project type + accepted Batch A answers. State the defaults, ask for confirmation. Don't let defaults go in silently.

### Component library doesn't cover all UI needs

**Solution:** document the gap explicitly in `frontend-stack.md`; the gap becomes an item for `/design-screens` to resolve (often via custom primitives on top of the library).

### Design DNA gets too long

**Solution:** move reference screenshots, color swatches, and usage examples into `AI_DOCS/design/references/`. Keep `design-dna.md` under ~500 lines.

---

## Rules

1. **Never design without an approved tech-spec.**
2. **Design DNA is locked after Gate 1 approval** — changes require `/change-request`.
3. **No dark-mode styles** in components unless Design DNA specifies `Both` or `Dark only`.
4. **No hex codes** in code — tokens only.
5. **Project classification gates strict mode** — see `rules/design-rules.md`.
6. **Gate 2 blocks code generation** — no UI code until frontend stack is locked.

## Next Step

`/design-direction` — render 2-3 live HTML mockups of the Design DNA, flag requirement/UX gaps, and let the user pick a concrete direction. Then `/design-tokens` finalizes tokens from the chosen direction.

<!-- Version: 2.7.1 | 2026-08-21 | Impeccable PRODUCT.md: when skills/impeccable/ is installed, PRODUCT.md is generated at the project root from design-dna.md + project-context.md + ux-brief.md facts (platform, audience, brand commitments, accessibility) instead of running /impeccable init's interview, so two interviews cannot drift. -->
<!-- Version: 2.7.0 | 2026-08-06 | Step 0 gains the design-source branch: design-in-scope (ours, routes to the design-direction live trend sweep) vs client-supplied designs (skip trend sweep, connect the gated Figma Dev Mode MCP, hand ingestion to design-tokens Figma-extraction, fidelity.json compares built screens against the Figma-derived reference); design-dna.md Mode gains client-design (figma). -->
<!-- Version: 2.8.0 | 2026-10-22 | Typography step now queries font pairings via scripts/design-lookup.sh and presents 2-3 pairings with Google Fonts import lines. Products outside the domain profiles use the nearest dataset product rule as a pointer (v4.31.0). -->
<!-- Version: 2.8.1 | 2026-10-22 | v4.32.0: project-kickoff retired, new-project trigger now points at session-management triage routing, and team-design removed from consumers -->
