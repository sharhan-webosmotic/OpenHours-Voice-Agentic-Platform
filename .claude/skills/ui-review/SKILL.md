---
name: ui-review
description: "Holistic UI/UX review and remediation driven by the Claude-in-Chrome browser: the human-eye layer above measured geometry checks. Navigates each rendered screen at every breakpoint, judges it against principal-designer craft heuristics (hierarchy, rhythm, alignment, density, state quality), writes a design-QA report where every finding carries a suggested correction, and applies bounded, token-respecting fixes. Severity-split verdict: writes FAIL on any of three confirmed triggers (a functional defect, a BLOCKING design-standards-checklist row violation cited by DSC id, or a deviation from an approved journey prototype at AI_DOCS/design/flows/<flow-id>/chosen.md). Aesthetic and taste findings stay advisory and never block. Functional, RBAC, auth, and API correctness stay with Playwright and the MAVS gate. Triggers on: 'review the UI', 'UX review', 'design QA', 'polish the UI', 'walk the app'."
mcp_integrations: [claude-in-chrome, playwright]
next_skill: null
required_gate: null
skill_id: SK-158
allowed-tools: "Read Grep Glob Edit Write Bash Task"
context_budget:
  load_kb: 30
  scope: milestone
version: 1.3.0
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [memory-protocol]
  optional: [change-request, design-tokens, design-screens, e2e-testing]
produces:
  - path: AI_DOCS/quality/design-qa-report.md
    consumers: [do, principal-designer, design-screens]
  - path: AI_DOCS/quality/mavs/ui-review.json
    consumers: [do]
consumes:
  - path: AI_DOCS/design/screens
    required_sections: []
  - path: AI_DOCS/quality/mavs/ui.json
    required_sections: []
metadata:
  author: WebOsmotic Private Limited
  category: quality
  user_facing: true
  role: "interactive-design-qa"
---

> **Comments & docs:** Docstrings/JSDoc on every function. Put rationale and decisions in `AI_DOCS/` + `decision-log.md`. Full policy: `.claude/rules/development-rules.md`.

# /ui-review — Claude-in-Chrome design QA and fenced remediation

> The human-eye layer. The measured geometry validator (`mavs/ui.json`, V2) catches what is countable: orphan edges, off-scale rhythm, a flat hierarchy ratio. This skill catches what needs judgment: does the screen read as professional, does the flow feel right, is the empty state inviting or dead, does the whole product feel like one hand made it. It SEES the rendered app through Claude-in-Chrome, reasons with the `principal-designer` heuristics, and fixes nits inside a tight fence.

## Where this sits (three layers)

Keep the three layers distinct, because each owns a different class of check and a different blocking rule, and a finding filed at the wrong layer either blocks a merge on taste or lets a functional defect through as advisory.

| Layer | Tool | Owns | Blocks a merge? |
|---|---|---|---|
| Functional + security | Playwright (`e2e-testing`, `authz-matrix`, `api-conformance`, `schema-validation`) | RBAC, auth, API, data, journeys -> `mavs/*.json` | YES, machine-checked |
| Measurable craft | Playwright geometry dump + responsive sweep (`e2e-testing` V2/V11 + `mavs/responsive.json`) | alignment px, rhythm steps, hierarchy ratio, fidelity vs design, mechanical responsive battery | YES, numeric thresholds |
| **Holistic UX + remediation** | **THIS skill (Claude-in-Chrome)** | "does it look right, does it feel right", then fix | **Only on a confirmed functional defect, a BLOCKING checklist row (DSC id cited), or an approved-journey deviation. Aesthetics never block** |

The blocking correctness layer stays deterministic. This skill's judgment is severity-split:

