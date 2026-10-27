---
description: API development rules — enforces contract-first development and consistent patterns
paths:
  - "**/api/**"
  - "**/backend/**"
  - "**/server/**"
  - "**/*.controller.*"
  - "**/*.service.*"
  - "**/*.route.*"
  - "**/*.middleware.*"
---

# API Development Rules

## Contract-First Development (MANDATORY)

1. **Read `AI_DOCS/architecture/api-contract.md` BEFORE implementing any endpoint**
   - Match the exact method (GET/POST/PUT/PATCH/DELETE)
   - Match the exact URL path and parameters
   - Match the exact request body schema (field names, types, required/optional)
   - Match the exact response schema (field names, types, envelope structure)

2. **Standard response envelope** — every endpoint returns:
   ```json
   { "success": boolean, "data": T, "message?": string }
   ```

3. **Never invent endpoints** — if it's not in api-contract.md, it doesn't exist. Use change-request skill to add new endpoints.

4. **Auth headers** must match the contract definition (Bearer token, API key, etc.)

### Runtime Linkage Audit (during feature implementation)

When the `feature-delivery` skill runs, every feature with a frontend ↔ backend connection must pass the Schema/Backend Linkage Check (Phase 3.2):
- The endpoint exists in `api-contract.md` before any frontend call is wired
- The DB schema has all required fields — missing fields get a migration FIRST
- The TypeScript type matches the API response shape — shared types file, not duplicated definitions

If any mismatch is found → fix the contract and schema FIRST, then implement. **Never build UI against a non-existent endpoint or unmigrated schema.**

> See `skills/feature-delivery/SKILL.md` Phase 3.2 and Phase 4 linkage audit for the full protocol.

## Endpoint Implementation Pattern

5. **Controller/Route layer**: Only handles HTTP concerns (parse params, call service, return response)
6. **Service layer**: Business logic only. No HTTP objects (req/res) in services.
7. **Repository/Data layer**: Database queries only. No business logic.
8. **Validation**: Validate all input at the controller boundary using DTOs/schemas (Zod, class-validator, Pydantic)
   - **Date fields**: fields representing past events (investigation date, incident date, report date) must include a past-date constraint: `z.date().max(new Date(), { message: "Date cannot be in the future" })`. Both frontend (disable future dates in the DatePicker) and backend (schema validation) must enforce this independently.

## Error Handling

9. **Use HTTP status codes correctly**:
   - 200: Success
   - 201: Created
   - 400: Validation error (return field-level errors)
   - 401: Not authenticated
   - 403: Not authorized
   - 404: Resource not found
   - 409: Conflict (duplicate)
   - 500: Server error (never expose internals)

10. **Error response format**:
    ```json
    { "success": false, "message": "Human-readable error", "errors?": [{ "field": "email", "message": "Invalid format" }] }
    ```

## Security

11. **Never trust client input** — validate and sanitize everything
12. **Never expose internal IDs, stack traces, or database errors** in responses
13. **Rate limiting** on auth endpoints (login, register, forgot-password)
14. **No hardcoded secrets** — use environment variables

## Naming Conventions

15. **Routes**: kebab-case (`/user-profiles`, not `/userProfiles`)
16. **Query params**: camelCase (`?sortBy=name`)
17. **Body fields**: camelCase (`{ firstName: "John" }`)
18. **Base URL**: `/api/v1/` prefix for all endpoints

## Testing

19. **Every endpoint needs**: happy path test, validation error test, auth test, edge case test
20. **Use supertest or equivalent** for integration tests — hit the actual HTTP layer

> For coverage targets and test structure, see `testing-rules.md`.

## Soft-Delete & Data Visibility (BLOCKING)

21. **Every GET / LIST / DETAIL endpoint must filter soft-deleted records by default** — if your schema uses a `deletedAt` or `isDeleted` flag, the query MUST include `WHERE deletedAt IS NULL` (or equivalent) unless the endpoint is explicitly a trash/restore context. Returning a soft-deleted record on a normal detail fetch is a FAIL.

22. **Direct-URL access to a soft-deleted record must return 404, not 200** — a user who navigates to `/cases/123` when case 123 is soft-deleted must receive a 404 (or 410 Gone). Returning the record's data bypasses the deletion intent and exposes it to unauthorized viewers.

23. **Trash / restore endpoints are separate, explicitly named routes** — e.g., `GET /cases/trash` (list deleted), `POST /cases/:id/restore`. Standard CRUD routes (`GET /cases/:id`) never return deleted records.

## Lifecycle Semantics Changes (BLOCKING)

