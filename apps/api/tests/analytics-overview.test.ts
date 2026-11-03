import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidV7 } from '../src/common/uuid.js';
import { overview, windowFor } from '../src/modules/analytics/analytics.service.js';
import type { Principal } from '../src/common/permissions.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * The overview's figures against rows written for the purpose.
 *
 * WORKED EXAMPLES, NOT READ-BACKS. Every expected number below is stated with the arithmetic
 * that produces it, from rows this file writes. A test that asserted whatever the service
 * returned on its first run would pass for a service that counted wrongly forever.
 *
 * "Now" is fixed at 2026-11-03T06:30Z, which is 12:00 on Tuesday 3 November in Kolkata, so
 * "the last 7 days" is 28 Oct to 3 Nov inclusive and the previous 7 are 21 to 27 Oct.
 */

const NOW = new Date('2026-11-03T06:30:00.000Z');

let clinic: OrganisationGraph;
let other: OrganisationGraph;
let owner: Principal;

/** Kolkata 10:00 on `day`, as UTC. */
const at = (day: string, hour = 10): Date =>
  new Date(`${day}T${String(hour - 5).padStart(2, '0')}:30:00.000Z`);

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    clinic = await createOrganisationGraph(tx, 'Overview');
    other = await createOrganisationGraph(tx, 'OverviewOther');

    /**
     * The fixture's own appointment (created now, by the dashboard) and call (completed,
     * created now) are moved well outside both windows, so every figure below comes only
     * from rows this file writes.
     */
    await tx.appointment.updateMany({
      where: { organisationId: clinic.organisationId },
      data: { createdAt: new Date('2025-01-01T00:00:00.000Z') },
    });
    await tx.call.updateMany({
      where: { organisationId: clinic.organisationId },
      data: { startedAt: new Date('2025-01-01T00:00:00.000Z') },
    });

    // A ₹500 service (50,000 paise), so the revenue arithmetic is checkable by eye.
    await tx.service.update({
      where: { id: clinic.ids.services ?? '' },
      data: { priceMinor: 50_000, durationMinutes: 30 },
    });

    const appointment = (
      createdAt: Date,
      source: 'VOICE_AGENT' | 'DASHBOARD',
      status: 'SCHEDULED' | 'CONFIRMED',
      startAt: Date,
    ) =>
      tx.appointment.create({
        data: {
          id: uuidV7(),
          organisationId: clinic.organisationId,
          patientId: clinic.ids.patients ?? '',
          doctorId: clinic.ids.doctors ?? '',
          serviceId: clinic.ids.services ?? '',
          startAt,
          endAt: new Date(startAt.getTime() + 30 * 60_000),
          status,
          source,
          createdAt,
        },
      });

    // Distinct start times, spaced, so the exclusion constraint never sees an overlap.
    const slot = (index: number): Date => new Date(Date.UTC(2026, 11, 1 + index, 4, 0));

    // THIS WEEK: three AI bookings (28 Oct, 1 Nov, 3 Nov) and one dashboard booking.
    await appointment(at('2026-10-28'), 'VOICE_AGENT', 'CONFIRMED', slot(0));
    await appointment(at('2026-11-01'), 'VOICE_AGENT', 'SCHEDULED', slot(1));
    await appointment(at('2026-11-03', 9), 'VOICE_AGENT', 'SCHEDULED', slot(2));
    await appointment(at('2026-11-02'), 'DASHBOARD', 'CONFIRMED', slot(3));
    // LAST WEEK: one AI booking (22 Oct).
    await appointment(at('2026-10-22'), 'VOICE_AGENT', 'CONFIRMED', slot(4));

    const call = (
      startedAt: Date,
      status: 'COMPLETED' | 'MISSED' | 'FAILED',
      outcome: 'NONE' | 'BOOKED' = 'NONE',
    ) =>
      tx.call.create({
        data: {
          id: uuidV7(),
          organisationId: clinic.organisationId,
          externalCallId: `20261103/overview_${uuidV7()}`,
          direction: 'INBOUND',
          status,
          outcome,
          fromE164: '+919812300001',
          toE164: '+918000000001',
          startedAt,
        },
      });

    // THIS WEEK: four answered (two on 3 Nov), one missed, one failed.
    await call(at('2026-10-29'), 'COMPLETED', 'BOOKED');
    await call(at('2026-11-02'), 'COMPLETED');
    await call(at('2026-11-03', 9), 'COMPLETED');
    await call(at('2026-11-03', 11), 'COMPLETED', 'BOOKED');
    await call(at('2026-10-30'), 'MISSED');
    await call(at('2026-11-01'), 'FAILED');
    // LAST WEEK: two answered, three missed.
    await call(at('2026-10-23'), 'COMPLETED');
    await call(at('2026-10-24'), 'COMPLETED');
    await call(at('2026-10-25'), 'MISSED');
    await call(at('2026-10-25', 12), 'MISSED');
    await call(at('2026-10-26'), 'MISSED');

    // Another clinic's busy week, which must contribute nothing to ours.
    for (let index = 0; index < 5; index += 1) {
      await tx.call.create({
        data: {
          id: uuidV7(),
          organisationId: other.organisationId,
          externalCallId: `20261103/other_${uuidV7()}`,
          direction: 'INBOUND',
          status: 'COMPLETED',
          fromE164: '+919812300002',
          toE164: '+918000000002',
          startedAt: at('2026-11-02'),
        },
      });
    }

    const ownerRow = await tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: clinic.organisationId,
        email: `overview.owner.${Date.now()}@test.invalid`,
        passwordHash: 'x',
        fullName: 'Overview Owner',
        role: 'CLINIC_OWNER',
        status: 'ACTIVE',
      },
    });

    owner = { userId: ownerRow.id, role: 'CLINIC_OWNER', organisationId: clinic.organisationId };
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

