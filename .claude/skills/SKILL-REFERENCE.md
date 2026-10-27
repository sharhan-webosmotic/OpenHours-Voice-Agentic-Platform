# Skill Quick Reference (97 skills — v4.14.0)

> **⚠ STATUS — historical reference only.**
> The "Intent → Command" tables below describe ADF v3.x where the user typed each slash command directly. From v4 onward the user invokes only `/do`, which dispatches the underlying specialist skills based on `AI_DOCS/` state. Treat this file as an index of *what each skill does*, not a routing guide. Authoritative routing: `CLAUDE.md` and `skills/do/SKILL.md`.

## SDLC Flow

```
[brainstorm*] → session-management → [requirement-finalization*] → workscope → [estimation] → tech-spec
  → milestones + guardrails
  → design-discovery → design-tokens → design-screens
  → build → qa-testing → audit → accessibility-audit
  → milestone-validation
  → [deployment-planning → deployment-execution]**
  → retrospective
```

`*`  optional pre-discovery ideation
`**` optional: opt-in at `/session-management`

## Intent → Skill Routing

### Planning & Requirements
| Intent | Skill | Command |
|---|---|---|
| Explore idea / business model | brainstorm | `/brainstorm` |
| New project / resume work | session-management | `/session-management` |
| Finalize conflicting requirement sources | requirement-finalization | `/requirement-finalization` |
| Define scope | workscope | `/workscope` |
| Estimate effort | estimation (SK-162, internal since v4.13.0) | `/estimation` |
| Short project summary / complexity brief | project-brief | `/project-brief` |
| Write tech spec | tech-specification | `/tech-specification` |
| Plan milestones | milestone-planning | `/milestone-planning` |
| Set coding rules | guardrails | `/guardrails` |
| Formal PRD / FRD | prd-generation | `/prd-generation` |
| Mid-flight change | change-request | `/change-request` |
| Project type classification | project-types | `/project-types` |

### Design (split from /design-system in v3.1)
| Intent | Skill | Command |
|---|---|---|
| Design discovery + brand mood + component library lock | design-discovery | `/design-discovery` |
| Tokens + core components + draft screens (Gate 3) | design-tokens | `/design-tokens` |
| UX flows + production screens (Gates 4–5) | design-screens | `/design-screens` |

### Implementation
| Intent | Skill | Command |
|---|---|---|
| Implement feature | build | `/build` |
| Implement a feature from a plan | feature-delivery | `/feature-delivery` |
| Break down a task | task-planner | `/task-planner` |
| React patterns | reactjs | `/reactjs` |
| Next.js | nextjs | `/nextjs` |
| shadcn/ui | shadcn-ui | `/shadcn-ui` |
| Python backend | build + fastapi-specialist | `/do` |
| Python AI / LLM / RAG | python-ai-services | `/python-ai-services` |
| Python tests | python-testing | `/python-testing` |
| Python deploy | python-deployment | `/python-deployment` |
| Go backend | build + go-specialist | `/do` |
| Go tests | go-testing | `/go-testing` |
| Go deploy | go-deployment | `/go-deployment` |

### Quality (v3.1 collapses heavy checks to milestone)
| Intent | Skill | Command |
|---|---|---|
| Code quality check (17-point simulation) | code-quality | `/code-quality` |
| Write tests | qa-testing | `/qa-testing` |
| Browser / E2E testing | e2e-testing | `/e2e-testing` |
| Security audit (OWASP + secrets) | audit | `/audit` |
| Accessibility audit (WCAG 2.1 AA) | accessibility-audit | `/accessibility-audit` |
| Full milestone validation (Gate 4.5) | milestone-validation | `/milestone-validation` |
| Project-level health check | project-audit | `/project-audit` |

### Deployment (split from /deployment in v3.1 — opt-in at kickoff)
| Intent | Skill | Command |
|---|---|---|
| Prepare runbook + validate readiness | deployment-planning | `/deployment-planning` |
| Execute live deploy + verify + sign-off | deployment-execution | `/deployment-execution` |
| Git release protocol, SemVer tags | github-ops | `/github-ops` |

### Team Orchestration
| Intent | Skill | Command |
|---|---|---|
| Single conversational entry point — say "do X" and it routes, dispatches, loops | do | `/do` |
| Parallel security review | team-security | `/team-security` |

### Infrastructure
| Intent | Skill | Command |
|---|---|---|
| Architecture / ADR | architecture | `/architecture` |
| Data / DB migrations | data-migration | `/data-migration` |
| MCP servers | mcp-connector | `/mcp-connector` |
| Caching strategy | caching-strategy | `/caching-strategy` |
| Error handling | error-handling | `/error-handling` |
| Audit trail / compliance logs | audit-logs | `/audit-logs` |
| Analytics | analytics | `/analytics` |
| SEO | seo | `/seo` |
| i18n / multi-lang | i18n | `/i18n` |
| Mock API server | mock-api-server | `/mock-api-server` |
| Mock data | mock-data | `/mock-data` |

### Meta & v3.1 additions
| Intent | Skill | Command |
|---|---|---|
| Post-milestone retrospective | retrospective | `/retrospective` |
| Create a new skill | skill-authoring | `/skill-authoring` |
| Generate CLAUDE.md (renamed from /claude-md) | project-context | `/project-context` |
| Session context / memory | memory-protocol | `/memory-protocol` |
| Project stage detect | project-stage-detect | `/project-stage-detect` |
| Gate validation | gate-enforcement | `/gate-enforcement` |
| AI cost guardrail | ai-cost-guard | `/ai-cost-guard` |
| Onboard existing codebase | codebase-migration | `/codebase-migration` |
| Debug / fix bug | debugger | `/debugger` |
| Image generation | image-generation | `/image-generation` |
| Image optimization | image-assets | `/image-assets` |
| Find a skill | skill-router | `/skill-router` |
| Test a skill | skill-test | `/skill-test` |
| Improve a skill | skill-improve | `/skill-improve` |

### Documents
| Intent | Skill | Command |
|---|---|---|
| Markdown document (best-practice) | markdown-creator | `/markdown-creator` |
| Word document | docx | `/docx` |
| PDF | pdf | `/pdf` |
| Presentation | pptx | `/pptx` |
| Spreadsheet | xlsx | `/xlsx` |

## v3.1 Deprecations (REMOVED in 3.1.0)

| Old | New |
|---|---|
| `/claude-md` | `/project-context` |
| `/deployment` | `/deployment-planning` or `/deployment-execution` |
| `/design-system` | `/design-discovery` or `/design-tokens` or `/design-screens` |
| `/orchestrator` (user-facing) | `/do` (orchestrator remains as internal meta only) |

See `docs/skill-deprecations.md` for the full deprecation table.
