# ADF Quality Rubric

> Used by `/skill-test category` to evaluate skills against category-specific standards.
> Each category has its own PASS / WARN / FAIL thresholds.

---

## How to Use

Run `/skill-test category [skill-name]` — Claude reads the skill's category from its frontmatter, then applies the matching rubric below.

Verdict:
- **PASS** — All must-pass criteria met
- **WARN** — All must-pass criteria met but 1+ should-pass criteria missed
- **FAIL** — Any must-pass criterion missed

---

## Category: `core`

Core SDLC skills (session-management, workscope, tech-specification, etc.)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | Has named SDLC phase(s) it belongs to | MUST | frontmatter `sdlc_phase` |
| 2 | Has gate ID references (not inline prompts) | MUST | references governance-gates.md IDs |
| 3 | Has a clear "when to stop" or completion signal | MUST | skill body |
| 4 | Lists which documents it reads and writes | MUST | skill body |
| 5 | Mentions `session-state.md` update instruction | MUST | skill body |
| 6 | Has memory-protocol integration | SHOULD | calls memory-protocol or describes file reads/writes |
| 7 | Has context budget guidance | SHOULD | states expected context load |
| 8 | Mentions review mode (full/lean/solo) behavior | SHOULD | AI_DOCS/review-mode.txt reference |
| 9 | Has example output or artifact format | MAY | skill body |

---

## Category: `gate`

Gate skills (gate-enforcement, code-quality)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | Lists which gate IDs it enforces | MUST | references gate IDs from governance-gates.md |
| 2 | Has APPROVE / CONCERNS / REJECT verdict format | MUST | skill body |
| 3 | Specifies blocking behavior on REJECT | MUST | skill body |
| 4 | Does NOT embed full gate prompts inline | MUST | no inline gate prompt text — reference only |
| 5 | States who (which agent) runs the gate check | MUST | agent names listed |
| 6 | Has checklist format for gate criteria | SHOULD | skill body |
| 7 | Mentions what happens on CONCERNS verdict | SHOULD | skill body |

---

## Category: `review`

Review skills (code-reviewer agent used as skill context, audit)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | Lists specific rule files it checks against | MUST | `.claude/rules/*.md` references |
| 2 | Has severity levels (CRITICAL / HIGH / MEDIUM / LOW) | MUST | skill body |
| 3 | States BLOCKING vs ADVISORY findings | MUST | skill body |
| 4 | Specifies what output format looks like | MUST | skill body |
| 5 | Does not edit or write code (read-only) | MUST | disallowedTools or explicit prohibition |
| 6 | Has traceability to FR-IDs or gate IDs | SHOULD | skill body |
| 7 | Mentions escalation path for CRITICAL findings | SHOULD | skill body |

---

## Category: `team`

Team orchestration skills (team-security)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | Has `context: fork` in frontmatter | MUST | frontmatter |
| 2 | Lists agents spawned in order or parallel | MUST | skill body |
| 3 | Has clear entry condition (when to use this skill) | MUST | skill body |
| 4 | Has a summary/output section format | MUST | skill body |
| 5 | Specifies what happens if a gate REJECTS | MUST | skill body |
| 6 | Invokes component-inspector BEFORE implementation (design inventory) | MUST | skill body — for UI-touching pipelines |
| 7 | Invokes component-inspector AFTER implementation (compliance check) | MUST | skill body — for UI-touching pipelines |
| 8 | Compliance check failure blocks QA gate | MUST | skill body |
| 9 | Has parallel vs sequential agent breakdown | SHOULD | skill body |
| 10 | Mentions session-state.md update on completion | SHOULD | skill body |
| 11 | Design inventory step outputs a component reuse plan | SHOULD | skill body |
| 12 | Has expected duration or context budget warning | MAY | skill body |

---

## Category: `utility`

Utility skills (change-request, mock-data, project-types, skill-router, etc.)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | Has a clear single responsibility | MUST | frontmatter description |
| 2 | Has at least one concrete example input/output | MUST | skill body |
| 3 | States what triggers this skill | MUST | skill body |
| 4 | Has well-defined output artifact(s) | SHOULD | skill body |
| 5 | Has "do not use when" guidance | SHOULD | skill body |

---

## Category: `platform`

