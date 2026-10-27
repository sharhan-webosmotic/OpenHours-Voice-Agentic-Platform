---
paths:
  - "AI_DOCS/architecture/**"
  - "AI_DOCS/planning/**"
  - "AI_DOCS/memory/stack.md"
---

# Runtime Architecture Rules

> Always-on selection rule. Governs HOW the runtime and data-flow architecture is
> chosen, drilled, confirmed, and stored, BEFORE any planning artifact locks it in.
> The sibling of `tech-stack-selection-rules.md`: that file picks the language,
> framework, database, and host. THIS file picks how data MOVES and how work
> EXECUTES: caching, real-time transport, async work, API style, and the resilience
> primitives that make all of it debuggable.
> Loaded by: `/do` (Phase 0 runtime-architecture step), `/plan`, `/architecture`,
> `/tech-specification`, `/infra-planning`, `/build`, `/build`,
> `caching-strategy`, `error-handling`, and any skill that proposes or records a
> runtime pattern. The option catalogue lives in
> `skills/tech-specification/ARCH-PATTERNS.md`; this file is the discipline that
> wraps it.
>
> The single sentence that controls everything below: every data-flow pattern is
> chosen FROM the requirement, never from habit, and never added before the
> requirement earns it. There is no default infrastructure.

---

## Rule 1: Selection is mandatory and requirement-first (BLOCKING)

Runtime-architecture selection runs for every non-POC project, ALWAYS, before the
tech spec locks. It decides, per project, an explicit answer (a chosen pattern OR a
recorded `N/A (reason)`) for each of these axes:

1. **Caching** — what is cached, at which layer, with what TTL and invalidation.
2. **Real-time transport** — WebSocket, SSE, polling, webhook, or none.
3. **Async / background work** — inline, scheduled (cron), queue + worker, pipeline,
   or stream.
4. **API interaction style** — synchronous request/response, async job + status, or
   event-driven.
5. **Resilience primitives** — idempotency, retry/backoff, dead-letter, outbox,
   rate limiting (decided wherever an axis above introduces a failure mode).

It runs even when the requirement names a technology (for example "use Redis"), the
user states a preference, or a prior project used a given pattern. Never inherit a
runtime pattern from a document, a habit, or a prior project without explicit
in-session confirmation. A spec that introduces a queue, a socket, or a cache with
no recorded selection step is a defect, caught by Gate 1.

POC exception: when `stack.md` has `planning_depth: poc`, a thin runtime pick is
allowed. Record it anyway, mark it `poc`, and note it is not requirement-validated.

## Rule 2: No default infrastructure (BLOCKING)

The framework adds NO Redis, NO queue, NO WebSocket, NO pipeline by default. Each is
an option, justified by a requirement signal, never an assumption.

Forbidden:

- Adding Redis "because every backend has Redis" with no caching, session, or rate-
  limit requirement that earns it.
- Standing up a message queue for a flow that completes in milliseconds inside the
  request.
- Reaching for WebSockets when the requirement is "data refreshes every few minutes".
- Building a pipeline for a dataset that fits one synchronous query.

The cheapest pattern that meets the requirement wins. Premature infrastructure is a
cost, an operational burden, and a debugging surface. It is the most common runtime
mistake this rule exists to prevent. The mirror failure is also banned: choosing
polling where the requirement says "live", or running heavy work inline where it
blocks the request, is under-architecting and is equally a defect.

## Rule 3: Drill the requirement before recommending (BLOCKING)

Pull the runtime signals out of the requirement. Do not wait for the user to
volunteer them:

- **Latency tolerance**: how fresh must the user's view be? Sub-second, seconds,
  minutes, or batch? (drives real-time vs polling vs cache TTL)
- **Work duration**: does any operation exceed the request budget (roughly > 1s of
  CPU/IO, or any third-party call that can hang)? (drives async vs inline)
