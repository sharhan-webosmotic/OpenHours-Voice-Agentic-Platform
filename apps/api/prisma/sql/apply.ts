import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

/**
 * Applies the hand-written SQL in this directory after `prisma migrate`.
 *
 * Each file is recorded in _openhours_sql_migrations once it succeeds, so adding a new
 * file does not re-run the earlier ones. The files are also individually idempotent,
 * which means a half-applied state recovers by simply running again.
 *
 * Runs as the migration role (the owner), never as app_user: app_user must not be able
 * to alter a policy.
 */

const here = dirname(fileURLToPath(import.meta.url));

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const applyAll = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL must be set to apply the SQL migrations');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _openhours_sql_migrations (
        filename    text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(here)).filter((name) => name.endsWith('.sql')).sort();

    for (const filename of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM _openhours_sql_migrations WHERE filename = $1',
        [filename],
      );

      if (rowCount !== null && rowCount > 0) {
        out(`already applied, skipped: ${filename}`);
        continue;
      }

      const sql = await readFile(join(here, filename), 'utf8');

      // One transaction per file: a failure leaves nothing half-done and no record.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _openhours_sql_migrations (filename) VALUES ($1)', [
          filename,
        ]);
        await client.query('COMMIT');
        out(`applied: ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    // Local and test databases need app_user to be able to connect. The password comes
    // from the environment, never from the SQL, and this is skipped when it is absent so
    // production credentials stay under an operator's control.
    const appUserPassword = process.env.APP_USER_PASSWORD;
    if (appUserPassword !== undefined && appUserPassword !== '') {
      await client.query(
        `ALTER ROLE app_user LOGIN PASSWORD ${client.escapeLiteral(appUserPassword)}`,
      );
      out('app_user granted LOGIN with the supplied password');
    } else {
      out('APP_USER_PASSWORD not set: app_user left NOLOGIN');
    }
  } finally {
    await client.end();
  }
};

await applyAll();
