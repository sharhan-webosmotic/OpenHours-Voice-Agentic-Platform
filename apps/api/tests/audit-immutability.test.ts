import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appUserClient,
  asOrganisation,
  asPlatform,
  disconnectAll,
  ownerClient,
} from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { uuidV7 } from '../src/common/uuid.js';

/**
 * An audit trail the application can rewrite is not evidence. app_user is granted only
 * SELECT and INSERT on audit_logs, so UPDATE and DELETE fail at the database even if a
 * repository tries them.
 */

let org: OrganisationGraph;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'Audit');
  });
}, 120_000);

afterAll(async () => {
  await disconnectAll();
});

describe('audit_logs are append-only for app_user', () => {
  it('allows INSERT', async () => {
    const id = uuidV7();

    await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO audit_logs (id, organisation_id, action, entity_type, metadata, created_at)
         VALUES ($1, $2, 'test.action', 'patient', '{}'::jsonb, now())`,
        id,
        org.organisationId,
      ),
    );

    const rows = await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM audit_logs WHERE id = $1`, id),
    );
    expect(rows).toHaveLength(1);
  });

  it('allows SELECT of its own organisation', async () => {
    const rows = await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM audit_logs`),
    );

    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
  });

  it('refuses UPDATE', async () => {
    const existing = org.ids.audit_logs;

    const result = await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      tx.$executeRawUnsafe(`UPDATE audit_logs SET action = 'tampered' WHERE id = $1`, existing),
    ).then(
      () => 'accepted' as const,
      (error: unknown) => String((error as Error).message),
    );

    expect(result).not.toBe('accepted');
    expect(String(result)).toMatch(/permission denied/i);
  });

  it('refuses DELETE', async () => {
    const existing = org.ids.audit_logs;

    const result = await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      tx.$executeRawUnsafe(`DELETE FROM audit_logs WHERE id = $1`, existing),
    ).then(
      () => 'accepted' as const,
      (error: unknown) => String((error as Error).message),
    );

    expect(result).not.toBe('accepted');
    expect(String(result)).toMatch(/permission denied/i);

    const stillThere = await asPlatform(ownerClient(), (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM audit_logs WHERE id = $1`, existing),
    );
    expect(stillThere).toHaveLength(1);
  });

  it('refuses TRUNCATE', async () => {
    const result = await appUserClient()
      .$executeRawUnsafe(`TRUNCATE audit_logs`)
      .then(
        () => 'accepted' as const,
        () => 'rejected' as const,
      );

    expect(result).toBe('rejected');
  });
});
