# apps/clinic-web rules (admin-web follows the same rules)

Read the root `CLAUDE.md` first. Skills: `frontend-react-standards`, `ui-design-system`, `performance-optimisation`, `testing-quality-gates`.

## Layout
```
src/
  app/            router, providers, error boundary, layout shell
  features/<name>/   api hooks, components, pages, schemas, tests for one domain (appointments, patients, ...)
  components/ui/  design-system primitives (Button, Input, Dialog, Table, Badge, EmptyState ...)
  lib/            api client wrapper, date helpers (clinic timezone), permissions hook, formatters
```

## Rules
- All server access goes through `packages/api-client`. No raw `fetch`/`axios` in features. Server state lives in TanStack Query, not in component state or global stores.
- Forms use React Hook Form with the zod schema from `packages/shared`; show field-level errors from problem+json.
- Gate UI with `useCan(resource, action)` from the shared permission matrix. This is cosmetic only; the API is the real control.
- Every data view handles four states: loading (skeleton), empty (with next action), error (with retry), success. Every mutation shows pending, success and failure feedback and invalidates the right queries.
- Never put patient data in URLs, localStorage, sessionStorage, console output or error-tracking payloads. Access token stays in memory; refresh is via httpOnly cookie.
- Dates display in the clinic timezone from the organisation settings; send UTC to the API. Use one date helper module.
- Lists use server-side pagination, search and filters. Calendar views fetch only the visible range.
- Accessibility is a requirement: keyboard operable, visible focus, labels on inputs, contrast AA, no information by colour alone.
- Lazy-load routes. Keep the initial JS bundle under the budget in `vite.config.ts` (fail the build when exceeded).
- Components are small and typed; no `any`; no inline styles; Tailwind tokens only (see `ui-design-system`).
- Tests: Vitest + Testing Library + MSW for components and hooks; Playwright for the main user journeys.
