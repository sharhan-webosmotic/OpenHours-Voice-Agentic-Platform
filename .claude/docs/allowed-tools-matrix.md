# Allowed-Tools Matrix

Per-category default `allowed-tools` declarations. Applied to every SKILL.md frontmatter during the Issue 12 compliance retrofit.

## Why

`allowed-tools` is a **security primitive** from the Anthropic skill-building guide. A skill like `/workscope` has no business invoking `Bash(rm:*)`; declaring the tool surface in frontmatter enforces least-privilege.

## Format

```yaml
allowed-tools: "Read Write Edit Grep Glob"
```

Space-separated. Bash commands use pattern matching:

- `Bash(npm:*)` — any `npm` command
- `Bash(git:*)` — any `git` command
- `Bash(python:*)` — any `python` command
- `Bash(rm:*)` — any `rm` command (grant rarely)

## Category defaults

### Planning

Skills: `/workscope`, `/brainstorm`, `/prd-generation`, `/prd-generation`, `/tech-specification`, `/milestone-planning`, `/change-request`

```yaml
allowed-tools: "Read Write Edit Grep Glob"
```

No shell, no web fetching. Pure file authoring.

### Architecture & Design

Skills: `/architecture`, `/design-discovery`, `/design-tokens`, `/design-screens`, `/tech-specification`

```yaml
allowed-tools: "Read Write Edit Grep Glob WebSearch WebFetch"
```

Needs web access for reference research (competitor UIs, standards docs).

### Implementation — Frontend

Skills: `/reactjs`, `/nextjs`, `/shadcn-ui`, `/e2e-testing`

```yaml
allowed-tools: "Read Write Edit MultiEdit Grep Glob Bash(npm:*) Bash(node:*) Bash(npx:*) Bash(pnpm:*) Bash(yarn:*) Bash(git:*)"
```

### Implementation — Backend

Skills: `/python-backend`, `/python-testing`, `/python-ai-services`

```yaml
allowed-tools: "Read Write Edit MultiEdit Grep Glob Bash(python:*) Bash(pip:*) Bash(uv:*) Bash(poetry:*) Bash(pytest:*) Bash(git:*)"
```

### Implementation — Generic

Skills: `/build`, `/codebase-migration`, `/data-migration`

```yaml
allowed-tools: "Read Write Edit MultiEdit Grep Glob Bash(npm:*) Bash(node:*) Bash(python:*) Bash(git:*)"
```

### Quality & Testing

Skills: `/qa-testing`, `/code-quality`, `/audit`, `/accessibility-audit`, `/debugger`, `/milestone-validation`

```yaml
allowed-tools: "Read Grep Glob Bash(npm test:*) Bash(npm run test:*) Bash(pytest:*) Bash(vitest:*) Bash(jest:*) Bash(playwright:*) WebFetch"
```

### Deployment

Skills: `/deployment-planning`, `/deployment-execution`, `/github-ops`

```yaml
allowed-tools: "Read Write Edit Bash(git:*) Bash(gh:*) Bash(docker:*)"
```

**Explicitly excluded:** `Bash(rm:*)`, raw `Bash(*)`. If a deployment script needs `rm`, it goes in a version-controlled script file and is reviewed at commit time.

### Infrastructure & Ops

Skills: `/error-handling`, `/audit-logs`, `/caching-strategy`, `/mcp-connector`, `/analytics`, `/monitoring-alerting` (v3.2)

```yaml
allowed-tools: "Read Write Edit Grep Glob WebFetch"
```

### Doc generation

Skills: `/docx`, `/pdf`, `/pptx`, `/xlsx`

```yaml
allowed-tools: "Read Write Bash(python:*)"
```

Scoped to generator scripts only.

### Utility & Meta

Skills: `/skill-router`, `/skill-test`, `/skill-improve`, `/skill-authoring`, `/project-stage-detect`, `/project-types`, `/project-audit`, `/project-context`, `/session-management`, `/memory-protocol`, `/gate-enforcement`

```yaml
allowed-tools: "Read Write Edit Grep Glob"
```

### Orchestration (team-*)

Skills: `/team-security`, `/orchestrator` (meta), `/feature-delivery`, `/task-planner`

```yaml
allowed-tools: "Read Grep Glob Task"
```

Orchestrators don't directly edit files; they spawn subagents via `Task`. Child agents have their own `allowed-tools`.

### Brainstorming / Research

Skills: `/brainstorm`, `/retrospective`, `/design-discovery`

```yaml
allowed-tools: "Read Write Edit Grep Glob WebSearch WebFetch"
```

### Image / Asset generation

Skills: `/image-generation`, `/image-assets`

```yaml
allowed-tools: "Read Write Bash(python:*) Bash(node:*)"
```

## Overrides

A skill can override the category default in its SKILL.md if needed. Overrides must include a justification comment:

```yaml
# justification: needs direct Bash for multi-step shell pipeline in retrospective analysis
allowed-tools: "Read Write Edit Grep Glob Bash(*)"
```

Audit by:

```bash
grep -rE "Bash\(\*\)" skills/*/SKILL.md
```

Any skill granting raw `Bash(*)` must have a review pass before each release.

## Enforcement

v3.1 implements declaration + manual review. Full runtime enforcement depends on Claude Code's tool-filtering capability — currently **advisory**; the declaration is authoritative for security review but not yet hard-gated at runtime.

v3.2 target: wire `allowed-tools` to `/skill-router`, so invoking a skill activates the declared tool filter for the duration of the skill run.
