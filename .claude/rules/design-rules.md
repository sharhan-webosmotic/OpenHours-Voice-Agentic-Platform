---
paths:
  - "AI_DOCS/design/**"
  - "design-system/**"
  - "src/components/**"
  - "app/**"
  - "pages/**"
---

# Design Rules

Encoded design bans + minimums. Gated by project classification (set via `/project-types`).

Project classification lives in `AI_DOCS/planning/project-classification.md`.

> Domain design languages (fintech, healthcare, edtech, gaming, etc.) live in `rules/design/domains/`, the full 2026 trend catalog in `rules/design/trends-2026.md`, routed by `rules/design-language.md`. This file holds only the *enforceable* subset. Implementation-level UI quality (spacing, forms, animation, hydration) lives in `rules/ui-engineering-rules.md`; responsive/state/perf in `rules/frontend-rules.md`. Do not duplicate those here.

## Applies to: `data-dashboard`, `consumer-app`, `stats-heavy`, `fintech`, `analytics`

Hard rules — `component-inspector` fails any component that violates these.

### Surface differentiation (no border-only cards)

Cards and their body MUST differ by **at least one** of:

- **Tinted background** — ≥3% luminance delta from body background
- **Shadow** — elevation token from design-system (sm/md/lg)
- **Gradient** — subtle surface gradient, not decorative
- **Combination** — any two of the above

**Border-only differentiation is forbidden.** A card with only `border: 1px solid var(--border)` and no surface delta fails the audit.

### Contrast between adjacent surfaces

- Minimum luminance delta between nested surfaces: **1.1:1**
- Applies recursively: body → card → card-inner, each step must meet minimum

### Surface elevation tiers

Data-dense UIs must have **at least 3 elevation tiers** in the design-system tokens:

- `--elevation-0` — body / canvas
- `--elevation-1` — cards / panels
- `--elevation-2` — modals / popovers / elevated content

Elevation achieved via any combination of bg-tint + shadow + border; not via border alone.

### Semantic color axes

At least **one semantic color axis** must be defined as tokens:

- Positive / negative / neutral (for metrics: green up, red down, gray flat)
- Or equivalent (primary/secondary/tertiary for data-series)

Tokens must exist in `design-system/tokens.json`:

```json
{
  "semantic": {
    "positive": "...",
    "negative": "...",
    "neutral": "..."
  }
}
```

## Applies to: `dev-tool`, `cli-adjacent-admin`, `minimal-utility`, `internal-only`

**Rules above are warnings only, not blockers.**

- `component-inspector` reports violations but does not fail the gate
- Rationale: minimal aesthetics are legitimate for developer/power-user tools
- Users can still opt-in to full enforcement via `project-classification.md`: `enforce_design_minimums: true`

## Universal (applies to all classifications)

### Contrast for text

- Body text: ≥4.5:1 against its background (WCAG AA)
- Large text (≥18pt or ≥14pt bold): ≥3:1
- Verified by `/accessibility-audit`

### Touch / click targets

- Mobile / touch: ≥44×44 CSS pixels
- Desktop: ≥32×32 CSS pixels
- Measured bounding box (including padding), not just the visible element

### No raw hex values in components

- All colors from `design-system/tokens.json` via CSS variables or design-token import
- No `#FF5733` in a component file — always `var(--color-primary-500)` or `tokens.colors.primary[500]`
- Enforced by `component-inspector` via AST scan

### No raw px values for spacing

- Spacing from the 4px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 (or token names)
- Exceptions: positioning (absolute/fixed offsets), 1px borders/dividers — documented per-case

### Focus states

- Every interactive element needs a visible focus state
- Focus ring token: `--focus-ring` in design-system tokens

### 2026 modern-look minimums

The enforceable subset of `rules/design/trends-2026.md`. These are minimums for `data-dashboard` / `consumer-app` / `stats-heavy` / `fintech` / `analytics` (warnings only for `dev-tool` / `minimal-utility`, same gating as the surface rules above).

