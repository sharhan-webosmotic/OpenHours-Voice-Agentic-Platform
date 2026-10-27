---
description: Core development rules — enforces spec-first coding, clean architecture, and git discipline
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.py"
  - "**/*.dart"
  - "**/*.go"
---

# Core Development Rules

## Plan-First Protocol (BLOCKING)

Every non-trivial task (feature, bug fix, refactor, migration) MUST start as a row in the active milestone's `AI_DOCS/milestones/M<NN>-<slug>/tasks.md`. For multi-chunk tasks (5+ steps or > 2h), `task-planner` creates a supplementary plan at `AI_DOCS/planning/tasks/active/<slug>/plan.md` referenced from the tasks.md row.

1. **Before writing code**: `/do` reads the active milestone's `tasks.md` and picks the next task. If acceptance is multi-chunk, it dispatches `task-planner` to create the chunked plan file. Otherwise `/build` executes the row directly.
2. **During work**: after completing each chunk (or the whole task for simple ones), update the milestone's `tasks.md` row Status (TODO → DOING → DONE/BLOCKED) and Verify column immediately. This is the crash-recovery checkpoint — if the session closes, the next session resumes from `session-state.md` and the active capsule via `hooks/session-start.sh`.
3. **After completion**: re-verify every acceptance criterion with a fresh command run, then stamp Status=DONE in `tasks.md` and (for chunked tasks) move the plan folder to `AI_DOCS/planning/tasks/completed/<slug>/`. Update milestone progress in the global `task-ledger.md`.
4. **Never mark a chunk or task complete without running its verification command and reading the output.**

Exceptions (no plan file required):
- Typo fixes, one-line changes, simple renames
- Read-only exploration / answering questions

> Full protocol: `skills/task-planner/SKILL.md`. For milestone-scale feature sets, use `skills/feature-delivery/SKILL.md`.

## Spec-First (The Law)

1. **Every code change must trace to `AI_DOCS/planning/tech-spec.md`**
   - No ghost features — if it's not in the spec, don't build it
   - If a feature is needed but not in spec: STOP, run change-request skill first

2. **Read the relevant spec section BEFORE coding**:
   - UI work: Read Section 5 (UI/UX Specification)
   - API work: Read `AI_DOCS/architecture/api-contract.md`
   - Data work: Read Section 7 (Data Model/Schema)
   - Logic work: Read Section 8 (Business Logic Rules)
   - Edge cases: Read Section 9 (Edge Cases)

## Architecture

3. **Separation of concerns** — every file has ONE responsibility:
   - Controllers handle HTTP
   - Services handle business logic
   - Repositories handle data access
   - Components handle UI rendering
   - Hooks handle reusable logic
   - Utils handle pure utility functions

4. **No circular dependencies** — if A imports B, B must not import A
5. **No god files** — any file over 300 lines should be split
6. **No god functions** — any function over 50 lines should be decomposed

## Naming Conventions

