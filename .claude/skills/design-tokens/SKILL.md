---
name: design-tokens
description: "Gate 3 of the design process: define the production design token set in design-system/tokens.json + build the core reusable components (Button, Input, Card, Modal, etc.) with all variants and states + produce 3-4 draft screens using live tokens. Requires Design DNA and frontend stack locked. Use after /design-discovery completes. Produces canonical tokens.json that becomes the single source of truth for all styling. Also triggers on: 'Finalize tokens', 'Build core components', 'Design tokens', 'Production design system', 'Token definitions'."
mcp_integrations: [shadcn, mui]
skip:
  - "Start discovery (use /design-discovery)"
  - "Build full screens (use /design-screens)"
  - "Design one component (use /shadcn-ui or platform skill)"
next_skill: design-screens
required_gate: "Gate 3 (Design Approved)"
allowed-tools: "Read Write Edit Grep Glob Bash(npm:*) Bash(npx:*)"
skill_id: SK-046
context_budget:
  load_kb: 30
  scope: task
version: 1.10.1
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [design-discovery, design-direction, tech-specification]
  optional: [shadcn-ui, component-inspector]
produces:
  - path: design-system/tokens.json
    consumers: [design-screens, build, reactjs, nextjs, component-inspector, accessibility-audit]
  - path: design-system/components/
    consumers: [design-screens, build]
  - path: AI_DOCS/design/draft-screens/
    consumers: [design-screens, qa-testing]
  - path: AI_DOCS/design/design-standards-checklist.md
    consumers: [build, ui-review, e2e-testing, milestone-validation]
consumes:
  - path: AI_DOCS/design/design-dna.md
    required_sections: [color-palette, typography, shape-spacing, elevation-surfaces]
  - path: AI_DOCS/design/frontend-stack.md
  - path: AI_DOCS/design/component-registry.md
  - path: rules/design-language.md
  - path: rules/design/domains/_defaults.md
metadata:
  author: WebOsmotic Private Limited
  category: infrastructure
  patterns: [domain-specific, iterative]
  split_from: design-system
  split_in: 3.1.0
  role: "design-phase (gate 3)"
---

# /design-tokens — Production Tokens + Core Components

> **SCOPE:** Gate 3 of the 5-gate design process. Takes Design DNA as input; produces the canonical `design-system/tokens.json`, the core component library, and 3–4 draft screens for user approval.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (all free, auto-provisioned in the project `.mcp.json`):

- `shadcn` (free): live component registry reference for token-aware components.
- `mui` (free): Material UI component docs and API for semantic-color and token mapping.

---

## Theme Consistency Rules (NON-NEGOTIABLE — from v3.0 original)

> [!CRITICAL]
> **All components, pages, and layouts MUST use ONLY values defined in `design-system/tokens.json`.**

| Rule | Enforcement |
|---|---|
| **No Dark Mode styles unless configured** | If Design DNA mode = "Light only" — NEVER add `dark:` Tailwind classes |
| **No Hardcoded Hex Colors** | Colors must come from CSS variables or token imports |
| **No Arbitrary Font Sizes** | Only sizes in tokens.json `typography.size` |
| **No Arbitrary Spacing** | Only values in tokens.json `spacing` scale |
| **No Mixed Border Radius** | Use the project's declared radius consistently |
| **Consistent Card Style** | All cards same border + background + radius + shadow |
| **Consistent Input Style** | All form inputs match the declared Form Style |
| **Dashboard Shell is Fixed** | Sidebar + header + page shell identical across authenticated pages |

Enforced by `component-inspector` agent + lint rules.

## Component Reusability Mandate

**Design each component ONCE with all variants and states**, rather than a separate button design per page: one `Button` component with variants (primary, secondary, tertiary, ghost, destructive) × sizes × states (default, hover, active, disabled, loading) is what keeps the system reusable instead of fragmenting into per-page one-offs.

## Responsive Contract Per Component (BLOCKING)

Components are born responsive, not retrofitted at screen-build time. Every component built in Step 3 declares its **responsive contract**: how it behaves at each breakpoint band (mobile 320-767, tablet 768-1023, desktop 1024-1440, wide 1441+), written into its registry row. The required degrade modes for the shell and data components:

| Component | Mandatory responsive behavior |
|---|---|
| DataTable | under 768: contained horizontal scroll (`overflow-x-auto` on ITS wrapper, sticky first column) or card layout. The page never becomes the scroller |
| SideNav | under 1024: collapses to a drawer with an always-reachable toggle |
| TopNav | under 768: actions collapse to hamburger/priority menu, no wrapping bar |
| Modal / Dialog | under 768: full-screen or bottom-sheet treatment, never a clipped centered box |
| Pagination | under 768: compact controls (prev/next + page indicator), all targets >= 44px |
| BulkActionBar / toolbars | overflow menu when actions exceed the width, never wrapped or clipped buttons |
| Alert / Toast | mobile: full-width within the safe area, never overlapping the primary action |
| FormWizard / forms | single column under 768, multi-column only above |

Every OTHER component states its contract too, even when it is "fluid, no behavior change" (that is a declaration, not an omission). A component is not registry-eligible until its contract is declared AND verified live at 375 / 768 / 1024 / 1440 / 1920 (the `playwright` MCP on its demo/story page, or the `e2e-testing` responsive sweep). This is the shift-left that makes the milestone-close `mavs/responsive.json` gate boring instead of a bug hunt.

## Reference Documents

| Doc | Purpose |
|---|---|
| `references/ui-mandates.md` | Enterprise UI consistency rules, spacing/padding standards, tech stack override |
| `references/design-tokens-reference.md` | Comprehensive token definitions with Tailwind equivalents |
| `references/design-sync.md` | How design updates flow to code; component-inspector contract |
| `references/accessibility.md` | WCAG 2.2 AA requirements for token pair verification |
| `templates/component-registry.md` | Template for AI_DOCS/design/component-registry.md |

---

## When to Run

| Trigger | Timing |
|---|---|
| `/design-discovery` completed | Immediately after Gates 1–2 pass |
| Design DNA approved | Explicit |
| User says "build tokens" / "core components" | Explicit |

Run this skill only after the user has approved `design-dna.md`, because every token value in Step 1 must trace back to an approved DNA entry and tokens generated from an unapproved draft are invalidated the moment the DNA changes. Do not run without approved `design-dna.md`.

---

## Pre-flight

Read:

1. `AI_DOCS/design/design-directions/chosen.md` — the direction the user picked in `/design-direction`. The tokens you lock MUST match its preliminary tokens (color, font, radius, spacing, density). This is the seed: do not drift from what the user chose.
2. `AI_DOCS/design/design-dna.md` — source of truth for all values
3. `AI_DOCS/design/frontend-stack.md` — framework + library decisions
4. `AI_DOCS/design/component-registry.md` — seed (usually empty after discovery)
5. `AI_DOCS/planning/project-classification.md` — determines strict vs advisory design rules
6. `rules/design-rules.md` — framework-level bans (border-only cards forbidden in data-heavy projects, etc.)
7. `rules/design/domains/<domain>.md` — the product's domain profile (color strategy, density, elevation, tabular numerals, motion budget) plus `rules/design/domains/_defaults.md`, and the 2026 trend catalog `rules/design/trends-2026.md` (A.4 color/type direction). Router: `rules/design-language.md`

---

## Mode: Greenfield vs Extraction (migration)

This skill runs in one of two modes. `/design-discovery` Step 0 sets it; if you arrive here directly, detect it yourself.

- **Greenfield** (no existing UI code): generate tokens from the chosen direction + Design DNA, as in the steps below. This is the default.
- **Extraction / migration** (onboarding an existing codebase): the product already has a design. Do NOT invent a fresh palette. Reverse-engineer the existing design into tokens so all new work matches what the user already built.

### Extraction mode procedure

Run this BEFORE Step 1 when in extraction mode. Pairs with `/codebase-migration`.

