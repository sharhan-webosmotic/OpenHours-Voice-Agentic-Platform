---
description: Frontend development rules — enforces responsive design, accessibility, state management, and performance
paths:
  - "**/web/**"
  - "**/web-user/**"
  - "**/web-admin/**"
  - "**/frontend/**"
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/pages/**"
  - "**/app/**"
---

# Frontend Development Rules

> Component reuse and design tokens are defined in `component-reuse-rules.md`.
> API contract enforcement is defined in `api-rules.md`.
> This file covers frontend-specific concerns: responsive design, accessibility, state, and performance.

<!-- Version: 1.1.0 — 2026-04-09 — Added Rule 24: router.replace mandate for URL param updates (pagination, sort, filter); added code pattern example -->

## Responsive Design (MANDATORY, all devices)

Every screen, page, and component MUST be fully responsive on every device. This is not a desktop-first design with a mobile afterthought. Design mobile-first, then scale up. No layout is exempt.

1. **Works at every breakpoint** (verified, not assumed):
   - Mobile: 320-767px (design-first baseline, test the 320px floor)
   - Tablet: 768-1023px
   - Desktop: 1024-1440px
   - Wide: 1441px and up (cap content with a `max-width` container so it does not stretch edge to edge on ultra-wide and 4K)

2. **Responsive patterns**:
   - Navigation: hamburger on mobile, sidebar or topbar on desktop
   - Tables: horizontal scroll or card layout on mobile
   - Forms: single column on mobile, multi-column on desktop
   - Modals: full-screen on mobile, centered overlay on desktop
   - Grid layouts: reduce columns as viewport shrinks
   - Images and media: fluid (`max-width: 100%`), never fixed-pixel that overflows

3. **Never use fixed pixel widths** for containers. Use `max-width`, `%`, `rem`, or viewport units.

4. **Acceptance bar at EVERY breakpoint (BLOCKING)**: no horizontal scrollbar, no element wider than the viewport, no clipped or overlapping content, no text cut off by a fixed height, every interactive element reachable, and touch targets at least 44x44px on touch widths. A screen that fails any of these at any breakpoint is not DONE.

5. **How it is verified (executable, two cadences)**: `component-inspector` flags fixed-width and overflow patterns statically; the live confirmation is the `e2e-testing` responsive sweep (committed templates `responsive-sweep.spec.ts` + `geometry-dump.ts` + `responsive-report.mjs`), which asserts the point-4 acceptance bar per screen per width and emits `mavs/responsive.json` (in `required.txt` for web frontends, so a FAIL or missing report blocks the milestone merge).
   - **Per UI task** (`/build` Exercise gate): the changed screen/flow at 375 AND 1440 via the `playwright` MCP or the sweep scoped to that screen.
   - **Milestone close**: the full sweep at 375/768/1024/1440/1920 over every delivered screen, plus the 375 touch interaction lane that OPERATES the sidebar/drawer, top-bar menus, alerts, table sort, filters, pagination, and row-action menus, re-auditing every opened surface.

6. **Density is tuned per breakpoint, not just reflowed (BLOCKING)**: passing the no-overflow bar is not enough, the density must be RIGHT at each width.
   - Mobile: single column, one primary action in reach, no element taller than about 1.5 viewports without internal scroll.
   - Tablet/desktop: grids gain columns to keep card and row heights sane, a card does not stretch to absurd height because the column count never increased.
   - Wide (1441px and up): content is capped by a `max-width` container, a 3-row table or a single form never strands in a 1400px canvas. Either constrain width or add a second column of content.
   - Text measure stays 45 to 90 characters at every width.
   - Verified live with the playwright MCP at 375/768/1024/1440/1920: at each width confirm column count, card-height sanity, and measure, not only the absence of horizontal scroll.

## Spacing & Layout (BLOCKING — see ui-engineering-rules.md S1–S8)

All padding, margin, and gap values MUST come from the design system spacing scale in `AI_DOCS/design/design-dna.md`. Key rules:
- Modals / dialogs: `p-4` (mobile) / `p-6` (desktop) internal padding — never flush to modal border
- Page roots: responsive horizontal padding (`px-4 sm:px-6 lg:px-8`) — content must not touch viewport edge
- Button groups: `gap-2` minimum between buttons — never touching
- Form fields: `space-y-4` between stacked fields
- No raw px values (`p-[13px]`, `style={{ padding: "16px" }}`) — theme tokens only

> Full rules, examples, and anti-patterns in `ui-engineering-rules.md` → "Spacing & Layout Consistency" (rules S1–S8).

## Accessibility (WCAG 2.1 AA)

4. **Semantic HTML** — use `<button>`, `<nav>`, `<main>`, `<article>`, not `<div>` for everything
5. **All images need alt text**
6. **All form inputs need labels** (visible or sr-only)
7. **Keyboard navigation** must work for all interactive elements
8. **Color contrast** must meet WCAG 2.1 AA (4.5:1 for text, 3:1 for large text)
9. **Dark/light mode**: If theme mode is defined in design-dna.md, every component must support it

## State Management

10. **Local state for local concerns** — don't put everything in global store
11. **Server state has a dedicated data layer, not hand-rolled fetch-in-useEffect** — use the project's chosen server-state library from `stack.md`. When the stack is **Redux Toolkit** (the standard for React/Next here), that is **RTK Query** (`createApi`) for queries + mutations and caching; React Query/SWR are the alternatives for non-Redux stacks. Never scatter raw `fetch` + manual loading flags across components.
12. **No prop drilling** beyond 2 levels — use context or composition

## Forms & Validation (BLOCKING — React/Next)

> Every form in a React/Next project follows ONE pattern, so forms do not each reinvent state, validation, and submission. Validation is schema-first, form state is react-hook-form, server state and submission are Redux Toolkit.

19a. **Schema-first validation (Zod), shared client and server.** Every form has a Zod schema that is the SINGLE source of validation. The same schema validates on the client (instant field errors) AND on the server (the trust boundary, per `development-rules.md` rule 56 and `api-rules.md`). Never duplicate the rules in two places, import the one schema. A form whose client and server validation can disagree is a defect.

19b. **`react-hook-form` owns the form state, validated by the Zod schema.** Use `useForm({ resolver: zodResolver(schema), defaultValues })` (resolver from `@hookform/resolvers/zod`). `register` for native inputs; wrap controlled UI-library inputs (shadcn/ui, MUI, Radix) in `<Controller>`. Submit via `handleSubmit`, render per-field errors from `formState.errors`. It owns the LOCAL form state (performant, uncontrolled by default). Do not put every keystroke in the global store, and do not hand-roll `useState` per field.

19c. **Redux Toolkit Query owns submission and server state.** The submit calls an **RTK Query mutation** hook (`const [save, { isLoading, error }] = useSaveXMutation()`), so caching, tag invalidation, and the loading/error state come from the store, not ad-hoc flags. For a multi-step wizard or a form whose state is shared across components, hold that shared state in a **Redux Toolkit slice** (`createSlice`) and hydrate it into react-hook-form per step. A single-step local form needs no slice: react-hook-form for the form, RTK Query for the submit, is enough.

   **RTK Query store setup (Next.js App Router, BLOCKING pattern):** ONE `createApi` base slice; features add endpoints via `baseApi.injectEndpoints(...)` (never multiple `createApi` instances). The store is a **per-request factory** (`makeStore()` → `configureStore`, `.concat(baseApi.middleware)`), mounted through a `'use client'` provider that creates it once per mount with `useState(makeStore)` (NOT a module singleton — a singleton leaks state across requests on the server). Call `setupListeners(store.dispatch)` in the factory (refetch on focus/reconnect). Put credentials via `fetchBaseQuery({ credentials: 'include' })` for cookie sessions; unwrap the standard response envelope in a wrapping `baseQuery` so endpoints resolve to `data`. Use `tagTypes` + `providesTags`/`invalidatesTags` for cache invalidation, never manual refetch flags.

19d. **Submission UX (BLOCKING).** Disable the submit control while the mutation is pending (no double-submit), surface server-side validation by mapping the API error envelope (`api-rules.md` Rule 10) onto fields with react-hook-form `setError` plus a form-level error for non-field failures, keep entered values on failure, and confirm success explicitly. Optimistic updates only where a rollback is safe.
   - **Map field-specific server errors onto the field, not just a banner.** A 409 duplicate (email/name) or a 422 on a named field uses `setError('<field>', { type: 'server', message }, { shouldFocus: true })` so the error appears on and focuses the offending input. Reserve the form-level `Alert` for genuinely non-field failures (401, a generic 500, a cross-field rule).

19f. **Forms never leak field values to the URL (BLOCKING, security).** Every `<form>` sets `method="post"`. A form with no `method` defaults to `method="get"`, so a native submit that fires **before or without JS hydration** (first load over HTTP on a LAN IP or a preview host — a non-secure context — or any hydration failure) appends every field, INCLUDING passwords and tokens, to the URL query string, browser history, and server access logs. `handleSubmit`'s `preventDefault` only protects once hydrated; `method="post"` is the defense that holds when JS has not run (fields go in the request body, never the URL). A login form that GET-submits the password is a P0 leak. See `security-rules.md` Rule 18a.

19e. **Forms respect field-level RBAC.** A field the user may not write renders read-only or disabled, a masked field shows the masked value, a forbidden field is absent, per the authz field matrix and its `data-perm-field` attribute (`security-rules.md` 35, `authz-matrix`). The form must not submit a field the user cannot write, the server rejects it regardless.

## API Integration & Contract Sync (BLOCKING)

13. **Centralize API calls** — use a shared API client (axios instance, fetch wrapper)
    - Base URL from environment variable
    - Auth token injection via interceptor
    - Global error handling
14. **Handle loading, error, and empty states** for every API call
15. **Never hardcode API URLs** — always use the centralized client

16. **Read `AI_DOCS/architecture/api-contract.md` BEFORE writing any API call**
    - Match exact method, URL, body fields, response shape from the contract
    - If endpoint is missing from contract → STOP, use change-request skill to add it

17. **When fixing or changing any API call, update the contract**:
    - If backend changes a response shape → update `api-contract.md` → update frontend
    - If frontend needs a new field → update `api-contract.md` → update backend
    - **Both sides must always match the contract** — never change one side only

18. **After every API change, verify the sync**:
    ```
    For this endpoint:
    ✓ api-contract.md matches?
    ✓ Frontend request (URL, method, body) matches contract?
    ✓ Frontend reads response fields that exist in contract?
    ✓ Backend returns all fields contract defines?
    ```

> Full contract-first protocol in `api-rules.md`. Contract is the bridge — frontend and backend never talk directly, they both read the contract.

## Data Display & Interaction Patterns (MANDATORY)

> Every list/table page of records that can grow MUST implement pagination, search, filter, and sort, and all of them are backend-driven. Missing them on a growable list is a defect. A small, bounded, fixed list (roughly under 100 rows that cannot grow, e.g. a status enum or a short settings menu) MAY omit them with an explicit justification recorded in the spec. If it is genuinely unclear whether a list needs them, ASK the user (one question, options + recommended default), do not guess. The decision is captured per list at planning (`tech-specification` / `prd-generation`), and `api-rules.md` Rules 27-28 are the backend contract.

### Pagination, filter, sort, search are BACKEND-driven (BLOCKING)

22. **ALL pagination, filtering, sorting, and search are backend-driven** — never `.filter()`, `.slice()`, or `.sort()` a frontend array to paginate/filter/sort a list. The client sends the params, the SERVER applies them.
    - Frontend sends `?page=1&pageSize=25&search=...&sortBy=...&status=...` → the backend returns the one matching page
    - Frontend renders ONLY what the API returns (it never holds the full set to slice). Loading the whole collection to the browser to paginate/filter in memory is a defect and a data-exposure risk.

20. **Standard pagination response shape**:
    ```json
    { "data": [...], "pagination": { "page": 1, "limit": 25, "total": 243, "totalPages": 10 } }
    ```

21. **Pagination UI must include**: page numbers (or prev/next), page size selector, total count display

### URL State Sync (BLOCKING)

23. **ALL filters, search, sort, and pagination MUST sync to URL query params**
    - Use `useSearchParams` (Next.js/React Router)
    - Example: `?page=2&limit=25&search=john&status=active&sortBy=name&sortOrder=asc`
    - Preserved on: browser back/forward, page refresh, link sharing
    - Never store filter/pagination state only in `useState`

24. **Use `router.replace` (NOT `router.push`) for all in-page param updates**
    - Pagination, sort, filter, and search changes MUST use `replace` — not `push`
    - `push` floods browser history (every page/filter change becomes a history entry)
    - `replace` keeps the URL current and bookmarkable; back button navigates to the previous *page*, not the previous filter state
    - The URL is the source of truth — navigating back to a list page restores the exact state

    ```typescript
    // CORRECT — router.replace for in-page state changes
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    function updateParams(updates: Record<string, string | undefined>) {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      router.replace(`${pathname}?${params.toString()}`); // NOT router.push
    }

    // Usage examples:
    updateParams({ page: "2" });                        // pagination
    updateParams({ sortBy: "name", sortOrder: "asc" }); // sorting
    updateParams({ search: "john", page: "1" });        // search (reset page)
    updateParams({ status: "active", page: "1" });      // filter (reset page)

    // WRONG — creates a new history entry for every filter/sort/page change
    router.push(`${pathname}?page=${page}`);
    ```

    > **Note for Next.js Pages Router**: use `router.replace({ pathname, query: newParams })` instead.

### Search

24b. **Debounce search input**: 300ms minimum before triggering API call
25. **Clear button** visible when search has value
26. **Placeholder with example** — `Search orders...`, `Search by name or email...`
27. **Show result count** — "Showing 12 of 243 results for 'john'"
28. **Empty search results** — show "No results for '[query]'" with suggestions or clear button

### Filters

29. **Every filterable column needs a filter control** — dropdown, date range, multi-select, or toggle
30. **"Clear all filters" button** visible when any filter is active
31. **Active filter count badge** — show how many filters are applied
32. **Filters persist on back navigation** — URL state ensures this

### Sorting

33. **Sortable columns have clickable headers** with sort direction indicator (arrow up/down)
34. **Only one active sort at a time** — clicking a new column clears the previous sort
35. **Default sort defined** — every list has a sensible default (e.g., newest first)

### Loading & Empty States

36. **Initial load** — show skeleton loader matching the table/list layout (not spinner)
37. **Filter/page change** — show subtle loading indicator (opacity reduction or top progress bar), keep existing data visible
38. **Empty states per context**:
    - No data yet: "No orders yet. Create your first order."
    - No filter results: "No results match your filters." + Clear filters button
    - Error: "Failed to load data." + Retry button
39. **Never show a blank white screen** — every state (loading, empty, error, data) has a designed UI

### State Quality Bar (BLOCKING — presence is not enough)

A state that exists but is low-craft still fails:
- **Empty**: composition of icon/illustration plus one-line reason plus a primary action ("No orders yet" plus "Create order" button). A centered gray sentence with no action is a violation.
- **Loading**: a skeleton that matches the real layout's shape (same rows, same card grid). A bare centered spinner for a content region is a violation. Filter/page changes keep prior data visible with a subtle indicator (rule 37).
- **Error**: names the cause in plain language plus offers the next step (Retry, or a link). "Something went wrong" with no action is a violation (mirrors ui-engineering rule 56).
- **First-run** differs from **empty-after-filter**: the copy and the action are not the same. First-run onboards, filtered-empty offers Clear filters.
- The same four compositions are reused across every screen in the milestone (see design-rules "Uniformity across the milestone").

### Bulk Actions (when applicable)

40. **Select individual rows** with checkboxes
41. **Select all (current page)** and **select all (all pages)** options
42. **Bulk action bar** appears when items selected — shows count + action buttons
43. **Clear selection** button always available
44. **Confirm destructive bulk actions** — "Delete 15 items?" with explicit confirmation

### Export (when applicable)

45. **Export button for data tables** — CSV/Excel download
46. **Export respects current filters** — exports what the user sees, not all data
47. **Large exports show progress and keep the UI responsive**: run the export as an async request or generate it in chunks, because a synchronous export blocks the main thread and the app reads as frozen.

### DataTable Component

48. **Use the registered DataTable component** — never build inline `<table>` elements
49. **DataTable must support**: sortable columns, pagination, row selection, responsive behavior (card layout on mobile), loading skeleton, empty state
50. **Every list page uses the same DataTable** — consistent UX across the entire app

## Performance

51. **Lazy load routes/pages** — never load everything upfront
52. **Optimize images** — use next/image, proper formats (WebP), appropriate sizes
53. **Memoize expensive computations**, and memoize nothing else until profiling shows a cost, because premature memoization adds dependency-array bugs and complexity without a measured win.

## RBAC-Controlled Rendering (BLOCKING)

54. **Action buttons and icons (edit, delete, restore, upload, approve, promote, etc.) MUST be conditionally rendered based on the current user's role and permissions** — never rely on the API to silently reject the action; the button must not appear at all if the user cannot perform it. Pattern: `{hasPermission(user, 'delete') && <DeleteButton />}`. Showing a delete icon to a non-admin user is a FAIL in code review.

55. **Soft-deleted entities: show ONLY a Restore action — hide ALL other actions** — when a record has `deletedAt !== null` (or `isDeleted === true`), the UI must render only the Restore button/icon. All other actions (upload, edit, move-to-next-stage, delete, approve, etc.) must be hidden — not just disabled. A disabled-but-visible action on a deleted record is a defect.

56. **Legal and informational links (Terms of Service, Privacy Policy, Cookie Policy, etc.) MUST be real `<a>` or `<Link>` elements** — never render them as static `<span>`, `<p>`, or `<div>` text with an `onClick` handler. Real anchor tags support: right-click to open in new tab, keyboard navigation, assistive-technology link discovery, and crawlability. A legal link that is not a real anchor is a FAIL in accessibility review.

62. **A permission-scoped name resolver renders exactly three states, and an id is never one of them.** Resolved shows the name. Pending shows a skeleton. Unavailable shows a neutral placeholder, or hides the element entirely when the viewer lacks read permission on that entity. Never fall through a nullish or logical-or chain to the related id as a display value: `{project?.name ?? task.projectId}` is a FAIL in code review.

   The reason is not tidiness. A resolver that ignores its query's error state cannot tell a 403 from "still loading", so a permission denial settles on a raw identifier, and the user reads a database id as corrupt data rather than as a boundary they are not allowed to cross. The bug report then arrives against the wrong subsystem.

   Two things to check alongside it. First, the error state: destructure and handle `isError`, do not let a denied query look pending forever. Second, the sibling endpoint: this pattern usually appears because a DETAIL endpoint returns bare ids while its own LIST endpoint already resolves names server-side. When a fix lands on one endpoint of a pair, check the other in the same change.

63. **A control is rendered only in the views it actually drives.** When one filter bar or toolbar serves several view modes (table, board, calendar, map), each control declares which views consume it, and the bar renders the intersection for the active view. A control that is visible, interactive, and wired into only one of the views is inert everywhere else, and an inert control is worse than an absent one: it makes the product look broken rather than incomplete, and it sends the bug report to the wrong subsystem. Also give every view its own filtered-empty state with a clear-filters affordance, rather than giving one view a way out of an over-filtered list and leaving the others stuck.

## React Correctness (Hooks, Effects, Keys)

57. **Hooks run unconditionally at the top level**: never call a hook inside a condition, loop, or after an early return. Conditional hooks corrupt React's hook order and crash the component.
58. **Complete effect dependency arrays**: list every value the effect reads. Do not disable `react-hooks/exhaustive-deps` to silence a warning. A missing dep is a stale-closure bug, not noise. If a value should not re-trigger the effect, restructure it (a ref, a callback, or move it out). Do not lie to the linter.
59. **Every effect cleans up**: clear timers and intervals, remove event listeners, unsubscribe, and `AbortController`-cancel in-flight fetches in the returned cleanup. Never set state after unmount.
60. **Stable, unique list keys**: `key` is the item's stable id, never the array index when the list can reorder, insert, or delete. Index keys cause wrong-row state and input values bleeding across rows.
61. **Inputs stay controlled**: pass `value` and `onChange` together. Never switch an input between controlled and uncontrolled. Use `value={x ?? ""}`, not `value={x || undefined}`. Compute render values during render. Do not copy props into state and sync with an effect unless genuinely needed.

## Cross-References

- Component reuse, registry checks, design tokens → `component-reuse-rules.md`
- API contract-first development → `api-rules.md`
- Security (XSS, CSRF, auth) → `security-rules.md`
- Naming conventions, error handling → `development-rules.md`
- UI engineering quality (focus, animation, spacing S1–S8, anti-patterns) → `ui-engineering-rules.md`

<!-- Version: 1.6.0 - 2026-06-29 - Production-grade design track: Responsive Design point 6 (density tuned per breakpoint, BLOCKING, live-verified) and the State Quality Bar (empty/loading/error must be composed, not text-or-spinner; first-run vs filtered-empty; reused across the milestone). Pairs with design-rules "Layout craft". -->
<!-- Version: 1.5.0 - 2026-06-26 - Responsive Design made all-device + BLOCKING: added a testable acceptance bar (no horizontal scroll/overflow/clipping at any breakpoint, 44px touch targets, wide-screen max-width cap) and a playwright-MCP verification method at 375/768/1024/1440/1920. -->
<!-- Version: 1.4.0 - 2026-06-23 - Added React Correctness (Rules 57-61): top-level hooks, complete effect deps (no disabling exhaustive-deps), effect cleanup, stable list keys, controlled inputs, mirrors code-rules.md N and O -->
<!-- Version: 1.3.0 — 2026-05-01 — Added RBAC-Controlled Rendering (Rules 54–56): role-gated buttons, soft-delete UI state, real anchor elements for legal links -->
<!-- Version: 1.2.0 — 2026-04-17 — Added Spacing & Layout section with cross-reference to ui-engineering-rules.md S1–S8 -->
<!-- Version: 1.1.0 — 2026-04-09 — Added Rule 24: router.replace mandate for URL param updates -->

<!-- Version: 1.2.0 — 2026-06-29 — list pagination/filter/sort/search are backend-driven and must-have on growable lists; small fixed lists may omit with justification; ask the user when unclear; per-list decision captured at planning (api-rules 27-28) -->

<!-- Version: 1.3.0 — 2026-06-29 — Added Forms & Validation standard (Rules 19a-19e): Zod schema-first validation shared client+server, react-hook-form + zodResolver for form state, Redux Toolkit (RTK Query mutation + slice for shared/multi-step) for submission and shared state, submission UX, and field-level RBAC on form fields. Rule 11 updated: RTK Query is the server-state layer when the stack is Redux Toolkit. -->

<!-- Version: 1.4.0 — 2026-07-01 — Rule 19c gains the RTK Query store-setup pattern (one createApi + injectEndpoints, per-request makeStore factory via useState in a client provider, setupListeners, envelope-unwrap baseQuery, tag invalidation). Rule 19d: map field-specific server errors via setError(field, ..., {shouldFocus}). New Rule 19f: every form sets method=post so a native pre-hydration submit never leaks credentials/PII to the URL (P0). -->
<!-- Version: 1.8.0 | 2026-08-18 | Rules 62-63: name resolvers render name/pending/hidden and never an id; a control renders only in the views it drives -->
<!-- Version: 1.7.0 | 2026-08-06 | Responsive verification made executable with two cadences: point 5 now names the e2e-testing responsive sweep templates (mavs/responsive.json, required for web frontends) as the live check, 375+1440 per UI task via the /build Exercise gate, full 5-width sweep + 375 touch interaction lane (controls operated open, opened surfaces re-audited) at milestone close -->
<!-- Version: 1.9.0 | 2026-08-21 | Rules 47 and 53 gain causal phrasing (2026-08-21 revalidation audit). Duplicate rule number fixed: the second 24 (Debounce search input) is now 24b, all other numbers unchanged. -->
<!-- Version: 1.9.1 | 2026-10-05 | paths: now also loads for **/*.vue, so Vue single-file components get the same frontend rules as .tsx and .jsx -->
