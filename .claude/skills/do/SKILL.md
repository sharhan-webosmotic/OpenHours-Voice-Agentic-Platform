---
name: do
description: "The ONE skill you talk to. Handles everything: planning, building, verifying, auditing, and shipping. Always plans first (mandatory intake), then builds task by task, asks questions inline when stuck. FIRES on any coding/building/fixing/shipping request. DOES NOT FIRE on pure questions ('how do I…', 'explain…', 'what is…')."
effort: xhigh
skill_id: SK-100
version: 6.30.0
allowed-tools: "Read Grep Glob Task Edit Write Bash"
context_budget:
  load_kb: 20
  scope: session
dependencies:
  required: []
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: meta
  patterns: [conversational, sequential, autonomous-loop]
  user_facing: true
  role: "single-entry-point"
---

# /do — One Skill, Full Lifecycle

> Talk to /do like a teammate. It plans first (mandatory), then builds, audits, and ships, asking questions when it genuinely needs them.
>
> **/do is the orchestrator, not a monolith.** It is the ONLY skill the user talks to. Phase 0 (Plan) is fully dispatched: /do invokes the specialist planning skills via real Skill calls and enforces Gate 1 between them. It does NOT reimplement planning inline. Phases 1-3 (Build, Audit, Ship) are /do-managed: it runs the verify, audit, and ship loops directly while dispatching the `code-reviewer` agent and any armed specialist skills (per the Activation Map) as each task requires. The dispatch table lives in each Phase below.
>
> **Why this matters:** the framework ships rich planning skills (`tech-specification`, `design-screens`, `prd-generation`, `architecture`, `infra-planning`, `milestone-planning`). A 6-question intake cannot replace them. /do runs them so that field mapping, the API-to-UI contract lock, RBAC, data-flow, compliance, infra, scalability, and traceability are actually produced before any code is written.

---

## Bootstrap (every invocation)

Read in order. Stop at the first matching condition and jump to that phase.

| Check | Action |
|---|---|
| `AI_DOCS/memory/project-context.md` missing | → **Phase 0: Plan** (no project yet) |
| `AI_DOCS/memory/task-ledger.md` missing | → **Phase 0: Plan** (incomplete init) |
| `AI_DOCS/memory/session-state.md` exists | Read it for active milestone + task |
| Active milestone capsule has a DOING row in `tasks.md` | → **Phase 1: Build** (resume) |
| User message is a clear imperative ("do this", "start", "build X", "fix Y") | → **Phase 0: Plan** if no project; else **Phase 1: Build** |
| User message is a trivial one-sentence change on an existing, Gate-1-passed project (typo, comment, log line, copy tweak, single-variable rename in one file) | → **Micro-task fast lane** (see below) |
| User says "audit" | → **Phase 2: Audit** |
| User says "ship" or "deploy" | → **Phase 3: Ship** |
| User says "status" | → Print status and stop |

After reading state, announce in one line: "Resuming M<NN> / T-<NN>: <title>." or "Starting fresh — planning first."

---

## Micro-task fast lane (trivial one-sentence changes)

The anti-overkill lane. Full planning and the full nine-check verify battery are wrong for a typo. Best practice: if you could describe the diff in one sentence, skip the plan. This lane runs ONLY when ALL of these hold:

- The project already exists (`project-context.md` present) and Gate 1 is PASSED (or `planning_depth: poc`).
- The change is describable in one sentence and touches exactly ONE file.
- It is cosmetic or trivially local: typo, comment, log line, string/copy tweak, a single-variable rename within a file, a spacing/color value that is already a design token, or a non-secret config value.

It is NEVER eligible (route to the normal Phase 1 Build loop instead) when the change:

- touches a locked artifact (`api-contract.md`, `database-schema.md`, `authz-matrix.yaml`, the locked app-shell),
- touches auth / RBAC / permission logic, a DB migration, infrastructure, or a package manifest / lockfile,
- spans more than one file, or you are not certain it is one file,
- adds or changes a feature, endpoint, or data shape (that is a `change-request`, not a chore).

Flow:

1. Announce in one line: "Micro-task: <desc> — fast lane."
2. Open a lightweight DOING row so routing enforcement (`enforce-do-routing.sh`) passes and the change is on the record: add `chore: <desc>` to the active milestone's `tasks.md` (or an `M00-chores` capsule if no milestone is active), Status=DOING, Notes="micro-lane".
3. Make the focused edit. One file. No scope widening.
4. Run the SAFETY FLOOR (always, non-negotiable):
   - Typecheck (`tsc --noEmit` / `mypy`).
   - Scoped test: the tests covering the touched file/module.
   - Secrets scan on the diff (the Phase 2 secret patterns).
   Plus the token gate if the one file is a UI file. (API/RBAC-touching changes are excluded above, so their gates never apply here.)
5. On PASS: Status=DONE, Verify col = "✓ tsc ✓ test ✓ secrets (micro-lane)", append a Verification-log row. A one-line change does not require a `code-reviewer` dispatch: the floor is the gate, skip the review.
6. On FAIL, or if the edit turned out to touch more than one file or a locked artifact: abandon the fast lane, convert the chore row to a normal task, and fall into the Phase 1 Build loop (full verify battery + bounded auto-fix). Never force-pass the floor.

Ambiguity rule: if you cannot confidently place the change in this lane, it does not belong here. Default to the normal Build loop.

---

## Phase 0 — Plan (mandatory first step on any new project or requirement)

**Never skip this phase** when the project is new. If a project already exists, briefly confirm: "I see a project in AI_DOCS/. Continuing from where we left off? Or starting fresh? [continue/fresh]"

Phase 0 is **orchestrated**: /do collects routing inputs, then dispatches the specialist planning skills in order, then enforces the Planning Completeness Gate before any code is written. /do does NOT seed milestones from a 6-question guess any more. Milestones are seeded from the approved spec.

### Step 0.5 — Requirement intake (files first)

Before asking the user anything, look for the client's documents on disk:

1. **Legacy migration**: if a root-level `requirement.md` exists, move it to `AI_DOCS/requirements/requirement.md`, announce the move, and append a migration note to `decision-log.md`.
2. **Scan** `AI_DOCS/requirements/`. Ingest any non-markdown source via the `markitdown` skill (`AI_DOCS/ingested/` + manifest rows link raw to converted).
3. **Route by what is found**:
   - Zero sources: conversational intake only, continue to Step 1.
   - One clean source: read its ingested markdown, use it as the requirement source, and mention `/requirement-finalization` is available if more documents arrive.
   - More than one source, OR contradictions and ambiguities spotted, OR the user mentions conflicting inputs: dispatch `requirement-finalization` BEFORE workscope. Its output, `AI_DOCS/planning/requirements-baseline.md`, becomes the requirement source for Steps 1.7 to 1.9 and every Step 2 skill.
4. **Never re-ask what the documents answer**: Step 1 questions whose answers the sources or the baseline already cover are presented as confirmations, not fresh questions.

### Step 1 — Intake (routing inputs, ≤8 questions, one at a time)

These answers ROUTE the dispatch (which skills run, which sections matter). They do not replace the planning skills, and they do NOT choose the tech stack: stack selection is its own mandatory step (Step 1.7), driven by the requirements per `rules/tech-stack-selection-rules.md`. Ask each, wait, append to `AI_DOCS/memory/decision-log.md`, then ask the next. Every question /do asks inline, here and anywhere later, uses the `/ask` 2.0.0 shape: `Read:` (the file and the exact place), `Wording:` (quoted), `Conflict:` (the scope line or requirement it collides with and why), one `Question:`, and a recommended answer with its reason. Never refer to an item by number without quoting it. A recommendation that adds or changes scope carries the Rule 9 scope line from `rules/advisor-stance-rules.md` (In scope / Out of scope, goes through `/change-request` / No baseline yet). Skip any already answered in the user's opening message or by the Step 0.5 requirement sources (confirm those instead of re-asking).

1. **What is this product, in one paragraph? Who uses it?** *(free text: seeds project-context.md Goal + Users, and the workscope/tech-spec inputs)*
2. **Any stack constraints to feed selection?** *(free text: existing team skills, a mandated technology, an existing codebase to match, budget or ops limits, or "none, recommend the best fit")*. This does NOT pick the stack. It is an input to the requirement-driven selection in Step 1.7. There is no default stack.
3. **Compliance:** hipaa / soc2 / gdpr / pci / none.
4. **Real-time updates needed (live notifications, feeds, collaborative editing, chat)?** yes / no / decide later
   - yes → WebSockets or SSE planned in tech-spec + infra-plan. Polling is NOT an acceptable substitute for real-time features, and it will be flagged as a defect in audit.
   - no → standard HTTP is fine.
   - decide later → record in `decision-log.md`. Do NOT architect features on polling when the requirement says "live".
5. **SDLC methodology:** 1) Agile + Scrum + DevOps *(recommended)* 2) Scrum only 3) Kanban 4) Waterfall
   - The recommended combo runs sprint-sized milestones with CI/CD and continuous monitoring/feedback into the backlog. `rules/sdlc-methodology-rules.md` defines what each choice changes downstream (sprint grouping, CD cadence, iteration vs sequential phases).
   - Store the answer as `sdlc_methodology:` in `project-context.md`. `milestone-planning` reads it to group milestones into sprints (Scrum/Agile) or sequence them (Waterfall).
6. **Branching & release strategy:** 1) One branch per milestone, 3-tier promotion milestone → develop → staging → main *(recommended)* 2) One branch per milestone, 2-tier develop → main (early-stage, no staging) 3) Per-feature branches inside each milestone, 3-tier
   - Under options 1 and 2 all of a milestone's features live on its single `milestone-N` branch (no per-feature branches). Promotion is re-asked at each milestone close (see Milestone close below).
   - Store the answer in `AI_DOCS/deployment/git-strategy.md` and `branching_strategy:` in `project-context.md`. `github-ops` reads it. It is the authoritative branching model for the project.
7. **Platform targets (multi-select):** Web / iOS / Android / Desktop
   - Native targets (iOS/Android) add mobile milestones, mobile design screens, and native E2E (Detox / Flutter integration tests) alongside web. Planning, design, and testing cover every selected surface, not web only. This also feeds the mobile category of Step 1.7 stack selection.
   - Store `platform_targets:` in `project-context.md`. `milestone-planning`, `design-screens`, and `milestone-validation` route per-platform work from it.

If the user says "just go" or "use defaults": fill the NON-stack routing inputs with the recommended options (Agile+Scrum+DevOps, one-branch-per-milestone 3-tier, Web) and skip the remaining routing questions. This NEVER auto-selects a tech stack. Step 1.7 still runs the full requirement-driven selection and confirmation. (The dispatch below still runs in full.)

### Step 1.5 — POC fast-path (the ONLY way to skip full planning)

If the user explicitly says "just a POC", "prototype", "spike", or "quick throwaway":
- If `AI_DOCS/memory/stack.md` does not exist, create it from `templates/stack.md` first. Stamp `planning_depth: poc` in it, and record the thin stack pick (marked `poc`, not requirement-validated) per `rules/tech-stack-selection-rules.md`.
- Skip the Step 2 dispatch. Use the lightweight bootstrap (state files + tokens + a single milestone seeded from the intake).
- Append a `## POC fast-path` note to `decision-log.md` with the user's exact phrase.
- Audit and ship will read `planning_depth: poc` and treat skipped planning as intentional, not a defect.

