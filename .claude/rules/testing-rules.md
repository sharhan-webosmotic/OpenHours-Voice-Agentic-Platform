---
description: Testing rules — enforces test quality, coverage targets, and test-spec traceability
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/tests/**"
  - "**/test/**"
  - "**/__tests__/**"
---

# Testing Rules

## Verify Before Claim (BLOCKING — Iron Law)

Never claim a test passes, a feature works, or a bug is fixed without:
1. **Running the actual verification command** (test runner, build, linter, or manual check)
2. **Reading the full output** — exit code 0 AND expected assertions present
3. **If output shows failures** → investigate and fix; do NOT mark complete

### Forbidden claims without fresh evidence

- "Tests should pass" / "The code looks right" / "I fixed it, moving on"
- Marking Status=DONE in the milestone's `tasks.md` (or `[x]` in a chunked plan) before running the chunk's verification command
- Saying a migration is safe without running it against a test DB first
- Closing a bug as fixed without reproducing the original symptom and watching it not happen

### What counts as evidence

| Claim | Required Evidence |
|---|---|
| Unit tests pass | Test runner output showing 0 failures |
| Integration tests pass | Integration runner output — real DB, real HTTP |
| Build succeeds | Build command exit code 0 |
| Linter clean | Linter output with 0 errors, 0 warnings |
| Bug fixed | Test case that reproduces original symptom now passes |
| UI works | Screenshot or manual check describing what was seen |

### An agent's success claim is not evidence

When a subagent (builder, test-writer, reviewer) reports DONE or "tests pass", the orchestrator treats that as a lead to check, not a result. Before the claim counts, compare it with `git diff --stat` and the actual changed files, and re-run the verification command or read its log. A report that names files which did not change, omits files which did, or cites a test that does not exist is a failed claim. Handoffs between agents travel as files under `AI_DOCS/.temp/handoff/<task-id>/` (see `context-efficiency-rules.md` Rule 9), so the report being checked is a file the orchestrator can open.

### Red-green proof for regression tests

A regression test for a fixed bug has to be shown to catch that bug. Run it in both states:

1. **Red:** revert the fix (or stub the fixed function back to the broken behaviour) and run the test. It must FAIL, and fail for the reason the bug was reported.
2. **Green:** restore the fix and run the test again. It must PASS.

A test that passes in both states pins nothing, and it will keep passing the day the bug returns. Record both runs in the Evidence table (or the fix commit message) so a reviewer can see the proof. This is the same check the debugger's "failing reproduction test before any fix" step sets up.

This rule backs `task-planner` Phase 4 (double-check) and `feature-delivery` Phase 3.4 (verify).

---

## Control Verification (BLOCKING)

> Scope, and it is load-bearing: this applies when an enforcing control is **authored or materially
> changed**. It is NOT retroactive to every pre-existing hook and guard in an existing project.
> Read as retroactive, it would fail every project's existing controls on the next audit, which is
> not what the finding earned.

Any code whose job is to enforce, block, gate, lock, or refuse (a hook, a merge gate, a permission
guard, a lock check, a coverage floor, a test-suite environment binding) ships with a
**proving-it-fires test**, distinct from its unit test. That test drives the control from OUTSIDE,
through its real trigger, with a known-bad input, and asserts the control actually BLOCKS it.

**Both directions, or it does not count.** A test proving only that a control ALLOWS good input
cannot distinguish "enforcing" from "absent". That distinction is the entire value of the control.

### Why this is a separate rule and not covered by Verify Before Claim

Verify Before Claim demands evidence that a CLAIM is true. This demands evidence that a CONTROL
runs. They are different failures, and the second one is invisible: a control is silent when it
passes, so an uninstalled control and a satisfied control produce identical output forever.

Recorded shapes of the failure, all from controls whose logic was correct:

- A lock hook whose arming marker was never stamped, so it failed open for four milestones while
  every session believed the artifact was hook-protected.
- A merge gate keyed on a command-line substring that the real merge invocation never contained.
- A configuration entry still pointing at a superseded implementation, while the replacement script
  had zero references anywhere and the status file claimed the control was "wired and verified".
- A test suite that migrated one database and ran its specs against another.

Every one was patched at the logic level. The shape recurred anyway, because the wiring is what
nobody tested, and the wiring is what was broken.

### Registry

Projects carry `AI_DOCS/quality/control-registry.md` (template: `templates/control-registry.md`):
one row per enforcing control naming its trigger, the file that wires it, the file that implements
it, and the date its firing was last PROVEN. `hooks/drift-detector.sh` Phase I reconciles it and
surfaces three things a human will not notice unaided: a wiring file that no longer references its
control, a proof older than the control's own last modification, and a control never proven at all.
Advisory, never blocking. A stale proof is a prompt to re-prove, not a reason to stop work.

---

## Test-Spec Traceability

1. **Every test must trace to a requirement** in `AI_DOCS/planning/tech-spec.md`
   - Reference the section or FR-ID in the test description
   - Example: `describe('FR-AUTH-001: User login with email/password')`

2. **Test cases from tech-spec Section 18** are the minimum — add edge cases beyond them

## Test Structure

3. **Use Given-When-Then format** for test names:
   ```
   it('should return 401 when password is incorrect')
   it('should show validation error when email is empty')
   it('should redirect to dashboard after successful login')
   ```

4. **One assertion per test** (preferred) — or closely related assertions
5. **No test interdependence** — each test must pass in isolation
6. **No hardcoded test data** in test files — use factories or fixtures

## Coverage Targets

7. **All project types** (coverage floor = lines AND branches AND functions, minimum 98% on code touched in the current milestone, EVERY tier including POC):
   - POC: 98%+ coverage (lines, branches, functions), happy path plus the critical negative cases
   - MVP: 98%+ coverage (lines, branches, functions), critical API paths, critical user flows
   - Production: 98%+ coverage (lines, branches, functions), 100% API coverage, top 20 user flows, load tests
   - Enterprise: 98%+ coverage (lines, branches, functions), chaos engineering, compliance tests

7a. **Branch and function coverage, not just line coverage** (all project types): line coverage hides untested `else`/error branches and never-called functions. A file can be 100% line-covered with its failure path never executed. The floor is 98% on lines, branches, AND functions, measured on code touched in the current milestone, on EVERY stack. Configure it as a failing threshold, not a report:
   - Jest/Vitest: `coverageThreshold: { global: { statements: 98, branches: 98, functions: 98, lines: 98 } }` in the config (all four metrics enforced natively).
   - pytest: `--cov-branch --cov-fail-under=98` (pytest-cov) enforces lines + branches. pytest-cov has no native function metric, so functions are enforced by a committed post-run helper (`scripts/check_func_coverage.py`, stdlib `ast` + `coverage json`): fraction of functions with at least one executed body line must be >= 98%. See `python-testing`.
   - Go: `go test -coverprofile=cover.out ./...` then `go tool cover -func=cover.out`. Two gates: the `total:` statement coverage must be >= 98%, AND >= 98% of functions must have coverage above 0% (every function is exercised), parsed from the per-function lines. See `go-testing`.
   Gate 4C checks lines, branches, AND functions on all three stacks. A module meeting line targets but missing branch or function targets is NOT covered.

7b. **Canonical run + artifacts location.** Projects run the full test scope through the scaffolded npm scripts, not ad-hoc commands: `npm run test` (unit + integration + coverage, 98% gate), `npm run test:e2e` (Playwright), and `npm run test:full` / `npm run test:ci` (whole scope: JS + Python + Go + E2E, then report validation). `test:ci` produces the same `AI_DOCS/quality/mavs/*.json` verdicts the `mavs-gate.sh` merge gate reads, so local, CI, and merge agree. ALL raw runner output (coverage HTML/lcov/`coverage-summary.json`, pytest `coverage.json`, Go `cover.out`, Playwright HTML + JUnit) is written under `AI_DOCS/quality/test-artifacts/` (gitignored), never `/tmp` or the project root. Templates + orchestrator: `skills/session-management/templates/` (`vitest.config.ts` / `jest.config.ts`, `playwright.config.ts`, `adf-test.mjs`, `validate-test-reports.mjs`).

## Test Categories

8. **Unit tests**: Pure functions, services, utilities — mock external dependencies
9. **Integration tests**: API endpoints — hit real HTTP layer, use test database
10. **Component tests**: UI components — render, interact, verify output
11. **E2E tests**: Critical user flows — real browser, real API

## Test Quality

12. **Test the behavior, not the implementation** — don't test internal state
13. **Don't mock what you don't own** — wrap third-party libraries, mock the wrapper
14. **Database tests use real database** — never mock the DB for integration tests
15. **Cleanup after tests** — reset state, clear test data

## Environment & Service Isolation (BLOCKING)

Tests run hermetically: no real environment, no real services, no real credentials. A test that reaches a live service or reads a developer's actual `.env` is non-deterministic and a defect, even when it passes.

19a. **No real/production env vars in tests.** A unit or component test MUST NOT read the developer's real `.env`/`.env.local`, the shell environment, or any production configuration. Load a dedicated, committed test config (`.env.test` with placeholder values, or inject config explicitly into the unit under test). Any key/secret/URL referenced in a test is a dummy placeholder (`sk_test_xxx`, `https://test.local`), never a working credential. A test that fails when a real env var is unset is wrong: it should have provided the value itself.

19b. **Mock every external service in unit tests.** HTTP/REST calls, the database, payment processors (Stripe/Razorpay), email/SMS (SendGrid/Twilio/SES), cloud storage (S3/GCS), auth providers, queues/brokers, and LLM/AI APIs are mocked, never hit. Use `vi.mock` / `jest.mock` / `nock` / MSW (TS) or `pytest` fixtures + `monkeypatch` / `responses` (Python). The unit test exercises YOUR logic against a test double, not the third party (reinforces Rule 13: mock the wrapper you own, not the SDK internals).

19c. **No network in unit tests.** A unit run with the network cable pulled must pass. If a test needs the network, it is an integration or E2E test and belongs in `tests/integration/` or `tests/e2e/`, not the unit suite.

19d. **Integration tests use TEST doubles, not production endpoints.** The dedicated test database (Rule 14) and `TEST_MODE`/sandbox service doubles (Mailhog, Stripe test mode, a local mock server) are the targets. Never point an integration test at a production or staging URL, a live payment account, or a real inbox. Credentials come from `AI_DOCS/quality/test-fixtures.md` (Rule 23), never the real environment.

19e. **Deterministic doubles.** Mocked responses are fixed fixtures, not live data. Clock, randomness, and UUIDs are stubbed where they affect assertions (no `Date.now()`/`Math.random()` leaking into an assertion). This is what makes a test repeatable.

19f. **No real side effects, ever (the bright line).** A test run MUST NOT cause anything to happen in the real world. Specifically: **no email or SMS is actually sent**, no card is charged or refunded, no push notification is dispatched, no webhook is fired to an external URL, no file is written to a production bucket, no row is written to a production database, no message is published to a real broker, no real LLM/AI call is billed. The test asserts that the code *would* have called the email service (the mock was invoked with the right recipient, subject, and template) — it never lets the real send happen. If running the test suite could reach a user's inbox, a customer's card, or a production system, the suite is wrong, regardless of whether it passes. Wire the test double at the service boundary so the side effect is captured and asserted, not executed.

19g. **Only Playwright E2E runs against the real app. Nothing else does.** The test layers form a strict ladder of how "real" they are:
   - **Unit** — pure logic against test doubles. No network, no DB, no real env (19a-19c). Everything mocked.
   - **Integration / API** — the app runs in-process against the dedicated TEST database (Rule 14), but every EXTERNAL third party (email, SMS, payment, storage, LLM, other services) is still mocked or sandboxed (19b/19d). Real test DB, mocked externals. Not "real".
   - **E2E (Playwright)** — the ONLY layer that drives the real, fully-wired application end to end: real browser → real frontend → real API → real test database. This is where "real" is allowed and expected; mocking the app's own layers here defeats the purpose.
   Even at the Playwright layer the bright line (19f) still holds: the app under test is configured with **sandboxed external providers**, never live ones. Email/OTP go to Mailhog or a deterministic `TEST_MODE` (Rule 24), payments use the processor's test mode (`sk_test_…`), SMS/push use sandbox credentials. "Real app" means the real application stack against test data and sandbox providers, NOT a real inbox, a live card, or production. A Playwright run that could send an actual email or charge an actual card is still a defect.

> So the question "should this test hit something real?" has exactly one yes: a Playwright E2E test hitting the real app on a test database with sandbox providers. Every other test isolates.

> Enforcement: `/build`'s test step and `qa-testing` reject a test file that imports a real config loader, references `process.env.<PROD_VAR>` / `os.environ[...]` for a production variable, or makes an un-mocked outbound call. The fix is a test double, never "set the env var so the test passes".

## Risk-Class Edge Battery (BLOCKING per code shape)

Coverage percentage is necessary, not sufficient: 98% can be met while the classes that actually
escape to users stay untested. When a task touches one of these code shapes, its tests MUST
include that shape's edge classes. A task whose diff matches a shape but ships none of its
classes fails review (code-reviewer acceptance coverage) and the QA gate.

| Code shape (in the diff) | Mandatory edge classes |
|---|---|
| Serializer / string builder (YAML, JSON, CSV, markdown, HTML built from data) | double quotes, backslashes, newlines, unicode, empty string, injection-shaped input in every interpolated field |
| List / collection view | empty (zero results), exactly one, many, error state, pagination boundaries: page with 0 results, single page, last page |
| Form | validation visual state per component TYPE actually used (text input, select, radio, checkbox, date, file), not text inputs only. Submit blocked + error shown per required field |
| Multi-tenant surface | every URL / link / redirect builder tested per tenant (tenant subdomain vs wildcard host), cross-tenant access denied |
| RBAC-touching endpoint or UI | allow-cells AND deny-cells per role per action. Over-blocking (an allowed role denied) is a defect equal to leaking, test both directions |
| Upload / format handling | every advertised input format has one end-to-end test through EVERY service hop (FE accept, API validate, worker process). Every rejected format has an explicit user-visible rejection test |
| Rate limiting | the limiter covers ONLY the endpoints the plan names (a test proves a non-listed endpoint is NOT limited), and successful requests do not count toward a brute-force lockout |
| Retry / error-recovery UI | the retry action clears the stale error and re-fetches (drive it: fail, retry, succeed) |

Review Focus: a task may also carry a `Review Focus` list in its plan (`task-planner`), up to 5 inputs or states the spec does not cover. The table above gives the per-shape classes that always apply, and Review Focus adds the task-specific ones. Each Review Focus item needs a pinning test in the task that owns it.

Wiring: `test-writer` carries this table in its checklist, `qa-testing` / `python-testing` assert
the classes for the shapes in scope, `e2e-testing` owns the upload/format conformance check
(FE accept-list == API accept-list == worker handled-list), and `authz-matrix` supplies the
allow/deny cells that the /build exercise gate runs per task.

## What NOT to Test

16. **Don't test framework code** — React rendering, Express routing
17. **Don't test getters/setters** — trivial accessors
18. **Don't test constants** — static values
19. **Don't test third-party libraries** — trust their own tests

## Before Committing

20. **All tests must pass** — no skipped tests without a documented reason
21. **No console.log in test files** — use proper assertions
22. **No sleep/setTimeout in tests** — use proper async patterns (waitFor, polling)

## End-to-End Auth, Fixtures & Isolation (E2E)

> Full patterns + code live in `e2e-testing/SKILL.md`. These are the enforceable rules.

23. **Credentials come from `AI_DOCS/quality/test-fixtures.md`, never hardcoded.** Seed users (one per role) are written there by `mock-data` / `data-migration`. A test that hardcodes `test@example.com` / `password123` fails review.
24. **MFA / OTP / email verification use a mock service or TEST_MODE** — Mailhog (or equivalent) for the real mail path, or a deterministic `TEST_MODE` OTP. Never a real inbox or phone in an automated run.
25. **Reuse auth state across the suite** — log in once, persist storage state (`tests/e2e/.auth/<role>.json`, gitignored), reuse it. Do not re-authenticate per test.
26. **Isolate test data** — reset between tests via the fixtures `reset-endpoint` (or re-seed). A suite of 3+ E2E tests with no isolation is flaky by construction and fails the gate (reinforces Rule 5).
27. **The milestone E2E suite is mandatory at milestone close (non-POC).** `milestone-validation` Phase 1b runs `AI_DOCS/quality/e2e-suite.md` on every declared surface; `hooks/mavs-gate.sh` blocks the milestone → develop merge unless `AI_DOCS/quality/mavs/e2e.json` reports PASS for the current commit. POC is advisory.
28. **Every declared platform runs.** When `platform_targets` includes a native target, the same critical flows run natively (Detox / Flutter integration) in addition to web — see `rules/mobile-rules.md`.
29. **RBAC test coverage includes the dynamic and chained flows, not only static cells.** For any project with roles, `authz` coverage (`mavs/authz.json`) is not complete at the static role x action x field matrix alone: it must also exercise dynamic permission-change propagation (two-actor grant/revoke), cross-user IDOR chains, and CSRF on mutating requests, with three-state results (PASS / LEAK / INCONCLUSIVE). A `LEAK` blocks. See `security-rules.md` Rule 35a and the `authz-matrix` skill (AuthMatrix methodology).
30. **The responsive sweep is mandatory for web frontends at milestone close.** Every delivered screen runs the mechanical all-device battery at 375/768/1024/1440/1920 (page overflow, element outside viewport, covered/zero-size controls, sub-44px touch targets, table containment, image overflow) via the `e2e-testing` templates (`responsive-sweep.spec.ts` + `geometry-dump.ts` + `responsive-report.mjs`), emitting `mavs/responsive.json`. `responsive` is in `required.txt` for web frontends: a FAIL or missing report blocks the promotion merge. The same run produces the `mavs/geometry.<width>.json` dumps the craft validators and `principal-designer` read.
31. **The mobile interaction lane operates controls, not just renders them.** At 375 with touch emulation, the sweep opens the sidebar/nav drawer, top-bar menus, alerts/toasts where reachable, table sort, filters, pagination, and row-action menus, and every opened surface re-passes the audit. A control that only works with a mouse, or opens a clipped panel, is a functional FAIL.
32. **Cadence and judgment split.** Per UI task, the `/build` Exercise gate drives the changed screen interactively at 375 AND 1440 (the two-width phrasing applies to that interactive drive cadence only) and, in the same session, captures 375/768/1440 screenshots for the visual-QA judgment step against the design-standards checklist, appending the `mavs/visual.json` entry. The full 5-width sweep + mobile lane runs once at milestone close. AI visual judgment (`ui-review`) writes FAIL on any of three confirmed triggers: a functional defect, a BLOCKING design-standards-checklist row violation (DSC id cited), or a deviation from an approved journey prototype (`AI_DOCS/design/flows/<flow-id>/chosen.md`). Aesthetic findings stay advisory and route, with their suggested corrections, to `AI_DOCS/quality/defect-log.md`.

---

## Verification Lives as Committed Tests (BLOCKING)

33. **Materialize every verification as a committed test case, because a committed test keeps validating on every later run while a one-off script proves only a single moment and leaves no regression protection behind.** When verifying API behavior, UIUX standards, or a user flow, the artifact of record is a test in the project's test tree, wired into the canonical scripts (`test`, `test:e2e`, `test:full`), emitting its MAVS report through the normal runner:
    - API behavior: an integration or conformance test asserting status and envelope per contract endpoint (the `api-conformance` path), added next to the endpoint's existing suite.
    - User flows: a Playwright spec derived from the committed e2e templates, reading identities from `test-fixtures.md`.
    - UIUX standards: the responsive sweep plus the visual QA capture, producing `mavs/responsive.json` and `mavs/visual.json` through the committed templates.
34. **Let scratch stay scratch.** Exploratory probing during debugging (a curl to reproduce, a quick DOM read) is welcome in `AI_DOCS/.temp/` while diagnosing, and the verification CLAIM is made only once the finding has graduated into a committed test that would catch the regression. A pass produced by an uncommitted script is a point-in-time observation, not verification, and is reported as such.
35. **Take the verdict from the runner's structured output, because a grep for "passed" on a log tail is pattern-matching, not a verdict.** `0 passed`, a previous run's buffer, and a partially written log all satisfy that grep while the suite is failing. Drive runs through the canonical scripts with the JSON reporter (or `--reporter=json` on a scoped run) and claim the result from the parsed counts plus the exit code. Iterating on one spec stays fast by filtering inside the runner (a spec path or `--grep`) with the reporter kept on, and the task's final claim re-runs through the canonical script so the MAVS report reflects it. Auth state and fixtures reset through the committed helpers (`test-fixtures.md`, the reset endpoint), never through inline delete-and-remint chains, so every run starts from the same declared state.
36. **Let the test runner own the service lifecycle, because hand-managed servers are where degraded-host guesswork and restart rituals come from.** Playwright's `webServer` config (in the scaffolded template) starts the dev server, polls the URL until genuinely ready, reuses a healthy local instance, and tears down afterward, so a test run never starts, restarts, or waits on a server by hand. Readiness is a port or health-endpoint answer with a bounded timeout. "The host seems to be degrading" is a signal to read the health endpoint and the runner's own timing report, and the conclusion goes in the finding, never into a blind restart.
37. **Run long commands through the harness's background mode and let completion notify you, because a foreground `until grep; do sleep; done` loop spends minutes of turn time polling a moving file and then reads it with the exact pattern-match Rule 35 forbids.** A long test run launches in background mode and the session resumes when it exits, then the verdict comes from the structured artifact it wrote. Waiting on an external condition uses the Monitor mechanism rather than a sleep loop. While it runs, report progress and an ETA computed from the log with `scripts/progress-eta.sh` (see the `/do` skill section "Progress and ETA for long-running actions"), so a long run is never a silent wait for the operator.
38. **When a service log must exist, give it a declared home and a diagnostic role only.** Service and script output that needs capturing goes to `AI_DOCS/.temp/logs/<service>-<YYYYMMDD-HHMMSS>.log` (the same timestamped pattern infrastructure-rules Rule 13 mandates for infra scripts), inside the project and gitignored, never an OS temp path that hides the file from the operator. Logs serve diagnosis after a structured verdict says something failed. The generate-probe-then-delete cycle (write a throwaway script or log, read it once, `rm` it) leaves no regression protection and no audit trail, so the effort it cost evaporates with it: keep the durable form (a committed test, a MAVS artifact) and let only genuine scratch live in `.temp`.

---

## Test Evidence Matrix (ADF v3.0)

This matrix defines what test evidence is required before a story can be marked Done. Gate level determines whether missing evidence BLOCKS the gate or is ADVISORY.

| Story Type | Required Evidence | Where to Store | Gate Level |
|-----------|-------------------|----------------|------------|
| **Logic / Algorithm** (formulas, state machines, calculations) | Automated unit test — must pass | `tests/unit/[system]/` | **BLOCKING** |
| **Integration** (multi-service, database, external API) | Integration test OR E2E test | `tests/integration/` or `tests/e2e/` | **BLOCKING** |
| **API** (new or changed endpoints) | Contract sync check via `api-validator` agent | `AI_DOCS/architecture/api-contract.md` in sync | **BLOCKING** |
| **Visual / UX** (new screens, animations, design changes) | Per-task 375/768/1440 screenshots + the visual-QA verdict entry in `mavs/visual.json` | `AI_DOCS/quality/visual/<task-id>/` + `AI_DOCS/quality/mavs/visual.json` | **BLOCKING** for web frontends on a confirmed BLOCKING checklist row, **ADVISORY** otherwise |
| **Config / Data** (environment config, feature flags, seed data) | Smoke check pass documented | `AI_DOCS/qa/smoke-[date].md` | **ADVISORY** |
| **Performance** (latency targets, Core Web Vitals) | Benchmark report showing target met | `AI_DOCS/qa/performance-[date].md` | **ADVISORY** |
| **Security** (auth changes, data handling, input validation) | `security-auditor` agent scan PASS | `AI_DOCS/security-audit-[date].md` | **BLOCKING** |

### BLOCKING vs ADVISORY

- **BLOCKING**: Gate cannot be APPROVED if this evidence is missing. `qa-lead` will REJECT the `QA-TEST-COVERAGE` gate.
- **ADVISORY**: Missing evidence triggers a CONCERNS verdict (not REJECT). Document the gap and timeline to close it.

### Quick Reference for QA-Lead Gate Check

When running `QA-TEST-COVERAGE` gate, check each completed story:
1. Does it have the required evidence type based on story type?
2. Is BLOCKING evidence present? If not → REJECT
3. Is ADVISORY evidence missing? If so → CONCERNS with list of gaps
4. All BLOCKING evidence present and ADVISORY gaps documented → APPROVE

<!-- Version: 1.7.0 — 2026-07-07 — added Rule 7b: canonical scaffolded npm test scripts (test / test:e2e / test:full / test:ci / test:validate), full-project-scope run, and the single gitignored artifacts location AI_DOCS/quality/test-artifacts/ (validated verdicts stay in AI_DOCS/quality/mavs/). Templates in session-management/templates. -->
<!-- Version: 1.6.0 — 2026-07-07 — extended the 98% floor to ALL project types including POC (Rule 7 no longer exempts POC), and made functions enforceable on every stack: Jest native four-metric 98; pytest lines+branches via --cov-fail-under=98 PLUS a committed function-coverage helper (scripts/check_func_coverage.py, ast + coverage json) at >=98%; Go both the -func total >=98 AND >=98% of functions with coverage >0. Gate 4C checks lines, branches, and functions on all three stacks. -->
<!-- Version: 1.5.0 — 2026-07-07 — raised the coverage floor to a flat minimum 98% on lines, branches, AND functions for MVP/Production/Enterprise (POC stayed manual). Superseded by 1.6.0 (POC now included, functions enforced on Python + Go). -->
<!-- Version: 1.1.0 — 2026-06-12 — added Rule 7a: branch-coverage targets per project type (MVP 60 / Production 75 / Enterprise 85), enforced as failing thresholds (jest coverageThreshold.branches, pytest --cov-branch --cov-fail-under); Gate 4C now checks lines AND branches -->
<!-- Version: 1.4.0 — 2026-06-29 — added Rule 29: RBAC coverage includes dynamic permission-change + IDOR + CSRF chains with three-state PASS/LEAK/INCONCLUSIVE results (AuthMatrix), not just static cells -->

<!-- Version: 1.3.0 — 2026-06-25 — added Environment & Service Isolation (19a-19g): no real/production env vars in tests, mock every external service, no network in unit tests, integration uses TEST doubles not production, deterministic doubles, the bright line (NO real side effects ever — no email/SMS sent, no card charged, no production write), and 19g the layer ladder (unit/integration isolate; only Playwright E2E runs against the real app, and even then with sandboxed providers). Enforced by /build test-isolation gate with Playwright-layer exemption. -->
<!-- Version: 1.2.0 — 2026-06-23 — added E2E rules 23-28: seed-fixtures credentials, mock MFA/OTP/email, auth-state reuse, test-data isolation, mandatory milestone E2E (milestone-validation Phase 1b + milestone-e2e-gate hook), per-platform native E2E -->
<!-- Version: 1.7.0 — 2026-07-09 — added the Risk-Class Edge Battery (BLOCKING per code shape): serializer escapes, list empty/pagination boundaries, per-component-type form validation, multi-tenant link builders, RBAC allow AND deny cells (over-blocking = defect), upload/format matrix through every service hop, rate-limiter scope + success-exclusion, retry-clears-error. From field findings (PLAN-execution-quality Track F). -->
<!-- Version: 1.11.0 | 2026-08-21 | Rule 32 restated to the three ui-review FAIL triggers (confirmed functional defect, BLOCKING design-standards-checklist row with DSC id, approved-journey deviation) and now names the per-task 375/768/1440 screenshot capture inside the /build Exercise gate, with the 375+1440 phrasing kept for the interactive drive cadence only. Test Evidence Matrix Visual/UX row updated: evidence is the per-task screenshots at AI_DOCS/quality/visual/<task-id>/ plus the mavs/visual.json entry, BLOCKING for web frontends on confirmed BLOCKING checklist rows and ADVISORY otherwise -->
<!-- Version: 1.10.0 | 2026-08-20 | added Verification Lives as Committed Tests (rules 33-38): API/UIUX/flow verification materializes as committed tests wired into the canonical scripts (one-off scripts are point-in-time observations, not verification), scratch graduates from AI_DOCS/.temp into a committed test before any claim, verdicts come from the runner's parsed JSON output and exit code never a log-tail grep, fixtures reset through committed helpers, Playwright webServer owns the dev-server lifecycle (no hand restarts or readiness guesswork), long runs use harness background mode + Monitor instead of until-grep-sleep polling, service logs live in AI_DOCS/.temp/logs/<service>-<ts>.log for diagnosis only, generate-then-delete probes are named as the anti-pattern -->
<!-- Version: 1.9.0 | 2026-08-18 | Control Verification (BLOCKING, non-retroactive): every authored/changed enforcing control ships a proving-it-fires test + the control-registry reference -->
<!-- Version: 1.8.0 | 2026-08-06 | added responsive E2E rules 30-32: the mechanical responsive sweep at 5 widths is mandatory for web frontends at milestone close (mavs/responsive.json in required.txt, produces the geometry dumps), the 375 touch interaction lane operates drawer/menus/sort/filter/pagination/row-actions with every opened surface re-audited, cadence 375+1440 per UI task vs full sweep at close, ui-review FAILs only on confirmed functional findings with corrections routed to defect-log.md -->
<!-- Version: 1.9.1 | 2026-10-05 | Rule 27 named the retired milestone-e2e-gate.sh and its self-written e2e-result.md verdict. The merge gate is hooks/mavs-gate.sh, which parses AI_DOCS/quality/mavs/e2e.json -->
<!-- Version: 1.12.0 | 2026-10-05 | Rule 37 adds operator-visible progress and ETA for long runs via scripts/progress-eta.sh, pointing at the /do progress section -->
<!-- Version: 1.13.0 | 2026-10-22 | Agent success claims are verified against git diff --stat and the changed files, regression tests need a red-green proof (revert or stub the fix and the test fails, restore and it passes), Review Focus items feed the edge battery. Ideas from obra/superpowers. -->