1. **Sample the real design values from the codebase**, in this precedence order (a configured source beats scattered literals):
   - **Config first**: `tailwind.config.{js,ts}` theme (colors, spacing, fontFamily, borderRadius, boxShadow), `:root` CSS custom properties, a `theme.ts` / styled-components theme, Sass/Less variables, or an existing `tokens.json`.
   - **Then literals**: grep components for repeated hex/rgb/hsl colors, `px`/`rem` spacing and font sizes, `font-family` declarations, `border-radius`, and `box-shadow` values. Count frequency.
2. **Cluster into a token set.** Group near-identical colors (snap close hexes to one token), build the spacing scale from the most-frequent step values, derive the type scale and families, collect radii and shadows. Frequency drives which value becomes the canonical token; one-off outliers are flagged, not enshrined.
3. **Write `tokens.json` from the extracted values**, same schema as Step 1. Annotate the source of each token group in a sibling note (or a `"_source"` block): `extracted` (sampled from code) vs `derived` (filled from the domain profile because the codebase had no value for it).
4. **Precedence:** extracted values win over defaults and over the domain profile. Gaps (a token the code never defined, e.g. no semantic-negative color) are filled from `rules/design/domains/<domain>.md` for the product's domain, and marked `derived`.
5. **Confirm with the user.** Present the extracted token set and the gap-fills. This is continuity, not a redesign: the user must recognize their own product. Only after confirmation do components get built against these tokens.
6. **Then continue** with Step 2 onward (adapter, components, registry) against the extracted tokens. Components reuse the existing look; they do not impose a new one.

### Extraction mode, Figma variant (client-supplied designs)

When `design-dna.md` records `Mode: client-design (figma)` (set by `/design-discovery` Step 0), the extraction source is the client's Figma file, not a codebase. Connect the **Figma Dev Mode MCP server** (gated, per `rules/mcp-rules.md`: the Figma desktop app running with the client file open, or the REST-token fallback), then:

1. **Ingest the design system**: pull the Figma variables/styles (colors, type styles, spacing, radii, effects) as the token source. Where the file has no formal variables, sample the values from the frames the same clustering way as codebase extraction (frequency wins, outliers flagged).
2. **Ingest the screens**: for every frame/page, record the screen into `AI_DOCS/design/screens/<screen>.md` (regions, components used, exact text content, image/asset references) so `design-screens` and the `fidelity` validator have the reference to compare built output against.
3. **Ingest the component inventory**: Figma components map to registry rows (name, variants, states as designed). Components the design implies but never drew (loading skeletons, error states, filtered-empty) are flagged as GAPS and designed from the client's own token values, then confirmed with the user.
4. **Export assets**: image fills, icons, and illustrations the design uses are exported and recorded in `AI_DOCS/design/asset-manifest.md` (source: the client Figma file) per the asset-provenance rule in `rules/design-rules.md`.
5. **Precedence and fidelity**: client-designed values are LAW (extracted wins over domain profile, same as codebase extraction), and downstream the `mavs/fidelity.json` validator compares every built screen against the Figma-derived reference in `AI_DOCS/design/screens/`. The responsive contracts still apply: where the client designed only desktop, the mobile behavior is derived per this skill's "Responsive Contract Per Component" and confirmed with the user, never invented silently.

Greenfield mode skips this section entirely.

## Instructions

### Step 1 — Produce canonical `design-system/tokens.json`

Write to `<project>/design-system/tokens.json` at the project root (not AI_DOCS). This is the single source of truth.

