# App Development Framework (ADF)

> Complete AI-assisted development framework for [Claude Code](https://claude.ai/code).
> 95 skills · 48 agents · governance gates · lifecycle hooks · telemetry · secrets policy · Anthropic-guide compliant.

Current version: see `.adf-version` and `UPGRADING.md` for the changelog and migration notes.

---

## Prerequisites

- Git and a bash shell. On Windows that means Git for Windows (Git Bash): `setup.ps1` locates it, or offers to install it through winget.
- Python 3.12 or newer. `setup.sh` offers to install it and aborts if it is still missing afterwards.
- Node.js (optional). `scripts/patch-settings.sh` uses it to keep `settings.json` in step with the template.
- `jq` (recommended). The hooks parse Claude Code's event JSON with it and fall back to a simpler `sed` parser when it is absent.

## Install in a project

```bash
# 1. Clone as .claude/ inside your project
cd my-project
git clone https://github.com/bhavesh-WebOsmotic/claude-skills .claude

# 2. Run setup once
#    Windows (PowerShell):
.claude/setup.ps1
#    Unix / macOS:
bash .claude/setup.sh
```

Claude Code picks up `.claude/` automatically. `setup.ps1` is a thin wrapper that finds bash and runs `setup.sh`, so both take the same flags: `--yes` (no prompts), `--update-settings`, `--no-notifications`, `--help`.

`setup.sh` is safe to re-run. It:

- creates `.claude/settings.json` from `settings.template.json`. An existing file is kept, and `--update-settings` regenerates it and writes a timestamped backup.
- scaffolds `AI_DOCS/` (`memory`, `planning`, `architecture`, `design`, `milestones`, `requirements`, `ingested`, `quality`, `audit`, `brainstorm`), a starter `AI_DOCS/memory/session-state.md`, and `AI_DOCS/review-mode.txt` set to `lean`.
- copies `CLAUDE.template.md` to your project `CLAUDE.md`, stamped with the framework version. An existing `CLAUDE.md` is kept.
- creates or extends the project `.gitignore` (`.claude/` and the `AI_DOCS` runtime files).
- creates `.claude-project-id` and initialises the SQLite state database under `~/.adf/projects/<id>/`.
- creates `~/.adf/shared/` (shared decisions and conventions) and `cron/jobs.json` (three built-in jobs, all disabled).
- installs `markitdown[all]` with pip, and on Windows the BurntToast PowerShell module for desktop notifications. `--no-notifications` skips BurntToast.
- points this clone's `core.hooksPath` at `hooks/git`, so a later `git pull` runs the upgrade for you.

## Update (any time)

```bash
cd my-project/.claude
git pull
```

The pull triggers `upgrade.sh --auto` through the `post-merge` git hook. If the hook did not fire, run `bash .claude/upgrade.sh` yourself. On macOS and Linux git ignores a hook that is not executable, so check it once with `chmod +x .claude/hooks/git/post-merge`.

The upgrade:

- re-syncs `.claude/settings.json`. Its `hooks` object is reset to the template (a timestamped `settings.json.backup.*` is written when anything changes) and any missing template permission is re-added. Put custom hooks in `.claude/settings.local.json`, which upgrades never touch.
- migrates deprecated `AI_DOCS` paths (for example `plans/` to `planning/`).
- installs a pre-commit secrets scanner in the project repository when it has no pre-commit hook yet.
- mirrors the framework's skills into `~/.claude/skills` when that directory exists. To refresh the mirror by hand, run `bash .claude/scripts/sync-global-skills.sh`.

A pull never overwrites your `CLAUDE.md` or the documents in `AI_DOCS/`.

---

## Start using

Single front door: `/do`. One flow, no modes. Talk to it like a teammate:

```
/do build me a small URL shortener with stats
/do                                # resumes whatever's in flight
/do status                         # task-ledger summary, no side-effects
/do audit                          # secrets + CVEs + a11y + OWASP
/do ship                           # /audit then deploy
/do checkpoint                     # write a thorough session-state.md before compaction
```

`/do` runs four phases end-to-end: plan (intake + milestone seeding), build (task-by-task with verify), audit (secrets + CVEs + a11y + OWASP), ship (pre-flight + deploy + health check). It asks the user only at milestone boundaries or true blockers. Everything else is decided from `AI_DOCS/` state.

There is no `mode` flag and no separate "heavy" entry point. The user invokes only `/do`. The other 100 specialist skills are governed-fanout pipelines that `/do` delegates to as the project grows. The default build path dispatches the worktree-isolated `builder` agent to apply a domain lead's plan, with scope validation and code review running in parallel and joined per task. Only the micro lane (tiny surgical edits) runs inline.

---

## How context stays small

The framework is large, but very little of it loads per session. The design keeps the always-loaded surface minimal:

- Skill and agent descriptions (frontmatter only) are always loaded for routing. Bodies load on demand when a skill is invoked.
- Rules load on demand. Five small rule files load every session (writing-style, advisor-stance, response-markers, ops-safety, context-efficiency) together with the index `rules/README.md`. Every other rule carries `paths:` frontmatter and loads only when a matching file is touched or a skill reads it. Policy and per-domain table: `rules/README.md`. Compliance is conditional on `stack.md → compliance:` (`rules/compliance/README.md`).
- Working context is scoped to the active milestone via per-milestone capsules (`AI_DOCS/milestones/M<NN>-<slug>/`), so multi-module projects stay under budget. Loading rules: `CLAUDE.md` Section 3.

Memory schema: `AI_DOCS/memory/{project-context, session-state, task-ledger, decision-log, gate-status, stack, active-skills}.md`. Full schema and capsule contract: `skills/memory-protocol/SKILL.md`.

---

## What's included

- Skills: 95 framework skills, plus the vendored `impeccable` design toolkit (upstream-owned, see `docs/skill-registry.md` → External vendored skills). Full list and IDs in `skill-lab/catalog.yaml` (readable index: `docs/skill-registry.md`, folder guide: `skills/README.md`). `skills/REGISTRY.md` and `skills/SKILL-REFERENCE.md` are v3-era historical references and do not list every current skill. Categories span core SDLC, design, deployment, team pipelines, platform (React/Next/Angular/Node/Nest/FastAPI/Flutter/RN/Go), infrastructure, reliability, documents, and quality.
- Agents: 48 across three tiers (leadership, leads/specialists, platform), one file each in `agents/`. How they compose: `CLAUDE.template.md` → Agent Roster.
- Rules: `rules/` with an on-demand load index in `rules/README.md`.
- Hooks: 47 scripts in `hooks/`, wired in `settings.template.json` (session start/end, pre-compact, routing/safety gates, drift detection). Proving tests live in `hooks/tests/`.
- Tooling: `setup.sh` / `setup.ps1` (install), `upgrade.sh` (migration after a pull), `scripts/` (settings sync, global skills mirror, plugin install, MCP migration), `cron/` (scheduled jobs), `state/` (SQLite search index), `plugins/` (see `plugins/README.md`), `templates/` (see `templates/README.md`).

The single source of truth for the skill and agent catalog is `skill-lab/catalog.yaml`, not this README. Counts here are descriptive, not authoritative.

---

## SDLC flow

```
[/brainstorm*] → /session-management → /workscope → /tech-specification
  → /milestone-planning → /guardrails
  → /design-discovery → /design-direction → /design-tokens → /design-screens
  → /build → /qa-testing → /audit → /accessibility-audit
  → /milestone-validation → [/deployment-planning → /deployment-execution]**
  → /retrospective

*  optional: use when exploring "should I build this?" before committing
** optional: ask at /session-management whether to generate deployment runbooks + GHA
```

In practice you invoke only `/do`. The flow above is what `/do` orchestrates internally.

---

## Governance gates

| Gate ID | Reviewer | Triggers |
|---------|----------|----------|
| `PD-SCOPE` | product-director | New feature, scope change |
| `SA-ARCH` | solutions-architect | Architecture decision, new service |
| `EL-FEASIBILITY` | engineering-lead | Before sprint implementation |
| `QA-TEST-COVERAGE` | qa-lead | Before release |
| `PHASE-GATE` | All Tier-1 in parallel | Phase 0 to 5 transitions |
| `Gate FLOW` | Operator, via flow-prototypes judged selection | Per Tier F flow, before its implementation tasks |

Full gate definitions: `docs/governance-gates.md`.

---

## Project structure after setup

```
my-project/
├── .claude/                  ← this repo
│   ├── skills/               ← skills (one folder per skill, each with SKILL.md)
│   ├── agents/               ← agent definitions
│   ├── rules/                ← coding/safety/domain rules + README.md load index
│   ├── hooks/                ← lifecycle hooks, hooks/git/post-merge, hooks/tests/
│   ├── docs/                 ← governance, telemetry, secrets policy, skill authoring
│   ├── skill-lab/            ← framework self-testing + catalog.yaml
│   ├── scripts/              ← settings sync, global skills mirror, plugin install
│   ├── templates/            ← files /plan copies into AI_DOCS/
│   ├── cron/  state/  plugins/  workflows/
│   ├── setup.sh  setup.ps1   ← run once after cloning
│   ├── upgrade.sh            ← runs after every git pull (post-merge hook)
│   ├── settings.template.json
│   └── settings.json         ← generated by setup.sh, gitignored
├── AI_DOCS/                  ← your project docs (created by setup.sh)
│   ├── memory/               ← session state, gate status, metrics.jsonl
│   ├── planning/             ← workscope, tech spec, milestone plan
│   ├── requirements/         ← raw client source material
│   ├── ingested/             ← Markdown conversions of those sources
│   ├── architecture/         ← API contract, database schema, adrs/
│   ├── design/               ← design DNA, component registry, screens
│   ├── quality/              ← quality reports, control registry
│   ├── audit/                ← audit report, agent log
│   ├── milestones/           ← per-milestone capsules
│   ├── brainstorm/
│   ├── deployment/           ← runbooks + deployment logs (created when first needed)
│   └── review-mode.txt       ← gate strictness: full / lean / solo
├── .claude-project-id        ← stable project id (created by setup.sh)
├── CLAUDE.md                 ← your project context (from CLAUDE.template.md)
└── src/                      ← your code
```

---

## Self-test the framework

```bash
cd .claude
bash skill-lab/run-all-tests.sh --batch               # static checks on every skill and agent
for t in hooks/tests/*.test.sh; do bash "$t"; done    # proving tests for the blocking hooks
```

Both cost zero tokens: they are plain shell and make no Claude API calls.

---

## Companion tools (optional)

ADF is standalone. A few third-party Claude Code plugins solve adjacent problems (context-window engineering, not process governance) and compose cleanly alongside it. See `docs/context-management.md` for when an external context sandbox like `context-mode` is worth adding. ADF does not depend on any of them.
