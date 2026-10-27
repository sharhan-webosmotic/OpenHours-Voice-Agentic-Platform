---
paths:
  - "AI_DOCS/memory/stack.md"
  - "AI_DOCS/planning/**"
  - "package.json"
  - "pyproject.toml"
  - "go.mod"
---

# Tech Stack Selection Rules

> Always-on selection rule. Governs HOW the project tech stack is chosen, drilled,
> confirmed, and stored, BEFORE any planning artifact locks it in.
> Loaded by: `/do` (Phase 0 stack-selection step), `/plan`, `/workscope`,
> `/architecture`, `/tech-specification`, and any skill that proposes or records a
> stack. Sibling of `infrastructure-rules.md`. The option catalogue lives in
> `skills/workscope/TECH-OPTIONS.md`; this file is the discipline that wraps it.
>
> The single sentence that controls everything below: the stack is chosen FROM the
> requirements, never FROM habit. There is no house default.

---

## Rule 1: Selection is mandatory and requirement-first (BLOCKING)

Tech stack selection runs for every non-POC project, ALWAYS, before the tech spec
locks. It runs even when:

- the requirement document (the sources in `AI_DOCS/requirements/`, or `AI_DOCS/planning/requirements-baseline.md` once finalized) already names a stack,
- the user states a preference up front,
- a previous project used a given stack,
- an existing codebase is being extended (here the constraint is real, but it is
  still confirmed in-session, not assumed).

Never inherit a stack from a document, a habit, or a prior project without explicit
in-session confirmation. A spec that locks a stack with no recorded selection step
is a defect, caught by Gate 1.

POC exception: when `stack.md` has `planning_depth: poc`, a thin stack pick is
allowed. Record it anyway, mark it `poc`, and note it is not requirement-validated.

## Rule 2: No house default (BLOCKING)

The framework has NO preferred stack. Next.js, React, FastAPI, NestJS, Postgres,
Prisma, shadcn, and every other technology are options, never assumptions.

Forbidden:

- Presenting one stack as "(recommended)" before the requirements are read.
- "Use defaults" / "just go" auto-applying a named stack with no analysis.
- Copying the last project's stack because it is familiar.

Allowed: a reasoned tie-break fallback when two options are genuinely equivalent for
this project, AND the reason is stated. Example: "Relational data with no document
use case, so PostgreSQL over MongoDB." The reason is the requirement, not the habit.

## Rule 3: Drill the requirement before recommending (BLOCKING)

Cross-check the requirements before proposing anything. Pull the selection signals
out of the requirement, do not wait for the user to volunteer them:

- Data shape: relational, document, key-value, graph, time-series, blob-heavy.
- Scale: launch users vs 6-month vs 1-year, read/write ratio, peak shape.
- Real-time: live feeds, notifications, chat, collaborative editing (rules out
  REST-only, forces WebSockets/SSE).
- Platform targets: web, iOS, Android, desktop (drives mobile framework choice).
- Team skills: the languages and frameworks the team already runs in production.
- Integrations: third-party services, payment, AI/LLM, heavy file/media handling.
- Compliance: hipaa / soc2 / gdpr / pci (constrains hosting and data handling).
- Operational reality: who runs this in production, budget, time to first ship.

If the requirement contradicts a stated preference (for example the user wants
MongoDB but the data is clearly relational, or wants a SPA but the app needs SEO),
SAY SO. Push back with the reason, the better-fit alternative, and the concrete cost
of the misaligned choice. Do not silently honor a preference that fights the
requirement. Holding this position is the point of the rule.

## Rule 4: Think from the architecture perspective, every project (BLOCKING)

Stack selection is an architecture decision, not a menu pick, and it happens on
single-service projects too, not only multi-service ones. Before recommending,
reason about:

- Coupling and boundaries: monolith vs modular vs services, and why this size.
- Data ownership and consistency needs (transactional vs eventual).
- The scale path: can the chosen stack reach the 6-month and 1-year targets by
  configuration change, not re-architecture? If not, it is the wrong stack.
- Failure modes the stack introduces (cold starts, connection limits, lock-in).
- Operability: deploy, observe, and debug story for this team.

Record the architecture reasoning as a stack ADR (`/architecture`). Every project
gets one stack ADR, single-service included.

## Rule 5: Informed options, recommendation, and confirmation (FORMAT contract)

Never ask a bare "what stack do you want?". Cover EACH category the requirement
touches, not just the big three. The full menu lives in `TECH-OPTIONS.md`:
frontend, backend (incl. Go/Spring/.NET/Laravel/Rails/Elixir, each backed by its
`rules/<lang>-rules.md` where one exists), database, **API style** (REST / tRPC /
GraphQL / gRPC: decided by who calls the API and how), **ORM / data access**,
**auth provider**, **BaaS** (when it replaces a hand-built backend), **async /
queue**, mobile, **desktop** (Tauri / Electron / Native, backed by
`rules/desktop-rules.md`), and hosting. Skip a category only when the requirement
genuinely does not touch it. For each one present:

