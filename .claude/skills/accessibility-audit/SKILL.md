---
name: accessibility-audit
description: "Run a WCAG 2.2 AA accessibility audit on the current frontend: axe-core automated checks + keyboard navigation audit + screen reader spot checks + color contrast verification. Produces AI_DOCS/quality/accessibility-report.md with a pass/fail verdict per WCAG success criterion. Use at milestone boundary, before release, or when a user reports an accessibility issue. Also triggers on: 'A11y check', 'WCAG review', 'Axe scan', 'Keyboard nav audit', 'Screen reader check', 'Contrast check', 'Accessibility test'."
mcp_integrations: [playwright]
skip: [Design review, Visual design, Style the UI]
next_skill: null
allowed-tools: "Read Grep Glob Bash(npx:*) Bash(npm:*) WebFetch"
skill_id: SK-014
context_budget:
  load_kb: 30
  scope: milestone
version: 1.3.2
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [design-discovery, design-tokens, design-screens, memory-protocol]
  optional: [qa-testing, milestone-validation]
produces:
  - path: AI_DOCS/quality/accessibility-report.md
    consumers: [milestone-validation, gate-enforcement]
consumes:
  - path: design-system/tokens.json
  - path: AI_DOCS/design/component-registry.md
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [domain-specific, iterative]
---

# /accessibility-audit — WCAG 2.2 AA Audit

> **Purpose**: Verify WCAG 2.2 AA compliance. Separate from `/design-discovery` (which captures *intent*) — this skill verifies *actual* compliance of the shipped UI.

The Anthropic guide emphasizes embedding compliance as a domain-specific pattern with an audit trail. This skill does exactly that.

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials):

- `playwright` (free): run axe-core against the live page and drive keyboard-nav and focus checks in a real browser.

Target the project's dev URL/port and dev database only. Never point a debug/verify MCP at staging or production.

---

## Scope

Audits against **WCAG 2.2 AA** success criteria. Covers:

- **Perceivable**: color contrast, text alternatives, media alternatives, adaptable content
- **Operable**: keyboard accessible, enough time, no seizure triggers, navigable
- **Understandable**: readable text, predictable operation, input assistance
- **Robust**: compatible with assistive technologies

**WCAG 2.2 additions (audit these explicitly, they are new at 2.2 AA):**

- **2.4.11 Focus Not Obscured (Minimum):** a focused element is not entirely hidden by sticky headers/footers or other content.
- **2.5.7 Dragging Movements:** any drag operation has a single-pointer (click/tap) alternative.
- **2.5.8 Target Size (Minimum):** interactive targets are at least 24x24 CSS px (or have sufficient spacing). House standard stays stricter (44x44 touch / 32x32 desktop), but map findings to this criterion.
- **3.2.6 Consistent Help:** help mechanisms (contact, chat, FAQ) appear in a consistent location across pages.
- **3.3.7 Redundant Entry:** information already entered in a process is not asked for again (auto-populate or let the user select it).
- **3.3.8 Accessible Authentication (Minimum):** no cognitive-function test (puzzles, transcription) is required for login without an alternative. Supports the security-UX requirement.

**Removed at 2.2:** 4.1.1 Parsing is obsolete in WCAG 2.2. Do not flag parsing/duplicate-id as a 2.2 failure.

Out of scope (intentionally):

- WCAG AAA (separate skill if needed)
- Section 508 specific requirements (covered if US-gov project is classified as such)
- Non-web surfaces (mobile apps have their own guidelines — separate skill)

---

## Instructions

### Step 1 — Detect the project surface

Read `AI_DOCS/planning/project-classification.md` (if exists).

If project is not a web UI, stop with a message: "This skill audits web interfaces. For mobile/native/other surfaces, file in skill-backlog."

### Step 2 — Run automated checks (axe-core)

```bash
# If the project has a dev server and E2E setup:
npx playwright test --config accessibility.config.ts

# Or standalone via axe-core CLI:
npx @axe-core/cli http://localhost:3000 --exit=false --save=axe-report.json
```

