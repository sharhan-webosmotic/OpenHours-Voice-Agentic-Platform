# Skill Test Spec — workscope

**Skill**: `workscope`
**Skill ID**: SK-072
**Category**: authoring
**Skill path**: `.claude/skills/workscope/skill.md`
**Spec date**: 2026-04-14
**Priority**: 2 — highest daily use

---

## What This Skill Does

Runs a structured discovery process (35 questions in batches, tech stack R&D, hidden challenges analysis) to produce a client-facing scope document at `AI_DOCS/planning/workscope.md`, covering features, tech stack recommendation, milestones, and hidden risks.

## Assertions That Apply to All Test Cases

- [ ] Skill runs discovery questions in batches — not all at once
- [ ] Skill resolves ALL "NEEDS CLARIFICATION" items before writing the scope document
- [ ] Skill validates tech stack LTS versions — does not guess from training memory
- [ ] Scope document written incrementally with user approval at each major section
- [ ] Hidden challenges surface ambiguities the user did not raise themselves

---

## Test Case 1: Happy Path — New Project Discovery

**Input scenario**:
```
User: "I want to build a SaaS project management tool for small teams."
No AI_DOCS/ exists yet.
```

**Expected behavior**:
Skill runs Phase 1 discovery (batches A-F, 35 questions across 6 groups), conducts tech stack R&D, runs hidden challenges analysis, then produces structured workscope.md with 4 milestone plan.

**Assertions**:
- [ ] Questions asked in multiple rounds (not one giant dump of 35 questions)
- [ ] Tech stack section includes LTS version verification step
- [ ] Hidden challenges section produced — at least 3 challenges identified
- [ ] All challenges categorized: NEEDS CLARIFICATION | IN SCOPE | OUT OF SCOPE
- [ ] Scope document includes: Features list, Tech Stack, Milestones, Out of Scope, Hidden Challenges

---

## Test Case 2: Figma Provided — UI Analysis

**Input scenario**:
```
User provides a Figma URL or uploads mockup images.
User: "Here are the designs, help me scope this."
```

**Expected behavior**:
Skill incorporates Figma/mockup analysis (Phase 1.5), identifies features visible in designs, surfaces gaps between designs and what user described, asks about unshown states.

**Assertions**:
- [ ] Skill references specific screens seen in designs (not generic)
- [ ] Gap analysis produced: "Design shows X but no requirement mentioned for Y"
- [ ] Skill asks about loading states, error states, empty states for key screens
- [ ] Figma-discovered features added to scope with user confirmation

---

## Test Case 3: Scope Narrowing — User Wants MVP

**Input scenario**:
```
User: "Let's just do MVP for now, nothing fancy."
Discovery revealed 12 potential features.
```

**Expected behavior**:
Skill applies MVP filtering — helps user identify must-have vs nice-to-have vs out-of-scope, produces lean scope document.

**Assertions**:
- [ ] Skill produces must-have / should-have / out-of-scope categorization
- [ ] Milestone plan reflects MVP scope (likely 2-3 milestones, not 6)
- [ ] Out-of-scope list explicitly states what is intentionally excluded
- [ ] Skill does NOT include features user said "not now" in MVP milestone 1

---

## Test Case 4: Resuming Interrupted Discovery

**Input scenario**:
```
Discovery was partially run in a previous session.
AI_DOCS/planning/workscope.md exists as DRAFT with batches A-C completed but D-F not done.
```

**Expected behavior**:
Skill reads existing draft, identifies where discovery stopped, resumes from batch D without re-asking A-C questions.

**Assertions**:
- [ ] Skill reads existing workscope.md draft before starting
- [ ] Skill identifies which question batches are complete
- [ ] Only remaining batches asked — no repeated questions
- [ ] Draft updated incrementally, not replaced

---

## Test Case 5: NEEDS CLARIFICATION Not Resolved

**Input scenario**:
```
Discovery complete. Hidden challenges analysis produces 3 NEEDS CLARIFICATION items.
User skips answering two of them ("just make a decision for me").
```

**Expected behavior**:
Skill does NOT write the scope document until all NEEDS CLARIFICATION items are resolved — either by user answering or explicitly accepting a stated default assumption.

**Assertions**:
- [ ] Skill does not generate scope doc with unresolved NEEDS CLARIFICATION
- [ ] Skill re-presents the unresolved items and asks user to accept default assumptions OR provide answers
- [ ] Default assumption documented explicitly in scope doc if user accepts: "Assumption: [X] — accepted by user on [date]"
- [ ] All NEEDS CLARIFICATION resolved before Gate 0 approval possible
