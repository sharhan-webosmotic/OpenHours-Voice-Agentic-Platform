---
description: Component reuse rules — prevents duplicate UI work, enforces design system tokens, and maintains the component registry
paths:
  - "**/components/**"
  - "**/ui/**"
  - "**/shared/**"
  - "**/common/**"
  - "**/*.component.*"
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
---

# Component Reuse Rules

## Package-First Lookup (MANDATORY — Run Before Any UI Work)

Before writing or choosing any UI component, run this lookup in order, because native HTML controls can't be restyled to the design tokens and immediately break visual consistency. **Never skip to native HTML.**

**Step 0 — Scan `package.json`** (always first):
```
Read package.json → identify installed UI packages.
Map the needed component to what is already installed.
USE the installed package's component — do not rebuild it.
```

Common package → component mappings:

| Need | If installed | Use |
|------|-------------|-----|
| Select / Dropdown | `shadcn/ui` (has `@/components/ui/select`) | `<Select>` from shadcn |
| Select / Dropdown | `@radix-ui/react-select` | `<Select>` from Radix |
| Select / Dropdown | `react-select` | `<ReactSelect>` |
| Select / Dropdown | `@mui/material` | `<Select>` from MUI |
| Select / Dropdown | `antd` | `<Select>` from antd |
| Select / Dropdown | `@mantine/core` | `<Select>` from Mantine |
| Date picker | `shadcn/ui` + `react-day-picker` | `<Calendar>` + `<Popover>` |
| Date picker | `react-datepicker` | `<DatePicker>` |
| Date picker | `@mui/x-date-pickers` | `<DatePicker>` from MUI X |
| Date picker | `antd` | `<DatePicker>` from antd |
| Date picker | `@mantine/dates` | `<DatePicker>` from Mantine |
| Date picker | `flatpickr` | `<Flatpickr>` wrapper |
| Combobox / Search select | `cmdk` | `<Command>` |
| Combobox / Search select | `shadcn/ui` | `<Command>` / `<Combobox>` |
| Combobox / Search select | `downshift` | `useCombobox` hook |
| Modal / Dialog | `shadcn/ui` | `<Dialog>` |
| Modal / Dialog | `@radix-ui/react-dialog` | `<Dialog>` from Radix |
| Modal / Dialog | `@headlessui/react` | `<Dialog>` from Headless UI |
| Toast / Notification | `sonner` | `toast()` from sonner |
| Toast / Notification | `react-hot-toast` | `toast()` |
| Toast / Notification | `react-toastify` | `<ToastContainer>` |
| Tooltip | `shadcn/ui` | `<Tooltip>` |
| Tooltip | `@radix-ui/react-tooltip` | `<Tooltip>` from Radix |
| Tabs | `shadcn/ui` | `<Tabs>` |
| Table | `@tanstack/react-table` | `useReactTable` hook |
| Popover | `shadcn/ui` | `<Popover>` |
| Checkbox | `shadcn/ui` | `<Checkbox>` |
| Switch / Toggle | `shadcn/ui` | `<Switch>` |
| Slider | `shadcn/ui` | `<Slider>` |
| Radio group | `shadcn/ui` | `<RadioGroup>` |

**If the package IS installed, use it: building a parallel custom version doubles the maintenance surface and drifts from the installed one's updates.**

**If NO suitable package is installed:**
> STOP. Tell the user:
> "No [component type] package is installed. Before I build this, I recommend installing
> [package name] — it provides a consistent, accessible [component]. Shall I proceed
> with the install, or do you want to use a different package?"

---

## The Registry Check (MANDATORY — After Package Scan)

1. **After confirming no installed package covers it, check these in order**:
   ```
   Step 1: Read AI_DOCS/design/component-registry.md
           → Does this component already exist? USE IT.
   
   Step 2: Does a SIMILAR component exist?
           → Can it be extended with new props? EXTEND IT.
   
   Step 3: None of the above?
           → CREATE it, then REGISTER it immediately.
   ```

2. **Complete the package scan and registry check before writing markup.** Skipping either and reaching for native HTML or a duplicate is a defect: it's exactly the failure this lookup exists to prevent.

## Component Design Principles

3. **Single Responsibility** — a component does ONE thing well
   - `UserAvatar` shows an avatar. It does not fetch user data.
   - `DataTable` renders a table. It does not fetch data.
   - `SearchInput` handles search input. It does not execute searches.

