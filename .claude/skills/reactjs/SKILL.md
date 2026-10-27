---
name: reactjs
description: "Authoritative skill for React.js-specific patterns: custom hooks, React.lazy and code splitting, useMemo/useCallback memoization, Context API, React Hook Form with Zod, forwardRef, class-to-hooks conversion, and re-render performance tuning. Use whenever the task names React primitives or asks to build, refactor, or optimize a React component or app. Do NOT use for: Next.js App Router or Server Components (use nextjs), shadcn/ui (use shadcn-ui), Playwright E2E (use e2e-testing), or non-React tasks (use build). Also triggers on: 'Zustand store', 'React testing'."
mcp_integrations: [context7]
next_skill: null
required_gate: null
skill_id: SK-087
context_budget:
  load_kb: 30
  scope: task
version: 1.5.3
dependencies:
  required: [build]
  optional: [design-discovery, design-tokens, design-screens, shadcn-ui, nextjs]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

> **Comments & docs:** Docstrings/JSDoc on every function. No inline comments except a one-line *why* for genuinely complex logic (calculations, time conversions, deliberate workarounds). No commented-out code. Put rationale, decisions, and feature context in `AI_DOCS/planning/` + `AI_DOCS/memory/decision-log.md` and keep it updated in the same change. Full policy: `.claude/rules/development-rules.md` -> Code Comments & Documentation.

# React.js

Framework-agnostic React. Next.js patterns -> `nextjs/SKILL.md`.

Loads: `rules/development-rules.md` and `rules/frontend-rules.md`.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials):

- `context7` (free): live React 18/19 hooks, patterns, and performance docs while implementing.

## Project Structure

```
src/
  features/{domain}/   components, hooks, types, index.ts (barrel)
  components/          shared UI (used by 2+ features)
  hooks/ lib/ providers/ types/
  app/ or pages/       routes
```

- Colocate by feature; promote to shared only when 2+ features use it.
- Barrel exports only at feature boundary; never deep-nest them.
- No circular cross-feature imports — extract to `lib/` or shared `hooks/`.

## Hooks & Effects

- Always prefix with `use`. Never call hooks conditionally or in loops.
- Dependency arrays exhaustive (trust ESLint).
- `useRef` for values that effects need but should not retrigger on.
- Extract custom hook when logic is reused or component exceeds ~100 lines.
- Cleanup: every subscription/interval/listener returns a cleanup fn.

```tsx
// Stale closure fix — ref for latest value
function useAutoSave(data: FormData) {
  const ref = useRef(data); ref.current = data;
  useEffect(() => {
    const id = setInterval(() => saveToServer(ref.current), 5000);
    return () => clearInterval(id);
  }, []);
}
```

Server-state hooks (`useQuery`, `useSWR`) -> `caching-strategy/SKILL.md`.

## Forms, State, Context

> **Code to the installed stack first (`tech-stack-selection-rules.md` Rule 9).** Read `package.json` + `stack.md` and use what is installed: `react-hook-form` for forms, `zod` + `@hookform/resolvers` for validation, RTK Query (`@reduxjs/toolkit`) for server state + the submit mutation (else `@tanstack/react-query` / `swr`), the installed UI library, the installed HTTP client. An installed core lib left unused (raw `fetch` where RTK Query is installed, a `useState` form where react-hook-form is installed) is a defect: adopt it. If the manifest and `stack.md` disagree, flag it, do not guess.

```tsx
const schema = z.object({ email: z.string().email(), name: z.string().min(2) });
type Values = z.infer<typeof schema>;
const { register, handleSubmit } = useForm<Values>({ resolver: zodResolver(schema) });
```

- Zod schema separate from form (reusable for API validation).
- Never mix controlled and uncontrolled inputs.
- Type `onSubmit` with `z.infer<typeof schema>` — never `any`.
- Multi-step: `schema.pick({...})`. Dynamic fields: `useFieldArray`.
- Form UI composition (FieldGroup/Field) -> `shadcn-ui/SKILL.md`.

