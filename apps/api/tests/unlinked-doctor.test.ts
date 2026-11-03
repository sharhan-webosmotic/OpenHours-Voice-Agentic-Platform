import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidV7 } from '../src/common/uuid.js';
import type { Principal } from '../src/common/permissions.js';
import * as appointments from '../src/modules/appointments/appointments.service.js';
import * as patients from '../src/modules/patients/patients.service.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * A DOCTOR account that nobody has linked to a doctor row yet.
 *
 * That is a real state: a clinic can create the login before the profile. The matrix gives a
 * doctor `own` scope, so such an account must see NOTHING, and the services apply a filter
 * with an id no row can hold rather than dropping the filter, which would widen it to the
 * whole clinic.
 *
 * A REGRESSION TEST. That id used to be a word, `'no-doctor-profile'`, and PostgreSQL refuses
 * a word as a uuid, so the fail-closed path was a 500 on Patients and on Appointments rather
 * than an empty list. The overview's tests found the same bug in two newer services, and this
 * file covers the two older ones.
 */

let clinic: OrganisationGraph;
let unlinked: Principal;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    clinic = await createOrganisationGraph(tx, 'UnlinkedDoctor');

    const user = await tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: clinic.organisationId,
        email: `unlinked.doctor.${Date.now()}@test.invalid`,
        passwordHash: 'x',
        fullName: 'Unlinked Doctor',
        role: 'DOCTOR',
        status: 'ACTIVE',
      },
    });

    unlinked = { userId: user.id, role: 'DOCTOR', organisationId: clinic.organisationId };
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

describe('a doctor account with no doctor behind it', () => {
  it('sees an empty patient list, not an error', async () => {
    const result = await patients.list(unlinked, undefined, {
      limit: 25,
      sort: 'recent',
      q: undefined,
      cursor: undefined,
    });

    // The fixture clinic has a patient. The doctor sees none of them, and no 500.
    expect(result.items).toEqual([]);
  });

  it('sees an empty appointment list, not an error', async () => {
    const result = await appointments.list(unlinked, undefined, { limit: 25 });

    expect(result.items).toEqual([]);
  });
});
