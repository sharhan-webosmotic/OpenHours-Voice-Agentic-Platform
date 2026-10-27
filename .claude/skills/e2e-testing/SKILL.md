---
name: e2e-testing
description: "Full-milestone end-to-end testing with REAL authentication: seed-data logins, mock MFA/OTP/email (Mailhog + TEST_MODE), auth-state reuse, and test-data isolation, across web (Playwright) and native mobile (Detox / Flutter integration). Reads test users from AI_DOCS/quality/test-fixtures.md and the milestone's critical flows from AI_DOCS/quality/e2e-suite.md. Use at milestone close (called by milestone-validation) or to author/run authenticated E2E. Triggers on: 'E2E with login', 'test the milestone end to end', 'MFA test', 'OTP test', 'seed login test', 'mobile E2E', 'Detox', 'Flutter integration test'."
mcp_integrations: [playwright]
next_skill: null
required_gate: "Gate 4 (QA Sign-off)"
skill_id: SK-150
context_budget:
  load_kb: 30
  scope: milestone
version: 1.9.1
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [qa-testing, mock-data]
  optional: [mock-api-server, data-migration]
produces:
  - path: AI_DOCS/quality/e2e-suite.md
    consumers: [milestone-validation, do]
  - path: tests/e2e/
    consumers: [milestone-validation, ship]
consumes:
  - path: AI_DOCS/quality/test-fixtures.md
    required_sections: [test-users, mock-services, reset-endpoint]
  - path: AI_DOCS/architecture/api-contract.md
metadata:
  author: WebOsmotic Private Limited
  category: reliability
  patterns: [sequential, domain-specific]
  role: "milestone E2E with real auth"
---

# /e2e-testing: Authenticated, Full-Milestone E2E

## MAVS report (machine-checked contract, BLOCKING)

After running the suite, emit a normalized report to `AI_DOCS/quality/mavs/e2e.json` per `docs/mavs-report-schema.md`, generated FROM the real runner output (never hand-written). Runner: `npm run test:e2e` (`npx playwright test`), which uses the scaffolded `playwright.config.ts` to write the JUnit report to `AI_DOCS/quality/test-artifacts/e2e/junit.xml` and the HTML report to `AI_DOCS/quality/test-artifacts/e2e/html` (both gitignored). Parse counts + failures from the JUnit XML into the report (the `npm run test:full` orchestrator does this automatically). Detox/Flutter equivalents for native. Stamp `source_commit` with `git rev-parse HEAD` and `generated_at` with the real run time. `status` is `PASS` only when the runner exited clean and `failed` is 0. Any failure is `FAIL`. Runner absent is `MISSING_TOOL`, never a silent `PASS`. `hooks/mavs-gate.sh` PARSES this report at the promotion merge: a `FAIL`, a STALE report (`source_commit != HEAD`), or a missing required report blocks the merge. The verdict is parsed from the runner, not asserted.

> **Why this exists:** the raw Playwright primitives (folded in from the former `webapp-testing` skill) log in with hardcoded `test@example.com` / `password123` and have no path for MFA, OTP, or email verification. Real apps gate everything behind auth, so an E2E suite that cannot log in as a seeded user, cannot read an OTP, and re-authenticates on every test is not testing the product. This skill closes that: seed-data logins, mock auth factors, reused sessions, isolated data, web and native.

This skill provides the patterns, authors the suite, AND carries the low-level Playwright primitives (selectors, screenshots, visual regression, waits) folded in from the former `webapp-testing` skill. `milestone-validation` Phase 1b runs the suite as a hard gate at milestone close.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials):

- `playwright` (free): drive seeded-login flows, capture screenshots, and read console/network during end-to-end runs instead of guessing.

Target the project's dev URL/port and dev database only. Never point a debug/verify MCP at staging or production.

---

## Low-level browser primitives (screenshots, visual regression, selectors)

Folded in from the former `webapp-testing` skill (merged here 2026-06-30). These are the raw Playwright building blocks the authenticated flows above are built on. Prefer the `playwright` MCP for live verification (navigate, screenshot, DOM snapshot, console/network reads, no script to write); fall back to a committed Playwright script when you need a repeatable test or the MCP is unavailable.

