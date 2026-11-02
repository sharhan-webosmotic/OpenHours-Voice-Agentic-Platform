import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getRegisteredRoutes, type RouteDescriptor } from '../src/common/route-registry.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import {
  asPlatform,
  disconnectAll,
  mintToolSecret,
  mintWebhookSecret,
  ownerClient,
} from './support/db.js';
import { inboundCallFinished } from '../src/voice/providers/__fixtures__/inbound-call-finished.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import {
  markHoursCollected,
  nextBookableLocal,
  nextBookableStart,
} from './support/clinic-schedule.js';

/**
 * Every PHI-sensitive route must actually WRITE the audit row it declares.
 *
 * The earlier version of this guard read the route descriptor and asserted that
 * `auditAction` was a non-empty string. Declaring one was therefore sufficient to satisfy
 * it, and the only PHI-flagged endpoint that shipped declared an action and recorded
 * nothing. A reviewer deleted the one real `audit.record` call in the application and this
 * file still passed 4 of 4.
 *
 * So the guard drives each route for real and asserts the row appears. The recipe table is
 * the part that keeps it honest: a new PHI route with no recipe fails, which is the only
 * moment anyone is still thinking about its audit trail. Writing a recipe is deliberately
 * cheaper than arguing with the test.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let org: OrganisationGraph;
let ownerEmail: string;
let ownerUserId: string;
let superAdminEmail: string;
let superAdminUserId: string;
let toolSecret: string;
let webhookSecret: string;

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'PhiAudit');
    // Without this the slot engine correctly offers nothing (D-013), and every booking
    // recipe below would be refused before it could write an audit row.
    await markHoursCollected(tx, org.organisationId);
    // The voice tool routes authenticate with this and nothing else.
    toolSecret = await mintToolSecret(tx, org.organisationId);
    // The webhook's secret is a different value in a different place: the URL (D-006).
    webhookSecret = await mintWebhookSecret(tx, org.organisationId);
    ownerEmail = `phi.audit.owner.${Date.now()}@test.invalid`;
    ownerUserId = uuidV7();
    superAdminEmail = `phi.audit.super.${Date.now()}@test.invalid`;
    superAdminUserId = uuidV7();

    await tx.user.create({
      data: {
        id: ownerUserId,
        organisationId: org.organisationId,
        email: ownerEmail,
        passwordHash,
        fullName: 'Phi Audit Owner',
        role: 'CLINIC_OWNER',
        status: 'ACTIVE',
      },
    });
    await tx.user.create({
      data: {
        id: superAdminUserId,
        organisationId: null,
        email: superAdminEmail,
        passwordHash,
        fullName: 'Phi Audit Super',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const keyOf = (route: RouteDescriptor): string => `${route.method.toUpperCase()} ${route.path}`;

const loginAs = async (email: string): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return jsonBody<{ accessToken: string }>(response).accessToken;
};

/** Audit rows for one action, attributed to one actor. Read as owner, past every policy. */
const auditRowCount = async (action: string, actorUserId: string | null): Promise<number> =>
  asPlatform(ownerClient(), (tx) => tx.auditLog.count({ where: { action, actorUserId } }));

/**
 * The outcome of driving one route: the status, and WHO the audit row should name. The
 * actor is part of the recipe because the two PHI routes need different roles, and
 * asserting on the actor is what stops an unrelated row from satisfying the test.
 */
type Driven = {
  readonly status: number;
  /**
   * NULL for the voice tool routes, and that is a finding rather than a convenience.
   *
   * `audit_logs.actor_role` is the database's six-value `role` enum and `actor_user_id`
   * points at a user, so an action by the voice agent can name neither: it is a principal
   * with no user row. Those rows are attributed by `metadata.source` or
   * `metadata.actorSource` instead, which a naming convention cannot enforce. Counting on
   * `actorUserId: null` here still proves the row was written, which is what this guard is
   * for, and the proper fix is a schema change recorded in `docs/BACKLOG.md`.
   */
  readonly actorUserId: string | null;
};

/**
 * How to drive each PHI-sensitive route, keyed exactly as the registry names it. Each
 * recipe makes one real request through the whole middleware chain.
 */