- **Layered depth, not flat fills.** A surface that should read as elevated uses tint AND/OR shadow, never a single flat fill differentiated only by a border. Extends the border-only-card ban: shadows may carry a subtle hue/spread (diffused depth), not only flat black.
- **One clear primary action per view.** Exactly one `primary` button variant should dominate a given screen state. Competing primary CTAs are a violation.
- **Type does work.** A defined type scale (`rules/design/trends-2026.md` A.4) with a clear display-vs-body distinction. Prefer one variable font family over many static weights where the stack supports it. No single-size, single-weight walls of text for content-heavy screens.
- **Motion has a purpose.** Every animation gives feedback or aids wayfinding. Decorative-only motion is a violation. (Duration bounds + reduced-motion below.)
- **Off-white over pure white for large canvases** where the brand allows: a creamy/neutral canvas reads more current than `#FFFFFF`, and reduces glare. Not mandatory, never a fail, but the recommended default.

### Design with intent (every decision is reasoned, BLOCKING)

No design choice is made on autopilot because a screen was "given". Every screen and every control carries a deliberate rationale, and the reviewer can ask "why this and not the alternative" for any of them.

- **Controls are chosen by data shape, and the choice is recorded.** Pick each filter, selector, and input from the data it drives, never a default reflex. The decision (control type + why) is written into the screen's design notes or `ux-recommendations.md`, not left implicit. The data-shape-to-control mapping is the one in `component-inspector` → "Filter & control discipline": low-cardinality single-select → segmented/dropdown (never a row of toggle-chips); high-cardinality multi-select → faceted checklist or search-select; boolean → toggle; range → range control; free text → labeled search. Toggle-chips are correct only for a small fixed multi-select set.
- **Filter area is designed, not bolted on.** Where a list/table has filters, the filter area is a deliberate layout decision (placement, persistence, clear-all, active-filter feedback, empty-result state), reasoned against how the user actually narrows the data. A pile of controls with no scan order is a violation.
- **Every screen states what it is for.** Each screen's design notes name its primary user task, its one primary action, and its empty/loading/error intent. A screen produced with no stated purpose is incomplete, regardless of how it looks.

This is the enforceable form of the extract-not-clone principle: the craft moves and the requirement are inputs to a reasoned design, never a template to stamp out.

### The dataset seeds options and never decides (BLOCKING for generic defaults)

The vendored design dataset (`vendor/ui-ux-pro-max/`, queried through `scripts/design-lookup.sh`) returns style, palette and font suggestions per product type. Treat every row as an option to weigh.

- **Generic defaults need a product reason.** Glassmorphism, indigo or purple "AI" gradients, and the generic flat SaaS look are the dataset's most common suggestions and the most common sameness trap. Using one requires an explicit product reason recorded in `AI_DOCS/design/design-dna.md` (why this product, this audience, this domain). No recorded reason, no generic default.
- **`principal-designer` still gates.** A dataset-seeded direction passes the same craft review as any other.
- **`design-system/tokens.json` stays the single source of truth.** Never persist a dataset design system (`--persist` is refused by the wrapper). Seeded values enter the project only by being written into `design-dna.md` and `tokens.json` through the normal flow.
- **Record the seed.** When a dataset row influenced a decision, note the row (palette Product Type, font pairing name, Pattern ID, UX guideline No) next to the decision.

### Auth, navigation & exit paths (BLOCKING when the app needs them)

These are NOT gated by project classification. A dev tool with a login still needs a logout. Apply whenever the app has authentication or more than one navigable screen.

