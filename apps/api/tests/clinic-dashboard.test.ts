import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody, problemBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { bookableStart, markHoursCollected, nextBookableStart } from './support/clinic-schedule.js';

/**
 * The patient and appointment endpoints, driven through the whole middleware chain.
 *
 * WHAT THIS FILE IS FOR, AND WHAT IT IS NOT. The slot engine's rules are tested from worked
 * examples in `src/modules/availability/availability.engine.test.ts`, where they belong: it
 * is a pure function and asserting its arithmetic through HTTP would be slower and would say
 * less. What can only be tested here is everything the database and the middleware do:
 * concurrency, tenancy, idempotency, masking, and the refusals a status machine produces.
 *
 * TWO ORGANISATIONS ARE CREATED, because half the assertions in here are about the second
 * one being invisible. A single-tenant fixture cannot fail a tenancy test.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let clinic: OrganisationGraph;
let other: OrganisationGraph;

let ownerEmail: string;
let doctorEmail: string;
let otherOwnerEmail: string;
let superAdminEmail: string;

/** The doctor row the DOCTOR-role login is linked to, for the `own` scope assertions. */
let linkedDoctorId: string;
/** A patient the linked doctor has never seen, which the `own` scope must hide. */
let strangerPatientId: string;
/**
 * A second doctor, used only by the tests that need an EMPTY day.
 *
 * The fixture's doctor fills up: every booking in this file takes another 30 minutes of the
 * same Monday, so by the time the reschedule tests run, the slot next to any given booking is
 * usually taken by an earlier test. A refusal would then be correct and would say nothing
 * about the rule under test. A doctor nobody else books gives those tests a clean day.
 */
let quietDoctorId: string;

const createUser = async (
  tx: Parameters<Parameters<typeof asPlatform>[1]>[0],
  options: {
    readonly organisationId: string | null;
    readonly role: 'CLINIC_OWNER' | 'DOCTOR' | 'SUPER_ADMIN';
    readonly label: string;
    readonly passwordHash: string;
  },
): Promise<{ readonly id: string; readonly email: string }> => {
  const id = uuidV7();
  const email = `dashboard.${options.label}.${Date.now()}.${id.slice(-6)}@test.invalid`;

  await tx.user.create({
    data: {
      id,
      organisationId: options.organisationId,
      email,
      passwordHash: options.passwordHash,
      fullName: `Dashboard ${options.label}`,
      role: options.role,
      status: 'ACTIVE',
    },
  });

  return { id, email };
};

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), async (tx) => {
    clinic = await createOrganisationGraph(tx, 'Dashboard');
    other = await createOrganisationGraph(tx, 'DashboardOther');

    await markHoursCollected(tx, clinic.organisationId);
    await markHoursCollected(tx, other.organisationId);

    ownerEmail = (
      await createUser(tx, {
        organisationId: clinic.organisationId,
        role: 'CLINIC_OWNER',
        label: 'owner',
        passwordHash,
      })
    ).email;

    const doctorUser = await createUser(tx, {
      organisationId: clinic.organisationId,
      role: 'DOCTOR',
      label: 'doctor',
      passwordHash,
    });
    doctorEmail = doctorUser.email;

    /**
     * The DOCTOR login is linked to the fixture's doctor row.
     *
     * Without the link the `own` scope resolves to no doctor profile and the user sees
     * nothing, which is the fail-closed case and is asserted separately. Here the link exists,
     * so what is being tested is the filter rather than the fallback.
     */
    linkedDoctorId = clinic.ids.doctors ?? '';
    await tx.doctor.update({ where: { id: linkedDoctorId }, data: { userId: doctorUser.id } });

    otherOwnerEmail = (
      await createUser(tx, {
        organisationId: other.organisationId,
        role: 'CLINIC_OWNER',
        label: 'other-owner',
        passwordHash,
      })
    ).email;

    superAdminEmail = (
      await createUser(tx, {
        organisationId: null,
        role: 'SUPER_ADMIN',
        label: 'super',
        passwordHash,
      })
    ).email;

    quietDoctorId = uuidV7();
    await tx.doctor.create({
      data: { id: quietDoctorId, organisationId: clinic.organisationId, fullName: 'Quiet Doctor' },
    });
    await tx.doctorWorkingHours.create({
      data: {
        id: uuidV7(),
        organisationId: clinic.organisationId,
        doctorId: quietDoctorId,
        weekday: 'MONDAY',
        startAtMinute: 9 * 60,
        endAtMinute: 17 * 60,
      },
    });
    await tx.doctorService.create({
      data: {
        id: uuidV7(),
        organisationId: clinic.organisationId,
        doctorId: quietDoctorId,
        serviceId: clinic.ids.services ?? '',
      },
    });

    // A patient with no appointments, so the doctor's `own` scope has something to exclude.
    strangerPatientId = uuidV7();
    await tx.patient.create({
      data: {
        id: strangerPatientId,
        organisationId: clinic.organisationId,
        fullName: 'Unseen Patient',
        phone: `+9166${String(Date.now()).slice(-8)}`,
      },
    });
  });
}, 240_000);