- **Functional finding** (a user cannot complete an action at some breakpoint: a control hidden behind a bar, a filter panel that opens clipped, a menu unreachable by touch, a table whose actions are cut off): confirmed by re-driving the interaction, then written as `status: FAIL` in `mavs/ui-review.json`. `mavs-gate.sh` blocks on any PRESENT FAIL report, so a confirmed functional defect blocks even though `ui-review` never joins `required.txt` (its absence, e.g. headless CI, never blocks).
- **A confirmed BLOCKING checklist violation** (a row in `AI_DOCS/design/design-standards-checklist.md` marked `Severity: BLOCKING`, re-checked against the rendered screen, not guessed from the code): also writes `status: FAIL`, citing the `DSC-NN` id. A violation of an `ADVISORY` row stays advisory, same as any other aesthetic finding.
- **A confirmed deviation from an approved journey prototype**, when one exists at `AI_DOCS/design/flows/<flow-id>/chosen.md` (the flow the operator picked at Gate FLOW PASS): the built screen taking a different path, step order, or outcome than the chosen prototype, confirmed by walking the flow, also writes `status: FAIL`, naming the flow id and the step that diverged.
- **Aesthetic finding** (looks off, weak hierarchy, dead empty state, crowding): advisory, `status: ADVISORY`, never a FAIL. A subjective "looks off" must never block promotion, or the pipeline stops being reproducible.

## Preconditions and graceful degrade

1. **Claude-in-Chrome must be available** (the browser extension + a live Chrome session). At the start, call `mcp__claude-in-chrome__tabs_context_mcp` to confirm. If the tools are unavailable (headless CI, no extension), write `mavs/ui-review.json` with `status: MISSING_TOOL` and a one-line reason, and STOP. Never fake a visual review, and never silently PASS.
2. **The app must be running** at the project dev URL (from `stack.md` / env). If it is not reachable, `status: MISSING_TOOL`.
3. **This skill drives ONE Chrome session** (one heavy browser), so it does not fan out. It is exempt from the parallel-agent cap, but it counts as one HEAVY slot if run alongside the Playwright suite (see `docs/coordination-rules.md`): on a low-RAM host, run the headed Playwright MAVS suite and this skill one at a time, since both are heavy Chrome sessions and running them together saturates memory.

## Workflow

### 1. Build the screen list
Read the screen inventory from `AI_DOCS/design/screens/**` (design-time) or the running app routes (build-time). For each screen, note its role set from the spec (which roles can see it) so the review covers per-role variants and the read-only state.

### 2. Walk each screen at every breakpoint
For each screen, via Claude-in-Chrome: `navigate` to it, then at 375 / 768 / 1024 / 1440 / 1920 widths capture a screenshot and `read_page`. Drive the real interactions (open the sidebar/nav drawer, the top-bar profile and notification menus, a dialog, alerts/toasts, a table sort/filter, pagination, a row-action menu, the empty and error states by seeding the condition), and judge the OPENED surfaces, not just the resting screen. Read `read_console_messages` for runtime errors that ruin the experience. Consume `mavs/geometry.<width>.json` and the responsive-sweep screenshots when the sweep has run: the mechanical findings there (med/low: distortion, clipped text, under-bar content) are your triage input, and anything the mechanical battery flagged crit/high is already handled by the `responsive` gate, so do not re-litigate it.

### 3. Judge against the principal-designer heuristics, the checklist, and the chosen flow
Spawn the `principal-designer` agent (it reads `mavs/ui.json` + the geometry dump for `[Certain]` measurements, and your screenshots for the holistic call). Judge: visual hierarchy (one dominant element, real type ladder), 8pt rhythm, alignment and optical alignment, content density per breakpoint, action placement, empty/loading/error/read-only/bulk state quality, milestone-wide uniformity, and the flow (can the role complete its job without friction). Also read `AI_DOCS/design/design-standards-checklist.md` (the project's copy of `templates/design-standards-checklist.md`) and check the rendered screens against it: cite the `DSC-NN` id on any finding that maps to a row, and flag its `Severity` (`BLOCKING` / `ADVISORY`) as read from the checklist, not guessed. Where a flow has an approved prototype at `AI_DOCS/design/flows/<flow-id>/chosen.md`, walk it and compare against what was built. Tag each finding `[Certain]` (measured) / `[Likely]` / `[Guessing]` (from the screenshot only), and classify each finding `functional` (a user cannot complete an action at that breakpoint, confirm by re-driving the interaction), a `checklist` violation (BLOCKING or ADVISORY per the row's own severity), a `flow-deviation` (built screen diverges from the chosen prototype), or `aesthetic` (everything else).

