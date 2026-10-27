# task.md - AI Execution Checklist Template

> **Purpose**: This template defines the structure for `AI_DOCS/task.md` - the file that tells AI WHAT to do next and in WHAT sequence.
> **Location**: Created as `AI_DOCS/task.md` during project initialization
> **Companion**: `AI_DOCS/implementation-plan.md` (context and file references)

---

## Document Metadata
| Key | Value |
|-----|-------|
| **Version** | 1.0.0 |
| **Created** | [ISO Date] |
| **Last Updated** | [ISO Date] |
| **Status** | [Active / Paused / Complete] |

---

## 🎯 Current Focus

> [!TIP]
> **AI**: This section tells you exactly where to resume work.

### Active Milestone: M[#] - [Name]
### Active Task: T-M#-## - [Name]
### Current Phase: [Design / Backend / Frontend / QA]

---

## 📋 Stage Execution Checklist

> [!IMPORTANT]
> **AI**: Follow this checklist in sequence. Check items as you complete them.

### Stage 0: Project Initialization
- [ ] Read the sources in `AI_DOCS/requirements/` (moving a legacy root `requirement.md` there first, logged) or user requirements
- [ ] Create `AI_DOCS/task.md` (this file)
- [ ] Create `AI_DOCS/implementation-plan.md`
- [ ] Run Technology Selection Wizard (technology-standards.md Section 0)
- [ ] User selected technology options

### Stage 1: PRD
- [ ] Create `AI_DOCS/planning/prd.md` using `prd-generation` skill
- [ ] Run Requirement Alignment Check → `requirement-alignment-check`
- [ ] Run Gap Analysis → `prd-gap-analysis`
- [ ] User approved PRD (Gate 1C)

### Stage 2: FRD
- [ ] Create `AI_DOCS/planning/frd.md` using `prd-generation` skill
- [ ] Run PRD Alignment Check → `prd-alignment-check`
- [ ] Run Gap Analysis → `frd-gap-analysis`
- [ ] User approved FRD (Gate 2D)

### Stage 2.5: Milestone Planning
- [ ] Run Dynamic Milestone Discovery (prd-generation Phase 6.5)
- [ ] Present dependency graph to user
- [ ] Create `AI_DOCS/planning/milestone-plan.md`
- [ ] User approved Milestone Plan (Gate 2E)

### Stage 3: Design (Per Milestone)

#### Milestone 0: Project Setup
| Task | 01_Design.md | User Approved |
|------|--------------|---------------|
| T-M0-01: [Task Name] | [ ] | [ ] |

#### Milestone 1: Authentication
| Task | 01_Design.md | User Approved |
|------|--------------|---------------|
| T-M1-01: [Task Name] | [ ] | [ ] |
| T-M1-02: [Task Name] | [ ] | [ ] |

#### Milestone 2: [Key Component]
| Task | 01_Design.md | User Approved |
|------|--------------|---------------|
| T-M2-01: [Task Name] | [ ] | [ ] |

### Stage 4: Development (Per Milestone)

#### Milestone 0: Project Setup
| Task | 02_Backend | 03_Frontend | 04_QA | 05_Seed | Complete |
|------|------------|-------------|-------|---------|----------|
| T-M0-01 | [ ] | [ ] | [ ] | [ ] | [ ] |

#### Milestone 1: Authentication
| Task | 02_Backend | 03_Frontend | 04_QA | 05_Seed | Complete |
|------|------------|-------------|-------|---------|----------|
| T-M1-01 | [ ] | [ ] | [ ] | [ ] | [ ] |
| T-M1-02 | [ ] | [ ] | [ ] | [ ] | [ ] |

#### Milestone 2: [Key Component]
| Task | 02_Backend | 03_Frontend | 04_QA | 05_Seed | Complete |
|------|------------|-------------|-------|---------|----------|
| T-M2-01 | [ ] | [ ] | [ ] | [ ] | [ ] |

### Stage 5: Deployment
- [ ] Pre-deployment checklist (Gate 5A)
- [ ] Staging deployment
- [ ] Post-deployment monitoring (Gate 5C)
- [ ] Production deployment
- [ ] Production sign-off (Gate 5D)

---

## 🔄 Next Action

> [!CRITICAL]
> **AI: Execute this next**

| Attribute | Value |
|-----------|-------|
| **Task** | T-M#-## |
| **Phase** | [Design / Backend / Frontend / QA] |
| **Action** | [Specific action to take] |
| **File to Create/Modify** | [Path] |
| **Reference** | [Link to design file or FRD requirement] |

---

## 📝 Session Log (Latest 10)

> Track AI actions across sessions for continuity.

| Timestamp | Session | Action | Outcome |
|-----------|---------|--------|---------|
| [ISO] | [Session ID or "New"] | [What was done] | [Result: ✅/❌] |

---

## ⚠️ Blockers

> [!CAUTION]
> **Items blocking progress. Must be resolved before continuing.**

| ID | Blocker | Status | Resolution |
|----|---------|--------|------------|
| B-001 | [Blocker description] | 🔴 Open | [Pending user input / needs research] |

---

## 🔁 Session Restore Protocol

> [!TIP]
> **AI**: When starting a new session, follow these steps:

1. **Read this file** - Check "Current Focus" section
2. **Read implementation-plan.md** - Get context and file references
3. **Check "Next Action"** - See exactly what to do next
4. **Check "Blockers"** - Ensure no blockers prevent progress
5. **Resume work** - Continue from Next Action
6. **Update this file** - After completing any task

---

## 📊 Progress Summary

| Stage | Progress | Notes |
|-------|----------|-------|
| PRD | ⬜ Not Started | |
| FRD | ⬜ Not Started | |
| Milestone Plan | ⬜ Not Started | |
| Design | ⬜ 0/0 Tasks | |
| Development | ⬜ 0/0 Tasks | |
| Deployment | ⬜ Not Started | |

---

*Part of AI_PROMPT Framework*
*Template Version: 1.0.0*
