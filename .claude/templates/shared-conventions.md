# Shared Conventions

> Team-wide coding conventions shared across all ADF projects.
> Edit this file to reflect your team's standards.
> Pulled into new projects via `/share-decision import`.

---

## API Design

- RESTful resource naming: plural nouns (`/users`, `/orders`)
- Response envelope: `{ data: ..., error: null, meta: { page, total } }`
- Error envelope: `{ data: null, error: { code, message, details } }`
- Authentication: (define your pattern — e.g., JWT Bearer, API key, session cookie)
- Versioning: (define your approach — e.g., URL path `/v1/`, header `API-Version`)

## Error Handling

- Never expose internal error details to the client
- Log full stack traces server-side, return generic message client-side
- Use structured error codes (e.g., `AUTH_001`, `VALIDATION_002`)

## Auth Pattern

- (Define your auth approach: JWT / OAuth2 / session cookies / API keys)
- Token expiry: (define your policy)
- Refresh token strategy: (define your approach)

## Database Conventions

- Table names: snake_case, plural (e.g., `user_profiles`, `order_items`)
- Primary keys: `id` UUID v4 or auto-increment integer
- Timestamps: `created_at`, `updated_at` on every table (UTC)
- Soft deletes: `deleted_at` nullable timestamp (or hard delete — define your preference)
- Migrations: forward-only, never destructive in production

## Testing Standards

- Unit test coverage floor: minimum 98% on lines, branches, and functions (every project type, POC included)
- Integration tests: required for all API endpoints
- E2E tests: required for critical user journeys
- Test naming: `should <behavior> when <condition>`
- No mocking of database in integration tests

## Code Style

- (Add your language-specific conventions here)
- Comments: explain WHY, not WHAT
- Function length: prefer < 30 lines per function
- Files: one primary export per file

---

*Last updated: (date)*
*Maintained by: (team/person)*
