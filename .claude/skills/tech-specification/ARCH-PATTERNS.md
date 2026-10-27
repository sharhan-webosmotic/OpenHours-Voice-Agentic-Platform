# Runtime Architecture Pattern Catalogue

> The option catalogue for the runtime / data-flow topology, the sibling of
> `skills/workscope/TECH-OPTIONS.md`. `TECH-OPTIONS.md` picks language, framework,
> database, host. THIS file picks how data moves and how work executes.
> Governing discipline: `rules/runtime-architecture-rules.md`. Consumed by `/do`
> Step 1.8, `/tech-specification` (S12, S22), `/architecture` (ADR-003/008/009),
> `/infra-planning`, and `/build` (runtime-pattern fidelity gate).
>
> Every table below has the same shape: **when to use**, **when NOT** (premature or
> wrong-fit), **the trade-off**, and **what it forces in code** (the obligations
> `/build` checks). The "what it forces in code" column is the point: it is what
> makes the generated code optimized and debuggable instead of merely functional.
>
> Rule for every recommendation: the cheapest pattern that meets the requirement
> wins. "None / inline / N/A (reason)" is always a first-class answer.

---

## Axis 1 — Caching (what is cached, where, TTL, invalidation)

Owning skill: `caching-strategy`. ADR-003. Recorded in S22 (Caching) + S12 (caching strategy).

| Pattern | When to use | When NOT (premature / wrong) | Trade-off | Forces in code |
|---|---|---|---|---|
| **No cache** (default) | Reads are cheap, data changes per request, or traffic is low | — | none | nothing |
| **In-process memory** (LRU) | Tiny, hot, read-only lookups on a single instance (config, feature flags) | Multi-instance deploy: each replica drifts | Lost on restart; not shared | TTL + max size; tolerate cold start |
| **Redis / Valkey (cache-aside)** | Same expensive read served repeatedly across instances; shared sessions; rate-limit counters | No repeated hot read exists yet (Rule 2: do not add Redis by habit) | New service to run, monitor, secure | TTL, invalidation trigger, cache-miss path, cache-DOWN fallback (read-through to source) |
| **CDN / edge** | Public, cacheable HTTP (static assets, SSG/ISR pages, public API GETs) | Per-user or auth-gated responses | Stale window at the edge; purge complexity | `Cache-Control` + purge-on-publish; never cache private data |
| **DB query cache / materialized view** | Expensive aggregations read far more than written | Write-heavy table; data must be live | Refresh lag | Refresh trigger or schedule; staleness documented |

Decision signals: repeated identical reads → cache; per-request-unique data → do not.
Hot read across replicas → Redis. Public + cacheable → CDN. Heavy aggregation → view.
**Every cache must state its stale-tolerance**: what may the user see out of date, and
for how long. Money, balances, and permissions default to no-cache or very short TTL +
explicit invalidation.

## Axis 2 — Real-time transport (push freshness to the client)

Owning skill: `error-handling` (connection/observability) + the platform backend skill. ADR-009. Recorded in S22 (Real-time transport).

| Pattern | When to use | When NOT | Trade-off | Forces in code |
|---|---|---|---|---|
| **None / on-demand fetch** (default) | View only needs fresh data when the user acts | — | none | nothing |
| **Short polling** | "Refresh every N seconds/minutes" is acceptable; simple status checks | Requirement says "live", sub-second, or chat/collab (under-architecting, a defect) | Wasted requests; latency = interval | Backoff when idle; ETag/304 to cut payload |
| **SSE (server-sent events)** | Server → client one-way streams: notifications, live feeds, progress, dashboards | Client must also push at high frequency | One-directional; reconnect handling needed | Auth on connect; auto-reconnect with last-event-id; heartbeat |
| **WebSocket** | Bidirectional, low-latency: chat, collaborative editing, multiplayer, live trading | One-way updates (SSE is simpler and survives proxies better) | Stateful connections; scaling needs a pub/sub backplane (Redis) + sticky/shared state | Auth on connect, heartbeat/ping, reconnect + back-pressure, presence cleanup on drop |
| **Webhook (server → server)** | A third party notifies your backend of events (payments, deliveries) | Browser-facing updates | Delivery is at-least-once and unordered | Signature verification, idempotent receiver, retry-tolerant (dedupe by event id) |

Decision signals: latency tolerance from Rule 3. Minutes → polling. Seconds, one-way →
SSE. Sub-second, two-way → WebSocket. Third-party events → webhook. A requirement that
says "live / real-time" must NOT be implemented on polling (S1.7 intake rule, audited).

## Axis 3 — Async / background work (work that should leave the request)

Owning skill: `error-handling` + platform backend skill (BullMQ / Celery / ARQ / SQS). ADR-008. Recorded in S22 (Async work) + S12 (worker capacity).

