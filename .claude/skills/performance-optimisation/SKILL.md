---
name: performance-optimisation
description: Use when a change touches hot paths, queries, lists, the voice tool endpoints, reports and analytics, background jobs, frontend bundle size or rendering, or when asked to optimise or investigate slowness. Measure-first optimisation rules for the clinic platform.
---

# Performance and optimisation

## Rule zero
Measure before and after. State the target, the measurement method and the result in the PR. Do not add caches, indexes or memoisation on a hunch.

## Budgets (proposed; fix them in docs/STACK.md)
- Voice tool endpoints (check availability, book, lookup patient): p95 < 400 ms server-side at 20 concurrent calls.
- Dashboard API reads: p95 < 300 ms; writes < 500 ms; reports < 2 s on 12 months of data for a busy clinic.
- Web: initial JS < 250 KB gzip for the main route, LCP < 2.5 s on a mid-range laptop, interactions < 200 ms.

## Backend and database
- Index for access paths: `organisation_id` first, then the filter/sort columns. Verify with `EXPLAIN (ANALYZE, BUFFERS)` on seeded realistic volumes (e.g. 50k patients, 500k appointments across clinics).
- Kill N+1: batch lookups, use `select`, or write one SQL query. Review every loop containing an await.
- Availability: compute slots from working hours, time off and existing appointments in one query window; never scan all appointments.
- Analytics: aggregate in SQL; consider a daily summary table only after measuring a real problem.
- Pagination mandatory; cursor over offset for large tables.
- Connection pool sized to the instance count; use `statement_timeout` and `idle_in_transaction_session_timeout`.
- Keep transactions short; no network calls inside them.
- Cache only immutable or short-TTL reference data (clinic settings, permission matrix) and never across tenants without the org in the key. Invalidate on write.
- Jobs: bounded concurrency, backoff with jitter, batch where possible.

## Voice-path specifics
Resolve the organisation by an indexed lookup on agent id/number; do one read, one write; return a concise `message`; move everything non-essential (call analytics, notifications, S3 copy) to a job.

## Frontend
- Route-level code splitting; lazy-load calendar, charts and rich tables. Enforce a bundle budget in CI.
- TanStack Query: sensible `staleTime`, request dedupe, prefetch on hover for detail pages, `keepPreviousData` for pagination.
- Virtualise long lists; debounce search (300 ms); avoid re-render storms (stable props, split components) and only then memoise.
- Images and fonts: self-hosted, subsetted, `font-display: swap`.

## Android
Doze and battery restrictions are the "performance" problem: use exact alarms and WorkManager appropriately, keep work tiny, and document manufacturer-specific battery settings users must change.

## Output when optimising
Before/after numbers, the change, the risk, and how to roll it back.
