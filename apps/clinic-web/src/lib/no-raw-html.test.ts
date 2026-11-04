import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * No source in this application writes raw HTML.
 *
 * The transcript shown in Call History is what a caller said, stored as it arrived from an
 * unsigned webhook (D-006). React renders text as text, so that is safe exactly as long as
 * nothing hands it to the DOM as markup. Confirmed by search on 2026-11-04, and kept true by
 * this test rather than by somebody remembering to search again.
 */

const SRC = path.resolve(import.meta.dirname, '..');

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }

    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });

describe('raw HTML', () => {
  it('is never written: no dangerouslySetInnerHTML, innerHTML or outerHTML anywhere', () => {
    const files = sourceFiles(SRC);
    const offenders = files.filter((file) =>
      /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML/.test(
        readFileSync(file, 'utf8'),
      ),
    );

    // A floor, so a walk that found nothing cannot pass vacuously.
    expect(files.length).toBeGreaterThan(20);
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });
});
