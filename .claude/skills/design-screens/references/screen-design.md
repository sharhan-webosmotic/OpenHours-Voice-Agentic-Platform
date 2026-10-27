# Screen Design Output Format & Milestone Integration

> Production-ready screen design process, output format, and project integration details.
> Referenced by `SKILL.md` — do not use independently.

---

## Gate 5: Production-Ready Designs & Fully Clickable Prototypes

**Input**: UX flows approved for all user roles (including complete interaction maps)

### Process

1. **Screen Planning**:
    - Generate the Screen Inventory Matrix (list all pages and states to design)
    - Update `AI_DOCS/memory/task.md` — add each screen as `[ ]` pending
    - For each screen: detail Visuals, 5 States (default/hover/active/disabled/loading), Components used, Responsive behaviour
    - Mark each screen `[x]` in task.md when design output is complete

2. **Complete Component Library** with all variants and states:
   - Default, Hover, Active, Disabled, Loading, Error, Success states
   - All component variants (sizes, colors, styles)
   - Responsive behavior for all breakpoints
   - **Elevated-direction composites (dashboard-class projects):** screens consume the standard composites seeded by `/design-tokens` rather than re-inventing them: `UserAvatar` + `AvatarStack` (identity), `Sparkline` / `AreaChart` / `ProgressRing` / `StatusBar` (tokenized inline-SVG data-viz, chart color = status color), `StatCard` (KPI, hero + standard), `StatusPill` + `StatusBadge`, `LiveDot` (one restrained always-on signal with reduced-motion fallback). See `rules/design-rules.md` → "Craft defaults". If a needed composite is missing from the registry, add it there first, never hand-roll a one-off per screen.