- **Read/write ratio and hot reads**: are the same expensive reads served
  repeatedly? (drives caching, and only then)
- **Fan-out and bursts**: do events trigger many downstream actions, or arrive in
  spikes? (drives queue + worker, back-pressure)
- **Delivery guarantee**: can a dropped job lose money, data, or trust? (drives
  durable queue, idempotency, outbox, dead-letter)
- **Concurrency and consistency**: can two requests collide on the same record?
  (drives idempotency keys, locking, transactional outbox)
- **Scale path**: does the pattern hold at the 6-month and 1-year targets from
  tech-spec S12 by config change, not re-architecture?

If the requirement contradicts a stated preference (the user wants a queue for a
synchronous lookup, or wants polling for a live trading feed), SAY SO. Push back with
the reason, the better-fit pattern, and the concrete cost of the mismatch. Holding
this position is the point of the rule.

## Rule 4: Decide the data-flow as one topology, not piecemeal (BLOCKING)

The five axes interact. Decide them together, as a single data-flow topology, on
single-service projects too:

- A chosen queue forces idempotent handlers, a retry policy, and a dead-letter path.
  You do not get to add the queue and skip the handler obligations.
- A chosen cache forces an invalidation rule and a stale-tolerance statement. A cache
  with no invalidation plan is a bug generator.
- A chosen real-time transport forces an auth model on the socket/stream and a
  reconnect/back-pressure plan.
- An async-job API forces a status/result channel the client can poll or subscribe
  to, plus an idempotency key on submit.

Reason about the failure modes each pattern introduces (a worker that crashes mid-
job, a socket that silently drops, a cache that serves stale money) and name the
mitigation in the same decision. Record the topology as a runtime ADR (`/architecture`):
ADR-003 caching, ADR-008 messaging/async, ADR-009 real-time transport, as applicable.
Every project that uses any non-trivial axis gets the matching ADR, single-service
included.

## Rule 5: Informed options, recommendation, and confirmation (FORMAT contract)

Never ask a bare "do you want Redis / a queue / websockets?". For EACH axis in scope,
present, using the catalogue in `skills/tech-specification/ARCH-PATTERNS.md`:

1. The viable patterns for THIS requirement, one line each on what they are best at.
2. The trade-off that matters here, and the cost of the pattern (operational, latency,
   complexity).
3. One opinionated recommendation with a requirement-grounded reason (the actual
   signal from Rule 3 that points to it), including "none / inline / N/A" when the
   requirement does not earn the infrastructure.

Then confirm the full data-flow topology back to the user: "confirm, change an axis,
or explore alternatives?". The user can always override. An override is recorded with
its reason, never argued past once the user has the trade-off in front of them.

Format per axis:

```
? Async work — the export endpoint builds a 50k-row report
  - inline: simplest, but holds the HTTP request 8-20s and times out behind most proxies.
  - queue + worker: submit returns a job id immediately; worker builds the file; client polls status.
  Recommended: queue + worker. Work exceeds the request budget and must survive a worker restart.
  Obligations this forces: idempotent job (dedupe by job id), retry with backoff, dead-letter after 3 fails, correlation id logged at submit + each attempt.
```

## Rule 6: Every chosen pattern carries code-level obligations (BLOCKING)

A runtime pattern is not "chosen" until its code-level obligations are named in the
plan AND enforced in the build. The obligation set per pattern lives in
`ARCH-PATTERNS.md` and is checked by `/build`'s runtime-pattern fidelity gate. The
baseline obligations:

- **Any async/queued/background path**: an idempotency key or dedupe guard, a retry-
  with-backoff policy, a dead-letter / failure sink, and a bounded timeout. A handler
  with none of these is not done.
- **Any real-time transport**: an auth check on connect, a reconnect/back-pressure
  strategy, and a heartbeat or liveness signal.
