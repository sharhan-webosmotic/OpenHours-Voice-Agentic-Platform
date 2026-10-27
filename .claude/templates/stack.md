---
frontend: <nextjs | reactjs | angular | vue | svelte | none>
backend: <fastapi | nestjs | nodejs | python-backend | go | spring | dotnet | laravel | rails | elixir | none>
database: <postgres | mysql | sqlite | mongodb | none>
mobile: <flutter | react-native | none>
desktop: <tauri | electron | native | none>   # set when a desktop target is selected; loads rules/desktop-rules.md
api_style: <rest | trpc | graphql | grpc>      # transport contract; rest is the common default, decided per requirement
auth_provider: <roll-own | auth0 | clerk | nextauth | supabase | firebase | cognito | keycloak | none>
orm: <prisma | drizzle | typeorm | sqlalchemy | django-orm | mongoose | sqlc | none>
baas: <supabase | firebase | appwrite | none>  # when a backend-as-a-service replaces a hand-built backend
queue: <bullmq | celery | sqs | rabbitmq | kafka | none>   # async/background work
compliance: [<hipaa | soc2 | gdpr | pci>]
planning_depth: standard   # standard | poc
stack_confirmed: false     # set true only after in-session requirement-driven confirmation
stack_confirmed_date: <YYYY-MM-DD>
mode: lean
build:
  autofix_rounds: 2        # /do Phase 1 bounded auto-fix rounds on a verification failure before escalating to the user; 0 disables (escalate immediately)
---

# Stack

> Locked decisions. `/build` reads this every iteration. The stack is chosen
> requirement-first per `rules/tech-stack-selection-rules.md`: no house default,
> options + architecture-reasoned recommendation + user confirmation. Do not edit
> `stack_confirmed: true` decisions without `/ask` confirmation logged in
> decision-log.md and a superseding ADR.

## Runtime
<!-- Fill from the confirmed selection. Examples are format hints, NOT defaults. Pick per requirement. -->
- **Frontend:** <framework + major version + key mode, e.g. router/rendering choice>
- **Backend:** <language + framework + version + server> (loads the matching `rules/<lang>-rules.md` when one exists, e.g. go-rules, python-rules)
- **Database:** <engine + version>
- **API style:** <rest | trpc | graphql | grpc> chosen because <requirement signal: cross-language clients, end-to-end TS types, flexible client queries, service-to-service streaming>
- **ORM / data access:** <prisma | drizzle | typeorm | sqlalchemy | django-orm | mongoose | sqlc | raw>
- **Auth:** <provider/library + methods> (auth_provider in frontmatter)
- **BaaS (if any):** <supabase | firebase | appwrite | none> and which capabilities it owns (auth/db/storage/realtime)
- **Async / queue (if any):** <bullmq | celery | sqs | rabbitmq | kafka | none> for <the background work that needs it>
- **Desktop (if any):** <tauri | electron | native | none> (loads `rules/desktop-rules.md`)
- **Hosting:** <frontend host + backend host>

## Libraries (locked)
- UI: <component library + styling approach>
- State: <state management choice>
- Forms: <forms + validation choice>
- HTTP / data-fetching: <client/transport choice>
- Test: <unit runner: vitest | jest> + playwright (e2e)

## Test commands (canonical — scaffolded by session-management)
<!-- The whole-project runs. /build and /do read test.regression for the full unscoped regression. -->
- test.unit: `npm run test`            <!-- unit + integration + coverage, 98% four-metric gate -->
- test.regression: `npm run test`      <!-- full unscoped suite (read by /build + /do) -->
- test.full: `npm run test:full`       <!-- whole scope: JS + Python + Go + e2e + report validation -->
- test.ci: `npm run test:ci`           <!-- test:full, headless + strict (CI + pre-merge) -->
- test.e2e: `npm run test:e2e`         <!-- Playwright suite -->
- Raw output dir (gitignored): `AI_DOCS/quality/test-artifacts/`; validated verdicts (tracked): `AI_DOCS/quality/mavs/`

## Selection rationale
<!-- REQUIRED for non-POC (Gate 1). One block per category. Reason = the requirement signal that chose it, not "popular". -->
- **Frontend:** chosen because <requirement signal>. Alternatives considered: <list>. Revisit if: <trigger condition>.
- **Backend:** chosen because <requirement signal>. Alternatives considered: <list>. Revisit if: <trigger condition>.
- **Database:** chosen because <requirement signal>. Alternatives considered: <list>. Revisit if: <trigger condition>.
- **API style:** chosen because <requirement signal: who calls it and how>. Alternatives considered: <list>. Revisit if: <trigger condition>.
- **Auth + ORM:** chosen because <requirement signal: identity needs, schema shape>. Alternatives considered: <list>. Revisit if: <trigger condition>.
- **Mobile / Desktop (if any):** chosen because <requirement signal>. Alternatives considered: <list>. Revisit if: <trigger condition>.
- **Hosting:** chosen because <requirement signal>. Alternatives considered: <list>. Revisit if: <trigger condition>.
- **Stack ADR:** `AI_DOCS/architecture/adrs/<NNN-stack-selection>.md` (required, every project).

## Folder structure
```
src/
  app/             # routes
  components/      # shared UI
  design/tokens.ts # design tokens (locked, see below)
  lib/             # utilities
  server/          # backend code (if monorepo)
tests/
```

## Design tokens (locked)
- **File:** `src/design/tokens.ts` (or `tailwind.config.ts` for Tailwind setups)
- **Locked at:** <YYYY-MM-DD>
- **Component library:** <chosen library + core components>
- **Rule:** all UI tasks must import from this file. No hardcoded colors/spacing/font-sizes anywhere outside it. `/build` enforces this with a grep gate.
