-- M1-06: constraints, row-level security and database roles.
--
-- Hand-written because Prisma cannot express an exclusion constraint, a partial unique
-- index, a CHECK across two columns, a trigram index, RLS policies or roles.
--
-- Every statement is idempotent, so re-running this file is a no-op. It is applied by
-- prisma/sql/apply.ts after `prisma migrate`, and that script records which files have
-- run so a later file can be added without re-executing earlier ones.
--
-- The RLS section is GENERATED FROM ONE LIST: a single query over the catalog finds
-- every table carrying organisation_id. A new tenant table therefore gets a policy the
-- next time this runs, with nothing to remember. check-policies.ts fails CI if that ever
-- stops being true.

-- ─── 1. Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- ─── 2. No two appointments for one doctor may overlap ──────────────────────────
-- A database constraint rather than a check-then-insert, because two concurrent bookings
-- would both pass a read before either wrote. btree_gist supplies the `=` operator for
-- uuid so doctor_id can sit in a GiST index beside the range.
-- '[)' makes the end instant exclusive, so 09:00-09:30 and 09:30-10:00 do not collide.
-- Only live statuses are constrained: a cancelled slot must be re-bookable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (
        doctor_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status IN ('SCHEDULED', 'CONFIRMED'));
  END IF;
END
$$;

-- ─── 3. A user belongs to an organisation unless it is a platform role ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_organisation_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_organisation_check
      CHECK (
        (role IN ('SUPER_ADMIN', 'INTERNAL_ADMIN') AND organisation_id IS NULL)
        OR (role NOT IN ('SUPER_ADMIN', 'INTERNAL_ADMIN') AND organisation_id IS NOT NULL)
      );
  END IF;
END
$$;

-- ─── 4. Patient name search ─────────────────────────────────────────────────────
-- Trigram GIN index: the voice agent matches a spoken, often misspelt name.
CREATE INDEX IF NOT EXISTS patients_full_name_trgm
  ON patients USING gin (full_name gin_trgm_ops);

-- An agent number identifies an organisation for an inbound call, so it must be unique
-- across the whole platform, not just within one clinic. Clinic lines are not restricted.
CREATE UNIQUE INDEX IF NOT EXISTS phone_numbers_agent_e164_unique
  ON phone_numbers (e164)
  WHERE kind = 'AGENT_NUMBER';

-- ─── 5. Row-level security on every tenant table ────────────────────────────────
-- The second of the two isolation locks (the first is the tenant-scoped Prisma client).
-- This one holds even if application code forgets a filter, or is wrong.
--
-- NULLIF(..., '') matters: current_setting(..., true) returns an EMPTY STRING when the
-- setting is absent, and ''::uuid raises. NULLIF turns it into NULL, the comparison
-- becomes NULL, and the row is filtered out. That is why "no setting" yields zero rows
-- instead of an error.
--
-- A NULL organisation_id (platform users, platform audit entries, unresolved webhooks)
-- never satisfies the equality either, so those rows are visible only under app.platform.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'organisation_id' AND a.attnum > 0
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target.table_name);
    -- FORCE so the table owner is subject to the policy too. Without it, anything
    -- connecting as the owner silently sees every tenant.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target.table_name);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', target.table_name);
    EXECUTE format($pol$
      CREATE POLICY tenant_isolation ON %I
        USING (
          organisation_id = NULLIF(current_setting('app.org_id', true), '')::uuid
          OR current_setting('app.platform', true) = 'on'
        )
        WITH CHECK (
          organisation_id = NULLIF(current_setting('app.org_id', true), '')::uuid
          OR current_setting('app.platform', true) = 'on'
        )
    $pol$, target.table_name);
  END LOOP;
END
$$;

-- organisations has no organisation_id: its PRIMARY KEY is the tenant id. The loop above
-- cannot cover it, and without a policy a clinic could read every other clinic's row
-- through the application lock alone. Added explicitly, keyed on id.
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON organisations;
CREATE POLICY tenant_isolation ON organisations
  USING (
    id = NULLIF(current_setting('app.org_id', true), '')::uuid
    OR current_setting('app.platform', true) = 'on'
  )
  WITH CHECK (
    id = NULLIF(current_setting('app.org_id', true), '')::uuid
    OR current_setting('app.platform', true) = 'on'
  );

-- ─── 6. Database roles ──────────────────────────────────────────────────────────
-- Two roles, because the API must not be able to change the shape of the database or
-- turn a policy off.
--   app_owner : owns the schema, runs migrations.
--   app_user  : what the API connects as. NOT the owner and explicitly NOBYPASSRLS, so
--               no connection string can escape tenant isolation.
--
-- Created NOLOGIN and without a password on purpose: a credential never belongs in a
-- migration. apply.ts grants LOGIN and sets a password from the environment for local
-- and test databases; in staging and production that is done once by an operator with
-- a secret from Secrets Manager.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
    CREATE ROLE app_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

ALTER ROLE app_user NOBYPASSRLS;
ALTER ROLE app_owner NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO app_user;

-- Full data access on tenant tables; RLS, not GRANTs, decides which ROWS are reachable.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'
    ORDER BY c.relname
  LOOP
    IF target.table_name = 'audit_logs' THEN
      -- An audit trail that the application can rewrite is not evidence. app_user may
      -- append and read; it may not UPDATE or DELETE. Enforced by the absence of the
      -- grant, so it fails at the database even if a repository tries.
      EXECUTE 'REVOKE ALL ON audit_logs FROM app_user';
      EXECUTE 'GRANT SELECT, INSERT ON audit_logs TO app_user';
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', target.table_name);
    END IF;
  END LOOP;
END
$$;

-- Prisma reads its own migration table when the CLI runs as the owner; app_user has no
-- business touching it.
REVOKE ALL ON _prisma_migrations FROM app_user;