| Pattern | When to use | When NOT | Trade-off | Forces in code |
|---|---|---|---|---|
| **Inline (in-request)** (default) | Work finishes well within the request budget (< ~1s, no hangable third-party call) | Work is slow, heavy, or calls a flaky external service (under-architecting) | Holds the request; user waits | bounded timeout on any external call |
| **Fire-and-forget task** (in-process) | Truly non-critical side effect that may be lost (best-effort cache warm) | Anything that must not be lost | No durability; lost on crash | must be safe to drop; logged |
| **Scheduled job (cron)** | Periodic work on a clock: digests, cleanup, reconciliation, syncs | Event-driven work that must react immediately | Runs even with nothing to do; clock coupling | idempotent (safe to run twice), overlap guard, alert on failure |
| **Queue + worker** | Work exceeds the request budget, must survive a restart, or smooths bursts: emails, exports, image/video processing, webhooks fan-out | Sub-second synchronous work (queue adds latency + a service for nothing) | A broker + worker to run and monitor; eventual completion | **idempotent handler (dedupe by job id), retry w/ backoff, dead-letter after N fails, correlation id at submit + each attempt, bounded per-job timeout** |
| **Data pipeline / batch (ETL)** | Multi-stage transform over a large dataset: reporting rollups, imports, embeddings | A single query/transform suffices (Rule 2) | Orchestration + checkpoint complexity | batch in bounded chunks, checkpoint/resume, per-stage idempotency, progress + failure metrics |
| **Stream processing** | Continuous high-volume event flow needing windowed/stateful processing | Low event volume; a queue is enough | Heavy infra (Kafka/Kinesis); operational depth | partition keys, offset/commit discipline, replay tolerance |

Decision signals: work duration vs request budget (Rule 3). Fast + must-not-lose-but-
sync → inline in a transaction. Slow OR must-survive-restart → queue. Periodic → cron.
Large multi-stage → pipeline. The jump from "queue" to "pipeline/stream" must be earned
by real volume, not anticipated.

## Axis 4 — API interaction style (how the client gets the result)

ADR-008 (pairs with async). Recorded in S22 + the api-contract.

| Pattern | When to use | When NOT | Trade-off | Forces in code |
|---|---|---|---|---|
| **Synchronous request/response** (default) | Result is ready within the request budget | Long work (the request times out behind proxies) | Simple; bounded by latency | timeout + typed error envelope |
| **Async job + status** | Submit kicks off queued work; client polls or subscribes for the result | Fast work (needless round-trips) | Two-phase client logic | submit returns `202 + job id`, idempotency key on submit, status endpoint, result/expiry channel |
| **Event-driven / message-based** | Services react to events; loose coupling; high fan-out | A simple call between two services suffices | Eventual consistency; harder to trace | event schema/versioning, idempotent consumers, dead-letter, trace/correlation id propagated |

## Axis 5 — Resilience primitives (forced by axes 2-4)

Not a standalone choice: each is REQUIRED when an axis above introduces its failure
mode. `/build` checks these on the matching path.

| Primitive | Required when | What it means in code |
|---|---|---|
| **Idempotency** | Any retryable or at-least-once path (queue, webhook, async submit, payment) | A key (job id / event id / client token) that makes a repeat a no-op; dedupe before side effects |
| **Retry with backoff** | Any call that can fail transiently (external API, queue handler) | Bounded attempts, exponential backoff + jitter, give up to dead-letter |
| **Dead-letter / failure sink** | Any durable queue or stream | Failed messages land somewhere inspectable + alertable, never silently dropped |
| **Outbox** | A DB write that must reliably emit an event/message | Write the event in the same transaction as the data; a relay publishes it; no lost or phantom events |
| **Rate limiting** | Auth, billing, password-reset, email/SMS, public signup, expensive endpoints | Per-user/IP limit (token bucket / sliding window), usually Redis-backed; 429 with retry-after |
| **Correlation / request id** | Every async, real-time, and multi-service path | A propagated id on every log line at each boundary, so a single flow is greppable end to end. This is the "easy to debug" obligation. |

---

## Recommendation format (apply in /do Step 1.8 and tech-spec S22)

For each axis in scope, after the relevant table:

```markdown
### Async work
[table row(s) that apply]

**AI Recommendation**: **Queue + worker (BullMQ)**
> The report export reads 50k rows and renders a PDF: 8-20s, past the request budget,
> and it must survive a worker restart. Inline would time out behind the proxy.
> Obligations: idempotent job (dedupe by job id), retry w/ backoff (3 attempts),
> dead-letter on final failure, correlation id logged at submit and each attempt,
> 60s per-job timeout. Recorded in S22 (Async work) + ADR-008.

**Your choice (or confirm):** ___
```

Two non-negotiables for every runtime recommendation:
1. **No default infrastructure** (`runtime-architecture-rules.md` Rule 2): "none /
   inline / N/A" is the default until a requirement signal earns the pattern.
2. **Obligations are named with the choice** (Rule 6): a queue/socket/cache is not
   chosen until its code-level obligations are written into S22 + the ADR, because
   `/build`'s runtime-pattern fidelity gate will block the implementation without them.

### After confirmation: persist (do not stop at the recommendation)

- Write the chosen pattern per axis into tech-spec **S22** rows (Caching, Async work,
  Real-time transport, Idempotency & retry) and the caching/worker capacity into **S12**.
- Record a runtime **ADR** (`AI_DOCS/architecture/adrs/`) for each non-trivial axis:
  ADR-003 caching, ADR-008 messaging/async, ADR-009 real-time. Options considered,
  decision, obligations forced, failure-mode mitigations.
- Append a `decision-log.md` row per axis decision.
- Arm the owning skills in `active-skills.md` (`caching-strategy`, `error-handling`,
  async/real-time tasks tagged `needs:<skill>`).

Governing rule: `rules/runtime-architecture-rules.md`.
