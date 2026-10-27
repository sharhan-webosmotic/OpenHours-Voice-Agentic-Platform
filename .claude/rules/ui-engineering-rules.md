---
description: UI engineering quality rules — focus states, forms, animation, typography, performance, touch, hydration, anti-patterns (based on Vercel Web Interface Guidelines)
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/components/**"
  - "**/pages/**"
  - "**/app/**"
---

# UI Engineering Rules

> Source: Vercel Web Interface Guidelines. These complement frontend-rules.md (architecture) and component-reuse-rules.md (registry/tokens) with implementation-level UI quality.

## Spacing & Layout Consistency (BLOCKING)

> [!CRITICAL]
> The #1 visual-quality failure is inconsistent spacing. Modals with no padding. Buttons touching each other. Page bodies flush against the viewport edge. These make the app look broken even when it works.

**Spacing tokens are the ONLY source of truth.** Every `padding`, `margin`, `gap`, and `space-*` value must come from the design system's spacing scale (defined in `AI_DOCS/design/design-dna.md`). No raw px values. No "magic numbers".

### S1. Every container needs spacing tokens — never raw values

```tsx
// WRONG — raw pixel values, inconsistent, drifts from design
<div style={{ padding: "16px", marginTop: "24px" }}>...</div>
<div className="p-[13px] mt-[27px]">...</div>

// CORRECT — design token via Tailwind scale (multiples of 4px/8px)
<div className="p-4 mt-6">...</div>  // 16px and 24px from theme scale
// OR via CSS custom property mapped to design token
<div style={{ padding: "var(--space-md)", marginTop: "var(--space-lg)" }}>...</div>
```

### S2. Modals / Dialogs must have required internal padding

Every `<Dialog>`, `<Modal>`, `<Drawer>`, `<Sheet>`, `<Popover>`, `<BottomSheet>`:
- Content area: minimum `p-6` (24px) on desktop, `p-4` (16px) on mobile
- Header + footer separated from content by `gap-4` minimum
- Never render modal content flush to the modal border

```tsx
// WRONG — content touches modal edges
<Dialog>
  <DialogContent>
    <h2>Title</h2>
    <p>Body text...</p>
    <Button>Confirm</Button>
  </DialogContent>
</Dialog>

// CORRECT — proper internal spacing
<Dialog>
  <DialogContent className="p-6 space-y-4 sm:p-8">
    <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
    <p>Body text...</p>
    <DialogFooter className="gap-2">
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### S3. Body / Page containers need horizontal padding

Every page-level container needs horizontal padding so content doesn't touch the viewport edge:
- Mobile: minimum `px-4` (16px)
- Tablet: `px-6` (24px)
- Desktop: `px-8` (32px) or centered `max-w-*` with `mx-auto`

```tsx
// WRONG — content flush against viewport edge on mobile
<main>
  <h1>Dashboard</h1>
  <DataTable ... />
</main>

// CORRECT — responsive horizontal padding
<main className="px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl">
  <h1>Dashboard</h1>
  <DataTable ... />
</main>
```

### S4. Buttons, form fields, and interactive clusters need consistent spacing

- Adjacent buttons: `gap-2` (8px) minimum between them — NEVER `gap-0` or touching
- Form fields stacked: `space-y-4` (16px) between fields
- Form label → input: `space-y-1.5` (6px) or `space-y-2` (8px)
- Button group: `gap-2` to `gap-3` between buttons
- Icon + text inside a button: `gap-2` between icon and label

```tsx
// WRONG — buttons touching each other
<div>
  <Button>Save</Button><Button>Cancel</Button>
</div>

// CORRECT
<div className="flex gap-2">
  <Button>Save</Button>
  <Button variant="outline">Cancel</Button>
</div>
```

### S5. Vertical rhythm — sections need breathing room

- Card-to-card spacing: `gap-4` or `gap-6`
- Section-to-section: `space-y-8` or `space-y-12`
- List item-to-item: `space-y-2` to `space-y-4`
- Heading-to-content: `mb-4` to `mb-6`

### S6. Every new component must be registered with its spacing contract

In `AI_DOCS/design/component-registry.md`, each component entry must specify:
- Default internal padding (e.g., `p-6`)
- Default external margin-behavior (e.g., "managed by parent — no margin on component itself")
- Required gap between instances when stacked (e.g., `gap-4`)

This prevents the next developer from guessing and drifting from the design system.

### S7. Before claiming a feature complete, run the Spacing Audit

For every new/modified screen:
- [ ] Open at mobile width (375px) — is there horizontal padding? No edge-touching?
- [ ] Open a modal — is there `p-4` or more internal padding? Header/footer separated?
- [ ] Check button groups — is there `gap-2` or more between buttons?
- [ ] Check forms — consistent `space-y-4` between fields?
- [ ] Compare to the design spec (Figma / design-dna.md) — spacing matches?

### S8. Anti-patterns (BLOCKING — fix before merge)

- `<div style={{ padding: 0 }}>` on a modal or dialog — violates S2
- Buttons rendered with no wrapping flex/gap container — violates S4
- `<main>` or page root without horizontal padding classes — violates S3
- Arbitrary Tailwind values like `p-[13px]`, `mt-[27px]` — violates S1 (must be in theme scale)
- Inline `margin` or `padding` in CSS-in-JS without referencing a theme token — violates S1
- Using `&nbsp;` or empty `<div>`s as spacers — use `gap-*` or `space-y-*` instead

> **Design system source of truth**: `AI_DOCS/design/design-dna.md` must define the spacing scale (e.g., `4, 8, 12, 16, 24, 32, 48, 64 px`). If it doesn't, stop and run `/design-discovery` → `/design-tokens` first.

### S9. Rhythm and alignment are consistent, not just legal (BLOCKING)

Token-legal values can still be arrhythmic and misaligned. Before claiming done:
- The same relationship uses the same step everywhere (label-to-input is always `space-y-2`, card-to-card is always `gap-4`, never mixed per screen).
- Form labels, inputs, and helper text share one left edge (no stray indent).
- Numeric table columns are right-aligned (`text-right tabular-nums`), text columns left-aligned.
- Dialog/sheet footers place actions bottom-right, primary rightmost, destructive separated.
- No element sits 1 to 7px off a neighboring block's edge: align to the shared edge or use a full scale step.

> Relationship-level craft (hierarchy, optical alignment, milestone uniformity) lives in `rules/design-rules.md` → "Layout craft". This S9 is the implementation-level lint subset.

---

## Focus States

1. **Interactive elements need visible focus** via `focus-visible:ring-*`
2. **Never use `outline-none`** without a `focus-visible` replacement
3. **Prefer `:focus-visible`** over `:focus` — don't show focus rings on mouse clicks
4. **Use `:focus-within`** for compound controls (e.g., search bar with icon + input)

## Forms

5. **Inputs need `autocomplete`** and meaningful `name` attributes
6. **Use correct `type` and `inputmode`** — `type="email"`, `inputmode="numeric"` for phone
7. **Let paste through in every field.** Never call `preventDefault` inside `onPaste`: blocking paste breaks password managers and anyone pasting in a saved value.
8. **Labels must be clickable** via `htmlFor` or wrapping the input
9. **Disable spellcheck** on emails, codes, usernames (`spellCheck={false}`)
10. **Submit button stays enabled** until request starts — show spinner during request
11. **Display errors inline on blur** — show field-level validation errors when a field loses focus (`onBlur`), not only on submit. Focus the first error field when the form is submitted.
12. **Mark required fields** — every required input MUST have `<span className="text-destructive">*</span>` immediately after the label text. Optional fields have no marker. Never use placeholder text as a substitute.
    - shadcn/ui: inside `<FieldLabel htmlFor="...">Field name <span className="text-destructive">*</span></FieldLabel>`
    - Plain HTML/Tailwind: inside `<label>Field name <span class="text-red-500">*</span></label>`
    - Accessibility: add `required` and `aria-required="true"` on the input element
13. **Placeholders end with `...`** showing example pattern (e.g., `Search orders...`)
14. **Warn before navigation** with unsaved form changes

14. **Use the project's installed Select component, not a native `<select>`.** A native select can't be restyled to the design tokens and renders inconsistently in dark mode and across browsers, which breaks visual uniformity across the milestone.
    - **First**: scan `package.json` for an installed UI library → use its Select component (see `component-reuse-rules.md` Package-First Lookup table)
    - **Then**: check `AI_DOCS/design/component-registry.md` for an existing project Select/Combobox → use it
    - **If nothing is installed**: STOP and tell the user — suggest installing the appropriate package before proceeding
    ```tsx
    // WRONG — always
    <select value={value} onChange={e => setValue(e.target.value)}>
      <option value="a">Option A</option>
    </select>

    // CORRECT — shadcn/ui (if installed)
    import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Option A</SelectItem>
      </SelectContent>
    </Select>

    // CORRECT — react-select (if installed)
    import ReactSelect from 'react-select'
    <ReactSelect options={options} value={selected} onChange={setSelected} />
    ```

15. **Use the project's DatePicker component, not `<input type="date">` or `<input type="datetime-local">`.** Native date pickers can't be restyled to the design tokens, render inconsistently across browsers, and have poor mobile UX, which breaks visual uniformity across the milestone.
    - **First**: scan `package.json` for an installed date picker package → use it (see `component-reuse-rules.md` Package-First Lookup table)
    - **Then**: check `AI_DOCS/design/component-registry.md` for an existing DatePicker component → use it
    - **If nothing is installed**: STOP and tell the user — suggest the best fit for the project before proceeding
    ```tsx
    // WRONG — always
    <input type="date" value={date} onChange={e => setDate(e.target.value)} />

    // CORRECT — shadcn/ui + react-day-picker (if installed)
    import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
    import { Calendar } from '@/components/ui/calendar'
    import { Button } from '@/components/ui/button'
    import { format } from 'date-fns'
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">{date ? format(date, 'PPP') : 'Pick a date'}</Button>
      </PopoverTrigger>
      <PopoverContent>
        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
      </PopoverContent>
    </Popover>

    // CORRECT — react-datepicker (if installed)
    import DatePicker from 'react-datepicker'
    <DatePicker selected={date} onChange={setDate} dateFormat="yyyy-MM-dd" />
    ```

## Animation

14. **Honor `prefers-reduced-motion`** — wrap animations in media query or CSS check
15. **Only animate `transform` and `opacity`** — never animate layout properties (width, height, top, left)
16. **Never use `transition: all`** — specify exact properties
17. **Set correct `transform-origin`** for scale/rotate animations
18. **Animations must be interruptible** — respond to user input mid-animation

## Typography

19. **Use ellipsis `...`** not three dots
20. **Use curly quotes** not straight quotes where possible
21. **Non-breaking spaces** in: `10&nbsp;MB`, `Cmd&nbsp;K`, brand names
22. **Loading states end with `...`**: "Loading...", "Saving..."
23. **Use `tabular-nums`** for number columns — `font-variant-numeric: tabular-nums`
24. **Use `text-wrap: balance`** or `text-pretty` on headings

## Content Handling

25. **Text containers handle long content** via `truncate`, `line-clamp-*`, or `break-words`
26. **Flex children need `min-w-0`** for text truncation to work
27. **Handle empty states** — never show a blank screen
28. **Anticipate short, average, and very long** user-generated content

## Tooltip & Overflow Safety (BLOCKING)

101. **Tooltips must have a `max-width` and must not overflow the viewport** — every `<Tooltip>`, `<Popover>` content, or custom title element must set `max-w-xs` (or equivalent — maximum 320px) and `break-words`. Tooltip text clipped by `overflow: hidden` on a parent or running beyond the visible area is a FAIL. Test by hovering the tooltip near all four viewport edges.

102. **Heading text must be unique within a page section** — duplicate `<h1>`, `<h2>`, or `<h3>` content on the same page (e.g., two elements both reading "Case Details") is a defect: it breaks screen-reader navigation and violates WCAG 2.4.6. Before shipping, verify no duplicate heading text exists. If structurally necessary, disambiguate with `aria-label` or visually hidden supplementary text.

## Images

29. **`<img>` needs explicit `width` and `height`** — prevents layout shift
30. **Below-fold images use `loading="lazy"`**
31. **Above-fold critical images use `priority`** or `fetchpriority="high"`

## Performance

32. **Large lists (>50 items) require virtualization** — react-window, react-virtualized, or TanStack Virtual
33. **Avoid layout reads in render** — no `getBoundingClientRect()` in render path
34. **Prefer uncontrolled inputs** — keep controlled inputs cheap
35. **Add `<link rel="preconnect">`** for CDN/asset domains
36. **Critical fonts use `<link rel="preload" as="font">`** with `font-display: swap`

## Navigation & URL State

37. **URL reflects state** — filters, tabs, pagination, panels must sync to URL params
    - In-page state changes (pagination, sort, filter) use `router.replace`, NOT `router.push`
    - Back button navigates to the previous page — not through filter/sort history
38. **Links use `<a>` or `<Link>`** — supports Cmd/Ctrl+click, middle-click, right-click
39. **Deep-link all stateful UI** via URL sync — sharing a URL reproduces the view
40. **Destructive actions need confirmation** or undo window

## Touch & Mobile Interaction

41. **Use `touch-action: manipulation`** — eliminates 300ms tap delay
42. **Set `-webkit-tap-highlight-color`** intentionally (transparent or themed)
43. **Use `overscroll-behavior: contain`** in modals, drawers, sheets
44. **Disable text selection during drag** — mark elements `inert` when appropriate
45. **Use `autoFocus` sparingly** — desktop only, single input, avoid on mobile

## Dark Mode

46. **Set `color-scheme: dark`** on `<html>` for dark themes
47. **Match `<meta name="theme-color">`** to background color
48. **Never use native `<select>` or `<input type="date">`** — see Forms rules 14–15 above for required replacements

## Hydration Safety (SSR/Next.js)

49. **Inputs with `value` need `onChange`** — or use `defaultValue` for uncontrolled
50. **Guard date/time rendering** against hydration mismatch (client vs server)
51. **Use `suppressHydrationWarning` only when necessary** — fix the root cause first

## Content & Copy

52. **Active voice** — "Save changes" not "Changes will be saved"
53. **Title Case for headings/buttons** — "Create New Project" not "create new project"
54. **Use numerals for counts** — "3 items" not "three items"
55. **Specific button labels** — "Save Project" not "Submit"
56. **Error messages include fix/next step** — "Email is invalid. Use format: name@example.com"

## Anti-Patterns (NEVER DO)

57. **`user-scalable=no` or `maximum-scale=1`** — blocks accessibility zoom
58. **`onPaste` with `preventDefault`** — blocks password managers
59. **`transition: all`** — causes unintended animation on every property change
60. **`outline-none` without `focus-visible` replacement** — breaks keyboard navigation
61. **Inline `onClick` navigation without `<a>`** — breaks right-click, middle-click, Cmd+click
62. **Use `<button>` for click actions, not a `<div>` or `<span>` with a click handler**: a non-button element with an onClick is not keyboard-focusable and is not announced as interactive to assistive tech.
63. **Images without dimensions** — causes layout shift (CLS)
64. **Large arrays without virtualization** — kills performance at 50+ items
65. **Form inputs without labels** — breaks accessibility and screen readers
66. **Icon buttons without `aria-label`** — invisible to assistive tech
67. **Format dates and numbers with `Intl.DateTimeFormat` / `Intl.NumberFormat`, not a hardcoded pattern**: a hardcoded format ignores the viewer's locale and breaks for anyone outside it.
68. **`autoFocus` without justification** — disrupts mobile experience
69. **Use the project's `Select` / `Combobox` component, not a native `<select>` element.** BLOCKING: a native select can't be restyled to the design tokens, breaks in dark mode, and renders inconsistently across browsers, which breaks visual uniformity across the milestone. If none exists, stop and tell the user to add one (shadcn/ui `<Select>` recommended).

70. **Use the project's `DatePicker` component, not `<input type="date">` or `<input type="datetime-local">`.** BLOCKING: native date pickers can't be restyled to the design tokens, have poor mobile UX, and behave differently per browser, which breaks visual uniformity across the milestone. If none exists, stop and tell the user (shadcn/ui `<Calendar>` + `<Popover>` recommended).

71. **Forward click handling with the `asChild` prop (shadcn/ui), or restructure to `<DropdownMenu>` / `<Collapsible>`, and never nest a `<button>` inside a `<button>`.** BLOCKING: nested buttons are invalid HTML and cause React hydration errors and console warnings, most often in sidebar dropdowns and menu triggers.
    ```tsx
    // WRONG — nested buttons, invalid HTML
    <Button onClick={toggle}>
      <button>Open menu</button>
    </Button>

    // CORRECT — use asChild to avoid nesting
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">Open menu</Button>
      </DropdownMenuTrigger>
    </DropdownMenu>
    ```

## Core Web Vitals (Performance Targets)

69. **LCP < 2.5s** — optimize hero images, inline critical CSS, preload fonts
70. **INP < 200ms** — break long tasks, defer non-critical JS, keep event handlers fast
71. **CLS < 0.1** — set explicit dimensions on images/video, reserve space for dynamic content
72. **Use GPU-accelerated properties** for animations — `transform`, `opacity` only
73. **Target 60fps** — use `requestAnimationFrame` for animations, never `setInterval`
74. **Use `IntersectionObserver`** for viewport detection — not scroll listeners
75. **Never lazy load above-the-fold content** — only below-fold images/components
76. **Test on low-end devices** and throttled connections (3G) — not just dev machines

## Charts & Data Visualization

77. **Match chart type to data** — trend→line, compare→bar, proportion→pie (max 5 slices)
78. **Color-blind safe palettes** — avoid red/green pairs, supplement color with patterns/textures
79. **Always provide a data table alternative** for accessibility
80. **Tooltips on interact** — hover (web) or tap (mobile) for data points
81. **Axis labels with units** — readable scale, non-cramped, auto-skip on small screens
82. **Responsive charts** — reflow on small screens, don't just shrink
83. **Empty data state** — meaningful message, not a blank chart
84. **Loading state** — skeleton/shimmer placeholder, not spinner
85. **Touch targets on charts** — minimum 44pt tap area for interactive data points
86. **Legend always visible** — position near chart, make interactive (click to toggle series)
87. **Large datasets** — aggregate or sample 1000+ points, don't render all
88. **Number formatting** — locale-aware with `Intl.NumberFormat`
89. **Keyboard navigable** — chart elements focusable, screen reader summary via aria-label

## Navigation Patterns

90. **Bottom nav max 5 items** with both icon and text label
91. **Back behavior must be predictable** — preserve scroll position and state
92. **Deep link all key screens** — every screen reachable via URL
93. **Active state highlighted** — current location clearly indicated
94. **Modal has clear close affordance** — X button + swipe-down on mobile
95. **Search easily reachable** — suggest queries, show recent searches
96. **Breadcrumbs for 3+ levels** on web
97. **State preservation on back** — restore scroll, filters, input values
98. **Adaptive navigation** — sidebar on large screens, bottom/top nav on small
99. **Don't mix Tab + Sidebar** at the same hierarchy level
100. **Focus main content on route change** — move focus for screen readers

## Pre-Delivery UI Checklist

Before shipping any UI:

**Visual Quality:**
- [ ] No emoji as structural icons — use SVG (Lucide, Heroicons)
- [ ] Consistent icon family/style and stroke width
- [ ] No layout shift on pressed/hover states
- [ ] Semantic theme tokens (no raw hex)

**Interaction:**
- [ ] Touch targets minimum 44x44pt with 8px spacing between
- [ ] Press feedback within 100ms
- [ ] Micro-interactions 150-300ms with ease-out
- [ ] Disabled states: opacity 0.38-0.5 + cursor change
- [ ] One primary CTA per screen

**Light/Dark Mode:**
- [ ] Primary text contrast 4.5:1 in both modes
- [ ] Dividers/borders distinguishable in both modes
- [ ] Modal scrim 40-60% opacity
- [ ] Both themes tested

**Layout:**
- [ ] Safe areas respected (notch, status bar, gesture area)
- [ ] Tested: small phone, large phone, tablet, desktop
- [ ] 4/8px spacing rhythm maintained (see Spacing & Layout Consistency rules S1–S8)
- [ ] Every modal/dialog has `p-4` (mobile) or `p-6` (desktop) internal padding
- [ ] Every page root has responsive horizontal padding (`px-4 sm:px-6 lg:px-8`)
- [ ] Every button group has `gap-2` or more — no buttons touching
- [ ] Every form has `space-y-4` between fields
- [ ] Every required form field has a red asterisk — `<span className="text-destructive">*</span>` after label text, plus `required` + `aria-required="true"` on the input
- [ ] No raw pixel values in `style` or `className="p-[13px]"` — only theme tokens
- [ ] Content not hidden behind fixed bars
- [ ] All action buttons/icons (edit, delete, restore, upload, etc.) are hidden for roles that cannot perform the action — not just disabled
- [ ] All tooltips have `max-width` set and were tested near viewport edges — no text cutoff, no overflow
- [ ] No duplicate heading text exists on the page (check h1/h2/h3 for repeated labels)
- [ ] Legal/info links (Terms, Privacy) are `<a>` or `<Link>` elements, not spans or divs with onClick
- [ ] One dominant element per view; three distinct type levels visible
- [ ] Related items grouped by proximity (closer within a group than between groups)
- [ ] Same card padding / radius / elevation for the same card role across the milestone's screens
- [ ] Same page-header and empty/loading/error pattern reused across screens (no per-screen reinvention)
- [ ] Long text holds a 45 to 90 character measure at every breakpoint
- [ ] Numeric columns right-aligned; labels and inputs share a left edge

## Cross-References

- Responsive design, accessibility (WCAG) → `frontend-rules.md`
- Component reuse, design tokens → `component-reuse-rules.md`
- Security (XSS, input sanitization) → `security-rules.md`
- Mobile platform specifics → `mobile-rules.md`
- shadcn/ui component patterns → `shadcn-ui/SKILL.md`

<!-- Version: 1.7.0 (2026-06-29): Added S9 (rhythm + alignment consistency, BLOCKING) and 6 Pre-Delivery Layout checklist items (dominant element, type levels, proximity grouping, card-role uniformity, header/state reuse, text measure, numeric right-align). Implementation-level subset of the new design-rules "Layout craft" production-grade design track. -->
<!-- Version: 1.8.0 | 2026-08-20 | positive-direction phrasing pass, constraints unchanged -->
<!-- Version: 1.6.0 — 2026-05-01 — Added Tooltip & Overflow Safety (Rules 101–102) and 4 Pre-Delivery Checklist items: role-gated buttons, tooltip max-width, unique headings, legal link anchors -->
<!-- Version: 1.5.0 — 2026-04-17 — Added Spacing & Layout Consistency section (S1–S8) as BLOCKING rules: design tokens only, modal/page/button-group padding, component-registry spacing contract, spacing audit checklist -->
<!-- Version: 1.4.0 — 2026-04-15 — Rules 14–15: updated to package-first lookup (scan package.json before registry, show correct usage for each common library) -->
<!-- Version: 1.4.1 | 2026-10-05 | paths: now also loads for **/*.vue, so Vue single-file components get the same frontend rules as .tsx and .jsx -->
