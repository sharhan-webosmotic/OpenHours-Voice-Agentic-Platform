import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROMPT_VERSION,
  PROMPT_PLACEHOLDERS,
  findPromptVersion,
  renderPromptTemplate,
  type PromptPlaceholder,
} from './registry.js';

/**
 * Master prompt v1: the tested Hindi-first wording, landed character for character.
 *
 * The fingerprint is the guard on "never edit a version a clinic is marked as running". A
 * change to this wording is a new version file, and this test failing is how that is noticed.
 */

const V1_FINGERPRINT = '65307917d0fc747aed501ab93a5ced7e262e640d8894f71c33ad36ad6cf79b06';

const template = findPromptVersion('v1')?.template ?? '';

const values = (overrides: Partial<Record<PromptPlaceholder, string>>) =>
  ({
    ...Object.fromEntries(PROMPT_PLACEHOLDERS.map((name) => [name, `<<${name}>>`])),
    ...overrides,
  }) as Record<PromptPlaceholder, string>;

const rendered = renderPromptTemplate(
  'v1',
  values({
    clinicName: 'Sudhir Heart Care Clinic',
    address: '2nd Floor, Sunrise Heights, Opp. Iskcon Temple Road, Adajan, Surat, Gujarat, 395009',
  }),
);

describe('master prompt v1', () => {
  it('is registered and approved, and is not the default for new clinics', () => {
    expect(findPromptVersion('v1')?.approved).toBe(true);
    expect(DEFAULT_PROMPT_VERSION).not.toBe('v1');
  });

  it('keeps its wording exactly as landed', () => {
    expect(createHash('sha256').update(template).digest('hex')).toBe(V1_FINGERPRINT);
  });

  it('templates only the clinic name and the address', () => {
    const used = new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]));

    expect([...used].sort()).toEqual(['address', 'clinicName']);
  });

  it('renders for the clinic with every placeholder filled and nothing else substituted', () => {
    expect(rendered).not.toMatch(/\{\{|<<\w+>>/);
    expect(rendered.split('Sudhir Heart Care Clinic')).toHaveLength(7);
    expect(rendered).toContain(
      'Address: 2nd Floor, Sunrise Heights, Opp. Iskcon Temple Road, Adajan, Surat, Gujarat, 395009\n',
    );
  });

  it('keeps the clinical boundary and the emergency instruction', () => {
    expect(rendered).toContain('Never give medical advice, diagnosis, medicine names, or doses.');
    expect(rendered).toContain(
      'कृपया अभी तुरंत एक ज़ीरो आठ या एक एक दो पर call कीजिए — वे ambulance भेजने में मदद करेंगे।',
    );
  });
});