If neither is set up, scaffold a minimal axe-core invocation:

```bash
npx @axe-core/cli --help
# Then generate tests/accessibility/run-axe.ts per project conventions
```

Parse axe-report.json. Group findings by severity:

- **Critical** — WCAG failures that block users (e.g., missing alt text, form labels)
- **Serious** — WCAG failures that significantly degrade experience (e.g., contrast below 4.5:1)
- **Moderate** — WCAG advisories (e.g., heading hierarchy)
- **Minor** — best-practice violations (not WCAG but recommended)

### Step 3 — Color contrast verification

Cross-reference `design-system/tokens.json` against WCAG:

- Body text: foreground/background contrast ≥4.5:1
- Large text (≥18pt or ≥14pt bold): ≥3:1
- UI components (borders, focus rings on interactive elements): ≥3:1
- Any token pair failing → critical finding

Use `get-contrast` or equivalent library; or compute manually from token values.

### Step 4 — Keyboard navigation audit

For each interactive component in `AI_DOCS/design/component-registry.md`:

- [ ] Can be focused via Tab
- [ ] Tab order is logical (not DOM-random)
- [ ] Can be activated via Enter / Space
- [ ] Has a visible focus indicator (no `outline: none` without replacement)
- [ ] Escape closes modals / cancels inline edits
- [ ] Arrow keys navigate grouped items (menus, lists, radio groups)
- [ ] No focus trap except in modals (which must be traps)

Automate what you can (Playwright `page.keyboard.press('Tab')` loops). Manual review for the rest — reports "requires human verification."

### Step 5 — Screen reader spot check

Select 3–5 key user flows from `AI_DOCS/planning/tech-spec.md` user stories. For each:

- [ ] Form inputs have labels (not just placeholders)
- [ ] Error messages are announced (`aria-live="polite"` or `role="alert"`)
- [ ] Dynamic content updates are announced
- [ ] Images have meaningful `alt` text (or `alt=""` if decorative)
- [ ] Icons-only buttons have `aria-label`
- [ ] Heading hierarchy is single-h1 + nested

Report findings per-flow.

### Step 6 — Responsive + zoom

- [ ] 200% zoom does not cause content loss or horizontal scrolling
- [ ] Text can reflow at 320px viewport
- [ ] No fixed-height containers that cut off reflowed text

### Step 7 — Produce reports (human + machine)

**Machine report (MAVS, BLOCKING at milestone close):** also write `AI_DOCS/quality/mavs/a11y.json` per `docs/mavs-report-schema.md` so the milestone gate parses the result instead of reading prose. `status` = `PASS` only when there are no critical/serious axe violations and the keyboard + contrast (WCAG 2.2 AA) checks pass, `FAIL` on any critical/serious, `MISSING_TOOL` if axe-core is not installed (never a silent PASS), `SKIP` if the project has no frontend. Set `failed` = count of critical/serious violations, stamp `source_commit = git rev-parse HEAD` and a real `generated_at`, and list each violation in `findings`. `hooks/mavs-gate.sh` blocks the milestone merge on `a11y` FAIL or staleness.

**Human report:** write `AI_DOCS/quality/accessibility-report.md`:

```markdown
# Accessibility Audit Report

**Date**: [YYYY-MM-DD]
**Scope**: [milestone / PR / full site]
**Verdict**: [PASS / PASS-WITH-WARNINGS / FAIL]
**WCAG level**: 2.2 AA

## Summary

| Severity | Count | Example |
|---|---|---|
| Critical | N | [first critical finding] |
| Serious | N | |
| Moderate | N | |
| Minor | N | |

## Critical findings

### [Finding title] — WCAG [criterion, e.g., 1.4.3 Contrast]

**Location**: [component or page path]
**What**: [specific issue]
**Impact**: [who's affected, how]
**Fix**: [specific change — reference token if applicable]

### ...

## Serious findings

### ...

## Automated (axe-core) raw output

Attached: `axe-report.json`

## Keyboard audit results

| Component | Tab order | Activation | Focus visible | Escape | Verdict |
|---|---|---|---|---|---|
| Button | ✓ | ✓ | ✓ | N/A | PASS |
| Modal | ✓ | ✓ | ✓ | ✓ | PASS |
| Dropdown | ✗ | ... | | | FAIL |

## Screen reader spot check

| Flow | Labels | Errors announced | Images alt | Verdict |
|---|---|---|---|---|
| Login | ✓ | ✓ | ✓ | PASS |

## Action items

- [ ] Fix [finding] — P0 — owner: [component] — by: [date]
- [ ] ...

## Sign-off

- [ ] Automated checks pass (axe-core: 0 critical/serious)
- [ ] Keyboard audit: all interactive components pass
- [ ] Screen reader: all key flows pass
- [ ] Contrast: all token pairs ≥ WCAG minimum
- [ ] Responsive: 200% zoom ok, 320px reflow ok

**Verdict**: PASS | PASS-WITH-WARNINGS | FAIL
```

### Step 8 — Update metrics + feed milestone validation

Emit telemetry:

```bash
bash hooks/log-event.sh "\"event\":\"validation.run\",\"subtype\":\"accessibility\",\"outcome\":\"$VERDICT\",\"critical\":$COUNT"
```

If `/milestone-validation` invoked this skill, return the verdict + report path.

---

## Examples

### Example 1: Pre-release audit

**User says:** "run accessibility audit before release"

**Actions:**

1. Detect: web project (from project-classification.md)
2. Start dev server or point to staging URL
3. Run axe-core across all routes in tech-spec
4. Contrast-check every token pair in design-system/tokens.json
5. Playwright keyboard sweep across top 5 flows
6. Screen reader spot check (Semi-automated: report flows requiring human verification)
7. Write `AI_DOCS/quality/accessibility-report.md`
8. Return verdict: PASS-WITH-WARNINGS (5 moderate, 0 critical)

### Example 2: Component-level audit

**User says:** "audit accessibility of the new DatePicker component"

**Actions:**

1. Run axe on the component's Storybook story (or isolated render)
2. Manual keyboard sweep: Tab, arrows, Enter/Space, Escape
3. Screen reader: date announcements, selection announcement
4. Contrast: active day, selected day, hover state
5. Report scoped to the component only

---

## Troubleshooting

### axe-core not installed

**Solution**:

```bash
npm install --save-dev @axe-core/cli @axe-core/playwright
```

Then add to `.claude/rules/testing-rules.md` if not already there.

### Dev server won't start

**Solution:** use static-build audit instead:

```bash
npm run build && npx serve dist/ &
npx @axe-core/cli http://localhost:5000
```

### Too many findings to prioritize

**Solution:** start with critical + serious only. Moderate findings go into `AI_DOCS/backlog/accessibility-moderate.md` for planned remediation. Minor findings get a PR each during maintenance windows.

### Findings disagree with design-system intent

**Cause:** design tokens may pass contrast but combinations in practice fail (e.g., text on a tinted card surface).

**Solution:** update `design-system/tokens.json` with the failing combination flagged; re-run `/design-tokens` to resolve.

---

## Rules

1. Critical findings block the milestone validation gate.
2. Serious findings require a documented remediation plan (can pass if planned).
3. `outline: none` on interactive elements is a critical finding unless paired with visible focus replacement.
4. Placeholder is NOT a label — form inputs need `<label>` or `aria-label`.
5. Color alone must never convey information (success/error always need a second cue: icon, text, pattern).

<!-- Version: 1.2.0 — 2026-06-29 — Track G: baseline upgraded WCAG 2.1 -> 2.2 AA. Added the 6 new 2.2 AA criteria (2.4.11 Focus Not Obscured, 2.5.7 Dragging, 2.5.8 Target Size, 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication); noted 4.1.1 Parsing removed at 2.2. -->
<!-- Version: 1.3.2 | 2026-10-22 | v4.32.0: team-feature, team-design and team-release retired, consumers list repointed to gate-enforcement -->