### 4. Write the report (every finding carries the fix)
Write `AI_DOCS/quality/design-qa-report.md`: per screen, the findings table worst-first with these columns: heuristic (cite the `DSC-NN` id when the finding maps to a checklist row) | breakpoint | what is wrong | **suggested correction** (component + file + the specific change, e.g. "DataTable header wraps at 375: add `overflow-x-auto` on the table wrapper and a sticky first column") | severity (`functional` / `checklist-blocking` / `checklist-advisory` / `flow-deviation` / `aesthetic`) | confidence tag. A finding with no named correction is incomplete. Include the `principal-designer` verdict. A finding may cite a dataset UX guideline as evidence: `ux-guidelines.csv No. <N> (<Category> / <Issue>)` plus its Do, Don't and good/bad code example. Look it up with `bash .claude/scripts/design-lookup.sh "<topic>" --domain ux` (the CSV row number is found by grepping `.claude/vendor/ui-ux-pro-max/data/ux-guidelines.csv`). A dataset citation is supporting evidence only. It never raises a finding to BLOCKING on its own, severity still follows the rules above.

Also write `AI_DOCS/quality/mavs/ui-review.json` (MAVS schema, `source_commit` = HEAD): `status: FAIL` when at least one of the following is CONFIRMED (re-driven or re-checked against the rendered screen, never guessed): a functional finding, a BLOCKING checklist row violation (`AI_DOCS/design/design-standards-checklist.md`, cited by `DSC-NN` id), or a deviation from an approved journey prototype (`AI_DOCS/design/flows/<flow-id>/chosen.md`). `status: ADVISORY` when only aesthetic or ADVISORY-checklist findings exist. `status: PASS` when clean. `ui-review` is NOT added to `required.txt` (its absence never blocks: headless CI has no Chrome extension), but `mavs-gate.sh` blocks on any present FAIL, which is exactly the intended semantics.

### 5. Route defects to the defect log
Append every finding (functional AND aesthetic) as a row in `AI_DOCS/quality/defect-log.md` with the screen, breakpoint, severity, and the suggested correction, so the fix loop runs through the normal `/do` task flow and `/retrospective` sees the pattern. Findings are never parked only in the report.

## Fenced remediation (the safety-critical part)

When asked to FIX (not just review), every fix obeys these fences. They are BLOCKING: a fix that cannot stay inside them is escalated, not forced.

1. **Never hand-edit the locked shell or tokens.** `src/components/layout/**`, the registered locked app-shell, and `design-system/tokens.json` are frozen (`enforce-shell-lock.sh`, the token grep gate). A change that needs them routes through `/change-request`, never a direct edit. A UX fix that fights the locked design is a design decision, not a nit.
2. **Compose, do not re-invent.** A fix uses the locked shell + token components. It never introduces a raw `<nav>`, a bespoke table, or a hardcoded color/px to "make it look right" (the design-token grep gate + shell-fidelity gate would fail it anyway).
3. **Bounded loop.** Apply a fix, re-view that screen, repeat at most `stack.md -> build.autofix_rounds` (default 2) rounds per screen, then STOP and list the remaining items for the operator. No infinite polishing.
4. **principal-designer signs off each applied fix.** A fix is accepted only on an APPROVE/CONCERNS verdict, never on this skill's own say-so.
5. **Re-run the functional suite after fixes.** A cosmetic change can break behavior (a moved button, a changed selector). After a fix batch, re-run the affected Playwright checks (`e2e-testing`) so `mavs/e2e.json` stays green. A green look that breaks a red test is a regression, not a fix.
6. **One concern per change, logged.** Each applied fix is a focused change with a one-line rationale in `decision-log.md`. No drive-by refactors.