1. The viable options for THIS requirement (from `TECH-OPTIONS.md`), 1 line each on
   what they are best at.
2. The trade-off that matters here for each option.
3. One opinionated recommendation with a requirement-grounded reason (not "popular",
   not "modern": the actual signal from Rule 3 that points to it).

Then confirm. Present the full proposed stack back to the user and ask explicitly:
"confirm, change a category, or explore alternatives?". The user can always override.
An override is recorded with its reason, never argued past once the user has the
trade-off in front of them.

Format per category:

```
? Database
  - PostgreSQL: relational, strong consistency, mature. Trade-off: schema up front.
  - MongoDB: flexible documents. Trade-off: weak for relational/transactional data.
  Recommended: PostgreSQL. The entities are relational with billing transactions.
```

## Rule 6: Store the decision as data, not prose (BLOCKING)

On confirmation, persist the stack in THREE places, all in the same change:

1. `AI_DOCS/memory/stack.md` (the canonical machine-read store every skill reads):
   the confirmed names in frontmatter PLUS a `## Selection rationale` section with,
   per category, the reason chosen, the alternatives considered, and a revisit
   trigger (the condition that would reopen the choice). Plus `stack_confirmed: true`
   and `stack_confirmed_date`.
2. A stack ADR in `AI_DOCS/architecture/adrs/` capturing options considered, the
   decision, and the architecture reasoning (Rule 4).
3. A `decision-log.md` row (Question / Options considered / Decision / Why /
   Decided by / Affected).

The client-facing workscope Deliverables section is NOT a substitute for `stack.md`.
Writing the stack only to the deliverable, the old behavior, leaves the canonical
store empty and is a defect.

## Rule 7: Versions verified online, never from memory (BLOCKING)

When a specific version is recorded (in `stack.md` or tech-spec S16), verify the
current LTS/stable version online at selection time. Do not write a version number
from training-cutoff memory. A stale "latest" version is a defect.

## Rule 7b: UI component library + app-shell base is a first-class stack decision (web frontends)

For any project with a web frontend, the UI component library and the app-shell base are selected here, not improvised at build time. They are what the locked app-shell (Track H) is built on, so a vague choice produces a vague shell and the design degrades to "only colors" in code.

- **Default: shadcn/ui + Radix.** It gives enterprise speed, accessible data-table and forms out of the box, and full design-token control (you own the code, theming and white-label stay free). Recommend it unless a signal argues otherwise.
- **Bespoke-from-tokens** only when a distinctive visual identity or a white-label requirement genuinely needs it. This is slower and owns more accessibility surface, so it requires a logged justification (the requirement signal that chose it).
- Record the choice in `stack.md` (`## Libraries (locked) -> UI`) and in the stack ADR, same as every other category. The selection feeds `/do` Phase 1 Stage 0, which builds, craft-reviews, and LOCKS the shell on this base before any feature screen.

## Rule 8: Changing a confirmed stack goes through change control

Once `stack.md` shows `stack_confirmed: true`, the stack is locked. A change
requires `/ask` confirmation, a new `decision-log.md` row, and an updated or
superseding ADR. A revisit trigger firing (Rule 6) is the normal, expected reason to
reopen it, not a failure.

## Rule 9: Code to the installed and declared stack (adoption, BLOCKING)

Choosing the stack is not enough. The code must actually USE it. Before writing any
frontend or backend code, read BOTH the declared stack (`AI_DOCS/memory/stack.md`) AND
the dependency manifest that shows what is actually INSTALLED (`package.json` for
JS/TS, `pyproject.toml` / `requirements.txt` for Python, `go.mod` for Go, `pom.xml` /
`build.gradle` for Java, `composer.json` for PHP), then write the code with the
detected libraries, not a generic pattern. Detect and adopt, per concern:

- **Forms:** `react-hook-form` if installed (never a hand-rolled `useState` form).
- **Form validation:** `zod` (+ `@hookform/resolvers`) if installed, shared client and server.
- **Server state, data, and mutations:** `@reduxjs/toolkit` -> RTK Query (`createApi` + the generated `useXQuery` / `useXMutation` hooks). Otherwise `@tanstack/react-query` or `swr`, whichever is installed. Never raw `fetch`-in-`useEffect` when a data layer is installed.
- **Global / shared client state:** the installed one (`@reduxjs/toolkit` slice, `zustand`, `jotai`), not a parallel ad-hoc store.
- **HTTP client:** the installed one (`axios` instance vs a `fetch` wrapper), centralized.
- **UI library:** the installed one (`shadcn/ui` + `radix`, `@mui/material`, `antd`), reused, not re-built.
- **ORM / DB client:** the installed one (`prisma`, `drizzle-orm`, `typeorm`, `sqlalchemy`, `mongoose`), not raw SQL strings when an ORM is present.
- **Backend framework:** the installed one (`@nestjs/*` vs `express`, `fastapi` vs `django`), following its idioms.
- **Test runner:** the installed one (`jest` vs `vitest`, `pytest`).