| Lib | Use For |
|---|---|
| Redux Toolkit + RTK Query | The standard here: RTK Query for server state + the form-submit mutation, RTK slices for global/shared and multi-step form state (per `frontend-rules.md` 11 + 19c) |
| Zustand | Lightweight client-only UI state (modals, transient toggles) — complements RTK, not a server-state replacement |
| Jotai | Fine-grained atomic state (niche) |
| Context | Rarely-changing values (theme, locale, auth) |

- Server state goes in **RTK Query** (the Redux Toolkit standard here), or TanStack Query / SWR on a non-Redux stack. Never hand-rolled `fetch`-in-`useEffect`, and never raw client UI stores (Zustand) for server data.
- Split contexts by domain. Expose via custom hook; throw if used outside provider.
- Frequently-changing values + many consumers -> use Zustand, not Context.

## Performance & Refs

| Hook | Use When | Skip When |
|---|---|---|
| `useMemo` | Expensive compute (sort/filter large arrays) | Trivial ops |
| `useCallback` | Passed to `React.memo` child or effect dep | Inline handler on native element |
| `React.memo` | Frequent re-render with same props | Cheap render or props change every render |

- Never memoize without a measured problem. Profile first.
- `forwardRef` on reusable input/button components.
- `useImperativeHandle` to restrict the exposed API.
- Never use refs to bypass React data flow — use state.

## React 18/19 & Splitting

| API | Use For |
|---|---|
| `useTransition` | Non-urgent updates (filtering large lists) |
| `useDeferredValue` | Defer expensive derived value from fast-changing input |
| `Suspense` | Lazy components, data boundaries — wrap the slow part only |
| `use()` (19) | Read promises/context in render |

```tsx
const Dashboard = lazy(() => import('./pages/Dashboard'));
<Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>
```

- Route-level split for non-Next apps.
- Split any non-global library >50KB (charts, rich text).
- Suspense fallback must be meaningful — never empty `<div>`.
- Next.js Suspense quirks (CSR bailout) -> `nextjs/SKILL.md`.

## TypeScript & Testing

- Never `React.FC` — plain function with typed props object.
- Discriminated unions for variant-dependent props.
- Extract prop types into named interfaces; no inline shapes.
- Extend native: `ComponentPropsWithoutRef<'input'> & { label: string }`.
- Compound components when 3+ sub-elements share parent state (Tabs.Tab, Tabs.Panel).
- Polymorphic `as` prop must constrain to `ElementType`.
- Tests: query by role/label/text first; `userEvent` over `fireEvent`; async uses `findBy`.

## Client IDs & Web Crypto (BLOCKING)

- **Never call `crypto.randomUUID()` directly in client/browser code.** It is exposed ONLY in secure contexts (HTTPS or `localhost`). Served over plain HTTP on a LAN IP (`http://192.168.x.x`), a preview URL, or inside an older webview, `crypto.randomUUID` is `undefined` and throws `crypto.randomUUID is not a function`. The same gate applies to `crypto.subtle`. This is a runtime crash, not a typecheck error, so it survives CI and only shows up off `localhost`.
- **`crypto.getRandomValues` IS available in insecure contexts** — only `randomUUID` and `subtle` are secure-context-gated. So the fix is a fallback, not "move it to the server".
- **Use a `safeRandomUUID()` helper** (native when present, `getRandomValues` v4 fallback). Never fall back to `Math.random` — it is not cryptographically strong and is banned by `security-rules.md`.
- Generate the id once at data-creation time and store it; never call it inside `map()` (key instability + re-render churn).

```ts
export function safeRandomUUID(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // RFC 4122 version 4
    b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  throw new Error('No Web Crypto RNG available');
}
```

## When NOT to Use

- Server Components / `'use client'` boundaries -> nextjs
- shadcn/ui install or composition -> shadcn-ui
- E2E tests -> e2e-testing
<!-- Version: 1.5.3 | 2026-10-22 | repointed rule references after code-rules.md and compliance/secrets.md merges (v4.32.0) -->
