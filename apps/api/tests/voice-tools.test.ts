import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, mintToolSecret, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { markHoursCollected, nextBookableLocal } from './support/clinic-schedule.js';

/**
 * The voice tool endpoints, driven the way Sarvam will drive them.
 *
 * WHAT THIS SUITE IS ACTUALLY FOR. These six endpoints are the only ones on the platform
 * with no session behind them, and the thing on the other end is a language model talking
 * to a patient. So the questions worth asking are not the usual ones:
 *
 *   - does a secret and only a secret get in, and does a wrong one leak nothing
 *   - is one clinic's agent confined to one clinic's patients
 *   - does a failure arrive as a sentence a patient can be told, rather than as a 500
 *   - does it refuse to GUESS: two patients on one number, a doctor it cannot identify,
 *     three upcoming appointments
 *
 * The last one is the one that matters most and is the easiest to get wrong, because every
 * guess looks like helpfulness until somebody else's appointment is cancelled.
 */

const app = createApp({ readiness: () => Promise.resolve() });

type Envelope = {
  readonly ok: boolean;
  readonly message: string;
  readonly data: Record<string, unknown> | null;
};

let clinic: OrganisationGraph;
let other: OrganisationGraph;
let unasked: OrganisationGraph;
let secret: string;
let otherSecret: string;
let unaskedSecret: string;

const tool = (path: string, token: string) =>
  request(app).post(`/voice/tools/${path}`).set('Authorization', `Bearer ${token}`);

const envelopeOf = (response: { readonly status: number; readonly body: unknown }): Envelope =>
  jsonBody<Envelope>(response as Parameters<typeof jsonBody>[0]);

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    clinic = await createOrganisationGraph(tx, 'VoiceTools');
    other = await createOrganisationGraph(tx, 'VoiceOther');
    // Deliberately left with no `opening_hours_collected_at`: D-013's "nobody has asked".
    unasked = await createOrganisationGraph(tx, 'VoiceUnasked');

    await markHoursCollected(tx, clinic.organisationId);
    await markHoursCollected(tx, other.organisationId);

    secret = await mintToolSecret(tx, clinic.organisationId);
    otherSecret = await mintToolSecret(tx, other.organisationId);
    unaskedSecret = await mintToolSecret(tx, unasked.organisationId);
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

describe('authentication is the per-clinic secret and nothing else', () => {
  it('refuses a call with no secret, with a 401 rather than a spoken message', async () => {
    const response = await request(app).post('/voice/tools/clinic-info').send({});

    /**
     * 401 AND NOT 200, which is the one deliberate exception to "every answer is speakable".
     * A missing secret is a misconfigured deployment, not something to tell a patient, and a
     * 200 would make it invisible to whoever is watching the service.
     */
    expect(response.status).toBe(401);
    expect(envelopeOf(response).ok).toBe(false);
  });

  it('refuses a secret that belongs to nobody', async () => {
    const response = await tool('clinic-info', 'not-a-real-secret').send({});

    expect(response.status).toBe(401);
  });

  it('refuses a secret of a different length without a server error', async () => {
    // The constant-time comparison throws on a length mismatch if it is reached unguarded,
    // which would be a 500 and, worse, a timing signal. A 401 is the whole assertion.
    const response = await tool('clinic-info', 'x').send({});

    expect(response.status).toBe(401);
  });

  it('says the same thing for an unknown secret as for a suspended clinic', async () => {
    const suspended = await asPlatform(ownerClient(), async (tx) => {
      const graph = await createOrganisationGraph(tx, 'VoiceSuspended');
      const token = await mintToolSecret(tx, graph.organisationId);
      await tx.organisation.update({
        where: { id: graph.organisationId },
        data: { status: 'SUSPENDED' },
      });
      return token;
    });

    const refused = await tool('clinic-info', suspended).send({});
    const unknown = await tool('clinic-info', 'not-a-real-secret').send({});

    // Indistinguishable on purpose: whoever holds an old secret must not learn the clinic's
    // standing, and whoever is guessing must not learn that they hit a real value.
    expect(refused.status).toBe(401);
    expect(envelopeOf(refused).message).toBe(envelopeOf(unknown).message);
  });
});

