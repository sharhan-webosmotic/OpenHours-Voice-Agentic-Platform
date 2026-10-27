# Related Documentation

> Extracted from [SKILL.md](SKILL.md) Section 9, Related Documentation: supporting docs, workflow integration, approval gates, and the FRD handoff.

---

## 9. Related Documentation

> [!IMPORTANT]
> **This prompt is part of the complete AI_PROMPT SDLC framework.**

### 9.1 Supporting Documents

| Document | Purpose |
|----------|----------|
| [output-structure.md](session-management/templates/output-structure.md) | Where to save PRD outputs (AI_DOCS/planning/) |
| [technology-standards.md](session-management/templates/technology-standards.md) | Standards for tech selection and delivery |


### 9.2 Workflow Integration

| Stage | Your Role |
|-------|-----------|
| **Stage 1: PRD** | PRIMARY RESPONSIBILITY - Create comprehensive PRD |
| **Stage 2: FRD** | NO direct involvement (handoff to Business Analyst) |
| **Stage 3: Design** | NO direct involvement (handoff to Designer) |
| **Stage 4: Development** | NO direct involvement (handoff to Developer) |

**See [WORKFLOW_INTEGRATION.md](WORKFLOW_INTEGRATION.md) for complete stage definitions.**

### 9.3 Approval Gates (Stage 1: PRD)

| Gate | Decision Point | Deliverable |
|------|----------------|-------------|
| **Gate 1A: Problem Validation** | Stakeholders approve problem is worth solving | Discovery summary + problem statement |
| **Gate 1B: Solution Approval** | Stakeholders approve recommended solution | Solution options + recommended approach |
| **Gate 1C: PRD Approval** | Stakeholders approve complete PRD | Complete PRD with roadmap |

**See [STAGES_AND_GATES.md](STAGES_AND_GATES.md) for detailed gate criteria and approval process.**

### 9.4 Output to FRD Stage

**FRD creation is built in (Section 10, FRD Mode).** The approved PRD (problem statement, personas, journeys, functional/non-functional requirements, success metrics, prioritized features, roadmap) is the primary input for FRD Mode. The former standalone `frd-generation` skill was merged into this skill on 2026-06-30. See [WORKFLOW_INTEGRATION.md](WORKFLOW_INTEGRATION.md) for complete handoff procedures.

---