7. **Files**: kebab-case (`user-profile.service.ts`, `login-form.tsx`)
8. **Components**: PascalCase (`UserProfile`, `LoginForm`)
9. **Functions/methods**: camelCase (`getUserById`, `handleSubmit`)
10. **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`, `API_BASE_URL`)
11. **Types/Interfaces**: PascalCase with descriptive names (`CreateUserDto`, `UserResponse`)
12. **Boolean variables**: prefix with is/has/can/should (`isLoading`, `hasPermission`)

## Code Quality

13. **No `any` type in TypeScript** — use proper types or `unknown` with type guards
14. **No `console.log` in production code** — use a proper logger
15. **No commented-out code** — delete it, git has history
16. **No TODO comments without a ticket/task reference**
17. **No magic numbers or strings** — extract to named constants
18. **No nested callbacks beyond 2 levels** — use async/await or extract functions

## Code Comments & Documentation (BLOCKING)

The default is **no comments**: code communicates through naming and structure, because a comment can drift from the code it describes and nobody notices until it misleads someone. Explanation, rationale, and context belong in `AI_DOCS/`, not in the source, so they stay discoverable across sessions instead of scattered through diff history.

- **C1. Docstrings/JSDoc are mandatory on every function, class, and exported symbol**, because a docstring is the one form of in-code documentation a reader or a tool can rely on without opening the implementation. TS/JS: a JSDoc block (`/** ... */`) describing purpose, params, and return on each function and exported type. Python: module + class + function docstrings per `python-rules.md`. This is the one form of in-code documentation that is required.
- **C2. Let the code itself carry the explanation, with one exception for inline comments.** Do not narrate what the code does: a comment that restates the next line goes stale the moment the code changes and the comment doesn't. The only allowed inline comment is for genuinely non-obvious logic that the code itself cannot make clear: a tricky calculation, a unit/time-zone conversion, a non-trivial algorithm, or a deliberate workaround. When you write one, explain the *why*, not the *what*, in one line.
- **C3. Delete commented-out code instead of leaving it in place.** Git already holds the history, and a dead block left behind reads as ambiguous, disabled on purpose or simply forgotten.
- **C4. Track pending work as a row in the active milestone's `tasks.md`, not as a `TODO`/`FIXME` left in code.** A row on the task board stays visible, a comment buried in a file is easy to ship past.
- **C5. Context goes to AI_DOCS, kept up to date.** Design decisions, trade-offs, "why it works this way", and feature notes live in `AI_DOCS/planning/` (spec, task plan, chunk notes) and `AI_DOCS/memory/decision-log.md`. When you change behaviour, **update the relevant AI_DOCS document in the same change** rather than adding an explanatory comment to the code, because a comment explaining behavior that already changed is worse than no comment. Documentation drift is treated like a failing test.

> Applies to every code-writing skill. Skills carry a one-line pointer to this section; this file is the single source of truth.

## Error Handling

19. **Handle errors at the boundary** — not in every function
    - **Upload / async operation state machines**: if an operation sets a record to an intermediate state (e.g., `status: "processing"`), the code MUST include a recovery path for crashed sessions. Either: (a) a timeout + auto-reset to the previous stable state, OR (b) an idempotency key that allows re-submitting the same operation. A page that crashes during upload and shows a permanently-stuck "in progress" state on refresh is a P1 bug.
20. **Use custom error classes** for domain errors (NotFoundError, ValidationError)
21. **Never swallow errors** — at minimum, log them
22. **Always have a fallback UI** for error states (error boundaries in React)

## Git Discipline

23. **Feature branches**: `feat/mN-[feature-name]` from the current milestone branch
24. **Commit messages**: `type(scope): description` (feat, fix, refactor, test, docs, chore)
25. **One feature per branch** — don't mix unrelated changes
26. **Commit often** — small, atomic commits are better than large dumps

## Dependencies

27. **Check existing dependencies before adding new ones** — avoid duplicating functionality
28. **Prefer well-maintained packages** with active communities
29. **Pin major versions** — avoid breaking changes from auto-updates
30. **Never install packages globally** for project-specific tools — use npx or devDependencies
31. **Verify LTS/stable versions online BEFORE writing them to any document** — tech-spec, scope doc, guardrails, `package.json`, `Dockerfile`, CI workflow (`.github/workflows/`), or any config file. Do NOT rely on training-cutoff knowledge.
    - **Sources**: `nodejs.org/releases`, `endoflife.date`, `npm view <pkg> version`, `pypi.org/project/<pkg>`, official release pages
    - **Required checks**: Runtime LTS (Node, Python, Java, Go), major framework version (React, Next.js, FastAPI, Spring), database engine, Docker base images, CI action versions
    - **Exception**: If the user explicitly pins an older version, record the reason in `AI_DOCS/memory/decision-log.md`
    - **Never write a version number from memory** — if offline and unable to verify, ask the user or mark it `<LTS-TBD>` and resolve before Gate 1

## Environment

32. **All configuration from environment variables** — never hardcode URLs, keys, or secrets
33. **Use `.env.example`** to document required variables (without values)
34. **Validate env vars at startup** — fail fast if required vars are missing
35. **Every env var used in code must exist in `.env.example`** with a description comment
36. **Never commit `.env`** — only `.env.example` is committed to git

## UI Consistency (BLOCKING for all frontend work)

These rules apply to every file in `src/`, `app/`, `components/`, `screens/`, or `pages/`.

### Button Consistency
- **All clickable actions MUST use the `<Button>` component** — never style a raw `<button>`, `<a>`, or `<div>` to look like a button
- **Button variants are defined in `AI_DOCS/design/design-dna.md`** — only use: `primary`, `secondary`, `destructive`, `ghost`, `outline`, `link`
- **Do not create one-off button styles** — if a new variant is genuinely needed, propose it in `design-dna.md` first

### Spacing Consistency
- **All spacing MUST use values from the design system scale** defined in `AI_DOCS/design/design-dna.md`
- **No arbitrary pixel values** — `mt-[13px]`, `padding: 7px`, `gap: 11px` are BLOCKED
- **Use design tokens or the Tailwind/CSS spacing scale** declared in design-dna (e.g., `mt-4`, `p-6`, `gap-3`)
- If a spacing value does not exist in the scale, it is wrong — use the nearest declared value

### Component Reuse (Pre-Build Check)
- **Before building any new UI element**: check `AI_DOCS/design/component-registry.md` for an existing equivalent
- **If a similar component exists**: extend it via props/variants — do not create a duplicate
- **If a genuinely new component is needed**: announce it in chat before coding: `"New component: [Name] — reason: [why no existing component fits]"`
- **All new components must be registered** in `component-registry.md` before marking the task complete
- Full rules: `.claude/rules/component-reuse-rules.md`

### Design Inventory (REQUIRED before any UI coding session)
1. Read `AI_DOCS/design/design-dna.md` — confirm spacing scale, button variants, color tokens
2. Read `AI_DOCS/design/component-registry.md` — find existing components for this feature
3. Identify 1–3 similar existing pages/screens — confirm button styles, spacing, layout patterns match
4. List: which components will be **REUSED** vs which are genuinely **NEW**

> Skipping the design inventory is a FAIL in code review.

## Pre-Commit Quality Gate

37. **Husky + lint-staged is MANDATORY** — must be set up during project scaffolding
38. **ESLint runs with `--max-warnings 0`** — any warning blocks commit
39. **Prettier runs on all staged files** — auto-format before commit
40. **No `--no-verify`** — never skip pre-commit hooks
41. **`// eslint-disable` is banned** — never write `// eslint-disable`, `// eslint-disable-next-line`, `// eslint-disable-line`, or `/* eslint-disable */`. Solve the rule's real cause so the code passes honestly. If the only ways to satisfy the linter are a disable comment or a behavior-changing rewrite, stop and raise it with the user.