describe('one clinic, and only one clinic', () => {
  it('cannot find another clinic’s patient by their number', async () => {
    const response = await tool('lookup-patient', secret).send({
      callerNumber: other.patientPhone,
    });

    // The number exists in the other clinic. The agent is told there is no record, which is
    // the same answer it gets for a number nobody has, because a different answer would
    // confirm that another clinic holds that person.
    expect(response.status).toBe(200);
    expect(envelopeOf(response).data).toMatchObject({ found: false });
  });

  it('and the other clinic’s own agent finds that same patient', async () => {
    // The positive control. Without it the test above would pass just as well against a
    // lookup that found nobody for anybody, which is isolation by breakage.
    const response = await tool('lookup-patient', otherSecret).send({
      callerNumber: other.patientPhone,
    });

    expect(envelopeOf(response).data).toMatchObject({ found: true });
  });

  it('cannot cancel another clinic’s appointment', async () => {
    const theirs = await asPlatform(ownerClient(), (tx) =>
      tx.appointment.findFirstOrThrow({
        where: { organisationId: other.organisationId },
        select: { id: true, status: true },
      }),
    );

    const response = await tool('cancel', secret).send({ appointmentId: theirs.id });
    const after = await asPlatform(ownerClient(), (tx) =>
      tx.appointment.findFirst({ where: { id: theirs.id }, select: { status: true } }),
    );

    expect(envelopeOf(response).ok).toBe(false);
    // The point of the test: not merely a refusal, but an unchanged appointment.
    expect(after?.status).toBe(theirs.status);
  });
});

describe('what the agent may say about the clinic', () => {
  it('gives the clinic’s own name', async () => {
    const response = await tool('clinic-info', secret).send({});
    const envelope = envelopeOf(response);

    expect(envelope.ok).toBe(true);
    expect(envelope.message).toContain('Test Clinic VoiceTools');
  });

  it('does not announce a closure for a clinic nobody has asked', async () => {
    const response = await tool('clinic-info', unaskedSecret).send({ topic: 'hours' });
    const envelope = envelopeOf(response);

    /**
     * D-013 as a spoken sentence. The clinic has hours rows from the fixture but no
     * `opening_hours_collected_at`, so the platform does not know they were confirmed.
     * Saying "we are closed" on that basis would send a patient away on the strength of a
     * configuration gap.
     */
    expect(envelope.message).not.toMatch(/closed/i);
    expect(envelope.message).toMatch(/call you back/i);
    expect(envelope.data).toMatchObject({ hoursCollected: false });
  });
});

describe('offering times', () => {
  it('offers slots on a day the clinic is open', async () => {
    const when = nextBookableLocal();
    const response = await tool('check-availability', secret).send({ date: when.date });
    const envelope = envelopeOf(response);

    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data?.['slots'])).toBe(true);
    expect((envelope.data?.['slots'] as readonly unknown[]).length).toBeGreaterThan(0);
  });

  it('turns a day in the past into a question, not an error', async () => {
    const response = await tool('check-availability', secret).send({ date: '2020-01-06' });
    const envelope = envelopeOf(response);

    expect(response.status).toBe(200);
    expect(envelope.message).toMatch(/already passed/i);
    expect(envelope.data).toMatchObject({ reason: 'DAY_IN_THE_PAST' });
  });

  it('asks which doctor rather than picking one it cannot identify', async () => {
    const when = nextBookableLocal();
    const response = await tool('check-availability', secret).send({
      date: when.date,
      doctorName: 'Doctor Who',
    });

    expect(envelopeOf(response).ok).toBe(false);
    expect(envelopeOf(response).message).toMatch(/which doctor/i);
  });
});

