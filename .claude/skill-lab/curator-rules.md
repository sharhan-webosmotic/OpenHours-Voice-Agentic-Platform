# Skill Curator Rules v1.0

> Grading rubric for the ADF autonomous skill curator.
> Used by: `agents/skill-curator.md` and `/skill-curator` skill.

---

## Grading grades (precedence: STALE > REDUNDANT > NEEDS_IMPROVEMENT > HEALTHY)

### HEALTHY
All of the following must be true:
- `trigger_status: passing` AND `trigger_last_score >= 18`
- `spec_status: written`
- `trigger_last_run` is not null (has been tested at least once)

A HEALTHY skill requires no action. List it in the report but do not generate improvement recommendations.

---

### NEEDS_IMPROVEMENT
Any of the following:
- `trigger_last_score < 18` (but skill has been tested — score is 14–17)
- `spec_status: pending` (behavioral spec not written)
- Description field has fewer than 40 words (too vague for reliable auto-routing)
- `trigger_status: failing`

**Action**: Generate specific fix recommendation:
- Score 16–17 → "Strengthen paraphrase and task-embedded trigger prompts"
- Score 14–15 → "Rewrite description to use action verbs from the trigger prompts"
- Score < 14 → "Critical: description and trigger prompts are misaligned — full rewrite needed"
- Spec pending → "Write 5-case behavioral spec in skill-lab/skills/"
- Short description → "Expand description to cover more trigger phrases and task contexts"

---

### STALE
Both of the following:
- `trigger_status: pending` (never been trigger-tested)
- `trigger_last_run` is null OR older than 90 days from today's date

Also classify as STALE if `trigger_status: draft` with no `trigger_last_run`.

**Action**: "Schedule trigger test — run `bash skill-lab/run-trigger-tests.sh --skill <name>`"

Stale does NOT mean the skill is bad — it just means the trigger framework hasn't validated it.
Priority for testing: by `priority` field (1 = most critical first).

---

### REDUNDANT
Apply only after scoring all other grades. A pair is REDUNDANT if:
- Both skills are in the same category
- Their description fields cover >70% of the same use cases (your semantic judgment)
- They would both trigger for the same user prompts

**Action**: Choose one of:
- "Merge `<name-A>` into `<name-B>`: <A> has fewer trigger phrases; <B> covers the broader case"
- "Differentiate: add `[only for X]` qualifier to `<name-A>` description"
- "Review: use case overlap is significant but context differs — human decision needed"

Do not mark skills from different categories as REDUNDANT even if descriptions overlap.

---

## Edge cases

| Situation | Classification |
|---|---|
| `trigger_status: passing` but `spec_status: pending` | NEEDS_IMPROVEMENT (spec still needed) |
| `trigger_last_score: null` (never tested) | STALE |
| `user_facing: false` | Grade normally — internal skills still need quality |
| `demoted_in: X.Y.Z` | STALE — no longer maintained |
| Score exactly 18/20 | HEALTHY (threshold is ≥18) |
| Score 17/20 | NEEDS_IMPROVEMENT |

---

## Priority for action

When multiple skills need attention, prioritize by:
1. STALE + `priority: 1` or `priority: 2` — blocking core functionality
2. NEEDS_IMPROVEMENT + `priority: 1` — daily-use skills
3. REDUNDANT pairs — confuses routing
4. NEEDS_IMPROVEMENT + `priority: 3` or higher — nice-to-have
5. STALE + `priority: 4` or `priority: 5` — rarely used features

---

## What the curator does NOT do

- Does NOT run trigger tests (that's `bash skill-lab/run-trigger-tests.sh`)
- Does NOT modify skill files (that's `/skill-improve`)
- Does NOT delete stale skills (human decision only)
- Does NOT grade agent files by trigger score (agents don't have trigger specs)
