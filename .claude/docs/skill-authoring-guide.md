# Skill Authoring Guide

This is the internal conventions guide for authoring skills in the app-development-framework. It references the authoritative Anthropic guide and layers our framework-specific conventions on top.

## Authoritative source

**Anthropic's Complete Guide to Building Skills for Claude** — `The-Complete-Guide-to-Building-Skill-for-Claude.pdf` at framework root.

Where this guide conflicts with the Anthropic guide, the Anthropic guide wins. Where it's silent, this guide extends.

## Core principles (from Anthropic guide)

1. **Progressive disclosure** — 3 levels: frontmatter (always loaded), SKILL.md body (on invoke), `references/` (on navigate). **Body ≤5,000 words.**
2. **Composability** — skills coexist; don't assume yours is the only one loaded.
3. **Portability** — same skill ideally runs on Claude.ai, Claude Code, and API. We're Claude Code-first for v3.1, but isolate Claude Code-specific content to `references/platform-claude-code.md` where possible.

## File layout

```
skills/your-skill-name/
  SKILL.md                         # Required, exact case-sensitive
  references/                      # Optional, loaded on demand
    api-patterns.md
    examples/
  scripts/                         # Optional, executable helpers
    process-data.py
  assets/                          # Optional, templates/fonts/icons
    report-template.md
  tests/                           # Added in Layer 6 (when authorized)
    triggers.yaml
    snapshots/
```

### Hard rules

- **Filename must be exactly `SKILL.md`** (not `Skill.md`, `skill.md`, etc.)
- **Folder name must be kebab-case**: `your-skill-name` — no spaces, no capitals, no underscores
- **No `README.md` inside the skill folder** — docs go in `SKILL.md` or `references/`
- **No skill names starting with `claude` or `anthropic`** — reserved prefixes

## Frontmatter contract

Every SKILL.md starts with YAML frontmatter. Required + recommended fields for our framework:

```yaml
---
name: your-skill-name                    # REQUIRED. Must match folder name (kebab-case).
description: |                           # REQUIRED. ≤1024 chars. Must include WHAT + WHEN.
  What this skill does. Use when user says [trigger phrases] or needs [outcome].
id: SK-NNN                               # REQUIRED. Unique SK-NNN from skill-registry.md.
version: 1.0.0                           # REQUIRED. SemVer. Bump on every content change.
license: Proprietary                     # REQUIRED (mandatory standard).
compatibility: "Claude Code 1.x"         # REQUIRED. What env this needs.
allowed-tools: "Read Write Edit Grep Glob"   # REQUIRED. See allowed-tools-matrix.md.
trigger:                                 # Recommended. Positive trigger phrases.
  - "phrase that should activate this skill"
  - "another phrase"
skip:                                    # Recommended. Negative triggers.
  - "phrase that should NOT activate this skill (use /other-skill instead)"
produces:                                # Recommended for producer skills.
  - path: AI_DOCS/planning/workscope.md
    schema: references/schemas/workscope.schema.yaml
    consumers: [tech-specification, milestone-planning]
consumes:                                # Recommended for consumer skills.
  - path: AI_DOCS/planning/workscope.md
    required_sections: [user-stories, acceptance-criteria]
metadata:
  author: WebOsmotic Private Limited    # REQUIRED (mandatory standard).
  category: sdlc                        # sdlc | platform | infrastructure | utility | orchestration
  tags: [planning, requirements]
---
```

### Description rules (hard)

- ≤1024 characters
- Must include WHAT + WHEN (guide requirement)
- No XML tags (`<` or `>`) anywhere
- The listing truncates a skill's combined `description` + `when_to_use` at 1,536 characters, so put the key use case in the first sentence, where it survives the cut.
- Good: `"Plans a milestone with story breakdown and velocity forecast. Use when user says 'plan milestone', 'break down release', or starts a new sprint."`
- Bad: `"Helps with projects."` (too vague, no WHAT, no WHEN)
- Bad: `"Implements the <Project> entity model."` (XML tags; no WHEN)

### Trigger block

Structured triggers supplement the `description` field for the router:

```yaml
trigger:
  - "plan milestone"
  - "break down release"
  - "estimate next sprint"
skip:
  - "plan one task"      # use /task-planner instead
  - "plan release"       # use /do Phase 3 plus gate-enforcement Gate 5 instead
```

## Body structure (recommended)

```markdown
# Your Skill Name

## Instructions

### Step 1 — <First major step>

Clear actionable description. Reference scripts/files where useful.

### Step 2 — <Next step>
...

## Examples

### Example 1: <Common scenario>

**User says:** "..."

**Actions:**
1. Fetch X
2. Transform Y
3. Write Z to `AI_DOCS/...`

**Result:** <what the user sees>

## Troubleshooting

### Error: <common error>

**Cause:** <why>

**Solution:** <fix>
```

### Body length limit

- **≤5,000 words** per Anthropic guide
- Move detailed reference material to `references/<topic>.md` and link to it
- If your body exceeds 5,000 words, consider a skill split (see `/skill-authoring` skill)

### Writing style

