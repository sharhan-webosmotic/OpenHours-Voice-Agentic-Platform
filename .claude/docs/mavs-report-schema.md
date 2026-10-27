# MAVS Report Schema

> Milestone Autonomous Validation Suite (MAVS) report contract.
> The milestone gate (`hooks/mavs-gate.sh`) PARSES these reports. No green verdict
> is produced by the model: every PASS is read from a real test-runner report whose
> exit code and failure count are recorded here. This is the fix for systemic
> problem P1 (gates trusting a self-written "Verdict: PASS").

---

## Location

Each validator writes one report to:

```
AI_DOCS/quality/mavs/<validator>.json
```

These normalized verdict reports are small and stay TRACKED in git as evidence. The RAW runner output they are derived from (coverage HTML/lcov/`coverage-summary.json`, pytest `coverage.json`, Go `cover.out`, Playwright HTML + JUnit XML) is written under `AI_DOCS/quality/test-artifacts/`, which is GITIGNORED (temp data, never pushed). Runners are pointed there by the scaffolded configs (`vitest`/`jest` `coverageDirectory`, `playwright` reporter paths) and the `scripts/adf-test.mjs` orchestrator. Nothing test-generated is written to `/tmp` or the project root.

`<validator>` is the producer name. The full validator set and its producer:

