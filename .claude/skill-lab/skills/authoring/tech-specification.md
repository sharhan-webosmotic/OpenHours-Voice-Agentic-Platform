# Skill Test Spec — tech-specification

**Skill**: `tech-specification`
**Skill ID**: SK-070
**Category**: authoring
**Skill path**: `.claude/skills/tech-specification/skill.md`
**Spec date**: 2026-04-14
**Priority**: 2 — highest daily use

---

## What This Skill Does

Generates a complete 23-section technical specification covering API contracts, database schemas, UI specs, test cases, and sequence diagrams. Writes to `AI_DOCS/planning/tech-spec.md` incrementally, section by section.

## Assertions That Apply to All Test Cases

- [ ] Skill reads workscope.md before generating (does not start from nothing)
- [ ] Skill asks 6 mandatory pre-generation questions before writing anything
- [ ] Skill writes sections incrementally — skeleton first, then section by section
- [ ] Skill does NOT write without asking "May I write Section [N]?" (or equivalent approval)
- [ ] Skill uses `<LTS-TBD>` for versions it cannot verify — never hardcodes from memory

---

## Test Case 1: Happy Path — Workscope Exists

**Input scenario**:
```
User: "Generate the tech specification."
AI_DOCS/planning/workscope.md exists with approved scope, tech stack (Next.js + NestJS + PostgreSQL), and 4 milestones.
Gate 0: APPROVED in gate-status.md.
```

**Expected behavior**:
Skill reads workscope.md, asks 6 pre-generation questions (project type, auth method, deployment target, etc.), receives answers, writes skeleton of all 19 section headings first, then fills section by section with "May I write Section N?" gates.

**Assertions**:
- [ ] Skill reads workscope.md content before asking questions (references specific workscope data)
- [ ] 6 mandatory questions asked before any writing
- [ ] Skeleton (19 section headings) written before content
- [ ] At least Section 6 (API Contract) has structured endpoint table
- [ ] Section 16 (Tech Constraints) uses `<LTS-TBD>` or verified version, not guessed version
- [ ] Change Log section initialized at bottom

---

## Test Case 2: Missing Prerequisite — No Workscope

**Input scenario**:
```
User: "Write the tech spec."
No workscope.md exists in AI_DOCS/.
Gate 0 is PENDING.
```

**Expected behavior**:
Skill detects missing workscope, does not generate a spec from scratch, directs user to run /workscope first.

**Assertions**:
- [ ] Skill does NOT begin generating spec
- [ ] Skill states: workscope.md not found — run /workscope first
- [ ] Skill does NOT skip the prerequisite with "I'll make assumptions"
- [ ] Gate 0 status surfaced to user as PENDING

---

## Test Case 3: Updating Existing Spec (Mid-project)

**Input scenario**:
```
User: "Update Section 6 (API Contract) — we added a new /notifications endpoint."
tech-specification.md exists (Gate 1 approved).
api-contract.md exists and is locked.
```

**Expected behavior**:
Skill detects existing spec, reads current Section 6, adds new endpoint while preserving existing entries, notes that api-contract.md is LOCKED and must be updated via /change-request skill.

**Assertions**:
- [ ] Skill reads existing Section 6 before writing (does not overwrite blindly)
- [ ] New endpoint added without removing existing ones
- [ ] Change Log at bottom updated with the addition
- [ ] api-contract.md LOCK surfaced: "api-contract.md is locked — use /change-request to update it"
- [ ] Version bump noted in spec: Change Log entry with date

---

## Test Case 4: Section With Ambiguous Requirements

**Input scenario**:
```
User: "Write Section 8 (Business Logic) for the subscription feature."
workscope.md mentions "subscription management" but details are vague.
No FRD exists.
```

**Expected behavior**:
Skill identifies ambiguity in requirements, asks clarifying questions about specific business rules before writing, does not hallucinate business logic.

**Assertions**:
- [ ] Skill asks specific clarifying questions (not generic "tell me more")
- [ ] Skill identifies what IS clear from workscope and what needs clarification
- [ ] Skill does NOT write business rules that are not in workscope or stated by user
- [ ] After clarification received, writes Section 8 as "Rule: [specific condition]" statements

---

## Test Case 5: Re-generation After Change Request

**Input scenario**:
```
User: "We're dropping React Native and going web-only. Regenerate the mobile section."
tech-specification.md exists, Gate 1 approved.
Change request CR-001 approved (PD-SCOPE + SA-ARCH verdicts exist in AI_DOCS/).
```

**Expected behavior**:
Skill reads the approved change request, identifies affected sections (Section 5 UI, Section 14 Folder Structure, Section 16 Tech Constraints), updates only those sections, preserves all others.

**Assertions**:
- [ ] Skill reads CR-001 before making changes
- [ ] Only affected sections are modified — not a full regeneration
- [ ] Change Log updated: "CR-001 — Removed React Native; updated Sections 5, 14, 16 — [date]"
- [ ] Skill does NOT remove sections not touched by the change request
- [ ] Gate 1 status set to PENDING (change request re-validation required)
