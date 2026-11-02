import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { config } from '../src/config.js';
import { logger } from '../src/common/logger.js';
import { backupKey, createObjectStorage } from '../src/storage/object-storage.js';

/**
 * The nightly database backup. `pnpm db:backup`, run from cron on the Lightsail box.
 *
 * ─── THIS IS THE ONLY COPY ──────────────────────────────────────────────────────
 *
 * Supabase's free tier takes no automated backups (D-019). There is no point-in-time
 * recovery, no daily snapshot and no undo: if the database is lost or a migration goes
 * wrong, the most recent object in the backups bucket is the whole of what survives. That
 * sentence is the reason for every decision below.
 *
 * ─── WHAT IT DOES, AND WHY IN THIS ORDER ────────────────────────────────────────
 *
 *  1. `pg_dump` into a gzip stream, which is PIPED rather than written to a file. A
 *     Lightsail 2 GB instance has limited disk, and a dump that filled it would take the
 *     application down to protect the database, which is the wrong trade.
 *  2. Uploaded under a dated key, so a day's dump cannot overwrite another day's. The key
 *     is `postgres/YYYY/MM/DD/clinicai-<timestamp>.sql.gz`.
 *  3. THEN the retention sweep, and only if the upload succeeded. A sweep that ran first,
 *     or ran after a failed upload, could delete the oldest copy on the night the new one
 *     did not arrive. Thirty days of retention means nothing if the deletion is unordered.
 *  4. The outcome is logged with sizes and counts, never with any row of data.
 *
 * ─── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────────────
 *
 * It does not verify the dump restores. That cannot be done on the box that holds the
 * database, because a restore needs an empty database and a free gigabyte, so it is a
 * separate command (`pnpm db:restore-check`) documented in the runbook and run against a
 * scratch database. A backup nobody has restored is a hypothesis.
 */

/** The dump is refused below this size: an empty or truncated dump is worse than none. */
const MINIMUM_PLAUSIBLE_BYTES = 1024;

type BackupOutcome = {
  readonly key: string;
  readonly bytes: number;
  readonly deleted: number;
};

/**
 * Streams `pg_dump | gzip` into the object store.
 *
 * `--no-owner` and `--no-privileges`, because the restore target is a scratch database or a
 * fresh Supabase project where `app_owner` and `app_user` may not exist yet: a dump that
 * insists on them fails at the first GRANT, which is exactly when nobody has time to debug
 * it. The hand-written SQL in `prisma/sql/` recreates the roles and the policies.
 *
 * `--clean --if-exists` so the dump can be restored over an existing schema without a
 * manual drop first.
 */
const streamDump = async (databaseUrl: string): Promise<{ body: Buffer; bytes: number }> => {
  const dump = spawn(
    'pg_dump',
    ['--no-owner', '--no-privileges', '--clean', '--if-exists', '--format=plain', databaseUrl],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  /**
   * stderr is collected rather than inherited, because it may contain the connection
   * string on a failure and that holds the database password.
   */
  const errorChunks: Buffer[] = [];
  dump.stderr.on('data', (chunk: Buffer) => errorChunks.push(chunk));

  const gzip = createGzip({ level: 9 });
  const chunks: Buffer[] = [];
  gzip.on('data', (chunk: Buffer) => chunks.push(chunk));

  const exited = new Promise<void>((resolve, reject) => {
    dump.on('error', reject);
    dump.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      // The message is redacted: pg_dump echoes the connection string, password included.
      const detail = Buffer.concat(errorChunks)
        .toString()
        .replace(/postgres(ql)?:\/\/\S+/g, '[redacted]');
      reject(new Error(`pg_dump exited with ${String(code)}: ${detail.slice(0, 500)}`));
    });
  });

  await Promise.all([pipeline(dump.stdout, gzip), exited]);

  const body = Buffer.concat(chunks);
  return { body, bytes: body.byteLength };
};

/**
 * Deletes dumps older than the retention window.
 *
 * Keyed on the object's own `lastModified` rather than on the date in its key, because the
 * key is written by this script and the timestamp is written by the storage provider: if
 * the two ever disagree, the provider's is the one that is not a bug in this file.
 */
