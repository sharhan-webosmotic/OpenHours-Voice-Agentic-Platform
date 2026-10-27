<!-- adf-version: 4.32.0 -->
# App Development Framework — Operating Rules

> Active framework directive. Loaded by Claude Code at session start.

---

## Always-on chat rules

Three rule files in `.claude/rules/` load in every session and govern every reply: `writing-style-rules.md` (no em-dash or en-dash, no semicolons in prose, colons allowed, in chat and in files), `advisor-stance-rules.md` (challenge first, `[Certain]` / `[Likely]` / `[Guessing]`, no sycophancy, never in client deliverables) and `response-markers-rules.md` (🔴 🟡 🟢 in terminal chat only, never in files). They are not repeated here.

---

## 0. Single Interface Rule — Absolute

**There is exactly ONE skill you ever invoke in response to a user request: `/do`.**

`/do` is the master orchestrator. It reads project state, selects the right sub-skills for the task, and invokes them in sequence. The other skills (`/plan`, `/build`, `/audit`, `/ship`, `/workscope`, `/tech-specification`, `/team-security`, `/deep-security-audit`, etc.) are triggered **by `/do` internally** based on what the task requires. They are not invoked directly in response to user requests.

`/do` handles the complete lifecycle across four phases. Phase 0 is fully dispatched: `/do` invokes the specialist planning skills via real Skill calls and enforces Gate 1 between them. Phases 1-3 are `/do`-managed: `/do` orchestrates the build, audit, and ship loops while dispatching agents and any armed specialist skills (per the Activation Map) as each task requires.
- **Planning (Phase 0, dispatched)** — `/workscope`, `/tech-specification`, `/architecture`, `/design-*`, `/infra-planning`, `/prd-generation`, `/milestone-planning` via real Skill calls
- **Building (Phase 1, `/do`-managed)**: default path is the worktree-isolated `builder` agent applying a domain lead's plan, with scope validation and `code-reviewer` running in parallel and joined per task. Only the micro lane (tiny surgical edits) stays inline.
- **Auditing (Phase 2, `/do`-managed)** — inline secrets / CVE / a11y / OWASP checks
- **Shipping (Phase 3, `/do`-managed)** — inline pre-flight + deploy, gated by Gate 5

If `/do` needs to ask the user a question, it asks inline in its conversational output. It does NOT use a Skill tool call to `/ask`.

**Never invoke a sub-skill directly in response to a user request.** If the user says "build X" or "audit Y", route through `/do` — `/do` decides which sub-skills to trigger.

---

## 1. Framework Routing — Mandatory

**For any coding, fixing, building, designing, or shipping request, you MUST invoke `/do`.**

This includes (non-exhaustive): "build me X", "fix Y", "add Z", "implement", "make this", "do this", "start", "let's code", "ship", "deploy".

### What "invoke /do" means
Before any `Edit`/`Write`/`MultiEdit` to **application code** (anything outside `AI_DOCS/`, `.claude/`, `*.md` docs at root):

1. Announce in one line: `Routing to /do for <intent>.` — no monologue.
2. Use the Skill tool to invoke `/do`.
3. `/do` handles everything from that point — planning, building, verifying, shipping.
4. Edit/Write happens **inside `/do`'s execution**, not at the top level.

### The only exceptions

1. **Explicit user opt-out**: the user says one of "skip the framework", "I'll code on my own", "don't follow /do", "freestyle", "without the framework". Then:
   - Append a `## Bypass — <YYYY-MM-DD HH:MM>` entry to `AI_DOCS/memory/decision-log.md` with the exact phrase the user used.
   - That entry is what `hooks/enforce-do-routing.sh` reads: a `## Bypass` heading dated today, with no later `## Resume framework` entry, lets edits through. No environment variable is needed. An `export ADF_BYPASS=on` in a Bash call never reaches the hook, so it is not a way to bypass.
   - The bypass lasts for the day it is dated. To re-enable explicitly, the user can say "use the framework again": append a `## Resume framework — <date>` entry.

2. **Trivial doc-only edit** to README, CHANGELOG, comments, or in-conversation notes where no `.ts`/`.tsx`/`.js`/`.jsx`/`.py`/`.go`/`.rs`/`.java`/`.kt`/`.swift`/`.sql`/`.yml`/`.yaml`/`.toml`/`.json` config files change.

3. **Read-only requests**: "explain this code", "what does X do", "show me Y". No edits, no Bash that mutates state.

If unsure whether a request is in scope, default to invoking `/do`. Asking the user via `/ask` once is cheaper than skipping the framework and doing the wrong thing.

---

## 2. Compaction Recovery — Mandatory

**The file is the memory, not the conversation.** When you see `<compaction-summary>` in your context (Claude Code just compacted):

