import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  ACTIONS,
  RESOURCES,
  ROLES,
  isPlatformRole,
  permissionScope,
  type Action,
  type Resource,
  type Role,
} from '@clinicai/shared';
import { createApp } from '../src/app.js';
import { getRegisteredRoutes, type RouteDescriptor } from '../src/common/route-registry.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { markHoursCollected, nextBookableStart } from './support/clinic-schedule.js';
import {
  AGENT_PROFILE_BODY,
  BOOKING_POLICY_BODY,
  HOURS_BODY,
  PROFILE_BODY,
  SARVAM_MAPPING_BODY,
  TELEPHONY_BODY,
  uniquePhone,
  uniqueSuffix,
} from './support/clinic-bodies.js';

/**
 * A route that declares a permission must enforce it, for every role.
 *
 * The `permission` field on a route descriptor used to be decorative: nothing read it,
 * `requirePermission` had one caller, and four routes declared a permission they never
 * checked. Two of those named a resource (`self`, `device`) that is not in the matrix at
 * all. The failure mode is a reviewer reading a plausible string as enforcement, which is
 * the mechanism behind the audit-log defect, and M1-11 was about to copy the pattern
 * across every admin endpoint.
 *
 * Those four declarations are gone. This guard keeps the remaining ones honest, and it is
 * also the answer to the review's 64 untested matrix cells: it will not stop that gap
 * existing, but a NEW route cannot add to it, because declaring a permission now requires
 * a recipe and the recipe is checked against the matrix for all six roles.
 *
 * The granted and denied role sets are DERIVED from the shared matrix rather than listed
 * here. A test that hand-lists them would just be a second transcription of the table and
 * would agree with a wrong one.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let org: OrganisationGraph;
const emailByRole = new Map<Role, string>();

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'DeclaredPerms');

    // Hours must be marked collected, or every booking recipe would be refused for the right
    // reason and the wrong one, and the guard would prove nothing about permissions.
    await markHoursCollected(tx, org.organisationId);

    for (const role of ROLES) {
      const email = `perm.${role.toLowerCase()}.${Date.now()}@test.invalid`;
      emailByRole.set(role, email);

      await tx.user.create({
        data: {
          id: uuidV7(),
          // A platform role belongs to no organisation; a clinic role must have one.
          organisationId: isPlatformRole(role) ? null : org.organisationId,
          email,
          passwordHash,
          fullName: `Perm ${role}`,
          role,
          status: 'ACTIVE',
        },
      });
    }
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const keyOf = (route: RouteDescriptor): string => `${route.method.toUpperCase()} ${route.path}`;

const tokenFor = async (role: Role): Promise<string> => {
  const email = emailByRole.get(role);
  if (email === undefined) {
    throw new Error(`no fixture user for ${role}`);
  }
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return jsonBody<{ accessToken: string }>(response).accessToken;
};

/** Drives one route as the holder of `token`, and returns the status. */
const RECIPES = new Map<string, (token: string) => Promise<number>>([
  [
    'GET /api/v1/audit-logs',
    async (token) => {
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],

  /**
   * Clinic configuration. Fifteen routes across four matrix cells, and the cells are the
   * reason each one needs its own entry rather than a loop: `organisations`,
   * `clinic_settings`, `doctors_services_hours` and `phone_voice_mapping` grant different
   * roles, so the expected answer differs per route and is derived from the matrix above.
   *
   * EVERY BODY HERE IS VALID. A recipe that sent a malformed body would get a 400, which is
   * not a 403, so the test would pass while proving nothing about the permission. The one
   * thing these must not do is fail validation.
   *
   * The ids are unique per call where a unique constraint exists, so a second invocation
   * (the guard drives each route once per role) does not collide and return a 409 for a
   * reason unrelated to permissions.
   */
  [
    'GET /api/v1/organisations',
    async (token) => {
      const response = await request(app)
        .get('/api/v1/organisations')
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],
  [
    'POST /api/v1/organisations',
    async (token) => {
      const response = await request(app)
        .post('/api/v1/organisations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Permission Probe ${uniqueSuffix()}`,
          timezone: 'Asia/Kolkata',
          clinicPhone: uniquePhone(),
        });
      return response.status;
    },
  ],
  [
    'GET /api/v1/organisations/:organisationId',
    async (token) => {
      const response = await request(app)
        .get(`/api/v1/organisations/${org.organisationId}`)
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],
  [
    'PATCH /api/v1/organisations/:organisationId',
    async (token) => {
      const response = await request(app)
        .patch(`/api/v1/organisations/${org.organisationId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ timezone: 'Asia/Kolkata' });
      return response.status;
    },
  ],
  [
    'PUT /api/v1/organisations/:organisationId/profile',
    async (token) => {
      const response = await request(app)
        .put(`/api/v1/organisations/${org.organisationId}/profile`)
        .set('Authorization', `Bearer ${token}`)
        .send(PROFILE_BODY);
      return response.status;
    },
  ],
  [
    'PUT /api/v1/organisations/:organisationId/hours',
    async (token) => {
      const response = await request(app)
        .put(`/api/v1/organisations/${org.organisationId}/hours`)
        .set('Authorization', `Bearer ${token}`)
        .send(HOURS_BODY);
      return response.status;
    },
  ],
  [
    'PUT /api/v1/organisations/:organisationId/booking-policy',
    async (token) => {
      const response = await request(app)
        .put(`/api/v1/organisations/${org.organisationId}/booking-policy`)
        .set('Authorization', `Bearer ${token}`)
        .send(BOOKING_POLICY_BODY);
      return response.status;
    },
  ],
  [
    'PUT /api/v1/organisations/:organisationId/agent-profile',
    async (token) => {
      const response = await request(app)
        .put(`/api/v1/organisations/${org.organisationId}/agent-profile`)
        .set('Authorization', `Bearer ${token}`)
        .send(AGENT_PROFILE_BODY);
      return response.status;
    },
  ],
  [
    'PUT /api/v1/organisations/:organisationId/telephony',
    async (token) => {
      const response = await request(app)
        .put(`/api/v1/organisations/${org.organisationId}/telephony`)
        .set('Authorization', `Bearer ${token}`)
        .send(TELEPHONY_BODY);
      return response.status;
    },
  ],
  [
    'PUT /api/v1/organisations/:organisationId/faqs',
    async (token) => {
      const response = await request(app)
        .put(`/api/v1/organisations/${org.organisationId}/faqs`)
        .set('Authorization', `Bearer ${token}`)
        .send({ faqs: [{ question: 'Parking?', answer: 'Behind the building.', active: true }] });
      return response.status;
    },
  ],
  [
    'PUT /api/v1/organisations/:organisationId/sarvam-mapping',
    async (token) => {
      const response = await request(app)
        .put(`/api/v1/organisations/${org.organisationId}/sarvam-mapping`)
        .set('Authorization', `Bearer ${token}`)
        // No agent phone: it is platform-unique, and a fixed one would collide across the
        // six roles this is driven as, producing a 409 unrelated to permissions.
        .send({ mapping: { ...SARVAM_MAPPING_BODY, sarvamAppId: `app-${uniqueSuffix()}` } });
      return response.status;
    },
  ],
  [
    'POST /api/v1/organisations/:organisationId/services',
    async (token) => {
      const response = await request(app)
        .post(`/api/v1/organisations/${org.organisationId}/services`)
        .set('Authorization', `Bearer ${token}`)
        // Name is unique per organisation, so it varies per call.
        .send({
          name: `Probe Service ${uniqueSuffix()}`,
          durationMinutes: 30,
          priceMinor: null,
          active: true,
        });
      return response.status;
    },
  ],
  [
    'PATCH /api/v1/organisations/:organisationId/services/:serviceId',
    async (token) => {
      const response = await request(app)
        .patch(`/api/v1/organisations/${org.organisationId}/services/${org.ids.services ?? ''}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ active: true });
      return response.status;
    },
  ],
  [
    'POST /api/v1/organisations/:organisationId/doctors',
    async (token) => {
      const response = await request(app)
        .post(`/api/v1/organisations/${org.organisationId}/doctors`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: `Probe Doctor ${uniqueSuffix()}`,
          specialty: null,
          bufferMinutes: 0,
          active: true,
        });
      return response.status;
    },
  ],
  [
    'PATCH /api/v1/organisations/:organisationId/doctors/:doctorId',
    async (token) => {
      const response = await request(app)
        .patch(`/api/v1/organisations/${org.organisationId}/doctors/${org.ids.doctors ?? ''}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ active: true });
      return response.status;
    },
  ],

  /**
   * Patients and appointments.
   *
   * THE PLATFORM ROLES ARE THE INTERESTING PART. The matrix grants SUPER_ADMIN and
   * INTERNAL_ADMIN `read: 'masked'` on both resources, so the guard requires these reads NOT
   * to answer 403 for them. They have no organisation of their own, so every read recipe
   * names one with `?organisationId=`, which is what `common/organisation-scope.ts` requires
   * of a platform principal. A clinic role naming the same id is naming its own clinic, which
   * is allowed.
   *
   * THE WRITE RECIPES SEND VALID BODIES AND REAL SLOTS. A malformed body answers 400, which is
   * not 403, so the guard would pass while proving nothing. Every booking takes a fresh slot
   * from `nextBookableStart`, because the guard drives each recipe once per role and a
   * repeated slot would be refused by the exclusion constraint for a reason unrelated to
   * permissions.
   */
  [
    'GET /api/v1/patients',
    async (token) => {
      const response = await request(app)
        .get(`/api/v1/patients?organisationId=${org.organisationId}`)
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],
  [
    'POST /api/v1/patients',
    async (token) => {
      const response = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Permission Probe Patient',
          phone: uniquePhone(),
          dateOfBirth: '1990-01-01',
          notes: '',
        });
      return response.status;
    },
  ],
  [
    'GET /api/v1/patients/:patientId',
    async (token) => {
      const response = await request(app)
        .get(`/api/v1/patients/${org.ids.patients ?? ''}?organisationId=${org.organisationId}`)
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],
  [
    'PATCH /api/v1/patients/:patientId',
    async (token) => {
      const response = await request(app)
        .patch(`/api/v1/patients/${org.ids.patients ?? ''}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Updated by the permission guard.' });
      return response.status;
    },
  ],
  [
    'GET /api/v1/appointments',
    async (token) => {
      const response = await request(app)
        .get(`/api/v1/appointments?organisationId=${org.organisationId}`)
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],
  [
    'POST /api/v1/appointments',
    async (token) => {
      const response = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: org.ids.patients,
          doctorId: org.ids.doctors,
          serviceId: org.ids.services,
          startAt: nextBookableStart(),
        });
      return response.status;
    },
  ],
  [
    'GET /api/v1/appointments/agenda',
    async (token) => {
      const response = await request(app)
        .get(
          `/api/v1/appointments/agenda?range=week&on=2026-11-02&organisationId=${org.organisationId}`,
        )
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],
  [
    'GET /api/v1/appointments/availability',
    async (token) => {
      const response = await request(app)
        .get(
          `/api/v1/appointments/availability?doctorId=${org.ids.doctors ?? ''}&serviceId=${org.ids.services ?? ''}&date=2026-11-09&organisationId=${org.organisationId}`,
        )
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],
  [
    'GET /api/v1/appointments/:appointmentId',
    async (token) => {
      const response = await request(app)
        .get(
          `/api/v1/appointments/${org.ids.appointments ?? ''}?organisationId=${org.organisationId}`,
        )
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],
  [
    'POST /api/v1/appointments/:appointmentId/cancel',
    async (token) => {
      /**
       * Cancels a FRESH appointment, not the fixture's.
       *
       * The guard drives this once per role and cancelling is terminal, so a shared
       * appointment would answer 409 from the second role onwards. That is not 403, so the
       * guard would still pass, and the same 409 would then hide a real regression. Booking
       * first costs one request and makes every invocation equivalent.
       */
      const id = await bookAsOwner();
      const response = await request(app)
        .post(`/api/v1/appointments/${id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Driven by the permission guard.' });
      return response.status;
    },
  ],
  [
    'POST /api/v1/appointments/:appointmentId/reschedule',
    async (token) => {
      const id = await bookAsOwner();
      const response = await request(app)
        .post(`/api/v1/appointments/${id}/reschedule`)
        .set('Authorization', `Bearer ${token}`)
        .send({ startAt: nextBookableStart(), reason: 'Driven by the permission guard.' });
      return response.status;
    },
  ],
  [
    'POST /api/v1/appointments/:appointmentId/status',
    async (token) => {
      const id = await bookAsOwner();
      const response = await request(app)
        .post(`/api/v1/appointments/${id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' });
      return response.status;
    },
  ],
]);

/**
 * Books an appointment as the clinic owner and returns its id.
 *
 * The owner holds `appointments:write` in every relevant cell of the matrix, so this never
 * fails for a permission reason and the recipe calling it tests only the route it names.
 */
const bookAsOwner = async (): Promise<string> => {
  const token = await tokenFor('CLINIC_OWNER');
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
    throw new Error(`booking failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return jsonBody<{ appointmentId: string }>(response).appointmentId;
};

const parsePermission = (
  value: string,
): { readonly resource: Resource; readonly action: Action } | undefined => {
  const [resource, action, ...rest] = value.split(':');
  if (rest.length > 0 || resource === undefined || action === undefined) {
    return undefined;
  }
  if (!(RESOURCES as readonly string[]).includes(resource)) {
    return undefined;
  }
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return undefined;
  }
  return { resource: resource as Resource, action: action as Action };
};

describe('every declared route permission is a real matrix cell and is enforced', () => {
  const declaring = getRegisteredRoutes().filter((route) => route.permission !== undefined);

  it('found at least one route declaring a permission', () => {
    expect(declaring.length).toBeGreaterThan(0);
  });

  it('declares only permissions that exist in the shared matrix', () => {
    const invalid = declaring
      .filter((route) => parsePermission(route.permission ?? '') === undefined)
      .map((route) => `${keyOf(route)} declares ${String(route.permission)}`);

    // `self:update` and `device:create` failed exactly here: neither resource exists.
    expect(invalid).toEqual([]);
  });

  it('has a recipe for every route declaring a permission', () => {
    const withoutRecipe = declaring.filter((route) => !RECIPES.has(keyOf(route))).map(keyOf);

    // If this fails, add a recipe below that drives the new route with a bearer token.
    // Removing the `permission` field instead is correct ONLY if the route genuinely is
    // not gated by the matrix, and then the comment must say what gates it.
    expect(withoutRecipe).toEqual([]);
  });

  it('has no recipe for a route that no longer declares a permission', () => {
    const declared = new Set(declaring.map(keyOf));
    expect([...RECIPES.keys()].filter((key) => !declared.has(key))).toEqual([]);
  });

  for (const route of getRegisteredRoutes().filter(
    (candidate) => candidate.permission !== undefined,
  )) {
    const key = keyOf(route);

    it(`${key} enforces ${String(route.permission)} for all ${ROLES.length} roles`, async () => {
      const drive = RECIPES.get(key);
      const cell = parsePermission(route.permission ?? '');

      expect(drive).toBeDefined();
      expect(cell).toBeDefined();
      if (drive === undefined || cell === undefined) {
        return;
      }

      const wrong: string[] = [];

      for (const role of ROLES) {
        const scope = permissionScope(role, cell.resource, cell.action);
        const status = await drive(await tokenFor(role));

        if (scope === false) {
          // Denied by the matrix, so the route must refuse. 403 specifically: the
          // resource is not tenant-addressed, so there is nothing to conceal with a 404.
          if (status !== 403) {
            wrong.push(`${role} is denied by the matrix but got ${status}, expected 403`);
          }
          continue;
        }

        // Granted. The status may legitimately be anything that is not a refusal, so
        // this asserts only that the permission check did not reject it.
        if (status === 403) {
          wrong.push(`${role} is granted "${scope}" by the matrix but got 403`);
        }
      }

      expect(wrong).toEqual([]);
    }, 120_000);
  }
});
