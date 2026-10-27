---
name: api-conformance
description: "Runs API correctness checks against the running dev app: generates OpenAPI from code, diffs it against api-contract.md, fires a real request at every endpoint and asserts status codes and the response envelope. Writes mavs/api.json. Dispatched by /do at milestone validation or when a task changes an endpoint. Not user-facing."
skill_id: SK-155
version: 1.0.1
context_budget:
  load_kb: 25
  scope: task
dependencies:
  required: [api-validator]
  optional: [tech-specification, change-request, mock-data, gate-enforcement]
license: Proprietary
compatibility: "Claude Code 1.x"
produces:
  - path: AI_DOCS/quality/mavs/api.json
    consumers: [mavs-gate.sh, milestone-validation]
consumes:
  - path: AI_DOCS/architecture/api-contract.md
    required_sections: []
metadata:
  author: WebOsmotic Private Limited
  category: gate
  user_facing: false
---

# api-conformance — generate, diff, then prove the API at runtime

> `api-validator` reads the code and compares routes to `api-contract.md`. That is
> a STATIC diff: strong for drift, but it never fires a request, so it cannot tell
> whether an endpoint actually returns the right status code or the standard
> envelope. `api-rules.md` 9-10 (the `{success, data, message?}` envelope and the
> status-code map) were convention-only. This skill proves them by running the app.

## When it runs (dispatched by /do)

- At milestone validation (Gate 4.5) for any project with an API.
- When a task adds or edits an endpoint (alongside `/build`'s API-envelope gate).

## Step 1 — generate the OpenAPI/Swagger doc and diff it

1. Generate an OpenAPI doc from the code where the stack supports it (`@nestjs/swagger`, FastAPI `/openapi.json`, `swagger-jsdoc`, `zod-to-openapi`, etc. from `stack.md`). If no generator is reachable, fall back to deriving the expected surface from `api-contract.md` and record `MISSING_TOOL` for the generation half (never a silent PASS).
2. Diff the generated doc against `api-contract.md`: every contract endpoint present with the declared method, path, request shape, and response shape. A mismatch is a FAIL naming the endpoint. This complements `api-validator`'s static route diff, it does not replace it.

## Step 2 — runtime conformance against the running dev app

Target the project's dev URL/port and dev database ONLY (never staging/prod). For every endpoint in `api-contract.md`:

- Fire a request (authenticated where the contract requires it, reusing the seeded users from `mock-data` / `test-fixtures.md`).
- Assert the HTTP **status code** matches the contract (success path).
- Assert the success body is the standard **envelope**: `{ success: true, data: ... , message?: ... }`.
- Assert the documented **error** paths return the standard error envelope (`{ success: false, error: { code, message, details? } }`) with the correct code: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict (`api-rules.md` 9-10).

Prefer a property-based runner (Schemathesis / Dredd) against the generated OpenAPI when available. Otherwise assert that every contract endpoint has an integration test that hits the real status code + envelope (the integration tests `qa-testing` / `python-testing` author).

## Step 3 — emit `mavs/api.json`

Normalize to the MAVS schema (`docs/mavs-report-schema.md`) at `AI_DOCS/quality/mavs/api.json`:

- `status`: `PASS` if the diff is clean AND every endpoint's runtime status + envelope match; `FAIL` on any diff mismatch, wrong status code, or non-standard envelope; `MISSING_TOOL` if neither a generator nor a running app was reachable (with the run hint); `SKIP` if the project has no API.
- `source_commit` = `git rev-parse HEAD`; `generated_at` = real run time.
- `findings`: one row per problem (`location` = `METHOD /path`).

`mavs-gate.sh` blocks the milestone merge on FAIL or a stale report.

## /build integration (API-envelope gate)

When a task adds/edits a handler, `/build`'s API-envelope gate (see build/SKILL.md) is the fast per-task static check: the handler returns the standard envelope and an allowed status code. This skill is the milestone-close executor that actually runs the app and asserts conformance.

## Lock

`api-contract.md` is LOCKED after Gate 1 (the existing api-contract PreToolUse lock). Endpoint changes route through `/change-request` (updates the contract + the handler together), never a hand-edit of the locked file. Contract drift (a code route absent from the contract) is `drift-detector` Phase A, which BLOCKS at `/audit`.

## Boundaries

- Hits the dev app + dev database ONLY. Never staging/prod.
- Authors no app code (that is `/build`); it generates the OpenAPI, diffs, and asserts.
- Reports MISSING_TOOL rather than PASS when it cannot run.

<!-- Version: 1.0.1 | 2026-10-21 | description trimmed per the v4.28.0 cost policy -->