describe('booking by voice', () => {
  it('books for a caller the clinic already knows', async () => {
    const when = nextBookableLocal();
    const response = await tool('book', secret).send({
      callerNumber: clinic.patientPhone,
      date: when.date,
      time: when.time,
    });
    const envelope = envelopeOf(response);

    expect(envelope.ok).toBe(true);
    expect(envelope.data?.['appointmentId']).toBeDefined();

    const row = await asPlatform(ownerClient(), (tx) =>
      tx.appointment.findFirst({
        where: { id: String(envelope.data?.['appointmentId']) },
        select: { source: true, organisationId: true },
      }),
    );

    // Provenance on the row itself, so a receptionist looking at the diary can see that the
    // agent booked it rather than a person.
    expect(row?.source).toBe('VOICE_AGENT');
    expect(row?.organisationId).toBe(clinic.organisationId);
  });

  it('creates a record for a caller it has never heard of, with the name they gave', async () => {
    const when = nextBookableLocal();
    const phone = '+919812300077';

    const response = await tool('book', secret).send({
      callerNumber: phone,
      fullName: 'Voice New Caller',
      date: when.date,
      time: when.time,
    });

    expect(envelopeOf(response).ok).toBe(true);

    const created = await asPlatform(ownerClient(), (tx) =>
      tx.patient.findFirst({
        where: { organisationId: clinic.organisationId, phone },
        select: { fullName: true },
      }),
    );

    expect(created?.fullName).toBe('Voice New Caller');
  });

  it('asks for a name rather than registering a caller without one', async () => {
    const when = nextBookableLocal();
    const response = await tool('book', secret).send({
      callerNumber: '+919812300088',
      date: when.date,
      time: when.time,
    });

    expect(envelopeOf(response).ok).toBe(false);
    expect(envelopeOf(response).message).toMatch(/full name/i);

    const created = await asPlatform(ownerClient(), (tx) =>
      tx.patient.count({
        where: { organisationId: clinic.organisationId, phone: '+919812300088' },
      }),
    );

    // Nothing written on a refusal: a record with no name is worse than no record.
    expect(created).toBe(0);
  });

  it('books once when the same tool call arrives twice', async () => {
    const when = nextBookableLocal();
    const body = {
      callerNumber: clinic.patientPhone,
      date: when.date,
      time: when.time,
      callId: `call-${uuidV7()}`,
      toolCallId: 'book-1',
    };

    const first = envelopeOf(await tool('book', secret).send(body));
    const second = envelopeOf(await tool('book', secret).send(body));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // The same appointment, and the agent is told so it does not confirm twice.
    expect(second.data?.['appointmentId']).toBe(first.data?.['appointmentId']);
    expect(second.data?.['replayed']).toBe(true);
  });

  it('tells the caller a slot has gone rather than failing the call', async () => {
    const when = nextBookableLocal();
    const body = { callerNumber: clinic.patientPhone, date: when.date, time: when.time };

    const first = envelopeOf(await tool('book', secret).send(body));
    // No idempotency key, so this is a genuine second attempt at a taken slot rather than
    // a replay. The exclusion constraint refuses it; the patient hears a sentence.
    const second = await tool('book', secret).send(body);

    expect(first.ok).toBe(true);
    expect(second.status).toBe(200);
    expect(envelopeOf(second).ok).toBe(false);
    expect(envelopeOf(second).message.length).toBeGreaterThan(0);
  });

  it('asks which patient when one number has two records', async () => {
    const phone = '+919812300099';

    await asPlatform(ownerClient(), async (tx) => {
      for (const fullName of ['Shared Number One', 'Shared Number Two']) {
        await tx.patient.create({
          data: { id: uuidV7(), organisationId: clinic.organisationId, fullName, phone },
        });
      }
    });

    const when = nextBookableLocal();
    const response = await tool('lookup-patient', secret).send({ callerNumber: phone });
    const envelope = envelopeOf(response);

    expect(envelope.data).toMatchObject({ found: false, needsName: true });
    /**
     * AND IT DOES NOT READ THE NAMES OUT. Several records on one number is usually a
     * family, and whoever is holding the phone has not been authorised to learn who else
     * lives there. The agent asks; it does not offer a menu of names.
     */
    expect(envelope.message).not.toContain('Shared Number One');
    expect(envelope.message).not.toContain('Shared Number Two');

    const booked = await tool('book', secret).send({
      callerNumber: phone,
      date: when.date,
      time: when.time,
    });
    expect(envelopeOf(booked).ok).toBe(false);

    // With the name, the same number resolves to one record and books.
    const narrowed = await tool('book', secret).send({
      callerNumber: phone,
      fullName: 'Shared Number Two',
      date: when.date,
      time: when.time,
    });
    expect(envelopeOf(narrowed).ok).toBe(true);
  });
});

