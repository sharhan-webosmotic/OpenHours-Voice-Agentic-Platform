---
name: code-review-checklist
description: Use in a fresh session to review a diff or pull request before merge - security, tenancy, correctness, tests, performance and maintainability for the clinic platform. Invoke with /code-review-checklist and the branch name.
---

# Code review checklist

You did not write this code. Do not edit it. Read the root `CLAUDE.md`, then review `git diff main...<branch>`.

## Pass 1 - blockers (must be clean)
1. Tenant bypass: any query not via the tenant client; any `asSystem` without clear reason; missing `organisation_id`; new tenant table without RLS policy.
2. Trust boundary: organisation or role from request input; missing signature check on provider calls.
3. Authorization: endpoint without permission check in the service; missing role/data-scope tests.
4. PHI leakage: logs, errors, URLs, fixtures, Sentry payloads, localStorage.
5. Audit: sensitive read/write without `audit.record`.
6. Secrets: anything credential-like in code, tests, configs, images.
7. Data integrity: check-then-insert without constraint; missing transaction; external call inside transaction; non-idempotent webhook/job/create.
8. Migrations: not additive, edited after apply, locks a big table, no backfill plan.

## Pass 2 - correctness and quality
- Timezone, DST and UTC handling; phone normalisation; off-by-one on ranges (`[start, end)`).
- Error handling: swallowed errors, wrong status codes, leaked internals.
- Race conditions: token rotation, booking, job claiming.
- Types: `any`, unsafe casts, unchecked JSON. Dead code, duplicated logic, files that do too much.
- Tests that pass vacuously, missing negative cases, mocks of the database.

## Pass 3 - performance and operability
N+1, unbounded queries, missing indexes, heavy work on the voice path, bundle growth, missing metrics/log context, no rollback path.

## Output
A table: severity (Blocker / High / Medium / Low), `file:line`, issue, concrete failure scenario, suggested fix. Then: what you could not verify, and a merge recommendation (merge / merge after fixes / do not merge). Be specific; do not pad with praise or style nits that the linter already covers.
