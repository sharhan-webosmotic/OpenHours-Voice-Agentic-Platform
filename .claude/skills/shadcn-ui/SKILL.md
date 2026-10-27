---
name: shadcn-ui
description: "Authoritative skill for any task naming a shadcn/ui component: adding, installing, searching the registry, fixing broken or misaligned behavior or styling, restyling, composing, or wiring up UI components. Component names that always route here: Dialog, Sheet, Drawer, Select, Combobox, Popover, Tooltip, Command, Button, Form, Toast, Tabs, plus Radix primitives. Use when the prompt names a shadcn component, even when the verb is 'fix', 'style', or 'align'. Do NOT use for: framework-agnostic React hooks (use reactjs), Next.js App Router/RSC (use nextjs), or new design tokens (use design-tokens)."
mcp_integrations: [shadcn]
next_skill: null
required_gate: null
skill_id: SK-103
context_budget:
  load_kb: 30
  scope: task
version: 1.2.3
dependencies:
  required: [build]
  optional: [design-discovery, design-tokens, design-screens]
note: "For the full dynamic skill: npx skills add https://github.com/shadcn/ui --skill shadcn"
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

> **Comments & docs:** Docstrings/JSDoc on every function. No inline comments except a one-line *why* for genuinely complex logic (calculations, time conversions, deliberate workarounds). No commented-out code. Put rationale, decisions, and feature context in `AI_DOCS/planning/` + `AI_DOCS/memory/decision-log.md` and keep it updated in the same change. Full policy: `.claude/rules/development-rules.md` -> Code Comments & Documentation.

# shadcn/ui

Loads: `rules/development-rules.md` and `rules/frontend-rules.md`.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials):

- `shadcn` (free): search the live component registry and get add commands plus current component code and examples.

## CLI

```bash
npx shadcn@latest search @shadcn -q "sidebar"
npx shadcn@latest docs button dialog
npx shadcn@latest add button card dialog
npx shadcn@latest add button --dry-run        # preview affected files
npx shadcn@latest add button --diff button.tsx  # see exact changes
```

## Styling Rules

- `className` for layout only — never override component colors.
- Replace `space-x-*` / `space-y-*` with `flex gap-*`.
- Use `size-*` for equal width/height (not `w-10 h-10`).
- Use `truncate` shorthand (not manual overflow/ellipsis).
- Semantic tokens only: `bg-background`, `text-muted-foreground` — never raw colors.
- Use `cn()` for conditional classes.
- Never set `z-index` manually on overlay components.

## Form Rules

- Compose with `FieldGroup` + `Field` — never raw `div` with spacing.
- `InputGroup` requires `InputGroupInput` / `InputGroupTextarea`, not raw `Input`/`Textarea`.
- Buttons inside inputs: `InputGroup` + `InputGroupAddon`.
- Option sets (2-7 choices): `ToggleGroup`.
- Group related checkboxes/radios in `FieldSet` + `FieldLegend`.
- Validation: `data-invalid` on Field, `aria-invalid` on control.
- Required fields: `<span className="text-destructive">*</span>` immediately after label text inside `<FieldLabel>`. Optional fields have no marker. Never use placeholder text as a substitute.

```tsx
{/* Required field */}
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">
      Email <span className="text-destructive">*</span>
    </FieldLabel>
    <Input id="email" required aria-required="true" />
  </Field>
</FieldGroup>

{/* Required field — invalid state */}
<FieldGroup>
  <Field data-invalid>
    <FieldLabel htmlFor="email">
      Email <span className="text-destructive">*</span>
    </FieldLabel>
    <Input id="email" aria-invalid aria-required="true" />
    <FieldDescription>Invalid email.</FieldDescription>
  </Field>
</FieldGroup>
```

## Component Rules

- Items live inside their group: `SelectItem` in `SelectGroup`, `TabsTrigger` in `TabsList`.
- Custom triggers via `asChild` (radix) or `render` (base).
- Dialog/Sheet/Drawer require a Title — use `sr-only` if visually hidden.
- Card composition: Header, Title, Description, Content, Footer.
- Button has no `isPending`/`isLoading` — compose with Spinner + `data-icon`.
- Avatar always needs `AvatarFallback`.

## Icon Rules

- Icons in Button use `data-icon="inline-start"` or `"inline-end"`.
- No sizing classes on icons inside components.
- Pass icons as objects, not string keys.

```tsx
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>
```

## Component Selection

| Need | Use |
|---|---|
| Actions | `Button` + variant |
| Form inputs | Input, Select, Combobox, Switch, Checkbox, RadioGroup, Textarea, InputOTP, Slider |
| Toggle 2-5 options | `ToggleGroup` + `ToggleGroupItem` |
| Data display | Table, Card, Badge, Avatar |
| Navigation | Sidebar, NavigationMenu, Breadcrumb, Tabs, Pagination |
| Overlays | Dialog (modal), Sheet (side), Drawer (bottom), AlertDialog |
| Feedback | sonner (toast), Alert, Progress, Skeleton, Spinner |
| Command palette | `Command` inside `Dialog` |
| Charts | `Chart` (wraps Recharts) |
| Menus | DropdownMenu, ContextMenu, Menubar |
| Tooltips | Tooltip, HoverCard, Popover |

## Updating Components

1. `--dry-run` to see affected files.
2. `--diff <file>` to see exact changes per file.
3. Decide per file: clean -> overwrite; locally modified -> preserve.
4. Never use `--overwrite` without explicit user approval.

## Registries

| Registry | Use For |
|---|---|
| `@shadcn` | Default core UI |
| `@magicui` | Animation-heavy / marketing |
| `@tailark` | Alternative presets and themes |

Registry must be explicit — never guess. Ask if unspecified.

## When NOT to Use

- React hooks/architecture -> reactjs
- RSC / `'use client'` boundaries -> nextjs
- Authoring new design tokens -> design-tokens
<!-- Version: 1.2.3 | 2026-10-22 | repointed rule references after code-rules.md and compliance/secrets.md merges (v4.32.0) -->