describe('moving and cancelling', () => {
  const bookFor = async (phone: string): Promise<string> => {
    const when = nextBookableLocal();
    const envelope = envelopeOf(
      await tool('book', secret).send({
        callerNumber: phone,
        fullName: 'Voice Mover',
        date: when.date,
        time: when.time,
      }),
    );

    if (!envelope.ok) {
      throw new Error(`could not book: ${envelope.message}`);
    }

    return String(envelope.data?.['appointmentId']);
  };

  it('moves an appointment the caller is identified by their number', async () => {
    const phone = '+919812300111';
    await bookFor(phone);

    const when = nextBookableLocal();
    const response = await tool('reschedule', secret).send({
      callerNumber: phone,
      date: when.date,
      time: when.time,
    });

    expect(envelopeOf(response).ok).toBe(true);
    expect(envelopeOf(response).data?.['appointmentId']).toBeDefined();
  });

  it('asks which day when the caller has more than one appointment booked', async () => {
    const phone = '+919812300222';
    await bookFor(phone);
    await bookFor(phone);

    const when = nextBookableLocal();
    const response = await tool('reschedule', secret).send({
      callerNumber: phone,
      date: when.date,
      time: when.time,
    });

    // Moving the wrong one of two appointments is worse than a question.
    expect(envelopeOf(response).ok).toBe(false);
    expect(envelopeOf(response).message).toMatch(/more than one/i);
  });

  it('cancels, and says so without needing an id from the caller', async () => {
    const phone = '+919812300333';
    const appointmentId = await bookFor(phone);

    const response = await tool('cancel', secret).send({
      callerNumber: phone,
      reason: 'Cannot make it',
    });

    expect(envelopeOf(response).ok).toBe(true);

    const row = await asPlatform(ownerClient(), (tx) =>
      tx.appointment.findFirst({ where: { id: appointmentId }, select: { status: true } }),
    );

    expect(row?.status).toBe('CANCELLED');
  });

  it('offers a call back rather than cancelling something else', async () => {
    const response = await tool('cancel', secret).send({ callerNumber: '+919812300444' });

    expect(envelopeOf(response).ok).toBe(false);
    expect(envelopeOf(response).message).toMatch(/call you back/i);
  });
});

describe('the audit trail names the agent, since the actor column cannot', () => {
  it('records a voice cancellation with its actor in the metadata', async () => {
    const phone = '+919812300555';
    const when = nextBookableLocal();

    const booked = envelopeOf(
      await tool('book', secret).send({
        callerNumber: phone,
        fullName: 'Voice Audited',
        date: when.date,
        time: when.time,
      }),
    );
    const appointmentId = String(booked.data?.['appointmentId']);

    await tool('cancel', secret).send({
      callerNumber: phone,
      appointmentId,
      reason: 'Driven by a test.',
    });

    const row = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findFirst({
        where: { action: 'appointment.cancelled', entityId: appointmentId },
        select: { actorUserId: true, actorRole: true, metadata: true, organisationId: true },
      }),
    );

    expect(row).not.toBeNull();
    /**
     * The honest shape of the gap: no actor user and no actor role, because the agent is
     * neither, and the `role` enum has six values. `actorSource` is what answers "who", and
     * a naming convention is a weaker control than a column. Recorded in docs/BACKLOG.md.
     */
    expect(row?.actorUserId).toBeNull();
    expect(row?.actorRole).toBeNull();
    expect(row?.organisationId).toBe(clinic.organisationId);
    expect(row?.metadata).toMatchObject({ actorSource: 'VOICE_AGENT' });
  });
});

/**
 * A clinic that saved "two per slot" before the cap existed (review I5).
 *
 * The database allows one live appointment per doctor at a time, so the agent offered the
 * second patient a time and then said it had just been taken. The stored value is written
 * straight to the table here, because the settings form can no longer save it.
 */
describe('a clinic with more than one per slot stored', () => {
  it('is never offered a time the database will refuse', async () => {
    await asPlatform(ownerClient(), (tx) =>
      tx.clinicBookingPolicy.update({
        where: { organisationId: other.organisationId },
        data: { maxPerSlot: 2 },
      }),
    );

    const when = nextBookableLocal();
    const booked = envelopeOf(
      await tool('book', otherSecret).send({ callerNumber: other.patientPhone, ...when }),
    );
    expect(booked.ok).toBe(true);

    const offered = envelopeOf(
      await tool('check-availability', otherSecret).send({ date: when.date }),
    );
    const slots = (offered.data?.['slots'] ?? []) as readonly { readonly label: string }[];

    expect(slots.map((slot) => slot.label)).not.toContain(when.time);
  });
});

/**
 * WHO IS CALLING is the caller's own line, never a number they say (Feature 3 review, C2 and
 * I6). Before this, any caller could say a neighbour's number, hear the neighbour's name read
 * back, learn they were a patient here, and cancel their appointment.
 */