- **Screenshot capture:** `page.screenshot(path="screen.png", full_page=True)` after `page.wait_for_load_state("networkidle")`. Always wait for `networkidle` before screenshotting or inspecting the DOM on a dynamic app.
- **Visual regression:** capture a `baseline/<screen>.png`, capture `current/<screen>.png` after a change, diff with pixelmatch (or equivalent), flag differences over a threshold.
- **Selector strategy (priority order):** `text=` (readable) > `role=` (accessible) > `[data-testid=]` (stable) > CSS class/ID > XPath (last resort). Favor a stable selector from that list over a brittle structural one like `div > div:nth-child(3) > button`.
- **Reconnaissance-then-action:** screenshot and inspect the rendered DOM first, discover selectors from that state, then execute interactions. Never inspect before `networkidle`.
- **Headed real Chrome by default:** launch `channel="chrome", headless=False, slow_mo=150` so the operator watches; auto-fall-back to headless in CI / no-display hosts or when `ADF_HEADLESS=on`. Headed Chrome is memory-heavy, so it counts against the host `HEAVY_CAP` (see `docs/coordination-rules.md`).

### Milestone UI MAVS validators (machine-checked, BLOCKING)

When run as a milestone validator (dispatched by `milestone-validation`), emit these normalized reports per `docs/mavs-report-schema.md`, generated FROM the real run, with `source_commit = git rev-parse HEAD`. `hooks/mavs-gate.sh` parses them at the promotion merge: a `FAIL`, a STALE report, or a missing required report blocks the merge.

- **`mavs/webapp.json`** — Playwright UI/visual run (`--reporter=junit`). `PASS` only on a clean run with `failed` 0; `FAIL` on any failure; `MISSING_TOOL` when Playwright is absent (never a silent PASS).
- **Geometry dump** — walk the rendered DOM at widths 375/768/1024/1440/1920 and write `mavs/geometry.<width>.json` (rect + coarse role + computed styles per meaningful node). A DATA artifact (no `status`), the shared ground truth for the craft/fidelity numbers below. Produced by the responsive sweep (templates in this skill folder, see "Responsive sweep + mobile interaction lane" below), so the dump always exists whenever the sweep has run: `principal-designer` reads it for `[Certain]` geometry findings.
- **`mavs/responsive.json` (mechanical responsive battery)** — per screen per width, the functional layout checks: page horizontal overflow, element exceeding the viewport, covered or zero-size interactive elements, sub-44px touch targets at mobile widths, tables that scroll the page instead of their own container, overflowing/distorted images, clipped text. `FAIL` on any crit/high (functional) finding. Produced by `responsive-report.mjs` from the sweep artifacts, never hand-written.
- **`mavs/ui.json` (V2 UI-craft)** — six measured sub-checks computed from the geometry dump: alignment (orphan-edge ratio, numeric cells right-aligned), rhythm (spacing-step consistency), hierarchy (type levels + dominance), density (card height vs viewport, line measure, wide-canvas cap), uniformity (per-role padding/radius/elevation/height combos), state quality (empty has an action, loading is a skeleton, error has retry). Each is a number against a documented threshold.
- **`mavs/fidelity.json` (V11 design-to-code)** — compare each rendered screen's structure against its `AI_DOCS/design/screens/**` reference: same regions present, locked app-shell components used for chrome, composition matches design intent. `FAIL` on a structural mismatch.
- **`mavs/perf.json` (V10 performance budget)** — bundle size per route (WARN 150kb / FAIL 250kb gzipped), Core Web Vitals (FAIL LCP > 4s, CLS > 0.25, INP > 500ms), API p95 vs the tech-spec S12 budget (`MISSING_TOOL` when no load tool). Each metric is a number in `findings`.
- **`mavs/visual.json` (per-task visual QA + milestone consolidation)**: the visual-QA lane (PLAN-testing-matrix Part 2.2/2.3). Per UI task, `/build`'s Exercise gate appends one entry: 375/768/1440 screenshots (`AI_DOCS/quality/visual/<task-id>/`) judged against `AI_DOCS/design/design-standards-checklist.md` by `component-inspector` (mechanical rows) + `principal-designer` (visual rows), findings tagged with `DSC-NN` ids. At milestone close (see "Responsive sweep" below), this skill's full 5-width sweep additionally writes every screenshot into `AI_DOCS/quality/visual/milestone-close/`, and `milestone-validation` consolidates the per-task entries plus a full-sweep judgment into the finalized report. `status` is `PASS` (no BLOCKING violation), `FAIL` (a confirmed BLOCKING checklist row), `MISSING_TOOL` (neither Playwright nor Claude-in-Chrome available, never a silent PASS), or `SKIP` (no runtime surface, or no checklist yet).

