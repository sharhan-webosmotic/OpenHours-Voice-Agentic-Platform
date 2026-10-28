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
 * The exclusion constraint is the only thing that makes double-booking impossible.
 * A check-then-insert in the service layer cannot: two concurrent bookings both read an
 * empty slot before either writes.
 */

let org: OrganisationGraph;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'Overlap');
  });
}, 120_000);

afterAll(async () => {
  await disconnectAll();
});

const SLOT_START = '2026-12-01T04:00:00.000Z';

const insertAppointment = (
  tx: Parameters<Parameters<ReturnType<typeof appUserClient>['$transaction']>[0]>[0],
  startAt: string,
  endAt: string,
  status: string,
): Promise<number> =>
  tx.$executeRawUnsafe(
    `INSERT INTO appointments
       (id, organisation_id, patient_id, doctor_id, start_at, end_at, status, source, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::appointment_status, 'VOICE_AGENT', now(), now())`,
    uuidV7(),
    org.organisationId,
    org.ids.patients,
    org.ids.doctors,
    startAt,
    endAt,
    status,
  );

describe('appointments_no_overlap', () => {
  it('rejects a second overlapping appointment for the same doctor', async () => {
    await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      insertAppointment(tx, SLOT_START, '2026-12-01T04:30:00.000Z', 'SCHEDULED'),
    );

    const second = await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      insertAppointment(tx, '2026-12-01T04:15:00.000Z', '2026-12-01T04:45:00.000Z', 'SCHEDULED'),
    ).then(
      () => 'accepted' as const,
      () => 'rejected' as const,
    );

    expect(second).toBe('rejected');
  });

  it('allows a back-to-back appointment, because the end instant is exclusive', async () => {
    // '[)' ranges: 05:00-05:30 and 05:30-06:00 do not overlap. Without the exclusive
    // bound every consecutive slot would collide.
    await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      insertAppointment(tx, '2026-12-01T05:00:00.000Z', '2026-12-01T05:30:00.000Z', 'SCHEDULED'),
    );

    const adjacent = await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      insertAppointment(tx, '2026-12-01T05:30:00.000Z', '2026-12-01T06:00:00.000Z', 'SCHEDULED'),
    ).then(
      () => 'accepted' as const,
      () => 'rejected' as const,
    );

    expect(adjacent).toBe('accepted');
  });

  it('frees the slot once an appointment is CANCELLED', async () => {
    await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      insertAppointment(tx, '2026-12-01T07:00:00.000Z', '2026-12-01T07:30:00.000Z', 'CANCELLED'),
    );

    const rebooked = await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      insertAppointment(tx, '2026-12-01T07:00:00.000Z', '2026-12-01T07:30:00.000Z', 'SCHEDULED'),
    ).then(
      () => 'accepted' as const,
      () => 'rejected' as const,
    );

    // The constraint is partial (WHERE status IN ('SCHEDULED','CONFIRMED')), so a
    // cancelled slot must be re-bookable.
    expect(rebooked).toBe('accepted');
  });

  it('two CONCURRENT overlapping inserts leave exactly one winner', async () => {
    const start = '2026-12-02T04:00:00.000Z';
    const end = '2026-12-02T04:30:00.000Z';

    // Both transactions are open at the same time, so neither can see the other's
    // uncommitted row. Only the constraint can decide this.
    const attempt = () =>
      asOrganisation(appUserClient(), org.organisationId, (tx) =>
        insertAppointment(tx, start, end, 'SCHEDULED'),
      ).then(
        () => 'accepted' as const,
        () => 'rejected' as const,
      );

    const results = await Promise.all([attempt(), attempt()]);

    expect(results.filter((r) => r === 'accepted')).toHaveLength(1);
    expect(results.filter((r) => r === 'rejected')).toHaveLength(1);

    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*)::bigint AS count FROM appointments
         WHERE doctor_id = $1 AND start_at = $2::timestamptz AND status = 'SCHEDULED'`,
        org.ids.doctors,
        start,
      ),
    );
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it('does not constrain a different doctor at the same time', async () => {
    const otherDoctorId = uuidV7();
    await asPlatform(ownerClient(), (tx) =>
      tx.doctor.create({
        data: { id: otherDoctorId, organisationId: org.organisationId, fullName: 'Other Doctor' },
      }),
    );

    const result = await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO appointments
           (id, organisation_id, patient_id, doctor_id, start_at, end_at, status, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, '2026-12-01T04:00:00.000Z'::timestamptz, '2026-12-01T04:30:00.000Z'::timestamptz, 'SCHEDULED', 'DASHBOARD', now(), now())`,
        uuidV7(),
        org.organisationId,
        org.ids.patients,
        otherDoctorId,
      ),
    ).then(
      () => 'accepted' as const,
      () => 'rejected' as const,
    );

    expect(result).toBe('accepted');
  });
});