afterAll(async () => {
  await disconnectAll();
});

const tokenFor = async (email: string): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });

  expect(response.status).toBe(200);
  return jsonBody<{ accessToken: string }>(response).accessToken;
};

type Booking = { readonly appointmentId: string; readonly startAt: string; readonly endAt: string };

const book = async (
  token: string,
  options: {
    readonly startAt?: string;
    readonly idempotencyKey?: string;
    readonly doctorId?: string;
  } = {},
): Promise<{ readonly status: number; readonly body: unknown }> => {
  const builder = request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`);

  if (options.idempotencyKey !== undefined) {
    builder.set('Idempotency-Key', options.idempotencyKey);
  }

  const response = await builder.send({
    patientId: clinic.ids.patients,
    doctorId: options.doctorId ?? clinic.ids.doctors,
    serviceId: clinic.ids.services,
    startAt: options.startAt ?? nextBookableStart(),
  });

  return { status: response.status, body: response.body };
};

describe('booking an appointment', () => {
  it('books a slot the availability endpoint offered, and then stops offering it', async () => {
    const token = await tokenFor(ownerEmail);
    const startAt = nextBookableStart();
    const date = startAt.slice(0, 10);

    const before = await request(app)
      .get(
        `/api/v1/appointments/availability?doctorId=${clinic.ids.doctors ?? ''}&serviceId=${clinic.ids.services ?? ''}&date=${date}`,
      )
      .set('Authorization', `Bearer ${token}`);

    expect(before.status).toBe(200);
    expect(
      jsonBody<{ slots: readonly { startAt: string }[] }>(before).slots.map((slot) => slot.startAt),
    ).toContain(startAt);

    const created = await book(token, { startAt });
    expect(created.status).toBe(201);

    const after = await request(app)
      .get(
        `/api/v1/appointments/availability?doctorId=${clinic.ids.doctors ?? ''}&serviceId=${clinic.ids.services ?? ''}&date=${date}`,
      )
      .set('Authorization', `Bearer ${token}`);

    // The engine and the database now agree: the slot is gone from the offer.
    expect(
      jsonBody<{ slots: readonly { startAt: string }[] }>(after).slots.map((slot) => slot.startAt),
    ).not.toContain(startAt);
  }, 120_000);

  it('refuses a time outside the clinic hours with a reason a person can read', async () => {
    const token = await tokenFor(ownerEmail);
    // 03:00 Kolkata on the same Monday: the clinic opens at 09:00.
    const startAt = nextBookableStart();
    const midnightish = `${startAt.slice(0, 10)}T20:00:00.000Z`;

    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: clinic.ids.patients,
        doctorId: clinic.ids.doctors,
        serviceId: clinic.ids.services,
        startAt: midnightish,
      });

    expect(response.status).toBe(409);
    // The message is read out by the voice agent in M3, so it says what is wrong in words.
    expect(problemBody(response).detail).toMatch(/available|closed|opening/i);
  }, 120_000);

  /**
   * THE CONCURRENCY TEST THE FEATURE BRIEF ASKS FOR.
   *
   * Two bookings for one slot, sent together. One must win, the other must be told the slot
   * was taken, and NEITHER may produce a 500. The engine's check cannot deliver this on its
   * own: both requests read the slot as free before either wrote, which is precisely why the
   * `appointments_no_overlap` exclusion constraint exists and why the service recognises its
   * SQLSTATE rather than letting it surface as an unhandled driver error.
   */
  it('lets exactly one of two simultaneous bookings win, and never answers 500', async () => {
    const token = await tokenFor(ownerEmail);
    const startAt = nextBookableStart();

    const [first, second] = await Promise.all([book(token, { startAt }), book(token, { startAt })]);

    const statuses = [first.status, second.status].toSorted((a, b) => a - b);

    expect(statuses).toEqual([201, 409]);
    expect(statuses).not.toContain(500);

    /**
     * EITHER REFUSAL IS CORRECT, and the test says which two it will accept rather than
     * pinning the one it happened to see.
     *
     * If the second request's slot check runs after the first has committed, the engine
     * refuses it: "that time is no longer available". If the two interleave past the check,
     * the exclusion constraint refuses the insert and the service says "that time was just
     * taken". Both are a 409 with a sentence a receptionist can act on, and which one a given
     * run produces is a matter of commit timing. What must never happen is a 500, and that is
     * asserted above.
     */
    const loser = first.status === 409 ? first : second;
    expect((loser.body as { detail?: string }).detail).toMatch(/just taken|no longer available/);
  }, 120_000);

  it('survives five simultaneous bookings for one slot with one winner', async () => {
    // Five rather than two, because a two-way race can be won by luck in a connection pool
    // while a wider one exercises the constraint repeatedly within one transaction window.
    const token = await tokenFor(ownerEmail);
    const startAt = nextBookableStart();

    const results = await Promise.all(Array.from({ length: 5 }, () => book(token, { startAt })));

    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(4);
    expect(results.filter((result) => result.status >= 500)).toHaveLength(0);
  }, 120_000);

  it('returns the original booking when an Idempotency-Key is replayed', async () => {
    const token = await tokenFor(ownerEmail);
    const startAt = nextBookableStart();
    const key = `dashboard-test-${uuidV7()}`;

    const first = await book(token, { startAt, idempotencyKey: key });
    const replay = await book(token, { startAt, idempotencyKey: key });

    expect(first.status).toBe(201);
    // 200, not 201: the booking already existed, and the client can tell the difference.
    expect(replay.status).toBe(200);
    expect((replay.body as Booking).appointmentId).toBe((first.body as Booking).appointmentId);
    expect((replay.body as { replayed: boolean }).replayed).toBe(true);
  }, 120_000);

  it('refuses an Idempotency-Key that is not printable text', async () => {
    const token = await tokenFor(ownerEmail);
    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'x'.repeat(300))
      .send({
        patientId: clinic.ids.patients,
        doctorId: clinic.ids.doctors,
        serviceId: clinic.ids.services,
        startAt: nextBookableStart(),
      });

    expect(response.status).toBe(400);
  }, 120_000);
});

describe('the appointment status machine', () => {
  const bookOne = async (token: string): Promise<string> => {
    const created = await book(token);
    expect(created.status).toBe(201);
    return (created.body as Booking).appointmentId;
  };

  it('allows SCHEDULED to CONFIRMED and then CONFIRMED to COMPLETED', async () => {
    const token = await tokenFor(ownerEmail);
    const id = await bookOne(token);

    const confirm = await request(app)
      .post(`/api/v1/appointments/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CONFIRMED' });
    expect(confirm.status).toBe(204);

    const complete = await request(app)
      .post(`/api/v1/appointments/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' });
    expect(complete.status).toBe(204);
  }, 120_000);

  it('refuses every move out of a terminal status', async () => {
    const token = await tokenFor(ownerEmail);

    for (const terminal of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
      const id = await bookOne(token);

      const reach = await request(app)
        .post(`/api/v1/appointments/${id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: terminal });
      expect(reach.status).toBe(204);

      for (const next of ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
        const response = await request(app)
          .post(`/api/v1/appointments/${id}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: next });

        // 409, never 204 and never 500: the appointment's history is a record, not a draft.
        expect({ terminal, next, status: response.status }).toEqual({
          terminal,
          next,
          status: 409,
        });
      }
    }
  }, 240_000);

  it('refuses to un-confirm, because a reminder would then go out twice', async () => {
    const token = await tokenFor(ownerEmail);
    const id = await bookOne(token);

    await request(app)
      .post(`/api/v1/appointments/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CONFIRMED' });

    const back = await request(app)
      .post(`/api/v1/appointments/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SCHEDULED' });

    expect(back.status).toBe(409);
  }, 120_000);

  it('cannot cancel an appointment twice', async () => {
    const token = await tokenFor(ownerEmail);
    const id = await bookOne(token);

    const first = await request(app)
      .post(`/api/v1/appointments/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Patient called.' });
    const second = await request(app)
      .post(`/api/v1/appointments/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Patient called again.' });

    expect(first.status).toBe(204);
    expect(second.status).toBe(409);
  }, 120_000);

  it('frees the slot again when an appointment is cancelled', async () => {
    const token = await tokenFor(ownerEmail);
    const startAt = nextBookableStart();

    const created = await book(token, { startAt });
    expect(created.status).toBe(201);

    await request(app)
      .post(`/api/v1/appointments/${(created.body as Booking).appointmentId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Freed for the next patient.' });

    // The constraint only covers SCHEDULED and CONFIRMED, so the same time books again.
    const again = await book(token, { startAt });
    expect(again.status).toBe(201);
  }, 120_000);
});

describe('rescheduling', () => {
  it('writes a new appointment, cancels the old one, and links the two', async () => {
    const token = await tokenFor(ownerEmail);
    const original = await book(token);
    expect(original.status).toBe(201);
    const originalId = (original.body as Booking).appointmentId;

    const movedTo = nextBookableStart();
    const response = await request(app)
      .post(`/api/v1/appointments/${originalId}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: movedTo, reason: 'Patient asked to move it.' });

    expect(response.status).toBe(201);
    const newId = jsonBody<Booking>(response).appointmentId;
    expect(newId).not.toBe(originalId);

    const old = await request(app)
      .get(`/api/v1/appointments/${originalId}`)
      .set('Authorization', `Bearer ${token}`);
    const fresh = await request(app)
      .get(`/api/v1/appointments/${newId}`)
      .set('Authorization', `Bearer ${token}`);

    // The history is the point: the old row stays, cancelled, and the new one names it.
    expect(jsonBody<{ status: string }>(old).status).toBe('CANCELLED');
    expect(jsonBody<{ startAt: string; rescheduledFromId: string }>(fresh)).toMatchObject({
      startAt: movedTo,
      rescheduledFromId: originalId,
    });
  }, 120_000);

  it('can move an appointment to a time that overlaps its own current slot', async () => {
    /**
     * Moving 09:00 to 09:15 is an ordinary request, and it only works because the engine is
     * asked to ignore the appointment being moved. Without that exclusion the appointment
     * would block its own new time and the clinic would be told the slot was taken by itself.
     */
    const token = await tokenFor(ownerEmail);
    /**
     * The FIRST slot of the day, 09:00, not the next one off the shared counter.
     *
     * The counter walks towards closing time, and the run that caught this had reached 16:30,
     * where moving fifteen minutes later means finishing at 17:15 and the clinic shuts at
     * 17:00. The engine was right to refuse it. Nobody else books the quiet doctor, so 09:00
     * is always free for them and the test asserts the rule it means to.
     */
    const startAt = bookableStart(0);
    const created = await book(token, { startAt, doctorId: quietDoctorId });
    expect(created.status).toBe(201);

    const fifteenLater = new Date(new Date(startAt).getTime() + 15 * 60_000).toISOString();
    const response = await request(app)
      .post(`/api/v1/appointments/${(created.body as Booking).appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: fifteenLater, reason: '' });

    expect(response.status).toBe(201);
  }, 120_000);

  it('refuses to reschedule an appointment that is no longer active', async () => {
    const token = await tokenFor(ownerEmail);
    const created = await book(token);
    const id = (created.body as Booking).appointmentId;

    await request(app)
      .post(`/api/v1/appointments/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Cancelled first.' });

    const response = await request(app)
      .post(`/api/v1/appointments/${id}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: nextBookableStart(), reason: '' });

    expect(response.status).toBe(409);
  }, 120_000);
});

describe('tenancy', () => {
  it('answers 404, not 403, for another clinic patient', async () => {
    const token = await tokenFor(ownerEmail);

    const response = await request(app)
      .get(`/api/v1/patients/${other.ids.patients ?? ''}`)
      .set('Authorization', `Bearer ${token}`);

    // 404 and not 403: a 403 would confirm that the id exists (root CLAUDE.md rule 7).
    expect(response.status).toBe(404);
  }, 120_000);

  it('answers 404 for another clinic appointment', async () => {
    const token = await tokenFor(ownerEmail);

    const response = await request(app)
      .get(`/api/v1/appointments/${other.ids.appointments ?? ''}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  }, 120_000);

  it('answers 404 when a clinic user names another clinic explicitly', async () => {
    const token = await tokenFor(ownerEmail);

    const response = await request(app)
      .get(`/api/v1/patients?organisationId=${other.organisationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  }, 120_000);

  it('never returns another clinic patient in a list, even when searching for them', async () => {
    const token = await tokenFor(ownerEmail);

    const response = await request(app)
      .get('/api/v1/patients?q=Patient')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const ids = jsonBody<{ items: readonly { id: string }[] }>(response).items.map(
      (item) => item.id,
    );

    expect(ids).not.toContain(other.ids.patients);
  }, 120_000);

  it('refuses to book into another clinic by naming its patient', async () => {
    const token = await tokenFor(otherOwnerEmail);

    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        // The other clinic's owner, with THIS clinic's ids: every one of them is invisible.
        patientId: clinic.ids.patients,
        doctorId: clinic.ids.doctors,
        serviceId: clinic.ids.services,
        startAt: nextBookableStart(),
      });

    expect(response.status).toBe(404);
  }, 120_000);
});

describe('the doctor scope', () => {
  it('shows a doctor only the patients they have seen', async () => {
    const token = await tokenFor(doctorEmail);

    const response = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const ids = jsonBody<{ items: readonly { id: string }[] }>(response).items.map(
      (item) => item.id,
    );

    // The fixture patient has an appointment with this doctor; the stranger has none.
    expect(ids).toContain(clinic.ids.patients);
    expect(ids).not.toContain(strangerPatientId);
  }, 120_000);

  it('answers 404 for a patient in their own clinic they have never seen', async () => {
    const token = await tokenFor(doctorEmail);

    const response = await request(app)
      .get(`/api/v1/patients/${strangerPatientId}`)
      .set('Authorization', `Bearer ${token}`);

    // Not 403: a doctor must not be able to enumerate their clinic's patients by reading
    // which ids answer differently.
    expect(response.status).toBe(404);
  }, 120_000);
});

describe('platform roles', () => {
  it('reads a patient with the identifying fields nulled', async () => {
    const token = await tokenFor(superAdminEmail);

    const response = await request(app)
      .get(`/api/v1/patients/${clinic.ids.patients ?? ''}?organisationId=${clinic.organisationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const patient = jsonBody<{
      id: string;
      fullName: string | null;
      phone: string | null;
      notes: string | null;
    }>(response);

    // The row is readable, so a platform admin can see that the record exists and diagnose a
    // booking problem. Who it is for is not part of that.
    expect(patient.id).toBe(clinic.ids.patients);
    expect(patient.fullName).toBeNull();
    expect(patient.phone).toBeNull();
    expect(patient.notes).toBeNull();
  }, 120_000);

  it('must name the clinic it is asking about', async () => {
    const token = await tokenFor(superAdminEmail);

    const response = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`);

    // 400 rather than every clinic's patients in one response: `asSystem` applies no
    // organisation filter, so "no clinic named" must never mean "no filter".
    expect(response.status).toBe(400);
  }, 120_000);

  /**
   * THE CROSS-TENANT CASES FOR THE PLATFORM PATH SPECIFICALLY.
   *
   * The clinic path has two locks: the extension injects the organisation and row-level
   * security refuses whatever slips past. The platform path runs with
   * `app.platform = 'on'`, which switches the second lock off, so the extension is the only
   * thing between a masked read of one clinic and a masked read of all of them. These assert
   * it directly rather than relying on the clinic-path tests above, which prove a different
   * mechanism.
   */
  it('scoped to one clinic, cannot read another clinic patient by id', async () => {
    const token = await tokenFor(superAdminEmail);

    const response = await request(app)
      .get(`/api/v1/patients/${other.ids.patients ?? ''}?organisationId=${clinic.organisationId}`)
      .set('Authorization', `Bearer ${token}`);

    // The id exists, and the answer is still 404: the scope names the other clinic, so the
    // row is simply not there to be found.
    expect(response.status).toBe(404);
  }, 120_000);

  it('scoped to one clinic, lists that clinic patients and no others', async () => {
    const token = await tokenFor(superAdminEmail);

    const response = await request(app)
      .get(`/api/v1/patients?organisationId=${clinic.organisationId}&limit=100`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const ids = jsonBody<{ items: readonly { id: string }[] }>(response).items.map(
      (item) => item.id,
    );

    expect(ids).toContain(clinic.ids.patients);
    expect(ids).not.toContain(other.ids.patients);
  }, 120_000);

  it('scoped to one clinic, cannot read another clinic appointment by id', async () => {
    const token = await tokenFor(superAdminEmail);

    const response = await request(app)
      .get(
        `/api/v1/appointments/${other.ids.appointments ?? ''}?organisationId=${clinic.organisationId}`,
      )
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  }, 120_000);

  it('scoped to one clinic, sees no other clinic appointment in a list or an agenda', async () => {
    const token = await tokenFor(superAdminEmail);

    const list = await request(app)
      .get(`/api/v1/appointments?organisationId=${clinic.organisationId}&limit=100`)
      .set('Authorization', `Bearer ${token}`);
    const agenda = await request(app)
      .get(
        `/api/v1/appointments/agenda?range=month&on=2026-11-02&organisationId=${clinic.organisationId}`,
      )
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(agenda.status).toBe(200);

    const listed = jsonBody<{ items: readonly { id: string }[] }>(list).items.map(
      (item) => item.id,
    );
    const scheduled = jsonBody<{ appointments: readonly { id: string }[] }>(
      agenda,
    ).appointments.map((item) => item.id);

    expect(listed).not.toContain(other.ids.appointments);
    expect(scheduled).not.toContain(other.ids.appointments);
  }, 120_000);

  it('reads the clinic it names, so the confinement is a scope and not a refusal', async () => {
    // Without this, every assertion above would pass against an endpoint that returned
    // nothing to anybody, which is isolation by breakage rather than by scope.
    const token = await tokenFor(superAdminEmail);

    const response = await request(app)
      .get(`/api/v1/patients?organisationId=${other.organisationId}&limit=100`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(
      jsonBody<{ items: readonly { id: string }[] }>(response).items.map((item) => item.id),
    ).toContain(other.ids.patients);
  }, 120_000);

  it('cannot write, however the request is shaped', async () => {
    const token = await tokenFor(superAdminEmail);

    const response = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Should Not Exist',
        phone: '+919000000001',
        dateOfBirth: '',
        notes: '',
      });

    // 403 from the matrix, and specifically not the 400 that a missing organisation would
    // produce: the refusal must not read as "you forgot a parameter".
    expect(response.status).toBe(403);
  }, 120_000);
});

describe('the agenda', () => {
  it('counts by status over a week and returns the appointments in it', async () => {
    const token = await tokenFor(ownerEmail);
    const startAt = nextBookableStart();
    const created = await book(token, { startAt });
    expect(created.status).toBe(201);

    const response = await request(app)
      .get(`/api/v1/appointments/agenda?range=week&on=${startAt.slice(0, 10)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const agenda = jsonBody<{
      range: string;
      timeZone: string;
      counts: Record<string, number>;
      appointments: readonly { id: string }[];
    }>(response);

    expect(agenda.range).toBe('week');
    expect(agenda.timeZone).toBe('Asia/Kolkata');
    expect(agenda.counts.SCHEDULED).toBeGreaterThan(0);
    expect(agenda.appointments.map((item) => item.id)).toContain(
      (created.body as Booking).appointmentId,
    );
  }, 120_000);

  it('bounds a day to the clinic calendar, not the UTC one', async () => {
    const token = await tokenFor(ownerEmail);

    const response = await request(app)
      .get('/api/v1/appointments/agenda?range=day&on=2026-11-02')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const agenda = jsonBody<{ from: string; to: string }>(response);

    // Asia/Kolkata is UTC+05:30, so a clinic day runs 18:30 to 18:30 in UTC.
    expect(agenda.from).toBe('2026-11-01T18:30:00.000Z');
    expect(agenda.to).toBe('2026-11-02T18:30:00.000Z');
  }, 120_000);
});

describe('patients', () => {
  it('stores a typed phone number in E.164 and reads it back', async () => {
    const token = await tokenFor(ownerEmail);
    const local = `98765${String(Date.now()).slice(-5)}`;

    const created = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'E164 Test Patient', phone: local, dateOfBirth: '', notes: '' });

    expect(created.status).toBe(201);
    const { patientId } = jsonBody<{ patientId: string }>(created);

    const read = await request(app)
      .get(`/api/v1/patients/${patientId}`)
      .set('Authorization', `Bearer ${token}`);

    // +91 is the default country code, applied by the shared helper rather than here.
    expect(jsonBody<{ phone: string }>(read).phone).toBe(`+91${local}`);
  }, 120_000);

  it('keeps a date of birth on the day it was entered', async () => {
    const token = await tokenFor(ownerEmail);

    const created = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Birthday Test Patient',
        phone: `+9195${String(Date.now()).slice(-8)}`,
        dateOfBirth: '1988-06-14',
        notes: '',
      });

    const read = await request(app)
      .get(`/api/v1/patients/${jsonBody<{ patientId: string }>(created).patientId}`)
      .set('Authorization', `Bearer ${token}`);

    // Not the 13th and not the 15th: a date of birth is a calendar day with no zone, and
    // this is the assertion that fails if it is ever stored as an instant.
    expect(jsonBody<{ dateOfBirth: string }>(read).dateOfBirth).toBe('1988-06-14');
  }, 120_000);

  it('clears a field when it is sent empty and leaves absent fields alone', async () => {
    const token = await tokenFor(ownerEmail);

    const created = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Notes Test Patient',
        phone: `+9194${String(Date.now()).slice(-8)}`,
        dateOfBirth: '1990-01-01',
        notes: 'Prefers morning appointments.',
      });
    const { patientId } = jsonBody<{ patientId: string }>(created);

    await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: '' });

    const read = await request(app)
      .get(`/api/v1/patients/${patientId}`)
      .set('Authorization', `Bearer ${token}`);
    const patient = jsonBody<{ notes: string | null; dateOfBirth: string | null }>(read);

    expect(patient.notes).toBeNull();
    // The date of birth was not in the patch, so it is untouched.
    expect(patient.dateOfBirth).toBe('1990-01-01');
  }, 120_000);

  it('finds a patient by part of their phone number', async () => {
    const token = await tokenFor(ownerEmail);
    const local = `98700${String(Date.now()).slice(-5)}`;

    await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Searchable Patient', phone: local, dateOfBirth: '', notes: '' });

    const response = await request(app)
      .get(`/api/v1/patients?q=${local.slice(0, 7)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(
      jsonBody<{ items: readonly { phone: string | null }[] }>(response).items.map(
        (item) => item.phone,
      ),
    ).toContain(`+91${local}`);
  }, 120_000);

  it('shows a patient their appointment history, newest first', async () => {
    const token = await tokenFor(ownerEmail);
    const created = await book(token);
    expect(created.status).toBe(201);

    const response = await request(app)
      .get(`/api/v1/patients/${clinic.ids.patients ?? ''}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const history = jsonBody<{
      appointments: readonly { id: string; startAt: string }[];
    }>(response).appointments;

    expect(history.map((item) => item.id)).toContain((created.body as Booking).appointmentId);

    const starts = history.map((item) => item.startAt);
    expect(starts).toEqual([...starts].toSorted().toReversed());
  }, 120_000);
});

describe('searching the appointment list', () => {
  /**
   * The search the prototype's appointment screen has and the endpoint did not.
   *
   * It matches the PATIENT, because an appointment has nothing identifying of its own, and
   * the fixture clinic has several patients so a positive result proves filtering rather
   * than an accident of there being one row.
   */
  const search = async (token: string, term: string): Promise<readonly string[]> => {
    const response = await request(app)
      .get(`/api/v1/appointments?q=${encodeURIComponent(term)}&limit=100`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    return jsonBody<{ items: readonly { patient: { fullName: string | null } }[] }>(
      response,
    ).items.map((item) => item.patient.fullName ?? '');
  };

  it('finds appointments by part of the patient name, case insensitively', async () => {
    const token = await tokenFor(ownerEmail);
    const created = await book(token);
    expect(created.status).toBe(201);

    const names = await search(token, 'patient dashboard');

    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => name.toLowerCase().includes('patient dashboard'))).toBe(true);
  }, 120_000);

  it('finds appointments by part of the phone number, punctuation and all', async () => {
    const token = await tokenFor(ownerEmail);
    await book(token);

    const read = await request(app)
      .get(`/api/v1/patients/${clinic.ids.patients ?? ''}`)
      .set('Authorization', `Bearer ${token}`);
    const phone = jsonBody<{ phone: string }>(read).phone;

    // Typed the way somebody types it, with spaces: the digits are what is matched.
    const spaced = `${phone.slice(3, 8)} ${phone.slice(8)}`;
    const names = await search(token, spaced);

    expect(names.length).toBeGreaterThan(0);
  }, 120_000);

  it('returns nothing for a term that matches no patient, rather than everything', async () => {
    const token = await tokenFor(ownerEmail);
    await book(token);

    // The failure this guards against is a filter that is silently dropped: an ignored `q`
    // returns the whole book, which looks like a working search finding everything.
    expect(await search(token, 'nobodyhasthisname')).toEqual([]);
  }, 120_000);

  it('never reaches another clinic through the search', async () => {
    const token = await tokenFor(ownerEmail);

    const names = await search(token, 'Patient DashboardOther');

    expect(names).toEqual([]);
  }, 120_000);
});

/**
 * Notes on an appointment, added with the clinic's approval on 2026-11-03.
 *
 * A note is free text a receptionist types about a patient, so it is patient data whatever
 * it says. What is worth asserting is everywhere it must NOT go, as much as where it must.
 */
describe('appointment notes', () => {
  const NOTE = 'Synthetic note: prefers the first slot of the morning.';

  const bookWithNotes = async (token: string, notes: unknown) =>
    request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send({
      patientId: clinic.ids.patients,
      doctorId: clinic.ids.doctors,
      serviceId: clinic.ids.services,
      startAt: nextBookableStart(),
      notes,
    });

  const read = async (token: string, appointmentId: string, query = '') =>
    request(app)
      .get(`/api/v1/appointments/${appointmentId}${query}`)
      .set('Authorization', `Bearer ${token}`);

  it('stores the note and returns it to the clinic', async () => {
    const token = await tokenFor(ownerEmail);
    const booked = await bookWithNotes(token, NOTE);

    expect(booked.status).toBe(201);
    const detail = await read(token, jsonBody<Booking>(booked).appointmentId);

    expect(jsonBody<{ notes: string | null }>(detail).notes).toBe(NOTE);
  });

  it('stores a blank note as no note at all', async () => {
    const token = await tokenFor(ownerEmail);
    const booked = await bookWithNotes(token, '   ');
    const detail = await read(token, jsonBody<Booking>(booked).appointmentId);

    // An HTML textarea has no null, so an untouched box arrives as whitespace. Stored as
    // a note, it would be a note that says nothing (D-013).
    expect(jsonBody<{ notes: string | null }>(detail).notes).toBeNull();
  });

  it('books without a note when the field is not sent at all', async () => {
    const token = await tokenFor(ownerEmail);
    // `book` sends no notes key: the voice agent's bookings and older clients look like this.
    const booked = await book(token);

    expect(booked.status).toBe(201);
  });

  it('refuses a note longer than the database allows', async () => {
    const token = await tokenFor(ownerEmail);
    const booked = await bookWithNotes(token, 'x'.repeat(2001));

    expect(booked.status).toBe(400);
  });

  it('carries the note to the new row when the appointment is moved', async () => {
    const token = await tokenFor(ownerEmail);
    const booked = await bookWithNotes(token, NOTE);
    const moved = await request(app)
      .post(`/api/v1/appointments/${jsonBody<Booking>(booked).appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: nextBookableStart(), reason: null });

    expect(moved.status).toBe(201);
    const detail = await read(token, jsonBody<Booking>(moved).appointmentId);

    /**
     * A reschedule makes a NEW row. A note left on the cancelled one would vanish from every
     * screen that shows the appointment, lost without anybody deleting it.
     */
    expect(jsonBody<{ notes: string | null }>(detail).notes).toBe(NOTE);
  });

  it('hides the note from a platform role, as it hides the patient’s name', async () => {
    const owner = await tokenFor(ownerEmail);
    const booked = await bookWithNotes(owner, NOTE);
    const platform = await tokenFor(superAdminEmail);

    const detail = await read(
      platform,
      jsonBody<Booking>(booked).appointmentId,
      `?organisationId=${clinic.organisationId}`,
    );

    expect(detail.status).toBe(200);
    // Free text about a patient is as identifying as their name, and often more so.
    expect(jsonBody<{ notes: string | null }>(detail).notes).toBeNull();
  });

  it('records that a note was written, and never what it says', async () => {
    const token = await tokenFor(ownerEmail);
    const booked = await bookWithNotes(token, NOTE);
    const appointmentId = jsonBody<Booking>(booked).appointmentId;

    const row = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findFirst({
        where: { action: 'appointment.created', entityId: appointmentId },
        select: { metadata: true },
      }),
    );

    expect(row?.metadata).toMatchObject({ hasNotes: true });
    // Rule 5: audit rows never contain patient field values.
    expect(JSON.stringify(row?.metadata)).not.toContain('first slot');
  });
});
