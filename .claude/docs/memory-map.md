# ADF memory and file map

> Full reference for every AI_DOCS path. Loaded on demand: `.claude/CLAUDE.md` Section 4 keeps only the essentials.

Single schema: no `lean` vs `heavy` files anymore. Every skill reads/writes these exact paths.

**One AI_DOCS, at the project root.** There is exactly one `AI_DOCS/` directory and it lives at the project root. Never create a second `AI_DOCS/` inside a subfolder of the application code. All paths below are relative to that single root `AI_DOCS/`. Subdirectories like `milestones/` and `planning/` are folders INSIDE it, not separate AI_DOCS roots. The `hooks/enforce-single-aidocs.sh` PreToolUse hook enforces this (Section 7).

### Global (`AI_DOCS/memory/`)
- `project-context.md`: identity, stack, active milestone pointer, gate summary, project overrides.
- `session-state.md`: active milestone, active task, last decision, next action. Update before every compaction.
- `task-ledger.md`: one-line-per-milestone summary (Status, % done, exit gate verdict).
- `decision-log.md`: project-spanning decisions only. Append-only.
- `gate-status.md`: gate verdicts (PENDING/PASSED/FAILED, plus LOCKED for api-contract) with date.
- `stack.md`: tech stack details.
- `../review-mode.txt` (at `AI_DOCS/review-mode.txt`, not in `memory/`): gate strictness for triggered gates: `full` / `lean` (default) / `solo`. Scaffolded with `lean`; if missing, `gate-enforcement` defaults to `full`.
- `active-skills.md`: whitelist of skills enabled for this project. `/do` enforces.
- `user-prompts.log`: auto-appended by hook. Don't edit.
- `compaction-snapshot.md`: auto-written by `pre-compact.sh`. Don't edit.

### Per-milestone (`AI_DOCS/milestones/M<NN>-<slug>/`)
- `capsule.md`: purpose, scope, exit criteria, active task pointer.
- `tasks.md`: full task table for THIS milestone (ID, title, acceptance, status, blockedBy, verify-stamp, notes).
- `decisions.md`: milestone-local decisions.
- `spec.md`: spec slice for this milestone (or pointers to `architecture/api-contract.md` rows + `plans/spec/<section>.md`).
- `api.md`: API endpoints introduced/modified in this milestone (references to `architecture/api-contract.md`).

### Architecture (`AI_DOCS/architecture/`)
- `api-contract.md`: single source of truth for ALL endpoints. Locked after Gate 1 (PreToolUse hook enforces).
- `database-schema.md`: DB schema.

### Requirements (`AI_DOCS/requirements/`)
- The single canonical home for **raw client source material**: PDFs, Word documents, design exports, images, transcripts, and pasted briefs saved as `.md`. Raw sources are never edited, only ingested.
- A legacy root-level `requirement.md` is deprecated: skills move it into `AI_DOCS/requirements/` on first contact and log the move in `decision-log.md`.
- `requirement-finalization` reconciles every source in this folder into `AI_DOCS/planning/requirements-baseline.md` (statements with source refs, conflict register, decision log, open items). When more than one source exists, run it before `/workscope`.

### Ingested files (`AI_DOCS/ingested/`)
- `AI_DOCS/ingested/<type>/<basename>.md`: Markdown produced by the `markitdown` skill from any supported file/URL (`<type>` ∈ pdf/docx/pptx/xlsx/image/audio/html/data/zip/youtube/epub).
- `AI_DOCS/ingested/manifest.md`: one row per ingested source (source, type, .md path, timestamp, coverage).
- **Complete-reading rule**: a source is read only when `markitdown`'s `verify_coverage.py` reports `COVERAGE: COMPLETE`. Plain conversion silently drops the text inside pictures, shape-diagram relationships, scanned pages, and document headers, so every flagged picture, chart, diagram and scanned page goes through the model visual pass first. An INCOMPLETE source is reported with its gap list, never reasoned over as if whole.
- The relationship: `requirements/` holds originals in, `ingested/` holds conversions out, the manifest joins the two.
- **Ingestion-first rule**: when the user supplies a supported document/binary file or URL, save client requirement material into `AI_DOCS/requirements/` first, then ingest it via the `markitdown` skill; downstream skills read the resulting `AI_DOCS/ingested/...md` (or the requirements baseline), never the raw binary. The `pdf`/`docx`/`xlsx`/`pptx` skills keep their native libraries only for format operations (create/edit/merge/tables/OCR-control/formulas).

