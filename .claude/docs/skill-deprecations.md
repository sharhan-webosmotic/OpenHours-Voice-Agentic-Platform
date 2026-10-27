# Skill Deprecations

Tracks every rename, split, and merge. Router resolves old names to new; emits `skill.deprecated_alias` telemetry event.

## Format

Each entry is a row in the table below. Required fields:

- **Old name** — deprecated skill name as invoked
- **New name(s)** — replacement skill(s)
- **Kind** — `rename` | `split` | `merge`
- **Since** — version introduced
- **Removed** — version where alias resolution stops resolving (`TBD` until committed)
- **Reason** — why the change was made
- **Migration** — one-line guidance for users

## v3.1.0

| Old name | New name(s) | Kind | Since | Removed | Reason | Migration |
|---|---|---|---|---|---|---|
| `claude-md` | `project-context` | rename | 3.1.0 | **3.1.0** (removed) | Anthropic guide forbids skill names with `claude` prefix | Invoke `/project-context`; behavior identical; router resolves old name via this table |
| `deployment` | `deployment-planning` + `deployment-execution` | split | 3.1.0 | **3.1.0** (removed) | 2,800-word body exceeded guide's 5,000-word guideline + combined async planning with runtime-dependent execution | Router routes based on intent: "plan/prepare" → planning; "execute/verify/rollback" → execution |
| `design-system` | `design-discovery` + `design-tokens` + `design-screens` | split | 3.1.0 | **3.1.0** (removed) | 5-gate body was too monolithic; gates benefit from independent invocation | Router routes: gates 1–2 → discovery; gate 3 → tokens; gates 4–5 → screens |
| `orchestrator` (user-facing) | `team-feature` or `team-release` | demotion | 3.1.0 | **3.1.0** (no longer user-facing) | Trigger phrases overlapped with `/team-feature` + `/team-release` causing router ambiguity | Invoke the specific `team-*` skill; `/orchestrator` remains as internal meta primitive |

**Removal note:** In v3.1.0 the old folders are **deleted** (not kept as stubs). Earlier drafts proposed removal in v3.3.0 with a 2-release grace period; user opted to remove immediately since all content was verified copied to new locations and no downstream references depend on the old folder paths.

## v4.9.0 (context-optimization consolidation, 2026-06-30)

Five overlapping skills merged to shrink the always-loaded routing surface. Unique capability (and unique reference files) was folded/relocated into the target first, then the old folders were REMOVED (same as the v3.1.0 removals). The alias table below is what resolves an old-name invocation to its replacement; no stub folders remain. Relocations: `developer-workflow/STRUCTURE.md` → `build/STRUCTURE.md`; `frd-generation/FRD-TEMPLATE.md` + `EXAMPLES.md` → `prd-generation/FRD-TEMPLATE.md` + `FRD-EXAMPLES.md`. The rest was verified already-covered and dropped.

| Old name | New name(s) | Kind | Since | Removed | Reason | Migration |
|---|---|---|---|---|---|---|
| `security-audit` | `audit` | merge | 4.9.0 | TBD | `audit` already consolidates security + secrets + a11y + OWASP; `security-audit` was the redundant direct-Claude duplicate | Invoke `/audit`; router resolves old name. Not to be confused with `deep-security-audit` (SK-169, v4.29.0), the vendored Cloudflare workflow, which is named differently so the old name keeps resolving to `/audit` |
| `developer-workflow` | `build` | merge | 4.9.0 | TBD | Both implement code per request; `build` is the canonical per-task implement-and-verify skill `/do` dispatches | Invoke `/build` (via `/do`); router resolves old name |
| `webapp-testing` | `e2e-testing` | merge | 4.9.0 | TBD | Playwright web path duplicated; visual-regression methodology folded into `e2e-testing` | Invoke `/e2e-testing`; router resolves old name |
| `find-skills` | `skill-router` + `install-plugin` | merge | 4.9.0 | TBD | Discovery role overlaps `skill-router`; installation role belongs to `install-plugin` | "which skill" → `/skill-router`; install external → `/install-plugin` |
| `frd-generation` | `prd-generation` | merge | 4.9.0 | TBD | Thin near-duplicate; `prd-generation` now covers product AND functional requirements with Given-When-Then acceptance criteria | Invoke `/prd-generation`; router resolves old name |

## v4.11.0 (agent-centric v5, 2026-07-02)

The domain backend-implementation skills were retired: `/do`'s lead+builder loop plus the platform specialist agents and the always-loaded `rules/*.md` now own that role. Content was preserved (it already lived in `rules/python-rules.md`/`rules/go-rules.md` + the `fastapi-specialist`/`go-specialist` agents) before the folders were removed. Old projects: a reference to either name resolves via the table below to `build` + the matching specialist agent; `upgrade.sh`'s stale-reference scan now also warns on both names.

| Old name | New name(s) | Kind | Since | Removed | Reason | Migration |
|---|---|---|---|---|---|---|
| `python-backend` | `build` + `fastapi-specialist` agent | merge | 4.11.0 | **4.11.0** (removed) | Implementation now runs through `/do` → `backend-lead` (plan) → `builder` (implement), with `python-rules.md` + `fastapi-specialist` carrying the conventions | Invoke `/build` (via `/do`); backend architecture questions → `fastapi-specialist` agent; router resolves old name |
| `go-backend` | `build` + `go-specialist` agent | merge | 4.11.0 | **4.11.0** (removed) | Same as above; `go-rules.md` + `go-specialist` carry the Go conventions, `builder` verify battery now includes the Go floor (gofmt/go vet/go test -race) | Invoke `/build` (via `/do`); Go architecture questions → `go-specialist` agent; router resolves old name |

