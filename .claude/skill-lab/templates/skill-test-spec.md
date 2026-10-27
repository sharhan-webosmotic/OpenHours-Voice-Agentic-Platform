# Skill Test Spec — [skill-name]

> Template for writing behavioral specs. Copy this file to `skills/[category]/[skill-name].md`.
> Fill in all 5 test cases. Delete this instruction block when done.

---

**Skill**: `[skill-name]`
**Skill ID**: SK-[###]
**Category**: [gate | review | authoring | team | utility | platform | infrastructure | optimization | reliability | framework | document]
**Skill path**: `.claude/skills/[skill-name]/skill.md`
**Spec author**: [name or "ADF team"]
**Spec date**: [YYYY-MM-DD]

---

## What This Skill Does

[1-2 sentences: what the skill's job is and what it outputs]

## Assertions That Apply to All Test Cases

These must be true for every test case to PASS:

- [ ] Skill reads relevant context before producing output (reads before writing)
- [ ] Skill produces structured output in documented format
- [ ] Skill does NOT write files without user context (or stated otherwise in skill design)
- [ ] Skill references gate IDs by name (SA-ARCH, PD-SCOPE, etc.) — no inline prompts
- [ ] Skill updates session-state.md if it changes project state

---

## Test Case 1: [Happy Path — Normal Use]

**Input scenario**:
```
[Describe: what the user said, what files exist, what the project state is]
```

**Expected behavior**:
[What the skill should do, step by step]

**Assertions**:
- [ ] [Specific output element 1 — e.g., "Gate verdict appears on first line as APPROVE / CONCERNS / REJECT"]
- [ ] [Specific output element 2]
- [ ] [Specific output element 3]
- [ ] [Behavior that must NOT happen — e.g., "Does not write files without reading context first"]

---

## Test Case 2: [Missing Prerequisite]

**Input scenario**:
```
[User invokes skill but required dependency (file, gate, prior skill) is missing]
```

**Expected behavior**:
[Skill should detect the missing prerequisite and surface it — not silently skip]

**Assertions**:
- [ ] Skill detects missing [file/gate/dependency]
- [ ] Skill tells user what's missing and what to do first
- [ ] Skill does NOT proceed as if the prerequisite exists

---

## Test Case 3: [Rejection / Failure Path]

**Input scenario**:
```
[User invokes skill but conditions are not met — gate would fail, agent returns REJECT, validation fails]
```

**Expected behavior**:
[Skill surfaces the failure clearly, documents it, and stops]

**Assertions**:
- [ ] Failure is surfaced on first output line (not buried in paragraph)
- [ ] Specific blockers listed (not generic "something failed")
- [ ] Skill does NOT proceed past the failure
- [ ] [If applicable] Skill writes failure state to appropriate file

---

## Test Case 4: [Edge Case — Partial State]

**Input scenario**:
```
[Some prior work done, some missing. E.g., spec exists but some sections empty. Or one gate passed, another not yet run.]
```

**Expected behavior**:
[Skill correctly handles the partial state — proceeds where possible, flags what's incomplete]

**Assertions**:
- [ ] Skill correctly identifies what IS done vs what is NOT
- [ ] Skill does not treat partial completion as full completion
- [ ] Skill provides actionable next steps for the incomplete parts

---

## Test Case 5: [Re-invocation / Idempotency]

**Input scenario**:
```
[User runs the skill a second time on the same project state — either nothing changed, or a previous run partially completed]
```

**Expected behavior**:
[Running twice should be safe — no duplicate entries, no data corruption, no conflicting outputs]

**Assertions**:
- [ ] Second run produces same (or updated) output — not additive duplicates
- [ ] No file corruption if skill writes artifacts
- [ ] Skill picks up from where it left off if previous run was incomplete

---

## Notes / Known Limitations

[Anything that doesn't fit the test cases — known edge cases, deliberate design decisions, things NOT tested here]