### Plans, design, quality, audit, deployment
- `AI_DOCS/planning/requirements-baseline.md`: finalized requirements reconciled from every source in `AI_DOCS/requirements/` (written by `requirement-finalization`, read by `workscope`, `tech-specification`, `estimation`, `prd-generation`, `project-brief`).
- `AI_DOCS/planning/project-brief.md`: short complexity brief, client or team variant (written by `project-brief`).
- `AI_DOCS/planning/spec/<section>.md`, `AI_DOCS/planning/tasks/active/<slug>/{plan.md,chunk-NN-*.md,context.md}`.
- `AI_DOCS/quality/drift-report.md`: written by `drift-detector.sh` on each 24h scan.
- `AI_DOCS/quality/defect-log.md`: one row per defect found after its task was DONE (review REJECT, regression, QA, audit, production). Source of the escaped-defect rate (target <1%). Written by `/do`, `/debugger`, `/qa-testing`. Read by `/retrospective` (mandatory prevention loop), `/milestone-validation`, Gate 5.
- `AI_DOCS/design/{design-dna.md, component-registry.md, screens/, ux-flows/}`.
- `AI_DOCS/audit/audit-report.md`, `AI_DOCS/audit/agent-log.md`.
- `AI_DOCS/deployment/{RUNBOOK_<ver>.md, DEPLOYMENT_LOG_<ver>.md}`.
- `AI_DOCS/.temp/`: gitignored per-project scratch directory for framework scripts (unpacked XML trees, intermediate PDFs/images, generated helper scripts). Safe to delete at any time, never a source of truth.

**Removed (deprecated)**: `.adf-mode`, `memory/task.md`, `memory/INDEX.md`, `architecture/api.md`, `AI_DOCS/plans/` (canonical path is `AI_DOCS/planning/`), root `requirement.md` (moved into `AI_DOCS/requirements/`), `AI_DOCS/planning/requirement.md` as a raw-source copy (raw sources live in `AI_DOCS/requirements/`). The `/plan --migrate` command renames legacy projects automatically.

## Additional files (from the project template)

| File | Purpose |
|------|---------|
| `AI_DOCS/memory/session-state.md` | Active task, phase, gate status: write before compacting |
| `AI_DOCS/memory/task-ledger.md` | **v3.7**: unified Request / Plan / Status / Next action for current task. Active block placed FIRST in compaction snapshot. Auto-managed via `hooks/ledger-writer.sh`. |
| `AI_DOCS/memory/compaction-snapshot.md` | Auto-written by `pre-compact.sh` on every compaction: audit copy of what was injected into the compacted context |
| `AI_DOCS/memory/user-prompts.log` | **v3.3**: auto-written by `user-prompt-log.sh`. Append-only log of every user prompt (scrubbed). Last 3 tailed into compaction snapshot. |
| `AI_DOCS/memory/decision-log.md` | Every choice with rationale. Append whenever the user states a preference or makes a choice in chat: last 5 tailed into compaction snapshot. |
| `AI_DOCS/memory/gate-status.md` | All gate verdicts with dates |
| `AI_DOCS/memory/ai-cost-approvals.md` | Written approvals for LLM integrations |
| `AI_DOCS/memory/security-findings.md` | Security findings from `/team-security` runs |
| `AI_DOCS/review-mode.txt` | Gate strictness for triggered gates: full / lean (default) / solo |
| `AI_DOCS/audit/agent-log.md` | Agent invocation audit trail (auto-written by hooks) |
| `AI_DOCS/planning/` | All planning artifacts: spec sections, task plan files, chunk files |
| `AI_DOCS/quality/drift-report.md` | Written by `drift-detector.sh`: code-vs-docs drift findings (24h scan) |
| `AI_DOCS/memory/project-context.md` | Identity, stack, active milestone; **v4.5** adds `sdlc_methodology`, `branching_strategy`, `platform_targets` |
| `AI_DOCS/planning/dependency-graph.md` | **v4.5**: entity + feature dependency graph; producers precede consumers (data-dependency milestone ordering) |
| `AI_DOCS/deployment/git-strategy.md` | **v4.5**: chosen branching/promotion model + per-milestone promotion decisions (read by `github-ops`) |
| `AI_DOCS/quality/test-fixtures.md` | **v4.5**: seed test users (per role) + mock-service config + reset endpoint; read by `e2e-testing` |
| `AI_DOCS/quality/e2e-suite.md` + `e2e-result.md` | **v4.5**: milestone critical-flow list + E2E result record (the merge gate parses `mavs/e2e.json` through `hooks/mavs-gate.sh`) |
| `AI_DOCS/design/design-directions/` + `ux-recommendations.md` | **v4.5**: 2-3 live HTML mockups + chosen direction + Recommended-vs-Current UX gaps |
| `AI_DOCS/design/flow-validation-plan.md` + `AI_DOCS/design/flows/**` | Gate FLOW's source of truth: per-flow tier/status/chosen-variant plus the clickable journey-prototype variants and `chosen.md` (owner `flow-prototypes`) |
| `AI_DOCS/.temp/` | Gitignored per-project scratch directory for framework scripts (unpacked XML trees, intermediate PDFs/images, generated helper scripts). Safe to delete at any time, never a source of truth. |