describe('the caller is identified by their own line', () => {
  const storedName = async (patientId: string): Promise<string> =>
    (
      await asPlatform(ownerClient(), (tx) =>
        tx.patient.findUniqueOrThrow({ where: { id: patientId }, select: { fullName: true } }),
      )
    ).fullName;

  it('a registered line proceeds, and the stored name is never said or handed over', async () => {
    const name = await storedName(clinic.ids.patients ?? '');
    const lookup = await tool('lookup-patient', secret).send({ callerNumber: clinic.patientPhone });

    expect(envelopeOf(lookup).data).toMatchObject({ found: true });
    expect(JSON.stringify(lookup.body)).not.toContain(name);

    const when = nextBookableLocal();
    const booked = await tool('book', secret).send({ callerNumber: clinic.patientPhone, ...when });

    expect(envelopeOf(booked).ok).toBe(true);
    expect(JSON.stringify(booked.body)).not.toContain(name);
  });

  it('an unknown line is a new caller, and nothing says whether a record exists', async () => {
    const unknownLine = '+919812300601';
    const lookup = envelopeOf(
      await tool('lookup-patient', secret).send({ callerNumber: unknownLine }),
    );
    // The same answer a line with no caller number at all gets: nothing was searched.
    const withheld = envelopeOf(await tool('lookup-patient', secret).send({}));

    expect(lookup.data).toMatchObject({ found: false, needsName: true });
    expect(lookup.message).toBe(withheld.message);
    expect(lookup.data).toEqual(withheld.data);
  });

  describe('a caller who speaks somebody else’s number', () => {
    const strangerLine = '+919812300602';

    it('is not looked up by it: the spoken number is ignored', async () => {
      const name = await storedName(clinic.ids.patients ?? '');
      const response = await tool('lookup-patient', secret).send({
        callerNumber: strangerLine,
        phone: clinic.patientPhone,
      });

      expect(envelopeOf(response).data).toMatchObject({ found: false });
      expect(JSON.stringify(response.body)).not.toContain(name);
    });

    it('cannot cancel or move that number’s appointment, by number or by id', async () => {
      const when = nextBookableLocal();
      const theirs = envelopeOf(
        await tool('book', secret).send({ callerNumber: clinic.patientPhone, ...when }),
      );
      const appointmentId = String(theirs.data?.['appointmentId']);
      const later = nextBookableLocal();

      const attempts = [
        await tool('cancel', secret).send({
          callerNumber: strangerLine,
          phone: clinic.patientPhone,
        }),
        await tool('cancel', secret).send({ callerNumber: strangerLine, appointmentId }),
        await tool('cancel', secret).send({ appointmentId }),
        await tool('reschedule', secret).send({
          callerNumber: strangerLine,
          appointmentId,
          ...later,
        }),
      ];

      for (const attempt of attempts) {
        expect(attempt.status).toBe(200);
        expect(envelopeOf(attempt).ok).toBe(false);
        expect(envelopeOf(attempt).message).toMatch(/call you back/i);
      }

      const row = await asPlatform(ownerClient(), (tx) =>
        tx.appointment.findUniqueOrThrow({
          where: { id: appointmentId },
          select: { status: true, startAt: true },
        }),
      );
      expect(row.status).toBe('SCHEDULED');
    });

    it('books as a NEW patient when their own line is withheld, never as the owner of the number', async () => {
      const when = nextBookableLocal();
      const before = await asPlatform(ownerClient(), (tx) =>
        tx.patient.count({
          where: { organisationId: clinic.organisationId, phone: clinic.patientPhone },
        }),
      );

      const booked = envelopeOf(
        await tool('book', secret).send({
          phone: clinic.patientPhone,
          fullName: 'Withheld Line Caller',
          ...when,
        }),
      );

      expect(booked.ok).toBe(true);

      const appointment = await asPlatform(ownerClient(), (tx) =>
        tx.appointment.findUniqueOrThrow({
          where: { id: String(booked.data?.['appointmentId']) },
          select: { patient: { select: { id: true, fullName: true } } },
        }),
      );

      // Not attached to the record the spoken number belongs to.
      expect(appointment.patient.id).not.toBe(clinic.ids.patients);
      expect(appointment.patient.fullName).toBe('Withheld Line Caller');
      expect(
        await asPlatform(ownerClient(), (tx) =>
          tx.patient.count({
            where: { organisationId: clinic.organisationId, phone: clinic.patientPhone },
          }),
        ),
      ).toBe(before + 1);
    });
  });

  it('a withheld line with no number spoken is asked for one, so the booking is not lost', async () => {
    const when = nextBookableLocal();
    const response = envelopeOf(
      await tool('book', secret).send({ fullName: 'No Number Yet', ...when }),
    );

    expect(response.ok).toBe(false);
    expect(response.message).toMatch(/number the clinic can reach you on/i);
  });
});
