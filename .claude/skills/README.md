# Skills

This folder holds the skills of the App Development Framework (ADF): 95 framework skills, plus the vendored `impeccable` design toolkit. Each skill is one folder with a `SKILL.md`.

The authoritative registry is `skill-lab/catalog.yaml` (IDs, categories, test status). `docs/skill-registry.md` is the readable ID index. `REGISTRY.md` and `SKILL-REFERENCE.md` in this folder are v3-era historical references and do not list every current skill.

---

## How skills are used

You do not call these skills one by one. The single entry point is `/do`:

```
/do build me a small URL shortener with stats
/do                # resumes whatever is in flight
/do status         # task-ledger summary, no side effects
/do audit
/do ship
/do checkpoint
```

`/do` reads the project state in `AI_DOCS/`, decides which specialist skills the task needs, and dispatches them. Claude Code always loads every skill's `name` and `description` for routing. A skill's body loads only when that skill is invoked.

---

## What is in a skill folder

| Item | Purpose |
|---|---|
| `SKILL.md` | Required. YAML frontmatter, then the instructions. |
| Reference files (`*.md` beside `SKILL.md`) | Long templates and catalogues the skill reads on demand, so `SKILL.md` stays short. |
| `templates/` | Files the skill copies or fills in (17 skills have one). |
| `scripts/` | Executable helpers the skill runs. Present in `docx`, `docx-from-markdown`, `estimation`, `markitdown` and the vendored `impeccable`. |

### Frontmatter

```yaml
---
name: build                      # must equal the folder name
description: "..."               # what it does and when to use it. Quote it: an unquoted value containing ": " is invalid YAML
skill_id: SK-131                 # must match the entry in skill-lab/catalog.yaml
version: 2.23.1                  # semver, bumped on every edit
context_budget:
  load_kb: 30
  scope: task                    # task | milestone | global | session
dependencies:
  required: [ask]
  optional: [debugger, change-request]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: core
  user_facing: false
---
```

`allowed-tools` is an optional tool restriction, for example `allowed-tools: "Read Write Edit Grep Glob"` (defaults per category: `docs/allowed-tools-matrix.md`). `next_skill`, `required_gate`, `mcp_integrations`, `produces` and `consumes` are optional too. A `next_skill` must name a skill that exists.

---

## Categories

Counts come from `skill-lab/catalog.yaml`.

| Category | Count | Skills |
|---|---|---|
| core | 22 | accessibility-audit, audit, build, deployment-planning, design-direction, design-discovery, estimation, guardrails, infra-planning, landing-page, memory-protocol, milestone-planning, milestone-validation, plan, project-context, qa-testing, requirement-finalization, retrospective, session-management, ship, tech-specification, workscope |
| utility | 15 | ai-cost-guard, brainstorm, change-request, codebase-migration, feature-delivery, history-query, infra-cost-guard, mock-api-server, mock-data, project-stage-detect, project-types, schedule, share-decision, skill-router, task-planner |
| infrastructure | 9 | architecture, data-migration, deployment-execution, design-screens, design-tokens, docx-from-markdown, github-ops, mcp-connector, operations |
| document | 10 | assessment-package, client-report-editing, docx, image-assets, image-generation, markdown-creator, markitdown, pdf, pptx, xlsx |
| platform | 8 | go-deployment, go-testing, nextjs, python-ai-services, python-deployment, python-testing, reactjs, shadcn-ui |
| reliability | 6 | analytics, audit-logs, debugger, e2e-testing, error-handling, incident-response |
| meta | 4 | ask, do, install-plugin, orchestrator |
| gate | 5 | api-conformance, authz-matrix, code-quality, gate-enforcement, schema-validation |
| team | 1 | team-security |
| framework | 4 | skill-authoring, skill-curator, skill-improve, skill-test |
| optimization | 3 | caching-strategy, i18n, seo |
| quality | 3 | code-quality-report, project-audit, ui-review |
| sdlc | 3 | flow-prototypes, project-brief, ux-foundation |
| requirements | 1 | prd-generation |

`impeccable` is vendored from `pbakaus/impeccable` (Apache 2.0). It has no SK id and is deliberately absent from the catalog, so the framework scripts treat it as external. Do not edit it here: update it with `npx impeccable update`.

---

## External tools some skills need

| Skill | Needs |
|---|---|
| `markitdown` (and the read paths of `pdf`, `docx`, `xlsx`, `pptx`) | `markitdown[all]`, installed by `setup.sh` |
| `docx` | `npm install -g docx`, and LibreOffice for PDF conversion |
| `pptx` | `npm install -g pptxgenjs`. Its visual check calls `../docx/scripts/office/soffice.py` |
| `pdf` | `npm install -g pdf-lib` for the JavaScript path |

Install these globally. Do not add `node_modules/` or a `package.json` inside a skill folder.

---

## Adding or changing a skill

1. Use `/do` with the request, or the `skill-authoring` skill directly when you are working on the framework itself. The guide is `docs/skill-authoring-guide.md`.
2. Bump `version:` in the same edit, every time (`rules/skill-versioning-rules.md`).
3. A new skill needs an entry in `skill-lab/catalog.yaml`. That file is the allowlist: `skill-lab/retrofit-frontmatter.sh` and `scripts/sync-global-skills.sh` skip any folder that is not listed in it.
4. Run the static checks. They are plain shell and cost no tokens:
   ```bash
   bash skill-lab/run-all-tests.sh --batch
   ```
5. Optionally check that the description routes correctly. This one calls the `claude` CLI, so it does spend tokens (`--dry-run` shows what would run):
   ```bash
   bash skill-lab/run-trigger-tests.sh --skill <name>
   ```

---

## The global mirror

Claude Code also loads skills from `~/.claude/skills`. When that directory exists, `upgrade.sh` mirrors every catalogued skill into it after a pull, replacing each mirrored folder wholesale and leaving any other skill you installed there untouched. An edit made in this folder is therefore not live in other projects until the mirror is refreshed:

```bash
bash scripts/sync-global-skills.sh
```
