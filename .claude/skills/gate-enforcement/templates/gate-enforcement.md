# Gate Enforcement Logic

> **Purpose**: Define quality gates and enforcement rules between skills
> **Audience**: AI agents during phase transitions
> **When**: Before proceeding to next skill

---

## Gate Overview

```
Gate = Checkpoint that MUST pass before moving forward
```

| Gate ID | Name | After | Before | Type |
|---------|------|-------|--------|------|
| G0 | Project Init | - | PRD | AI |
| G1C | PRD Approval | PRD | FRD | User |
| G2D | FRD Approval | FRD | Design/Dev | User |
| G2E | Milestone Approval | Milestones | Design | User |
| G3A | Design Draft | Wireframes | Detailed | AI |
| G3C | Design Approval | Design | Dev | User |
| G4A | Feature Complete | Dev per feature | QA | AI |
| G4D | Milestone Complete | All features | Next MS | User |
| G5A | Staging Deploy | Build | Staging | AI |
| G5D | Production Deploy | Staging | Prod | User |

---

## Gate Rules

### Rule 1: No Skipping

> [!CRITICAL]
> Gates CANNOT be skipped. All criteria must be met.

### Rule 2: User Gates Block

User gates require explicit approval:
- "Approved"
- "LGTM"
- "Proceed"

### Rule 3: AI Gates Self-Verify

AI gates check automatically:
- Files exist
- Schema valid
- No errors

---

## Gate Checklists

### G0: Project Initialization

```markdown
- [ ] `AI_DOCS/requirements/` contains at least one source, or user provided requirements in chat
- [ ] `AI_DOCS/memory/task.md` created
- [ ] `AI_DOCS/memory/implementation-plan.md` created
- [ ] Technology selection completed
```

### G1C: PRD Approval

```markdown
- [ ] `AI_DOCS/planning/prd.md` exists
- [ ] Requirement alignment check passed
- [ ] Gap analysis passed
- [ ] User explicitly approved PRD
```

### G2D: FRD Approval

```markdown
- [ ] `AI_DOCS/planning/frd.md` exists
- [ ] PRD alignment check passed
- [ ] FRD gap analysis passed
- [ ] All FR-IDs assigned
- [ ] User explicitly approved FRD
```

### G2E: Milestone Approval

```markdown
- [ ] `AI_DOCS/planning/milestone-plan.md` exists
- [ ] Dependency graph created
- [ ] User approved milestone order
```

### G3C: Design Approval

```markdown
- [ ] Design specs exist for current milestone
- [ ] All screens have mockups
- [ ] User approved design for milestone
```

### G4A: Feature Complete

```markdown
- [ ] Code implements FR-ID
- [ ] Tests written and passing
- [ ] No lint errors
- [ ] Code matches design spec
```

### G4D: Milestone Complete

```markdown
- [ ] All features in milestone complete (G4A)
- [ ] Integration tests passing
- [ ] User approved milestone
```

---

## Enforcement Actions

### When Gate Fails

| Action | Description |
|--------|-------------|
| **STOP** | Do not proceed to next skill |
| **REPORT** | List failing criteria clearly |
| **SUGGEST** | Propose how to fix |
| **WAIT** | Pause for user input |

### Recovery Options

1. **Fix and Retry**: Address failing criteria
2. **User Override**: User explicitly approves despite warnings
3. **Scope Reduction**: Remove blocking items

---

## Gate Status Tracking

Update `AI_DOCS/memory/gate-status.md`:

```markdown
# Gate Status

| Gate | Status | Date | Notes |
|------|--------|------|-------|
| G0 | ✅ PASSED | 2026-02-05 | Init complete |
| G1C | ✅ PASSED | 2026-02-05 | PRD approved |
| G2D | ⏳ PENDING | - | Awaiting FRD review |
```

---

## Quick Reference

| Scenario | Gate | Who |
|----------|------|-----|
| Ready to create FRD | G1C | User |
| Ready to design | G2D + G2E | User |
| Ready to code | G3C | User |
| Feature done | G4A | AI |
| Milestone done | G4D | User |
| Ready to deploy | G5A + G5D | User |

---

*Part of AI_SKILLS Framework v2.0*
*Last Updated: 2026-02-05*
