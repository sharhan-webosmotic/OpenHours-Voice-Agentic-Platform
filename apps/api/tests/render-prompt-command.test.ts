import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidV7 } from '../src/common/uuid.js';
import { runRenderPromptCommand } from '../prisma/render-prompt.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { uniqueSuffix } from './support/clinic-bodies.js';

/**
 * `pnpm prompt:render`, driven as an operator runs it.
 *
 * What matters is the split: the prompt and nothing else on stdout, so it can be redirected
 * into a file and pasted into Sarvam, and every warning and refusal on stderr. And that a name
 * matching two clinics is refused rather than rendered as the first one, because rendering the
 * wrong clinic's prompt into a provider console is not a mistake that announces itself.
 */

let clinic: OrganisationGraph;
let label: string;

const capture = () => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    output: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) },
  };
};

beforeAll(async () => {
  label = `RenderCmd${uniqueSuffix()}`;
  await asPlatform(ownerClient(), async (tx) => {
    clinic = await createOrganisationGraph(tx, label);
    // Two more that share a fragment, for the ambiguity case.
    await createOrganisationGraph(tx, `${label}Twin1`);
    await createOrganisationGraph(tx, `${label}Twin2`);
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

describe('pnpm prompt:render', () => {
  it('prints its usage on stderr and exits 1 without an argument', async () => {
    const run = capture();

    expect(await runRenderPromptCommand(undefined, run.output)).toBe(1);
    expect(run.out).toEqual([]);
    expect(run.err.join('\n')).toMatch(/Usage: pnpm prompt:render/);
  });

  it('renders the clinic named by its id, with the prompt alone on stdout', async () => {
    const run = capture();

    expect(await runRenderPromptCommand(clinic.organisationId, run.output)).toBe(0);
    expect(run.out).toHaveLength(1);
    expect(run.out[0]).toContain(`Test Clinic ${label}`);
    expect(run.out[0]).not.toContain('WARNING');
    // The placeholder wording and the unfinished configuration are both said, on stderr.
    expect(run.err.join('\n')).toMatch(/is a PLACEHOLDER/);
    expect(run.err.join('\n')).toMatch(/not ready to go live/);
  });

  it('resolves an unambiguous fragment of the name, and says which clinic it chose', async () => {
    const run = capture();

    expect(await runRenderPromptCommand(`${label}Twin1`, run.output)).toBe(0);
    expect(run.err.join('\n')).toMatch(
      new RegExp(`Resolved "${label}Twin1" to Test Clinic ${label}Twin1`),
    );
  });

  it('refuses a fragment matching more than one clinic, listing them, and prints no prompt', async () => {
    const run = capture();

    expect(await runRenderPromptCommand(label, run.output)).toBe(1);
    expect(run.out).toEqual([]);
    expect(run.err.join('\n')).toMatch(/matches 3 clinics. Pass the organisation id instead/);
  });

  it('refuses a name matching nothing', async () => {
    const run = capture();

    expect(await runRenderPromptCommand(`Nobody ${uniqueSuffix()}`, run.output)).toBe(1);
    expect(run.out).toEqual([]);
    expect(run.err.join('\n')).toMatch(/no clinic matches/);
  });

  it('refuses an id that is not a clinic', async () => {
    const run = capture();

    expect(await runRenderPromptCommand(uuidV7(), run.output)).toBe(1);
    expect(run.out).toEqual([]);
    expect(run.err.join('\n')).toMatch(/no clinic with id/);
  });
});
