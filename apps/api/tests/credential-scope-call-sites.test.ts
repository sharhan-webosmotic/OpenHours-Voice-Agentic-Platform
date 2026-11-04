import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `asAuthenticator` opens cross-tenant scope WITHOUT writing an audit row, which is the one
 * thing `asSystem` will not do.
 *
 * That is correct for resolving a credential to a tenant, which runs on every voice tool
 * call inside a 400 ms budget and would otherwise file a "platform scope opened" row per
 * sentence a patient speaks. It is wrong for anything else, and the difference is a comment
 * in a file somebody has to read.
 *
 * So this enumerates the call sites. A second one fails this test, which is the moment to
 * decide whether it belongs here or behind the audited `asSystem`. It is the same mechanism
 * as the raw-SQL walk in `platform-scope-isolation.test.ts`, and for the same reason: an
 * escape hatch nobody is counting is an escape hatch that spreads.
 */

const SRC = path.resolve(import.meta.dirname, '../src');

/** Where it is DEFINED and re-exported, which are not uses of it. */
const DEFINITIONS = ['db/tenant-client.ts', 'db/index.ts'];

/** Where it is USED, with the reason it is allowed to be. */
const ALLOWED_CALL_SITES: Readonly<Record<string, string>> = {
  'voice/tool-secret.ts':
    'resolves the per-clinic voice tool secret to a clinic, which is the query that decides the tenant',
  'voice/webhook.routes.ts':
    'resolves the secret in a webhook URL to a clinic, the same question for the other credential (D-006)',
};

/**
 * `ingest.service.ts` is deliberately NOT here. It reads a stored event cross-tenant too,
 * and it uses the AUDITED `asSystem` for it: that runs once per call rather than once per
 * sentence spoken, so the extra transaction and the audit row it writes are affordable and
 * worth having. The unaudited variant is for the two credential lookups and nothing else.
 */

const walk = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // The generated Prisma client is machine-written and enormous; it calls nothing
        // of ours.
        return entry.name === 'generated' ? [] : walk(full);
      }

      return entry.isFile() && /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)
        ? [full]
        : [];
    }),
  );

  return nested.flat();
};

describe('asAuthenticator has exactly the call sites it is documented to have', () => {
  it('is used only where the comment on it says', async () => {
    const files = await walk(SRC);

    const mentions = await Promise.all(
      files.map(async (file) => {
        const contents = await readFile(file, 'utf8');
        return { file: path.relative(SRC, file), uses: contents.includes('asAuthenticator(') };
      }),
    );

    const callSites = mentions
      .filter((mention) => mention.uses && !DEFINITIONS.includes(mention.file))
      .map((mention) => mention.file)
      .sort();

    expect(callSites).toEqual(Object.keys(ALLOWED_CALL_SITES).sort());
  });

  it('found files to look at, so the walk is not vacuously empty', async () => {
    const files = await walk(SRC);

    expect(files.length).toBeGreaterThan(40);
  });
});
