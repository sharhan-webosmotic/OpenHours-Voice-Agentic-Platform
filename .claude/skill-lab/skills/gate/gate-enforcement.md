# Skill Test Spec — gate-enforcement

**Skill**: `gate-enforcement`
**Skill ID**: SK-061 (SK-024 in ADF 3.0 routing)
**Category**: gate
**Skill path**: `.claude/skills/gate-enforcement/skill.md`
**Spec date**: 2026-04-14
**Priority**: 1 — controls ALL phase transitions

---

## What This Skill Does

Validates project gate conditions (Gate 1 through Gate 5) by scanning AI_DOCS/ and source code for evidence, then issues a structured PASS/FAIL report and updates `AI_DOCS/memory/gate-status.md`.

## Assertions That Apply to All Test Cases

- [ ] Skill reads `AI_DOCS/memory/gate-status.md` before issuing any verdict
- [ ] Skill checks for FILE EVIDENCE — not verbal confirmation
- [ ] Gate status written to `AI_DOCS/memory/gate-status.md` on every verdict
- [ ] No inline gate prompts — references governance-gates.md IDs
- [ ] Output includes a structured condition checklist table

---

## Test Case 1: Gate 1 — All Conditions Met (PASS)

**Input scenario**:
```
User: "Check if Gate 1 is passed."
AI_DOCS/planning/tech-spec.md exists with all 23 sections populated.
Gate-status.md shows Gate 1 as PENDING.
```

**Expected behavior**:
Skill reads gate-status.md, reads tech-spec.md, verifies all 23 sections, checks Section 6 API contract, confirms Section 18 test cases, outputs PASS report, updates gate-status.md to APPROVED.

**Assertions**:
- [ ] Output contains `Status: PASSED`
- [ ] Condition checklist table lists all gate criteria with Pass/Fail per row
- [ ] Skill explicitly names the file checked (`AI_DOCS/planning/tech-spec.md`)
- [ ] gate-status.md updated with `Gate 1: APPROVED — [date]`
- [ ] Next skill recommendation included (`milestone-planning` or `guardrails`)

---

## Test Case 2: Gate 1 — Missing Prerequisite (FAIL)

**Input scenario**:
```
User: "Check Gate 1."
AI_DOCS/planning/tech-spec.md does NOT exist.
Gate-status.md shows Gate 1 as PENDING.
```

**Expected behavior**:
Skill scans for tech-spec.md, does not find it, immediately outputs FAILED with specific blocker.

**Assertions**:
- [ ] Output contains `Status: FAILED`
- [ ] Blocker specifically states: `tech-spec.md not found at AI_DOCS/planning/tech-spec.md`
- [ ] Remediation step provided: "Run /tech-specification skill first"
- [ ] gate-status.md NOT updated to APPROVED (stays PENDING or FAILED)
- [ ] Skill does NOT check other gates as a workaround

---

## Test Case 3: Gate 1 — Partial Spec (FAIL)

**Input scenario**:
```
User: "Check Gate 1."
tech-spec.md exists but only 12 of 23 sections are populated.
Sections 14, 15, 16, 17, 18, 19 are TBD or empty.
```

**Expected behavior**:
Skill reads spec, counts sections, identifies which are missing, outputs FAIL with specific missing sections listed.

**Assertions**:
- [ ] Output contains `Status: FAILED`
- [ ] Missing sections listed by number AND name (e.g., "Section 14: Folder Structure — empty")
- [ ] TBD without deadline label counts as FAIL (per gate-enforcement rules)
- [ ] Skill does NOT accept partial completion as a gate pass
- [ ] Remediation: "Complete sections 14–19 in tech-spec.md before re-checking"

---

## Test Case 4: Gate 4C — Code Review Gate (PASS with caveats)

**Input scenario**:
```
User: "Check Gate 4C."
code-quality report exists at AI_DOCS/quality/quality-report.md — all 17 points PASS.
No console.log in source files.
Test coverage is 98% (lines, branches, functions).
gate-status.md shows Gate 3: APPROVED, Gate 4C: PENDING.
```

**Expected behavior**:
Skill reads quality report, scans source for console.log (finds none), verifies test coverage >= 98% on lines, branches, and functions, outputs PASS.

**Assertions**:
- [ ] Output contains `Status: PASSED`
- [ ] Explicitly states coverage level found: "Test coverage: 98% — meets 98% minimum (lines, branches, functions)"
- [ ] gate-status.md updated to `Gate 4C: APPROVED`
- [ ] Skill notes that coverage is a floor, not proof of assertion quality (mutation-testing is the depth question) — advisory note

---

## Test Case 5: Gate Regression Detection

**Input scenario**:
```
Gate 4C was previously APPROVED (gate-status.md shows APPROVED).
User runs gate-enforcement again after new code was merged.
New code has 3 console.log statements and test coverage dropped to 74%.
```

**Expected behavior**:
Skill detects that Gate 4C conditions are now violated. Issues regression notice, updates gate-status.md to PENDING, lists violations.

**Assertions**:
- [ ] Skill detects regression (does not assume APPROVED status is permanent)
- [ ] Output contains regression notice: "Gate 4C was APPROVED but conditions are now violated"
- [ ] Specific violations listed: "3 console.log found; coverage dropped to 74% (below 80% minimum)"
- [ ] gate-status.md updated from APPROVED → PENDING
- [ ] Skill states which agent re-validates (same agent that originally approved)