| `<validator>` | Producer skill | Applies to |
|---|---|---|
| `qa` | `qa-testing` | always |
| `traceability` | `qa-testing` (requirement -> passing-test join) | always |
| `security` | `audit` (or `team-security` for compliance) | always |
| `authz` | `authz-matrix` | any roles (API + Playwright UI + dynamic two-actor + IDOR/CSRF/refresh chains; 100% role x action x field coverage; three-state cells PASS/LEAK/INCONCLUSIVE per AuthMatrix; report carries `mode` (static/dynamic), `cells_total`/`cells_tested`/`cells_passed`/`leaks`/`inconclusive` + per-layer api/ui/dynamic/chains counts + per-permission coverage in `mode: dynamic` (each checkmark validated by its own permission, dependency closure honored, role-name guards flagged); a `LEAK` is always FAIL, an `INCONCLUSIVE` does not block but is not PASS; human grid at `mavs/authz-matrix.md`) |
| `schema` | `schema-validation` | database |
| `api` | `api-conformance` | API |
| `auth` | `e2e-testing` auth suite | auth |
| `e2e` | `e2e-testing` | frontend |
| `a11y` | `accessibility-audit` (WCAG 2.2 AA) | frontend |
| `python-test` / `webapp` | `python-testing` / `e2e-testing` | per stack |
| `fast-validate` | re-run lint/typecheck at close | always |
| `ui` | `e2e-testing` (6 measured craft sub-checks from the geometry dump) | frontend |
| `responsive` | `e2e-testing` responsive sweep (templates: `geometry-dump.ts` + `responsive-sweep.spec.ts` + `responsive-report.mjs`) — mechanical all-device battery per screen at 375/768/1024/1440/1920 + the 375 touch interaction lane (drawer, menus, sort, filter, pagination, row actions exercised open). FAIL on any crit/high (functional) finding: page overflow, element outside viewport, covered/zero-size control, sub-44px touch target, table scrolling the page, overflowing image | frontend |
| `fidelity` | `e2e-testing` (rendered structure vs design reference + locked-shell composition) | frontend with design screens |
| `visual` | `build` Exercise gate (per-task, appended) + `e2e-testing` / `milestone-validation` (milestone-close consolidation): 375/768/1440 screenshots (per task) or the full 5-width sweep (milestone close) judged against `AI_DOCS/design/design-standards-checklist.md` by `component-inspector` (mechanical rows) + `principal-designer` (visual rows); findings carry a `DSC-NN` id and a `screenshot` path (see "visual.json specifics" below). `FAIL` on any confirmed BLOCKING checklist violation, `MISSING_TOOL` only when neither Playwright nor Claude-in-Chrome is available (never a silent PASS) | frontend, required for web |
| `behavior` | `qa-testing` (pagination/search/filter at API + Playwright UI, against the 10k-row fixture; cache hit/miss/invalidation/TTL) — `findings` carry `pagination`/`search`/`filter`/`cache` sub-results | any list endpoint or list screen |
| `perf` | `e2e-testing` (bundle size per route warn 150kb/FAIL 250kb gzipped + Core Web Vitals LCP/CLS/INP + API p95 vs the S12 budget) — each metric a number in `findings`; p95 is `MISSING_TOOL` without a load tool | frontend |
| `slop` | `build` Exercise gate (per task: `npx impeccable detect --json` on the task's changed UI files, appended via the visual.json incremental tasks-array shape) + `milestone-validation` (full-tree `npx impeccable detect --json` over the web app source at close, consolidated). Deterministic anti-pattern detector, no LLM judgment. Entry statuses PASS/FAIL/SKIP/MISSING_TOOL (detector exit code 1 is `MISSING_TOOL`, never `FAIL`), findings carry the impeccable rule id and the file. Advisory pilot: while any entry carries findings the top-level status is written `ADVISORY` (never `FAIL`), the lane never blocks, and it is NOT listed in `required.txt` (pilot first, the same pattern the visual lane used before promotion) | frontend with `skills/impeccable/` installed |

A milestone additionally has:

```
AI_DOCS/quality/mavs/required.txt        # one validator name per line; the gate fails if a listed report is missing
AI_DOCS/quality/mavs/SUMMARY.md          # unified human table (validator | status | passed/failed | top finding)
AI_DOCS/quality/mavs/geometry.<width>.json  # DATA artifact: rendered DOM geometry at 375/768/1024/1440/1920, read by the ui + fidelity validators and principal-designer. Produced by the e2e-testing responsive sweep (responsive-report.mjs merges the sweep artifacts). NOT a verdict report (no "status" field); mavs-gate.sh skips any geometry.*.json and any json lacking a "status".
```

`milestone-validation` is the orchestrator: it runs the applicable validators as a
PARALLEL fan-out (they are independent, so wall-clock is the slowest validator, not
the sum), writes `required.txt` from the stack (web frontend ->
e2e/a11y/ui/responsive/perf/visual, plus fidelity when design screens exist, backend ->
api/schema/authz/auth, always -> qa/traceability/security), and writes the unified
`SUMMARY.md` for the operator. Lines starting with `#` in required.txt are comments.
The MACHINE verdict is always parsed from the JSON reports, never from SUMMARY.md.

---

## Schema

```json
{
  "validator": "e2e",
  "milestone": "M01",
  "generated_at": "<ISO 8601, real timestamp at run>",
  "source_commit": "<git rev-parse HEAD at the moment the suite ran>",
  "status": "PASS | FAIL | SKIP | MISSING_TOOL | ADVISORY",
  "total": 0,
  "passed": 0,
  "failed": 0,
  "skipped": 0,
  "findings": [
    { "id": "TC-AUTH-001", "severity": "crit | high | med | low", "detail": "one line", "location": "file:line" }
  ]
}
```

### `visual.json` specifics (per-task appended, milestone-consolidated)

Every other report in this schema is regenerated fresh on each run. `visual.json` is the one
exception: it accumulates one entry per UI task across a milestone, then is finalized once at
close. It is still a SINGLE valid JSON object at every moment, never a stream of appended
fragments.

**The incremental shape.** The generic envelope (validator, milestone, generated_at,
source_commit, status, totals), plus a `tasks` array with one entry per task append:

```json
{
  "validator": "visual",
  "milestone": "M01",
  "generated_at": "<ISO 8601, timestamp of the most recent append>",
  "source_commit": "<git rev-parse HEAD at the most recent append; re-stamped at close>",
  "status": "PASS | FAIL | SKIP | MISSING_TOOL",
  "total": 0,
  "passed": 0,
  "failed": 0,
  "skipped": 0,
  "tasks": [
    {
      "task": "T-14",
      "status": "PASS | FAIL | SKIP | MISSING_TOOL",
      "screenshots": [
        "AI_DOCS/quality/visual/T-14/CaseList.375.png",
        "AI_DOCS/quality/visual/T-14/CaseList.768.png",
        "AI_DOCS/quality/visual/T-14/CaseList.1440.png"
      ],
      "findings": [
        {
          "id": "DSC-07",
          "severity": "crit | high | med | low",
          "detail": "one line describing the violation",
          "location": "component or file the violation is in",
          "screenshot": "AI_DOCS/quality/visual/T-14/CaseList.375.png"
        }
      ]
    }
  ]
}
```

- **Entry `status`** reflects that task's screenshots only: `PASS` (screenshots captured, no
  BLOCKING checklist violation), `FAIL` (at least one confirmed BLOCKING violation,
  uncorrected), `SKIP` (a POC project, or a task with no web surface: a missing checklist on a
  web-frontend non-POC project is scaffolded by the `/build` backstop, never SKIPped),
  `MISSING_TOOL` (neither Playwright nor Claude-in-Chrome was available for this task:
  recorded, never a silent PASS).
- **Top-level `status` is the worst of the entry statuses**, ordered `FAIL` worst, then `PASS`,
  then `SKIP`: one FAIL entry makes the report FAIL, any PASS with no FAIL makes it PASS,
  all-SKIP makes it SKIP. `MISSING_TOOL` applies at entry level: a MISSING_TOOL entry is
  recorded but ignored by the worst-of ordering, and the top level reads `MISSING_TOOL` only
  when every entry carries it (nothing was ever judged).
- **Top-level totals count entries**: `total` is the number of entries in `tasks`, and
  `passed`/`failed`/`skipped` count the entries carrying that status (a MISSING_TOOL entry
  counts toward `total` only). This keeps the gate's `failed > 0` rule aligned with the
  worst-of `status`.