## Docker Rules

42. **Always use pinned image tags** — never `FROM node:latest` or `FROM python:latest` in production Dockerfiles
    - Use: `FROM node:20.18-alpine`, `FROM python:3.12-slim`
    - Verify the current LTS tag at hub.docker.com before writing any Dockerfile
43. **Check before pulling** — before running `docker pull`, check if the image already exists locally:
    ```bash
    docker images [image:tag] --format "{{.Repository}}:{{.Tag}}"
    # If output is non-empty, the image exists — do not pull again
    ```
44. **Multi-stage builds required** for production images — keep final image as small as possible
45. **No secrets in Dockerfiles** — use `--build-arg` only for non-sensitive config; use runtime env vars for secrets
46. **Never use `docker run` with `--privileged`** in development scripts — document the reason if required

## Email Templates & Environment URLs (BLOCKING)

47. **Every URL embedded in an email template (verification link, password-reset link, invitation link, notification link) MUST be constructed from an environment variable** — the canonical variable is `FRONTEND_URL` (or `APP_URL` / `BASE_URL` as declared in `.env.example`). Never hardcode `http://localhost`, `http://127.0.0.1`, or any fixed domain in an email template, notification payload, or webhook callback URL. A hardcoded localhost URL that reaches a user's inbox is a P0 bug.

    ```
    # Public base URL of the frontend — used in email links and redirects.
    # Example: https://app.yourproduct.com
    FRONTEND_URL=
    ```

