-- Feature 3, Phase 3 (voice): row-level security for the call transcript table.
--
-- `call_transcript_turns` was added by migration 20261102140000. Its commit said the tenant
-- policy would come from 003's loop, which applies one to every table carrying an
-- `organisation_id`. That is TRUE ON A FRESH DATABASE and false on any existing one: apply.ts
-- records 003 as applied and never runs it again, so on a database that already had 003 the
-- new table was left with NO POLICY, NOT ENABLED and NOT FORCED. `pnpm db:check-policies`
-- caught it on the first existing database the migration reached, a developer's local one.
--
-- The test suite could not have caught it: every run builds a fresh database, where the
-- migrations run first and the loop runs after, so the policy is always there in tests.
-- That is the gap `check-policies` exists for, and why the first-real-call runbook runs it
-- before anything else.
--
-- The loop is repeated verbatim, as 003 repeats 001's and 002's, so each file is a complete
-- statement of what it applies. It is idempotent: DROP POLICY IF EXISTS, then CREATE.

-- ─── 1. Row-level security and grants for every tenant table ────────────────────
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

    IF target.table_name = 'audit_logs' THEN
      EXECUTE 'REVOKE ALL ON audit_logs FROM app_user';
      EXECUTE 'GRANT SELECT, INSERT ON audit_logs TO app_user';
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', target.table_name);
    END IF;
  END LOOP;
END
$$;
