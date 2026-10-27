---
name: data-migration
description: "Handle database schema migrations, rollback scripts, data transformation migrations, and DB seeding scripts (up/down SQL, migration files). Use when writing a migration, changing a DB schema, rolling back a DB change, or authoring a seeding script. Do NOT use for generating mock/fake test data or JSON fixtures: use mock-data for that. Also triggers on: 'Database migration', 'Schema change', 'Data migration', 'Seed database'."
mcp_integrations: [prisma, postgres, mongodb, supabase]
next_skill: null
required_gate: null
skill_id: SK-022
context_budget:
  load_kb: 30
  scope: task
version: 1.4.3
dependencies:
  required: [tech-specification]
  optional: [build, deployment-planning, deployment-execution]
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

> **Comments & docs:** Docstrings/JSDoc on every function. No inline comments except a one-line *why* for genuinely complex logic (calculations, time conversions, deliberate workarounds). No commented-out code. Put rationale, decisions, and feature context in `AI_DOCS/planning/` + `AI_DOCS/memory/decision-log.md` and keep it updated in the same change. Full policy: `.claude/rules/development-rules.md` -> Code Comments & Documentation.
# 🔄 Data Migration Skill

> **Purpose**: Safe database migrations with rollback capability
> **Output**: Migration files, rollback scripts, seed data

## MCP Acceleration

Per `.claude/rules/mcp-rules.md`, use these MCP servers to work faster (free servers are auto-provisioned in the project `.mcp.json`, and gated servers need approval + `${ENV_VAR}` credentials). Wire the stack-conditional ones only when that technology is in `stack.md`:

- `prisma` (free): migration patterns, schema help, and Studio.
- `postgres` / `mongodb` / `supabase` (gated, stack-conditional): query the live dev schema, test rollbacks, and verify backfills.

Target the project's dev database only. Never point a database MCP at staging or production.

---

## 🚨 Initialization & Memory Logic
> [!NOTE]
> **Gated Approach**: Memory initialization handled by [session-management](../session-management/SKILL.md). Gate status checked before skill handoff.

---

## 1. Migration Principles

> [!CRITICAL]
> **Zero-downtime migrations are MANDATORY for production.**

### Golden Rules
1. **Never delete columns** in the same release as code change
2. **Always add nullable columns** first, then backfill
3. **Test migrations on production copy** before deploying
4. **Write rollback for every migration**

---

## 2. Prisma Migrations

### Create Migration
```bash
# Generate migration from schema changes
npx prisma migrate dev --name add_user_profile

# Apply to production
npx prisma migrate deploy
```

### Migration File Structure
```
prisma/
├── migrations/
│   ├── 20240101000000_init/
│   │   └── migration.sql
│   ├── 20240115000000_add_user_profile/
│   │   └── migration.sql
│   └── migration_lock.toml
└── schema.prisma
```

### Safe Column Addition
```sql
-- migrations/20240115000000_add_user_profile/migration.sql

-- Step 1: Add nullable column
ALTER TABLE "User" ADD COLUMN "profilePicture" TEXT;

-- Step 2: Add default (if needed)
ALTER TABLE "User" ALTER COLUMN "profilePicture" SET DEFAULT '';
```

---

## 3. Rollback Strategy

### Prisma Rollback
```bash
# Rollback last migration (dev only)
npx prisma migrate reset

# For production: create reverse migration
npx prisma migrate dev --name rollback_user_profile
```

### Manual Rollback Script
```sql
-- migrations/rollback/20240115000000_remove_user_profile.sql

-- Rollback: remove profilePicture column
ALTER TABLE "User" DROP COLUMN IF EXISTS "profilePicture";
```

---

## 4. Data Transformation

### Backfill Script
```typescript
// scripts/backfill-user-profiles.ts
import { prisma } from '../lib/prisma';

async function backfillUserProfiles() {
  const batchSize = 100;
  let processed = 0;
  
  while (true) {
    const users = await prisma.user.findMany({
      where: { profilePicture: null },
      take: batchSize,
    });
    
    if (users.length === 0) break;
    
    await prisma.$transaction(
      users.map(user => 
        prisma.user.update({
          where: { id: user.id },
          data: { profilePicture: generateDefaultAvatar(user) },
        })
      )
    );
    
    processed += users.length;
    console.log(`Processed ${processed} users`);
  }
  
  console.log('Backfill complete');
}

backfillUserProfiles();
```

---

## 5. Database Seeding

### Seed File
```typescript
// prisma/seed.ts
import { prisma } from '../lib/prisma';

async function seed() {
  // Create admin user
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  // Create sample data
  await prisma.category.createMany({
    data: [
      { name: 'Electronics', slug: 'electronics' },
      { name: 'Clothing', slug: 'clothing' },
      { name: 'Books', slug: 'books' },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete');
}

seed();
```

### Package.json Script
```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

### Surface test users into the E2E fixtures (MANDATORY for auth-gated apps)

When the seed creates login users, write/refresh `AI_DOCS/quality/test-fixtures.md` so `e2e-testing` logs in as the seeded users (one per role) instead of hardcoding credentials. Record the mock email service (Mailhog) and the test reset endpoint if the app has them. See `e2e-testing/SKILL.md` for the contract. Seeded passwords are test-only placeholders, never real secrets, and the seed must be idempotent (upsert) so re-running keeps the fixtures valid.

---

## 6. Migration Checklist

| Step | Action | Status |
|------|--------|--------|
| 1 | Schema change in schema.prisma | ☐ |
| 2 | Generate migration | ☐ |
| 3 | Write rollback script | ☐ |
| 4 | Test on dev database | ☐ |
| 5 | Test on production copy | ☐ |
| 6 | Deploy migration | ☐ |
| 7 | Run backfill (if needed) | ☐ |
| 8 | Verify data integrity | ☐ |

> **Executed automatically now (not a manual checkbox):** steps 3-5 are exercised by the `schema-validation` skill at milestone close. It runs the migration `up -> down -> up` against a throwaway test DB (proving the rollback works and the migration is idempotent) and diffs the result against `architecture/database-schema.md`, writing `AI_DOCS/quality/mavs/schema.json`. `/build`'s migration gate is the fast per-task static check (a missing `down` or a large-table NOT NULL add without expand/contract is BLOCKED). So "test the rollback" is enforced, not trusted.

---

## 7. Zero-Downtime Pattern

### Multi-Phase Deployment
```
Phase 1 (Deploy):
- Add new nullable column
- Deploy code that reads from both old and new

Phase 2 (Backfill):
- Run backfill script
- Verify all data migrated

Phase 3 (Cleanup):
- Deploy code that only uses new column
- Remove old column (separate release)
```

---

## Rules Integration

> Claude Code auto-loads these rules when editing matching files:
> - `.claude/rules/development-rules.md` — spec-first, naming, error handling
> - `.claude/rules/security-rules.md` — data protection, encryption at rest

## Suggested Next Actions
1. Plan migration phases
2. Create rollback script
3. Test on staging database

## Next Step
Proceed to the next skill in the workflow as indicated in the YAML frontmatter.