1. **STOP**. Do not respond to the user yet.
2. Read in order:
   - `AI_DOCS/memory/session-state.md`
   - `AI_DOCS/memory/task-ledger.md` (the heartbeat — milestone summary)
   - For the active milestone (from session-state): `AI_DOCS/milestones/M<NN>-<slug>/capsule.md` and `tasks.md`
   - `AI_DOCS/memory/decision-log.md` — last 10 rows
   - `AI_DOCS/memory/user-prompts.log` — last 10 lines
3. Acknowledge in one line: `Recovered: <active milestone> / <active task> / <last decision> / <next action>.`
4. THEN respond to the user's actual request.

This is non-negotiable. Skipping the recovery read produces drifted output that doesn't match the plan.

---

## 3. Per-Milestone Capsule Loading

Multi-module projects (≥3 milestones) must NOT load all milestones into context. Working context is scoped to the **active milestone only**.

### Loading rules by skill scope (declared in SKILL.md `context_budget.scope`)

| Scope | Allowed reads |
|---|---|
| `task` (default — `/build`, single-task skills) | `project-context.md`, `session-state.md`, active milestone's `capsule.md` + the SPECIFIC task row from `tasks.md` (Read with offset/limit), the active chunk file. |
| `milestone` (`/audit`, `/gate-enforcement`, `qa-testing`) | All of the above PLUS the entire active milestone capsule directory. NEVER load other milestones. |
| `global` (`/plan`, `/gate-enforcement`, `/project-audit`) | May load multiple milestone capsules, but via Read offset/limit, never whole-file `cat`. |
| `session` (`/do`, `/session-management`) | The global memory files only. Capsule contents loaded lazily as a milestone is selected. |

### Cross-milestone references

- Use stable IDs: `M01:T-03`, `M02:gate-2`. Never copy content from one capsule into another.
- Global `decision-log.md` holds only project-spanning decisions (stack choice, architecture). Milestone-local decisions go in `milestones/M<NN>/decisions.md`.
- Global `task-ledger.md` is a one-line-per-milestone summary table. Full task tables live in each `milestones/M<NN>/tasks.md`.

Full schema and capsule contract: `skills/memory-protocol/SKILL.md`.

---


## 4. Memory Files (essentials, full map: `docs/memory-map.md`)

- **One AI_DOCS, at the project root.** Never create a second `AI_DOCS/` in application code (`hooks/enforce-single-aidocs.sh` blocks it).
- **Global memory** (`AI_DOCS/memory/`): `project-context.md`, `session-state.md` (update before every compaction), `task-ledger.md` (one line per milestone), `decision-log.md` (project-spanning, append-only), `gate-status.md`, `stack.md`, `active-skills.md`. Auto-written, never edit: `user-prompts.log`, `compaction-snapshot.md`. Gate strictness: `AI_DOCS/review-mode.txt` (`full` / `lean` default / `solo`).
- **Per milestone** (`AI_DOCS/milestones/M<NN>-<slug>/`): `capsule.md`, `tasks.md`, `decisions.md`, `spec.md`, `api.md`.
- **Contracts**: `AI_DOCS/architecture/api-contract.md` (locked after Gate 1, change via `/change-request`), `database-schema.md`.
- **Client sources**: raw originals in `AI_DOCS/requirements/` (never edited), conversions in `AI_DOCS/ingested/<type>/<basename>.md` joined by `ingested/manifest.md`. Ingest every supplied document through `markitdown` first and read the conversion, never the binary. **Complete-reading rule:** a source is read only at `COVERAGE: COMPLETE` from `verify_coverage.py`. An INCOMPLETE source is reported with its gap list, never reasoned over as if whole. With more than one source, run `requirement-finalization` before `/workscope`.
- **Planning and quality**: `AI_DOCS/planning/` (requirements-baseline, scope-strategy, workscope, spec sections, task plans), `AI_DOCS/quality/defect-log.md`, `AI_DOCS/design/`, `AI_DOCS/audit/`, `AI_DOCS/deployment/`. Scratch: `AI_DOCS/.temp/` (gitignored).
- **Deprecated paths**: `.adf-mode`, `memory/task.md`, `memory/INDEX.md`, `architecture/api.md`, `AI_DOCS/plans/`, root `requirement.md`. `/plan --migrate` renames legacy projects.

---

## 5. Skill Handoff Format

Every skill ends with this exact block before yielding:

```
Skill <current-skill> complete. Memory updated.
Checkpoint: <files written>, safe to compact.

Handing off to: <next-skill>

Summary of what was decided:
- <Decision 1>
- <Decision 2>
```

The `Checkpoint:` line is what tells a re-entering Claude that state is consistent. Without it, assume the skill is mid-execution and do not proceed.

---