const RECIPES = new Map<string, () => Promise<Driven>>([
  [
    'GET /api/v1/audit-logs',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'POST /api/v1/support-sessions',
    async () => {
      // Only a platform role may open one, so the clinic owner above cannot drive this.
      const token = await loginAs(superAdminEmail);
      const response = await request(app)
        .post('/api/v1/support-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          organisationId: org.organisationId,
          reason: 'Driving the PHI audit guard against a real request.',
        });
      return { status: response.status, actorUserId: superAdminUserId };
    },
  ],

  /**
   * Patients and appointments.
   *
   * EVERY ONE IS DRIVEN AS THE CLINIC OWNER, who holds every cell these routes need, so a
   * refusal here would be a real failure rather than a permission artefact.
   *
   * THE THREE STATE-CHANGING RECIPES BOOK THEIR OWN APPOINTMENT FIRST. The guard drives each
   * recipe twice and compares the audit count across the two runs, and cancelling, moving or
   * completing an appointment is a one-way move: a shared fixture appointment would answer
   * 409 on the second run, write no audit row, and fail the guard for a reason that has
   * nothing to do with auditing.
   */
  [
    'GET /api/v1/calls',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .get('/api/v1/calls')
        .set('Authorization', `Bearer ${token}`);
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'GET /api/v1/calls/:callId',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .get(`/api/v1/calls/${org.ids.calls ?? ''}`)
        .set('Authorization', `Bearer ${token}`);
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'GET /api/v1/calls/:callId/recording-url',
    async () => {
      /**
       * A call with a recording key, created here rather than reusing the fixture's, because
       * the fixture's call has none and the guard requires a status under 400. The key points
       * at an object that does not exist, which is harmless: presigning is arithmetic over
       * the key and never fetches anything.
       */
      const token = await loginAs(ownerEmail);
      const callId = uuidV7();

      await asPlatform(ownerClient(), (tx) =>
        tx.call.create({
          data: {
            id: callId,
            organisationId: org.organisationId,
            externalCallId: `20261102/phi_rec_${callId}`,
            direction: 'INBOUND',
            status: 'COMPLETED',
            fromE164: '+919812388001',
            toE164: '+918000000002',
            recordingKey: `recordings/${org.organisationId}/${callId}.wav`,
          },
        }),
      );

      const response = await request(app)
        .get(`/api/v1/calls/${callId}/recording-url`)
        .set('Authorization', `Bearer ${token}`);

      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'GET /api/v1/patients',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`);
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'POST /api/v1/patients',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Audit Guard Patient',
          phone: `+9177${String(Date.now()).slice(-8)}`,
          dateOfBirth: '',
          notes: '',
        });
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'GET /api/v1/patients/:patientId',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .get(`/api/v1/patients/${org.ids.patients ?? ''}`)
        .set('Authorization', `Bearer ${token}`);
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'PATCH /api/v1/patients/:patientId',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .patch(`/api/v1/patients/${org.ids.patients ?? ''}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Touched by the audit guard.' });
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'GET /api/v1/appointments',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${token}`);
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'POST /api/v1/appointments',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: org.ids.patients,
          doctorId: org.ids.doctors,
          serviceId: org.ids.services,
          startAt: nextBookableStart(),
        });
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'GET /api/v1/appointments/agenda',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .get('/api/v1/appointments/agenda?range=day&on=2026-11-02')
        .set('Authorization', `Bearer ${token}`);
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'GET /api/v1/appointments/:appointmentId',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .get(`/api/v1/appointments/${org.ids.appointments ?? ''}`)
        .set('Authorization', `Bearer ${token}`);
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'POST /api/v1/appointments/:appointmentId/cancel',
    async () => {
      const token = await loginAs(ownerEmail);
      const id = await bookForAudit(token);
      const response = await request(app)
        .post(`/api/v1/appointments/${id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Driven by the audit guard.' });
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'POST /api/v1/appointments/:appointmentId/reschedule',
    async () => {
      const token = await loginAs(ownerEmail);
      const id = await bookForAudit(token);
      const response = await request(app)
        .post(`/api/v1/appointments/${id}/reschedule`)
        .set('Authorization', `Bearer ${token}`)
        .send({ startAt: nextBookableStart(), reason: 'Driven by the audit guard.' });
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'POST /api/v1/appointments/:appointmentId/status',
    async () => {
      const token = await loginAs(ownerEmail);
      const id = await bookForAudit(token);
      const response = await request(app)
        .post(`/api/v1/appointments/${id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' });
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'POST /voice/tools/lookup-patient',
    async () => {
      const response = await request(app)
        .post('/voice/tools/lookup-patient')
        .set('Authorization', `Bearer ${toolSecret}`)
        .send({ phone: org.patientPhone });
      return { status: response.status, actorUserId: null };
    },
  ],
  [
    'POST /voice/tools/book',
    async () => {
      const when = nextBookableLocal();
      const response = await request(app)
        .post('/voice/tools/book')
        .set('Authorization', `Bearer ${toolSecret}`)
        // No doctor and no service named: the fixture clinic has exactly one of each, which
        // is the case the tool is allowed to default. A clinic with two would be asked.
        .send({ phone: org.patientPhone, date: when.date, time: when.time });
      return { status: response.status, actorUserId: null };
    },
  ],
  [
    'POST /voice/tools/reschedule',
    async () => {
      const appointmentId = await bookForVoice();
      const when = nextBookableLocal();
      const response = await request(app)
        .post('/voice/tools/reschedule')
        .set('Authorization', `Bearer ${toolSecret}`)
        // By id, not by number: the fixture patient would have several upcoming
        // appointments by this point in the file, and the tool correctly refuses to guess
        // which one a caller means. That refusal has its own test.
        .send({ appointmentId, date: when.date, time: when.time });
      return { status: response.status, actorUserId: null };
    },
  ],
  [
    'POST /webhooks/sarvam/:secret',
    async () => {
      /**
       * A FRESH interaction id per run, because the audit row is written only when the event
       * is genuinely new: the unique index deduplicates a repeat delivery, and a row per
       * retry would make the trail describe Sarvam's delivery behaviour. The guard drives
       * each recipe twice and expects one row each time, so each run must be a new call.
       */
      const response = await request(app)
        .post(`/webhooks/sarvam/${webhookSecret}`)
        .send({ ...inboundCallFinished, interaction_id: `20261102/phi_guard_${Date.now()}` });

      return { status: response.status, actorUserId: null };
    },
  ],
  [
    'POST /voice/tools/cancel',
    async () => {
      const appointmentId = await bookForVoice();
      const response = await request(app)
        .post('/voice/tools/cancel')
        .set('Authorization', `Bearer ${toolSecret}`)
        .send({ appointmentId, reason: 'Driven by the audit guard.' });
      return { status: response.status, actorUserId: null };
    },
  ],
]);

/**
 * Books a fresh appointment THROUGH THE VOICE TOOL, for the recipes that move or cancel one.
 *
 * Through the tool rather than through the dashboard route, so the appointment under test
 * was created by the same principal that is about to change it. A 200 with `ok: false` is
 * still a 200, so the envelope is checked rather than the status.
 */
const bookForVoice = async (): Promise<string> => {
  const when = nextBookableLocal();
  const response = await request(app)
    .post('/voice/tools/book')
    .set('Authorization', `Bearer ${toolSecret}`)
    .send({ phone: org.patientPhone, date: when.date, time: when.time });

  const envelope = jsonBody<{ ok: boolean; message: string; data: { appointmentId: string } }>(
    response,
  );

  if (!envelope.ok) {
    throw new Error(`audit guard could not book by voice: ${envelope.message}`);
  }

  return envelope.data.appointmentId;
};

/** Books a fresh appointment for the recipes that need one to act on. */
const bookForAudit = async (token: string): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${token}`)
    .send({
      patientId: org.ids.patients,
      doctorId: org.ids.doctors,
      serviceId: org.ids.services,
      startAt: nextBookableStart(),
    });

  if (response.status !== 201) {
    throw new Error(`audit guard could not book: ${response.status}`);
  }

  return jsonBody<{ appointmentId: string }>(response).appointmentId;
};

describe('every PHI-sensitive route is audited', () => {
  const routes = getRegisteredRoutes();
  const phiRoutes = routes.filter((route) => route.phiSensitive);

  it('found the registered routes', () => {
    expect(routes.length).toBeGreaterThan(0);
    expect(phiRoutes.length).toBeGreaterThan(0);
  });

  it('declares phiSensitive explicitly on every route', () => {
    // Optional would default to "not sensitive", which is the wrong default for a
    // product whose whole surface is near patient data.
    for (const route of routes) {
      expect(typeof route.phiSensitive).toBe('boolean');
    }
  });

  it('gives every PHI-sensitive route an audit action', () => {
    const unaudited = phiRoutes
      .filter((route) => route.auditAction === undefined || route.auditAction.length === 0)
      .map(keyOf);

    expect(unaudited).toEqual([]);
  });

  it('has a recipe for every PHI-sensitive route, so none can ship unproven', () => {
    const withoutRecipe = phiRoutes.filter((route) => !RECIPES.has(keyOf(route))).map(keyOf);

    // If this fails, add a recipe above that drives the new route. Do not delete the
    // route from the list: that is how the defect this guard exists for got in.
    expect(withoutRecipe).toEqual([]);
  });

  it('has no recipe for a route that no longer exists', () => {
    const registered = new Set(phiRoutes.map(keyOf));
    const stale = [...RECIPES.keys()].filter((key) => !registered.has(key));

    expect(stale).toEqual([]);
  });

  it('does not require an audit action on a route that touches no PHI', () => {
    // The guard must not push teams into fake audit entries on, say, a login route,
    // which is audited by the auth module rather than by a route wrapper.
    expect(routes.filter((route) => !route.phiSensitive).length).toBeGreaterThan(0);
  });

  for (const route of getRegisteredRoutes().filter((candidate) => candidate.phiSensitive)) {
    const key = keyOf(route);

    it(`${key} writes its declared audit row when driven`, async () => {
      const drive = RECIPES.get(key);
      const action = route.auditAction;

      // Both are asserted by their own tests above; these keep this one honest rather
      // than silently passing on a missing recipe.
      expect(drive).toBeDefined();
      expect(action).toBeDefined();
      if (drive === undefined || action === undefined) {
        return;
      }

      const driven = await drive();
      const before = await auditRowCount(action, driven.actorUserId);
      const again = await drive();
      const after = await auditRowCount(action, again.actorUserId);

      expect(driven.status).toBeLessThan(400);
      expect(again.status).toBeLessThan(400);
      // The row, attributed to the actor who made the request. A route that declares an
      // action and records nothing fails here, which the descriptor check could not see.
      expect(after).toBe(before + 1);
    }, 60_000);
  }
});
