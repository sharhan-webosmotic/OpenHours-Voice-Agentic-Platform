import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { uuidV7 } from '../src/common/uuid.js';

/** The constraints and indexes from M1-06 that Prisma cannot express. */

let orgA: OrganisationGraph;
let orgB: OrganisationGraph;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    orgA = await createOrganisationGraph(tx, 'ConstraintsA');
    orgB = await createOrganisationGraph(tx, 'ConstraintsB');
  });
}, 120_000);

afterAll(async () => {
  await disconnectAll();
});

/** Result of a statement: whether PostgreSQL accepted it, and why not if it did not. */
type Attempt = { readonly ok: boolean; readonly message: string };

const attempt = async (sql: string, params: readonly unknown[]): Promise<Attempt> =>
  asPlatform(ownerClient(), (tx) => tx.$executeRawUnsafe(sql, ...params)).then(
    (): Attempt => ({ ok: true, message: '' }),
    (error: unknown): Attempt => ({ ok: false, message: String((error as Error).message) }),
  );

const insertPhone = `INSERT INTO phone_numbers (id, organisation_id, e164, kind, created_at, updated_at)
                     VALUES ($1, $2, $3, $4::phone_kind, now(), now())`;

describe('agent numbers are globally unique', () => {
  const sharedAgentNumber = '+919812340001';

  it('accepts the first agent number', async () => {
    const result = await attempt(insertPhone, [
      uuidV7(),
      orgA.organisationId,
      sharedAgentNumber,
      'AGENT_NUMBER',
    ]);

    expect(result.ok).toBe(true);
  });

  it('rejects the same agent number in a DIFFERENT organisation', async () => {
    // An inbound call is resolved to an organisation by the number dialled, so two
    // clinics sharing an agent number would make that resolution ambiguous.
    const result = await attempt(insertPhone, [
      uuidV7(),
      orgB.organisationId,
      sharedAgentNumber,
      'AGENT_NUMBER',
    ]);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/phone_numbers_agent_e164_unique|duplicate key/i);
  });

  it('allows two organisations to share a CLINIC_LINE number', async () => {
    // The index is partial: only agent numbers are globally constrained. A shared
    // reception number is a legitimate configuration.
    const shared = '+919812340002';

    expect(
      (await attempt(insertPhone, [uuidV7(), orgA.organisationId, shared, 'CLINIC_LINE'])).ok,
    ).toBe(true);
    expect(
      (await attempt(insertPhone, [uuidV7(), orgB.organisationId, shared, 'CLINIC_LINE'])).ok,
    ).toBe(true);
  });
});

describe('users_role_organisation_check', () => {
  const insertUser = `INSERT INTO users (id, organisation_id, email, password_hash, full_name, role, status, created_at, updated_at)
                      VALUES ($1, $2, $3, 'hash', 'Test User', $4::role, 'ACTIVE', now(), now())`;

  it('rejects a platform role that HAS an organisation', async () => {
    const result = await attempt(insertUser, [
      uuidV7(),
      orgA.organisationId,
      `bad.platform.${Date.now()}@test.invalid`,
      'SUPER_ADMIN',
    ]);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/users_role_organisation_check/i);
  });

  it('rejects a clinic role with NO organisation', async () => {
    const result = await attempt(insertUser, [
      uuidV7(),
      null,
      `bad.clinic.${Date.now()}@test.invalid`,
      'DOCTOR',
    ]);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/users_role_organisation_check/i);
  });

  it('accepts a platform role with no organisation', async () => {
    const result = await attempt(insertUser, [
      uuidV7(),
      null,
      `good.platform.${Date.now()}@test.invalid`,
      'INTERNAL_ADMIN',
    ]);

    expect(result.ok).toBe(true);
  });

  it('accepts a clinic role with an organisation', async () => {
    const result = await attempt(insertUser, [
      uuidV7(),
      orgA.organisationId,
      `good.clinic.${Date.now()}@test.invalid`,
      'STAFF',
    ]);

    expect(result.ok).toBe(true);
  });
});

describe('case-insensitive email', () => {
  it('treats differently-cased addresses as the same', async () => {
    const address = `Mixed.Case.${Date.now()}@Test.Invalid`;
    const insertUser = `INSERT INTO users (id, organisation_id, email, password_hash, full_name, role, status, created_at, updated_at)
                        VALUES ($1, $2, $3, 'hash', 'Test User', 'STAFF'::role, 'ACTIVE', now(), now())`;

    expect((await attempt(insertUser, [uuidV7(), orgA.organisationId, address])).ok).toBe(true);

    // citext: the unique index must catch the lower-cased form too, so a second
    // registration cannot shadow the first by changing capitalisation.
    const duplicate = await attempt(insertUser, [
      uuidV7(),
      orgA.organisationId,
      address.toLowerCase(),
    ]);
    expect(duplicate.ok).toBe(false);
    expect(duplicate.message).toMatch(/duplicate key|users_email_key/i);
  });
});

describe('patient name search index', () => {
  it('has a trigram index on patients.full_name', async () => {
    const rows = await ownerClient().$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'patients' AND indexname = 'patients_full_name_trgm'`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.indexdef).toMatch(/gin.*full_name.*gin_trgm_ops/i);
  });

  it('matches a misspelt name, which is why the index exists', async () => {
    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.$queryRawUnsafe<{ full_name: string }[]>(
        `SELECT full_name FROM patients WHERE full_name % $1 AND organisation_id = $2`,
        'Patient ConstraintsA',
        orgA.organisationId,
      ),
    );

    // The voice agent matches a spoken, often misspelt name; similarity search is the
    // reason pg_trgm is enabled at all.
    expect(rows.length).toBeGreaterThan(0);
  });
});
