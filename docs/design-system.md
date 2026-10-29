# The OpenHours design system

Two applications, one design. The clinic dashboard and the admin console hold their own
copies of the token files and the component set (`docs/DECISIONS.md` D-009), and the only
values that differ between them are three accent tokens and, through them, the logo.

## Where the values came from

The source is the **ClinicFlow interactive prototype**, a Figma Make export kept at
`ClinicFlow Interactive Prototype/` in this repository for reference. It is a React 19,
Tailwind 4 and Vite 8 project, the same stack as the applications, so its values are literal
text rather than something measured off a picture. It is not linted, type-checked, built or
shipped.

The Figma connector was never reachable from the session that built this feature, so the
prototype replaced the design file as the source. For colour that is an improvement: the
prototype declares fifteen named CSS custom properties and uses no stray hex values, so the
palette transferred exactly. For type and radius it was not, and the next section says what
had to be decided.

## Colour: taken verbatim

| Token                                 | Value                 | Role                         |
| ------------------------------------- | --------------------- | ---------------------------- |
| `--oh-blue-500` / `--oh-blue-600`     | `#356ae6` / `#2457cf` | clinic accent, and its hover |
| `--oh-violet-500`                     | `#8b6ae8`             | admin accent                 |
| `--oh-violet-600`                     | `#7a57d1`             | **invented.** See below      |
| `--oh-navy-900`                       | `#17264b`             | primary text                 |
| `--oh-slate-600`                      | `#64728f`             | secondary text               |
| `--oh-slate-400`                      | `#8d98ae`             | tertiary text, scrollbars    |
| `--oh-slate-100`                      | `#e6eaf4`             | borders                      |
| `--oh-slate-050`                      | `#f3f5fd`             | page background              |
| `--oh-white`                          | `#ffffff`             | surfaces                     |
| `--oh-green-500` / `--oh-green-050`   | `#20b486` / `#e7f8f2` | success                      |
| `--oh-orange-500` / `--oh-orange-050` | `#bd7218` / `#fff5e8` | warning                      |
| `--oh-red-500` / `--oh-red-050`       | `#df4f5d` / `#fff0f2` | danger                       |

**One colour is invented, and it is the only one.** The prototype has a single violet and no
darker companion, because it never built the admin console, so there was no violet hover
state to copy. `--oh-violet-600` was derived by applying the blue pair's own delta
(`-17, -19, -23`) to the violet, so both accents behave identically on hover. If a designer
disagrees, this is the value to change.

## Type: snapped from fifteen sizes to seven

The export declared **fifteen distinct font sizes**, including one-off values at 19, 21, 23,
27, 29 and 30 pixels. That is characteristic of a generated file, where each node carries
whatever size it was drawn at, and it is not a scale anyone can build against: a component
author facing fifteen choices picks one at random and the product drifts.

Snapped to seven steps. Every size the prototype used more than twice survives; the one-offs
round to the nearest step, and **nothing moved by more than 2 pixels.**

| Token            | Size | Prototype sizes it absorbed         |
| ---------------- | ---- | ----------------------------------- |
| `--oh-text-xs`   | 12px | 12 (76 declarations: the body size) |
| `--oh-text-sm`   | 13px | 13                                  |
| `--oh-text-base` | 14px | 14                                  |
| `--oh-text-md`   | 16px | 16                                  |
| `--oh-text-lg`   | 18px | 18, 19, 20                          |
| `--oh-text-xl`   | 22px | 21, 22, 23, 24                      |
| `--oh-text-2xl`  | 28px | 27, 28, 29, 30                      |

Weights are Inter 400, 500, 600 and 700. The prototype also loads a 900, which nothing used.

## Radius: snapped from seventeen steps to five

Seventeen distinct radii, with 8, 9, 10, 11, 12, 13, 14, 15, 16 and 18 all present. The same
problem and the same treatment.

