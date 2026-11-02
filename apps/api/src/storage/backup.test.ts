import { describe, expect, it } from 'vitest';
import { runBackup } from '../../prisma/backup-database.js';

/**
 * The backup job's three decisions, which are the ones that decide whether the only copy of
 * the database survives a bad night.
 *
 * Supabase's free tier takes no backups of its own (D-019), so there is no second chance
 * behind any of this: no point-in-time recovery, no provider snapshot, nothing to fall back
 * to if the newest object in the bucket turns out to be a 40-byte file.
 *
 * `pg_dump` is injected rather than invoked. What is under test is the ORDER of the steps and
 * the refusals, none of which a real dump would exercise, and the machine running the suite
 * has no PostgreSQL client binaries anyway. The dump command itself is proven on the box that
 * runs it, by `pnpm db:restore-check`, which the runbook requires before a go-live sign-off.
 */

type StoredObject = { readonly key: string; readonly lastModified: Date | undefined };

/**
 * A store that behaves like one: a listing includes what was put into it.
 *
 * The first version returned only the pre-existing objects, which made the sweep look as
 * though it were about to empty the bucket on a perfectly ordinary night. That was the fake
 * being unfaithful rather than the job being wrong, and chasing it found a real flaw in the
 * guard, which used to compare the deletion count against the listing length.
 *
 * `listingOmitsFreshObject` reproduces the other case on purpose: a provider whose listing
 * has not caught up with the write.
 */
const fakeStorage = (
  existing: readonly StoredObject[] = [],
  options: { readonly listingOmitsFreshObject?: boolean } = {},
) => {
  const put: string[] = [];
  const removed: string[] = [];
  const order: string[] = [];
  const written: StoredObject[] = [];

  return {
    put,
    removed,
    order,
    storage: {
      put: async ({ key }: { readonly key: string }) => {
        put.push(key);
        order.push(`put:${key}`);
        if (options.listingOmitsFreshObject !== true) {
          written.push({ key, lastModified: NOW });
        }
        return Promise.resolve();
      },
      list: async () => {
        order.push('list');
        return Promise.resolve([...existing, ...written]);
      },
      remove: async ({ key }: { readonly key: string }) => {
        removed.push(key);
        order.push(`remove:${key}`);
        return Promise.resolve();
      },
    },
  };
};

const goodDump = () => Promise.resolve({ body: Buffer.alloc(4096, 1), bytes: 4096 });

const NOW = new Date('2026-11-02T02:00:00.000Z');

