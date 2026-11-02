import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * The call history as each role sees it.
 *
 * THE INTERESTING TESTS ARE THE ONES ABOUT WHAT IS HIDDEN. The matrix is unusually specific
 * here: a platform role reads `metadata`, which means the call without the people on it; a
 * doctor reads `own`, which means calls attached to their own appointments; staff hear
 * recordings only while the clinic has said they may. Each of those is a cell that changes
 * the answer rather than only whether there is one, so each has a test.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let clinic: OrganisationGraph;
let other: OrganisationGraph;
let callId: string;
let recordedCallId: string;
let unlinkedCallId: string;
const emails = new Map<string, string>();

const tokenFor = async (role: string): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: emails.get(role),
      password: PASSWORD,
      audience:
        role.startsWith('CLINIC') || role === 'DOCTOR' || role === 'STAFF' ? 'clinic' : 'admin',
    });

  return jsonBody<{ accessToken: string }>(response).accessToken;
};

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), async (tx) => {
    clinic = await createOrganisationGraph(tx, 'Calls');
    other = await createOrganisationGraph(tx, 'CallsOther');

    for (const role of ['CLINIC_OWNER', 'DOCTOR', 'STAFF', 'SUPER_ADMIN'] as const) {
      const email = `calls.${role.toLowerCase()}.${Date.now()}@test.invalid`;
      emails.set(role, email);

      await tx.user.create({
        data: {
          id: uuidV7(),
          organisationId: role === 'SUPER_ADMIN' ? null : clinic.organisationId,
          email,
          passwordHash,
          fullName: `Calls ${role}`,
          role,
          status: 'ACTIVE',
        },
      });
    }

    /**
     * The DOCTOR user is attached to the fixture's doctor row, so `own` has something to
     * mean. Without this the doctor sees nothing and the scope test would pass for the
     * wrong reason.
     */
    const doctorUser = await tx.user.findFirstOrThrow({
      where: { email: emails.get('DOCTOR') ?? '' },
      select: { id: true },
    });

    await tx.doctor.update({
      where: { id: clinic.ids.doctors ?? '' },
      data: { userId: doctorUser.id },
    });

    // The fixture's own call is linked to the fixture appointment and patient.
    callId = clinic.ids.calls ?? '';

    recordedCallId = uuidV7();
    await tx.call.create({
      data: {
        id: recordedCallId,
        organisationId: clinic.organisationId,
        externalCallId: `20261102/recorded_${Date.now()}`,
        direction: 'INBOUND',
        status: 'COMPLETED',
        fromE164: '+919812377001',
        toE164: '+918000000001',
        durationSeconds: 61,
        recordingKey: `recordings/${clinic.organisationId}/${recordedCallId}.wav`,
      },
    });

    unlinkedCallId = uuidV7();
    await tx.call.create({
      data: {
        id: unlinkedCallId,
        organisationId: clinic.organisationId,
        externalCallId: `20261102/unlinked_${Date.now()}`,
        direction: 'INBOUND',
        status: 'MISSED',
        fromE164: '+919812377002',
        toE164: '+918000000001',
      },
    });

    await tx.callTranscriptTurn.createMany({
      data: [
        {
          id: uuidV7(),
          organisationId: clinic.organisationId,
          callId: recordedCallId,
          turnIndex: 0,
          role: 'CALLER',
          text: 'I would like an appointment.',
        },
        {
          id: uuidV7(),
          organisationId: clinic.organisationId,
          callId: recordedCallId,
          turnIndex: 1,
          role: 'AGENT',
          text: 'Certainly. Tuesday at ten?',
        },
      ],
    });
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

type ListBody = {
  readonly items: readonly {
    readonly id: string;
    readonly fromE164: string | null;
    readonly patient: unknown;
    readonly hasRecording: boolean;
  }[];
  readonly nextCursor: string | null;
};

const list = async (role: string, query = '') =>
  request(app)
    .get(`/api/v1/calls${query}`)
    .set('Authorization', `Bearer ${await tokenFor(role)}`);

describe('a clinic role reads its own calls', () => {
  it('lists them newest first, with the caller’s number', async () => {
    const response = await list('CLINIC_OWNER');
    const body = jsonBody<ListBody>(response);

    expect(response.status).toBe(200);
    expect(body.items.length).toBeGreaterThanOrEqual(3);
    expect(body.items.some((item) => item.fromE164 === '+919812377001')).toBe(true);
  });

  it('says which calls have a recording without handing over the key', async () => {
    const body = jsonBody<ListBody>(await list('CLINIC_OWNER'));
    const recorded = body.items.find((item) => item.id === recordedCallId);

    expect(recorded?.hasRecording).toBe(true);
    // The key is a path in our bucket. A client that never learns it cannot try to use it.
    expect(JSON.stringify(body)).not.toContain('recordings/');
  });

  it('filters by the caller’s number, not the clinic’s', async () => {
    const body = jsonBody<ListBody>(await list('CLINIC_OWNER', '?q=377001'));

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(recordedCallId);

    // Every row shares the agent number, so matching it too would return the whole table.
    const byAgent = jsonBody<ListBody>(await list('CLINIC_OWNER', '?q=8000000001'));
    expect(byAgent.items).toHaveLength(0);
  });

  it('returns the transcript with each turn attributed', async () => {
    const response = await request(app)
      .get(`/api/v1/calls/${recordedCallId}`)
      .set('Authorization', `Bearer ${await tokenFor('CLINIC_OWNER')}`);

    const body = jsonBody<{
      readonly transcript: readonly { readonly role: string; readonly text: string }[];
    }>(response);

    expect(body.transcript).toEqual([
      { role: 'CALLER', text: 'I would like an appointment.' },
      { role: 'AGENT', text: 'Certainly. Tuesday at ten?' },
    ]);
  });

  it('cannot read another clinic’s call', async () => {
    const theirs = await asPlatform(ownerClient(), (tx) =>
      tx.call.findFirstOrThrow({
        where: { organisationId: other.organisationId },
        select: { id: true },
      }),
    );

    const response = await request(app)
      .get(`/api/v1/calls/${theirs.id}`)
      .set('Authorization', `Bearer ${await tokenFor('CLINIC_OWNER')}`);

    // 404, never 403: a 403 would confirm the id exists (rule 7).
    expect(response.status).toBe(404);
  });
});

describe('a platform role reads the call and not the people on it', () => {
  it('nulls the numbers, the patient and the transcript', async () => {
    const response = await list('SUPER_ADMIN', `?organisationId=${clinic.organisationId}`);
    const body = jsonBody<ListBody>(response);

    expect(response.status).toBe(200);
    expect(body.items.length).toBeGreaterThan(0);

    /**
     * Scope `metadata`. A call's numbers are personal data on their own, and support does
     * not need them to see that a clinic's agent is answering calls.
     */
    for (const item of body.items) {
      expect(item.fromE164).toBeNull();
      expect(item.patient).toBeNull();
    }

    const detail = await request(app)
      .get(`/api/v1/calls/${recordedCallId}?organisationId=${clinic.organisationId}`)
      .set('Authorization', `Bearer ${await tokenFor('SUPER_ADMIN')}`);

    // And no transcript at all: the conversation is further from metadata than the numbers.
    expect(jsonBody<{ transcript: readonly unknown[] }>(detail).transcript).toEqual([]);
  });

  it('is refused a recording outright', async () => {
    const response = await request(app)
      .get(`/api/v1/calls/${recordedCallId}/recording-url?organisationId=${clinic.organisationId}`)
      .set('Authorization', `Bearer ${await tokenFor('SUPER_ADMIN')}`);

    // `recordings: none` for both platform roles. A recording is the rawest patient data
    // the platform holds, and no support session unlocks it.
    expect(response.status).toBe(403);
  });
});

describe('a doctor reads only calls that are theirs', () => {
  it('sees the one attached to their appointment and not the one attached to nothing', async () => {
    const body = jsonBody<ListBody>(await list('DOCTOR'));
    const ids = body.items.map((item) => item.id);

    expect(ids).toContain(callId);
    /**
     * A call with no appointment is deliberately NOT theirs: nothing about it says it
     * concerns them, and a receptionist's missed call is not a doctor's business.
     */
    expect(ids).not.toContain(unlinkedCallId);
    expect(ids).not.toContain(recordedCallId);
  });

  it('is refused a recording, which their row denies entirely', async () => {
    const response = await request(app)
      .get(`/api/v1/calls/${recordedCallId}/recording-url`)
      .set('Authorization', `Bearer ${await tokenFor('DOCTOR')}`);

    expect(response.status).toBe(403);
  });
});

describe('staff hear a recording only while the clinic allows it', () => {
  const setOptIn = async (value: boolean): Promise<void> => {
    await asPlatform(ownerClient(), (tx) =>
      tx.organisation.update({
        where: { id: clinic.organisationId },
        data: { settings: { recordings_visible_to_staff: value } },
      }),
    );
  };

  it('refuses while the clinic has it switched off', async () => {
    await setOptIn(false);

    const response = await request(app)
      .get(`/api/v1/calls/${recordedCallId}/recording-url`)
      .set('Authorization', `Bearer ${await tokenFor('STAFF')}`);

    /**
     * `clinic_opt_in` is a CONDITIONAL grant, and `scopeFilter` turns it into a denial until
     * somebody checks the setting, so forgetting the check fails closed. This is the test
     * that the check exists.
     */
    expect(response.status).toBe(403);
  });

  it('allows it once the clinic switches it on', async () => {
    await setOptIn(true);

    const response = await request(app)
      .get(`/api/v1/calls/${recordedCallId}/recording-url`)
      .set('Authorization', `Bearer ${await tokenFor('STAFF')}`);

    // The positive control. Without it the test above would pass against an endpoint that
    // refused everybody.
    expect(response.status).toBe(200);
    expect(jsonBody<{ url: string }>(response).url).toContain('http');
  });

  it('audits every URL minted, naming the call and not the URL', async () => {
    await setOptIn(true);

    const before = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.count({
        where: { action: 'call.recording_accessed', entityId: recordedCallId },
      }),
    );

    await request(app)
      .get(`/api/v1/calls/${recordedCallId}/recording-url`)
      .set('Authorization', `Bearer ${await tokenFor('STAFF')}`);

    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findMany({
        where: { action: 'call.recording_accessed', entityId: recordedCallId },
        select: { metadata: true, actorRole: true },
      }),
    );

    expect(rows).toHaveLength(before + 1);
    expect(rows.at(-1)?.actorRole).toBe('STAFF');
    // No key and no URL: both are credentials for the lifetime of the signature, and an
    // audit table is something people are allowed to read.
    expect(JSON.stringify(rows.at(-1)?.metadata)).not.toContain('recordings/');
    expect(JSON.stringify(rows.at(-1)?.metadata)).not.toContain('http');
  });

  it('says there is no recording rather than failing, when there is none', async () => {
    const response = await request(app)
      .get(`/api/v1/calls/${unlinkedCallId}/recording-url`)
      .set('Authorization', `Bearer ${await tokenFor('CLINIC_OWNER')}`);

    /**
     * A real state: consent may have been declined, the copy may not have run yet, or the
     * call may have had none. The screen says which, so this is a plain 404.
     */
    expect(response.status).toBe(404);
  });
});
