# Agents vs Skills

The framework uses both **skills** (user-invocable workflows) and **agents** (subagent types spawned by skills). They overlap in practice; this doc draws the line.

## Definitions

| Concept | Role | Invoked how | Has SKILL.md? |
|---|---|---|---|
| **Skill** | A workflow a user directly triggers ("I want to plan a milestone") | `/skill-name` or router match | Yes, in `skills/<name>/SKILL.md` |
| **Agent** | A specialist spawned by a skill to do a focused sub-task ("review this PR for security issues") | `Task(subagent_type: ...)` call from within a skill | No — has an agent prompt in `agents/<name>.md` |

## When to use which

Use a **skill** when:

- A human user would say this in the chat
- It has a clear start and end from the user's perspective
- It produces a visible artifact (plan doc, code diff, report)
- It might be invoked repeatedly, at different times

Use an **agent** when:

- It's a narrow specialist that serves other skills
- It doesn't produce a user-facing artifact directly; it produces input for another skill
- It benefits from running in parallel with other agents
- Its context shouldn't pollute the main session

## Red flags in current framework

### Skills that are really agents

These skills are spawned exclusively by other skills and never invoked by users directly:

- `/orchestrator` — spawned by `/team-*` skills; should be an agent (target: v3.2)
- `/gate-enforcement` — ambient validator; borderline (can be invoked directly, but usually isn't)

**v3.1 action:** demote `/orchestrator` from user-facing (already handled in Issue 13). Keep as skill for now to avoid breaking existing callers; flag for agent conversion in v3.2.

### Agents that are really skills

None identified in current framework. Existing agents (`code-reviewer`, `solutions-architect`, `engineering-lead`, `product-director`, `qa-lead`, `security-auditor`, `component-inspector`, `test-writer`, `api-validator`) are all correctly scoped as specialists.

## Cross-reference

Framework's 48 agents (in `agents/`), by family:

- Leadership and authorities: product-director, engineering-lead, qa-lead, solutions-architect, data-architect, sre-reliability, compliance-officer
- Domain leads + builder: frontend-lead, backend-lead, quality-lead, design-lead, research-lead, builder
- Review specialists: code-reviewer, security-auditor, component-inspector, test-writer, api-validator, ux-advisor, principal-designer
- Platform: nextjs-specialist, react-specialist, angular-specialist, vue-specialist, nodejs-specialist, nestjs-specialist, fastapi-specialist, flutter-specialist, react-native-specialist, go-specialist
- Utility and pipeline workers: explorer, learning-curator, business-strategist, plus the assessment (ap-*) and code-quality (cq-*) specialist packs

The list above is a family map, not the roster. The full roster is the `agents/` directory itself, each agent self-describing via its frontmatter. No agent carries a model tag: every agent inherits the model set in the Claude CLI default settings. Subagents exist for isolation and context protection, not price tiers.

All are spawned by skills via `Task(subagent_type: ...)`. Users don't invoke them directly.

## Why this matters for `allowed-tools`

- **Skills** declare `allowed-tools` covering everything the skill's *main prompt* needs
- **Agents** declare their own `allowed-tools` in `agents/<name>.md` frontmatter — which can be *different* from the parent skill's

A `team-security` skill might have `allowed-tools: "Read Grep Glob Task"` (only needs to orchestrate). The `code-reviewer` agent it spawns has `allowed-tools: "Read Grep Glob WebFetch"`. Neither has write permissions; a separate implementation agent does.

This is the **least-privilege** benefit: fine-grained tool access per sub-task, not per full workflow.

## Testing contract

- Skills get `tests/triggers.yaml` + `tests/snapshots/` (when Layer 6 authorized)
- Agents get `agents/<name>-tests.md` — a prompt → expected-output file used to validate agent behavior in isolation
