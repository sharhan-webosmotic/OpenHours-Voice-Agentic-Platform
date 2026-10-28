import { Client } from 'pg';

/**
 * Fails when a table that carries organisation_id is missing its isolation controls.
 *
 * This is the guard that makes the database lock trustworthy over time: a new tenant
 * table added without re-running the SQL migration would otherwise be readable across
 * organisations, and nothing in a normal test run would notice.
 *
 * Checks three things per table, because any one of them alone is insufficient:
 *   - a tenant_isolation policy exists
 *   - RLS is ENABLED (without it the policy is inert)
 *   - RLS is FORCED (without it the table owner bypasses the policy)
 */

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

type Row = {
  table_name: string;
  rls_enabled: boolean;
  rls_forced: boolean;
  has_policy: boolean;
};

const check = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL must be set to check policies');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const { rows } = await client.query<Row>(`
      WITH tenant_tables AS (
        SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND (
            EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = c.oid AND a.attname = 'organisation_id' AND a.attnum > 0
            )
            -- organisations has no organisation_id: its primary key IS the tenant id,
            -- and it needs a policy just as much.
            OR c.relname = 'organisations'
          )
      )
      SELECT t.relname AS table_name,
             t.relrowsecurity AS rls_enabled,
             t.relforcerowsecurity AS rls_forced,
             EXISTS (
               SELECT 1 FROM pg_policy p
               WHERE p.polrelid = t.oid AND p.polname = 'tenant_isolation'
             ) AS has_policy
      FROM tenant_tables t
      ORDER BY t.relname
    `);

    if (rows.length === 0) {
      throw new Error('no tenant tables found: has the schema been migrated?');
    }

    const problems = rows.filter((r) => !r.has_policy || !r.rls_enabled || !r.rls_forced);

    for (const row of rows) {
      const state = [
        row.has_policy ? 'policy' : 'NO POLICY',
        row.rls_enabled ? 'enabled' : 'NOT ENABLED',
        row.rls_forced ? 'forced' : 'NOT FORCED',
      ].join(', ');
      out(`  ${row.table_name.padEnd(24)} ${state}`);
    }

    if (problems.length > 0) {
      out('');
      for (const problem of problems) {
        out(`FAIL ${problem.table_name}: tenant isolation is incomplete`);
      }
      throw new Error(
        `${problems.length} of ${rows.length} tenant tables lack complete row-level security`,
      );
    }

    out('');
    out(`OK: ${rows.length} tenant tables each have tenant_isolation, ENABLED and FORCED`);
  } finally {
    await client.end();
  }
};

await check();