const sweep = async (
  storage: Pick<ReturnType<typeof createObjectStorage>, 'list' | 'remove'>,
  retentionDays: number,
  now: Date,
  /** The dump just uploaded. Never a candidate, whatever the clock says about its age. */
  protectedKey: string,
): Promise<number> => {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const objects = await storage.list({ bucket: config.BACKUPS_BUCKET, prefix: 'postgres/' });

  /**
   * Decided BEFORE anything is deleted, so the rule can be checked against the outcome
   * rather than discovered half way through it.
   *
   * An object whose age the provider did not report is KEPT. Deleting it would be a guess,
   * and what is being guessed about is a copy of a clinic's database.
   */
  const expired = objects.filter(
    (object) =>
      object.key !== protectedKey &&
      object.lastModified !== undefined &&
      object.lastModified < cutoff,
  );

  /**
   * THE SWEEP MAY NEVER LEAVE THE BUCKET EMPTY.
   *
   * Deleting every old dump is legitimate: a job that has not run for two months finds that
   * all of them have expired, and the fresh one it just uploaded is what remains. Leaving
   * NOTHING is not legitimate under any configuration, and it is what a wrong clock or
   * `BACKUP_RETENTION_DAYS=0` would produce. It can also happen if the listing does not yet
   * include the object just written, which is why the check counts what would remain rather
   * than trusting the protected key to be in the list.
   *
   * An earlier version compared the deletion count against the listing length, which fired
   * on a correct sweep whenever the fresh object was missing from the listing: right
   * instinct, wrong rule. The test caught it.
   */
  if (objects.length > 0 && expired.length === objects.length) {
    throw new Error(
      `retention sweep would have left the bucket empty (${String(expired.length)} of ${String(objects.length)} objects); refusing. Check the clock and BACKUP_RETENTION_DAYS.`,
    );
  }

  for (const object of expired) {
    await storage.remove({ bucket: config.BACKUPS_BUCKET, key: object.key });
  }

  return expired.length;
};

/**
 * The pieces are injectable so the ORDERING and the REFUSALS can be tested.
 *
 * Not for its own sake: the three properties that matter here are that the upload happens
 * before the sweep, that a truncated dump is never uploaded, and that a sweep which would
 * empty the bucket stops. None of those can be asserted by taking a real dump, and all three
 * are the behaviour that decides whether the only copy of the database survives a bad night.
 *
 * `pg_dump` itself is not mocked away in production: the default is the real one.
 */
export type BackupDependencies = {
  readonly storage?: Pick<ReturnType<typeof createObjectStorage>, 'put' | 'list' | 'remove'>;
  readonly dump?: (databaseUrl: string) => Promise<{ body: Buffer; bytes: number }>;
  readonly retentionDays?: number;
};

export const runBackup = async (
  now: Date = new Date(),
  dependencies: BackupDependencies = {},
): Promise<BackupOutcome> => {
  const storage = dependencies.storage ?? createObjectStorage();
  const dump = dependencies.dump ?? streamDump;
  const retentionDays = dependencies.retentionDays ?? config.BACKUP_RETENTION_DAYS;
  const key = backupKey(now);

  const { body, bytes } = await dump(config.DATABASE_URL);

  if (bytes < MINIMUM_PLAUSIBLE_BYTES) {
    /**
     * Refused BEFORE the upload, so a truncated dump never becomes the newest object in
     * the bucket. The newest object is what a restore reaches for first, and an empty one
     * that overwrote a good one is the worst possible outcome of a backup job.
     */
    throw new Error(`dump is implausibly small (${String(bytes)} bytes); refusing to upload it`);
  }

  await storage.put({
    bucket: config.BACKUPS_BUCKET,
    key,
    body,
    contentType: 'application/gzip',
  });

  const deleted = await sweep(storage, retentionDays, now, key);

  return { key, bytes, deleted };
};

/**
 * Run directly, not imported: `pnpm db:backup`.
 *
 * The guard keeps the module importable by a test without taking a dump as a side effect.
 */
if (process.argv[1]?.endsWith('backup-database.ts') === true) {
  runBackup()
    .then((outcome) => {
      logger.info(
        {
          key: outcome.key,
          bytes: outcome.bytes,
          megabytes: Number((outcome.bytes / 1_048_576).toFixed(2)),
          deleted: outcome.deleted,
          retentionDays: config.BACKUP_RETENTION_DAYS,
        },
        'database backup complete',
      );
      process.exit(0);
    })
    .catch((error: unknown) => {
      // The reason, never the connection string: the message is already redacted above.
      logger.error({ err: error }, 'database backup FAILED');
      /**
       * A non-zero exit is what cron reports and what a monitor alerts on. A backup job
       * that fails quietly is indistinguishable from one that never ran, and both are
       * discovered at the moment a restore is needed.
       */
      process.exit(1);
    });
}