- **Any cache**: an explicit TTL and an invalidation trigger, plus a documented
  stale-tolerance (what is the user allowed to see that is out of date, and for how
  long). Cache-aside reads must tolerate a cache miss and a cache-down state.
- **Every axis above**: a structured log line with a correlation / request / job id
  at each boundary (submit, attempt, success, failure), so the path is traceable.
  This is the "easy to debug" requirement made concrete: an async path with no
  correlation id is unobservable and fails the gate.

These obligations are WHY the deliberate choice matters. The pattern picked in
planning is the thing that makes the generated code optimized and debuggable rather
than merely functional. Skipping the choice means the obligations never get written.

## Rule 7: Store the decision as data, not prose (BLOCKING)

On confirmation, persist the runtime topology in the planning artifacts, all in the
same change:

1. **Tech-spec S22 (Cross-Cutting Concerns)** rows: Caching, Async work / queues /
   workers, Real-time transport, Idempotency & retry. Each row states the chosen
   pattern (or `N/A (reason)`), the trigger, and the owning skill.
2. **Tech-spec S12** records the caching strategy and any worker/queue capacity in the
   scalability plan (concurrency, throughput, scale path).
3. **A runtime ADR** in `AI_DOCS/architecture/adrs/` for each non-trivial axis (caching
   ADR-003, messaging/async ADR-008, real-time ADR-009): options considered, decision,
   the obligations it forces, and the failure-mode mitigations (Rule 4).
4. **A `decision-log.md` row** (Question / Options considered / Decision / Why / Decided
   by / Affected).
5. **The Activation Map** (`active-skills.md`) arms the owning skills (`caching-strategy`,
   `error-handling`, and any async/real-time tasks) so they fire in the build loop.

## Rule 8: Changing a confirmed runtime pattern goes through change control

Once the topology is recorded and Gate 1 has passed, the runtime patterns are locked
alongside the stack. Adding a queue, a cache, or a socket mid-flight, or removing one,
requires `/change-request`: update S22 / S12 / the ADR first, add a `decision-log.md`
row, and re-derive the Activation Map. A revisit trigger firing (for example "first
report exceeds the request budget → introduce a worker") is the normal, expected
reason to reopen it, not a failure. Introducing runtime infrastructure in code that
the plan never recorded is contract drift, caught by `/audit` and `/build`'s
planning-sync refusal.

---

## Verification (what Gate 1, /build, and /audit check)

- Tech-spec S22 has explicit rows for Caching, Async work / queues / workers, Real-
  time transport, and Idempotency & retry, each `planned` (with the chosen pattern) or
  `N/A (reason)`. A blank async/real-time/cache row on a project whose requirement
  needs one → Gate 1 FAIL (non-POC).
- A runtime ADR exists for each non-trivial axis in use (caching / messaging / real-
  time). Missing ADR for a pattern that ships in code → Gate 1 FAIL (non-POC).
- A `decision-log.md` row records each runtime decision. Missing → CONCERNS.
- No Redis, queue, socket, or pipeline appears in `infra/infra-plan.md` hosting
  topology or in `stack.md` without a matching S22 row and ADR. Found → defect
  (premature / unrecorded infrastructure, Rule 2).
- `/build` runtime-pattern fidelity gate: a task implementing a queued/async/real-time/
  cached path that lacks its Rule 6 obligations (idempotency, retry/dead-letter,
  correlation-id logging, timeout; TTL + invalidation for caches; auth + reconnect for
  sockets) → Status=BLOCKED. This is a blocking gate, the sibling of the RBAC and
  audit-log gates.
- For POC (`planning_depth: poc`): the thin pick is recorded and marked `poc`. The ADR
  and obligation requirements are waived, not the recording.

<!-- Version: 1.0.0 (2026-06-25): initial runtime-architecture rule: requirement-first data-flow topology (caching, real-time, async work, API style, resilience), no default infrastructure, decide-as-one-topology, code-level obligations enforced by /build, store as S22 rows + ADR -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