Otherwise (`planning_depth: standard`), continue to Step 1.7, then Step 1.8.

### Step 1.7 — Tech stack selection (mandatory, non-POC, BLOCKING)

Runs for every `planning_depth: standard` project, ALWAYS, before Step 2. It runs even if the requirement names a stack, a scope doc exists, or the user stated a preference. Never inherit a stack without in-session confirmation. Follow `rules/tech-stack-selection-rules.md`, using the option catalogue in `skills/workscope/TECH-OPTIONS.md`. There is no house default: Next.js, React, FastAPI, NestJS, Postgres, and every other technology are options, never assumptions.

1. **Drill the requirement** for the selection signals: data shape, scale path, real-time, platform targets, team skills, integrations, compliance, ops and budget. Pull them from the product description, the Step 1 constraints answer, and the requirement sources in `AI_DOCS/requirements/` (via `AI_DOCS/planning/requirements-baseline.md` when it exists). Do not wait for the user to volunteer them.
2. **Architecture lens** (every project, single-service included): reason about boundaries, data consistency, the scale path to the 6-month and 1-year targets, failure modes, and operability. The stack must reach those targets by config change, not re-architecture.
3. **Present options + recommendation** per category (frontend, backend, database, mobile if a native target, hosting, UI component library + app-shell base): the viable options for THIS requirement with the trade-off that matters, then one recommendation with a requirement-grounded reason. No `(recommended)` label is pre-attached. The recommendation is earned from the signals.
   - **UI component library + app-shell base (web frontends):** default to shadcn/ui + Radix (enterprise speed, accessible data-table and forms out of the box, full token control). Choose bespoke-from-tokens only when white-label or a distinctive visual identity genuinely requires it, and log that justification. This base is what the locked app-shell (Track H) is built on, so it is a first-class stack decision, not an afterthought. Record it in `stack.md` and the stack ADR.
   - **Frontend is never defaulted (React vs Next.js is a real decision):** decide it from the requirement using the React-vs-Next decision matrix in `TECH-OPTIONS.md`. SEO, public marketing/content pages, SSR/SSG/ISR, or social-share previews → Next.js. Pure authenticated SPA, internal tool, no SEO, fastest build/iteration → React + Vite. Never pick Next.js "because it's modern" nor React "because it's simple": name the signal (SEO? public pages? SSR?) that decides it. The same no-default discipline applies to Vue/Nuxt and Angular.
4. **Confirm**: present the full proposed stack and ask "confirm, change a category, or explore alternatives?". The user can override any category. Record the override reason.
5. **Push back on misalignment**: if a stated preference fights the requirement (relational data forced into a document DB, a SPA where SEO is required, a stack that cannot reach the scale target), say so with the reason, the better-fit alternative, and the concrete cost. Hold the position unless given new information.
6. **Verify versions online** for anything version-pinned (no versions from training-cutoff memory).
7. **Store the decision**, all in this step:
   - Write the confirmed stack to `AI_DOCS/memory/stack.md`: names in frontmatter, `stack_confirmed: true` + date, and a `## Selection rationale` block per category (reason + alternatives considered + revisit trigger).
   - Record a stack ADR via `architecture` in `AI_DOCS/architecture/adrs/` (every project, single-service included).
   - Append a `decision-log.md` row.

This is BLOCKING: the Step 2 dispatch and Gate 1 do not pass without `stack.md → stack_confirmed: true`, the `## Selection rationale` section, and the stack ADR.

### Step 1.8 — Runtime architecture / data-flow selection (mandatory, non-POC, BLOCKING)

Runs immediately after Step 1.7, for every `planning_depth: standard` project, before Step 2. The stack picked the language, framework, database, and host. This step picks how data MOVES and how work EXECUTES: caching, real-time transport, async/background work, API style, and the resilience primitives that make all of it debuggable. Follow `rules/runtime-architecture-rules.md`, using the catalogue in `skills/tech-specification/ARCH-PATTERNS.md`. There is no default infrastructure: no Redis, no queue, no WebSocket, no pipeline is added by habit. The cheapest pattern that meets the requirement wins, and "none / inline / N/A (reason)" is a first-class answer.

1. **Drill the requirement** for the runtime signals: latency tolerance (how fresh must the view be), work duration (does anything exceed the request budget), hot reads (same expensive read served repeatedly), fan-out and bursts, delivery guarantee (can a dropped job lose money/data/trust), concurrency/consistency, and the scale path from S12. Pull them from the product description and the requirement sources (`AI_DOCS/planning/requirements-baseline.md` when it exists, else `AI_DOCS/requirements/`).
2. **Decide the five axes as one topology** (Rule 4), not piecemeal: Caching, Real-time transport, Async/background work, API interaction style, Resilience primitives. They interact: a chosen queue forces idempotent handlers + retry + dead-letter; a chosen cache forces invalidation + stale-tolerance; a chosen socket forces auth-on-connect + reconnect.
3. **Present options + recommendation** per axis in scope (`ARCH-PATTERNS.md` format): viable patterns with the trade-off and the cost, then one requirement-grounded recommendation, including "none / inline / N/A" when no signal earns the infrastructure.
4. **Confirm** the full data-flow topology: "confirm, change an axis, or explore alternatives?". The user can override any axis; record the reason.
5. **Push back on misalignment** (Rule 2): a queue for a synchronous lookup, Redis with no hot read, a socket for minute-stale data → say so with the cost. The mirror failure is equally blocked: polling where the requirement says "live", or heavy work inline that blocks the request.
6. **Name the code-level obligations with each choice** (Rule 6): idempotency key, retry/backoff, dead-letter, bounded timeout, and a correlation-id log line for every async/queued path; auth + reconnect + heartbeat for sockets; TTL + invalidation + stale-tolerance for caches. These are what `/build`'s runtime-pattern fidelity gate will enforce.
7. **Store the decision**, all in this step:
   - Write the chosen pattern per axis into tech-spec **S22** rows (Caching, Async work / queues / workers, Real-time transport, Idempotency & retry) and the caching/worker capacity into **S12** (this is captured when `tech-specification` runs in Step 2; the decision and obligations are recorded now in `decision-log.md` so the spec inherits them).
   - Record a runtime ADR via `architecture` for each non-trivial axis (ADR-003 caching, ADR-008 messaging/async, ADR-009 real-time), single-service included.
   - Append a `decision-log.md` row per axis.

This is BLOCKING: the Step 2 dispatch and Gate 1 do not pass without an explicit chosen pattern OR `N/A (reason)` recorded for each axis, plus an ADR for each non-trivial axis in use.

### Step 1.9 — Requirement alignment: security + compliance verification (mandatory, BLOCKING)

Runs after Step 1.8, before Step 2. The tech stack (1.7) and the data-flow topology (1.8) must be verified against the requirement for **security and compliance**, and explicitly confirmed by the user, BEFORE any planning artifact is dispatched. The Step 1 intake captured a compliance answer; this step VERIFIES it against what the product actually does and locks it. Do not take the intake answer at face value: drill the requirement and confirm.

1. **Drill the requirement for compliance signals** (do not wait for the user to volunteer them). The named four are the common ones; the list below is the fuller set so a triggered regime is not missed:
   - **PHI / health data** (diagnoses, treatment, medical records, anything a clinician touches) → **HIPAA** (US). Medical-device software → also flag **FDA / IEC 62304**.
   - **Cardholder data** (card numbers, CVV, processing or storing payments yourself rather than via a tokenized Stripe/Razorpay flow) → **PCI-DSS**.
   - **EU/EEA personal data** → **GDPR**. **UK** users → **UK-GDPR / DPA 2018**. The regime follows the data subject's region, not the company's.
   - **Selling to enterprises / handling customer data as a SaaS** → **SOC 2** (Type I/II), and often **ISO 27001** for non-US/international buyers.
   - **California consumers** → **CCPA / CPRA**. Other US-state privacy laws (Virginia VCDPA, Colorado CPA, etc.) follow the same pattern if the user base is broad US.
   - **Children under 13 (US) / under 16 (EU)** → **COPPA** (US) and GDPR-K provisions.
   - **Consumer financial data / lending / banking** → **GLBA** (US). **Education records** → **FERPA** (US).
   - **Other regions**: Brazil → **LGPD**, Canada → **PIPEDA**, India → **DPDP Act 2023**, Australia → **Privacy Act / APPs**. Match the regime to where the users are.
   - **US government / federal** → **FedRAMP / NIST 800-53**. **EU critical infrastructure** → **NIS2**.
   - **Public-sector or accessibility-regulated** (government, EU market, large US enterprise) → accessibility is a legal obligation: **WCAG 2.1/2.2 AA**, **ADA** (US), **Section 508** (US federal), **EN 301 549 / European Accessibility Act** (EU). Route to `/accessibility-audit` as a gate, not a nicety.
   If a signal is present that the intake answer missed, SAY SO and propose adding the regime, with the reason and the concrete obligation it adds. If the requirement clearly does NOT trigger a regime the user named, say that too (do not gold-plate). Resolve every triggered regime through `rules/compliance/README.md`. Checklists ship for `gdpr`, `ccpa`, `hipaa`, `pci-dss`, `soc2`, `iso-27001`, `fedramp`, `nis2`, `lgpd`, `pipeda`, `dpdp`, `au-privacy`, `coppa`, `glba`, `ferpa`, `fda-62304`, plus the baselines `owasp`, `audit-logs`, `secrets`. UK-GDPR and other US-state privacy laws reuse a sibling (`gdpr` / `ccpa`) with deltas. If a triggered regime has no file, map its controls from the official source named in the index.

**Conditional loading (BLOCKING discipline):** load ONLY the compliance file(s) and skills for the regime(s) the project actually declares in `stack.md → compliance:`. Never load the whole `rules/compliance/` folder. `secrets.md` + `audit-logs.md` are the always-on baseline; `owasp.md` loads whenever any regime is set. `audit` / `audit-logs` are armed in the Activation Map only when `compliance` is non-empty or S20 has rows. A project with `compliance: none` loads no regime file and arms no compliance skill. See `rules/compliance/README.md` → Conditional loading.
2. **Map the must-have controls** for each confirmed regime. Resolve the regime through the index `rules/compliance/README.md`: it points each regime to a full checklist (`hipaa`, `soc2`, `gdpr`, `ccpa`, `pci-dss`, `owasp`, `audit-logs`, `secrets`) or to its official source + key controls (first-principles regimes reuse a sibling checklist: UK-GDPR → `gdpr.md`, US-state privacy → `ccpa.md`, ISO 27001 → `soc2.md`). With `rules/security-rules.md`, identify which controls the stack and data-flow already satisfy, which need a planned task, and which constrain the runtime topology (for example: PHI must not sit in an unencrypted cache; PCI scope shrinks to SAQ-A if card data never touches your servers via a tokenized processor; GDPR/CCPA force data-export + delete endpoints and a retention policy; SOC 2 forces audit logs ≥1yr + MFA + tested backups).
3. **Verify the data-flow against the regime** (ties 1.8 to security): caches, queues, logs, and real-time channels must not leak regulated data. Flag any axis from Step 1.8 that, as chosen, would violate a control (PHI in a Redis cache, card data in a queue payload, PII in a log line), and adjust the topology before locking it.
4. **Present the security + compliance summary and confirm**, inline, /ask-style:

   ```
   ? Security & compliance verified against the requirement:
     - Regime(s): [HIPAA + GDPR | PCI-DSS | SOC 2 | none], driven by [the signal you found]
     - Stack/data-flow impact: [encryption at rest, no PHI in cache, audit logs, export/delete endpoints, EU region, ...]
     - Must-have controls planned as tasks: [N items]
     Confirm this is correct so I can plan against it?
       1) confirm (default)
       2) add/remove a regime — name it and the reason
       3) explain a control before I confirm
   ```