The Python/Go **testing** and **deployment** skills (`python-testing`, `python-deployment`, `go-testing`, `go-deployment`) and `python-ai-services` were KEPT (they need Write/Bash and own MAVS reports an agent cannot). Their `dependencies.required` on the removed backend skills was re-pointed to `code-quality`/`tech-specification`.

## Alias resolution

At `/skill-router` invocation:

1. Match user intent against current registry
2. On miss, check this file for the old name
3. If found, resolve to new skill(s); emit event:
   ```json
   {"event":"skill.deprecated_alias","old":"claude-md","new":"project-context"}
   ```
4. For splits, route based on keywords in user intent (documented per-split)

## Dispatcher stubs

For splits, the old skill folder remains as a thin dispatcher stub for 1 minor version:

```
skills/deployment/SKILL.md       # stub: routes to deployment-planning or deployment-execution
skills/design-system/SKILL.md    # stub: routes to design-discovery / tokens / screens
```

Stubs have minimal frontmatter + `description:` pointing users to the replacements. They only do routing.

## Removal protocol

When an alias's `Removed` version ships:

1. Remove the entry from this file → archive to `docs/skill-deprecations-archive.md`
2. Remove the dispatcher stub folder
3. Router stops resolving the old name; user gets "unknown skill" error
4. Update `CHANGELOG.md` with removal notice

## v4.24.0 (diagram-design plugin adopted, 2026-10-14)

`diagram-creator` drew five Pillow archetypes as PNG. It is replaced by the `diagram-design` Claude Code plugin (cathrynlavery/diagram-design, MIT), which covers 45 diagram types as HTML + inline SVG with SVG/PNG export and Mermaid / draw.io / Excalidraw import. The plugin is installed from its own marketplace through `settings.template.json` (`extraKnownMarketplaces` with `autoUpdate: true` plus `enabledPlugins`), not vendored into `skills/`, so it updates without an ADF release. The `diagram-creator` folder is REMOVED. Its five archetypes map to diagram-design types in `docx-from-markdown` SKILL.md, "Diagram R&D pass".

| Old name | New name(s) | Kind | Since | Removed | Reason | Migration |
|---|---|---|---|---|---|---|
| `diagram-creator` | `diagram-design` (plugin skill `diagram-design:diagram-design`) | replace | 4.24.0 | **4.24.0** (removed) | Five fixed Pillow archetypes against 45 maintained, auto-updating diagram types with export and import | Ask for the diagram by type (architecture, flowchart, sequence, state machine, ...), export PNG with `/diagram-design:export-diagram <file>.html --png-only`. Router resolves old name |

## v4.32.0 (pruning pass, 2026-10-22)

Six skills retired. Content was moved into the surviving skill first (merges) or already lived in `/do` (the three team pipelines), then the folders were REMOVED. Old-name invocations are not aliased: use the replacement named below.

| Old name | New name(s) | Kind | Since | Removed | Reason | Migration |
|---|---|---|---|---|---|---|
| `list-plugins` | `install-plugin` (list mode) | merge | 4.32.0 | **4.32.0** (removed) | A read-only table view did not justify a separate always-listed skill | Run `/install-plugin list` (or ask "list plugins"). Output format is unchanged |
| `import-conventions` | `share-decision` (import mode) | merge | 4.32.0 | **4.32.0** (removed) | Share and import are two halves of one cross-project memory flow and share the same `~/.adf/shared/` files | Run `/share-decision import` (or ask "import conventions"). The `shared-memory-sync.sh` hook wiring is unchanged |
| `project-kickoff` | `session-management` (Triage Routing section) | merge | 4.32.0 | **4.32.0** (removed) | A pure router that always handed off to session-management, with overlapping trigger phrases | Ask "start new project" or run `/session-management`. The question flow, routing table and Workflow F depth levels now live in its Triage Routing section |
| `team-feature` | `/do` Phase 1 lead dispatch | retire | 4.32.0 | **4.32.0** (removed) | `/do` already dispatches the domain leads, the scope and architecture gates and code review, so the skill duplicated the orchestrator | Describe the feature to `/do`. Gates fire from project state |
| `team-design` | `/do` Phase 1 lead dispatch (design-lead) | retire | 4.32.0 | **4.32.0** (removed) | `design-lead` plus the design skills already cover the design pipeline when `/do` dispatches them | Describe the screen or UI work to `/do` |
| `team-release` | `/do` Phase 3 plus `gate-enforcement` Gate 5 | retire | 4.32.0 | **4.32.0** (removed) | Release readiness is Gate 5 plus `milestone-validation`, `deployment-planning` and the MAVS merge gate, all driven by `/do` Phase 3 | Ask `/do` to ship. `team-security` is kept for parallel security review |

Hooks retired in the same pass (not skills, listed for the record): `instructions-loaded-log.sh`, `subagent-bookkeeping.sh`, `milestone-e2e-gate.sh` (the MAVS gate is `mavs-gate.sh`), `fast-validate.sh`, and `log-agent-stop.sh` (folded into `log-agent.sh`, which now handles SubagentStart and SubagentStop). The Prettier and ESLint PostToolUse entries were merged into one.

## Current aliases

(Populated as deprecations are committed.)

Router module: `skills/skill-router/SKILL.md` references this file to build its alias table at session start.