3. **Design All Screens (Directory Mirror Mandate)**:
   *   **Target Structure:** You MUST organize your output to mirror a standard **Next.js 14+ App Router** application (or the user's selected stack).
   *   **File Path Headers:** Every code block MUST start with the specific file path comment (e.g., `// PATH: src/app/login/page.tsx`).
   *   **Structure Rules:**
       *   **Layout Audit (MANDATORY)**: check parent `layout.tsx` usage. If Parent has Header/Sidebar, Page MUST NOT re-import them.
       *   Pages go to: `src/app/[route]/page.tsx`
       *   Layouts go to: `src/app/[route]/layout.tsx`
       *   Reusable UI go to: `src/components/ui/[name].tsx`
       *   Feature components go to: `src/components/features/[module]/[name].tsx`
       *   Utils go to: `src/lib/utils.ts`
   *   **Example Output:**
       ```tsx
       // PATH: src/components/ui/PrimaryButton.tsx
       import { cn } from "@/lib/utils";
       export function PrimaryButton({ ... }) { ... }
       ```
       ```tsx
       // PATH: src/app/dashboard/projects/page.tsx
       import { ProjectList } from "@/components/features/projects/ProjectList";
       export default function ProjectsPage() { ... }
       ```
   
   > **Sequence Diagram / User Flow Mapping**: For every step in the User Flows, ensure there is a corresponding UI state. Map "Decision Points" (Success vs Error) to distinct views.
   
   **Atomic Consumption Rule**:
   *   **Strict Import Policy**: Your Screen files (e.g., `ProjectList.tsx`) MUST NOT contain raw HTML elements for buttons, inputs, or cards.
   *   **Mandatory Usage**: You MUST import and use the components defined in your `component-registry.md`.
   *   **Example Output**:
       ```tsx
       // GOOD
       import { PrimaryButton } from '@/components/ui/Button';
       return <PrimaryButton label="Save" />

       // BAD
       return <button className="bg-blue-500">Save</button>
       ```

   - Guest screens (Landing, Login, Register, Forgot Password)
   - User screens (Dashboard, Profile, Settings, feature-specific screens)
   - Admin screens (Admin Dashboard, User Management, System Settings)
   - Error screens (404, 500, Maintenance, Offline)

4. **Design All States**:
   - Empty states (no data)
   - Loading states (skeleton loaders)
   - Error states (validation errors, API errors)
   - Success states (confirmations, success messages)

5. **Create Interactive Component Definitions** (Stack Components):
   > [!CAUTION]
   > **CRITICAL: Output isolated Stack Components (e.g., `Sidebar.tsx`). Do not verify via separate prototype.**
   
   **Interactive Component Strategy**:
   - **Output Format**: Write clean, modern React/Next.js components (or target stack).
   - **State Logic**: Use simple prop-based state (e.g., `activeTab='home'`) to demonstrate interactivity. Do not implement complex router logic.
   - **Isolation**: Each component should be self-contained or import other defined components.
   
   **INTERACTION LOGIC RULE**: 
   - Instead of writing complex Vanilla JS for state (e.g., `document.getElementById`), output a **'State Logic Spec'** comment block at the top of every Component file. 
   - Describe the `State Variables` (e.g., `view`, `isLoading`) and `Event Handlers` needed. 
   - **Clickable State Logic**: Use prop-based state (e.g., `const [view, setView] = useState('list' | 'create' | 'edit')`) to swap between Views (List/Add/Edit) within the component.
   - **IMPORTANT**:
      - EVERY component and page MUST have a JSDoc comment at the top with:
      - USE CASE: What the component does and why
      - PRD/FRD Reference: Which requirements it satisfies
      - PROPS: Description of each prop
      - LAYOUT: Visual structure (for complex components)
      - ROLE VISIBILITY: RBAC rules if applicable
      - This keeps AI on track with requirements across sessions.

   **CRUD Parity Mandate (Data Entities)**:
   - For every Data Entity in the FRD (e.g., User, Project, Task), you MUST generate:
     1. **List View**: Data table/grid with pagination.
     2. **Detail View**: Read-only detailed view.
     3. **Create Screen/Modal**: Form with validation logic represented.
     4. **Edit Screen/Modal**: Form pre-filled with **Realistic Dummy Data** (e.g., "Project Alpha", "Status: Active").

   **Complete User Journey Implementation**:
   - Components can be composed to form the **ENTIRE application**.
   - All **exit points** are represented as props (e.g., `onLogout`, `onCancel`).
   - **Error handling** is visible via prop states (e.g., `isError={true}`).
   - **Success flows** are represented via prop states (e.g., `isSuccess={true}`).

### Deliverables

- **Screen Registry** (`screen-registry.md`): Master list of ALL screens with status tracking.
    
    **Screen Registry Schema**:
    ```markdown
    # Screen Registry
    
    ## Summary
    | Status | Count |
    |--------|-------|
    | Done | X |
    | In Progress | X |
    | Pending | X |
    
    ## Guest Screens
    | Screen ID | Screen Name | Route | Status | Design File | Dev File |
    |-----------|-------------|-------|--------|-------------|----------|
    | SCR-001 | Login | /login | Done | `01_Design.md` | `src/app/login/page.tsx` |
    | SCR-002 | Register | /register | WIP | - | - |
    
    ## User Screens
    | Screen ID | Screen Name | Route | Status | Design File | Dev File |
    |-----------|-------------|-------|--------|-------------|----------|
    | SCR-010 | Dashboard | /dashboard | Pending | - | - |
    
    ## Admin Screens
    | Screen ID | Screen Name | Route | Status | Design File | Dev File |
    |-----------|-------------|-------|--------|-------------|----------|
    | SCR-050 | User Management | /admin/users | Pending | - | - |
    ```

- Complete component library (Stack Components)
- All screens for all user roles (Stack Components)
- **Interactive Component Definitions** (Drop-in ready code)
- **Complete navigation flow** (represented by Screen/Page components)
- Design system documentation
- Developer handoff documentation

**Approval Required**: User must approve **code structure and component definition quality** before handoff to development.

> [!IMPORTANT]
> **POST-APPROVAL ACTION**: Once the user approves the design, you MUST remind them to run the sync agent:
> "Design Approved? Run: `design-sync Sync [TaskID]` to move files to production."

---

## Design System Standards

### Color System

**Structure**:
```
Primary Colors (50-900 scale)
├── primary-50 (lightest)
├── primary-500 (base)
└── primary-900 (darkest)

Semantic Colors
├── success (green)
├── warning (yellow/orange)
├── error (red)
└── info (blue)

Neutral/Gray Scale (50-900)

Background & Surface
├── bg-primary
├── bg-secondary
└── surface-elevated
```

**Accessibility**:
- All color combinations must meet WCAG 2.1 AA contrast ratios
- Provide dark mode alternatives (optional but recommended)

### Typography Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| **Display** | 48-72px | Bold | Hero sections |
| **H1** | 36-48px | Bold | Page titles |
| **H2** | 30-36px | Semi-bold | Section headers |
| **H3** | 24-30px | Semi-bold | Sub-sections |
| **H4** | 20-24px | Medium | Card titles |
| **Body** | 16px | Regular | Default text |
| **Small** | 14px | Regular | Secondary text |
| **Caption** | 12px | Regular | Labels, captions |

**Web Fonts**: Use Google Fonts (Inter, Roboto, Outfit) or system fonts for performance.

### Spacing System

Use a consistent spacing scale (multiples of 4px):
- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **2xl**: 48px
- **3xl**: 64px

### Component States

Every interactive component must have:
- **Default**: Normal state
- **Hover**: Mouse over
- **Active**: Clicked/pressed
- **Focus**: Keyboard focus (visible outline)
- **Disabled**: Not interactive (grayed out)
- **Loading**: Async operation in progress
- **Error**: Validation or error state
- **Success**: Successful action confirmation

---

## Related Documentation

> [!IMPORTANT]
> **This prompt is part of the complete AI_PROMPT SDLC framework.**

### Supporting Documents

| Document | Purpose |
|----------|----------|
| [output-structure.md](session-management/templates/output-structure.md) | Where to save design outputs (design folder structure) |
| [technology-standards.md](technology-standards.md) | Frontend technology stack standards |

### Workflow Integration

| Stage | Your Role |
|-------|-----------|
| **Stage 1: PRD** | NO direct involvement |
| **Stage 2: FRD** | Review for UI/UX requirements, user flows |
| **Stage 3: Design** | PRIMARY RESPONSIBILITY - Design based on FRD |
| **Stage 4: Development** | NO direct involvement (handoff to Developer) |

**See [WORKFLOW_INTEGRATION.md](WORKFLOW_INTEGRATION.md) for complete stage definitions.**

### Approval Gates (Stage 3: Design)

| Gate | Decision Point | Deliverable |
|------|----------------|-------------|
| **Gate 3A: Draft Design** | User approves design/feel/theme | 3-4 draft samples |
| **Gate 3B: UX Flows** | User approves UX flows for all roles | UX flow diagrams |
| **Gate 3: Prototype** | User approves overall flow | Complete prototype |

**See [output-structure.md](session-management/templates/output-structure.md) for detailed gate criteria.**

### Output Folder Structure

> [!NOTE]
> **All design outputs save to design folder for consolidated AI documentation.**

**Handoff to [build](build/SKILL.md) skill via design folder**:

```
design/
├── src/                    # Shadow Mirror Code (Container Pattern)
│   ├── app/                # Next.js App Router Structure
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   └── dashboard/
│   ├── components/
│   │   ├── ui/             # Reusable UI Atoms (Buttons, Inputs)
│   │   └── features/       # Feature-specific UI
│   └── lib/
│       └── utils.ts
└── specs/
    ├── discovery.md
    ├── frontend-stack.md   # Confirmed tech stack
    ├── ux-flows-by-role.md
    ├── screen-registry.md  # Master screen tracking
    └── developer-handoff.md  # Complete handoff documentation
```

**See [output-structure.md](session-management/templates/output-structure.md) for complete output structure and handoff procedures.**
