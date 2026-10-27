---
name: frontend-react-standards
description: Use when writing or changing React code in apps/clinic-web or apps/admin-web - components, pages, hooks, forms, data fetching, routing, permissions in the UI, state, error handling, frontend tests.
---

# Frontend React standards

## Stack
React 19, TypeScript strict, Vite, Tailwind CSS 4, React Router, TanStack Query, TanStack Table, React Hook Form + zod, Radix-based primitives (shadcn/ui pattern), date-fns with the clinic timezone, Vitest + Testing Library + MSW, Playwright.

## Structure
Feature folders (`features/appointments`, `features/patients`...). Each holds its api hooks, components, pages, schemas and tests. Shared primitives in `components/ui`. Never import from another feature's internals; promote shared code to `components` or `lib`.

## Data and state
- Server state only in TanStack Query. Query keys are arrays built by one key factory per feature. Mutations invalidate precisely, with optimistic updates only where rollback is simple (e.g. follow-up completion).
- Local UI state in components; URL holds filters, page, selected date (never patient data). No global store unless justified in an ADR.
- API access only via `packages/api-client` types. Handle problem+json: map `errors[]` to form fields, show `detail` otherwise with the request ID.

## Forms
React Hook Form + zod schema from `packages/shared`. Disable submit while pending, prevent double submit, show field errors inline, preserve input on failure, confirm destructive actions.

## Permissions in UI
`useCan(resource, action)` hides or disables controls; the API remains the real control. Never render data the API did not return. Handle 403/404 pages explicitly.

## Required states
Every view: loading skeleton, empty state with next action, error with retry, success. Every mutation: pending, success toast, failure message. Route-level error boundary with Sentry report (no PHI in payloads).

## Quality bar
- No `any`; no unchecked casts of API data; no `useEffect` for data fetching or derived state.
- Components under ~200 lines; extract hooks; memoise only when measured.
- Lists: server-side pagination, search and filters; virtualise long lists. Calendar fetches only the visible range.
- Accessibility: semantic elements, labels, focus management in dialogs, keyboard operation, AA contrast, `aria-live` for async status.
- Never store tokens in localStorage; access token in memory; refresh via httpOnly cookie.
- Tests: components via Testing Library by role/label; MSW for the API; one Playwright journey per critical flow.
