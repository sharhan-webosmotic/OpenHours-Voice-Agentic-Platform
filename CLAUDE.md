# OpenHours Voice Agentic Platform

Multi-tenant SaaS for clinics: an AI voice receptionist (Sarvam) plus dashboards to run the clinic.
It stores patient health data. Treat every change as production code in a regulated domain.
Quality beats speed: a slower correct change is always better than a fast risky one.

**Read `docs/DECISIONS.md` first, every session.** It holds the settled choices that bind
every change: the working method, token storage, the temporary-password flow, the Sarvam
agent and webhook arrangement, the response-buffering constraint, and what must land before
the voice work. A change that contradicts one is a change to the decision, not a code review
comment.

Tickets and prompts live in docs/ROADMAP.md, which is git-ignored and local to the
machine planning the work. It is never committed, so a fresh clone will not have it:
ask for the ticket text. Work only on the ticket I name, and do not start other tickets.

## Repo map
- `apps/api` Express + TypeScript + Prisma + PostgreSQL + pg-boss (API, webhooks, jobs)
- `apps/clinic-web` React dashboard for clinics. `apps/admin-web` React internal admin console
- `apps/android` call-forwarding app only (no patient data on device). BUILT LAST: do not start it until the API, admin-web and clinic-web are complete and signed off. Ignore it for all earlier work, except that the API's device-pairing and forwarding endpoints exist.
- `packages/shared` zod schemas, enums, permission matrix. `packages/api-client` generated from OpenAPI
- `docs/` DECISIONS.md (binding choices), ADRs, STACK.md, runbook. Per-app rules live in each app's own `CLAUDE.md`

## Commands (run from repo root)
- `pnpm dev` | `pnpm check` (build + typecheck + lint + test + openapi drift; MUST pass before you say "done")
- `pnpm test` | `pnpm typecheck` | `pnpm lint` | `pnpm openapi` | `pnpm db:migrate` | `pnpm db:seed`

## How to work on every task
1. Read `docs/DECISIONS.md` and the relevant skill(s) below, then PLAN: files to touch, tests to add, risks. Wait for approval on anything that changes schema, auth, permissions or tenancy.
2. Make the smallest change that solves the task. No drive-by refactors, no unrelated formatting.
3. Write tests in the same change. Run `pnpm check`. Report failures verbatim; never claim success you did not observe.
4. If a requirement, provider behaviour (Sarvam) or clinical rule is unclear, ask. Do not guess or invent API shapes.
5. Finish with: what changed, what you tested, what you did not test, follow-ups.

## Non-negotiable rules (security and data)
1. Every tenant table has `organisation_id`. Prisma is used only inside repositories, via the tenant-scoped client from request context.
2. `organisationId` and `role` come only from the verified token or resolved mapping, never from body, query or headers the client controls.
3. Permissions come from `packages/shared/permissions.ts` and are enforced in the service layer. Hiding UI is never the control.
4. Never log or echo patient data (names, phones, dates of birth, notes, transcripts, prescriptions) or secrets. Log IDs only.
5. Sensitive reads and writes call `audit.record`. Audit rows never contain patient field values.
6. Secrets only from validated config / secret manager. Never commit `.env`, keys or real patient data. Test data is synthetic.
7. Cross-tenant access returns NotFound, not Forbidden.
8. Every create reachable by the voice agent accepts an `Idempotency-Key`; every webhook is stored first and processed idempotently.
9. The AI voice agent never diagnoses, prescribes or decides clinically. It books, reschedules, cancels, answers clinic information.

## Code quality rules
- TypeScript strict. No `any`, no `@ts-ignore` / `eslint-disable` without a one-line reason and a ticket. No `console.log`; use the logger.
- Validate every external input with zod (HTTP, webhook, job payload, env). Parse, do not trust.
- Small functions, named exports only, no default exports, no dead code, no commented-out code. Comments explain why, not what.
- Errors are `AppError` subclasses rendered as problem+json. Never swallow errors; never `catch {}` silently.
- Time: store and transmit UTC ISO-8601; convert to clinic timezone only at the edges. Phones: E.164. Money: integer minor units.
- Dependencies: ask before adding; exact versions pinned; prefer the standard library and what is already installed.
- Migrations are additive and reviewed by a second person. Never edit an applied migration. Never run migrations against shared or production databases from your session.
- Coverage floors: 90% lines for auth, tenancy, permissions, booking, webhooks; 80% elsewhere in `apps/api`.
- Conventional commits (`feat:`, `fix:`, `chore:`), small PRs, branch per task. Never push to `main`, never force-push.

## Skills (load the matching one before starting)
- API/service code: `backend-api-standards` · security, tenancy, PHI, auth: `tenant-security-phi`
- Schema, queries, migrations: `database-prisma-postgres` · tests and gates: `testing-quality-gates`
- Web code: `frontend-react-standards` · visual/UX work: `ui-design-system`
- Speed and scale: `performance-optimisation` · Sarvam, webhooks, jobs: `sarvam-voice-integration`
- Android (last phase only): `android-kotlin-forwarding` · deploy and operations: `release-readiness`
- Crossing module boundaries, new data flow or provider, ADRs: `system-design`
- Reviewing a diff (use in a fresh session): `code-review-checklist`

## Not in scope without written approval
Features not in the scope document, new providers, new infrastructure, new auth methods, multi-branch clinics, clinical decision-making.
