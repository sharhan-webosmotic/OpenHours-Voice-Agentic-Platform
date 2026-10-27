# Enterprise UI Mandates & Design Rules

> These are binding design rules extracted from the Design System skill.
> Referenced by `SKILL.md` — do not use independently.

---

## Enterprise UI Consistency Mandates (NON-NEGOTIABLE)

> [!CRITICAL]
> These are binding design rules for all Production-Grade projects.

| Rule | Standard |
|------|----------|
| **Mandatory Field Markers** | All required form fields MUST show `*` (red) after the label. Optional fields have no marker. Use `<span className="text-destructive">*</span>` (shadcn/ui) or `<span class="text-red-500">*</span>` (plain Tailwind). Also add `required` + `aria-required="true"` on the input element. |
| **Input Icon Placement** | Icons associated with inputs are placed on the **left side** inside the input field. |
| **Card Padding** | 16px (`p-4`) on all sides for cards and panels. |
| **Form Field Gap** | 12px (`gap-3`) between form fields. |
| **Section Margin** | 12px (`mb-3`) between form sections. |
| **Button Padding** | `px-4 py-2` for standard buttons. |
| **Component File Naming** | Follow the chosen framework convention (e.g., PascalCase for React, kebab-case for Vue). |
| **Lazy Loading** | Heavy/non-critical component blocks MUST use the framework's native lazy loading capability. |

---

## Design Token Compliance

> [!IMPORTANT]
> **Full token compliance rules are in `.claude/rules/component-reuse-rules.md` Section "Design Token Compliance".**
> Key rule: No arbitrary hex colors, spacing, or border-radius values — only design system tokens.

---

## STRICT TECH STACK OVERRIDE

> [!IMPORTANT]
> **Use the Project's Tech Stack for ALL Deliverables.**

Despite any instructions to use "Vanilla JS" or "Browser-Viewable HTML", you must **ALWAYS** generate design artifacts in the **Confirmed Tech Stack** (e.g., React, Vue, Tailwind).

*   **Output Format**: Provide single-file components using the chosen stack's native format (e.g., `.tsx`, `.vue`, `.html`).
*   **Prototype**: Do not build a separate prototype. The code you write IS the prototype.
*   **Goal**: The Developer should be able to copy-paste your design output directly into the appropriate project folder.

---

## Task-Based Design Rule (Milestone Alignment)

> [!CRITICAL]
> **NEVER design ALL screens upfront. Design ONLY for the current task/milestone.**

**The Problem**: Designing everything at once leads to:
- User can't provide timely feedback
- Changes in later phases require redesigning earlier work
- Context overload for designers and developers
- Misaligned priorities between design and implementation

**The Rule**:
1. **Design follows milestones** - Only design for the current milestone (M1, M2, etc.)
2. **Design follows tasks** - Only design screens for the current task (T-M2-01, T-M2-02)
3. **Wait for dev approval** - Design of Task N+1 starts only after Task N is approved/implemented
4. **Reference the milestone plan** - Check `AI_DOCS/planning/milestone-plan.md`

**Workflow**:
```
Milestone M1 (Auth) → Design Login/Register → Dev Implements → APPROVE
                                                                    ↓
Milestone M2 (Core)  → Design Core Screens   → Dev Implements → APPROVE
                                                                    ↓
Milestone M3 (Feature A) → Design Feature A  → Dev Implements → APPROVE
```

**Tracking**:
- Check `AI_DOCS/TASK.md` for current milestone and task
- Update design progress in `AI_DOCS/memory/implementation-plan.md`
- Reference Tech Spec sections in design files

---

## Relative Paths Only (Strict Hygiene)

**ALL** file references in your output MUST use **Root-Relative Paths**.
*   **GOOD**: `src/app/login/page.tsx`, `AI_DOCS/design/specs/discovery.md`
*   **BAD**: `d:/Antigravity/project/src/app/...`, `/absolute/path/to/project/...`
*   **WHY**: Absolute paths break cross-platform compatibility and clutter the context.

---

## Professional Data Standards (MANDATORY)

> [!CRITICAL]
> **All data shown in designs must be realistic and professional.**

**Rules**:
- Use realistic names, emails, addresses (e.g., "Sarah Chen", "sarah.chen@example.com")
- No placeholder values: no "Lorem ipsum", "Test User", "test@test.com", "John Doe"
- No obviously fake data identifiers
- Numbers should be realistic (e.g., "47 bookings" not "99999 bookings")
- Dates should be recent and realistic
- All data must reflect the type of application being built

---

## Component & Layout Integrity Check (MANDATORY)

> [!CRITICAL]
> **PREVENT LAYOUT DUPLICATION**: You MUST verify layout inheritance before designing pages.

**The "Double Layout" Trap**:
*   **Problem**: Adding a `Sidebar` to `dashboard/page.tsx` when `dashboard/layout.tsx` ALREADY has the Sidebar.
*   **Result**: User sees two sidebars or nested broken layouts.

**The Integrity Checklist**:
1.  **Layout Audit**:
    *   Does the parent `layout.tsx` already contain the Header/Sidebar?
    *   If YES, the `page.tsx` MUST ONLY contain the inner content.
    *   **Rule**: `page.tsx` should never import `Navbar` or `Sidebar` if they exist in `layout.tsx`.

2.  **Component Registry Linkup**:
    *   Every UI element (Button, Card, Input) MUST be imported from `@/components/ui/...`
    *   **PROHIBITED**: Defining private sub-components (e.g., `const MyLocalButton = ...`) inside a page file.
    *   **PROHIBITED**: Hardcoding repeated Tailwind classes instead of using a component.