```json
{
  "color": {
    "brand": {
      "primary": { "50": "...", "100": "...", ..., "900": "..." },
      "secondary": { "50": "...", ..., "900": "..." }
    },
    "neutral": { "0": "#ffffff", ..., "1000": "#000000" },
    "semantic": {
      "positive": { "base": "...", "subtle": "...", "strong": "..." },
      "negative": { "base": "...", "subtle": "...", "strong": "..." },
      "neutral": { "base": "...", "subtle": "...", "strong": "..." }
    },
    "surface": {
      "elevation-0": "...",
      "elevation-1": "...",
      "elevation-2": "..."
    }
  },
  "typography": {
    "family": { "sans": "...", "mono": "..." },
    "size": { "xs": "12px", "sm": "14px", "base": "16px", "lg": "18px", "xl": "20px", "2xl": "24px", "3xl": "30px", "4xl": "36px", "5xl": "48px" },
    "weight": { "regular": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "leading": { "tight": 1.2, "normal": 1.5, "loose": 1.75 },
    "feature": { "tabularNums": "tabular-nums" },
    "letterSpacing": { "heading": "-0.02em", "body": "-0.006em", "normal": "0" }
  },
  "spacing": { "0": "0", "1": "4px", "2": "8px", "3": "12px", "4": "16px", "5": "20px", "6": "24px", "8": "32px", "10": "40px", "12": "48px", "16": "64px" },
  "radius": { "none": "0", "sm": "2px", "md": "4px", "lg": "8px", "xl": "12px", "full": "9999px" },
  "shadow": {
    "xs": "0 1px 1px 0 rgb(0 0 0 / 0.04)",
    "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "md": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    "accent": "0 8px 24px -6px rgb(var(--accent-rgb) / 0.35)",
    "hoverLift": "0 12px 20px -8px rgb(0 0 0 / 0.18)"
  },
  "elevation": {
    "interactive": {
      "rest": { "shadow": "{shadow.sm}", "translateY": "0" },
      "hover": { "shadow": "{shadow.hoverLift}", "translateY": "-2px" }
    }
  },
  "accent": {
    "gradient": {
      "light": { "from": "...", "to": "..." },
      "dark": { "from": "...", "to": "..." },
      "cta": "linear-gradient(135deg, {accent.gradient.light.from}, {accent.gradient.light.to})",
      "hero": "linear-gradient(135deg, {accent.gradient.light.from}, {accent.gradient.light.to})"
    },
    "avatarGradients": ["...", "...", "...", "...", "...", "..."]
  },
  "chart": {
    "sparkline": { "stroke": "{semantic.positive.base}", "fill": "..." },
    "area": { "stroke": "...", "fill": "..." },
    "donut": { "track": "{surface.elevation-1}", "segments": ["{semantic.positive.base}", "{semantic.negative.base}", "{semantic.neutral.base}"] },
    "segmentedBar": { "segments": ["{semantic.positive.base}", "{semantic.neutral.base}", "{semantic.negative.base}"] }
  },
  "motion": {
    "duration": { "fast": "100ms", "base": "150ms", "slow": "300ms" },
    "easing": { "standard": "cubic-bezier(0.4, 0, 0.2, 1)" }
  },
  "z-index": { "dropdown": 10, "overlay": 100, "modal": 200, "toast": 300 }
}
```

**Token-block notes (2025-era craft, from `rules/design-rules.md` → "Craft defaults"):**

> These notes encode the *structure and the thinking*, never fixed values. Every literal above (the `-0.02em` tracking, the shadow recipes, the gradient stops, the avatar palette) is an illustrative default. Derive the actual numbers from THIS project's Design DNA, chosen direction, and typeface: tracking is tuned to the chosen font's optical feel (a humanist sans wants different tracking than a geometric one), accent stops come from the project's accent identity, the avatar palette is generated from the accent family. Copying these exact values is the clone failure the extract-not-clone principle forbids. What is mandatory is that the *token exists and the relationship holds*, not its value.

- `typography.feature.tabularNums` + `typography.letterSpacing` are required as structure, not as the specific numbers shown: figures and table columns get tabular numerals, headings get tight tracking. The exact tracking is derived per typeface, not copied.
- `shadow.accent` is the accent-glow tier for hero moments; `shadow.hoverLift` plus `elevation.interactive.hover` give interactive cards their named hover-lift (do not hand-roll the lift per component). The recipes are derived from the project's accent and neutral ramps.
- `accent.gradient` is the single brand accent applied as a gradient on named hero moments (hero stat, active-nav spine, primary CTA, logo, progress fill); `accent.avatarGradients` is the palette for gradient-initials avatars, generated from the project's accent family. The accent is NOT a data color: keep it separate from `semantic.*`.
- `chart.*` is required for `data-dashboard` / `consumer-app` / `stats-heavy` / `fintech` / `analytics`. Its values **reference the semantic solids** (`{semantic.positive.base}` etc.) so chart color equals status color. Never hardcode a hex in `chart.*`.