5. **Store the decision**, all in this step:
   - Write the confirmed regime(s) to `AI_DOCS/memory/stack.md` (`compliance:` frontmatter) and `project-context.md`.
   - Append a `decision-log.md` row (the regimes, the requirement signal that drove each, the user's confirmation).
   - The must-have controls become tasks (seeded by `tech-specification` S20 + `milestone-planning` in Step 2) and arm `audit` / `audit-logs` in the Activation Map.

This is BLOCKING: Step 2 and Gate 1 do not pass without `stack.md → compliance:` set (a regime or explicit `none`), confirmed in-session, with the requirement signal recorded. A regime that the requirement clearly triggers but the plan ignores is a Gate 1 FAIL, not a later-audit finding.

### Step 1.10 — Design direction, decided FROM the stack, architecture, and compliance

Design is not chosen in a vacuum or defaulted to "whatever the component library ships". It is a deliberate decision that ALIGNS with the locked frontend stack (1.7), the data-flow topology (1.8), and the compliance/accessibility obligations (1.9). The full work runs in Step 2 via the gated pipeline `ux-foundation` (Gate UX-0) → `design-discovery` → `design-direction` (grayscale, Gate UX-1) → `design-tokens` → `design-screens`; this step sets the alignment contract those skills must honor, so design follows tech and architecture rather than fighting them:

- **Component library follows the frontend stack and rendering model.** A Next.js App Router project picks a server-component-friendly, SSR-safe library; a React + Vite SPA can use a broader client-only set. The library choice is recorded with its reason, not defaulted. There is no house default component library, same discipline as the stack.
- **Design accommodates the data-flow.** Real-time axes from 1.8 (live feeds, presence, progress, optimistic updates) mean the screens and component states must cover the live/streaming/reconnecting states, not just static loaded data. Async-job APIs need a job-status/progress UI pattern. Name these so design-screens builds them.
- **Design honors compliance up front.** If 1.9 triggered accessibility law (WCAG/ADA/Section 508/EAA), the component library MUST be accessibility-ready (keyboard, ARIA, focus management) and `/accessibility-audit` is armed as a gate. Regulated data shapes the UI too (consent banners for GDPR, data-export/delete screens, audit-visible admin actions).
- **Confirm the design direction** (brand mood, density, component library) with the user as part of `design-discovery`, the same present-options-then-confirm stance as the stack. Record it in `AI_DOCS/design/design-dna.md` and a `decision-log.md` row.

This step does not block Step 2 on its own (design runs inside Step 2), but its alignment requirements are checked at Gate 1: a component library that fights the rendering model, or screens that ignore a chosen real-time axis or an accessibility obligation, is a Gate 1 design-readiness gap.

### Step 2 — Dispatch the planning skills (orchestration core)

Invoke each via a real Skill call, in order. Honor the Section 5 handoff block between skills (read the `Checkpoint:` line before proceeding). Each skill writes its own artifacts to `AI_DOCS/`; /do does not duplicate that work.

| # | Skill | When | Produces |
|---|---|---|---|
| 1 | `session-management` | always (fresh project) | bootstraps `AI_DOCS/` tree + memory state files + gate-status seeded PENDING |
| 2 | `requirement-finalization` | `AI_DOCS/requirements/` holds more than one source, OR conflicts surfaced in Step 0.5 intake | `AI_DOCS/planning/requirements-baseline.md` (finalized statements with source refs, conflict register, decision log, open items) |
| 3 | `workscope` | only if no scope doc exists | scope document from the requirement (pre-filled from the baseline when present) |
| 4 | `estimation` | on user request, or offered after workscope approval | `AI_DOCS/estimation/` versioned JSON + XLSX + client summary; feeds the workscope Investment section on opt-in |
| 5 | `tech-specification` | always | `tech-spec.md` S1-S23, `architecture/api-contract.md`, `architecture/database-schema.md` |
| 6 | `flow-prototypes` (checklist mode) | always (non-POC) | Flow triage: classifies every feature/flow into **Tier S** (standard: single-screen CRUD, plain lists, simple forms) or **Tier F** (flow-validated: multi-step/multi-role/branching/business-logic journeys), presented as a batched checklist so the operator confirms, promotes, demotes, or waives each row. Writes `AI_DOCS/design/flow-validation-plan.md` (one row per flow: tier, priority, status, chosen variant, date); waivers are logged in `decision-log.md` with a reason. This is the gate's source of truth for **Gate FLOW**. |
| 7 | `architecture` | multi-service projects, OR any project using a non-trivial runtime axis (cache / queue+worker / real-time / pipeline) from Step 1.8 | ADRs (scaling ADR-007, caching ADR-003, messaging/async ADR-008, real-time ADR-009 as applicable), system context diagram, sequence diagrams. Single-service projects still get the runtime ADR for each axis they use. |
| 8 | `ux-foundation` → `design-discovery` → `design-direction` (grayscale, **Gate UX-1** before color) → `design-tokens` → `design-screens` | if frontend in stack | `ux-brief.md` (roles x JTBD, NFR contract, success metrics, **Gate UX-0**), Design DNA, grayscale UX structure + enterprise state coverage, tokens.json + the locked app-shell, Gate 3.5 IA + IA-to-data reconciliation, all screens. Requirement -> UX -> UI is gated: UX-0 before discovery, UX-1 (grayscale, validated) before any color/tokens (enforced by `hooks/design-gate.sh`), UX-2 before build. |
| 9 | `infra-planning` | always (non-POC) | `AI_DOCS/infra/infra-plan.md` (environments, FE+BE topology, secrets, CI/CD, monitoring, DR, cost-at-scale) |
| 10 | `prd-generation` | tech-spec S3 declares ≥2 non-admin roles OR the project is a SaaS / multi-tenant app | functional requirements + Given-When-Then acceptance criteria |
| 11 | `milestone-planning` | always | milestone capsules + `tasks.md` seeded FROM the spec (not from intake), `task-ledger.md`. Tasks belonging to a Tier F flow (per `flow-validation-plan.md`) carry a `flow: <flow-id>` tag. |
| 12 | `mcp-connector` | always (after `stack.md` confirmed) | project-root `.mcp.json` with stack-matched **free servers enforced** (Playwright, sequential-thinking, context7, + stack UI/ORM servers) and **gated servers offered** with `${ENV_VAR}` creds. Records active set in `stack.md → ## MCP Servers`. Wires to dev URL/port per `mcp-rules.md` Rule 6b. |
| 13 | `project-brief` | on user request, any time a baseline or workscope exists | `AI_DOCS/planning/project-brief.md` (short complexity brief, client or team variant) |

Specialist planning skills are pulled in by the relevant skill above when the stack/requirements call for them: `caching-strategy`, `analytics`, `i18n`, `seo`, `error-handling`, `audit-logs`, `data-migration` (retention/backup/seed), `ai-cost-guard` (mandatory before any LLM API code), `infra-cost-guard` (mandatory before any cloud resource is provisioned).

**External skill packs (stack-driven):** when the chosen stack includes Supabase, install the official Supabase agent skills with `npx skills add supabase/agent-skills` during setup (they land in `.claude/skills/`, gitignored). Install only when the technology is actually in the stack, not preemptively. Other stack-specific packs follow the same install-when-added pattern (`skills/REGISTRY.md` Technology to Skill Routing table records them).

### Step 2.5 — Compile the Skill Activation Map

After the dispatch, compile `AI_DOCS/memory/active-skills.md` Activation Map (template provides the schema). For each specialist skill, evaluate its mechanical trigger condition against the now-existing plan and set `Status` to `armed` or `dormant`:

- `ai-cost-guard` → armed if S22 has an LLM row or the stack includes an LLM SDK (BLOCKING).
- `infra-cost-guard` → armed if `infra/infra-plan.md` proposes any paid cloud resource or `stack.md` declares a cloud deploy target (BLOCKING for tasks touching `infrastructure/**` or running provisioning commands).
- `audit` / `audit-logs` → armed if `stack.md compliance` is non-empty or S20 has rows.
- `data-migration` → armed (fires on any schema-changing task).
- `i18n`, `caching-strategy`, `seo`, `analytics` → armed per S22/S23/S12 rows.
- `caching-strategy` → armed if S22 Caching is a real pattern (not `N/A`). `error-handling` → armed (also owns async/real-time resilience: retry, dead-letter, reconnect, structured logging). Any milestone task implementing a queued/async/real-time/cached path is tagged `needs:error-handling` (and `needs:caching-strategy` for cache work) so `/build`'s runtime-pattern fidelity gate has an owner.
- `accessibility-audit`, `design-*` → armed if frontend in stack.
- `mcp-connector` → armed always (free servers enforced into `.mcp.json` after stack confirm, re-firing at scaffold and on debug/verify per `mcp-rules.md` Rule 4). Gated servers stay dormant until approved.
- `flow-prototypes` → armed if `AI_DOCS/design/flow-validation-plan.md` has any Tier F row whose status is not `approved` or `waived` (re-evaluated as new Tier F flows appear at each milestone's task tagging).
- `impeccable` (vendored, dispatched by /do only) → armed if the project has a web UI surface (frontend in stack) AND `skills/impeccable/` is installed. Mode mapping per `active-skills.md`: polish = pre-visual-QA fix pass on UI tasks, harden = milestone-close edge-case pass, detect = mechanical lane (`mavs/slop.json`, advisory), document = DESIGN.md refresh after token changes. `live` and `shape` stay dormant unless the operator asks.
- Any milestone task tagged `needs:<skill>` → arm that skill.

This is what makes skills auto-trigger: the build loop reads this map per task. The decision of "what fires" lives in the plan, visible and reviewable, not hidden in skill descriptions.

### Step 3 — Planning Completeness Gate (BLOCKING before Phase 1)

Run `gate-enforcement` for **Gate 1: Planning Completeness**. It blocks the transition to Phase 1 (Build) until every planning dimension is present OR explicitly marked `N/A (reason)`:

- Tech stack selected requirement-first and confirmed in-session: `stack.md` has `stack_confirmed: true`, the confirmed names, and a `## Selection rationale` block (reason + alternatives + revisit trigger per category), plus a stack ADR in `architecture/adrs/`. No house/default stack accepted without requirement justification. Frontend (React vs Next.js, etc.) decided from a named requirement signal, not defaulted.
- Runtime architecture / data-flow decided (Step 1.8): S22 has an explicit pattern or `N/A (reason)` for Caching, Async work / queues / workers, Real-time transport, and Idempotency & retry, with a runtime ADR (003/008/009) for each non-trivial axis in use. No Redis/queue/socket/pipeline in `infra-plan.md` or `stack.md` without a matching S22 row + ADR.
- Security + compliance verified against the requirement and confirmed (Step 1.9): `stack.md → compliance:` set (a regime or explicit `none`), the requirement signal recorded, and the must-have controls present as tasks or `N/A (reason)`. A regime the requirement triggers but the plan ignores → FAIL.
- Field mapping + UI spec (tech-spec S5, S11) and the three states (empty/loading/error) + first-run per screen
- End-to-end data flow (S7/S8/S19) and lifecycle/retention (S7)
- API-to-UI contract lock (`api-contract.md` populated, every endpoint referenced by a screen or tagged `backend-only`)
- RBAC (S3) and per-action/per-page enforcement plan
- Compliance + security matrix (S20)
- Navigation + onboarding (`design/sitemap.md`, `design/navigation.md`, `design/onboarding-flow.md`)
- Design aligned to stack + architecture + compliance (Step 1.10): component library fits the rendering model, screens cover any chosen real-time/async UI states, accessibility obligations honored if a regime triggered them
- Infra plan (`infra/infra-plan.md`)
- Scalability plan (S12)
- Cross-cutting concerns (S22) and public surface (S23)
- Traceability matrix populated (S21)
- QA test cases (S18) tied to acceptance criteria

On FAIL: tell the user exactly which dimension is blank, and either fill it (re-dispatch the owning skill) or have the user mark it `N/A (reason)`. Do NOT enter Phase 1 until the gate is PASSED (or `planning_depth: poc`).

#### Step 3 (final sub-step) — BLOCKING plan approval (Gate 1 Part D)

Once every dimension above passes, Gate 1 is NOT yet PASSED. Gate 1 Part D requires "User has reviewed and approved the plan", so /do must obtain that approval explicitly before marking Gate 1 PASSED. This is BLOCKING: no code is written until the user signs off.

Ask the user, inline, /ask-style with options and a default:

```
? The plan is complete and passes the Planning Completeness Gate. Approve it so I can start building?
  1) approve — mark Gate 1 PASSED and start M01 (default)
  2) show me the plan — print the spec / design / infra / milestone recap first
  3) revise — name what to change and I re-dispatch the owning skill
```

- On **show me the plan**: print the Step 4 recap (and offer to open any artifact), then re-ask.
- On **revise**: re-dispatch the owning planning skill, then return to the Planning Completeness Gate.
- On **approve**: append the answer to `AI_DOCS/memory/decision-log.md` (the user's exact word + date), record Gate 1 Part D as checked, and only then write `PASSED` for Gate 1 in `gate-status.md` and the active milestone capsule.

Do NOT enter Phase 1 until this approval is logged and Gate 1 is PASSED (or `planning_depth: poc`).

### Step 4 — Recap and proceed

Print a short recap:
```
✓ Project planned (planning_depth: standard).
  Spec: tech-spec.md S1-S23 + api-contract + schema
  Design: sitemap, navigation, onboarding, screens
  Infra: infra-plan.md
  Milestones: N capsules in AI_DOCS/milestones/
  Gate 1 (Planning Completeness): PASSED

Starting M01 → T-01: <title>
```

Then continue to **Phase 1**.

---

## Phase 1 — Build loop

Runs continuously until all tasks in the current milestone are DONE or the user stops.

### Unattended milestone stretches (bounded autonomy)

A milestone stretch may run unattended under `/goal` with an explicit completion condition (for example "all M02 tasks DONE and Gate FLOW/MAVS green") and a turn bound (for example "or stop after 40 turns"). The goal evaluator checks the completion condition every turn. Every gate in this Phase still blocks exactly as it does interactively, the auto-fix loop keeps its existing 2-round cap (`build.autofix_rounds`), and graduated deploy autonomy (`rules/ops-safety-rules.md`) is unchanged: staging and production mutations still stop for a human. Hitting the turn bound without meeting the completion condition ends the stretch and reports status: it never silently keeps going past the bound.

### Progress and ETA for long-running actions (operator visibility)

The operator should never have to ask "done?". Any shell action expected to take more than about 2 minutes (full test suites, the MAVS emit, builds, office or cloud deploys, backups, restores, rollbacks, bulk agent waves) is reported with visible progress and an ETA, because a long silent wait reads as a stall and hides a failure until the very end.

1. **Launch it observable.** Run it in the harness background mode with its output in a log under the scratchpad (or `AI_DOCS/.temp/logs/`), and stamp the start time beside it: `date +%s > "$LOG.start"`, then `<command> > "$LOG" 2>&1; echo "EXIT $?" >> "$LOG"`. The trailing `EXIT` line is what lets progress tooling and humans tell finished from stalled.
2. **Announce a plan with an ETA before it starts.** One table: each step, its expected duration, and the total. Take durations from the last comparable run (the previous log, the Verification log in `tasks.md`, or a rehearsal record) and say when a figure is a guess (`[Guessing]`), per the advisor-stance confidence tags.
3. **Report progress while it runs.** Compute it, never estimate it from feel: `bash .claude/scripts/progress-eta.sh "$LOG" [--total N | --steps N]` prints `<phase>: done/total (pct) passed failed elapsed eta [state]` for Playwright, Jest, Vitest and deploy-step logs. Post that line (or a short table across parallel jobs) at natural checkpoints: when a phase finishes, roughly every 10 minutes on a long phase, whenever the operator asks, and immediately on the first failure. Long gaps between turns are filled with a one-line status, not silence.
4. **Report the outcome against the estimate.** On completion give the verdict from the runner's structured output (testing-rules Rule 35), the actual duration next to the ETA, and the next step with its own ETA. A failure is reported at once with the failing item, not at the end of the batch.
5. **Parallel work gets one consolidated table.** When several agents or background jobs run at once, show one table (job, state, progress, ETA) rather than separate fragments, so the operator can see the whole picture in one place.

This is reporting only: it never changes a gate, a timeout, or an approval rule.

### Stage 0 — Build the locked app-shell FIRST (before any feature task)

This is the fix for "the polished design degraded to only colors in code" (Track H). The polished design must be materialized as real, reused CODE before any feature screen is built, then frozen. It runs ONCE per project, at the first build of the first frontend milestone (skip for projects with no frontend, and skip on resume if `gate-status.md` already shows `SHELL LOCKED`).

```
1. Decision pass (reason-first): spawn `principal-designer` for the app-shell decision pass.
   It writes AI_DOCS/design/app-shell-decisions.md (template: app-shell-decisions.md) — one
   section per structural element (top nav, side nav, user profile, auth, content region,
   tables, pagination, cards, forms, state components), each with the chosen pattern, WHY it
   fits THIS requirement (trace to ux-brief JTBD), what it improves over the naive default,
   and the vetted-library primitive it builds on (shadcn/ui + Radix per stack.md).
2. Build the shell + primitives, polished to tokens, on the chosen library:
   - src/components/layout/**: AppShell, TopNav, SideNav, UserProfileMenu, AuthLayout.
   - src/components/ui/**: DataTable (sort/filter/saved-views/column-mgmt/density/bulk-select),
     Pagination, Card, Form/Wizard, and the state set EmptyState, FilteredEmptyState,
     LoadingSkeleton, ErrorState, ReadOnlyWrapper, BulkActionBar.
   Each goes through the normal verify battery (incl. the design-token gate) + the T-4.1 auto-fix loop.
3. Craft review: spawn `principal-designer` on the BUILT shell. Verdict APPROVE/CONCERNS/REJECT.
   REJECT or unresolved CONCERNS → fix and re-review. Do not lock an un-approved shell.
4. Register every shell component in AI_DOCS/design/component-registry.md under a
   "## Locked app-shell (frozen)" section (exact component names).
5. LOCK: append "SHELL LOCKED — <date>" to AI_DOCS/memory/gate-status.md. From here the
   enforce-shell-lock.sh hook blocks ad-hoc edits to the shell (changes route through /change-request),
   and the shell-fidelity gate (below) requires feature screens to compose from it.
```

Only after the shell is locked do feature tasks run. Feature screens COMPOSE from the locked shell, they never re-implement chrome.

### Parallel wave lane (independent tasks, governed)

Build tasks run one at a time BY DEFAULT. When the next TODO tasks are provably independent, /do may run them as one concurrent wave instead. Eligibility, ALL must hold (read from the blockedBy graph + the Task Briefs' files-to-touch predictions):

- no blockedBy edge between wave members (direct or transitive),
- disjoint files-to-touch predictions (any overlap disqualifies — over-approximate scope rather than risk it),
- no member touches a locked artifact (api-contract.md, database-schema.md, authz-matrix.yaml, the locked shell),
- no write overlap on the same DB entity.

Mechanics:

1. Cap: HEAVY_CAP from `docs/coordination-rules.md` (builder waves are HEAVY, default 2-3). Log the wave as one decision-log line: `Wave W<NN>: T-xx, T-yy — parallel, disjoint scopes`.
2. Dispatch each member to its own `builder` agent with worktree isolation so edits cannot collide. Mark each row Status=DOING with `parallel:W<NN>` in Notes. Add `Active wave: W<NN> [T-xx, T-yy]` to `session-state.md` so compaction recovery restores the whole wave.
3. **Merges are SEQUENTIAL, never parallel:** integrate one builder result → re-run the FULL verify battery (regression included) on the merged tree → scope validation → code review → stamp → only then integrate the next. A merge conflict drops that task to a sequential rebuild on the new HEAD (never force-merge).
4. A wave member that fails its battery runs the bounded auto-fix loop inside its own worktree, same rules as sequential.

Dependent chains, overlapping scopes, and locked-artifact tasks always stay sequential. When in doubt about disjointness, do not parallelize. Task Briefs for queued tasks are the cheap parallelism that is ALWAYS on: they run while the current builder works.

```
loop:
  1. Re-read task-ledger.md → confirm active milestone
  2. Re-read milestones/<active>/tasks.md
  3. Identify next task:
       a. First row with Status=DOING (resume), else
       b. First row with Status=TODO and empty blockedBy
  4. If no candidate:
       - All DONE → proceed to milestone close (step 7)
       - All remaining BLOCKED → ask user about top blocker; stop loop
  5. Set task Status=DOING in tasks.md; update session-state.md
  6. Implement the task (steps below)
  7. Stamp result into tasks.md
  8. If this was the LAST task in the milestone → milestone close
  9. Loop
```

### Per-task execution (step 6)

**Before writing code:**
- **STALE check (BLOCKING):** if the task's feature row in `spec/21-traceability.md` is marked `STALE`, or a planning artifact for it contains `<!-- STALE -->`, STOP and route through `change-request` (Impact Propagation) before any code.
- **Drift check (BLOCKING):** if `AI_DOCS/quality/drift-report.md` exists with Phase A findings (undocumented routes in code) or Phase D findings (unresolved STALE markers), STOP — reconcile via `change-request` before building on top of known drift. Phase B (planned-not-built) never blocks here.
- **Flow gate check (BLOCKING):** if the task row carries a `flow: <flow-id>` tag, read `AI_DOCS/design/flow-validation-plan.md` and proceed only when that flow's status is `approved` or `waived`. Otherwise dispatch `flow-prototypes` for that flow (prototype then judge modes) before the task may start. Implementing an unapproved Tier F journey is how scope-complete work ships journeys the operator would have rejected.
- **Activation Map check (auto-trigger):** read `AI_DOCS/memory/active-skills.md` Activation Map. If the task matches an armed skill's trigger condition, dispatch that skill for this task instead of hand-rolling it. BLOCKING rows (e.g. `ai-cost-guard` when the task touches an LLM SDK, `infra-cost-guard` when it touches `infrastructure/**` or provisions cloud resources) must be satisfied first — do not write the code until the armed blocking skill has run.
  - **Impeccable dispatch (UI tasks, when armed):** dispatch the impeccable polish pass BEFORE the Exercise gate's visual-QA judgment so its fixes land before the verdict, and run the detect lane per the Verify battery (`skills/build/VERIFY-BATTERY.md`, appends to `mavs/slop.json`, advisory). The DSC checklist + `mavs/visual.json` remain the verdict of record.
  - **Removed/renamed skill resolution (old-project self-heal):** if a `needs:<skill>` tag, an Activation Map row, or any dispatch target names a skill that no longer exists (common after a framework pull, e.g. `python-backend`/`go-backend`), resolve it via `docs/skill-deprecations.md` rather than failing — `python-backend`/`go-backend` → `build` + the matching specialist agent (`fastapi-specialist`/`go-specialist`); other removals per that table. Do not error on a dangling reference; map it and proceed.
- **Task Brief (alignment gate, every non-micro-lane task, BLOCKING):** dispatch `explorer` (or `research-lead` for a cross-cutting task) to produce the Task Brief per `skills/task-planner/TASK-BRIEF.md`, written to `AI_DOCS/planning/tasks/active/<slug>/brief.md` and linked from the task row. The brief contains: (1) the requirement slice re-read, quoting the workscope / tech-spec / PRD rows and the S21 traceability row this task advances, by ID; (2) a reality check of every plan assumption against the CURRENT code (endpoints, schema fields, components, packages), each marked OK or DRIFT; (3) a concrete, testable restatement of each acceptance criterion; (4) the files-to-touch prediction. Any DRIFT → route through `change-request` BEFORE coding (this extends the STALE check from marker-based to verified-against-reality). The restated criteria are the contract the Acceptance Evidence table must satisfy: this is how every task stays 100% aligned with the requirement it came from. Briefs for the next queued tasks may be produced in parallel while the current task builds.
- **Brief prefetch (overlap, non-blocking):** while the current task is in its verify or review stage, prefetch the NEXT task's Task Brief via `explorer` or `research-lead` (read-only). At the next task's start, the STALE and Drift checks above re-validate the prefetched brief before it is trusted: a prefetch is never trusted un-rechecked.
- Read `api-contract.md` if the task touches any API call or route handler
- **Multi-layer feature lane (replaces the retired `team-feature` and `team-design` skills, v4.32.0):** when a request is one feature that crosses layers (UI plus API plus data, or a new screen set), /do runs the gates those skills ran, once, before the per-task loop: `product-director` for PD-SCOPE (is it in scope, does it change the milestone), `solutions-architect` for SA-ARCH when it adds a service, a boundary or a contract change, and `engineering-lead` for EL-FEASIBILITY when the estimate or the sprint is at risk. A REJECT stops the lane and routes to `/change-request`. The feature is then split into tasks that go through the normal loop below (domain lead, builder, scope validation, code review), and `qa-lead` runs QA-TEST-COVERAGE once at the end of the feature, before the last task stamps. Verdicts go to `gate-status.md` as before.
- **Domain-lead dispatch (non-trivial tasks):** for a task that is more than a one-line tweak, dispatch the matching domain lead to produce a consolidated plan in its own context (keeping the specialist reads out of the orchestration window), then implement from its plan. /do (L0) always APPLIES the edits so the governance hooks enforce them; the leads are read/advise/review and never edit. Leads: `frontend-lead` (UI screens/components/interactions), `backend-lead` (endpoints, service/store, authz, async obligations), `design-lead` (non-trivial design/UX), `research-lead` (broad read-heavy investigation before a change). The `quality-lead` runs the consolidated review pass (see Code review below). Skip leads for trivial tweaks (the micro-task lane handles those). A lead that flags a locked-artifact conflict routes through `change-request`.
- Grep `src/components/**` for existing component matches (UI tasks) — extend rather than fork (the frontend-lead plan already covers reuse when it ran)
- Grep `src/lib/**` for existing utility matches

**Implement:**
- Complete code: every path implemented before the task is stamped, because a TODO placeholder passes the type check while shipping a hole the verify battery cannot see. Track deferred work in the milestone's tasks.md, never as an in-code TODO.
- Keep changes focused on the task's acceptance criterion.
- **Builder dispatch (DEFAULT for every task outside the micro lane, so implementation churn stays out of the orchestration context):** dispatch the `builder` agent (the brief, plan and acceptance travel as files under `AI_DOCS/.temp/handoff/<task-id>/` and the prompt carries the paths, never earlier tasks' history) with the task acceptance + the Task Brief + the milestone capsule scope excerpt + the domain lead's plan (from the frontend/backend/design-lead dispatch above) + the stack and locked shell/tokens context. The builder APPLIES the edits and runs the full Verify battery below IN ITS OWN CONTEXT, then returns a compact result: files changed, per-check verify results, the Acceptance Evidence table (one row per restated criterion: implementing files on every surface it names, named proving test, exercise result, schema in `skills/build/EVIDENCE-TABLE.md`), and any BLOCKED reason. Implementing a non-trivial task inline in L0 is the exception, not the rule, and requires a one-line reason in the Notes col. This is safe because the PreToolUse governance hooks fire and block inside subagents (verified, `skill-lab/experiments/hooks-in-subagent.md`), so routing, shell-lock, api-contract-lock, chunk-scope, and cost/ship gates still enforce every edit the builder makes. L0 does NOT re-read all the changed files: it records the builder's result after checking the success claim against `git diff --stat` and the changed file list ("agent reported success" is not evidence), then runs the mandatory Scope validation + Code review (below) on the changed files. Trivial edits and the micro-task lane stay inline in L0 (no builder overhead). The builder never stamps the task or runs the review; L0 owns those.
- **Auto-fix with the builder:** if the builder returns a verify FAIL, send the failing check + trace back to the SAME builder with SendMessage (it already holds the task context, so a new dispatch would re-read everything). Rounds are bounded by `stack.md → build.autofix_rounds` (default 2), same as the inline auto-fix loop, and the escalation ladder under "On FAIL" below applies: after the same-builder rounds, one escalated attempt dispatches a fresh builder one tier up, and after that the orchestrator writes a ruling. The failure report travels as a file under `AI_DOCS/.temp/handoff/<task-id>/` and the message carries the path.

**Verify (in order, fail fast: bounded auto-fix on failure, see On FAIL). For builder-dispatched tasks (the default) the `builder` runs this battery in its own context and returns the results; for the micro lane and the rare inline exception L0 runs it directly. The independent early checks (type check, lint, scoped tests) may run concurrently; the dependent chain after them (build, regression, exercise) still runs in order, same checks and same dependence, less wall clock. Full gate definitions live in `skills/build/VERIFY-BATTERY.md`; this table is the index:**

| Check | Command | Fail threshold |
|---|---|---|
| Type check / static | `tsc --noEmit` (TS) / `mypy` (Python) / `gofmt -l .` empty + `go vet ./...` (Go) | Any error |
| Tests | `pnpm test` / `pytest` / `go test -race ./...` scoped to changed files (fast feedback) | Any failure |
| Build | `next build` / `vite build` / `python -m compileall` / `go build ./...` | Non-zero exit |
| Regression | FULL test suite, unscoped (`pnpm test` / `pytest`, or `stack.md → test.regression` if declared) — catches inter-task regressions the scoped run cannot see | Any failure (name the regressing test + this task as suspect) |
| Token gate | Grep changed files for `#[0-9a-fA-F]{3,8}`, `\b\d+px\b`, `style=\{\{.*color:`, `rgb\(`, `font-family:` outside the token file (UI tasks only) | Any match |
| RBAC gate — API | Grep changed API/handler/service files: (A) role/permission guard present (`hasRole\|hasPermission\|isAdmin\|requireRole`); (B) soft-delete filter on every fetch query (`deletedAt IS NULL` or equivalent). Exempt: `/trash`, `/restore`, `/deleted` paths | Any missing check |
| RBAC gate — UI | Grep changed UI files: (C) action buttons/icons (delete/edit/restore/upload) wrapped in role-conditional rendering; (D) required inputs have red asterisk span (`text-destructive`) | Any missing check |
| Shell-fidelity gate (UI feature tasks, once `SHELL LOCKED`) | Grep the changed screen/page files: they must IMPORT the locked shell for chrome (`AppShell`/`TopNav`/`SideNav`, `DataTable`, `Card`, `Pagination`, and the state components) and must NOT hand-roll chrome when a locked equivalent exists: a raw `<nav>`/`<aside>` sidebar, a raw `<table>`, a bespoke card `<div>`, or an ad-hoc empty/loading/error block. The auto-fix loop recomposes from the locked shell. | A hand-rolled chrome element where a locked component exists, or a screen that does not compose from the shell |
| Dependency gate | When a package manifest/lockfile changed: lockfile in sync + `pnpm audit --prod` / `pip-audit` + every ADDED package is imported by this task's diff | Manifest without lockfile update, new HIGH/CRITICAL advisory on a package this task added/updated, or an added-but-unused package |
| Exercise gate | Drive the changed flow ONCE for real. API task: real request(s) at the changed endpoint(s) on the local dev server asserting status + the `{success, data}` envelope (reuse `api-conformance` primitives), plus the changed action's authz-matrix allow AND deny cells. UI task: one Playwright pass through the changed screen asserting the acceptance-visible behavior. Worker/Lambda task: local invoke with a representative payload. Pure-static tasks stamp `exercise: n/a (reason)`. A UI/API/worker task never qualifies for n/a | Runtime error, wrong status/envelope, an authz cell leak OR over-block, the acceptance-visible behavior absent, or a missing n/a reason |
| E2E (optional) | Only if acceptance criterion mentions it | Any failure |

**On PASS:**
```
Status=DONE in tasks.md — ONLY once the Acceptance Evidence table is complete
Verify col = "✓ tsc ✓ test (37/0) ✓ build ✓ regression ✓ tokens ✓ rbac-api ✓ rbac-ui ✓ exercise ✓ visual-qa ✓ evidence"
Append row to tasks.md ## Verification log: timestamp + PASS
Append the Acceptance Evidence table to the task's chunk file (or Notes for single-row tasks)
```

DONE requires the Evidence table (schema: `skills/build/EVIDENCE-TABLE.md`): one row per restated acceptance criterion with implementing files on EVERY surface the criterion names, a named proving test that fails without the change, and the exercise result. Any empty cell, or a criterion covered on fewer surfaces than it names, keeps the task DOING regardless of green checks.

**Scope validation + Code review (MANDATORY, after PASS, before stamping: both read the same finished diff, so dispatch them in parallel and join both verdicts before stamping):**

Dispatch `quality-lead` in scope-validation mode (`api-validator` may substitute for a pure API-contract task) with: the diff summary, the task acceptance, the Task Brief's restated criteria, the milestone capsule scope excerpt, and the Acceptance Evidence table. Verdict handling:

- **SCOPE-OK** → join with the Code review verdict below and proceed to stamping.
- **UNDER (names the missing criterion/surface)** → task stays DOING; the missing part goes back to the `builder` (counts toward the auto-fix bound). The FE-accepts-what-the-worker-never-handles class dies here. Re-run both verdicts on the fix before stamping.
- **OVER (names the unrequested surface)** → trim it, or route it through `change-request` as its own task. Never ship unrequested scope silently.

**Code review (MANDATORY, dispatched in parallel with scope validation on the same diff, joined before the next task):**

Dispatch the `code-reviewer` agent (chunk review mode) on this task's changed files, passing the task acceptance criterion, the Acceptance Evidence table, and the relevant rule files. Its verdict must include the acceptance-coverage section (the diff mapped to every criterion, gaps named). This is not optional and not deferred to the pending-reviews queue (the queue remains a backstop for interrupted sessions). Verdict handling:

- **APPROVE** → task stays DONE. Append `✓ review` to the Verify col.
- **CONCERNS** → present the findings inline: "Fix now / accept with reason". Accepted concerns are stamped in the Notes col. A concern describing a real defect (wrong behavior, security hole, data loss path) cannot be accepted — fix it.
- **REJECT** → flip Status=BLOCKED with the findings in Notes, and log a defect (see Defect ledger below, Phase=review).

**Security offer (sensitive tasks, after APPROVE):** when the task's changed files match the sensitive-area pattern in `skills/deep-security-audit/SKILL.md` (auth, sessions, permissions, tenants, payments, webhooks, uploads, exports, admin), ask once in that skill's offer format whether to run `deep-security-audit` (`quick`, scoped to the task's paths). On yes, run it before the next task starts. Its confirmed findings become fix tasks per its overlay O6. On no or later, log the answer in `decision-log.md` and continue. Batch tasks of one feature into a single offer when the feature finishes, so the operator is asked once per feature, not once per task.

POC fast-path (`planning_depth: poc`): per-task review may be deferred to milestone close — stamp `review: deferred (poc)` in the Verify col so the deferral is visible.

**Defect ledger (`AI_DOCS/quality/defect-log.md`):**

A DEFECT is any problem found in code AFTER its task was stamped DONE: a review REJECT, a regression failure traced to an earlier DONE task, a QA/audit finding, or a production incident. Verification failures during normal task development are NOT defects. On every defect, append one row (create the file with the header on first use):

```
| ID | Date | Phase found | Severity | Milestone:Task | Summary | Root cause | Escaped? | Fix ref | Prevention |
| D-001 | YYYY-MM-DD | review/regression/qa/audit/staging/production | crit/high/med/low | M01:T-03 | one line | one line | yes if found at audit or later | task/commit | rule or gate updated, or "pending retro" |
```

`Escaped? = yes` means the defect got past the phase that should have caught it (anything found at audit, staging, or production). The escaped-defect rate (escaped defects / delivered tasks) is the project's bug-rate metric, target < 1%. `/retrospective` reads this ledger and MUST convert every escaped defect into a rule, gate, or check update (the Prevention column).

**On FAIL — bounded auto-fix, then escalate (autonomy within the milestone):**

The build does not stop dead on the first failure. It attempts a bounded, transparent auto-fix before escalating, so a milestone runs autonomously between human decisions: the human gate is the milestone boundary, not every transient failure.

```
max_rounds = stack.md → build.autofix_rounds (default 2; set 0 to disable and escalate immediately)
round = 0
while round < max_rounds:
    round += 1
    1. Diagnose: dispatch `/debugger` (or the `code-reviewer` findings for a review REJECT) on the failing check + trace.
    2. Apply the focused fix — ONLY within this task's files. Never widen scope. Never edit a locked artifact
       (api-contract.md, database-schema.md, the locked app-shell): those route to /change-request and end the loop.
    3. Re-verify: re-run the failing check; if it passes, re-run the FULL verify battery (incl. regression) so a
       fix cannot silently break another check.
    4. If the full battery PASSES → Status=DONE, Verify col appends "(auto-fixed Nx)", append a Verification-log
       row noting each round, then proceed to Code review.
    5. If still failing → continue. A fix that makes a DIFFERENT check fail still consumes a round.
Escalation ladder (builder-dispatched tasks):
    rounds 1..max_rounds: continue the SAME builder via SendMessage with the failure report (it keeps the task context).
    escalated attempt (exactly one, after the last same-builder round fails, before the ruling, not counted in
    max_rounds, skipped when build.autofix_rounds is 0):
        dispatch a FRESH builder one model tier up. A Sonnet builder escalates to the session model, i.e. dispatch
        without the model override. The failure report and the rounds already tried go in a file under
        AI_DOCS/.temp/handoff/<task-id>/ and the prompt carries the path, so the fresh builder starts clean
        instead of inheriting a polluted context.
    Fix diffs get a scoped re-review: code-reviewer reviews ONLY the fix diff plus the original finding, not the
    whole task again. The full verify battery still re-runs on every fix.
Each round is logged in the Notes col (what failed, what was tried). Auto-fix is local code editing only
(Category A safe per ops-safety-rules): it never runs an external, deploy, or migration operation.
```

If still failing after `max_rounds` (or `max_rounds = 0`):
```
Status=BLOCKED in tasks.md
Notes col = failing step + offending line + the auto-fix attempts and why each failed
```
Before asking, the orchestrator writes a ruling line to the milestone `decisions.md`:
```
Ruling: <decision>, <why>, <cost if wrong>
```
Then it either parks the finding with that ruling (non-blocking findings, the ruling states the accepted risk) or asks via `/ask` when the cost if wrong is high or the decision belongs to the user. For a blocking failure, escalate to the user inline with the full trace:
```
T-02 blocked after 2 auto-fix rounds: tsc — "Property 'userId' does not exist on type 'Session'".
Tried: round 1 added userId to the Session type (broke 2 auth tests); round 2 sourced it from the JWT
claims (type still mismatched). Still failing.

Options:
1. Fix it now (tell me what to change)
2. Investigate together (show me the relevant files)
3. Skip this task (mark SKIPPED with a reason)
```
Wait for the user's choice. The retry is bounded and every round is logged: after the bound, the human decides. Never retry beyond `max_rounds`, never silently, never touch a locked artifact or an external operation inside the loop.

### Milestone close

When all tasks in a milestone are DONE (or SKIPPED with reason):

0. **Drift gate (BLOCKING):** force a fresh scan (`rm AI_DOCS/memory/.drift-last-run` then `bash .claude/hooks/drift-detector.sh`). The milestone stays open while findings exist: Phase A or D → route through `change-request`; Phase C findings touching this milestone's features → write the missing tests first; Phase H findings (installed-but-unused libraries, unused dependencies) → adopt the library or remove the package before close. Do not close on a 24h-cached report.
1. Update `task-ledger.md` milestone row: Status=DONE, Progress=N/N.
2. Update `gate-status.md` exit gate verdict for this milestone.
2.5. **Defect check:** if `AI_DOCS/quality/defect-log.md` has rows for this milestone, include the count + escaped rate in the recap, and if any row still says `Prevention = pending retro`, recommend running `/retrospective` before starting the next milestone (its Step 2.5 converts escaped defects into rule/gate updates).
2.55. **Security offer at milestone close:** when the milestone diff (`git diff --name-only <milestone base>...HEAD`) touches a sensitive area per `skills/deep-security-audit/SKILL.md`, and no `AI_DOCS/audit/security-summary.md` covers HEAD, ask once whether to run `deep-security-audit` (`quick`). Run it on yes BEFORE the MAVS gate so `/audit` check 13 sees the result. A no is logged and never blocks.
2.6. **Milestone MAVS gate (BLOCKING, non-POC):** dispatch `milestone-validation` to run the full MAVS validator suite as a PARALLEL fan-out (per the stack: authz / schema / api / auth / e2e / qa / a11y / security / traceability / responsive / ui / visual / fidelity / perf / behavior), each regenerating its `AI_DOCS/quality/mavs/<validator>.json` fresh against the current HEAD. The milestone cannot close until `hooks/mavs-gate.sh` parses those reports green: any `FAIL`, any STALE report (`source_commit != HEAD`), or any missing required validator BLOCKS the milestone → develop merge. The verdict is PARSED from the reports, never a self-reported string, and the operator reviews the single unified `AI_DOCS/quality/mavs/SUMMARY.md`. The legacy `milestone-e2e-gate.sh` now delegates to `mavs-gate.sh`. No green → the milestone stays open and the bounded auto-fix loop (or the user) fixes the failing validators first.
2.65. **UI design-QA pass (frontend milestones, operator-present):** after the MAVS gate is green, if the milestone shipped UI and a Claude-in-Chrome session is available, dispatch `ui-review` for a holistic UX walk of the built app (the human-eye layer above the measured `mavs/ui.json` craft checks). It writes `AI_DOCS/quality/design-qa-report.md` and applies fenced fixes (locked shell + tokens respected, principal-designer sign-off, functional suite re-run) if the operator wants polish. Aesthetic findings stay advisory. A present FAIL in `mavs/ui-review.json` (confirmed functional, BLOCKING-checklist, or journey-deviation finding) blocks the promotion merge via mavs-gate, and the report's absence never blocks. Skip silently when headless / no Chrome session (`ui-review` records `MISSING_TOOL`). Do not run it concurrently with the headed Playwright MAVS suite on a low-RAM host (both are HEAVY, see `docs/coordination-rules.md`).
2.7. **Promotion + deploy decision (re-ask each milestone):** read `AI_DOCS/deployment/git-strategy.md`. Ask the user how to promote this milestone now, presenting their chosen strategy plus alternatives:
```
Milestone M01 verified ✓ — how do you want to promote it?
1. Promote per your strategy now (e.g. merge develop → staging, QA there, then → main)
2. Hold on develop — keep integrating until a later milestone, release as a batch
3. Switch strategy (e.g. you're still early — go develop → main directly for now)
```
Then ask whether to deploy this milestone now or wait until full scope is approved. CI/CD may be PLANNED and its workflow files CREATED but left disabled/unpushed until the user confirms full scope is done (Gate 5). Log both decisions to `git-strategy.md` and `decision-log.md`. Deployment itself runs only via Phase 3, and AI never runs a deploy command without explicit confirmation.
3. Ask the user:
```
Milestone M01-setup complete ✓
  Tasks: N done, 0 blocked
  Gate: Gate-1 APPROVED

Next: M02-core — N tasks planned.
Summary of what M02 will deliver: <one line from capsule.md>

Continue? [Y / n / show M02 plan]
```
On Y → continue loop into M02. On n → stop. On "show M02 plan" → print `milestones/M02-core/capsule.md` + `tasks.md` then ask again.

---

## Phase 2 — Audit (pre-ship verification)

Runs when the user says "audit", or automatically when all milestones are DONE before shipping.

**Deep security audit routing:** "security audit", "deep security review", "pen test the code", "find vulnerabilities" or a client security assessment route to `deep-security-audit` (SK-169) in full audit mode, not to these inline checks. A security question about one function or one finding uses that skill's guidance mode. `/audit` check 13 then reads its committed summary.

Audit depth depends on `stack.md → compliance:`:

- **compliance empty or `none`:** run the inline checks below (fast path), no separate skill invocations.
- **compliance non-empty (hipaa / soc2 / gdpr / pci / ...):** FIRST dispatch `team-security` (parallel `security-auditor` + `api-validator` + `code-reviewer`) and run `audit-logs` verification via real Skill calls, THEN merge their findings with the inline checks below. The inline greps are a baseline for a regulated project, not a substitute: a compliance project audited by inline grep alone is itself a CONCERNS. This consumes the `audit` / `audit-logs` skills armed in Step 2.5, and Gate 5 requires the `team-security` report on a compliance project.

### Checks (in order)

**1. Secrets scan** (always):
Grep working tree (exclude `.git`, `node_modules`, `.next`, `dist`, `build`, `__pycache__`, `.venv`):
- `(?i)api[_-]?key\s*[=:]\s*['"][A-Za-z0-9_\-]{16,}['"]` → FAIL
- `(?i)secret\s*[=:]\s*['"][A-Za-z0-9_\-]{16,}['"]` → FAIL
- `(?i)password\s*[=:]\s*['"][^'"]{6,}['"]` → FAIL (allowlist test fixtures)
- `AKIA[0-9A-Z]{16}` → FAIL
- `-----BEGIN .* PRIVATE KEY-----` → FAIL
- `(?i)bearer\s+[A-Za-z0-9_\-\.]{20,}` → CONCERNS

**2. Dependency CVEs** (always):
- Node: `pnpm audit --prod --json` (fall back to `npm audit`)
- Python: `pip-audit` if available, else `pip list --outdated`
- High/critical → FAIL. Moderate → CONCERNS.

**3. Accessibility** (web projects):
- If Playwright installed: `npx playwright test --grep @a11y`
- Else static grep: `<img>` without `alt`, `<button>` with no text, missing `aria-label` on icon buttons
- Critical → FAIL. Serious → CONCERNS.

**4. OWASP grep** (only if `stack.md compliance:` has hipaa/soc2/gdpr/pci):
- `eval\(` or `Function\(` outside test files → CONCERNS
- Raw SQL string concatenation → CONCERNS
- `dangerouslySetInnerHTML` / `v-html` / `innerHTML =` → CONCERNS
- `cors\(` with `origin: ['"]?\*['"]?` → FAIL
- Cookies without `HttpOnly` and `Secure` → CONCERNS
- Missing rate-limit on auth/billing endpoints → CONCERNS

**5. Audit-log check** (compliance projects only):
For each endpoint in `api-contract.md` not marked `public`: grep handler file for `auditLog\(` or `AuditLog\.create`. Missing on sensitive endpoint → CONCERNS (HIPAA/SOC2) or FAIL (stricter).

**6. SAST** (always):
- Python code → `python3.12 -m bandit -r src/ -ll -q`: HIGH → FAIL, MEDIUM → CONCERNS, bandit missing → CONCERNS with install line
- TS/JS code → `eslint-plugin-security` present in devDependencies + ESLint config: absent → CONCERNS (guardrails adds it)
- `semgrep` if available (macOS/Linux/CI): `semgrep --config p/owasp-top-ten --error --quiet`: ERROR → FAIL. Skip silently on Windows.

**7. License deny-list** (always):
Production dependencies containing `AGPL`, `SSPL`, or `GPL-3.0` (Node: `npx license-checker --production --summary`, Python: `pip-licenses` if installed) → CONCERNS naming package + license, FAIL when `stack.md → license_policy: strict`. Exceptions must already be in `decision-log.md`.

**8. Unused dependencies** (always):
- Node: `npx knip` (fallback `npx depcheck`) — an unused PRODUCTION dependency → CONCERNS, and FAIL at ship unless a `decision-log.md` exception names it.
- Python: `deptry .` when available (else CONCERNS with the install line).
- Go: `go mod tidy` then `git diff --exit-code go.mod go.sum` — a diff → CONCERNS.
- Compliance projects additionally: grep dependencies for document/AI SDKs that process data on EXTERNAL services. One present without an ADR processing-location entry (in-region / self-hosted / external, per Step 1.9's regime) → CONCERNS: regulated data may be leaving the region.

### Audit output

Write `AI_DOCS/audit/audit-report.md` (overwrite each run):
```markdown
# Audit Report
Date: YYYY-MM-DD HH:MM
Verdict: PASS | CONCERNS | FAIL
Compliance: <flags | none>

## Summary
- Secrets: PASS | N findings
- CVEs: PASS | N high/critical
- Accessibility: PASS | N violations
- OWASP: PASS | N issues
- Audit logs: PASS | N missing
- SAST: PASS | N high, M medium | tool missing
- Licenses: PASS | deny-list hits
- Unused deps: PASS | N unused | tool missing

## Findings
[list of findings with file:line + fix suggestion]
```

Verdict logic: Any FAIL severity → **FAIL**. No FAILs but ≥1 CONCERNS → **CONCERNS** (user can override). All clear → **PASS**.

Tell the user the verdict. FAIL → must fix before shipping. CONCERNS → ask "Override and ship anyway? [y/N]".

---

## Phase 3 — Ship

Triggers when user says "ship", "deploy", or `/do ship`.

**Release readiness (replaces the retired `team-release` skill, v4.32.0):** before the pre-flight table, on a production release, dispatch `engineering-lead` for the readiness verdict (open defects, tech-debt holds, rollback plan) and run `gate-enforcement` Gate 5, which already convenes the Tier-1 directors (PHASE-GATE) per `AI_DOCS/review-mode.txt`. `milestone-validation` must be green for the last milestone, and the security side is the `/audit` verdict row below (its check 13 reads the deep-security-audit summary). A CONCERNS verdict is presented in the `/ask` shape with the recommendation, a REJECT stops the ship.

### Pre-flight (refuse if any check fails)

| Check | Source | Block on |
|---|---|---|
| Audit verdict | `AI_DOCS/audit/audit-report.md` | FAIL, or missing, or older than 24h |
| Scope closure (Gate 5) | `gate-status.md` + `AI_DOCS/audit/scope-closure-report.md` | Gate 5 not PASSED, report missing, or older than the last `task-ledger.md` change — run `gate-enforcement` Gate 5 first |
| Drift | `AI_DOCS/quality/drift-report.md` | Unacknowledged findings after a forced fresh scan (`rm AI_DOCS/memory/.drift-last-run` + run the hook) |
| All tasks done | `task-ledger.md` | Any milestone with Status ≠ DONE (except if user added SKIPPED with reason) |
| Working tree | git | Uncommitted changes |
| Branch | git | Not on deploy branch declared in `stack.md` |
| Tests | run command | Any failure |
| First-release security offer | `decision-log.md` (no earlier `Shipped to` production entry) + `AI_DOCS/audit/security-summary.md` | Not a block. Before the first production deploy, if no summary covers HEAD, ask once whether to run `deep-security-audit` (`standard`). Open confirmed critical or high findings already block through the Audit verdict row |
| E2E golden path | `tests/e2e/` or `tests/smoke/` | Any failure. UI project with NO E2E suite at all → blocked: write the golden-path suite first (via `qa-testing` / `e2e-testing`) or get an explicit logged override |

If any check fails: tell the user which one failed and what to do. Stop.

### Deploy

Read `stack.md → deploy.target`. Run:

| Target | Command | Health check |
|---|---|---|
| Vercel | `vercel --prod` | `curl -fsS https://<domain>/api/health` → 200 |
| Fly.io | `fly deploy` | `fly status` → all machines healthy |
| Railway | `railway up` | URL probe 200 |
| Cloudflare Pages | `wrangler pages deploy` | URL probe |
| Docker Compose | `docker compose pull && docker compose up -d` | `docker compose ps` healthy + URL probe |
| Custom | script from `stack.md → deploy.script` | check from `stack.md → deploy.health` |

On non-zero exit: stop immediately. Show the error and last 30 lines. Ask "Retry, fix inline, or abort?"

### Post-deploy

1. Run health check (retry up to 3× with 10s backoff).
2. Run smoke tests if `tests/smoke/` exists.
3. On all green: append to `AI_DOCS/memory/decision-log.md`:
```
## YYYY-MM-DD HH:MM — Shipped to <target>
- Branch: <branch>  Commit: <sha>
- Audit: PASS (<timestamp>)
- Health: ✓
- URL: <prod URL>
```
4. Tell the user: "Shipped ✓ — <URL>"

---

## Phase 4 — Maintenance (after go-live, /do still owns the project)

The SDLC does not end at deploy: `discovery → ... → deployment → maintenance`. Before this phase, `/do` dropped the user into loose skills at go-live. Now `/do` owns day-2: after Gate 5 / a successful ship, a production task routes here instead of out of the framework.

| Trigger | /do dispatches |
|---|---|
| Urgent production fix ("hotfix", "prod is broken", "patch live") | `operations` (hotfix workflow: branch from main, regression test, fast-track MAVS gate, graduated-autonomy deploy, backport) |
| Production down / degraded / security or data incident | `incident-response` (SEV classify, incident-commander loop, timeline, comms), then `operations` for the fix, then `retrospective` |
| Monitoring review, rotation due, dependency/cert/cost check | `operations` (monitoring cadence, secret/cert rotation, FinOps reconciliation, the seeded `/schedule` jobs) |
| Post-incident learning | `retrospective` (blameless, converts root cause into a rule/gate/check) |
| Framework improvement from recurring learnings | `retrospective` writes generalized candidates to `AI_DOCS/quality/framework-feedback.md`, then dispatch the `learning-curator` agent to abstract + dedupe them into a promotion PROPOSAL. Promotion to the shared framework is a separate human-approved action, never an auto-commit from a project (`rules/self-improvement-rules.md`). |

At first successful ship, `/do` has `operations` seed the default `/schedule` maintenance jobs (dependency refresh, secret rotation, cert-expiry, FinOps) and confirm the production billing alarm exists. Graduated deploy autonomy applies (`rules/ops-safety-rules.md`): the AI may run dev/preview deploys and read-only health/smoke checks autonomously, but stops for human approval at any staging/prod mutation and at every rollback decision.

---

## Decisions /do makes silently

- Which task to pick next (row order + blockedBy graph)
- File names, module organization, internal types, test file location
- Lint/format choices not in `stack.md`
- Whether to inline a helper or extract it (≤3 uses → inline)
- When to run audit (at milestone close + at `/do audit` request)
- Dispatching subagents for read-heavy or edit-heavy work to keep the main window lean (per `rules/context-efficiency-rules.md`)

## Decisions /do never makes alone

- **Scope changes** (add/remove/change features mid-flight): route through `change-request` (Impact Propagation Protocol) so every stale AI_DOCS artifact is found and updated via the traceability matrix — never just edit `tasks.md` in isolation.
- **API contract changes**: update `api-contract.md` first, then ask "Contract updated. Continue?"
- **Any BLOCKED task**: surface to user with options — never silently retry or debug
- **Shipping**: always confirm with the user before running deploy command
- **Skipping a gate or check**: always ask with an explicit "override" confirmation

---

## Subcommands

| Command | Effect |
|---|---|
| `/do` (no args) | Bootstrap → resume or plan |
| `/do status` | Print task-ledger summary + last decision + audit verdict + armed skills (Activation Map) + count of unresolved `<!-- STALE -->` markers in planning docs + defect summary from `quality/defect-log.md` (total, escaped, escaped rate vs the <1% target). No side-effects. |
| `/do audit` | Run Phase 2 inline |
| `/do security-audit [quick\|standard\|deep] [paths]` | Run `deep-security-audit` in full audit mode (default `quick`, whole repo) |
| `/do ship` | Run Phase 3 (audit first if stale, then deploy) |
| `/do hotfix <desc>` | Phase 4: dispatch `operations` hotfix workflow (branch from main, regression test, fast-track gate, deploy, backport) |
| `/do incident <desc>` | Phase 4: dispatch `incident-response` (SEV classify, commander loop, comms, timeline) |
| `/do checkpoint` | Write thorough `session-state.md`, persist capsule updates, print "Checkpoint written. Safe to compact." |
| `/do switch-stack <frontend>` | Update `stack.md → frontend:`, regenerate `active-skills.md`, ask before applying |
| `/do reset` | Refuse. Tell user to manually delete `AI_DOCS/` if truly needed. |

---

## Resolving ambiguous "do this"

When the user says just "do this" or "continue":
1. Read `session-state.md → Next action`
2. Read active milestone's `tasks.md` → find the DOING or first TODO row
3. If unambiguous → proceed with that task (announce in one line)
4. If ambiguous → ask ONE question

---

## Boundaries

- Edits only application code and `AI_DOCS/`. Never edits `.claude/` files except `AI_DOCS/` state files.
- Announces every significant action in one line before doing it.
- Hard cap: 50 task iterations per user invocation (safety net). On hit, summarize and yield.
- Context discipline (`rules/context-efficiency-rules.md`): dispatch read-heavy investigation, wide scans, and document ingestion to the `explorer` agent (read-only) or another subagent that returns a summary, rather than reading many files inline. Keep the orchestration context lean. This is investigation delegation, not build-task parallelism.
- Build tasks run one at a time by default. Provably independent tasks may run as a governed parallel wave (worktree-isolated builders, sequential merges, HEAVY_CAP) per the Parallel wave lane in Phase 1. Dependent or overlapping tasks are never parallelized, and merges are never concurrent. Investigation subagents and queued-task briefs always run in parallel freely.
- Never edits `api-contract.md` without updating `capsule.md` spec.md + telling the user.

---

## Verification (smoke tests for /do itself)

- Empty project + "build me a URL shortener" → Phase 0 fires, intake collects routing inputs, then dispatches tech-specification → design-* → infra-planning → milestone-planning, Gate 1 (Planning Completeness) runs, only then Phase 1 starts.
- Empty project + "just a quick POC for X" → POC fast-path, `planning_depth: poc` stamped, full dispatch skipped, single milestone seeded, Phase 1 starts.
- Empty project, planning dimension left blank (e.g. no infra-plan) → Gate 1 FAILs, /do names the blank dimension and refuses to enter Phase 1 until filled or marked N/A.
- Project mid-build + "/do" (no args) → reads session-state, resumes DOING task without re-asking.
- Verification failure → Status=BLOCKED stamped, user asked with options, loop stops.
- All M01 tasks DONE + "/do" → milestone recap, asks "Continue to M02?"
- Mid-flight feature change → routed through `change-request` (Impact Propagation), stale artifacts updated, Gate 1 re-checked before code resumes.
- "/do ship" with no prior audit → runs Phase 2, then Phase 3.
- "/do status" → prints table + last decision + audit verdict + stale-artifact count, no side-effects.

<!-- v6.30.0 (2026-10-22): ADF v4.32.0. Inline questions use the /ask 2.0.0 shape (Read, Wording, Conflict, Question, recommendation) and recommendations carry the advisor-stance Rule 9 scope line. Multi-layer feature lane in Phase 1 and release readiness in Phase 3 absorb the retired team-feature, team-design and team-release skills (same gates, same agents, run by /do). -->
<!-- v6.29.1 (2026-10-22): wording: the escalated fix attempt is one attempt after the same-builder rounds, not a numbered round 3. -->
<!-- v6.29.0 (2026-10-22): Fix-loop escalation and rulings (ADF v4.30.0, ideas from obra/superpowers). Auto-fix with the builder continues the same builder via SendMessage for rounds 1 and 2, dispatches a fresh builder one model tier up at round 3 with the failure report as a file, writes a `Ruling: <decision>, <why>, <cost if wrong>` line to the milestone decisions.md after the cap (then parks or asks), and re-reviews fix diffs by scope only. -->
<!-- v6.28.0 (2026-10-22): Deep security audit wiring (ADF v4.29.0). Routing for security-audit and pen-test requests to deep-security-audit (SK-169), a security offer after sensitive tasks (batched per feature), Step 2.55 security offer at milestone close before the MAVS gate, a first-release security offer row in the ship pre-flight, and the /do security-audit subcommand. Offers never block, only open confirmed critical or high findings do (via /audit check 13). -->
<!-- v6.27.0 (2026-10-05): Progress and ETA for long-running actions (operator request). Phase 1 gains a reporting section: long shell actions launch in background with a log, a start stamp and a trailing EXIT line, an up-front step table with ETAs from the last comparable run, computed progress via scripts/progress-eta.sh at checkpoints and on demand, outcome reported against the estimate, one consolidated table for parallel jobs. Reporting only, no gate or approval change. -->
<!-- v6.26.2 (2026-08-21): Impeccable integration (vendored specialist). Step 2.5 arms `impeccable` when the project has a web UI surface and skills/impeccable/ is installed (dispatched by /do only, mode mapping in active-skills.md). Per-task loop: on UI tasks with impeccable armed, the polish pass is dispatched BEFORE the visual-QA judgment and the detect lane runs per the Verify battery (mavs/slop.json, advisory). DSC + mavs/visual.json stay the verdict of record. -->
<!-- v6.26.1 (2026-08-21): Truth reconciliation (PLAN-v4.20-hardening Part 2.1 + 2.7). Step 2.65 now states the three-trigger blocking truth (a present FAIL in mavs/ui-review.json from a confirmed functional, BLOCKING-checklist, or journey-deviation finding blocks the promotion merge via mavs-gate, absence never blocks, aesthetics stay advisory) and drops the stale ADVISORY label. Step 2.6's validator fan-out names the full set (adds responsive / ui / visual / fidelity / perf / behavior). Stamp example gains the visual-qa tick. Implement step's no-TODO line rewritten as a motivated positive with deferred work tracked in tasks.md. Explorer parenthetical drops the removed Haiku model tag. No behavior change. -->
<!-- v6.26.0 (2026-08-20): Flow validation + execution speed. Step 2 dispatch adds `flow-prototypes` (checklist mode, non-POC) after tech-specification, triaging every flow into Tier S / Tier F and writing AI_DOCS/design/flow-validation-plan.md; Step 2.5 Activation Map arms flow-prototypes while any Tier F row is not approved or waived. Per-task loop adds a Flow gate check alongside the STALE/drift checks (blocks an unapproved Tier F task's `flow:` tag, dispatches flow-prototypes prototype+judge modes). Overlap: Task Brief prefetch for the next task during the current task's verify/review stage (re-validated by the existing STALE/drift checks at task start), scope validation and code review dispatched in parallel and joined before stamping, verify battery's independent early checks run concurrently ahead of the dependent build/regression/exercise chain (full definitions in skills/build/VERIFY-BATTERY.md). Phase 1 documents unattended milestone stretches under /goal with a turn bound, gates/auto-fix cap/deploy autonomy unchanged. Added subagent dispatch to the silent-decisions list. -->
<!-- v6.24.0 (2026-07-09): Execution-quality upgrade (PLAN-execution-quality, all tracks, from field findings bugs.md). Per-task: Task Brief alignment gate (requirement re-read by ID + plan-vs-code reality check, DRIFT routes to change-request), builder-by-default, Exercise gate (drive the changed flow for real) + Acceptance Evidence table as the DONE contract, quality-lead scope validation (SCOPE-OK/UNDER/OVER) between verify and review, reviewer acceptance-coverage. Phase 1: governed Parallel wave lane (worktree-isolated builders, sequential merges, HEAVY_CAP). Dependency gate adds added-must-be-used; Phase 2 audit check 8 (unused deps via knip/deptry/go mod tidy + external-processing SDK check); milestone drift gate covers Phase H. -->
<!-- v6.12.0 (2026-06-29): Track H + T-4.1. Phase 1 bounded auto-fix loop (build.autofix_rounds) before escalating; Phase 1 Stage 0 builds+craft-reviews+LOCKS the app-shell before feature tasks; shell-fidelity gate added to the verify battery; Step 1.7 adds UI library + app-shell base selection. Also v6.10.0: Phase 2 audit branches on compliance (team-security for regulated projects). -->
<!-- v6.15.0 (2026-06-29): Track E. Phase 4 (Maintenance): after go-live /do owns day-2, dispatching operations (hotfix/monitoring/rotation/FinOps), incident-response (SEV/commander), retrospective. Seeds /schedule maintenance jobs at first ship; graduated deploy autonomy. Added /do hotfix + /do incident subcommands. -->
<!-- v6.14.0 (2026-06-29): MAVS Wave 2 orchestration (T-4.4). Milestone close step 2.6 is now the Milestone MAVS gate: dispatch milestone-validation to run the full validator suite in parallel, block on the parsed mavs-gate verdict (any FAIL/stale/missing-required), operator reviews mavs/SUMMARY.md. Subsumes the E2E gate (milestone-e2e-gate.sh delegates to mavs-gate.sh). -->
<!-- v6.13.0 (2026-06-29): Track G. Step 2 design dispatch rewired to the gated pipeline: ux-foundation (Gate UX-0) -> design-discovery -> design-direction (grayscale, Gate UX-1 before color) -> design-tokens -> design-screens. ux-foundation armed when a frontend is in the stack. -->

<!-- v6.10.0 (2026-06-29): Phase 2 audit compliance branch (team-security + audit-logs for regulated projects); task-source canon (active milestone tasks.md). -->
<!-- v6.11.0 (2026-06-29): T-4.1 bounded auto-fix loop in Phase 1 on verification failure. -->

<!-- Version: 6.27.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
