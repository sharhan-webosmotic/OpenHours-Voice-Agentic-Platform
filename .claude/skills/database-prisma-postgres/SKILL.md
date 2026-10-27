---
name: database-prisma-postgres
description: Use when designing or changing the Prisma schema, writing migrations or raw SQL, adding indexes or constraints, writing queries, seeding data, or touching row-level security. PostgreSQL and Prisma conventions for the clinic platform.
---

# Database, Prisma and PostgreSQL

## Schema conventions
- UUID primary keys (v7 generated in the app), snake_case via `@map`/`@@map`, `timestamptz` for all times, `created_at`/`updated_at` everywhere.
- `organisation_id` NOT NULL on every tenant table and FIRST in composite indexes. A table without it needs a written reason.
- Phones E.164 text, money integer minor units, enums for closed sets, JSON only for provider payloads and settings, never for queryable business data.
- Patients soft-delete (`deleted_at`); appointments and calls use status, never hard delete.
- Foreign keys always; choose `onDelete` deliberately (Restrict by default).

## Migration safety
1. Additive first: add nullable column -> backfill -> enforce; never drop or rename in the same release as the code change.
2. Never edit an applied migration; add a new one. Name migrations by intent.
3. Constraints Prisma cannot express (exclusion constraint, CHECK, RLS, extensions, roles) live in `prisma/sql/` raw SQL, tracked and idempotent, with tests.
4. Test every migration on an empty database AND on a database seeded with the previous version.
5. Large-table changes: `CREATE INDEX CONCURRENTLY`, batched backfills, no long locks.
6. Second-person review for every migration. Never run migrations against shared or production DBs from an AI session; CI/CD does that.

## Constraints that carry business rules
- No double booking: exclusion constraint on (doctor_id, tstzrange(start_at, end_at, '[)')) for active statuses.
- Idempotency: unique (organisation_id, idempotency_key); unique (provider, external_call_id); unique (provider, external_event_id); unique dedupe_key on outbound calls.
- One agent number maps to exactly one organisation (global unique).

## Query rules
- Select only needed fields; use `select`, not whole models, for lists.
- No N+1: batch with `in`, `include` with care, or a single SQL query for reports.
- Every query path has an index starting with `organisation_id`; check with `EXPLAIN (ANALYZE, BUFFERS)` on realistic data for new heavy queries.
- Search by name uses trigram index; do not use `ILIKE '%x%'` without it.
- Aggregations for analytics use SQL (group by, date_trunc in the clinic timezone), not loading rows into Node.
- Use transactions for multi-row invariants; keep them short; no external calls inside.

## Prisma 7 notes (verify on first use and record the result in docs/STACK.md)
Pin `prisma` and `@prisma/client` to the same stable version. Prisma 7 uses a `prisma.config.ts` and driver adapters; confirm how the interactive transaction + `set_config` pattern for RLS works with the adapter before building on it.

## Seeds
Idempotent, synthetic, one platform super admin and one demo clinic. Never seed real patient data.