## 6. Gates (reference)

Gate registry: `docs/governance-gates.md`. Verdicts written to `AI_DOCS/memory/gate-status.md` (global) and the relevant milestone capsule.

| Gate ID | Reviewer | When |
|---|---|---|
| `SA-ARCH` | solutions-architect | Architecture decision, new service, API boundary |
| `SA-ADR` | solutions-architect | Writing or approving an Architecture Decision Record |
| `PD-SCOPE` | product-director | New feature, scope change |
| `PD-MILESTONE` | product-director | Milestone transition readiness |
| `EL-FEASIBILITY` | engineering-lead | Before sprint starts |
| `QA-STORY-READY` | qa-lead | Story acceptance completeness |
| `QA-TEST-COVERAGE` | qa-lead | Coverage before release |
| `PHASE-GATE` | All Tier-1 in parallel | Gate 0–5 transitions |
| `Gate FLOW` | Operator, via flow-prototypes (SK-168) judged selection | Per Tier F flow, before its implementation tasks. Rows: `Gate FLOW <flow-id>: PASS` / `PENDING` / `WAIVED` |

Gates fire because state demands them (e.g. `gate-enforcement` runs at milestone close, a multi-layer feature request runs the PD-SCOPE and SA-ARCH gates inside `/do` Phase 1), not because of a manual "run gates" toggle. Once a gate is triggered, `AI_DOCS/review-mode.txt` tunes how strictly it runs: `full` (all relevant directors), `lean` (one director, the default), or `solo` (advisory only).

---

## 7. Safety (reference)

Hook-enforced — see `settings.template.json`:
- **Single AI_DOCS**: `hooks/enforce-single-aidocs.sh` blocks any Edit/Write/MultiEdit/Bash that would create a nested `AI_DOCS/` inside application code. There is exactly ONE `AI_DOCS/`, at the project root, and every skill reads and writes that one. Escape: `ADF_ALLOW_NESTED_AIDOCS=on`.
- **Routing block**: `hooks/enforce-do-routing.sh` blocks app-code Edit/Write when there is no `Status=DOING` task in `task-ledger.md` and no `## Bypass` entry dated today in `decision-log.md`. Edits inside `.claude/worktrees/` (the builder agent) are gated too, against the main checkout's ledger and gates.
- **api-contract.md lock**: locked once Gate 1 records `LOCKED` in `gate-status.md`. Use `/change-request` to modify.
- **Destructive git block**: `git reset|clean -f|rebase|restore` requires explicit user confirmation.
- **Infra cost gate**: `hooks/infra-cost-gate.sh` blocks terraform/tofu/pulumi/cdk/CloudFormation/cloud-CLI provisioning commands unless `AI_DOCS/memory/infra-cost-approvals.md` has a same-day `APPROVED` entry (written by `/infra-cost-guard`, SK-146). Escape `ADF_INFRA_APPROVED=on` must be logged in `decision-log.md`.
- **Flow gate**: `hooks/enforce-flow-gate.sh` blocks a Tier F flow's implementation tasks until that flow's row in `AI_DOCS/design/flow-validation-plan.md` is approved or waived (Gate FLOW, owned by `flow-prototypes`, SK-168). Escape: a same-day `ADF_FLOW_GATE_BYPASS` entry in `decision-log.md`.
- **Chunk scope**: edits limited to files listed in active chunk's `## Files Affected`.
- **Anchor enforcement**: critical anchors must be read before editing.

**Rule loading is mechanical (v4.18.0).** Every rule file except the always-on set (writing-style, advisor-stance, response-markers, ops-safety, context-efficiency) carries `paths:` YAML frontmatter, so the harness loads it only when a matching file is touched or a skill Reads it explicitly. A new rule file MUST declare `paths:` unless it belongs in every session. Mechanics and the per-domain table: `rules/README.md`. Compliance stays conditional on `stack.md → compliance:` (`rules/compliance/README.md`).

---

## 8. SDLC phase order

```
discovery → specification → design → implementation → testing → deployment → maintenance
```

Pre-discovery ideation: `/brainstorm` for business model, ICP, revenue fit before `/workscope`. Use `/project-stage-detect` if unsure where you are.

---

## 9. Compaction instructions (for the model summarizing this conversation)

Preserve when summarizing:
- Active milestone + active task ID
- Latest gate verdicts (gate ID + PASSED/FAILED/PENDING)
- Any `WIP:`/`BLOCKED:` markers
- Recent skill outcomes (last 3)
- Tech-stack and architecture decisions
- Pending AI cost approvals or external-op confirmations
- Unresolved CRITICAL/HIGH security findings
- Any active `## Bypass` entry in decision-log

Drop: tool-call output bodies, file content quotes, resolved gate verdicts, routine status reads.
