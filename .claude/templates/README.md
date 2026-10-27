# Templates

> The minimal templates `/plan` copies into a fresh project's `AI_DOCS/` tree.
> One single flow. No `lean` vs `heavy` modes.

| Source (here)            | Destination (project)                          | Owner of updates                          |
|--------------------------|------------------------------------------------|-------------------------------------------|
| `intent.md`              | `AI_DOCS/memory/project-context.md`            | `/plan`, `/ask` (rare)                    |
| `stack.md`               | `AI_DOCS/memory/stack.md`                      | `/plan`, `/do switch-stack`               |
| `api-contract.md`        | `AI_DOCS/architecture/api-contract.md`         | `/plan`, `/change-request` (post-Gate-1)  |
| `database-schema.md`     | `AI_DOCS/architecture/database-schema.md`      | `/plan`, `/build`                         |
| `task-ledger.md`         | `AI_DOCS/memory/task-ledger.md`                | `/plan` (seed), `/do` (per milestone)     |
| `decision-log.md`        | `AI_DOCS/memory/decision-log.md`               | every skill on a project-spanning choice  |
| `active-skills.md`       | `AI_DOCS/memory/active-skills.md`              | `/plan`, `/do switch-stack`               |
| `milestone-capsule.md`   | `AI_DOCS/milestones/M<NN>-<slug>/{capsule,tasks,decisions,spec,api}.md` | `/plan` (seeds), `/do`, `/build` |
| `app-shell-decisions.md` | `AI_DOCS/design/app-shell-decisions.md`        | `principal-designer` / `/do` Phase 1 Stage 0 (format template, not a `/plan` scaffold) |
| `design-standards-checklist.md` | `AI_DOCS/design/design-standards-checklist.md` | `design-tokens` / `design-discovery` scaffolds at Gate 3 (seed set fixed, project rows appended below it) |
| `worktreeinclude.template` | `.worktreeinclude` (project root)            | operator (lists local files, e.g. `.env`, `.env.local`, copied into every `isolation: worktree` run) |
| `control-registry.md`    | `AI_DOCS/quality/control-registry.md`          | `setup.sh` / `upgrade.sh` seed it when absent, then the project records its own proof dates (reconciled by `hooks/drift-detector.sh` Phase I) |
| `authz-matrix.yaml`      | format reference for the project's authz matrix | `authz-matrix` skill (cell meanings and layout) |
| `ux-brief.md`            | `AI_DOCS/design/ux-brief.md`                   | `ux-foundation` skill (Gate UX-0) |
| `shared-conventions.md`  | `~/.adf/shared/conventions.md` (outside the project) | `setup.sh` seeds it when absent |
| `framework-feedback.md`  | `AI_DOCS/quality/framework-feedback.md`        | `retrospective` writes generalized candidates, the `learning-curator` agent reads them (`rules/self-improvement-rules.md`) |
| `mavs-report.json`       | format reference for `AI_DOCS/quality/mavs/<validator>.json` | each validator skill (schema: `docs/mavs-report-schema.md`) |

## Contract
- Each file is intentionally small. Skills fail noisily if a file balloons (e.g., `project-context.md > 200` lines is a smell — promote sections out into `planning/spec/<section>.md`).
- Schema is by convention: each template's section headings are stable; skills parse with simple grep, not full markdown parsing.
- Specialist artifacts (PRD, FRD, full tech-spec, etc.) live in `AI_DOCS/planning/` and `AI_DOCS/design/`. They reference these canonical files; they don't replace them.

## Deprecated paths (do NOT create)

| Old path                              | Replacement                                                    |
|---------------------------------------|----------------------------------------------------------------|
| `AI_DOCS/memory/.adf-mode`            | (deleted — there are no modes)                                 |
| `AI_DOCS/architecture/api.md`         | `AI_DOCS/architecture/api-contract.md`                         |
| `AI_DOCS/memory/task.md`              | per-milestone `tasks.md` inside `AI_DOCS/milestones/M<NN>-<slug>/` |
| `AI_DOCS/planning/tasks/INDEX.md`     | `AI_DOCS/memory/task-ledger.md` + capsule pointers             |

`/plan --migrate` renames legacy projects automatically.