- Lead with action, not theory
- Use numbered lists for sequential steps
- Use `## Important` or `## Critical` for must-follow constraints
- Include at least one end-to-end example
- Include at least one troubleshooting scenario

## Positive-direction authoring

When a skill or agent tells the model what NOT to do, convert it to what TO do, with
the reason, unless the boundary is mechanically enforced or safety-critical. This is
the same triage every Tier 3 platform-specialist agent went through in the v1.1.2
phrasing pass, and the standard for every new skill or agent from here on.

**The pattern**: desired behavior, then the reason, then any narrow exception.

- Weak: "Never use the array index as a key."
- Better: "Use a stable ID as the list key, not the array index, so item state follows
  the item through reorders (an index key is fine only when the list is truly static)."

**Reserve bare prohibitions for two cases:**

1. **Mechanically enforced boundaries.** Tool access (`disallowedTools`), a hook that
   blocks the action, a `read-only, never edits` statement, a verdict format a caller
   parses. Keep these negative and verbatim: there is no adjacent judgment call to
   generalize to, and rewording risks the model treating a hard boundary as a
   preference it can weigh against other considerations.
2. **Safety-critical boundaries.** Secrets, destructive commands, compliance-mandated
   controls. State the prohibition plainly. A softened "prefer not to" invites the
   model to negotiate with itself under pressure.

Everywhere else, a positive rewrite does real work: it tells the model what good looks
like instead of only what to avoid, so the same judgment transfers to a case the rule
did not anticipate. A list of "don't"s teaches the model to recognize failure after the
fact. A list of "do this, because"s teaches it to reach the right answer the first
time.

This applies to every rule list a skill or agent enforces in its own voice (a "Rules to
Enforce" section, inline style guidance, coding conventions). It does not apply to
escalation rules ("hand off to X when Y") or tool/role boundaries, which fall under the
mechanically enforced case above and stay as written, not rephrased per skill.

## Mapping to Anthropic patterns

Every skill should fit at least one of the five canonical patterns:

1. **Sequential workflow orchestration** — explicit step ordering + rollback (e.g., `/build`)
2. **Multi-MCP coordination** — phase separation + data passing (e.g., `/mcp-connector`)
3. **Iterative refinement** — explicit quality criteria + stop rules (e.g., `/code-quality`)
4. **Context-aware tool selection** — decision tree + fallback options (e.g., `/project-types`)
5. **Domain-specific intelligence** — embedded policy + audit trail (e.g., `/audit`)

Declare the primary pattern in metadata:

```yaml
metadata:
  patterns: [sequential, iterative]
```

## Versioning

- `metadata.version` follows SemVer
- **Patch** (X.Y.Z → X.Y.Z+1): body wording / typo / minor phrasing
- **Minor** (X.Y.Z → X.Y+1.0): behavior change that's backward-compatible; description or trigger list changes
- **Major** (X.Y.Z → X+1.0.0): breaking — output contract changed, required inputs added, skill renamed

Every SKILL.md change requires a version bump (enforced by `hooks/pre-commit-version-bump.sh` in Wave 3).

## Aliasing (for renames and splits)

When a skill is renamed or split, preserve the old name as an alias in `docs/skill-deprecations.md` for at least one minor version. The router will resolve the old name to the new skill and emit a `skill.deprecated_alias` telemetry event.

## Using `/skill-authoring`

The `/skill-authoring` skill scaffolds a new SKILL.md with:

- Framework-standard frontmatter (license, metadata.author auto-filled)
- Unique SK-NNN from registry
- Correct category default from allowed-tools-matrix.md
- Template body with Instructions / Examples / Troubleshooting sections

Prefer it over hand-rolling.

## Testing (when Layer 6 is authorized)

Every skill will ship with:

- `tests/triggers.yaml` — ≥5 should-trigger and ≥3 should-not-trigger phrases
- `tests/snapshots/` — at least one end-to-end snapshot case
- `produces:` / `consumes:` declarations with contract schemas (if applicable)

See `docs/update-regression-policy.md` (to be created with Layer 6).

## Checklist before committing a new skill

From Anthropic guide, Reference A — adapted:

**Before start:**

- [ ] Identified 2–3 concrete use cases
- [ ] Tools identified (read-only vs. shell vs. orchestration)
- [ ] Reviewed this guide + example skills in `skills/`

**During development:**

- [ ] Folder kebab-case
- [ ] `SKILL.md` exact case
- [ ] Frontmatter has `---` delimiters
- [ ] `name` kebab-case, matches folder
- [ ] `description` ≤1024 chars, WHAT + WHEN, no XML
- [ ] `id: SK-NNN` unique in registry
- [ ] `version`, `license: Proprietary`, `metadata.author: WebOsmotic Private Limited`
- [ ] `compatibility` and `allowed-tools` populated (no `model` tag: skills and agents inherit the model set in the Claude CLI default settings)
- [ ] Body ≤5,000 words
- [ ] Instructions are clear + actionable (specific commands, not vague)
- [ ] Error handling included
- [ ] At least one example
- [ ] References linked clearly

**After merge:**

- [ ] Entry in `docs/skill-registry.md`
- [ ] (Layer 6 when authorized) Trigger + snapshot tests populated
