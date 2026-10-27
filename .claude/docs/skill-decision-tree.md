# Skill Decision Tree

When-to-use matrix for skills with overlapping scope. Resolves router ambiguity.

## Project initialization & assessment

```
User says "new project" / "start project" / "initialize"
  → /session-management       (scaffolds AI_DOCS/, CLAUDE.md, settings.json)

User says "where am I" / "what phase" / "status"
  → /project-stage-detect      (reads AI_DOCS/memory/; suggests next skill)

User says "health check" / "audit" / "quality review of whole codebase"
  → /project-audit             (full codebase health check)

User says "what kind of project" / "POC or production" / "classify"
  → /project-types             (classifies project; informs rule-loading)
```

## Requirements gathering

```
User says "explore business idea" / "should we build this" / "MVP prioritization"
  → /brainstorm                (pre-workscope ideation; business model, users)

User says "finalize requirements" / "the client docs disagree" / "requirements baseline"
  → /requirement-finalization  (reconcile AI_DOCS/requirements/ sources into one baseline)

User says "scope" / "user stories" / "acceptance criteria"
  → /workscope                 (functional scope definition)

User says "project brief" / "summary for the client" / "explain the complexity"
  → /project-brief             (short complexity brief, client or team variant)

User says "product requirements" / "PRD" / "product vision"
  → /prd-generation            (product manager-facing PRD)

User says "functional requirements" / "FRD" / "feature spec"
  → /prd-generation            (engineer-facing FRD)
```

## Architecture & design

```
User says "architecture" / "system design" / "ADR" / "tech stack choice"
  → /architecture              (ADRs, high-level decisions)

User says "tech spec" / "technical specification" / "API design"
  → /tech-specification        (10-section spec; locks api-contract.md)

User says "design system" / "tokens" / "brand" / "UI baseline"
  → Check phase:
      Discovery/brand-stage   → /design-discovery
      Token-definition stage  → /design-tokens
      Screen composition      → /design-screens
  (a generic "design system" request routes automatically via the phase check above; see docs/skill-deprecations.md for the historical split)

User says "research competitor UIs" / "reference products"
  → /design-discovery

User says "prototype this journey" / "clickable flow variants" / "triage the flows" / "Gate FLOW"
  → /flow-prototypes           (pre-implementation journey validation, owns Gate FLOW per Tier F flow)

User says "user journey" / "UX flow"
  → Check intent:
      Pre-implementation validation (click it before build)  → /flow-prototypes
      Screen composition / screen inventory                  → /design-screens
```

## Planning & execution

```
User says "plan milestone" / "break down release" / "sprint estimation"
  → /milestone-planning

User says "break down a task" / "implementation plan for X"
  → /task-planner              (universal task intake, detailed)

User says "build feature" / "end-to-end delivery of X"
  → /do                        (Phase 1 lead dispatch: scope → arch → impl → QA)

User says "release" / "ship milestone" / "go live"
  → /do                        (Phase 3 plus gate-enforcement Gate 5: readiness → QA → security → deploy)

User says "run X then Y" / "parallel checks"
  → /orchestrator is META, not user-facing. Invoke /do.

User says "deliver this feature that's already planned"
  → /feature-delivery
```

## Implementation

```
User says "implement" / "write code for" / "build this"
  → /build        (generic; per-phase orientation)

For platform-specific depth (routes by the codebase ALREADY chosen, this is NOT a stack
recommendation: stack choice is made requirement-first per rules/tech-stack-selection-rules.md):
  React codebase               → /reactjs
  Next.js codebase             → /nextjs
  Python backend               → /build (fastapi-specialist agent for architecture)
  Python AI services           → /python-ai-services
  shadcn/ui components         → /shadcn-ui
  Other stacks (Angular, Vue,
  Flutter, NestJS, FastAPI,
  Node, React Native)          → the matching specialist agent
                                 (angular-specialist, vue-specialist, flutter-specialist,
                                  nestjs-specialist, fastapi-specialist, etc.)
```

## Quality & testing

```
User says "code quality check" / "SonarQube simulation" / "static analysis"
  → /code-quality              (17-point checklist; style + bugs + complexity)

User says "security review" / "OWASP" / "secrets scan" / "threat model"
  → /audit           (OWASP Top 10 + secrets)

User says "accessibility" / "WCAG" / "a11y audit"
  → /accessibility-audit       (dedicated WCAG 2.1 AA pass)

User says "write tests" / "test coverage" / "add integration tests"
  → /qa-testing                (unit + integration + E2E)

User says "load test" / "performance test"
  → /performance-testing (v3.2 backlog)

User says "debug" / "why is this failing" / "error reproduction"
  → /debugger

User says "polish the UI" / "fix the design" / "UI critique" / "UI technical audit" / "impeccable audit"
  → /do            (dispatches the vendored impeccable modes: polish, harden, detect, document)
```

### Impeccable vs /audit vs the design verdict (boundary)

A UI design fix, polish pass, critique, or UI technical audit routes through /do,
which dispatches the vendored `impeccable` skill's modes per the Activation Map.
The security and pre-ship audit stays `/audit` (an "impeccable audit" is a UI
technical audit, never a security audit). Design VERDICTS stay with
`principal-designer` and the DSC visual lane (`mavs/visual.json`): impeccable is
the fix engine and the mechanical detect lane (`mavs/slop.json`), never the
verdict of record.

### /code-quality vs /audit vs /qa-testing (boundary)

| Concern | Skill |
|---|---|
| Style, complexity, duplicates, naming | /code-quality |
| OWASP, secrets, auth, injection | /audit |
| Unit/integration/E2E test authoring | /qa-testing |
| WCAG 2.1 AA, screen readers, keyboard nav | /accessibility-audit |

Running all four = `/milestone-validation` at milestone close.

## Deployment & release

```
User says "prepare deployment" / "runbook" / "deploy plan"
  → /deployment-planning       (async: write runbook for later execution)

User says "execute deploy" / "ship it now" / "rollback"
  → /deployment-execution      (runtime-dependent operations)

User says "GitHub release" / "SemVer tag" / "branch strategy"
  → /github-ops
```

## Retrospective & learning

```
User says "what went well" / "postmortem" / "lessons learned"
  → /retrospective             (closes learning loop; feeds next /brainstorm)
```

## Meta & tooling

```
User says "create a new skill" / "author skill" / "scaffold skill"
  → /skill-authoring           (framework-aware skill-creator)

User says "test my skill" / "validate SKILL.md"
  → /skill-test

User says "improve my skill" / "fix skill that's broken"
  → /skill-improve

User says "which skill to use" / "route this request"
  → /skill-router (usually invoked implicitly, not by user)
```

## Router precedence

When multiple skills match:

1. Exact trigger-phrase match in `trigger:` block wins over fuzzy match
2. Phase-specific skills (design-tokens when in the token-definition stage) win over a generic "design system" phrase (resolved via the Discovery/Tokens/Screens split above)
3. User-facing skills (/do, team-security) win over meta (orchestrator)
4. For the team-security orchestrator, the more specific security trigger wins over a generic /do request

## Testing the tree (when Layer 6 is authorized)

Every trigger phrase above becomes a Layer 6a trigger-stability test. Regressions (a phrase that newly matches the wrong skill) block the merge.
