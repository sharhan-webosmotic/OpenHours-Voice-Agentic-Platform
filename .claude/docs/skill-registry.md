# Skill Registry

Human-readable ID index (ID → name → category). The authoritative registry is `skill-lab/catalog.yaml`: this file is the readable index and may lag it. Generated during Wave 1 compliance retrofit.

## ID range allocation

| Range | Category |
|---|---|
| SK-001 – SK-020 |
| SK-021 – SK-040 |
| SK-041 – SK-060 |
| SK-061 – SK-080 |
| SK-081 – SK-100 |
| SK-101 – SK-120 |

## v3.1.0 registry (post-retrofit)

**Note:** This registry reflects target IDs after the Issue 8 collision fix. The per-SKILL.md frontmatter retrofit script applies these IDs atomically during Wave 1.

### Core SDLC (SK-001 – SK-020)

| ID | Skill | Category | Pattern |
|---|---|---|---|
| SK-001 | session-management | sdlc | sequential |
| SK-002 | prd-generation | sdlc | context-aware |
| SK-003 | prd-generation | sdlc | context-aware |
| SK-004 | design-discovery (from split) | sdlc | context-aware |
| SK-005 | build | sdlc | sequential |
| SK-006 | guardrails | sdlc | domain-specific |
| SK-007 | qa-testing | sdlc | domain-specific |
| SK-008 | deployment-planning (was deployment) | sdlc | sequential |
| SK-009 | audit | sdlc | domain-specific |
| SK-010 | change-request | sdlc | context-aware |
| SK-011 | mock-data | sdlc | domain-specific |
| SK-012 | project-types | sdlc | context-aware |
| SK-013 | retrospective (new) | sdlc | iterative |
| SK-014 | accessibility-audit (new) | sdlc | domain-specific |
| SK-015 | milestone-validation (new) | sdlc | sequential |
| SK-016 | skill-authoring (new) | sdlc | iterative |
| SK-168 | flow-prototypes (new, Gate FLOW) | sdlc | domain-specific |

### Platform-specific (SK-021 – SK-040)

| ID | Skill | Category | Pattern |
|---|---|---|---|
| SK-021 | github-ops | platform | domain-specific |
| SK-022 | data-migration | platform | domain-specific |
| SK-023 | mcp-connector | platform | multi-mcp |
| SK-024 | gate-enforcement | platform | context-aware |
| SK-031 | caching-strategy | platform | domain-specific |
| SK-033 | seo | platform | domain-specific |
| SK-034 | i18n | platform | domain-specific |
| SK-105 | image-generation | platform | domain-specific |
| SK-102 | nextjs | platform | domain-specific |
| SK-103 | shadcn-ui | platform | domain-specific |
| SK-108 | xlsx | platform | domain-specific |
| SK-104 | e2e-testing | platform | domain-specific |

### Infrastructure (SK-041 – SK-060)

| ID | Skill | Category | Pattern |
|---|---|---|---|
| SK-041 | debugger | infrastructure | domain-specific |
| SK-042 | audit-logs | infrastructure | domain-specific |
| SK-043 | analytics | infrastructure | multi-mcp |
| SK-040 | error-handling | infrastructure | domain-specific |
| SK-045 | deployment-execution (new, from split) | infrastructure | sequential |
| SK-046 | design-tokens (new, from split) | infrastructure | domain-specific |
| SK-047 | design-screens (new, from split) | infrastructure | domain-specific |
| SK-147 | docx | document | domain-specific |
| SK-051 | image-assets | infrastructure | domain-specific |
| SK-048 | pdf | document | domain-specific |
| SK-053 | codebase-migration | infrastructure | context-aware |
| SK-106 | markdown-creator (new) | document | domain-specific |
| SK-143 | docx-from-markdown (v4.0.1) | infrastructure | domain-specific |
| SK-049 | markitdown (v4.1.0) | document | domain-specific |
| SK-165 | assessment-package (new) | document | sequential |
| SK-166 | client-report-editing (new) | document | domain-specific |

### Optimization & cross-cutting (SK-061 – SK-080)

| ID | Skill | Category | Pattern |
|---|---|---|---|
| SK-044 | mock-api-server | utility | domain-specific |
| SK-070 | tech-specification | cross-cutting | context-aware |
| SK-071 | code-quality | cross-cutting | iterative |
| SK-072 | workscope | cross-cutting | context-aware |
| SK-167 | code-quality-report (new) | cross-cutting | sequential |

### Utility & meta (SK-081 – SK-100)

