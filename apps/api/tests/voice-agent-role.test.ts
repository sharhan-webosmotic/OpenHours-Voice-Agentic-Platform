import { afterAll, describe, expect, it } from 'vitest';
import { ROLES, USER_ROLES } from '@clinicai/shared';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';

/**
 * The voice agent is a principal in the permission matrix and NOT a person.
 *
 * The matrix, the token verifier and the two front ends each enforce part of that in their
 * own test. This file holds the part only PostgreSQL can state: the column that stores a
 * user's role has no such value, so no API path, no seed, no migration and no hand-written
 * SQL can create a user who is the voice agent. That is a stronger guarantee than any
 * check in the application, and it is why the enum was left at six.
 */

afterAll(async () => {
  await disconnectAll();
});

const enumValues = async (name: string): Promise<readonly string[]> =>
  asPlatform(ownerClient(), async (tx) => {
    const rows = await tx.$queryRawUnsafe<readonly { readonly value: string }[]>(
      `SELECT e.enumlabel AS value
         FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = $1
        ORDER BY e.enumsortorder`,
      name,
    );

    return rows.map((row) => row.value);
  });

describe('the database role enum', () => {
  it('holds exactly the roles a user may have, and not the voice agent', async () => {
    const values = await enumValues('role');

    expect(values).toEqual([...USER_ROLES]);
    expect(values).not.toContain('VOICE_AGENT');
    // Stated as a relationship rather than as the number six, so adding a seventh user
    // role fails here only if it was not added to the enum as well.
    expect(values).toHaveLength(ROLES.length - 1);
  });

  it("refuses a user row claiming the agent's role", async () => {
    const failed = await asPlatform(ownerClient(), (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO users (id, organisation_id, email, password_hash, full_name, role, status,
                            must_change_password, created_at, updated_at)
         VALUES (gen_random_uuid(), NULL, 'agent@example.test', 'x', 'Agent', 'VOICE_AGENT'::role,
                 'ACTIVE', false, now(), now())`,
      ),
    ).then(
      () => false,
      () => true,
    );

    // The cast itself is what fails: there is no such label in the type. A test that only
    // asserted the enum's contents would not prove that the column refuses the write.
    expect(failed).toBe(true);
  });
});
