---
name: system-design
description: Use when a change crosses module or service boundaries, introduces a new data flow, background job, provider integration or caching layer, or when choosing between designs. Covers architecture decisions, ADRs, boundaries and failure modes for the clinic platform.
---

# System design

## Before you design anything
1. Read `docs/STACK.md` and the ERDs in `docs/architecture/`. The stack is fixed for Phase 1: nothing here chooses a new database, queue, provider or auth method (root `CLAUDE.md`, "Not in scope").
2. Say which existing module owns this. A new top-level module needs a reason that is not "it felt cleaner".
3. Write the data flow as one line per hop, naming the trust boundary at each: client to API, API to database, API to Sarvam, Sarvam webhook to API, job to database.

## The invariants a design may not break
- Every tenant table carries `organisation_id`, and the organisation comes only from the verified token or a resolved mapping. A design that needs the client to say which tenant it is, is wrong.
- Prisma is reached only through repositories, via the tenant-scoped client. A new component that needs its own database access needs a repository, not a client.
- Permissions are decided in the service layer from `packages/shared/permissions.ts`. A new surface (job, webhook, tool endpoint) still answers "who may do this, and what scope do they get?".
- Sensitive reads and writes call `audit.record`, inside the same transaction as the work.
- The AI voice agent books, reschedules, cancels and answers clinic information. It never diagnoses, prescribes or decides clinically.

## Decide and record
Write an ADR in `docs/architecture/` when a choice is expensive to reverse: a boundary, a data model, a provider contract, a consistency or ordering guarantee, a retention rule. Format: context, the options considered, the decision, the consequences you accept. One page. An ADR that lists no rejected option is a summary, not a decision.

Update the ERD in the same change as the schema, never after.

## Failure modes, stated before the happy path
For each hop: what happens when it is slow, when it returns an error, when it returns twice, and when it never returns. Then name the behaviour you chose: retry with backoff, dead letter, fail closed, degrade, or surface to the caller.
- Writes reachable by the voice agent accept `Idempotency-Key` and return the original result on replay.
- Webhooks are stored first and processed idempotently, so a duplicate delivery has one effect and an out-of-order one is detectable.
- Side effects (SMS, email, provider calls) go through a job, never inside the request transaction, so a failed send cannot roll back a booking.
- A dependency being down is a 503 from readiness, not a 500 from a handler.

## Budgets that constrain the design
Voice tool endpoints: p95 under 400 ms at 20 concurrent calls. Dashboard reads: p95 under 300 ms. A design that needs more than a handful of queries per voice tool call does not fit, and the fix is the design rather than an index. Check the policy and query shape with `EXPLAIN` on seeded volume before committing to it.

## Anti-patterns to refuse
A service that talks to another service's tables; a new shared "utils" or "common" module as a home for unrelated code; synchronous provider calls inside a request transaction; cross-tenant queries added to make a platform feature work (use the platform scope and audit it); caching that holds patient data; a queue or provider introduced without an ADR and written approval; "we will add tenancy later".