- **Front door + exit.** If the app has auth, there is a reachable sign-in path and a visible sign-out path. If it has accounts, password-reset and session-timeout re-auth flows exist.
- **Every non-root screen has a way back.** A back/exit affordance on every screen past the entry: top-left back on mobile, breadcrumb or persistent nav on web, close on modals. No screen is a dead end.
- **Navigation is consistent and visible.** One primary navigation pattern (sidebar, top, or both) applied uniformly across authenticated screens.
- **Role-based items are hidden, not just disabled** when the current role lacks access (mirrors RBAC).

Enforced by `/design-screens` Auth / Navigation / Exit-path Gate (BLOCKING) and re-checked by `component-inspector`.

## Craft defaults (2025-era product UI)

> Why this section exists: a design can pass every rule above and still read as a flat, generic admin panel. These are the craft moves that separate "compliant" from "current". They are encoded as defaults, not options. The split below mirrors the strict-vs-warning gating used throughout this file.

### Extract the thinking, never clone the artifact (PRINCIPLE)

When a project admires a reference product, capture the *named aesthetic + the craft moves* into `design-dna.md` and `tokens.json`, then design this product's own screens from those principles. Never copy a reference's (or another project's) exact colors, gradient stops, letter-spacing/tracking values, spacing numbers, formats, layout, or components. A reference is a target for the craft, not a skin to reuse.

The craft moves below, and any example values anywhere in the design skills (token schemas, sample tracking, sample shadows), encode the *thinking and the structure*, never fixed values to stamp out. What is mandatory is that the relationship holds (the elevation ladder exists, chart color equals status color, headings carry tight tracking, the accent stays separate from the semantic axis). The concrete numbers and colors are always derived per project from its own Design DNA, chosen direction, domain, and typeface. A design built by copying a prior project's literal values, instead of reasoning them out for this product, is the failure this principle forbids.

### Universal craft (all classifications; warnings-only for `dev-tool` / `minimal-utility`)

- **Depth is a system, not a border.** Define a 3-tier elevation ladder as tokens (canvas → card → overlay) built from tint and/or shadow. Interactive cards get a **hover-lift** (a small `translateY` plus a step up in shadow) declared as a named token, not an ad-hoc style. This is the positive form of the existing border-only-card ban: it is not enough to avoid borders, the ladder and the lift must exist.
- **One confident accent, applied as a gradient on a few hero moments.** Pick a single accent identity and a short, named list of hero moments where it appears as a gradient (hero stat, active-nav spine, primary CTA, logo mark, progress fill). Everything else stays neutral. The brand accent never encodes data meaning: keep it separate from the semantic/status axis so the two never fight. Provide the dark-mode accent lift as a token, not an afterthought.
- **Numeric craft.** Enable tabular numerals (`font-variant-numeric: tabular-nums`) on every figure and table column by default, so digits align and live counters do not jitter. Apply tight heading tracking (around `-0.02em`) and a subtle body tracking for the chosen font's optical feel. Compact density is a first-class option with a hard floor at 32px desktop / 44px touch and a mandatory visible focus ring.
- **One restrained live signal (real-time products).** Ship exactly one always-on animated signal (such as a `LiveDot` pulse) that proves the product is live, never many. Pair it with a `prefers-reduced-motion` fallback to a static state and a visible "reconnecting" affordance so a stale view is never mistaken for current.

### Dashboard-class craft (`data-dashboard` / `consumer-app` / `stats-heavy` / `fintech` / `analytics`; warnings-only elsewhere)

- **Data-viz is tokenized and hand-rolled.** Define a `chart.*` token block that **reuses the semantic solids**, so chart color equals status color (an "on track" ring, badge, and row dot are the same token). Prefer hand-rolled inline-SVG primitives (sparkline, donut/progress-ring, area, segmented bar) over a charting library whose default palette will not match the design system and whose bundle cost is wasted on a few small visuals. A chart that resolves color from a literal hex instead of `chart.*` / semantic tokens is a violation.
- **Chart selection lookup.** Pick the chart type from the data shape, not habit: `bash .claude/scripts/design-lookup.sh "<data shape, e.g. trend over time, part of whole>" --domain chart` returns the best chart type, secondary options, when not to use it, color guidance and an accessibility fallback. Record the choice next to the control-pattern decision. The `chart.*` token rule above still decides color.
- **People are shown with identity.** For any user-bearing view, ship a `UserAvatar` (gradient initials, color from a stable hash of the user id so a person's color is consistent app-wide, name + role tooltip on hover/focus) and an `AvatarStack` (`+N` overflow listing the remaining names). Keyboard-reachable so the tooltip is accessible. The flat gray-circle-with-two-letters treatment is the failure this prevents.

These craft moves are gate-able the same way the surface rules are: `component-inspector` asserts the elevation ladder and hover-lift exist in tokens, charts resolve color from tokens, and figures use tabular numerals (positive checks for dashboard-class projects).

## Layout craft (relationships, not just tokens)

> Why this section exists: a screen can pass every token rule and still read as junior work. Token rules check that a value is legal. These rules check that values RELATE correctly: consistent rhythm, shared alignment edges, a real hierarchy, balanced whitespace, and uniformity across the milestone. Strict for `data-dashboard` / `consumer-app` / `stats-heavy` / `fintech` / `analytics`, warnings-only for `dev-tool` / `minimal-utility`.

### Spacing rhythm (the same relationship uses the same step)

- A given semantic relationship uses ONE step value everywhere: label-to-input, card-to-card, section-to-section, heading-to-body. Pick the step once per relationship and hold it across every screen, because a relationship that changes size screen to screen reads as inconsistency rather than intentional design.
- Vertical rhythm is built from one base unit (8px, half-step 4px). Every stacked gap is a multiple, and adjacent gaps stay on the same scale together: a non-scale gap next to a scale gap is exactly what makes the rhythm visibly break.
- Whitespace scales WITH hierarchy: more space above a section heading than between its rows. Equal spacing above and below a heading is a violation (the heading must bind to its content).

### Alignment (everything sits on shared edges)

- Define a layout grid (columns plus gutter) and place every region on it. Content blocks share left edges. A label, its input, and its helper text share one left edge.
- Numeric columns right-align, and text columns left-align, because a right-aligned column of numbers lets the eye compare magnitudes straight down the decimal point. A centered data column is a violation.
- Optical alignment overrides metric alignment where they fight: an icon next to text aligns to the text optical center, not its bounding box. A single glyph in a circular button is optically centered, not geometrically.
- No element is "almost aligned": a 1 to 7px offset from a shared edge reads as broken. Snap to the edge or commit to a deliberate, larger offset.

### Visual hierarchy (one ladder, one dominant element)

- Each view has a single dominant element (the hero metric, the page title, the primary CTA). It wins on size OR weight OR color, and nothing competes with it.
- At least three distinct type levels are visible on a content screen (display/title, body, caption/label). Adjacent levels differ by a perceptible step (roughly a 1.2x or more size ratio or a full weight step), because a step smaller than that is invisible to the reader. Two "headings" one size apart by 1 to 2px is not a hierarchy: the reader cannot tell which one wins.
- Hierarchy comes from size, weight, and space first, color last. A screen that relies on color alone to rank importance fails (and breaks for color-blind users).

### Action placement (location, not just count)

- Primary action placement is consistent across the app: dialog actions bottom-right (primary rightmost), form submit bottom-left-aligned to the field column or full-width on mobile, page primary top-right of the header. Pick the convention once and apply it everywhere, so the user builds one motor habit for "confirm" instead of relearning it per screen.
- Keep destructive actions visually and spatially separated from the primary, never adjacent with the same weight, so a hurried click lands on the safe action rather than the irreversible one. Confirmation is required regardless.
- On touch widths the primary action sits in the bottom thumb zone, not the top corner, because that is where a thumb reaches without the hand repositioning.
- Secondary and tertiary actions are quieter AND placed so they never sit between the user and the primary.

### Optical balance and whitespace intentionality

- Whitespace groups by proximity: related items sit closer to each other than to the next group (Gestalt proximity). Equal spacing between everything destroys grouping and is a violation on any screen with more than one logical group.
- Content is balanced within its container: no heavy column beside an empty one with no reason, no single control stranded in a wide blank panel. Either fill, constrain the container width, or rebalance.
- Long-form text holds a 45 to 90 character measure, because a wider line forces the eye to hunt for the start of the next one. A line running the full width of a 1440px canvas is a violation.

### Uniformity across the milestone (BLOCKING for Production-Grade)

Every screen in a milestone is visibly one product, not a patchwork:

- One card treatment: the same padding, radius, elevation tier, and header style for the same card role across all screens.
- One page-header pattern: title, subtitle, and action area in the same position and spacing on every page.
- One empty/loading/error pattern: the same skeleton style, the same empty-state composition, the same error layout reused, not re-invented per screen.
- One table/list treatment: identical row height, density, and column-header style across all data views.
- A second screen that solves the same problem a different way (different card padding, different header layout, a bespoke empty state) is a uniformity defect, fixed before milestone close.

Enforced by `component-inspector` (static signals: rhythm consistency, right-aligned numerics, action-placement component, state composition, header/card uniformity), the `principal-designer` agent (rendered-craft verdict), and MAVS V2 (measured geometry: alignment clustering, rhythm histogram, hierarchy ladder, density, uniformity sweep).

## Motion

### Reduced-motion support

All non-decorative motion must honor `prefers-reduced-motion: reduce` — either by disabling, shortening, or providing an alternative.

### Duration bounds

- Micro-interactions (hover, press): 100–200ms
- Enter/exit transitions: 150–300ms
- Longer durations require justification per-component

## Cross-cutting UX (security, reversibility, internationalization)

These apply across every classification and every screen. They are requirements, not polish (decisive for healthtech/fintech positioning).

### Error prevention over error messaging

- Prefer **undo over confirm**: a reversible destructive action uses an Undo affordance (snackbar with a time window), not an "are you sure" dialog. Reserve confirm dialogs for truly irreversible actions. Undo respects the user's flow; a modal interrupts it.
- Destructive actions are visually separated from the primary action and never share its weight or position.

### Security UX

- **Sensitive-data masking:** fields flagged sensitive (per `ux-brief.md`) render masked by default and reveal only on an explicit user action. The cleartext is never logged.
- **Step-up re-authentication:** sensitive actions (payment, permission grant, data export, account changes) require re-auth before proceeding, even within a live session. Session-timeout re-auth preserves in-progress form state.

### Internationalization layout

- **Text expansion:** layouts tolerate a text-expansion budget (German/Finnish can run 30-40% longer than English). No truncation of essential labels, no fixed-width containers that clip translated strings.
- **RTL:** when any target locale is RTL, layout, iconography direction, and alignment mirror correctly. Logical properties (start/end) over physical (left/right).

## Asset sourcing & provenance (universal)

Designs may use free internet assets (photos, illustrations, 3D elements, characters, icons) and generated assets (the `image-generation` skill). Both are welcome. The non-negotiable part is provenance:

- **License first.** A "free" asset is usable only when its license permits commercial use without attribution burdens the project cannot meet. Safe default sources: Unsplash, Pexels (photos), unDraw, Storyset (illustrations), Lucide (icons), and equivalent explicitly-licensed libraries. An asset with an unknown or unverifiable license never ships in a client deliverable.
- **Every asset is recorded in `AI_DOCS/design/asset-manifest.md`**, one row per asset: repo path, source (the exact URL, or `generated: <prompt summary>` for AI-generated, or `client: <file>` for client-supplied), license, date added, where used. This is what makes an asset findable and replaceable later (a higher-resolution need, a license question, a client swap).
- **Writers of the manifest:** `image-generation` (generated assets), `image-assets` (optimized/imported assets), `design-tokens` Figma extraction (client-file exports), `design-screens` and `landing-page` (assets they place). A screen that ships an image absent from the manifest is an incomplete task, the same class as a missing registry entry.

## Implementation pointers

- Design tokens: `<project>/design-system/tokens.json`
- Component registry: `<project>/design-system/components/`
- Asset provenance: `AI_DOCS/design/asset-manifest.md` (see "Asset sourcing & provenance")
- Compliance validator: `component-inspector` agent (runs during implementation)
- Accessibility audit: `/accessibility-audit` skill (runs at milestone boundary)
- Domain + trend knowledge: `rules/design-language.md` (router into `rules/design/`)

<!-- Version: 1.1.0 (2026-06-23): Added 2026 modern-look minimums (layered depth, one primary CTA, type scale, purposeful motion) plus BLOCKING auth/navigation/exit-path rules. Pointer to rules/design-language.md. -->
<!-- Version: 1.1.1 (2026-06-30): repointed prose refs to the split design-language files (rules/design/trends-2026.md, domains/, auth-nav.md) after the monolith was broken up. -->
<!-- Version: 1.2.0 (2026-06-24): Added "Craft defaults (2025-era product UI)" section: extract-not-clone principle + 6 craft moves split universal (elevation ladder + hover-lift, one-accent gradient, tabular numerals + tight tracking, one restrained live signal) vs dashboard-class (tokenized hand-rolled SVG viz with chart color = status color, UserAvatar/AvatarStack identity). Gate-able by component-inspector. From the Project Management System design retrospective. -->
<!-- Version: 1.3.0 (2026-06-24): Added "Design with intent (every decision is reasoned, BLOCKING)" to Universal: controls chosen by data shape and the choice recorded, filter area deliberately designed (placement/persistence/clear-all/active feedback/empty state), every screen states its purpose + one primary action + empty/loading/error intent. Filter & control discipline table mirrored into component-inspector. -->
<!-- Version: 1.4.0 (2026-06-24): Hardened extract-not-clone: craft moves and all example values (token schemas, sample tracking/shadows/gradients) encode thinking and structure, never fixed values; concrete colors/tracking/formats are derived per project from its own DNA/direction/domain/typeface. Copying a prior project's literal values instead of reasoning them out is the named failure. -->
<!-- Version: 1.5.0 (2026-06-29): Added "Layout craft (relationships, not just tokens)" section: spacing rhythm (one step per relationship), alignment (shared edges, optical, numeric right-align), visual hierarchy (one dominant element, 3 type levels), action placement, optical balance/whitespace, and milestone-wide uniformity (BLOCKING for production-grade). Closes the gap that token rules check vocabulary but not relationships. Enforced by component-inspector (static), principal-designer agent (rendered-craft verdict), and MAVS V2 (measured geometry). Production-grade design track. -->
<!-- Version: 1.6.0 (2026-06-29): Track G. Added "Cross-cutting UX (security, reversibility, internationalization)": undo-over-confirm, sensitive-data masking, step-up re-auth, text-expansion + RTL layout rules. Requirements not polish. -->


<!-- Version: 1.7.0 (2026-08-06): Added "Asset sourcing & provenance (universal)": free internet assets (photos, illustrations, 3D, characters, icons) and generated assets allowed with license verified; every asset recorded in AI_DOCS/design/asset-manifest.md (repo path, source URL / generated prompt / client file, license, date, where used); manifest written by image-generation, image-assets, design-tokens Figma extraction, design-screens, landing-page. -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
<!-- Version: 1.8.0 | 2026-08-20 | positive-direction phrasing pass, constraints unchanged -->
<!-- Version: 1.9.0 | 2026-10-22 | added the guard rule that the dataset seeds options and never decides (generic defaults need a recorded product reason) and a chart-selection lookup pointer, v4.31.0 -->
