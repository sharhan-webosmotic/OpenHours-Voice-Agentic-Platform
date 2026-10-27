# App-Shell Decisions

> Reason-first record of the application shell and primitives, authored by the
> `principal-designer` agent BEFORE any shell code is written (Track H, Stage 0).
> Deployed to `AI_DOCS/design/app-shell-decisions.md`. Every element is decided
> against THIS project's requirement, not a template default. The built shell is
> then craft-reviewed, registered in `component-registry.md`, and LOCKED.
>
> For each element: the chosen pattern, WHY it fits this requirement (trace to a
> `ux-brief.md` job-to-be-done where one exists), what it improves over the naive
> default, and the vetted-library primitive it builds on (shadcn/ui + Radix by
> default, bespoke only with logged justification per tech-stack-selection-rules).

## Shell library

- **Chosen base:** <shadcn/ui + Radix | bespoke>
- **Why:** <requirement signal: enterprise data density, a11y, white-label need, etc.>
- **ADR:** `AI_DOCS/architecture/adrs/<NNN-ui-component-library>.md`

---

## Top navigation

- **Pattern:** <e.g. fixed top bar with product switcher + global search + notifications + profile>
- **Why (requirement / JTBD):** <which roles need what at the top; trace to ux-brief job>
- **Improves over naive default:** <e.g. global search reachable by keyboard from every screen, not buried>
- **Built on:** <Radix Menubar / NavigationMenu + tokens>

## Side navigation

- **Pattern:** <collapsible sidebar, role-aware sections, active-state, responsive drawer on mobile>
- **Why (requirement / JTBD):** <role-based IA: admin vs manager vs end-user surfaces>
- **Improves over naive default:** <e.g. collapses to icons at md, full drawer at sm, never a dead hamburger>
- **Built on:** <Radix Collapsible / NavigationMenu + tokens>

## User profile

- **Pattern:** <avatar menu: account, switch-tenant, theme, sign-out, sensitive-action re-auth>
- **Why (requirement / JTBD):** <multi-tenant? per-tenant theme? step-up auth on sensitive actions?>
- **Improves over naive default:** <e.g. tenant switch + masked email, not just a logout link>
- **Built on:** <Radix DropdownMenu + Avatar + tokens>

## Auth (layout + screens)

- **Pattern:** <AuthLayout shell + sign-in / sign-up / reset / MFA / session-expiry screens>
- **Why (requirement / JTBD):** <auth model from stack.md: session vs JWT, MFA, reset discipline>
- **Improves over naive default:** <e.g. distinct MFA + reset + session-expiry, not one login box>
- **Built on:** <Form primitives + tokens>

## Content region

- **Pattern:** <page-shell: header (title + subtitle + primary action area), breadcrumb, content, max-width cap>
- **Why (requirement / JTBD):** <density target; wide-canvas cap; consistent page header across screens>
- **Improves over naive default:** <e.g. one page-header treatment reused everywhere, content capped at 1440+>
- **Built on:** <layout primitives + tokens>

## Tables (data-dense)

- **Pattern:** <DataTable: sort, filter, saved views, column management, row density, bulk-select>
- **Why (requirement / JTBD):** <which entities are listed at scale; designed for realistic density (10k rows)>
- **Improves over naive default:** <e.g. saved views + column mgmt + keyboard operability, not a raw HTML table>
- **Built on:** <TanStack Table + shadcn DataTable + tokens>

## Pagination

- **Pattern:** <page-size selector + cursor/offset controls + result count, keyboard reachable>
- **Why (requirement / JTBD):** <list sizes; server vs client pagination from the data shape>
- **Improves over naive default:** <e.g. shows total + page-size, not just prev/next>
- **Built on:** <shadcn Pagination + tokens>

## Cards

- **Pattern:** <one card treatment per role: padding, radius, elevation tier, header style>
- **Why (requirement / JTBD):** <metric cards vs entity cards vs action cards>
- **Improves over naive default:** <e.g. surface differentiation by tint/shadow, not border-only>
- **Built on:** <shadcn Card + tokens>

## Forms (incl. multi-step / wizard)

- **Pattern:** <Form primitive: inline validation, progressive disclosure, multi-step wizard where needed>
- **Why (requirement / JTBD):** <which flows are long enough to need a wizard; validation timing>
- **Improves over naive default:** <e.g. inline validation + step progress, not one long error-at-submit form>
- **Built on:** <react-hook-form + zod + shadcn Form + tokens>

## State components (the enterprise differentiator)

One reusable composition each, reused across every screen (no per-screen reinvention):

- **EmptyState (first-run):** icon/illustration + reason + primary action. Why: <onboarding moment per role>.
- **FilteredEmptyState:** distinct copy + "Clear filters". Why: <filtered-to-zero is not first-run>.
- **LoadingSkeleton:** skeleton matching the real layout shape, not a bare spinner.
- **ErrorState:** names the cause (network / validation / server / permission-denied, distinct) + retry.
- **ReadOnlyWrapper:** read-only rendering of an editable surface per role.
- **BulkActionBar:** selection count + bulk actions, appears on multi-select.
- **Built on:** <shadcn primitives + tokens>

## Sensitive data and destructive actions (security UX)

- **MaskedField:** which fields are masked by default and reveal on explicit action. Why (ux-brief security-UX): <list fields>. Never logs cleartext.
- **Step-up re-auth:** which actions require re-authentication before proceeding. Why: <sensitive actions from ux-brief>.
- **UndoSnackbar (undo over confirm):** reversible destructive actions use an Undo snackbar instead of an "are you sure" dialog. Confirm dialogs reserved for truly irreversible actions. Why: <which actions>.

---

## Lock record

- **Craft review verdict (principal-designer):** <APPROVE | CONCERNS resolved>
- **Registered in:** `AI_DOCS/design/component-registry.md` -> "Locked app-shell (frozen)"
- **Locked at:** <YYYY-MM-DD> (gate-status.md: SHELL LOCKED)