29. **Changing an entity's deletion semantics invalidates every guard keyed on that entity's EXISTENCE.** Hard delete to soft delete, soft delete to archived, or the addition of any new terminal status all have the same effect: existence stops meaning what it meant. The task that makes the change enumerates every referential guard, uniqueness check, count, and "still in use" message that reads the affected entity's existence, and states for each whether it now needs an active/status filter. A guard left unexamined is an incomplete task, not a follow-up.

   The failure mode is quiet and both sides look correct. A real instance: a milestone replaced user deletion with deactivation, so rows were retained and a status flipped. A separate, previously-correct guard refused to delete a ROLE while any user still held it, implemented as a row count over the assignment join table. After the change an operator deleted every user holding a role and role-deletion still refused, because deactivated users keep their assignment rows. Neither change was wrong alone, and neither side's tests failed, because each side was individually unchanged. Only the interaction was broken, and nothing was looking at the interaction.

   Do not rely on the suites to catch this. Enumerate the readers.

## Multi-Tenant & Super-Admin Scoping (BLOCKING)

24. **Auth flows (forgot-password, register, invite) must validate that the org / tenant exists before triggering any side effect** — email is never sent, SMS never dispatched, until the tenant lookup returns a confirmed record. Return `400 { message: "Organization not found" }` before any external call.

25. **Every tenant-scoped query must include a `tenantId` (or equivalent) filter** — services must never return cross-tenant data. The `tenantId` must come from the verified session/token, never from the request body or query string.

26. **Super-admin role bypasses tenant filtering — explicitly and uniformly** — when the caller's role is `super_admin` (or equivalent), the service layer must use a system-level scope that omits the `tenantId` filter. This bypass must live in a single shared location (e.g., a `scopeQuery(user, baseQuery)` helper), not scattered per-handler conditionals. Missing the super-admin bypass on any endpoint is a FAIL.

## List Endpoints: Server-Side Pagination, Filtering, Sorting, Search (BLOCKING)

27. **Pagination, filtering, sorting, and search are done by the BACKEND only.** Every list/collection endpoint MUST accept and SERVER-APPLY the params and return one page, never the full set for the client to slice. The database does the work (`LIMIT`/`OFFSET` or keyset/cursor, `WHERE`, `ORDER BY`), not the client.
    - **Pagination:** `?page` + `?pageSize` (or a `?cursor`), applied as `LIMIT`/`OFFSET` or keyset. Response uses the standard shape `{ data: [...], pagination: { page, pageSize, total, totalPages } }` (or `{ data, nextCursor }`).
    - **Filtering:** each filter is a query param applied as a `WHERE` clause. Filters combine with AND. Never return everything and filter in JS.
    - **Sorting:** `?sortBy` + `?sortOrder` (camelCase per Rule 16), applied as `ORDER BY` against an allowlist of sortable columns (an unlisted `sortBy` is a 400, never raw SQL).
    - **Search:** `?search` (or `?q`) applied as an indexed `WHERE` (ILIKE / full-text), not a client filter.
    - An endpoint that returns an unbounded collection with no pagination, or one that ships the full set so the client paginates/filters/sorts in memory, is a FAIL. The `behavior` MAVS validator proves this server-side: different `page`/`sortBy`/`filter`/`search` params must return DIFFERENT server responses.

28. **Whether a given list needs pagination / sort / search / filter is a per-list DECISION, captured at planning.** For any list of records that can grow, all four are must-have (the default). A small, bounded, fixed list (roughly under 100 rows that cannot grow, e.g. a status enum or a settings menu) MAY omit them, but only with an explicit justification recorded in the spec. If it is genuinely unclear whether a list needs them, ASK the user (one question, options + recommended default) rather than guessing. `tech-specification` / `prd-generation` record the decision per list surface.

## Cross-References

- Security (injection, auth, secrets) → `security-rules.md`
- Naming conventions (files, variables) → `development-rules.md`
- Test coverage and traceability → `testing-rules.md`

<!-- Version: 1.1.0 — 2026-05-01 — Added Soft-Delete & Data Visibility (Rules 21–23) and Multi-Tenant & Super-Admin Scoping (Rules 24–26); inline past-date note on Rule 8 -->

<!-- Version: 1.2.0 — 2026-06-29 — Rules 27-28: list endpoints expose + server-apply pagination/filter/sort/search (backend only, never client-side slicing); per-list required-or-not decision captured at planning, ask the user if unclear -->
<!-- Version: 1.3.0 | 2026-08-18 | Rule 29 Lifecycle Semantics Changes: a deletion-semantics change invalidates every guard keyed on that entity existence -->