**Validation before write:**

- Every value traces back to `design-dna.md` — no invented tokens
- **Domain profile applied** (`rules/design/domains/<domain>.md`): the color strategy, density, elevation depth, and motion budget fit the product's domain. Where the domain handles money or aligned data (fintech, enterprise tables, e-commerce prices, logistics counts), enable tabular/lining numerals (`font-variant-numeric: tabular-nums`). Define semantic status tokens so meaning is never encoded by color alone (every positive/negative or status color is paired with an icon, label, sign, or pattern at the component layer). Dark-theme-default is correct for gaming/media, an option for social, and wrong as a default for government, patient-healthcare, and most e-commerce.
- **Matches the chosen direction**: the locked color/font/radius/spacing/density equal the preliminary tokens in `design-directions/chosen.md`. The user already picked; tokens implement that pick, they do not re-decide it.
- **DNA sync check**: every value named in `design-dna.md` exists in `tokens.json` with a matching name. A value in the DNA with no token (or a renamed token) → fix before Gate 3, do not silently diverge.
- **Dark-mode pairs**: if Design DNA mode is `Both` or `Dark only`, every semantic / surface / text color token gets a light AND dark value (a `light`/`dark` pair or a `color-scheme` mapping). Define every dark-mode variable name now, at token-authoring time, rather than leaving it to be invented later in components, where it drifts from the single source of truth. If mode is `Light only`, no dark values and no `dark:` classes anywhere.
- If project is `data-dashboard` / `consumer-app` / `stats-heavy` / `fintech` / `analytics`: must have 3+ surface elevation tiers + at least one semantic axis (positive/negative/neutral), a `chart.*` block whose colors reference the semantic solids (never literal hex), and the avatar/data-viz composites seeded in the registry
- **Craft tokens present (all classifications, warnings-only for `dev-tool` / `minimal-utility`):** `typography.feature.tabularNums` + `typography.letterSpacing`, `shadow.accent` + `shadow.hoverLift` + `elevation.interactive.hover` (the named hover-lift), and `accent.gradient` (single brand accent, separate from `semantic.*`). When Design DNA mode is `Both` or `Dark only`, `accent.gradient` and `chart.*` carry both light and dark values, same as every other surface/semantic token.
- All color pairs meant to be combined verified with contrast check (see `/accessibility-audit` — run contrast check now, don't wait)
- Border-only cards forbidden: card elevation must use tint or shadow, not `border` alone

**Impeccable DESIGN.md derivation (when `skills/impeccable/` is installed):** after `tokens.json` is written (and again on every later token change), run `/impeccable document` to derive `DESIGN.md` at the project root and `.impeccable/design.json` from the locked tokens. `tokens.json` remains the single source of truth: `DESIGN.md` is derived output, regenerated whenever tokens change and never hand-edited. This is what activates the impeccable detector's design-system rules for the `mavs/slop.json` lane.

### Step 2 — Generate framework-adapter (Tailwind config, CSS variables, or RN theme)

Depending on stack (from `frontend-stack.md`):

- **Next.js / React + Tailwind:** generate `tailwind.config.ts` reading from tokens.json
- **React + CSS variables:** generate `design-system/tokens.css` with `:root { --color-brand-primary-500: ...; }`
- **React Native:** generate `design-system/theme.ts`

Wire the adapter so tokens.json is the only file humans edit.

### Step 3 — Build core components

For each of these atoms, produce the component + variant matrix in `design-system/components/<Name>/`:

**Core atoms (mandatory):**

- Button (primary / secondary / tertiary / ghost / destructive) × (sm / md / lg) × (default / hover / active / disabled / loading)
- Input (text / number / email / password / search) × (default / focus / error / disabled)
- Textarea
- Select / Combobox
- Checkbox, Radio, Switch
- Card (with required surface elevation — **not** border-only)
- Modal / Dialog
- Tooltip / Popover
- Badge / Tag / Chip
- Avatar
- Icon (Lucide by default from frontend-stack.md)
- Loader / Spinner
- Alert / Toast

**App-shell + layout atoms (the locked shell — Track H: built first in `/do` Phase 1 Stage 0, craft-reviewed, then frozen). Build under `src/components/layout/**` and `src/components/ui/**`:**

- AppShell (top nav + side nav + content region, responsive collapse) — the shell root
- TopNav (product switcher / global search / notifications / profile slot)
- SideNav (role-aware sections, collapsible, mobile drawer)
- UserProfileMenu (account / tenant switch / theme / sign-out / step-up re-auth)
- AuthLayout + auth screens (sign-in / sign-up / reset / MFA / session-expiry)
- PageHeader (title + subtitle + primary action area, one treatment reused on every page)
- DataTable (sort / filter / saved views / column management / density / bulk-select)
- Pagination (page-size + controls + total count, keyboard reachable)
- FormWizard (multi-step form: progressive disclosure, per-step inline validation, keyboard-operable)
- MaskedField (sensitive-data masking primitive: masked by default, reveal on explicit action, never logs the cleartext)
- UndoSnackbar (transient action with an Undo affordance: the default for reversible destructive actions, preferred over a confirm dialog)

**State components (the enterprise differentiator — one reusable composition each, reused on every screen, never reinvented per page):**

- EmptyState (first-run: icon/illustration + reason + primary action)
- FilteredEmptyState (distinct copy + Clear filters — filtered-to-zero is not first-run)
- LoadingSkeleton (skeleton matching the real layout shape, not a bare spinner)
- ErrorState (names the cause: network / validation / server / permission-denied, distinct + retry)
- ReadOnlyWrapper (read-only rendering of an editable surface per role)
- BulkActionBar (selection count + bulk actions, appears on multi-select)

**Dashboard-class composites (mandatory for `data-dashboard` / `consumer-app` / `stats-heavy` / `fintech` / `analytics`; skip for `dev-tool` / `minimal-utility`).** Build these from the tokens above rather than re-inventing them per screen (see `rules/design-rules.md` → "Craft defaults"):

- Identity: `UserAvatar` (gradient initials from `accent.avatarGradients`, color from a stable hash of the user id, name/role tooltip on hover/focus), `AvatarStack` (`+N` overflow listing remaining names)
- Data-viz (tokenized inline SVG, color from `chart.*` / semantic): `Sparkline` (with trend arrow + delta), `AreaChart`, `ProgressRing` (donut), `StatusBar` (segmented)
- KPI: `StatCard` (hero + standard variants, with embedded sparkline + delta, accent-glow on the hero variant)
- State + status: `StatusPill` (soft-tint primitive) + `StatusBadge` (enum-to-token mapper), `LiveDot` (single always-on pulse with reduced-motion fallback)

Each component:

- Lives in `design-system/components/<Name>/`
- Contains `<Name>.tsx` (or framework equivalent) + `<Name>.story.tsx` (Storybook story if Storybook present)
- All variants and states covered
- Props typed
- No hardcoded hex / px — tokens only
- Focus states visible (no `outline: none` without replacement)
- ARIA roles per WCAG 2.2 AA
- Responsive contract declared (see "Responsive Contract Per Component") and verified live at 375 / 768 / 1024 / 1440 / 1920 before the registry entry is written

### Step 4 — Produce 3–4 draft screens

Pick representative screens from tech-spec sections 4–5 (user flows + UI/UX requirements):

- 1 auth screen (Login)
- 1 dashboard / main view
- 1 data entry or detail view
- 1 error / empty state

Each screen:

- Uses only the core components built in Step 3
- Lives in `AI_DOCS/design/draft-screens/<screen-name>.tsx`
- Responsive: verified at 320px / 768px / 1024px+
- Dark mode: only if Design DNA says `Both` or `Dark only`
- Accessibility: color contrast passes, keyboard navigation works

### Step 5 — Populate component registry

Update `AI_DOCS/design/component-registry.md` with every component built in Step 3:

```markdown
| Component | Path | Variants | States | Responsive | Design Tokens Used |
|---|---|---|---|---|---|
| Button | design-system/components/Button | primary, secondary, tertiary, ghost, destructive | default, hover, active, disabled, loading | fluid, >=44px touch at <768 (verified 375-1920) | color.brand.primary, color.neutral, spacing, radius |
| DataTable | design-system/components/DataTable | dense, comfortable | loading, empty, error | <768: contained h-scroll + sticky first column (verified 375-1920) | color.neutral, spacing, typography.tabularNums |
```

The `Responsive` column is mandatory: it holds the component's declared contract plus the verification stamp. A registry row without it is an incomplete component (`component-inspector` flags it).

### Step 5.5: Scaffold the design-standards checklist

If `AI_DOCS/design/design-standards-checklist.md` does not exist, copy `templates/design-standards-checklist.md` to that path unchanged. The seed set (`DSC-01` through `DSC-14`) is project-independent and is never edited or renumbered.

Then append project-specific rows below the seed set under "## Project rows", numbered from `DSC-15` upward, derived from THIS project's `design-dna.md` and its domain profile (`rules/design/domains/<domain>.md`). A DNA entry or domain mandate becomes a row when a screenshot, geometry dump, or static scan can verify it and the seed set does not already cover it. Examples: a fintech profile's tabular-numeral mandate on money columns beyond DSC-14's table scope, a dark-mode-pair rule when DNA mode is `Both`, a domain density ceiling, a brand-specific accent-usage rule from the DNA. Each appended row states the same four fields (ID, Standard, How verified, Severity) and traces to the DNA entry or rule it comes from.

This file is what the `/build` Exercise gate's per-task visual QA and `ui-review` judge every screen against. A project without it ships with the visual lane judging nothing, so the scaffold is part of Gate 3's outputs, not optional.

### Step 6 — Get explicit Gate 3 approval

Present to the user:

- tokens.json summary (color system, spacing, typography)
- Component library screenshot / export (or Storybook link)
- 3–4 draft screens live
- Component registry
- Design-standards checklist (`AI_DOCS/design/design-standards-checklist.md`): the seed set plus the appended project rows (DSC-15 upward)

User reviews. On explicit approval:

- `AI_DOCS/memory/gate-status.md`: Gate 3 → PASS
- Telemetry:
  ```bash
  bash hooks/log-event.sh "\"event\":\"gate.verdict\",\"gate\":\"G3\",\"verdict\":\"pass\""
  ```

### Step 7 — Handoff

Print:

```
Design tokens locked + core components built.
Single source: <project>/design-system/tokens.json

Component registry: AI_DOCS/design/component-registry.md
Draft screens: AI_DOCS/design/draft-screens/
Design-standards checklist: AI_DOCS/design/design-standards-checklist.md

Next: /design-screens to build the full UX flows + production screens.
```

---

## Examples

### Example 1: Fintech dashboard

**Actions:**

1. Read design-dna: navy primary, gold secondary, 3-tier elevation, semantic colors
2. Generate tokens.json with verified contrast (navy-500 on white: 8.3:1 ✓)
3. Generate tailwind.config.ts consuming tokens.json
4. Build 15 core atoms + 4 layout atoms in design-system/components/
5. Contrast check: all semantic colors pass WCAG AA on white + neutral backgrounds
6. Draft screens: Login, Portfolio overview, Transaction detail, Empty portfolio
7. Populate registry with all 19 components
8. Gate 3 PASS, handoff to `/design-screens`

### Example 2: Minimal dev tool

**Actions:**

1. Read design-dna: grayscale + 1 accent, compact density, 2-tier elevation allowed
2. Tokens.json: single color ramp + accent + neutral semantics only
3. CSS variables + no Tailwind (per frontend-stack)
4. Build 10 core atoms (tools don't need Tag/Chip/Avatar)
5. Draft screens: Test runner, Log viewer, Settings
6. Registry populated
7. Gate 3 PASS

---

## Troubleshooting

### Tokens don't match design-dna

**Cause:** invented a value not documented in DNA.

**Solution:** **HARD FAIL.** Delete the invented token; go back to `/design-discovery` to resolve the gap. No shortcut.

### Component uses hex codes

**Cause:** component not refactored to read tokens.

**Solution:** lint rule `no-hex-in-components` flags it. Fix before Gate 3. `component-inspector` agent verifies.

### Contrast fails for brand primary on white

**Cause:** primary color chosen for aesthetics, not accessibility.

**Solution:** adjust the token (e.g., use `brand-primary-700` for text on white, `brand-primary-500` only for large text or background). Document the shift in design-dna updates.

### Storybook not set up

**Solution:** scaffold minimally — `npx storybook@latest init` — or defer Storybook to `/design-screens` and ship components without for Gate 3.

### 3-tier elevation hard to achieve on light backgrounds

**Solution:** use tint + shadow in combination. Pure tint can be too subtle; pure shadow can look harsh. Document the stack in design-dna: "elevation-1 = tint(+3% luminance) + shadow.sm".

---

## Rules

1. **tokens.json is the single source of truth.** All styling imports from it.
2. **No hardcoded hex, px, or font names** in component files.
3. **Every component passes contrast + keyboard tests** before registry entry.
4. **Border-only differentiation for cards is banned** in strict-mode project classifications.
5. **Gate 3 requires explicit user approval** — not auto-pass after component build.
6. **No dark mode styles** unless Design DNA permits.
7. **Single source of truth:** tokens.json replaces `AI_DOCS/design/design-dna.md` as the code-facing SoT. DNA remains the human-facing brief.

## Next Step

`/design-screens` — build full UX flows + production screens + cross-role journeys.

<!-- v1.5.0 (2026-06-29): Track H. Step 3 component set extended to the full locked app-shell (AppShell/TopNav/SideNav/UserProfileMenu/AuthLayout/PageHeader/DataTable/Pagination) + the state component set (Empty/FilteredEmpty/LoadingSkeleton/Error/ReadOnly/BulkActionBar) under src/components/layout|ui, built first and frozen by /do Phase 1 Stage 0. -->
<!-- v1.6.0 (2026-06-29): Track G. Added enterprise atoms FormWizard (multi-step + inline validation), MaskedField (sensitive-data masking), UndoSnackbar (undo-over-confirm) to the locked shell set; WCAG 2.1 -> 2.2 AA. -->
<!-- v1.8.0 (2026-08-06): Responsive Contract Per Component (BLOCKING): every component declares per-breakpoint behavior (named degrade modes for DataTable/SideNav/TopNav/Modal/Pagination/toolbars/Alert/forms) and is verified live at 375/768/1024/1440/1920 before registry entry; the registry table gains a mandatory Responsive column with the contract + verification stamp. -->
<!-- v1.9.0 (2026-08-06): Extraction mode gains the Figma variant for client-supplied designs (Mode: client-design): Figma Dev Mode MCP ingestion of variables/styles as tokens, frames as screen references for the fidelity validator, components as registry rows with undesigned-state gaps flagged, assets exported into asset-manifest.md; client values win, mobile behavior derived per the responsive contract and confirmed, never invented silently. -->
<!-- v1.9.1 (2026-08-20): phrasing pass, constraints unchanged. Component-reusability and dark-mode-variable-timing guidance reframed as motivated positives; mechanically enforced bans (no dark: classes outside configured mode, no hardcoded hex in chart.*, border-only cards) left verbatim. -->
<!-- v1.10.1 (2026-08-21): Impeccable DESIGN.md derivation. After the Step 1 tokens.json write (and on every token change), when skills/impeccable/ is installed, /impeccable document derives DESIGN.md + .impeccable/design.json from the locked tokens. tokens.json stays the source of truth, DESIGN.md is derived and never hand-edited. Activates the detector's design-system rules. -->
<!-- v1.10.0 (2026-08-21): C-3 scaffolder (PLAN-v4.20-hardening). New Step 5.5 scaffolds AI_DOCS/design/design-standards-checklist.md from templates/design-standards-checklist.md when absent and appends project rows (DSC-15 upward) derived from design-dna.md + the domain profile. The file joins the Gate 3 approval checklist, the Step 7 handoff print, and the produces list (consumers: build, ui-review, e2e-testing, milestone-validation). The "do not run without approved design-dna.md" precondition now states its reason (every Step 1 token value must trace to an approved DNA entry). -->



