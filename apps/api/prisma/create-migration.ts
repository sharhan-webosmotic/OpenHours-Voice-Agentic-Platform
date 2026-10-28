import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Creates a migration from the current schema WITHOUT touching any real database.
 *
 * `prisma migrate dev` cannot be used on this project. It compares the database with
 * migration history, and the hand-written SQL in prisma/sql (policies, roles,
 * constraints, grants) is not in that history, so it reports drift and offers to RESET
 * the database. Accepting that would drop every policy and role, and on a shared
 * database it would drop the data.
 *
 * So the diff is taken between the MIGRATIONS and the schema, using a throwaway
 * container as the shadow database. Nothing persistent is read or written, which also
 * means this is safe to run against a working dev environment.
 *
 * Usage:  pnpm db:migrate:create <name>
 * Then:   pnpm db:migrate && pnpm db:sql
 */

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const nameArgument = process.argv[2];

if (nameArgument === undefined || !/^[a-z0-9_]+$/.test(nameArgument)) {
  out('Usage: pnpm db:migrate:create <snake_case_name>');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+$/, '');

const container = await new PostgreSqlContainer('postgres:16.15-alpine')
  .withDatabase('shadow')
  .withUsername('shadow')
  .withPassword('shadow')
  .start();

try {
  // Prisma 7 has no --shadow-database-url flag: the shadow database is read from
  // prisma.config.ts, which picks it up from this variable.
  const sql = execFileSync(
    'pnpm',
    [
      'exec',
      'prisma',
      'migrate',
      'diff',
      '--from-migrations',
      'prisma/migrations',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    {
      cwd: apiRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, SHADOW_DATABASE_URL: container.getConnectionUri() },
    },
  );

  // Prisma emits this comment and nothing else when the schema already matches.
  if (sql.trim() === '' || sql.includes('This is an empty migration')) {
    out('No schema changes to migrate. Nothing written.');
    process.exit(0);
  }

  const directory = join(apiRoot, 'prisma', 'migrations', `${timestamp}_${nameArgument}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'migration.sql'), sql, 'utf8');

  out(`Created prisma/migrations/${timestamp}_${nameArgument}/migration.sql`);
  out('');
  out('Review it, then apply with:  pnpm db:migrate && pnpm db:sql');
  out('A new tenant table also needs a prisma/sql file re-running the policy loop,');
  out('and `pnpm db:check-policies` will fail until it has one.');
} finally {
  await container.stop();
}