## Time & Timezone Handling (BLOCKING)

48. **Every moment in time is stored as a timestamp WITH timezone, normalized to UTC.** Postgres: `timestamptz`, never `timestamp without time zone`. MySQL: `TIMESTAMP` (UTC-normalized) or epoch millis. MongoDB: `Date` (UTC by definition). A naive datetime anywhere in the pipeline (a Python `datetime` without `tzinfo`, a DB column without timezone semantics, a string like `2026-08-06 14:30` with no offset) is a defect, not a style choice: it silently shifts meaning the moment a second timezone touches it.

49. **Always prefer a timestamp over a date.** `created_at`, `updated_at`, `deleted_at`, `published_at`, `expires_at`, `scheduled_for`: all timestamps with timezone. A date-only column is allowed ONLY for a genuine calendar concept that has no clock meaning (date of birth, a public holiday, a policy due-date), and the choice is documented in the schema notes. When unsure, it is a timestamp.

50. **API contract: ISO 8601 with an explicit offset.** Serialize as `2026-08-06T14:30:00Z` (or `+05:30`), parse rejecting offset-less strings at the trust boundary (zod/pydantic validators). Never exchange local time without an offset, never mix epoch-seconds and epoch-millis in one API.

51. **Convert at the display edge only.** Store and compute in UTC. Convert to the viewer's timezone in the UI layer using their IANA zone name (`Asia/Kolkata`), never a fixed offset (offsets break on DST). When the product schedules things in the user's local time (reminders, recurring events, business hours), persist the IANA zone ALONGSIDE the UTC timestamp so DST transitions resolve correctly.

52. **Language footguns:** Python: `datetime.now(timezone.utc)`, never `datetime.utcnow()` (returns naive). JS/TS: `Date` is UTC internally, format with `Intl.DateTimeFormat` or the project's date lib in explicit-zone mode, never build datetimes by string concatenation. SQL: compare `timestamptz` to `timestamptz`, never to a zone-less literal. Tests stub the clock (testing-rules 19e) and assert on instants, not local-formatted strings.

## Types, Contracts & File Structure (absorbed from code-rules.md A and B)

53. **One default export per file, named after the file.** Use the configured path alias (`@/`) instead of relative imports deeper than `../..`. One concept per file (see rule 5 for the size limit).
54. **TypeScript `strict: true` is non-negotiable.** `any` appears only in test fixtures (rule 13 governs everything else).
55. **API request and response types live next to the route handler** and are referenced from `AI_DOCS/architecture/api-contract.md`.
56. **Validate at trust boundaries**: zod (TS) or pydantic (Python) for every public API input. Never trust client data.
57. **Database types come from the schema** (Prisma generated types, SQLAlchemy declarative, and so on). Never hand-write parallel types.

## Errors & Logging (absorbed from code-rules.md C)

58. **Throw typed errors with a code**: `class AppError extends Error { constructor(public code: ErrorCode, msg: string) }`. Never throw bare strings. The API error envelope is owned by `api-rules.md`.
59. **Log at info for success-significant events, warn for recoverable issues, error for caught exceptions.** Never log secrets, tokens, PII, or full request bodies for sensitive endpoints.
60. **Use a structured logger** (pino, winston, structlog). No `console.log` outside scripts and tests (rule 14).

## Performance & Bundle, web (absorbed from code-rules.md H)