4. **Props over hardcoding** — make components configurable:
   ```
   BAD:  <Button className="bg-blue-500">Submit</Button>  (hardcoded)
   GOOD: <Button variant="primary" size="md">Submit</Button>  (configurable)
   ```

5. **Composition over configuration** — use children and slots for complex layouts:
   ```
   BAD:  <Card title="..." subtitle="..." icon="..." footer="..." />
   GOOD: <Card><Card.Header>...</Card.Header><Card.Body>...</Card.Body></Card>
   ```

6. **No business logic in components** — components render UI, hooks/services handle logic

## Design Token Compliance

7. **Colors**: Only use tokens from design-dna.md color palette
   ```
   BAD:  text-[#3B82F6]           (arbitrary hex)
   GOOD: text-primary              (design token)
   ```

8. **Spacing**: Only use the defined spacing scale
   ```
   BAD:  p-[13px]                  (arbitrary)
   GOOD: p-4                       (design token = 16px)
   ```

9. **Typography**: Only use defined font sizes and weights
   ```
   BAD:  text-[15px] font-[450]   (arbitrary)
   GOOD: text-sm font-medium       (design token)
   ```

10. **Border radius**: Only use defined radius values
    ```
    BAD:  rounded-[7px]            (arbitrary)
    GOOD: rounded-lg                (design token)
    ```

## Component Categories

11. **Atoms** — smallest building blocks (Button, Input, Badge, Avatar, Icon)
    - Must be fully self-contained
    - Must support all variants defined in design-dna.md
    - Must handle all states (default, hover, active, disabled, loading, error)

12. **Molecules** — composed of atoms (SearchBar, FormField, Card, NavItem)
    - Import atoms, never recreate them
    - Handle their own internal state

13. **Organisms** — composed of molecules (Header, Sidebar, DataTable, Form)
    - Import molecules, never recreate them
    - May connect to application state

14. **Templates/Pages** — compose organisms into full screens
    - Import organisms, never recreate them
    - Handle routing and page-level data fetching

## Registration Protocol

15. **After creating any new component, immediately add to `AI_DOCS/design/component-registry.md`**:
    ```markdown
    | Component | Path | Category | Props | Variants | Used In |
    |-----------|------|----------|-------|----------|---------|
    | Button | @/components/ui/button | Atom | variant, size, disabled, loading | primary, secondary, ghost, danger | LoginForm, Header |
    ```

16. **After modifying a component**, update the registry entry (especially Props and Used In columns)

### Spacing Contract (required per registry entry)

When registering a new component in `AI_DOCS/design/component-registry.md`, include its spacing contract:
- **Internal padding**: default content padding (e.g., `p-6` for cards, `p-4`/`p-6` for modals)
- **External margin**: managed by parent (recommended) OR component-owned — declare explicitly
- **Stack gap**: required gap when multiple instances are stacked (e.g., `gap-4` between cards)

Extended registry format:
```markdown
| Component | Path | Category | Props | Variants | Internal Padding | Stack Gap | Used In |
|-----------|------|----------|-------|----------|------------------|-----------|---------|
| Card | @/components/ui/card | Molecule | title, footer | default, bordered | p-6 | gap-4 | Dashboard, Orders |
```

This prevents the next developer from guessing spacing and drifting from the design system. Backs `ui-engineering-rules.md` rule S6.

## Standard Page Components (MUST REUSE)

> These components are needed in almost every project. Build them ONCE during the first list page, then reuse everywhere. Never rebuild per page.

23. **DataTable** — Reusable table with: sortable column headers, pagination, row selection (checkboxes), responsive behavior (card layout on mobile), loading skeleton, empty state, bulk action support
    ```
    <DataTable columns={columns} data={data} pagination={pagination} onSort={handleSort} 
               selectable onSelect={handleSelect} loading={isLoading} emptyMessage="No orders yet" />
    ```

24. **SearchInput** — Debounced input (300ms) with: clear button, loading indicator, placeholder with example, configurable min chars
    ```
    <SearchInput placeholder="Search orders..." value={search} onChange={setSearch} debounce={300} />
    ```

25. **FilterBar** — Composable filter container with: filter chips/dropdowns, clear all button, active count badge
    ```
    <FilterBar filters={activeFilters} onClear={clearAll} count={3}>
      <FilterSelect name="status" options={statusOptions} />
      <FilterDateRange name="date" />
    </FilterBar>
    ```

