# Skill Backlog

Skills identified by the v3.1 audit as gaps, deferred to v3.2+.

## Tier 2 — v3.2 (target adds)

| Skill | Purpose | Expected trigger | Notes |
|---|---|---|---|
| `/performance-testing` | Load/stress/capacity testing | "load test", "benchmark API", "capacity plan" | k6, Locust, Artillery; produces `AI_DOCS/quality/perf-report.md` |
| `/monitoring-alerting` | Observability setup | "add monitoring", "alert rules", "dashboard" | Prometheus, Grafana, structured alerting policy |
| `/incident-response` | Post-deploy triage | "incident", "outage", "rollback" | Status page updates, rollback coordination, audit trail |
| `/component-generation` | Design-to-code | "generate component from Figma", "scaffold from design spec" | Requires design-tokens.json + Figma plugin integration |

## Tier 3 — Backlog (add as demand surfaces)

| Skill | Purpose | Notes |
|---|---|---|
| `/api-versioning` | API version management, deprecation policy | Distinct from `/data-migration`; version-aware routing, client-compat matrix |
| `/configuration-management` | Env config, secrets, multi-env strategy | Consolidates .env patterns, secret managers, config drift detection |
| `/documentation-generator` | Auto-generate API/architecture/user docs from code | OpenAPI → Markdown, AST → architecture diagrams |
| `/testing-strategy-planner` | Decide test pyramid + coverage targets | Consumes project-classification; outputs `AI_DOCS/quality/test-strategy.md` |
| `/database-versioning` | Schema versioning + rollback strategies | Beyond `/data-migration`; multi-env schema drift |
| `/skill-deprecation` | Graceful skill retirement tooling | Automates alias setup + router updates + removal timeline |

## How skills get promoted

- Tier 3 → Tier 2: when at least 2 users request it or it's blocking a v3.2 milestone
- Tier 2 → Committed: when a user or team picks it up, writes the SKILL.md, and passes compliance audit

## How to propose a new skill

1. Open an issue or a discussion referencing the gap
2. Write a one-paragraph use case (what problem, who has it, how often)
3. Identify the 2–3 trigger phrases
4. Check `docs/skill-decision-tree.md` — does an existing skill already cover it?
5. If accepted, add to this backlog at the appropriate tier

## Rejected ideas

Ideas deliberately not pursued, with reason:

| Idea | Rejected because |
|---|---|
| `/code-generation` as a general skill | Too broad; platform-specific skills (reactjs, nextjs, python-backend) already cover this in context |
| `/ai-chat-integration` | Too narrow and moving too fast; let users compose `/architecture` + `/mcp-connector` instead |
| `/prompt-engineering` | Cross-cutting concern, not a workflow — lives in rules files instead |