61. **Defer below-the-fold work**: lazy-load images and code-split components per route.
62. **One framework-level data-fetching strategy per project** (RSC, SWR, React Query), chosen in `stack.md`.
63. **Bundle budget**: warn at 150kb gzipped per route, fail at 250kb.

## Database (absorbed from code-rules.md J)

64. **Migrations are append-only.** Never edit an applied migration, add a new one.
65. **Index every foreign key**, every column used in the `where` of a frequent query, and every `(parent_id, created_at)` pair used for paginated lists. A missing FK index is a FAIL in `schema-validation`.
66. **Soft deletes via `deletedAt` only when a hard delete would lose business value.** Default to hard delete.
67. **Every user-sortable text column declares an explicit collation intent that matches its siblings.** This applies going forward, when a sortable column is created or changed, and is not a mandate to re-migrate existing columns. Mixing a case-insensitive type for some name and label columns with the engine default for others sorts inconsistently between screens, and the report arrives as a broken sort on whichever screen the user noticed first. The wiring looks correct because an ORM's case-insensitive mode applies to filtering, never to ordering. Declare it when the column is created.
68. **Time columns follow Time & Timezone Handling (rules 48-52).**

## Code Review Conduct (absorbed from code-rules.md L)

69. **Read the diff start to end before commenting.**
70. **Flag**: hardcoded values, untested branches, missing input validation, broad `try/catch` that swallows errors, n+1 queries, missing indexes, unused props and variables.
71. **Suggest the smallest possible fix.** Do not request architectural rewrites in a feature PR.

## Equality, Nullish Checks & Lint Discipline (absorbed from code-rules.md N)

72. **Use strict equality `===` / `!==` everywhere.** ESLint runs `eqeqeq` at full strength (`["error", "always"]`) with no `null` exemption. To test "null or undefined" write `x === null || x === undefined`, which is behavior-identical to the old `== null` idiom. When assigning a fallback, prefer `x ?? fallback` or `x?.y`. Never write `x == null` / `x != null`, and never collapse the two-operand check to a single `x !== null`, which lets `undefined` through and is a bug.
73. **A linter autofix is not automatically correct.** Never blind-apply `eslint --fix` or a quick-fix for rules that can change runtime behavior: `eqeqeq`, `no-unused-vars` (removing a still-public export), `no-param-reassign`, `prefer-const` near a TDZ, `no-fallthrough`. Read the diff and confirm intent first.
74. **Suppression is banned on every stack** (extends rule 41). Solve the rule's real cause so the tool passes honestly, and never relax a rule in config to let bad code through. Banned forms:
    - TypeScript / JavaScript: `// eslint-disable*`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`. Never cast to `any` to dodge a type error.
    - Python: `# noqa`, `# type: ignore`, `# pyright: ignore`, `# pylint: disable`, `# ruff: noqa`, `# mypy: ignore-errors`, `# fmt: off`.
    - Go: `//nolint`, `//nolint:<linter>`. Rust: `#[allow(...)]`, `#![allow(...)]`, `// clippy:allow`.
    - Java / Kotlin: `@SuppressWarnings(...)`, `@Suppress(...)`, `// detekt:disable`. Swift: `// swiftlint:disable`, `// swiftlint:disable:next`.
    - Dart / Flutter: `// ignore:`, `// ignore_for_file:`. CSS: `/* stylelint-disable */`, `/* stylelint-disable-next-line */`.
75. **Escalate instead of suppressing.** If the only ways to satisfy a tool are a suppression comment or a behavior-changing rewrite, stop and raise it with the user via `/ask`. A rewrite that changes runtime behavior is a bug, not a lint fix.
76. **Pre-existing lint or type debt outside your change is not yours to autofix blindly.** A genuinely safe one-liner: fix it and say so. Anything needing judgment: leave it and note it. Do not widen the blast radius.
77. **Prefer `??` and `?.` over `||` / `&&` when the intent is "null or undefined"**, so `0`, `""` and `false` are not treated as absent. Python: use `is None` / `is not None`, never `== None`, and compare identity for singletons.

