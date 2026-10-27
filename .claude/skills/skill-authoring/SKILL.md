---
name: skill-authoring
description: "Scaffolds a brand-new framework-compliant skill from scratch: pre-fills standard metadata, assigns a unique skill id, applies allowed-tools from the category matrix, and generates the frontmatter and body template. Use when creating a new skill, bootstrapping a skill template, or converting an ad-hoc workflow into a reusable skill. Do NOT use to diagnose or fix an existing failing skill (use skill-improve), or to validate a skill's correctness (use skill-test). Also triggers on: 'Create skill', 'Author skill', 'Scaffold skill', 'Convert to skill', 'Bootstrap skill'."
skip: [Test skill, Validate skill, Improve skill, Review skill]
next_skill: skill-test
allowed-tools: "Read Write Edit Grep Glob"
skill_id: SK-016
context_budget:
  load_kb: 30
  scope: task
version: 1.0.2
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [memory-protocol]
  optional: [skill-test, skill-improve, skill-router]
produces:
  - path: skills/<new-skill-name>/SKILL.md
    consumers: [skill-router, skill-test]
consumes:
  - path: docs/skill-registry.md
  - path: docs/allowed-tools-matrix.md
  - path: docs/skill-authoring-guide.md
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  patterns: [iterative, context-aware]
---

# /skill-authoring — Framework-Aware Skill Creator

> **Purpose**: Create new SKILL.md files that pass compliance audit on first commit. Enforces framework conventions: license, author, allowed-tools, unique IDs, trigger/skip blocks, Anthropic-guide structure.

Anthropic ships `skill-creator` as an official tool. This framework-specific version layers our conventions on top: IDs from the registry, category defaults, standard metadata, and integration with telemetry + deprecation tracking.

---

## Instructions

### Step 1 — Interview the user

