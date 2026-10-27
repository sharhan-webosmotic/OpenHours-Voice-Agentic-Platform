---
description: "Data migration safety rules. Enforces zero-downtime, idempotency, rollback capability, and staging validation for all database migrations."
paths: ["migrations/**", "prisma/migrations/**", "alembic/versions/**", "drizzle/**"]
---

# Data Migration Rules

Database migrations are the highest-risk operation in production deployment. A bad migration can corrupt data, cause downtime, or require a rollback under user load. These rules make migrations safe.

## Rule 1: Idempotency Required

Every migration MUST be safe to run multiple times. Running the same migration twice must not corrupt data or throw errors.

```sql
-- WRONG: fails on second run
ALTER TABLE users ADD COLUMN age INTEGER;

-- RIGHT: safe on re-run
ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
```

For Prisma: migrations are auto-numbered and tracked — but `db push` in production is PROHIBITED. Always use `migrate deploy`.

For Alembic: `upgrade` scripts must be idempotent. Use `op.execute('ALTER TABLE ... IF NOT EXISTS ...')` patterns.

## Rule 2: Rollback Required

Every migration MUST have a working `down` / `downgrade` script.

**Test the rollback before production:**
```bash
# Run migration up
prisma migrate deploy
# Verify app works
# Run rollback
prisma migrate resolve --rolled-back [migration-name]
# Verify app still works
```

Migrations with no rollback path are BLOCKED from production.

## Rule 3: Zero-Downtime Pattern (Expand/Contract)

For large-table migrations that would lock the table, use the **expand/contract pattern**:

**Phase 1 — Expand** (backward compatible, deploy immediately):
- Add new column/table (nullable or with default)
- Start writing to both old and new
- No reads from new column yet

**Phase 2 — Migrate** (background job, no deployment needed):
- Backfill existing rows in batches (never lock the whole table)
- Batch size: 1000 rows max per transaction
- Sleep 10ms between batches to reduce DB load

**Phase 3 — Contract** (next deployment):
- Start reading from new column/table
- Remove old column/table
- Drop any compatibility shims

**When expand/contract is required:**
- Adding NOT NULL column to table with >100k rows
- Renaming a column
- Changing a column type
- Dropping a column used by running application code

## Rule 4: Staging First

**No migration runs in production without first running in staging.**

Staging validation checklist before production:
- [ ] Migration ran successfully in staging
- [ ] Rollback ran successfully in staging
- [ ] Application deployed with new migration passes smoke test in staging
- [ ] Migration execution time measured (if >10 seconds on staging data, expand/contract required)
- [ ] No table locks lasting >100ms (check with `pg_stat_activity` or equivalent)

## Rule 5: Engineering Lead Gate Required

Every production data migration requires:
- Gate ID: `EL-FEASIBILITY` from `engineering-lead` agent
- The gate review checks: Is there a rollback? Was staging run? Is the table lock window acceptable?

## Rule 6: Batch Processing for Backfills

Never backfill in a single transaction:

```python
# WRONG: locks the table
db.execute("UPDATE users SET full_name = first_name || ' ' || last_name")

# RIGHT: batch processing
batch_size = 1000
offset = 0
while True:
    rows_updated = db.execute("""
        UPDATE users SET full_name = first_name || ' ' || last_name
        WHERE full_name IS NULL
        LIMIT :batch_size
    """, {"batch_size": batch_size}).rowcount
    if rows_updated == 0:
        break
    db.commit()
    time.sleep(0.01)  # 10ms pause between batches
```

## Rule 7: Docker & Migration Containers

When running migrations in Docker:
- Use the **same image tag** that is being deployed — never migrate with a different version than the app
- Check if the migration container image is already pulled locally before pulling
- Run migrations as a separate container/job — not as app startup code
- Never use `docker pull latest` blindly — pin to the specific release tag

```dockerfile
# WRONG: uncontrolled version
FROM postgres:latest

# RIGHT: pinned version
FROM postgres:16.2-alpine
```

## Rule 8: Migration Naming

All migration files must follow this naming convention:
```
YYYYMMDD_HHMMSS_[description_in_snake_case].[ext]
```

Examples:
- `20260414_143000_add_user_age_column.sql`
- `20260414_143000_add_user_age_column` (Prisma auto-names correctly)
- `alembic/versions/20260414143000_add_user_age_column.py`

## Checklist Before Any Production Migration

```
[ ] Migration is idempotent (safe to run twice)
[ ] Rollback script written and tested on staging
[ ] Expand/contract used if table has >100k rows or column is NOT NULL
[ ] Ran on staging without errors
[ ] Application deployed with migration passes staging smoke test
[ ] Migration execution time < 30 seconds on staging (or expand/contract applied)
[ ] EL-FEASIBILITY gate approved
[ ] Monitoring dashboard open during migration window
[ ] Rollback execution time verified (must be < 5 minutes)
```
