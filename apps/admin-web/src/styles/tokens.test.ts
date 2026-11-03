import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every colour utility the screens use names a colour the theme defines.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────────
 *
 * Tailwind does not fail on a colour it does not know: `bg-accent-surface` with no
 * `--color-accent-surface` simply generates nothing, and the element renders as if the class
 * were not there. That happened THREE times in this application before anything noticed:
 *
 *   - `bg-accent-surface`, in five components: every highlighted card rendered flat white
 *   - `text-on-accent`, on blue buttons and selected slots: their text rendered dark navy on
 *     blue, which is an accessibility failure and not only a visual one
 *   - `bg-navy/40`, on the modal backdrop: no dialog has ever dimmed the page behind it
 *
 * None of the three failed a type check, a lint or a test, because a class name is a
 * string. This reads the theme's own `--color-*` declarations and every `bg-`, `text-`,
 * `border-` and `fill-`/`stroke-` utility in the source, and fails on any colour name the
 * theme does not declare.
 *
 * ─── WHAT IT DELIBERATELY IGNORES ───────────────────────────────────────────────
 *
 * Arbitrary values (`bg-[#f0ecff]`), which carry their own colour; and the utilities that
 * share a prefix with colours but are not colours (`text-xs`, `text-center`, `border-b`,
 * `bg-clip-text`). Those lists are written out below, so adding one is a visible decision.
 */

const SRC = path.resolve(import.meta.dirname, '..');

const files = (directory: string): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) {
      return files(full);
    }

    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });

const definedColours = (): ReadonlySet<string> => {
  const theme = readFileSync(path.join(SRC, 'styles/theme.css'), 'utf8');
  const names = [...theme.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1] ?? '');

  // Tailwind's own keywords, which need no declaration.
  return new Set([...names, 'transparent', 'current', 'inherit', 'white', 'black']);
};

/** Suffixes that follow a colour prefix and are not colours. */
const NOT_COLOURS: Readonly<Record<string, ReadonlySet<string>>> = {
  text: new Set([
    'xs',
    'sm',
    'base',
    'md',
    'lg',
    'xl',
    '2xl',
    'left',
    'center',
    'right',
    'justify',
    'start',
    'end',
    'wrap',
    'nowrap',
    'balance',
    'pretty',
    'ellipsis',
    'clip',
  ]),
  bg: new Set(['cover', 'contain', 'center', 'no-repeat', 'fixed', 'clip-text', 'none']),
  border: new Set([
    'b',
    't',
    'l',
    'r',
    'x',
    'y',
    's',
    'e',
    '0',
    '2',
    '4',
    '8',
    'solid',
    'dashed',
    'dotted',
    'none',
    'collapse',
    'separate',
  ]),
  fill: new Set(['none']),
  stroke: new Set(['none', '0', '1', '2']),
};

const undefinedColourClasses = (): readonly string[] => {
  const defined = definedColours();
  const found = new Set<string>();

  for (const file of files(SRC)) {
    const source = readFileSync(file, 'utf8');

    /**
     * A utility at a word boundary, optionally behind variants (`hover:`), optionally with an
     * opacity (`/40`). Arbitrary values are excluded by refusing a `[` straight after the
     * dash, and a line border like `border-b` by the not-a-colour list.
     */
    for (const match of source.matchAll(
      /(?<![\w-])(?:[a-z-]+:)*(text|bg|border|fill|stroke)-([a-z][a-z0-9-]*)(?:\/\d+)?(?![\w[-])/g,
    )) {
      const prefix = match[1] ?? '';
      const name = match[2] ?? '';

      if (
        NOT_COLOURS[prefix]?.has(name) === true ||
        /^(x|y|t|b|l|r|s|e)-/.test(name) ||
        // A gradient's direction, which Tailwind 4 still generates under both spellings.
        (prefix === 'bg' && /^(gradient|linear|radial|conic)-/.test(name))
      ) {
        continue;
      }

      if (!defined.has(name)) {
        found.add(`${path.relative(SRC, file)}: ${prefix}-${name}`);
      }
    }
  }

  return [...found].sort();
};

describe('the colour classes the screens use', () => {
  it('name only colours the theme defines', () => {
    expect(undefinedColourClasses()).toEqual([]);
  });

  it('read a theme with colours in it, so the check is not vacuous', () => {
    expect(definedColours().has('accent')).toBe(true);
  });
});
