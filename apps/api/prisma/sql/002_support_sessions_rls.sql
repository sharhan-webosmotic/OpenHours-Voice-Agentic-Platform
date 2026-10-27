-- M1-09: row-level security for support_sessions.
--
-- A separate file rather than an edit to 001, because 001 is already recorded as
-- applied and apply.ts does not re-run a recorded file. That is deliberate: re-running
-- every file on every deploy would make a mistake in an old file dangerous.
--
-- The policy loop is repeated rather than factored out, so that each file is a complete,
-- self-contained statement of what it applies. check-policies.ts is what guarantees no
-- tenant table is ever left without one.

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