| Token              | Size  | Prototype radii it absorbed |
| ------------------ | ----- | --------------------------- |
| `--oh-radius-sm`   | 8px   | 5, 6, 7, 8                  |
| `--oh-radius-md`   | 10px  | 9, 10, 11                   |
| `--oh-radius-lg`   | 12px  | 12, 13                      |
| `--oh-radius-xl`   | 16px  | 14, 15, 16, 18, 20, 24      |
| `--oh-radius-full` | 999px | 99, 999                     |

## The two layers, and why dark mode is cheap later

`src/styles/tokens.css` has primitives (`--oh-blue-500`) and semantic tokens
(`--oh-color-accent`). **A component may only read a semantic token.** It asks for "the
danger text colour" and the token layer decides what that is.

Dark mode is not built, as agreed. The point of the indirection is that adding it is a
second definition of the semantic block under `[data-theme='dark']`, and no component, test
or screen changes. Had components named `--oh-navy-900` directly, dark mode would have been a
rewrite of every component instead.

`src/styles/theme.css` maps the semantic tokens onto Tailwind's namespaces with
`@theme inline`, so `bg-surface` and `text-muted` are generated utilities. **`inline` is
required**: without it Tailwind copies each value into the utility at build time and
`[data-theme='dark']` would have nothing to override. The `--oh-` prefix exists because
Tailwind treats `--color-*` as its own namespace, so a token named `--color-surface` would be
both the source and the target of the mapping.

## The accent is the only per-application difference

Each application's `src/styles/app.css` imports the theme and overrides three tokens:

```css
:root {
  --oh-color-accent: var(--oh-blue-500); /* --oh-violet-500 in the console */
  --oh-color-accent-strong: var(--oh-blue-600);
  --oh-color-accent-ring: rgba(53, 106, 230, 0.2);
}
```

The logo is not a second asset. Its mark draws from `currentColor` and the wrapper sets
`text-accent`, so it takes the accent of whichever application renders it.

## Components

Seven primitives in `src/components/ui/`. Deliberately few: this feature needs seven, and an
unused variant is a variant nobody maintains.

| Component    | Notes                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`     | `primary`, `secondary`, `danger`. `type` defaults to `button`, not HTML's `submit`, so a button that submits says so. `loading` sets `aria-busy` and blocks activation                                                                      |
| `Field`      | Label and input are **one component**, so correct wiring is not optional. The id comes from `useId`; `aria-describedby` points at the hint then the error; `aria-invalid` is set only when there is an error; the error is a `role="alert"` |
| `Alert`      | `danger` is `role="alert"`, `success` and `info` are `role="status"`. Each renders a text label as well as a wash, so status is never carried by colour alone                                                                               |
| `Card`       | The one container treatment                                                                                                                                                                                                                 |
| `EmptyState` | `action` is a slot, because an empty state names the next step                                                                                                                                                                              |
| `Logo`       | Mark plus wordmark, accent-driven                                                                                                                                                                                                           |
| `Spinner`    | `aria-hidden` always: the thing that owns the wait does the announcing                                                                                                                                                                      |

## Accessibility decisions that are not negotiable

- **The focus ring is defined once**, globally, on `:focus-visible` for every focusable
  element, rather than per component. A ring a component has to remember to add is a ring some
  component will forget. `:focus-visible` rather than `:focus`, so a mouse click does not ring.
- **`prefers-reduced-motion` is honoured globally.** Motion is only ever feedback here, never
  meaning, so removing it costs nothing.
- **No information by colour alone.** Every status carries text.
- **Type floor is 12px**, which is the prototype's body size and the smallest size used.

## Known gaps

- **No dark mode.** Deliberate, and the token structure is ready for it.
- **The prototype is desktop-only.** Its `body` sets `min-width: 1180px` and its stage
  `1920px`. The applications do not carry those rules, but they have not been designed for a
  phone either, and the sidebar is a fixed 240px. A narrow viewport is untested.
- **No disabled or hover state was specified for anything but buttons and the accent.** Those
  were derived.
- **Only seven components exist.** Tables, the calendar, dialogs, toasts, badges and the date
  controls arrive with the features that need them.