Two failure modes this rule blocks:

1. **Installed-but-unused (a defect, adopt it).** A core declared/installed library that is not used where it should be is wrong code, even if it compiles: RTK Query is installed but a screen fetches with raw `fetch` in `useEffect`, or `react-hook-form` is installed but a form tracks fields with `useState`. Use the installed library. The `code-reviewer` agent flags these and names the exact change, and `drift-detector.sh` Phase H surfaces the obvious cases.
2. **Installed set disagrees with `stack.md` (reconcile, do not guess).** If the manifest and the declared stack contradict each other (the manifest has `@tanstack/react-query` but `stack.md` says RTK Query, or a second form library is installed), do NOT silently pick one. Flag the mismatch and route to `/change-request` or ask the user so the declared stack and the installed packages are reconciled in one place.

A library that is genuinely chosen NOT to be used for a concern is recorded in `stack.md` rationale, so absence is a decision, not an oversight.

**Enforcement (mechanical, not prose):** four gates carry this rule. (1) `/build`'s dependency gate blocks an ADDED package that this task's diff never imports (added-must-be-used). (2) The Phase 2 `/audit` check 12 runs the whole-tree unused scan (`knip`/`depcheck` for JS/TS, `deptry` for Python, `go mod tidy` diff for Go): an unused production dependency is CONCERNS at audit and FAIL at ship without a logged exception. (3) `drift-detector.sh` Phase H findings (installed-but-unused core libs) block milestone close until adopted or removed. (4) The `builder` agent must name the installed library covering a concern before hand-rolling it, and `code-reviewer`'s adoption dimension flags misses with the exact change.

---

## Verification (what Gate 1 and /audit check)

- `stack.md` exists, has `stack_confirmed: true`, the confirmed names, and a
  `## Selection rationale` section with a reason + alternatives + revisit trigger per
  category. Blank or names-only -> Gate 1 FAIL (non-POC).
- A stack ADR exists in `AI_DOCS/architecture/adrs/` (every project). Missing ->
  Gate 1 FAIL (non-POC).
- A `decision-log.md` row records the stack decision. Missing -> CONCERNS.
- No `(recommended)` stack label appears before requirements are read in any
  intake skill (`/do`, `/plan`). Found -> defect.
- Recorded versions match current LTS (spot-check). Stale -> CONCERNS.
- For POC (`planning_depth: poc`): the thin pick is recorded and marked `poc`. The
  rationale/ADR requirements are waived, not the recording.

<!-- Version: 1.0.0 (2026-06-23): initial tech-stack-selection rule: requirement-first, no house default, architecture-lens drill, store as data + ADR -->
<!-- Version: 1.1.0 (2026-06-29): added Rule 7b — UI component library + app-shell base as a first-class stack decision (default shadcn/ui + Radix, bespoke only with logged justification); feeds Track H locked app-shell -->
<!-- Version: 1.2.0 (2026-06-29): added Rule 9 — code to the installed and declared stack (adoption, BLOCKING): read package.json/pyproject + stack.md, use the detected libs (RHF, RTK Query, ORM, UI lib, test runner), installed-but-unused is a defect, a manifest-vs-stack.md mismatch routes to /change-request; enforced by code-reviewer + drift-detector Phase H -->
<!-- Version: 1.3.0 (2026-06-29): widened Rule 5 category coverage to the full TECH-OPTIONS menu (API style, ORM, auth provider, BaaS, async/queue, desktop, additional backend languages); Go backed by go-rules.md + go-specialist agent, Desktop backed by desktop-rules.md; stack.md template gained the matching decision keys -->
<!-- Version: 1.4.0 (2026-07-09): Rule 9 gains the mechanical enforcement pointer: /build added-must-be-used gate, /audit check 12 whole-tree unused scan (knip/deptry/go mod tidy, FAIL at ship), drift Phase H blocks milestone close, builder adopt-before-hand-rolling contract (PLAN-execution-quality Track B) -->
<!-- Version: 1.4.1 | 2026-08-05 | Rule 1's requirement-document bullet now points to the canonical location: AI_DOCS/requirements/ sources, or AI_DOCS/planning/requirements-baseline.md once finalized -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