| ID | Skill | Category | Pattern |
|---|---|---|---|
| SK-020 | architecture | utility | domain-specific |
| SK-107 | pptx | document | domain-specific |
| SK-060 | milestone-planning | utility | context-aware |
| SK-080 | project-context (renamed from claude-md) | utility | context-aware |
| SK-081 | project-audit | utility | domain-specific |
| SK-082 | python-backend | platform | REMOVED v4.11.0 (deprecated -> deleted; use build + fastapi-specialist) |
| SK-083 | python-ai-services | platform | domain-specific |
| SK-084 | python-testing | platform | domain-specific |
| SK-085 | python-deployment | platform | domain-specific |
| SK-159 | go-backend | platform | REMOVED v4.11.0 (deprecated -> deleted; use build + go-specialist) |
| SK-160 | go-testing | platform | domain-specific |
| SK-161 | go-deployment | platform | domain-specific |
| SK-162 | estimation | core | domain-specific |
| SK-163 | requirement-finalization | core | sequential |
| SK-164 | project-brief | sdlc | context-aware |
| SK-086 | skill-router | meta | context-aware |
| SK-087 | reactjs | platform | domain-specific |
| SK-090 | orchestrator (meta, not user-facing) | meta | sequential |
| SK-091 | project-kickoff | meta | REMOVED v4.32.0 (merged into session-management, Triage Routing section) |
| SK-092 | project-stage-detect | meta | context-aware |
| SK-093 | skill-test | meta | domain-specific |
| SK-094 | skill-improve | meta | domain-specific |
| SK-095 | ai-cost-guard | meta | domain-specific |
| SK-096 | brainstorm | meta | context-aware |
| SK-000 | memory-protocol | meta | context-aware |
| SK-097 | feature-delivery (was SK-092) | utility | sequential |
| SK-098 | task-planner (was SK-090) | utility | sequential |
| SK-099 | team-security (was SK-090) | orchestration | sequential |

### Team orchestration (SK-101 – SK-120)

| ID | Skill | Category | Pattern |
|---|---|---|---|
| SK-088 | team-feature | orchestration | REMOVED v4.32.0 (use /do Phase 1 lead dispatch) |
| SK-089 | team-release | orchestration | REMOVED v4.32.0 (use /do Phase 3 plus gate-enforcement Gate 5) |
| SK-101 | team-design (was SK-091) | orchestration | REMOVED v4.32.0 (use /do Phase 1 lead dispatch) |

### Orchestrator & core lifecycle (SK-100, SK-130 – SK-134)

| ID | Skill | Category | Pattern |
|---|---|---|---|
| SK-100 | do | meta | sequential |
| SK-130 | ask | meta | context-aware |
| SK-131 | build | core | sequential |
| SK-132 | audit | core | domain-specific |
| SK-133 | ship | core | sequential |
| SK-134 | plan | core | context-aware |

### Platform extensions (SK-135 – SK-148)

| ID | Skill | Category | Pattern |
|---|---|---|---|
| SK-135 | schedule | utility | domain-specific |
| SK-136 | install-plugin (install and list modes) | meta | domain-specific |
| SK-137 | list-plugins | meta | REMOVED v4.32.0 (merged into install-plugin, list mode) |
| SK-138 | skill-curator | framework | domain-specific |
| SK-139 | share-decision (share and import modes) | utility | domain-specific |
| SK-140 | import-conventions | utility | REMOVED v4.32.0 (merged into share-decision, import mode) |
| SK-141 | history-query | utility | domain-specific |
| SK-144 | infra-planning | core | context-aware |
| SK-146 | infra-cost-guard | utility | domain-specific |
| SK-148 | skill-router | meta | context-aware |

### v4.5 to v4.9 additions (SK-149 to SK-158)

| ID | Skill | Category | Pattern |
|---|---|---|---|
| SK-149 | design-direction | core | context-aware |
| SK-151 | landing-page | core | context-aware |
| SK-152 | ux-foundation | sdlc | sequential |
| SK-153 | authz-matrix | gate | domain-specific |
| SK-154 | schema-validation | gate | domain-specific |
| SK-155 | api-conformance | gate | domain-specific |
| SK-156 | operations | infrastructure | domain-specific |
| SK-157 | incident-response | reliability | domain-specific |
| SK-158 | ui-review | quality | domain-specific |

## External vendored skills

Skills that live under `.claude/skills/` but are upstream-owned, carry no SK-NNN id, and are deliberately absent from `skill-lab/catalog.yaml`, so `upgrade.sh` treats their directory as EXTERNAL and never mirrors or edits it:

| Skill | Upstream | License | Update path |
|---|---|---|---|
| impeccable | pbakaus/impeccable | Apache 2.0 | `npx impeccable update` |

Never edit these from ADF: an ADF edit would fork the vendor copy and break the upstream update path.

## Short-form aliases

For memorability, some skills have short aliases (in addition to the full SK-NNN ID):

| Alias | SK-NNN | Skill |
|---|---|---|
| SK-102 | SK-102 |
| SK-103 | SK-103 |
| SK-WTEST | SK-104 |
| SK-IMG | SK-105 |
| SK-DOCX | SK-147 |
| SK-PDFF | SK-048 |
| SK-PPTX | SK-107 |
| SK-XLSX | SK-108 |
| SK-DGRM | SK-142 |
| SK-MDWX | SK-143 |

Both forms are valid; `/skill-router` accepts either.

## Validation

The Layer 1 structural test (`skill-lab/validate-framework.sh` when authorized) verifies:

- Every skill has a unique SK-NNN
- Every SK-NNN appears in this registry
- No collisions
- Every alias maps to exactly one SK-NNN

## Update protocol

On every SKILL.md change that alters the `id:` or adds a new skill:

1. Update this file
2. Regenerate `docs/skill-index.json` via `skill-lab/build-index.sh` (when authorized)
3. Bump `metadata.version` on the affected SKILL.md