describe('the window', () => {
  it('is seven clinic days ending today, and the seven before', () => {
    const window = windowFor('7d', NOW, 'Asia/Kolkata');

    expect(window.days).toEqual([
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
    // Kolkata midnight on 28 Oct is 18:30 UTC on the 27th.
    expect(window.from.toISOString()).toBe('2026-10-27T18:30:00.000Z');
    expect(window.previousFrom.toISOString()).toBe('2026-10-20T18:30:00.000Z');
  });

  it('compares this month with the same number of days at the start of last month', () => {
    const window = windowFor('month', NOW, 'Asia/Kolkata');

    // Three days of November against three of October, not against all thirty-one: a
    // partial month against a whole one would make every month look like a collapse.
    expect(window.days).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(window.previousFrom.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(window.previousTo.toISOString()).toBe('2026-10-03T18:30:00.000Z');
  });
});

describe('the overview, last 7 days', () => {
  it('counts calls answered against last week', async () => {
    const result = await overview(owner, undefined, '7d', NOW);

    // This week: 29 Oct, 2 Nov, 3 Nov at 09:00 and 11:00 = 4. Last week: 23 and 24 Oct = 2.
    // The other clinic's five are not here.
    expect(result.kpis.callsAnswered).toEqual({ value: 4, previous: 2 });
  });

  it('counts AI bookings by when they were made, and not dashboard ones', async () => {
    const result = await overview(owner, undefined, '7d', NOW);

    // 28 Oct, 1 Nov, 3 Nov = 3; the dashboard booking on 2 Nov is not the agent's. Last week:
    // 22 Oct = 1.
    expect(result.kpis.aiBookings).toEqual({ value: 3, previous: 1 });
  });

  it('counts the unanswered calls as needing attention', async () => {
    const result = await overview(owner, undefined, '7d', NOW);

    // This week: missed 30 Oct, failed 1 Nov = 2. Last week: three missed = 3.
    expect(result.kpis.needsAttention).toEqual({ value: 2, previous: 3 });
  });

  it('counts requests still awaiting confirmation, and those that arrived today', async () => {
    const result = await overview(owner, undefined, '7d', NOW);

    // SCHEDULED and upcoming: the 1 Nov and 3 Nov bookings = 2, of which 3 Nov is today = 1.
    // The fixture's own appointment is in the past and does not count.
    expect(result.kpis.bookingRequests).toEqual({ value: 2, today: 1 });
  });

  it('estimates revenue from the listed price of what the agent booked', async () => {
    const result = await overview(owner, undefined, '7d', NOW);

    // Three AI bookings at ₹500 = ₹1,500 = 150,000 paise. Last week one = 50,000.
    expect(result.revenue.valueMinor).toBe(150_000);
    expect(result.revenue.previousMinor).toBe(50_000);
    expect(result.revenue.series).toHaveLength(12);
    expect(result.revenue.series.reduce((sum, slice) => sum + slice, 0)).toBe(150_000);
  });

  it('draws each day in the clinic’s calendar', async () => {
    const result = await overview(owner, undefined, '7d', NOW);
    const today = result.daily.find((row) => row.day === '2026-11-03');

    expect(result.daily).toHaveLength(7);
    // Two answered calls today (09:00 and 11:00 IST) and one AI booking.
    expect(today).toMatchObject({ callsAnswered: 2, aiBookings: 1 });
  });

  it('reports outcomes as recorded, including the ones nobody classified', async () => {
    const result = await overview(owner, undefined, '7d', NOW);

    // This week's six calls: two BOOKED, four with no outcome recorded.
    expect(result.outcomes.BOOKED).toBe(2);
    expect(result.outcomes.NONE).toBe(4);
  });

  it('reports the agent and when it last took a call', async () => {
    const result = await overview(owner, undefined, '7d', NOW);

    expect(result.agent.status).toBe('ACTIVE');
    expect(result.agent.lastCallAt).not.toBeNull();
    expect(result.currency).toBe('INR');
  });
});

describe('a doctor reads only their own', () => {
  it('sees nothing when their account is not linked to a doctor', async () => {
    const doctor: Principal = {
      userId: uuidV7(),
      role: 'DOCTOR',
      organisationId: clinic.organisationId,
    };

    const result = await overview(doctor, undefined, '7d', NOW);

    /**
     * NOTHING, rather than the clinic. `own` with no doctor row behind it would otherwise be
     * an undefined filter, which is a widening to `all` by accident.
     */
    expect(result.kpis.callsAnswered.value).toBe(0);
    expect(result.kpis.aiBookings.value).toBe(0);
  });
});
