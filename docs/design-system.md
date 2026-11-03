# The ClinicAI design system

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
prototype declares fifteen named CSS custom properties, and all fifteen transferred exactly.
It is not quite free of stray hex values, though, and three of the tokens below come from
them rather than from a named property: the sign-in panel's gradient is written inline as
`linear-gradient(145deg, #214fc2, #356ae6 55%, #8068df)` and one surface as `#fafbff`. Those
values are still the prototype's own, so they are taken verbatim like the rest, but they are
listed separately so the provenance is not overstated. For type and radius the prototype was
not an improvement, and the next section says what had to be decided.

## Colour: taken verbatim

| Token                                 | Value                 | Role                         |
| ------------------------------------- | --------------------- | ---------------------------- |
| `--ca-blue-500` / `--ca-blue-600`     | `#356ae6` / `#2457cf` | clinic accent, and its hover |
| `--ca-violet-500`                     | `#8b6ae8`             | admin accent                 |
| `--ca-violet-600`                     | `#7a57d1`             | **invented.** See below      |
| `--ca-navy-900`                       | `#17264b`             | primary text                 |
| `--ca-slate-600`                      | `#64728f`             | secondary text               |
| `--ca-slate-400`                      | `#8d98ae`             | tertiary text, scrollbars    |
| `--ca-slate-100`                      | `#e6eaf4`             | borders                      |
| `--ca-slate-050`                      | `#f3f5fd`             | page background              |
| `--ca-white`                          | `#ffffff`             | surfaces                     |
| `--ca-green-500` / `--ca-green-050`   | `#20b486` / `#e7f8f2` | success                      |
| `--ca-orange-500` / `--ca-orange-050` | `#bd7218` / `#fff5e8` | warning                      |
| `--ca-red-500` / `--ca-red-050`       | `#df4f5d` / `#fff0f2` | danger                       |

Three more are the prototype's values too, taken from inline declarations rather than from
its named properties. They were missing from this table, which is review finding M2.

| Token             | Value     | Role                             | Where it came from            |
| ----------------- | --------- | -------------------------------- | ----------------------------- |
| `--ca-blue-800`   | `#214fc2` | sign-in panel gradient, darkest  | inline `linear-gradient` stop |
| `--ca-violet-550` | `#8068df` | sign-in panel gradient, lightest | inline `linear-gradient` stop |
| `--ca-white-050`  | `#fafbff` | the panel's own surface tint     | inline `background`           |

**One colour is invented, and it is the only one.** The prototype has a single violet and no
darker companion, because it never built the admin console, so there was no violet hover
state to copy. `--ca-violet-600` was derived by applying the blue pair's own delta
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
| `--ca-text-xs`   | 12px | 12 (76 declarations: the body size) |
| `--ca-text-sm`   | 13px | 13                                  |
| `--ca-text-base` | 14px | 14                                  |
| `--ca-text-md`   | 16px | 16                                  |
| `--ca-text-lg`   | 18px | 18, 19, 20                          |
| `--ca-text-xl`   | 22px | 21, 22, 23, 24                      |
| `--ca-text-2xl`  | 28px | 27, 28, 29, 30                      |

Weights are Inter 400, 500, 600 and 700. The prototype also loads a 900, which nothing used.

## Radius: snapped from seventeen steps, then tightened

The prototype has seventeen distinct radii, with 8, 9, 10, 11, 12, 13, 14, 15, 16 and 18 all
present. They were first snapped to a five-step scale of 8 to 16px. On 2026-11-03, at the
clinic's request, the whole scale was tightened to 4 to 10px. The prototype's soft corners read
as a consumer app on a screen staff use all day for clinical records. The steps kept their
names, so every component moved with the tokens.

| Token                 | Size  | Was   | Used for                             |
| --------------------- | ----- | ----- | ------------------------------------ |
| `--ca-radius-sm`      | 4px   | 8px   | Small chips, the keyboard hint       |
| `--ca-radius-md`      | 6px   | 10px  | Inputs, badges, menu items           |
| `--ca-radius-lg`      | 8px   | 12px  | Panels inside a card, the day list   |
| `--ca-radius-xl`      | 10px  | 16px  | Modals, the empty state              |
| `--ca-radius-control` | 6px   | 11px  | Buttons, icon buttons, the logo tile |
| `--ca-radius-card`    | 10px  | 18px  | Every card on every screen           |
| `--ca-radius-full`    | 999px | 999px | Avatars (circles), switches, dots    |

One-off radii the export carried (22px on the modal, 14px on the account avatar, 12px and 9px
on the view switcher, and others) were replaced with these tokens rather than kept.

## Elevation: shorter and quieter

Tightened with the radius. The prototype's long 30px blur under every card and its coloured
glow under every blue button made surfaces look like they floated. A crisp short shadow reads
as a surface sitting on the page.

| Token                       | Value                                                            | Was                                   |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| `--ca-shadow-card`          | `0 1px 2px rgba(23,38,75,0.04), 0 2px 8px rgba(23,38,75,0.04)`   | `0 8px 30px rgba(37,55,103,0.06)`     |
| `--ca-shadow-control` (new) | `0 1px 2px rgba(23,38,75,0.08)`                                  | none                                  |
| `--ca-shadow-accent`        | `0 1px 2px rgba(36,87,207,0.24)`                                 | `0 7px 9px rgba(53,106,230,0.2)`      |
| `--ca-shadow-accent-strong` | `0 1px 3px rgba(36,87,207,0.3)`                                  | `0 8px 9px rgba(53,106,230,0.25)`     |
| `--ca-shadow-popover`       | `0 4px 16px rgba(23,38,75,0.1), 0 1px 3px rgba(23,38,75,0.06)`   | `0 2px 8px rgba(30,49,90,0.08)`       |
| `--ca-shadow-modal`         | `0 24px 70px rgba(20,34,68,0.2)` (unchanged, now used by modals) | same, but modals used the card shadow |

Both applications carry the same values (D-009). The admin console has no accent shadow, control
radius or card radius, because nothing there uses them yet.

## The two layers, and why dark mode is cheap later

`src/styles/tokens.css` has primitives (`--ca-blue-500`) and semantic tokens
(`--ca-color-accent`). **A component may only read a semantic token.** It asks for "the
danger text colour" and the token layer decides what that is.

Dark mode is not built, as agreed. The point of the indirection is that adding it is a
second definition of the semantic block under `[data-theme='dark']`, and no component, test
or screen changes. Had components named `--ca-navy-900` directly, dark mode would have been a
rewrite of every component instead.

`src/styles/theme.css` maps the semantic tokens onto Tailwind's namespaces with
`@theme inline`, so `bg-surface` and `text-muted` are generated utilities. **`inline` is
required**: without it Tailwind copies each value into the utility at build time and
`[data-theme='dark']` would have nothing to override. The `--ca-` prefix exists because
Tailwind treats `--color-*` as its own namespace, so a token named `--color-surface` would be
both the source and the target of the mapping.

## The accent is the only per-application difference

Each application's `src/styles/app.css` imports the theme and overrides three tokens:

```css
:root {
  --ca-color-accent: var(--ca-blue-500); /* --ca-violet-500 in the console */
  --ca-color-accent-strong: var(--ca-blue-600);
  --ca-color-accent-ring: rgba(53, 106, 230, 0.2);
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