const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe('the nightly backup', () => {
  it('uploads under a dated key and reports the size', async () => {
    const fake = fakeStorage();

    const outcome = await runBackup(NOW, { storage: fake.storage, dump: goodDump });

    expect(outcome.key).toBe('postgres/2026/11/02/clinicai-2026-11-02T02-00-00-000Z.sql.gz');
    expect(outcome.bytes).toBe(4096);
    expect(fake.put).toEqual([outcome.key]);
  });

  it('uploads BEFORE it sweeps, so a failed upload cannot cost the oldest copy', async () => {
    const fake = fakeStorage([
      { key: 'postgres/2026/09/01/old.sql.gz', lastModified: daysAgo(60) },
    ]);

    await runBackup(NOW, { storage: fake.storage, dump: goodDump, retentionDays: 30 });

    // The order is the property: put, then list, then remove. A sweep that ran first could
    // delete the last good copy on the night the new one did not arrive.
    expect(fake.order[0]?.startsWith('put:')).toBe(true);
    expect(fake.order[1]).toBe('list');
    expect(fake.order[2]).toBe('remove:postgres/2026/09/01/old.sql.gz');
  });

  it('refuses to upload an implausibly small dump', async () => {
    const fake = fakeStorage();

    await expect(
      runBackup(NOW, {
        storage: fake.storage,
        dump: () => Promise.resolve({ body: Buffer.alloc(40), bytes: 40 }),
      }),
    ).rejects.toThrow(/implausibly small/);

    /**
     * NOTHING WAS UPLOADED, which is the whole point of the check.
     *
     * The newest object is what a restore reaches for first, so a truncated dump that
     * overwrote a good one is worse than a night with no backup at all.
     */
    expect(fake.put).toEqual([]);
    expect(fake.removed).toEqual([]);
  });

  it('does not upload when the dump command itself fails', async () => {
    const fake = fakeStorage();

    await expect(
      runBackup(NOW, {
        storage: fake.storage,
        dump: () => Promise.reject(new Error('pg_dump exited with 1')),
      }),
    ).rejects.toThrow(/pg_dump/);

    expect(fake.put).toEqual([]);
  });

  it('deletes only what is older than the retention window', async () => {
    const fake = fakeStorage([
      { key: 'postgres/2026/10/03/a.sql.gz', lastModified: daysAgo(30.5) },
      { key: 'postgres/2026/10/04/b.sql.gz', lastModified: daysAgo(29) },
      { key: 'postgres/2026/11/01/c.sql.gz', lastModified: daysAgo(1) },
    ]);

    const outcome = await runBackup(NOW, {
      storage: fake.storage,
      dump: goodDump,
      retentionDays: 30,
    });

    // The 30.5-day-old object goes; the 29-day-old one stays. The boundary is asserted
    // rather than assumed, because "about a month" is how a retention policy turns into
    // either six weeks of storage cost or a missing copy.
    expect(fake.removed).toEqual(['postgres/2026/10/03/a.sql.gz']);
    expect(outcome.deleted).toBe(1);
  });

  it('keeps an object whose age the provider did not report', async () => {
    const fake = fakeStorage([
      { key: 'postgres/2026/01/01/unknown.sql.gz', lastModified: undefined },
    ]);

    await runBackup(NOW, { storage: fake.storage, dump: goodDump, retentionDays: 30 });

    // Fail-closed: an object of unknown age is kept. Deleting it would be a guess, and the
    // thing being guessed about is the only copy of a clinic's database.
    expect(fake.removed).toEqual([]);
  });

  it('deletes every expired dump when the fresh one is what remains', async () => {
    // A job that has not run for two months finds all of them expired. Deleting them is
    // correct: the dump just uploaded is what the bucket keeps.
    const fake = fakeStorage([
      { key: 'postgres/2026/08/01/a.sql.gz', lastModified: daysAgo(90) },
      { key: 'postgres/2026/08/02/b.sql.gz', lastModified: daysAgo(89) },
    ]);

    const outcome = await runBackup(NOW, {
      storage: fake.storage,
      dump: goodDump,
      retentionDays: 30,
    });

    expect(outcome.deleted).toBe(2);
    expect(fake.removed).toHaveLength(2);
  });

  it('refuses a sweep that would leave the bucket empty', async () => {
    const fake = fakeStorage(
      [
        { key: 'postgres/2020/01/01/a.sql.gz', lastModified: daysAgo(2000) },
        { key: 'postgres/2020/01/02/b.sql.gz', lastModified: daysAgo(1999) },
      ],
      // The provider's listing has not caught up with the write, so the fresh object is not
      // in it and the sweep would take everything the listing does show.
      { listingOmitsFreshObject: true },
    );

    /**
     * A wrong clock or `BACKUP_RETENTION_DAYS=0` would otherwise empty the bucket, and the
     * bucket is the only copy. Emptying it is never a correct outcome of a nightly job, so
     * it is treated as a bug rather than obeyed.
     *
     * The upload that ran first is kept: the new dump is good, and it is the sweep that is
     * refused, which leaves the bucket in a better state than it started in.
     */
    await expect(
      runBackup(NOW, { storage: fake.storage, dump: goodDump, retentionDays: 30 }),
    ).rejects.toThrow(/left the bucket empty/);

    // The upload stands and NOTHING was deleted: the refusal happens before the first
    // removal, so the bucket is left in a better state than it started in.
    expect(fake.put).toHaveLength(1);
    expect(fake.removed).toEqual([]);
  });
});
