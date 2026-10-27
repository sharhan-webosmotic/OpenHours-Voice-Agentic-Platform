---
name: schema-validation
description: "Runs DB schema correctness against a throwaway test database: migrations up, down, up again, then diffs the schema against tech-spec S7 and database-schema.md and writes mavs/schema.json. Dispatched by /do at milestone validation or when a task changes the schema. Not user-facing."
skill_id: SK-154
version: 1.0.3
context_budget:
  load_kb: 25
  scope: task
dependencies:
  required: [data-migration]
  optional: [tech-specification, change-request, infra-planning, gate-enforcement]
license: Proprietary
compatibility: "Claude Code 1.x"
produces:
  - path: AI_DOCS/quality/mavs/schema.json
    consumers: [mavs-gate.sh, milestone-validation]
consumes:
  - path: AI_DOCS/architecture/database-schema.md
    required_sections: []
metadata:
  author: WebOsmotic Private Limited
  category: gate
  user_facing: false
---

# schema-validation — run the migrations, diff against the spec

> `data-migration-rules.md` is excellent on idempotency, up/down, and
> expand/contract, but it is all prose: nothing runs a migration, nothing checks
> the built schema matches the spec, and `database-schema.md` is not locked. This
> skill executes the migrations against a disposable DB and diffs the result
> against the spec, so a non-reversible migration or a schema that drifted from
> `database-schema.md` is caught by a run, not a code review.

## When it runs (dispatched by /do)

- At milestone validation (Gate 4.5) for any project with a database.
- When a task adds or edits a migration (alongside `/build`'s migration gate).

## Requirement: a throwaway test database

Needs a disposable DB matching the stack engine (a local Postgres/MySQL container, or SQLite for simple stacks). It is created fresh and dropped each run, NEVER a dev/staging/prod DB. If none is reachable, emit `MISSING_TOOL` (see below), do not skip silently. `infra-planning` documents provisioning a disposable test DB for the dev environment.

## Step 1 — up / down / up

Against the fresh throwaway DB, using the project's migration tool (`prisma migrate`, `alembic`, `knex`, `drizzle`, etc. from `stack.md`):

1. `migrate up` to head. Capture the resulting schema (introspection: `pg_dump --schema-only`, `prisma db pull`, or `information_schema` query).
2. `migrate down` one full step set (or to base for a first run). Confirm it succeeds and leaves no orphaned objects. A migration with no working `down` is a FAIL: "schema-validation: migration `<name>` has no reversible down; data-migration-rules Rule 2 requires a tested rollback."
3. `migrate up` again. Confirm idempotency: the schema after the second up equals the schema after the first up. A mismatch is a FAIL.

This is the executable form of `data-migration-rules.md` Rules 1-2 (idempotency + rollback), which were human-checklist-only before.

## Step 2 — diff against the spec (S7 / database-schema.md)

Compare the introspected schema to `AI_DOCS/architecture/database-schema.md` (S7):

- **Tables**: every spec table exists, no undeclared table (undeclared -> CONCERNS, missing -> FAIL).
- **Columns**: name + type + nullability match the spec per table.
- **FK indexes** (`development-rules.md` rule 65): every foreign key column has an index. A missing FK index is a FAIL (it is the most common production N+1 / lock cause).
- **Constraints**: declared unique/check/not-null constraints present.

A divergence between code and spec is a FAIL with the specific table/column. Fix the migration OR update `database-schema.md` through `/change-request` (it is locked).

## Step 3 — emit `mavs/schema.json`

Normalize to the MAVS schema (`docs/mavs-report-schema.md`) at `AI_DOCS/quality/mavs/schema.json`:

- `status`: `PASS` if up/down/up clean AND the diff is clean; `FAIL` on any rollback failure, idempotency mismatch, or spec divergence; `MISSING_TOOL` if no throwaway DB was reachable (with the install/run hint); `SKIP` if the project has no database.
- `source_commit` = `git rev-parse HEAD`; `generated_at` = real run time.
- `findings`: one row per problem (`location` = migration file or `table.column`).

`mavs-gate.sh` blocks the milestone merge on FAIL or a stale report.

## /build integration (migration gate)

When a task adds/edits a migration, `/build`'s migration gate (see build/SKILL.md) BLOCKS if the migration lacks a `down`/rollback, and requires expand/contract on a large-table (>100k rows) NOT NULL add per `data-migration-rules.md`. This skill is the milestone-close executor that actually runs up/down/up; the build gate is the fast per-task static check.

## Lock

`database-schema.md` is LOCKED after Gate 1 (`enforce-artifact-lock.sh`, marker `SCHEMA LOCKED`). Schema changes route through `/change-request` (updates S7 + a new migration), never a hand-edit of the locked file.

## Boundaries

- Runs migrations against a throwaway DB ONLY. Never points at dev/staging/prod.
- Authors no app code and no migrations (that is `/build` + `data-migration`).
- Reports MISSING_TOOL rather than PASS when it cannot run.

<!-- Version: 1.0.2 | 2026-10-21 | description trimmed per the v4.28.0 cost policy -->
<!-- Version: 1.0.3 | 2026-10-22 | repointed rule references after code-rules.md and compliance/secrets.md merges (v4.32.0) -->