## Dispatch (how /do uses this)

- **At design-screens (design-time):** review the draft screens for craft + flow before they are signed off, so problems are caught on the cheap artifact.
- **At milestone close (build-time):** a judgment pass over the built app after the machine-checked MAVS gate is green. It produces the design-QA report the operator reviews (every finding with its suggested correction), routes findings to `defect-log.md`, applies fenced fixes if asked, and writes FAIL only on a confirmed functional defect, a confirmed BLOCKING design-standards-checklist row violation (DSC id cited), or a confirmed deviation from an approved journey prototype.
- **On demand:** the operator says "review the UI" / "polish the screens".

It is operator-present by nature (interactive Chrome), so it is never the unattended milestone gate. The gate is Playwright + geometry. This is the senior designer walking the app.

## Boundaries

- Does NOT test functionality, RBAC, auth, or API correctness (that is Playwright + the MAVS gate). If it spots a functional bug while walking, it files it for `/build`, it does not fix behavior here.
- Does NOT block on aesthetics, ever. Blocks ONLY via one of the three confirmed triggers written as FAIL in `mavs/ui-review.json`: a functional finding, a BLOCKING design-standards-checklist row violation (DSC id cited), or a deviation from an approved journey prototype (and its absence in CI never blocks, since it is not in `required.txt`).
- Does NOT edit the locked shell or tokens (routes to `/change-request`).
- Does NOT run unattended in CI (needs the Chrome extension + session) -> `MISSING_TOOL` there.

<!-- v1.2.1 (2026-08-21): Truth reconciliation (PLAN-v4.20-hardening Part 2.1). Frontmatter description, the three-layer table row, the milestone-close dispatch line, and the Boundaries bullet now all state the same three confirmed FAIL triggers (functional defect, BLOCKING checklist row with DSC id, approved-journey deviation) instead of the stale functional-only phrasing. Retitled the layer heading and added the lead-in sentence explaining why the layers stay distinct. No behavior change. -->
<!-- v1.2.0 (2026-08-20): Gated where a contract exists (PLAN-testing-matrix Part 2.3). A confirmed BLOCKING design-standards-checklist violation (AI_DOCS/design/design-standards-checklist.md, cited by DSC-NN id) or a confirmed deviation from an approved journey prototype (AI_DOCS/design/flows/<flow-id>/chosen.md) now also writes status FAIL in mavs/ui-review.json, alongside the existing confirmed-functional trigger. Pure taste/ADVISORY-row findings stay advisory. Step 3 reads the checklist and the chosen flow when present; Step 4's findings table cites DSC ids and adds checklist-blocking/checklist-advisory/flow-deviation severities. -->
<!-- v1.1.0 (2026-08-06): Severity-split verdict: confirmed functional findings (control unreachable/clipped/inoperable at a breakpoint, re-driven to confirm) write status FAIL (mavs-gate blocks on a present FAIL; absence still never blocks since ui-review stays out of required.txt); aesthetics stay ADVISORY. Every finding now carries a suggested correction (component + file + specific change) and is routed to AI_DOCS/quality/defect-log.md. Walks now drive controls OPEN (drawer, menus, sort, filter, pagination, row actions) and consume the responsive-sweep geometry dumps + med/low findings as triage input. -->
<!-- v1.1.1 (2026-08-20): phrasing pass, constraints unchanged. Reworded the low-RAM host guidance as a motivated positive; the BLOCKING fenced-remediation rules and the never-fake/never-silently-PASS precondition are mechanically backed (shell-lock, token grep gate, MISSING_TOOL status) and left verbatim. -->
<!-- v1.3.0 (2026-10-22): findings may cite ux-guidelines.csv rows (No, Category / Issue, Do, Don't, good/bad example) as evidence via scripts/design-lookup.sh. Supporting evidence only, never changes severity (v4.31.0). -->