Ask these questions (don't skip any):

1. **What does the skill do?** One sentence describing the outcome.
2. **When should it trigger?** 3–5 phrases a user might say to invoke it.
3. **When should it NOT trigger?** 2–3 phrases that look similar but should route elsewhere.
4. **What category?** sdlc | platform | infrastructure | utility | orchestration | meta
5. **What's the Anthropic pattern?** sequential | multi-mcp | iterative | context-aware | domain-specific (see docs/skill-authoring-guide.md)
6. **What tools does it need?** Read-only? File-editing? Shell? Web? (This determines `allowed-tools` category default.)
7. **What files does it produce?** Path(s) + consumers (other skills that will read it)
8. **What files does it consume?** Path(s) + required sections

If the user can't answer WHEN it triggers, push back — skills that trigger on "use when needed" never trigger correctly.

### Step 2 — Validate the concept

Check `docs/skill-decision-tree.md`. Does an existing skill already cover this? If yes, the right action is often to:

- Extend the existing skill (preferred if ≤5000 words total)
- Or split the existing skill (see `/skill-authoring split`)

Only create a new skill if the work genuinely doesn't fit an existing home.

### Step 3 — Assign a unique ID

Read `docs/skill-registry.md`. Pick the lowest unused SK-NNN in the range matching the skill's category:

- SK-001 – SK-020: Core SDLC
- SK-021 – SK-040: Platform-specific
- SK-041 – SK-060: Infrastructure
- SK-061 – SK-080: Optimization & cross-cutting
- SK-081 – SK-100: Utility & meta
- SK-101 – SK-120: Team orchestration

### Step 4 — Pick allowed-tools defaults

Read `docs/allowed-tools-matrix.md`. Pick the row matching the skill's category. Start with the default; narrow only if the skill doesn't need everything in the default.

**Never grant raw `Bash(*)` without justification.**

### Step 5 — Scaffold the skill folder

Create `skills/<kebab-case-name>/SKILL.md` with this exact structure:

```yaml
---
name: <kebab-case-name>
description: |
  [One-sentence WHAT]. Use when user says [trigger phrases] or needs [outcome].
triggers:
  - "[trigger phrase 1]"
  - "[trigger phrase 2]"
  - "[trigger phrase 3]"
skip:
  - "[negative trigger 1 — use /other-skill]"
  - "[negative trigger 2]"
next_skill: <name or null>
allowed-tools: "<from matrix>"
skill_id: SK-NNN
version: 1.0.2
license: Proprietary
compatibility: "Claude Code 1.x"
dependencies:
  required: [<required-skills>]
  optional: [<optional-skills>]
produces:
  - path: <output path>
    consumers: [<downstream skills>]
consumes:
  - path: <input path>
    required_sections: [<sections>]
metadata:
  author: WebOsmotic Private Limited
  category: <category>
  patterns: [<patterns>]
---

# /<name> — [Short Tagline]

> **Purpose**: [one-paragraph why this exists]

## When to Run

| Trigger | Timing |
|---|---|
| [trigger scenario] | [when] |

## Instructions

### Step 1 — [First action]
...

### Step 2 — [Next action]
...

### Step 3 — [Output]
...

## Examples

### Example 1: [Common scenario]

**User says:** "..."

**Actions:**
1. ...

**Result:** ...

## Troubleshooting

### Error: [common error]

**Cause:** [why]

**Solution:** [fix]

## Rules

1. [Hard rule 1]
2. [Hard rule 2]
```

### Step 6 — Register the skill

Update `docs/skill-registry.md` with the new row:

```markdown
| SK-NNN | <name> | <category> | <pattern> | <model> |
```

### Step 7 — Verify compliance

Run the audit checks (or lint manually):

- [ ] Frontmatter has `---` delimiters
- [ ] `name` is kebab-case, matches folder name
- [ ] `description` ≤1024 chars with WHAT + WHEN, no XML tags
- [ ] `id` is unique across all SKILL.md files
- [ ] `license: Proprietary`
- [ ] `metadata.author: WebOsmotic Private Limited`
- [ ] `allowed-tools` non-empty
- [ ] `compatibility` populated
- [ ] Body ≤5000 words
- [ ] Has at least one example
- [ ] Has at least one troubleshooting entry
- [ ] Does not start with `claude` or `anthropic`

### Step 8 — Emit telemetry

```bash
bash hooks/log-event.sh "\"event\":\"skill.created\",\"skill\":\"<name>\",\"id\":\"SK-NNN\",\"category\":\"<category>\""
```

### Step 9 — Suggest next step

Print:

```
Created: skills/<name>/SKILL.md (SK-NNN)
Registered: docs/skill-registry.md

Next: Run /skill-test to validate, then populate tests/triggers.yaml when Layer 6 testing is authorized.
```

---

## Examples

### Example 1: New QA-domain skill

**User says:** "I want to create a skill for running Lighthouse audits"

**Interview:**

- WHAT: Runs Lighthouse on the deployed URL + produces a performance + best-practices report
- WHEN: "lighthouse audit", "web vitals check", "core web vitals"
- NOT: "accessibility check" (use `/accessibility-audit`)
- Category: sdlc (quality-adjacent)
- Pattern: domain-specific
- Tools: shell (Bash npm/npx), read, write
- Produces: `AI_DOCS/quality/lighthouse-report.md`
- Consumes: URL from user, `AI_DOCS/planning/tech-spec.md` for pages

**Actions:**

1. Assign SK-017 (next unused in SDLC range)
2. Use QA allowed-tools default
3. Scaffold `skills/lighthouse-audit/SKILL.md`
4. Register in `docs/skill-registry.md`
5. Verify compliance
6. Suggest: run `/skill-test` next

### Example 2: Skill that already exists

**User says:** "create a skill for code reviews"

**Actions:**

1. Check decision tree → `/code-quality` + `/audit` already cover code review
2. Push back: "Code review is split between `/code-quality` (style/bugs/complexity) and `/audit` (OWASP/secrets). Which gap are you trying to fill? Or do you want to orchestrate both — in which case see `/team-security`?"
3. Only create new skill if the user identifies a genuine gap not covered.

---

## Troubleshooting

### User can't articulate WHEN the skill should trigger

**Cause:** the workflow isn't distinct enough to be a skill.

**Solution:** guide the user through the decision tree. If no clear trigger, the workflow belongs in an existing skill's references/ or as a script, not a new skill.

### Proposed name violates rules

**Cause:** contains `claude` / `anthropic` / uppercase / spaces / underscores.

**Solution:** suggest a kebab-case alternative. Reserved-prefix violations require a complete rename.

### Description exceeds 1024 characters

**Cause:** trying to put too much in the frontmatter.

**Solution:** move detail into the body. Frontmatter description is routing hint only — 2–3 sentences max.

---

## Rules

1. Never skip the "WHEN it triggers" interview question. Skills without clear triggers never trigger correctly.
2. Always check decision tree before scaffolding — most new-skill requests are existing-skill-extension requests in disguise.
3. Always assign a SK-NNN from the correct category range.
4. Never grant raw `Bash(*)` in allowed-tools without a justification comment.
5. Always register the new skill in `docs/skill-registry.md` in the same session.
6. The `license` and `metadata.author` fields are non-negotiable standards; never override.

---

## Sub-mode: `draft-triggers [skill-name | all]`

Generates a first-draft `.trigger.yaml` for the auto-trigger test suite (`/skill-test trigger`). Each draft contains 20 prompts in 6 buckets (6 direct + 4 paraphrase + 4 task-embedded + 2 context-based + 3 negative-sibling + 1 negative-unrelated).

### When to use

- Before running `/skill-test trigger` for the first time on a new skill.
- After a skill's `description:` has been rewritten substantially (old prompts may no longer fit).
- To bootstrap the test suite across many skills at once.

### Usage

```
/skill-authoring draft-triggers [skill-name]      — one skill
/skill-authoring draft-triggers all               — every skill missing a .trigger.yaml
```

### Process

1. **Read target skill's frontmatter** — only `name`, `description`, `category` (never the body).
2. **Read sibling skills' frontmatter** — same category + any skills whose descriptions share keywords with the target. These become candidates for `negative_sibling` prompts.
3. **Delegate to a subagent** with:
   - Target skill's name + description
   - 2–5 sibling skills' names + descriptions
   - The template at `skill-lab/templates/trigger-spec.yaml`
   - Instruction: "Generate 20 realistic user prompts matching the bucket distribution. For negatives, pick prompts that would plausibly fire for a specific sibling — name that sibling in `expected_sibling`. Each prompt needs a 1-sentence rationale. Output valid YAML matching the template."
4. **Write the draft** to `skill-lab/skills/[category]/[skill-name].trigger.yaml`.
5. **Update catalog.yaml**: set `trigger_spec` path and `trigger_status: drafted`.
6. **Print next step**:
   ```
   Drafted: skill-lab/skills/review/audit.trigger.yaml
   Next: review the 20 prompts (~2 min), then run:
     bash skill-lab/run-trigger-tests.sh --skill audit
   ```

### Rules for drafts

- **Prompts must sound like real users, not like skill descriptions.** Avoid copying verbs straight from the description for more than 2–3 prompts (that inflates scores).
- **Negatives must be tempting, not trivial.** A negative that obviously belongs elsewhere tests nothing. Aim for prompts a sibling skill's author would call "ours."
- **Never auto-draft + auto-classify in the same session.** The draft and the test classifier must be separate subagent invocations to avoid bias.
- **Mark `trigger_status: drafted`**, not `reviewed`. Only the user review step promotes it to `reviewed`.

### Example: draft-triggers audit

Reads `skills/audit/SKILL.md` frontmatter:
```
name: audit
description: "Run OWASP Top 10 security audit, scan for hardcoded secrets..."
category: core
```
Reads siblings: `code-quality`, `guardrails`, `project-audit` (overlapping "audit"/"scan" vocabulary).

Delegates to a subagent. Produces `skill-lab/skills/core/audit.trigger.yaml` with 16 positives (varied wording) and 4 negatives (3 routed to code-quality/guardrails/project-audit, 1 unrelated).