---

## The test-fixtures contract (single source of test identity)

Every E2E suite reads `AI_DOCS/quality/test-fixtures.md`, written by `mock-data` / `data-migration` when they seed (see those skills). It is the bridge between seed data and the tests: the same users that are seeded are the users the tests log in as.

```markdown
# Test Fixtures
test-users:
  - email: user@test.local
    password: TestPass123!
    role: user
    seeded: [profile-complete, 5-orders]
  - email: admin@test.local
    password: AdminPass123!
    role: admin
mock-services:
  email: mailhog        # SMTP :1025, HTTP API :8025
  sms: null
test-mode:
  enabled: true         # backend honors TEST_MODE
  fixed-otp: "000000"   # when TEST_MODE, OTP is deterministic
reset-endpoint: POST /api/test/reset   # header: X-Test-Token
```

If `test-fixtures.md` is missing when E2E is requested, STOP and have `mock-data` seed first. Tests never hardcode credentials.

---

> **The Patterns 1-4 snippets are pattern pseudocode.** The Python `sync_playwright` code below illustrates each flow, it is not the committed suite. The committed suite is authored in TypeScript under the canonical Playwright runner: specs in `tests/e2e/`, run via `npx playwright test` (`npm run test:e2e`), JUnit report written to the artifacts dir (`AI_DOCS/quality/test-artifacts/e2e/`).

## Pattern 1: Seed-data login

Load the credentials from fixtures, never inline them.

```python
import json, re, requests
from playwright.sync_api import sync_playwright

fx = load_fixtures("AI_DOCS/quality/test-fixtures.md")   # parse the YAML block
admin = next(u for u in fx["test-users"] if u["role"] == "admin")

import os
# Headed real Chrome by default so the operator watches the auth flow run live.
# Auto-headless in CI / no-display hosts or when ADF_HEADLESS=on.
_HEADLESS = bool(os.environ.get("CI") or os.environ.get("ADF_HEADLESS"))
with sync_playwright() as p:
    page = p.chromium.launch(channel="chrome", headless=_HEADLESS,
                             slow_mo=0 if _HEADLESS else 150).new_page()
    page.goto("http://localhost:3000/login")
    page.wait_for_load_state("networkidle")
    page.fill("input[name='email']", admin["email"])
    page.fill("input[name='password']", admin["password"])
    page.click("button[type='submit']")
    page.wait_for_selector("text=Dashboard")
```

## Pattern 2: Mock MFA / OTP / email verification

Two supported strategies. Prefer TEST_MODE for speed. Use the mock mailbox when you must exercise the real email path.

**A. TEST_MODE fixed OTP (fastest).** The backend, when `TEST_MODE=true`, accepts a deterministic OTP (`fixed-otp` from fixtures). Tests type it directly. No mail server needed.

**B. Mock mailbox (real email path).** Run Mailhog (SMTP :1025, HTTP API :8025). Point the app's mailer at it in the test env, then extract the code from the captured message:

```python
def latest_otp(mailhog="http://localhost:8025"):
    msgs = requests.get(f"{mailhog}/api/v2/messages").json()["items"]
    body = msgs[0]["Content"]["Body"]
    return re.search(r"\b(\d{6})\b", body).group(1)

page.click("button:has-text('Send code')")
page.fill("input[name='otp']", latest_otp())
page.click("button:has-text('Verify')")
page.wait_for_selector("text=Welcome")
```

Email-verification links use the same capture: read the message, extract the verify URL, `page.goto()` it. SMS MFA uses a mock SMS sink the same way, or TEST_MODE.