Platform-specific skills (python-backend, python-ai-services, reactjs, etc.)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | States which tech stack / framework it targets | MUST | frontmatter or skill body |
| 2 | Has language/version requirements | MUST | skill body |
| 3 | References relevant rule files (e.g., mobile-rules.md) | MUST | skill body |
| 4 | Has testing guidance for the platform | MUST | skill body |
| 5 | Has error handling patterns for the platform | SHOULD | skill body |
| 6 | Mentions relevant specialist agent | SHOULD | skill body |
| 7 | References design-dna.md and component-registry.md for UI work | SHOULD | skill body |
| 8 | Mentions button variant system (no raw `<button>` elements) | SHOULD | skill body |
| 9 | Mentions spacing scale compliance (no arbitrary pixel values) | SHOULD | skill body |
| 10 | Has deployment considerations | MAY | skill body |

---

## Category: `infrastructure`

Infrastructure skills (architecture, github-ops, data-migration, mcp-connector)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | References relevant rules file | MUST | `.claude/rules/` reference |
| 2 | Has gate requirement stated | MUST | which gate ID gates this skill |
| 3 | Has rollback or undo guidance | MUST | skill body |
| 4 | Has "warning" or safety note | MUST | skill body |
| 5 | States when NOT to use this skill | SHOULD | skill body |
| 6 | Has external dependency list | SHOULD | skill body |

---

## Category: `optimization`

Optimization skills (caching-strategy, seo, i18n, error-handling)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | Has measurable success criteria | MUST | skill body |
| 2 | Has before/after pattern example | SHOULD | skill body |
| 3 | Has performance impact estimation | SHOULD | skill body |
| 4 | States which phase of SDLC it applies to | SHOULD | skill body |

---

## Category: `reliability`

Reliability skills (debugger, audit-logs, analytics)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | Has structured output format | MUST | skill body |
| 2 | Has root cause analysis guidance | MUST | for debugger specifically |
| 3 | Has logging/retention guidance | SHOULD | for audit-logs specifically |
| 4 | Has integration test guidance | SHOULD | skill body |

---

## Category: `framework`

Framework quality skills (skill-test, skill-improve)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | References catalog.yaml and quality-rubric.md | MUST | skill body |
| 2 | Has a clear output format (PASS/WARN/FAIL verdicts) | MUST | skill body |
| 3 | Has all test modes documented | MUST | static, spec, category, audit |
| 4 | Does not modify skills without user approval | MUST | skill body (skill-improve) |
| 5 | Has max retry limit for improvement loop | MUST | skill body (skill-improve) |
| 6 | Has example output | SHOULD | skill body |

---

## Category: `document`

Document skills (docx, pdf, image-assets)

| # | Criterion | Level | Check |
|---|-----------|-------|-------|
| 1 | States supported file formats explicitly | MUST | skill body |
| 2 | Has file size or complexity limits | SHOULD | skill body |
| 3 | Has error handling for unreadable files | SHOULD | skill body |

---

## Universal Checks (Applied to ALL Skills)

These checks run regardless of category (part of `/skill-test static`):

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 1 | YAML frontmatter present | Valid YAML at top | Missing or malformed |
| 2 | `name` field | Present | Missing |
| 3 | `description` field | 1–2 sentences | Missing or >5 sentences |
| 4 | `version` field | Semver format (X.Y.Z) | Missing |
| 5 | File location | `.claude/skills/[name]/skill.md` | Wrong path |
| 6 | No inline gate prompts | All gates use ID references | Full gate prompt text embedded inline |

---

## Universal Auto-Trigger Metric (Applied to ALL Skills with a `.trigger.yaml`)

Used by `/skill-test trigger`:

| # | Check | PASS | WARN | FAIL |
|---|-------|------|------|------|
| 1 | Score on 20 natural-language prompts | >=18/20 correct | 15–17/20 | <15/20 |
| 2 | Misfires concentrated on one sibling | No — diffuse | 1 sibling captures >=2 misfires | 1 sibling captures >=3 misfires (description collision) |
| 3 | Negative-unrelated prompt correctly refused | Yes | — | No (catastrophic over-trigger) |

When check 2 fails, the fix is almost always a description rewrite adding a distinguishing verb/noun against the named sibling. The skill body does not affect auto-triggering — never edit it to fix a trigger miss.

---

## Score Summary

When running `/skill-test audit`:

```
=== ADF Quality Audit ===
Total skills:  [N]
Total agents:  [N]

Static checks:
  PASS:  [N] ([%])
  WARN:  [N] ([%])
  FAIL:  [N] ([%])

Spec coverage:
  Written: [N] ([%])
  Pending: [N] ([%])

Category checks:
  PASS:  [N] ([%])
  WARN:  [N] ([%])
  FAIL:  [N] ([%])

Priority 1 specs done: [Y/N]
Priority 2 specs done: [N]/[total]

Top 3 failing skills: [name], [name], [name]
Recommended next: /skill-improve [name]
```
