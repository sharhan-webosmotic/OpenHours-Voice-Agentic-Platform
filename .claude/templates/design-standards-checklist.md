# Design Standards Checklist

> The canonical, project-independent list of design standards a screen must meet.
> Deployed once into each project as `AI_DOCS/design/design-standards-checklist.md`
> by `/design-tokens` (Gate 3), then never rewritten wholesale: project-specific
> rows are appended below the seed set as the project's own screens surface new,
> reusable standards.
>
> Consumed by two readers. The `/build` Exercise gate's per-task visual QA step
> reads it row by row against the task's screenshots (375, 768, 1440) and the
> geometry dump, tagging each finding with its DSC id. `ui-review` and
> `principal-designer` reference it the same way at milestone scope. A row's
> Severity decides the outcome: a confirmed BLOCKING violation keeps the task
> DOING (or fails `ui-review`), a confirmed ADVISORY violation is reported but
> does not block.
>
> Every row here traces to an existing rule in `rules/design-rules.md`,
> `rules/ui-engineering-rules.md`, `rules/frontend-rules.md`, or the RSP checks
> in `skills/e2e-testing/templates/geometry-dump.ts`. This file does not invent
> new standards, it compiles the ones that already govern the codebase into one
> checkable list.

## Columns

- **ID**: `DSC-01` upward, stable once assigned. Referenced from findings, never renumbered or reused after a row is retired.
- **Standard**: one testable sentence. A reviewer (human, `principal-designer`, or `component-inspector`) can read it and say pass or fail without further interpretation.
- **How verified**: the lane that decides the row.
  - `geometry dump`: the Playwright DOM audit in `geometry-dump.ts`, cited by its RSP id when one exists, or by the geometry field it measures (rect deltas, alignment clustering, `styles.textAlign`) when the row predates a named RSP check.
  - `screenshot judgment`: a visual read of the captured screenshots by `principal-designer` (craft) or `component-inspector` (registered patterns), cited by the source rule's own heading.
  - `static scan`: a code-level check (token/AST) that neither a screenshot nor the DOM geometry dump can decide, cited by the source rule.
- **Severity**: `BLOCKING` or `ADVISORY`, taken from the source rule's own stated status. A row marked `BLOCKING*` carries the source rule's classification gating: the row is a hard rule for `data-dashboard` / `consumer-app` / `stats-heavy` / `fintech` / `analytics` projects, and warnings-only (read as `ADVISORY`) for `dev-tool` / `minimal-utility` / `internal-only` / `cli-adjacent-admin` classifications, per `AI_DOCS/planning/project-classification.md` (see `rules/design-rules.md`). Rows with no asterisk are BLOCKING or ADVISORY regardless of classification.

## Seed set

| ID | Standard | How verified | Severity |
|---|---|---|---|
| DSC-01 | Vertical rhythm is built from the 4px base unit, and a given semantic relationship (label-to-input, card-to-card, section-to-section, heading-to-body) uses the same step value on every screen. | geometry dump: rhythm histogram over stacked-gap deltas (`ui-engineering-rules.md` S9) | BLOCKING |
| DSC-02 | Labels, their inputs, helper text, and content blocks in the same region share one left edge, with no element sitting 1 to 7px off that shared edge. | geometry dump: alignment clustering on `rect.x` (`ui-engineering-rules.md` S9) | BLOCKING |
| DSC-03 | Exactly one primary-variant action dominates a given screen state, by size, weight, or color, with no competing primary CTA. | screenshot judgment (`design-rules.md` "One clear primary action per view") | BLOCKING* |
| DSC-04 | Every card, panel, modal, and popover sits on one of the design system's elevation tiers (canvas, card, overlay) built from tint and/or shadow, never a border alone, and interactive cards carry a hover-lift. | screenshot judgment, cross-checked against `tokens.json` elevation tiers (`design-rules.md` "Surface elevation tiers", "Depth is a system, not a border") | BLOCKING* |
| DSC-05 | Every color, spacing, radius, and shadow value in a component resolves from `design-system/tokens.json`, never a raw hex literal or a pixel value outside the 4px scale. | static scan, `component-inspector` AST check (`design-rules.md` "No raw hex values in components", "No raw px values for spacing") | BLOCKING |
| DSC-06 | Every interactive element measures at least 44 by 44 CSS pixels, including padding, at viewport widths under 768px. | geometry dump (RSP-05) | BLOCKING |
| DSC-07 | At least three distinct type levels (display or title, body, caption or label) are visible on a content screen, and adjacent levels differ by a perceptible step of roughly 1.2x size or a full weight step. | screenshot judgment (`design-rules.md` "Visual hierarchy") | BLOCKING* |
| DSC-08 | Empty, loading, and error states are composed, not bare text or a spinner: empty pairs an icon or illustration with a one-line reason and a primary action, loading is a skeleton matching the real layout shape, and error names the cause plus a next step. | screenshot judgment (`frontend-rules.md` "State Quality Bar") | BLOCKING |
| DSC-09 | A table wider than its box scrolls inside its own container, and never turns the page itself into the horizontal scroller. | geometry dump (RSP-06) | BLOCKING |
| DSC-10 | The first content element on a page never renders underneath a fixed or sticky top bar. | geometry dump (RSP-09) | ADVISORY |
| DSC-11 | The same card padding, radius, elevation tier, and header style is used for the same card role across every screen in the milestone, and one page-header pattern (title, subtitle, action-area position) repeats on every page. | screenshot judgment, cross-screen sweep (`design-rules.md` "Uniformity across the milestone") | BLOCKING* |
| DSC-12 | Density is tuned per breakpoint, not just non-overflowing: mobile stays single-column with no element taller than about 1.5 viewports without internal scroll, tablet and desktop gain columns to keep card and row heights sane, and widths of 1441px and up cap content with a max-width container instead of stranding a small form or table. | screenshot judgment at 375, 768, 1024, 1440, 1920 (`frontend-rules.md` "Responsive Design" point 6) | BLOCKING |
| DSC-13 | Every interactive element shows a visible focus indicator on keyboard focus, using the design system's focus-ring token, never `outline-none` with no replacement. | screenshot judgment, keyboard-tab capture (`design-rules.md` "Focus states", `ui-engineering-rules.md` "Focus States") | BLOCKING |
| DSC-14 | Numeric table columns are right-aligned with tabular numerals enabled, and text columns are left-aligned. | geometry dump: `styles.textAlign` per column node, cross-checked by screenshot judgment for tabular-nums rendering (`ui-engineering-rules.md` S9, rule 23) | BLOCKING |

## Project rows

Rows appended by this project, numbered continuing from `DSC-15`. Each new row
still traces to a rule (this file's seed set, another `.claude/rules/*.md` file,
or a project-specific standard recorded in `design-dna.md`) and states the same
four fields. Do not renumber or delete a retired row, mark it `RETIRED` in the
Severity column instead so old findings still resolve.

| ID | Standard | How verified | Severity |
|---|---|---|---|
| | | | |