26. **Pagination** — Page navigation with: page numbers, prev/next, page size selector (10/25/50/100), total count
    ```
    <Pagination page={1} totalPages={10} total={243} limit={25} onPageChange={setPage} onLimitChange={setLimit} />
    ```

27. **EmptyState** — Configurable empty view with: icon, title, description, action button
    ```
    <EmptyState icon={<InboxIcon />} title="No orders yet" description="Create your first order to get started" 
                action={<Button onClick={create}>Create Order</Button>} />
    ```

28. **LoadingSkeleton** — Generic skeleton matching the layout it replaces (table rows, cards, form fields)
    ```
    <LoadingSkeleton type="table" rows={5} columns={4} />
    <LoadingSkeleton type="card" count={6} />
    ```

29. **ErrorState** — Error display with: error message, retry button, optional details
    ```
    <ErrorState message="Failed to load orders" onRetry={refetch} />
    ```

30. **BulkActionBar** — Floating action bar with: selected count, action buttons, clear selection
    ```
    <BulkActionBar count={selectedIds.length} onClear={clearSelection}>
      <Button variant="danger" onClick={handleBulkDelete}>Delete {selectedIds.length}</Button>
      <Button onClick={handleExport}>Export</Button>
    </BulkActionBar>
    ```

31. **ExportButton** — CSV/Excel download that respects current filters
    ```
    <ExportButton endpoint="/api/orders/export" filters={currentFilters} filename="orders" />
    ```

> Register ALL of these in `AI_DOCS/design/component-registry.md` after building. Every list page uses the same set — no per-page custom tables.

## Anti-Patterns (NEVER DO)

32. **Extend an existing component with props or a variant, not a copy-pasted fork.** A fork drifts from the original the moment either one changes, and nobody notices.
33. **Check whether a single-page component is actually reusable before building it that way.** Skipping the check is how rule 32's copy-paste forks get created the moment a second page needs it.
34. **Keep fetching logic out of presentational components.** A component that both fetches and renders can't be reused anywhere the data source differs.
35. **Style through the project's styling system, not inline `style={{}}`.** Inline styles bypass the design tokens and can't be themed or audited.
36. **Use the original component directly, not a wrapper that only passes all props through.** A pass-through wrapper adds an indirection layer with no behavior of its own.
37. **Pick one location, `components/common/` or `components/shared/`, never both.** Two parallel folders for the same purpose is where the next duplicate gets created.

## Utility Helpers Are Shared From Their SECOND Use (BLOCKING)

38. **Before defining a non-exported helper, grep the tree for a function of that name and adopt it if one exists.** A formatting, parsing, or unit-conversion helper becomes shared code at its second use, not its fourth. The threshold is deliberately lower than the general "inline until three uses" guidance, because these helpers produce USER-VISIBLE output, and divergent user-visible output reads as a data bug rather than as code duplication.

39. **The same non-exported function name defined in more than one file is a finding, and three or more is a defect.** Highest-value targets, because these are exactly what users compare across screens: durations, currency, dates, percentages, file sizes, and counts.

Why this needs its own rule when the registry check already exists: the registry governs COMPONENTS, and nothing governed utilities. A real instance ran seven copies deep. A one-line hours formatter was defined seven times, as a private local function, in seven different screen files, with zero imports between them. Six were byte-identical. The seventh trimmed whole numbers and appended its own unit suffix while the other six returned a bare decimal and left callers to append the suffix. One screen therefore rendered `8h` where its neighbours rendered `7.5` plus a manual `h`, and it reached the user as "the totals do not match the rows".

Nothing could have caught it. Every copy was correct in isolation, so every unit test passed. No shared import existed, so no reviewer diffing one file ever saw the other six. A one-line function sits below any duplicate-detector's block-size threshold. The divergence is visible only by grepping the NAME across the tree, which nobody does until a bug already points there.

## Cross-References

- Responsive design, accessibility → `frontend-rules.md`
- Security (XSS, input sanitization) → `security-rules.md`
- Naming conventions → `development-rules.md`

<!-- Version: 1.1.0 | 2026-08-18 | Rules 38-39: utility helpers are shared from their SECOND use; a repeated non-exported helper name is a finding -->
<!-- Version: 1.2.0 | 2026-08-20 | positive-direction phrasing pass, constraints unchanged -->
<!-- Version: 1.2.1 | 2026-10-05 | paths: now also loads for **/*.vue, so Vue single-file components get the same frontend rules as .tsx and .jsx -->
