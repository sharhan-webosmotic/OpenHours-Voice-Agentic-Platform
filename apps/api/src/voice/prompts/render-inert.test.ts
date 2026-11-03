import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROMPT_VERSION,
  PROMPT_PLACEHOLDERS,
  renderPromptTemplate,
  type PromptPlaceholder,
} from './registry.js';

/**
 * Clinic text is inert in the master prompt.
 *
 * Every value here is typed by somebody at a clinic, and the rendered prompt becomes the voice
 * agent's instructions. A value that could reach into the template, copying part of it,
 * pulling another section in, or making the render fail, is prompt injection through a
 * settings form. So the property is exact: rendering a value must produce the template with
 * that value's characters in its place and nothing else changed.
 *
 * THE ORACLE IS LITERAL. Each value is compared against a baseline render with a marker in
 * its place, the marker swapped by `split` and `join`, which have no special characters. A
 * renderer that used a string replacement, or substituted placeholders one after another, fails
 * every case below.
 */

const marker = (name: PromptPlaceholder): string => `<<${name}>>`;

const markerValues = (): Record<PromptPlaceholder, string> =>
  Object.fromEntries(PROMPT_PLACEHOLDERS.map((name) => [name, marker(name)])) as Record<
    PromptPlaceholder,
    string
  >;

const baseline = renderPromptTemplate(DEFAULT_PROMPT_VERSION, markerValues());

/** What a correct renderer produces: the baseline with each marker replaced, literally. */
const expectedWith = (overrides: Partial<Record<PromptPlaceholder, string>>): string =>
  Object.entries(overrides).reduce(
    (text, [name, value]) => text.split(marker(name as PromptPlaceholder)).join(value),
    baseline,
  );

const renderWith = (overrides: Partial<Record<PromptPlaceholder, string>>): string =>
  renderPromptTemplate(DEFAULT_PROMPT_VERSION, {
    ...markerValues(),
    ...overrides,
  });

const HOSTILE: readonly (readonly [string, string])[] = [
  ["$' (the text after the match)", "Consultations from $' onwards"],
  ['$& (the match itself)', 'See our price list: $&'],
  ['$` (the text before the match)', 'Welcome to $` the clinic'],
  ['$$ and $1', 'Fees: $$ 500, or $1 for a review'],
  ['another placeholder', 'Our doctors are {{doctors}}'],
  ['a placeholder the template does not have', 'See the {{price}} list'],
  ['an unbalanced opening brace pair', 'Open {{greeting and never closed'],
  ['an unbalanced closing brace pair', 'closed}} without an opening'],
  ['triple braces around a real placeholder', 'Hello {{{clinicName}}}'],
];

describe('clinic text is inert in the rendered prompt', () => {
  for (const [label, value] of HOSTILE) {
    it(`renders a greeting containing ${label} as exactly those characters`, () => {
      expect(renderWith({ greeting: value })).toBe(expectedWith({ greeting: value }));
    });
  }

  it('keeps the prompt the same length apart from the value itself', () => {
    const value = "Consultations from $' onwards";
    const rendered = renderWith({ greeting: value });

    expect(rendered.length).toBe(baseline.length - marker('greeting').length + value.length);
    expect(rendered.split('\n')).toHaveLength(baseline.split('\n').length);
  });

  it('does not let one field pull another section into itself', () => {
    const rendered = renderWith({ greeting: 'Hello, {{doctors}}', doctors: '- Dr Asha Rao' });

    expect(rendered).toContain('Hello, {{doctors}}');
    expect(rendered.split('- Dr Asha Rao')).toHaveLength(2);
  });

  it('renders a placeholder the template does not have instead of refusing the whole prompt', () => {
    const faqs = '- Question: Price?\n  Answer, as written: see the {{price}} list';

    expect(() => renderWith({ faqs })).not.toThrow();
    expect(renderWith({ faqs })).toContain('see the {{price}} list');
  });

  it('renders the same hostile text in every field at once', () => {
    const hostile = "$' $& $` {{doctors}} {{price}} {{greeting";
    const overrides = Object.fromEntries(
      PROMPT_PLACEHOLDERS.map((name) => [name, `${name}: ${hostile}`]),
    ) as Record<PromptPlaceholder, string>;

    expect(renderWith(overrides)).toBe(expectedWith(overrides));
  });

  it('renders a very long value whole', () => {
    const value = `${'Please arrive ten minutes early. '.repeat(3_000)}$' {{doctors}}`;

    expect(renderWith({ escalationRules: value })).toBe(expectedWith({ escalationRules: value }));
  });

  it('keeps blank lines a clinic wrote, rather than tidying them away', () => {
    const value = 'Transfer billing questions.\n\n\n\nTransfer anything clinical.';

    expect(renderWith({ escalationRules: value })).toContain(value);
  });
});
