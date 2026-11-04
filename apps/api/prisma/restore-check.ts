import { spawn } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { config } from '../src/config.js';
import { logger } from '../src/common/logger.js';
import { createObjectStorage } from '../src/storage/object-storage.js';

/**
 * Restores a dump into a SCRATCH database and reports what arrived. `pnpm db:restore-check`.
 *
 * ─── WHY THIS IS A COMMAND AND NOT A PARAGRAPH IN A RUNBOOK ─────────────────────
 *
 * A backup nobody has restored is a hypothesis. Supabase's free tier takes no backups of
 * its own (D-019), so the nightly dump is the only copy, and the first time anybody finds
 * out whether it restores must not be the morning the database is gone.
 *
 * It takes a scratch `DATABASE_URL` as its first argument and REFUSES to run against the
 * configured one, because the restore starts with `DROP ... IF EXISTS`: pointing it at
 * production would do exactly what it says on a database that was fine.
 *
 * ─── WHAT IT PROVES, AND WHAT IT DOES NOT ───────────────────────────────────────
 *
 * It proves the newest dump is a complete, readable archive that `psql` accepts, and that
 * the tables the product depends on arrive with rows. It does NOT prove the row-level
 * security policies came with it: the dump is taken with `--no-owner --no-privileges`, so
 * the roles and policies are recreated by `prisma/sql/apply.ts` on top. The runbook says to
 * run that next and then `db:check-policies`, and the restore is not signed off until both
 * have.
 */

/** Tables whose presence and row count say the restore is real rather than merely valid. */
const EXPECTED_TABLES = [
  'organisations',
  'users',
  'patients',
  'appointments',
  'doctors',
  'services',
  'clinic_hours',
  'audit_logs',
] as const;

const run = (
  command: string,
  args: readonly string[],
  options: { readonly input?: Buffer; readonly env?: NodeJS.ProcessEnv } = {},
): Promise<{ readonly stdout: string; readonly code: number }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env },
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];

    /**
     * The streams are typed as nullable because `stdio` decides whether they exist, and
     * this function sets it. Checked rather than asserted: a non-null assertion here would
     * be the only place in the file where the types stop checking anything.
     */
    child.stdout?.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        // Redacted: psql and pg_dump both echo the connection string, password included.
        const detail = Buffer.concat(err)
          .toString()
          .replace(/postgres(ql)?:\/\/\S+/g, '[redacted]');
        reject(new Error(`${command} exited with ${String(code)}: ${detail.slice(0, 800)}`));
        return;
      }

      resolve({ stdout: Buffer.concat(out).toString(), code: code ?? 0 });
    });

    if (options.input !== undefined) {
      child.stdin?.end(options.input);
    }
  });

export const restoreCheck = async (scratchUrl: string): Promise<void> => {
  if (scratchUrl.trim() === '') {
    throw new Error('usage: pnpm db:restore-check <scratch DATABASE_URL>');
  }

  if (scratchUrl === config.DATABASE_URL) {
    /**
     * The guard that matters. The restore below runs a dump taken with `--clean
     * --if-exists`, which begins by dropping every object it is about to recreate.
     */
    throw new Error('the scratch URL is the configured DATABASE_URL; refusing to restore over it');
  }

  const storage = createObjectStorage();

  const objects = await storage.list({ bucket: config.BACKUPS_BUCKET, prefix: 'postgres/' });

  if (objects.length === 0) {
    throw new Error(`no backups found in ${config.BACKUPS_BUCKET} under postgres/`);
  }

  /**
   * The NEWEST dump, because that is the one a real restore would reach for.
   *
   * Sorted on the provider's `lastModified` rather than on the key, for the same reason the
   * retention sweep is: the key is written by this repository and the timestamp is not.
   */
  const newest = [...objects].sort(
    (a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0),
  )[0];

  if (newest === undefined) {
    throw new Error('backup listing returned no usable object');
  }

  logger.info({ key: newest.key, takenAt: newest.lastModified }, 'restoring the newest dump');

  /**
   * Fetched through a presigned URL rather than the SDK's streaming body, so the command
   * exercises the same path a human following the runbook would use with `curl`.
   */
  const url = await storage.presignGet({ bucket: config.BACKUPS_BUCKET, key: newest.key });
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`could not download the dump: HTTP ${String(response.status)}`);
  }

  const sql = gunzipSync(Buffer.from(await response.arrayBuffer()));

  logger.info({ bytes: sql.byteLength }, 'dump decompressed');

  await run('psql', ['--quiet', '--no-psqlrc', '--set', 'ON_ERROR_STOP=0', scratchUrl], {
    input: sql,
  });

  /**
   * `ON_ERROR_STOP=0` above, deliberately: a `--clean` dump's opening DROP statements fail
   * on an empty database, and stopping there would mean nothing is ever restored into a
   * fresh scratch database. The verification below is what decides success, not psql's
   * exit status.
   */
  const counts: Record<string, number> = {};

  for (const table of EXPECTED_TABLES) {
    const { stdout } = await run('psql', [
      '--quiet',
      '--no-psqlrc',
      '--tuples-only',
      '--command',
      `SELECT count(*) FROM ${table}`,
      scratchUrl,
    ]);

    const parsed = Number.parseInt(stdout.trim(), 10);

    if (Number.isNaN(parsed)) {
      throw new Error(`table ${table} did not survive the restore`);
    }

    counts[table] = parsed;
  }

  if ((counts.organisations ?? 0) === 0) {
    // Every other table can legitimately be empty in a young database. A dump with no
    // organisations is a dump of nothing, which is the failure this command exists to find.
    throw new Error('the restored database has no organisations; the dump is not usable');
  }

  logger.info(
    { key: newest.key, counts },
    'restore verified: the newest dump restores and its tables carry rows',
  );
};

if (process.argv[1]?.endsWith('restore-check.ts') === true) {
  restoreCheck(process.argv[2] ?? '')
    .then(() => {
      process.exit(0);
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, 'restore check FAILED');
      process.exit(1);
    });
}