- **Producers rewrite the file atomically, never text-append.** To add an entry: read the
  existing object (or start a fresh envelope when the file is absent), append the new entry to
  `tasks` (replacing any previous entry for the same task id on a re-judgment), recompute the
  top-level `status` and totals, re-stamp `generated_at` and `source_commit`, and write the
  whole object back. Appending text to the file produces invalid JSON, which `mavs-gate`
  hard-blocks as an unreadable report.
- **Per task (producer: `build`'s Exercise gate).** For every UI task, once the 375/768/1440
  screenshots are captured (`AI_DOCS/quality/visual/<task-id>/`) and judged against
  `AI_DOCS/design/design-standards-checklist.md`, ONE entry is added to the `tasks` array via
  the atomic rewrite above, its entry `status` reflecting that task's screenshots only.
- **At milestone close (producer: `e2e-testing` full sweep + `milestone-validation`).** The full
  5-width sweep writes its screenshots to `AI_DOCS/quality/visual/milestone-close/`, and
  `milestone-validation` consolidates: it reads every per-task entry accumulated during the
  milestone plus a final full-sweep judgment (every delivered screen, all 5 widths), and writes
  the finalized report with `source_commit = git rev-parse HEAD` at close. This finalized report,
  not any single per-task entry, is what `hooks/mavs-gate.sh` reads against `required.txt`.
- **Finding shape**: each finding's `id` is the checklist row it maps to (`DSC-NN`, from
  `AI_DOCS/design/design-standards-checklist.md`, template at
  `templates/design-standards-checklist.md`), and it carries one additional field beyond the
  generic schema, `screenshot`, pointing at the exact image the finding was judged from (shown
  in the shape block above). A `crit`/`high` finding on a checklist row marked `Severity:
  BLOCKING` is what drives an entry's `status: FAIL`. A finding on an `ADVISORY` row is
  recorded but never sets `FAIL` on its own.

### Field meaning

- `source_commit`: the git HEAD when the suite ran. The gate compares this to the
  current HEAD and treats a mismatch as STALE (code changed since the report was
  produced), which BLOCKS. This is what stops a stale green report from passing a
  merge that contains newer, unvalidated code.
- `status`:
  - `PASS`: the runner exited clean, `failed` is 0.
  - `FAIL`: at least one test failed (`failed > 0`) or the runner errored.
  - `SKIP`: the validator did not apply to this milestone (recorded, does not block).
  - `MISSING_TOOL`: the runner/tool was not installed. Recorded, prints an install
    hint, does NOT block on its own. Per `milestone-validation` Rule 1, a check that
    cannot run is reported MISSING_TOOL, never silently PASS.
  - `ADVISORY`: valid ONLY in `ui-review`'s report and, for the duration of its
    advisory pilot, the `slop` report (where it means the deterministic detector ran
    and found anti-patterns, recorded without blocking). In `ui-review` it means the
    review completed and
    found aesthetics-only issues: no functional failure, no BLOCKING checklist row
    violated, no approved-journey deviation (any of those three makes the report FAIL
    instead). `mavs-gate` treats an ADVISORY report as non-blocking, same as SKIP and
    MISSING_TOOL, and exempts it from the STALE check (an aesthetics-only verdict from
    an older commit is advice, not a merge condition). A validator other than
    `ui-review` or `slop` emitting ADVISORY is a schema violation.
- `failed > 0` always means FAIL regardless of the `status` string (ADVISORY reports
  carry `failed: 0` by definition, or they would be FAIL).

---

## How the gate reads it (`hooks/mavs-gate.sh`)

On a `git merge` of a milestone branch (non-POC), the gate:

1. Reads `required.txt` (if present) -> the set of validators that MUST have a report.
2. Globs `AI_DOCS/quality/mavs/*.json`.
3. BLOCKS (exit 2) if any report is `FAIL` / `failed > 0`, is STALE
   (`source_commit != current HEAD`), is unreadable, or a REQUIRED validator's
   report is absent.
4. Prints (does not block) `SKIP`, `MISSING_TOOL`, and `ADVISORY` reports. An
   ADVISORY report is also exempt from the STALE check in step 3.
5. If `required.txt` is absent, requires nothing, but still blocks on any present
   FAIL / stale / unreadable report (safe during the transition while validators
   are being wired).

Escape: `ADF_SKIP_MAVS=on` AND a recorded `ADF_SKIP_MAVS` line in
`AI_DOCS/memory/decision-log.md` (the toggle alone is not enough). POC projects
(`planning_depth: poc`) are exempt.

---

## Producing a report from a real runner

Validators normalize their runner output into this schema. Examples:

- Playwright: `npx playwright test --reporter=junit` -> parse the JUnit XML ->
  counts + failures into `e2e.json`.
- pytest: `pytest --junitxml=...` -> `python-test.json`.
- jest: `jest --json` -> `qa.json`.

Always stamp `source_commit` with `git rev-parse HEAD` and `generated_at` with the
real run time. Never hand-write a PASS: emit it from the runner result.
