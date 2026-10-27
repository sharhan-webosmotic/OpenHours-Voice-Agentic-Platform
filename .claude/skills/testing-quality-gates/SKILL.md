---
name: testing-quality-gates
description: Use when writing tests, fixing failing tests, adding coverage, or deciding whether a change is done. Defines the test strategy, mandatory test types and the quality gates (pnpm check) for the clinic platform.
---

# Testing and quality gates

## The gate
`pnpm check` = typecheck + lint + unit/integration tests + OpenAPI drift check (+ coverage thresholds in CI). A task is not done until it passes locally. CI repeats it and also runs migrations on an empty DB, dependency audit and the policy-coverage script.

## Test pyramid
- Unit (Vitest): pure logic - availability/slot calculation, timezone maths, phone normalisation, permission matrix helpers, reminder scheduling rules.
- Integration (Vitest + Supertest + Testcontainers PostgreSQL): real database, connected as the restricted `app_user` so RLS is active. Covers routes, services, repositories, jobs, webhooks.
- End-to-end (Playwright): login, book appointment from dashboard, cancel, create prescription as doctor, onboarding a clinic in admin. Few, stable, run in CI on staging-like stack.
- Android: JUnit + Turbine for view-models and scheduling logic; instrumented tests on the device matrix for forwarding.

## Mandatory test types (a PR missing these is incomplete)
1. Tenant isolation: for every repository method, org A cannot read/update/delete org B (expects 404).
2. Permissions: generated from the shared matrix, one test per role x resource x action, plus data-scope cases.
3. Concurrency: two simultaneous bookings of one slot -> exactly one succeeds, other gets 409.
4. Idempotency: replay the same webhook event and the same `Idempotency-Key` -> one effect.
5. Auth: lockout, token rotation and reuse, expired and tampered tokens, deactivated user.
6. Redaction: logger never emits PHI fields (test with real redaction config).
7. Jobs: restart/retry cannot create a duplicate outbound call.

## Rules
- Test behaviour, not implementation. No assertion-free tests, no snapshot-everything, no `.skip` without a ticket.
- Deterministic: inject clocks and ids; no sleeps; no dependence on test order; each test owns its data.
- Synthetic data only. Use factories, not shared mutable fixtures.
- Mock only at the boundary (Sarvam, S3, email). Never mock the database or the tenant client in integration tests.
- A bug fix starts with a failing test that reproduces it.
- Coverage floors: 90% for auth, tenancy, permissions, booking, webhooks; 80% elsewhere in the API. Coverage is a floor, not a goal.
- If tests fail, show the failure output; never weaken or delete a test to make it pass without saying so and why.