## Pattern 3: Auth-state reuse (do not re-login every test)

Log in once, persist the storage state, reuse it across the suite.

```python
# once, in global setup
ctx = browser.new_context()
# ... perform login ...
ctx.storage_state(path="tests/e2e/.auth/admin.json")

# every test
ctx = browser.new_context(storage_state="tests/e2e/.auth/admin.json")
```

Keep one state file per role. `.auth/` is gitignored.

## Pattern 4: Test-data isolation

Tests must not bleed into each other. Reset between tests via the fixtures `reset-endpoint`:

```python
def reset():
    requests.post("http://localhost:3000/api/test/reset",
                  headers={"X-Test-Token": os.environ["TEST_RESET_TOKEN"]})
```

Call `reset()` in setup/teardown (or re-seed a known fixture set). A suite of 3+ tests without isolation is flaky by construction and fails the gate.

## Required auth-flow suite (any project with auth) — emits `mavs/auth.json`

`security-rules.md` names the auth flows but nothing made them a REQUIRED suite, and the highest-severity bug (a revoked role still working, Rule 34) had no executable check. For any project with authentication, these flows are MANDATORY at milestone close, the same status as login and MFA. They run with the patterns above (seeded users, TEST_MODE/mock factors, isolation) and their result is written to `AI_DOCS/quality/mavs/auth.json` (MAVS schema, `source_commit` = HEAD), parsed by `mavs-gate.sh`.

| # | Flow | Assert |
|---|------|--------|
| 1 | Password reset | the reset token is single-use (a second use is rejected) AND expires (an expired token is rejected). A reset invalidates existing sessions. |
| 2 | Session expiry | an idle session past the idle window is rejected; an absolute-lifetime expiry forces re-auth. A request with an expired access token returns 401. |
| 3 | Refresh-token rotation + reuse detection | a refresh issues a NEW refresh and invalidates the old one; REUSING a rotated (old) refresh token revokes the whole token family (all sessions for that user), per security-rules 38-40. |
| 4 | MFA enrollment + challenge | enrolling a factor, then a fresh login is challenged for it; a wrong code is rejected; backup-code path works once. |
| 5 | Stale-role (Rule 34, the executable proof of /build Check A3) | log in as a user, change that user's role in the DB (via the seed/reset path), then a protected action that the OLD role allowed is DENIED on the NEXT request (403), proving the guard re-reads the role rather than trusting the old token. |

`status` in `auth.json` is `PASS` only when all applicable flows pass, `FAIL` on any, `SKIP` if the project has no auth, `MISSING_TOOL` if the runner/app is unreachable. Flow 5 is the test that makes security-rules Rule 34 enforceable instead of prose.

## Responsive sweep + mobile interaction lane (web frontends, BLOCKING at milestone close)

The executable form of `rules/frontend-rules.md` "Responsive Design" points 4-6. Three committed templates in this skill's `templates/` folder are copied into `tests/e2e/` and customized (the SCREENS list + control selectors), then wired into `npm run test:e2e` / `test:ci`:

| Template | Role |
|---|---|
| `geometry-dump.ts` | In-page audit function (`page.evaluate`): geometry dump + the RSP-01..RSP-09 mechanical checks with severities |
| `responsive-sweep.spec.ts` | The sweep spec: every delivered screen at 375/768/1024/1440/1920, plus the mobile interaction lane at 375 with touch emulation. Every screenshot it captures is also written into `AI_DOCS/quality/visual/milestone-close/` (the visual-QA lane's full-sweep bucket), alongside its existing `test-artifacts/responsive/` copy |
| `responsive-report.mjs` | Merges artifacts into `mavs/geometry.<width>.json` (data) + `mavs/responsive.json` (verdict) |

What the sweep asserts, per screen per width:

1. **Nothing hidden, nothing clipped**: no page-level horizontal overflow, no element outside the viewport without a scroll container, no interactive element covered by a fixed/sticky bar or rendered at zero size.
2. **Operable at touch sizes**: interactive targets at least 44x44 CSS px at widths under 768.
3. **Containment**: tables scroll inside their own container (a table that makes the PAGE scroll is a crit), images stay fluid and undistorted.
4. **Controls exercised open, not just closed**: the mobile lane (375, touch device descriptor) operates the sidebar/nav drawer, top-bar menus, alerts/toasts where reachable, table sort, filters, pagination, and row-action menus, and every opened surface re-passes the same audit. A control that only works with a mouse, or opens a clipped panel, fails.

Severity contract: crit/high findings are FUNCTIONAL (a user cannot see or operate something) and set `status: FAIL`. med/low findings (aspect distortion, ellipsis-less truncation, content under a fixed bar) are recorded for `ui-review` and `principal-designer` but do not fail the mechanical gate.

Cadence (keeps per-task cost low):

- **Per UI task** (`/build` Exercise gate): the changed screen/flow at 375 AND 1440 only.
- **Milestone close** (dispatched by `milestone-validation`): the full 5-width sweep + the mobile interaction lane over every delivered screen. `responsive` joins `required.txt` for web frontends, so a missing or FAIL report blocks the promotion merge via `mavs-gate.sh`.

**Milestone-close consolidation of `mavs/visual.json`.** Once the full sweep has run and written its screenshots to `AI_DOCS/quality/visual/milestone-close/`, `milestone-validation` consolidates the visual-QA lane: it reads every per-task `AI_DOCS/quality/visual/<task-id>/` bucket the `/build` Exercise gate wrote during the milestone (each already appended to `mavs/visual.json` as it happened), then adds a final full-sweep judgment (`component-inspector` + `principal-designer` against `AI_DOCS/design/design-standards-checklist.md`, covering every delivered screen at all 5 widths, not just the 375/1440 pair each task exercised). The finalized `mavs/visual.json` joins `required.txt` for web frontends, so a missing report or a present `FAIL` (a confirmed BLOCKING checklist violation, uncorrected) blocks the promotion merge via `mavs-gate.sh`, the same as `responsive`.

## Native mobile lanes (when `platform_targets` includes iOS/Android)

The web patterns map onto the native E2E frameworks. The fixtures contract is identical (same seeded users, same TEST_MODE OTP, same reset endpoint).

| Platform | Framework | Notes |
|---|---|---|
| React Native | Detox | `device.launchApp()`, `by.id()` matchers; seed via the reset endpoint or `device.sendUserNotification`; OTP via TEST_MODE or the mock mailbox API |
| Flutter | `integration_test` package | `IntegrationTestWidgetsFlutterBinding`; drive with `WidgetTester`; same fixtures/reset |
| Either, in CI | device farm (BrowserStack / Sauce Labs) or local emulator | declare in `infra-plan.md`; `milestone-validation` notes the lane |

Native MFA uses the same TEST_MODE fixed OTP or mock mailbox: do not require a real phone/email in automated runs.

---

## The milestone E2E suite (`AI_DOCS/quality/e2e-suite.md`)

For each milestone, list the critical user flows that MUST pass (the golden journeys for that milestone's features, per role). This is what `milestone-validation` Phase 1b runs.

```markdown
# E2E Suite: M03 Orders
| # | Flow | Role | Surfaces | Status |
|---|------|------|----------|--------|
| 1 | Login (MFA) → create order → see it in list | user | web, ios | |
| 2 | Admin cancels an order, audit log written | admin | web | |
| 3 | Empty state on zero orders | user | web, ios | |
```

Author the actual specs under `tests/e2e/` (web) and the native test dirs. Each flow uses the patterns above: seeded login, mock factors, isolation.

## Format-conformance check (upload/format features — Rule 7 symmetry, executable)

When a milestone ships any upload or format-handling feature, run the cross-surface conformance check (`rules/vertical-slice-rules.md` Rule 7, `testing-rules.md` Risk-Class Edge Battery):

1. **Extract the three accept-lists**: the FE accept list (file-input `accept=` / dropzone config / validation schema), the API accept list (upload validator / content-type allowlist), and the worker/processor handled list (the parser dispatch map or handler switch). Prefer reading them from ONE shared constant; when they are separate literals, diff them.
2. **Assert equality or explicit rejection**: every format the FE advertises is either handled by the API AND the worker, or produces an explicit, user-visible rejection at the first hop that does not support it (never a silent drop or a dead job).
3. **Drive one file per advertised format** through the real flow (seeded login, real upload, wait for the processed result or the rejection message). A format that uploads but never produces output = FAIL (the accepted-but-never-processed class).
4. Record the result as a `format-conformance` section in `mavs/e2e.json` findings. Any mismatch between the three lists, or a dead format, is a FAIL that blocks the milestone.

## Verdict (what milestone-validation consumes)

Run the suite in headed real Chrome by default (the operator watches the run); it auto-falls-back to headless in CI / no-display hosts or when `ADF_HEADLESS=on`. Headed Chrome is memory-heavy, so as a parallel agent this counts against the host `HEAVY_CAP` (see `docs/coordination-rules.md`): do not run more concurrent headed E2E browsers than `HEAVY_CAP`. Write the machine-readable result to `AI_DOCS/quality/e2e-result.md` and `AI_DOCS/quality/mavs/e2e.json` (the `mavs-gate.sh` milestone gate reads the latter):

```markdown
Milestone: M0N
Verdict: PASS
Date: YYYY-MM-DD
Surfaces: web, ios
```

- **PASS**: every flow green, on every declared surface, with isolation verified.
- **FAIL**: any flow red, fixtures missing, or no isolation. Name the failing flow + surface, and write `Verdict: FAIL`.

For `planning_depth: poc`, E2E is advisory, not blocking.

---

## Rules

1. **Credentials come from `test-fixtures.md`, never hardcoded.**
2. **MFA/OTP/email use a mock service or TEST_MODE**: never a real inbox/phone in automated runs.
3. **Reuse auth state**: do not re-login per test.
4. **Isolate test data** between tests (reset endpoint or re-seed).
5. **Every declared surface runs**: web AND native when `platform_targets` includes a native target.
6. **The suite is mandatory at milestone close** (non-POC): `milestone-validation` Phase 1b blocks on it.

## Cross-References

- Low-level Playwright primitives → folded into this skill (see "Low-level browser primitives" above)
- Seed users + fixtures → `mock-data/SKILL.md`, `AI_DOCS/quality/test-fixtures.md`
- Coverage targets + test rules → `rules/testing-rules.md`
- Mobile E2E specifics → `rules/mobile-rules.md`
- Milestone gate that runs this → `milestone-validation/SKILL.md` Phase 1b

<!-- v1.9.0 (2026-08-20): Visual-QA lane wiring (PLAN-testing-matrix Part 2.2/2.3). New mavs/visual.json validator entry (per-task appends from /build's Exercise gate, milestone-close consolidation here). responsive-sweep.spec.ts now also writes every sweep screenshot into AI_DOCS/quality/visual/milestone-close/, and this SKILL.md documents milestone-validation's consolidation of the per-task visual.json entries plus the full-sweep judgment into the finalized, required.txt-listed report. -->
<!-- v1.8.0 (2026-08-06): Responsive sweep + mobile interaction lane. Three committed templates (geometry-dump.ts, responsive-sweep.spec.ts, responsive-report.mjs) implement the geometry dump that was previously spec-only and add the mechanical responsive battery (RSP-01..09) emitting mavs/responsive.json (FAIL on functional-severity findings). Mobile lane operates sidebar/menus/sort/filter/pagination/row-actions at 375 with touch emulation. Cadence: 375+1440 per UI task, full 5-width sweep at milestone close, responsive joins required.txt for web. -->
<!-- v1.5.0 (2026-06-30): Merged webapp-testing into this skill. Folded the low-level browser primitives (screenshots, visual regression, selector strategy, recon-then-action, headed-Chrome default) and the milestone UI MAVS validators (webapp.json, geometry dump, V2 ui.json craft, V11 fidelity.json, V10 perf.json); repointed internal cross-references; dropped webapp-testing from optional deps. -->
<!-- v1.3.0 (2026-06-29): MAVS Wave 2 auth. Added the required auth-flow suite (password-reset single-use/expiry, session-expiry, refresh rotation + reuse-revokes-family, MFA, and the Rule 34 stale-role executable proof) emitting mavs/auth.json. v1.2.0: emit mavs/e2e.json from the real runner. -->