3.  **Common Flow Re-use**:
    *   Check: "Does this flow already exist?" (e.g., Deleting an item).
    *   If YES, reuse the existing `DeleteConfirmationModal` component.
    *   Do NOT build a new `RemoveItemDialog`.

---

## Component Reuse Protocol (MANDATORY FOR ALL CODE)

> [!CRITICAL]
> **The full component reuse protocol is defined in `.claude/rules/component-reuse-rules.md`.**
> That file defines: the 4-step registry check, atomic design categories, design token compliance, anti-patterns, and registration protocol.
> Claude Code auto-loads these rules when editing any component file.
>
> **Key principle**: Before writing ANY UI element → check registry → check library → check packages → only then create new.

### Package Documentation Verification (MANDATORY)

Before writing or fixing code that uses a third-party package:

1. **Check installed version**: Read `package.json` for the exact version
2. **Read the official docs for that version**: APIs change between versions — never assume
3. **Verify the import path**: Library APIs and import paths change across major versions
4. **Use the correct API**: Never copy code from examples that may be for a different version

**Common version-sensitive packages:**
| Package | Version Matters Because |
|---------|------------------------|
| `react-hook-form` | v6 vs v7 API is completely different |
| `@tanstack/react-table` | v7 vs v8 API is completely different |
| `react-router-dom` | v5 vs v6 routing paradigm changed |
| `next` | App Router (v13+) vs Pages Router |
| `date-fns` | v2 vs v3 import paths changed |
| `zod` | v3 schema API differs from v2 |
| Shadcn/ui components | Check component source — it IS the code |

### Component Registry Format

Maintain `AI_DOCS/design/component-registry.md` with this format:

```markdown
# Component Registry

## Component Library: [Shadcn/ui | MUI | Ant Design | Custom]
## Installed Version: [e.g., shadcn/ui 2.x, Tailwind 3.4]

## Atoms

| ID | Component | Source | Import Path | Notes |
|----|-----------|--------|-------------|-------|
| C-BTN-01 | PrimaryButton | Shadcn/ui | `@/components/ui/button` | variant="default" |
| C-INP-01 | TextInput | Shadcn/ui | `@/components/ui/input` | |
| C-INP-02 | SelectInput | Shadcn/ui | `@/components/ui/select` | |
| C-INP-03 | DatePicker | Shadcn/ui + react-day-picker | `@/components/ui/date-picker` | |
| C-INP-04 | DateRangePicker | Shadcn/ui + react-day-picker | `@/components/ui/date-range-picker` | |
| C-INP-05 | MultiSelect | Custom (Shadcn Command) | `@/components/ui/multi-select` | |
| C-INP-06 | FileUpload | react-dropzone wrapper | `@/components/ui/file-upload` | |
| C-FRM-01 | FormField | react-hook-form + Zod | `@/components/ui/form` | |
| C-FRM-02 | ValidationSchema | Zod | `@/lib/validations/[module]` | |
| C-DSP-01 | DataTable | TanStack Table | `@/components/ui/data-table` | Sortable, paginated |
| C-DSP-02 | Pagination | Shadcn/ui | `@/components/ui/pagination` | |
| C-DSP-03 | Badge | Shadcn/ui | `@/components/ui/badge` | |
| C-DSP-04 | Avatar | Shadcn/ui | `@/components/ui/avatar` | |
| C-DSP-05 | Progress | Shadcn/ui | `@/components/ui/progress` | |
| C-DSP-06 | Skeleton / Loader | Shadcn/ui | `@/components/ui/skeleton` | |
| C-NAV-01 | Breadcrumb | Shadcn/ui | `@/components/ui/breadcrumb` | |
| C-NAV-02 | DropdownMenu | Shadcn/ui | `@/components/ui/dropdown-menu` | |
| C-NAV-03 | Popover | Shadcn/ui | `@/components/ui/popover` | |
| C-NAV-04 | Stepper | Custom | `@/components/ui/stepper` | |
| C-FBK-01 | Toast | Sonner | `@/components/ui/sonner` | |
| C-FBK-02 | Alert | Shadcn/ui | `@/components/ui/alert` | |
| C-FBK-03 | AlertDialog | Shadcn/ui | `@/components/ui/alert-dialog` | For confirmations |
| C-UTL-01 | SearchInput | Custom (Input + icon) | `@/components/ui/search-input` | |
| C-UTL-02 | FilterPanel | Custom (Popover + Checkbox) | `@/components/ui/filter-panel` | |

## Layouts

| ID | Component | Import Path | Notes |
|----|-----------|-------------|-------|
| L-01 | AppShell (Sidebar + Header) | `@/components/layouts/app-shell` | All authenticated routes |
| L-02 | AuthLayout | `@/components/layouts/auth-layout` | Login, register |
| L-03 | PageHeader | `@/components/layouts/page-header` | Title + breadcrumb + actions |

## Feature Components

| ID | Component | Import Path | Notes |
|----|-----------|-------------|-------|
| [Add as built] | | | |
```

### Enforcement Rules

| Rule | What Happens If Violated |
|--|--|
| New component created when library already has it | Code review FAIL — delete and replace with library component |
| Same component implemented twice in different files | Code review FAIL — extract to shared, delete duplicates |
| Package used without checking installed version | Bug risk — verify version BEFORE proceeding |
| UI built without importing from component-registry | Code review FAIL — refactor to use registry components |
| Raw HTML `<button>`, `<input>`, `<table>` in pages | Code review FAIL — always use component library equivalents |