## Correctness Footguns (absorbed from code-rules.md O)

78. **Immutability**: `.sort()`, `.reverse()` and `.splice()` mutate in place, so copy first (`[...arr].sort()`). Never mutate React state, props, or a function's input arguments.
79. **Async**: never leave a promise floating. `await` it, `return` it, or explicitly `void` it. Do not pass an `async` callback to `Array.forEach` (use `for...of` with `await`, or `Promise.all(map(...))`). Use `Promise.allSettled` when one rejection must not abort the rest.
80. **Numbers**: `parseInt(x, 10)` always with a radix. Guard `NaN` with `Number.isNaN`, not the global `isNaN`. Never compare floats with `===`, use an epsilon.
81. **Type safety**: do not silence the checker with `!` or `as` casts. Narrow with a runtime guard so the check holds at runtime.
82. **Exhaustiveness**: a `switch` or if-chain over a union ends with a `default` that calls `assertNever(x: never)`, so a new variant fails the build.
83. **Boundary data is untrusted**: parse external JSON and responses through zod or pydantic before use. A typed shape from `JSON.parse` is unvalidated until proven (reinforces rule 56).

## Handled by other rules (code-rules.md sections dropped as duplicates)

- Security baseline (cookies, auth middleware, parameterized SQL, XSS, CORS, rate limits): `security-rules.md`.
- Design tokens, component reuse, accessibility: `component-reuse-rules.md`, `ui-engineering-rules.md`, `design-rules.md`, and the UI Consistency section above.
- Test discipline and the 98% coverage floor: `testing-rules.md` (Rule 7 / 7a).
- Conventional commits and git hygiene: Git Discipline above (rules 23-26, 40).
- AI safety (never invent paths, packages or APIs, never claim tests pass unrun): `ai-safety-rules.md`.
- Comments and documentation: Code Comments & Documentation above (C1-C5).

<!-- Version: 1.5.0 — 2026-06-03 — Added Code Comments & Documentation section (C1-C5): docstrings/JSDoc mandatory, no inline comments except complex logic, no commented-out code, context lives in AI_DOCS and is kept up to date -->
<!-- Version: 1.4.0 — 2026-05-01 — Added Email Templates & Environment URLs (Rule 47): FRONTEND_URL mandatory for all email links; upload state machine recovery note on Rule 19 -->
<!-- Version: 1.5.0 — 2026-06-24 — Rule 41: eslint-disable banned outright (was: allowed with explicit user approval); solve the rule's cause or escalate via /ask -->
<!-- Version: 1.3.0 — 2026-04-17 — added Plan-First Protocol section (active-task.md workflow, task-planner integration, crash-recovery checkpoint) -->
<!-- Version: 1.2.0 — 2026-04-14 — added UI Consistency rules: button, spacing, component reuse, design inventory -->
<!-- Version: 1.6.0 | 2026-08-06 | Added Time & Timezone Handling (Rules 48-52, BLOCKING): timestamps with timezone normalized to UTC everywhere (timestamptz, never naive datetimes), prefer timestamp over date (date-only needs a documented calendar-concept reason), ISO 8601 with explicit offset at the API boundary, convert at the display edge via IANA zones, per-language footguns -->
<!-- Version: 1.7.0 | 2026-08-20 | positive-direction phrasing pass, constraints unchanged -->
<!-- Version: 1.8.0 | 2026-10-22 | v4.32.0 merge: absorbed rules/code-rules.md (removed). Added rules 53-83 (types and contracts, errors and logging, bundle budget, database, code review conduct, equality and lint discipline, correctness footguns). Security, tokens, tests, git and AI-safety sections dropped as duplicates with pointers. Former code-rules letters: B=53-57, C=58-60, H=61-63, J=64-68, L=69-71, N=72-77, O=78-83 -->
