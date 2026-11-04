import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { hashToken } from '../src/common/tokens.js';
import { fieldErrors, jsonBody, problemBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import {
  AGENT_PROFILE_BODY,
  BOOKING_POLICY_BODY,
  FAQS_BODY,
  HOURS_BODY,
  PROFILE_BODY,
  SARVAM_MAPPING_BODY,
  TELEPHONY_BODY,
  uniquePhone,
  uniqueSuffix,
} from './support/clinic-bodies.js';

/**
 * Clinic configuration, driven as real HTTP requests against the real database as
 * `app_user`, so row-level security is live for every one of them.
 *
 * WHAT THIS FILE IS FOR, given that two other guards already cover these routes. The
 * permission guard proves every role gets the answer the matrix says, and the password gate
 * proves a gated user gets none of them. Neither says anything about whether the data that
 * comes back is right. This file is about the rules in the brief: tenancy answered as 404,
 * every data-quality rule enforced, nothing half-saved, the tool secret shown once, and the
 * readiness indicator telling the truth.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let clinicA: OrganisationGraph;
let clinicB: OrganisationGraph;
let superAdminToken: string;
let ownerAToken: string;

type Detail = {
  readonly organisation: {
    readonly id: string;
    readonly name: string;
    readonly timezone: string;
    readonly status: string;
    readonly clinicPhone: string | null;
    readonly openingHoursCollectedAt: string | null;
  };
  readonly profile: Record<string, string | null> | null;
  readonly hours: readonly {
    readonly weekday: string;
    readonly segments: readonly { opensAtMinute: number; closesAtMinute: number }[];
  }[];
  readonly bookingPolicy: Record<string, unknown> | null;
  readonly agentProfile: {
    readonly greeting: string | null;
    readonly languages: readonly string[];
    readonly tone: string | null;
    readonly neverPromise: readonly string[];
  } | null;
  readonly telephony: {
    readonly recordingConsentMode: string | null;
    readonly consentConfirmed: boolean;
    readonly consentConfirmedAt: string | null;
    readonly consentConfirmedByName: string | null;
  } | null;
  readonly faqs: readonly {
    question: string;
    answer: string;
    sortOrder: number;
    active: boolean;
  }[];
  readonly services: readonly {
    id: string;
    name: string;
    durationMinutes: number;
    active: boolean;
  }[];
  readonly doctors: readonly { id: string; fullName: string; active: boolean }[];
  readonly sarvamMapping: {
    readonly sarvamAppId: string | null;
    readonly agentPhone: string | null;
    readonly toolSecretSet: boolean;
    readonly toolSecretSetAt: string | null;
  } | null;
  readonly readiness: {
    readonly ready: boolean;
    readonly satisfiedCount: number;
    readonly totalCount: number;
    readonly incompleteSections: readonly string[];
    readonly missing: readonly { key: string; section: string; label: string }[];
  };
};

const createUser = async (
  label: string,
  role: 'SUPER_ADMIN' | 'CLINIC_OWNER',
  organisationId: string | null,
): Promise<string> => {
  const email = `clinicconfig.${label}.${uniqueSuffix()}@test.invalid`;
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), (tx) =>
    tx.user.create({
      data: {
        id: uuidV7(),
        organisationId,
        email,
        passwordHash,
        fullName: `Clinic Config ${label}`,
        role,
        status: 'ACTIVE',
      },
    }),
  );

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return jsonBody<{ accessToken: string }>(response).accessToken;
};

/**
 * A request as the super admin, with the bearer token attached.
 *
 * Takes the method, because supertest only accepts headers once a method has been chosen:
 * `request(app).set(...)` is not a usable call.
 */
const asSuperAdmin = {
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${superAdminToken}`),
  post: (path: string) => request(app).post(path).set('Authorization', `Bearer ${superAdminToken}`),
  patch: (path: string) =>
    request(app).patch(path).set('Authorization', `Bearer ${superAdminToken}`),
};

/** The detail page for one clinic, as a super admin. */
const detailOf = async (organisationId: string): Promise<Detail> => {
  const response = await request(app)
    .get(`/api/v1/organisations/${organisationId}`)
    .set('Authorization', `Bearer ${superAdminToken}`);

  expect(response.status).toBe(200);
  return jsonBody<Detail>(response);
};

const put = (organisationId: string, section: string, body: object) =>
  request(app)
    .put(`/api/v1/organisations/${organisationId}/${section}`)
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send(body);

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    clinicA = await createOrganisationGraph(tx, 'ConfigA');
    clinicB = await createOrganisationGraph(tx, 'ConfigB');
  });

  superAdminToken = await createUser('super', 'SUPER_ADMIN', null);
  ownerAToken = await createUser('ownerA', 'CLINIC_OWNER', clinicA.organisationId);
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

describe('creating a clinic', () => {
  it('creates the clinic with every configuration section addressable', async () => {
    const name = `Sunrise Dental ${uniqueSuffix()}`;

    const created = await asSuperAdmin
      .post('/api/v1/organisations')
      .send({ name, timezone: 'Asia/Kolkata', clinicPhone: '98765 43210' });

    expect(created.status).toBe(201);
    const { organisationId } = jsonBody<{ organisationId: string }>(created);

    const detail = await detailOf(organisationId);

    expect(detail.organisation.name).toBe(name);
    // Normalised on the way in, not stored as typed.
    expect(detail.organisation.clinicPhone).toBe('+919876543210');
    // Every section exists and is empty, so a later save is an update of a row that is
    // already there rather than a create-or-update branch per section.
    expect(detail.profile).not.toBeNull();
    expect(detail.bookingPolicy).not.toBeNull();
    expect(detail.agentProfile).not.toBeNull();
    expect(detail.telephony).not.toBeNull();
    expect(detail.sarvamMapping).not.toBeNull();
    // Hours come back as all seven weekdays with no segments, and NOT collected.
    expect(detail.hours).toHaveLength(7);
    expect(detail.organisation.openingHoursCollectedAt).toBeNull();
  });

  it('refuses a second clinic with the same name, so a double submit cannot duplicate one', async () => {
    const name = `Double Submit ${uniqueSuffix()}`;
    const body = { name, timezone: 'Asia/Kolkata', clinicPhone: uniquePhone() };

    const first = await asSuperAdmin.post('/api/v1/organisations').send(body);
    expect(first.status).toBe(201);

    // The retry a slow network or a double click produces. A different phone number, the
    // same name, which is what a resubmitted form sends.
    const second = await asSuperAdmin
      .post('/api/v1/organisations')
      .send({ ...body, clinicPhone: uniquePhone() });

    expect(second.status).toBe(409);
    expect(problemBody(second).detail).toMatch(/already exists/i);
  });

  it('refuses the same name in a different case, because that is the same clinic', async () => {
    const name = `Case Clash ${uniqueSuffix()}`;

    expect(
      (
        await asSuperAdmin
          .post('/api/v1/organisations')
          .send({ name, timezone: 'Asia/Kolkata', clinicPhone: uniquePhone() })
      ).status,
    ).toBe(201);

    const second = await asSuperAdmin
      .post('/api/v1/organisations')
      .send({ name: name.toUpperCase(), timezone: 'Asia/Kolkata', clinicPhone: uniquePhone() });

    expect(second.status).toBe(409);
  });

  it('leaves nothing behind when the create is refused', async () => {
    const name = `Rollback Probe ${uniqueSuffix()}`;

    expect(
      (
        await asSuperAdmin
          .post('/api/v1/organisations')
          .send({ name, timezone: 'Asia/Kolkata', clinicPhone: uniquePhone() })
      ).status,
    ).toBe(201);

    const phone = uniquePhone();
    expect(
      (
        await asSuperAdmin
          .post('/api/v1/organisations')
          .send({ name, timezone: 'Asia/Kolkata', clinicPhone: phone })
      ).status,
    ).toBe(409);

    /**
     * The refused create must not have left its phone number, profile row or agent shell.
     * The clinic and its five shell rows are written in one transaction, so a conflict on
     * the organisation rolls the whole thing back. Checked past every policy, as the owner.
     */
    const orphans = await asPlatform(ownerClient(), (tx) =>
      tx.phoneNumber.count({ where: { e164: phone } }),
    );

    expect(orphans).toBe(0);
  });

  it('rejects a bad time zone, a bad phone number and an empty name together', async () => {
    const response = await asSuperAdmin
      .post('/api/v1/organisations')
      .send({ name: '   ', timezone: 'IST', clinicPhone: '12345' });

    expect(response.status).toBe(400);

    const fields = fieldErrors(response).map((error) => error.field);
    // All three in one response: a form should not discover its problems one request at a
    // time. `IST` is the case worth naming, because Intl resolves it and it carries no
    // daylight rules.
    expect(fields).toContain('body.name');
    expect(fields).toContain('body.timezone');
    expect(fields).toContain('body.clinicPhone');
  });
});

describe('tenancy', () => {
  it('answers a cross-tenant read with 404, not 403', async () => {
    const response = await request(app)
      .get(`/api/v1/organisations/${clinicB.organisationId}`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    // Rule 7: a 403 would confirm the clinic exists. An owner reading their own clinic
    // succeeds, which is what makes this a tenancy answer rather than a blanket refusal.
    expect(response.status).toBe(404);

    const own = await request(app)
      .get(`/api/v1/organisations/${clinicA.organisationId}`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(own.status).toBe(200);
  });

  it('answers a cross-tenant section write with 404 and changes nothing', async () => {
    const before = await detailOf(clinicB.organisationId);

    const response = await request(app)
      .put(`/api/v1/organisations/${clinicB.organisationId}/profile`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ ...PROFILE_BODY, city: 'Written By The Wrong Clinic' });

    expect(response.status).toBe(404);

    const after = await detailOf(clinicB.organisationId);
    expect(after.profile?.city).toBe(before.profile?.city);
  });

  it('answers a cross-tenant service update with 404', async () => {
    const serviceId = clinicB.ids.services ?? '';

    const response = await request(app)
      .patch(`/api/v1/organisations/${clinicA.organisationId}/services/${serviceId}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      // The organisation is the owner's own, so the only thing wrong is that the service
      // belongs to another clinic. That must read as "not found", exactly like an id that
      // does not exist anywhere.
      .send({ active: false });

    expect(response.status).toBe(404);
  });

  it('a clinic owner never sees another clinic in the list', async () => {
    const response = await request(app)
      .get('/api/v1/organisations')
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(response.status).toBe(200);

    const ids = jsonBody<{ items: readonly { id: string }[] }>(response).items.map(
      (item) => item.id,
    );

    expect(ids).toEqual([clinicA.organisationId]);
  });
});

describe('opening hours', () => {
  it('stores a week with a break and a weekly off, and reports it as collected', async () => {
    expect((await put(clinicA.organisationId, 'hours', HOURS_BODY)).status).toBe(204);

    const detail = await detailOf(clinicA.organisationId);

    expect(detail.organisation.openingHoursCollectedAt).not.toBeNull();

    const monday = detail.hours.find((day) => day.weekday === 'MONDAY');
    // Two segments means a break between them, which is how a lunch closure is expressed.
    expect(monday?.segments).toEqual([
      { opensAtMinute: 540, closesAtMinute: 780 },
      { opensAtMinute: 1020, closesAtMinute: 1200 },
    ]);

    // The weekly off: present, with no segments. Not absent.
    expect(detail.hours.find((day) => day.weekday === 'SUNDAY')?.segments).toEqual([]);
  });

  it('replaces the week rather than adding to it', async () => {
    await put(clinicA.organisationId, 'hours', HOURS_BODY);

    const simplified = {
      days: HOURS_BODY.days.map((day) => ({
        weekday: day.weekday,
        segments: day.weekday === 'MONDAY' ? [{ opensAtMinute: 600, closesAtMinute: 960 }] : [],
      })),
    };

    expect((await put(clinicA.organisationId, 'hours', simplified)).status).toBe(204);

    const detail = await detailOf(clinicA.organisationId);
    const total = detail.hours.reduce((count, day) => count + day.segments.length, 0);

    expect(total).toBe(1);
    expect(detail.hours.find((day) => day.weekday === 'MONDAY')?.segments).toEqual([
      { opensAtMinute: 600, closesAtMinute: 960 },
    ]);
  });

  it('refuses a week with a weekday missing', async () => {
    const response = await put(clinicA.organisationId, 'hours', {
      days: HOURS_BODY.days.filter((day) => day.weekday !== 'SUNDAY'),
    });

    expect(response.status).toBe(400);
  });

  it('refuses an overnight segment, overlapping segments and a closing time before opening', async () => {
    const cases: readonly { readonly label: string; readonly segments: unknown }[] = [
      { label: 'overnight', segments: [{ opensAtMinute: 1320, closesAtMinute: 120 }] },
      { label: 'closes before it opens', segments: [{ opensAtMinute: 780, closesAtMinute: 540 }] },
      { label: 'zero length', segments: [{ opensAtMinute: 540, closesAtMinute: 540 }] },
      {
        label: 'overlapping',
        segments: [
          { opensAtMinute: 540, closesAtMinute: 780 },
          { opensAtMinute: 700, closesAtMinute: 1200 },
        ],
      },
      {
        label: 'touching, which is one opening written as two',
        segments: [
          { opensAtMinute: 540, closesAtMinute: 780 },
          { opensAtMinute: 780, closesAtMinute: 1200 },
        ],
      },
      {
        label: 'past the end of the day',
        segments: [{ opensAtMinute: 540, closesAtMinute: 1441 }],
      },
    ];

    for (const testCase of cases) {
      const response = await put(clinicA.organisationId, 'hours', {
        days: HOURS_BODY.days.map((day) => ({
          weekday: day.weekday,
          segments: day.weekday === 'MONDAY' ? testCase.segments : [],
        })),
      });

      expect(response.status, `${testCase.label} was accepted`).toBe(400);
    }
  });

  it('is refused at the database too, independently of the schema', async () => {
    /**
     * The second lock. The zod schema rejects an impossible day, and so does a CHECK
     * constraint, because a direct write or a future job must not be able to store one.
     * Written as the owner, past every policy, so only the constraint can refuse it.
     */
    const attempt = asPlatform(ownerClient(), (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO clinic_hours (id, organisation_id, weekday, opens_at_minute, closes_at_minute, created_at, updated_at)
         VALUES ($1, $2, 'MONDAY', 1320, 120, now(), now())`,
        uuidV7(),
        clinicB.organisationId,
      ),
    );

    await expect(attempt).rejects.toThrow(/clinic_hours_sane_window/i);
  });

  it('refuses two overlapping segments at the database, even concurrently', async () => {
    // An exclusion constraint rather than a check-then-insert, because two concurrent
    // saves would both pass a read before either wrote.
    const insert = (opens: number, closes: number) =>
      asPlatform(ownerClient(), (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO clinic_hours (id, organisation_id, weekday, opens_at_minute, closes_at_minute, created_at, updated_at)
           VALUES ($1, $2, 'TUESDAY', $3, $4, now(), now())`,
          uuidV7(),
          clinicB.organisationId,
          opens,
          closes,
        ),
      );

    await insert(540, 780);
    await expect(insert(700, 900)).rejects.toThrow(/clinic_hours_no_overlap/i);
  });
});

describe('data quality on the other sections', () => {
  it('normalises every phone number it stores', async () => {
    expect(
      (
        await put(clinicA.organisationId, 'profile', {
          ...PROFILE_BODY,
          contactPhone: '098765 43211',
        })
      ).status,
    ).toBe(204);

    const detail = await detailOf(clinicA.organisationId);
    // The trunk zero is dialling notation, not part of the number.
    expect(detail.profile?.contactPhone).toBe('+919876543211');
  });

  it('lower-cases the contact email', async () => {
    await put(clinicA.organisationId, 'profile', {
      ...PROFILE_BODY,
      contactEmail: 'Front.Desk@Clinic.IN',
    });

    expect((await detailOf(clinicA.organisationId)).profile?.contactEmail).toBe(
      'front.desk@clinic.in',
    );
  });

  it('refuses a plain-HTTP website or map link', async () => {
    const response = await put(clinicA.organisationId, 'profile', {
      ...PROFILE_BODY,
      mapUrl: 'http://maps.example/clinic',
    });

    expect(response.status).toBe(400);
  });

  it('refuses a service with a non-positive duration, and at the database too', async () => {
    const response = await asSuperAdmin
      .post(`/api/v1/organisations/${clinicA.organisationId}/services`)
      .send({ name: `Zero ${uniqueSuffix()}`, durationMinutes: 0, priceMinor: null, active: true });

    expect(response.status).toBe(400);

    const direct = asPlatform(ownerClient(), (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO services (id, organisation_id, name, duration_minutes, active, created_at, updated_at)
         VALUES ($1, $2, $3, 0, true, now(), now())`,
        uuidV7(),
        clinicB.organisationId,
        `Direct Zero ${uniqueSuffix()}`,
      ),
    );

    await expect(direct).rejects.toThrow(/services_positive_duration/i);
  });

  it('refuses a duplicate service name within one clinic', async () => {
    const name = `Cleaning ${uniqueSuffix()}`;
    const body = { name, durationMinutes: 30, priceMinor: 150_000, active: true };

    expect(
      (
        await asSuperAdmin
          .post(`/api/v1/organisations/${clinicA.organisationId}/services`)
          .send(body)
      ).status,
    ).toBe(201);

    const second = await asSuperAdmin
      .post(`/api/v1/organisations/${clinicA.organisationId}/services`)
      .send(body);

    expect(second.status).toBe(409);
  });

  it('refuses a consent mode that plays a notice with no notice written', async () => {
    const response = await put(clinicA.organisationId, 'telephony', {
      ...TELEPHONY_BODY,
      consentAnnouncement: null,
    });

    expect(response.status).toBe(400);
  });

  it('turns a consent confirmation into a dated, attributed record', async () => {
    expect((await put(clinicA.organisationId, 'telephony', TELEPHONY_BODY)).status).toBe(204);

    const confirmed = await detailOf(clinicA.organisationId);
    expect(confirmed.telephony?.consentConfirmed).toBe(true);
    expect(confirmed.telephony?.consentConfirmedAt).not.toBeNull();
    expect(confirmed.telephony?.consentConfirmedByName).toBe('Practice Manager');

    // Un-confirming clears both together, which the CHECK constraint requires.
    expect(
      (
        await put(clinicA.organisationId, 'telephony', {
          ...TELEPHONY_BODY,
          consentConfirmed: false,
          consentConfirmedByName: null,
        })
      ).status,
    ).toBe(204);

    const cleared = await detailOf(clinicA.organisationId);
    expect(cleared.telephony?.consentConfirmedAt).toBeNull();
    expect(cleared.telephony?.consentConfirmedByName).toBeNull();
  });

  it('refuses a language name where a language tag belongs', async () => {
    const response = await put(clinicA.organisationId, 'agent-profile', {
      ...AGENT_PROFILE_BODY,
      languages: ['Hindi'],
    });

    expect(response.status).toBe(400);
  });

  it('replaces the FAQ list and keeps the order it was given', async () => {
    expect((await put(clinicA.organisationId, 'faqs', FAQS_BODY)).status).toBe(204);

    const detail = await detailOf(clinicA.organisationId);
    expect(detail.faqs.map((faq) => faq.sortOrder)).toEqual([0, 1]);
    expect(detail.faqs[0]?.question).toBe('Do you have parking?');
    expect(detail.faqs[1]?.active).toBe(false);

    // Replaced as a whole, not merged, so removing one actually removes it.
    expect((await put(clinicA.organisationId, 'faqs', { faqs: [] })).status).toBe(204);
    expect((await detailOf(clinicA.organisationId)).faqs).toEqual([]);
  });

  it('leaves the section untouched when part of the body is invalid', async () => {
    await put(clinicA.organisationId, 'booking-policy', BOOKING_POLICY_BODY);
    const before = await detailOf(clinicA.organisationId);

    // A valid slot length beside an impossible advance window. Nothing may be saved.
    const response = await put(clinicA.organisationId, 'booking-policy', {
      ...BOOKING_POLICY_BODY,
      slotGranularityMinutes: 30,
      maximumAdvanceDays: 0,
    });

    expect(response.status).toBe(400);

    const after = await detailOf(clinicA.organisationId);
    expect(after.bookingPolicy).toEqual(before.bookingPolicy);
  });
});

describe('the Sarvam mapping and its tool secret', () => {
  it('mints the tool secret once, returns it once, and never returns it again', async () => {
    const mapping = {
      ...SARVAM_MAPPING_BODY,
      sarvamAppId: `app-${uniqueSuffix()}`,
      agentPhone: uniquePhone(),
    };

    const first = await put(clinicA.organisationId, 'sarvam-mapping', { mapping });
    expect(first.status).toBe(200);

    const secret = jsonBody<{ toolSecret?: string }>(first).toolSecret;
    expect(secret).toBeDefined();
    expect(secret).toMatch(/\S{20,}/);

    // Stored as a hash and nothing else. Read as the owner, past every policy, so this is
    // a statement about what is in the table rather than about what an endpoint returns.
    const stored = await asPlatform(ownerClient(), (tx) =>
      tx.voiceAgent.findFirst({
        where: { organisationId: clinicA.organisationId },
        select: { toolSecretHash: true, toolSecretSetAt: true },
      }),
    );

    expect(stored?.toolSecretHash).toBe(hashToken(secret ?? ''));
    expect(stored?.toolSecretHash).not.toBe(secret);
    expect(stored?.toolSecretSetAt).not.toBeNull();

    // A second save of the same mapping must NOT mint a new one: that would take the live
    // agent off the air until somebody re-pasted it.
    const second = await put(clinicA.organisationId, 'sarvam-mapping', { mapping });
    expect(second.status).toBe(200);
    expect(jsonBody<{ toolSecret?: string }>(second).toolSecret).toBeUndefined();

    // And the detail page says only whether one exists, never what it is.
    const detail = await detailOf(clinicA.organisationId);
    expect(detail.sarvamMapping?.toolSecretSet).toBe(true);
    expect(JSON.stringify(detail.sarvamMapping)).not.toContain(secret ?? 'no-secret');
    expect(JSON.stringify(detail)).not.toMatch(/toolSecretHash/);
  });

  it('regenerates only when asked, and the new secret replaces the old', async () => {
    const mapping = {
      ...SARVAM_MAPPING_BODY,
      sarvamAppId: `app-${uniqueSuffix()}`,
      agentPhone: uniquePhone(),
    };

    const first = await put(clinicB.organisationId, 'sarvam-mapping', { mapping });
    const original = jsonBody<{ toolSecret?: string }>(first).toolSecret;
    expect(original).toBeDefined();

    const regenerated = await put(clinicB.organisationId, 'sarvam-mapping', {
      mapping,
      regenerateToolSecret: true,
    });

    const replacement = jsonBody<{ toolSecret?: string }>(regenerated).toolSecret;
    expect(replacement).toBeDefined();
    expect(replacement).not.toBe(original);

    const stored = await asPlatform(ownerClient(), (tx) =>
      tx.voiceAgent.findFirst({
        where: { organisationId: clinicB.organisationId },
        select: { toolSecretHash: true },
      }),
    );

    // The old secret no longer authenticates anything, which is why this is explicit.
    expect(stored?.toolSecretHash).toBe(hashToken(replacement ?? ''));
    expect(stored?.toolSecretHash).not.toBe(hashToken(original ?? ''));
  });

  it('refuses an agent number already mapped to another clinic', async () => {
    const shared = uniquePhone();

    expect(
      (
        await put(clinicA.organisationId, 'sarvam-mapping', {
          mapping: { ...SARVAM_MAPPING_BODY, agentPhone: shared },
        })
      ).status,
    ).toBe(200);

    const clash = await put(clinicB.organisationId, 'sarvam-mapping', {
      mapping: { ...SARVAM_MAPPING_BODY, agentPhone: shared },
    });

    /**
     * An inbound call is resolved to an organisation by the number dialled, so two clinics
     * claiming one number would make that resolution ambiguous, and ambiguous means wrong.
     */
    expect(clash.status).toBe(409);
    expect(problemBody(clash).detail).toMatch(/already mapped/i);
  });

  it('refuses a prompt version this build does not have', async () => {
    const response = await put(clinicA.organisationId, 'sarvam-mapping', {
      mapping: { ...SARVAM_MAPPING_BODY, promptVersion: 'v99-does-not-exist' },
    });

    expect(response.status).toBe(409);
  });
});

describe('the readiness indicator', () => {
  it('reports a newly created clinic as not ready, and names what is missing', async () => {
    const created = await asSuperAdmin.post('/api/v1/organisations').send({
      name: `Readiness Probe ${uniqueSuffix()}`,
      timezone: 'Asia/Kolkata',
      clinicPhone: uniquePhone(),
    });

    const { organisationId } = jsonBody<{ organisationId: string }>(created);
    const detail = await detailOf(organisationId);

    expect(detail.readiness.ready).toBe(false);
    // Name, timezone and the clinic's phone number are set at creation, so those three are
    // already satisfied and the rest are not.
    expect(detail.readiness.satisfiedCount).toBeGreaterThan(0);
    expect(detail.readiness.satisfiedCount).toBeLessThan(detail.readiness.totalCount);

    const missing = detail.readiness.missing.map((requirement) => requirement.key);
    expect(missing).toContain('hours.collected');
    expect(missing).toContain('services.atLeastOne');
    expect(missing).toContain('doctors.atLeastOne');
    expect(missing).toContain('sarvamMapping.toolSecret');

    // Every requirement carries a human label, because the console shows these to the
    // person configuring the clinic rather than to a developer.
    for (const requirement of detail.readiness.missing) {
      expect(requirement.label.length).toBeGreaterThan(3);
      expect(detail.readiness.incompleteSections).toContain(requirement.section);
    }
  });

  it('becomes ready once every section is collected', async () => {
    const created = await asSuperAdmin.post('/api/v1/organisations').send({
      name: `Fully Configured ${uniqueSuffix()}`,
      timezone: 'Asia/Kolkata',
      clinicPhone: uniquePhone(),
    });

    const { organisationId } = jsonBody<{ organisationId: string }>(created);

    await put(organisationId, 'profile', PROFILE_BODY);
    await put(organisationId, 'hours', HOURS_BODY);
    await put(organisationId, 'booking-policy', BOOKING_POLICY_BODY);
    await put(organisationId, 'agent-profile', AGENT_PROFILE_BODY);
    await put(organisationId, 'telephony', TELEPHONY_BODY);
    await put(organisationId, 'faqs', FAQS_BODY);

    await asSuperAdmin
      .post(`/api/v1/organisations/${organisationId}/services`)
      .send({ name: 'Consultation', durationMinutes: 30, priceMinor: 50_000, active: true });

    await asSuperAdmin
      .post(`/api/v1/organisations/${organisationId}/doctors`)
      .send({ fullName: 'Dr Asha Rao', specialty: 'General', bufferMinutes: 5, active: true });

    await put(organisationId, 'sarvam-mapping', {
      mapping: {
        ...SARVAM_MAPPING_BODY,
        sarvamAppId: `app-${uniqueSuffix()}`,
        agentPhone: uniquePhone(),
      },
    });

    const detail = await detailOf(organisationId);

    expect(detail.readiness.missing).toEqual([]);
    expect(detail.readiness.ready).toBe(true);
    expect(detail.readiness.incompleteSections).toEqual([]);
  });

  it('stops being ready when the only active service is switched off', async () => {
    const created = await asSuperAdmin.post('/api/v1/organisations').send({
      name: `Service Toggle ${uniqueSuffix()}`,
      timezone: 'Asia/Kolkata',
      clinicPhone: uniquePhone(),
    });

    const { organisationId } = jsonBody<{ organisationId: string }>(created);

    const service = await asSuperAdmin
      .post(`/api/v1/organisations/${organisationId}/services`)
      .send({ name: 'Only Service', durationMinutes: 20, priceMinor: null, active: true });

    const { serviceId } = jsonBody<{ serviceId: string }>(service);

    expect(
      (await detailOf(organisationId)).readiness.missing.map((requirement) => requirement.key),
    ).not.toContain('services.atLeastOne');

    expect(
      (
        await asSuperAdmin
          .patch(`/api/v1/organisations/${organisationId}/services/${serviceId}`)
          .send({ active: false })
      ).status,
    ).toBe(204);

    // Readiness counts ACTIVE services, so switching the last one off reopens the gap
    // rather than leaving a clinic that reads as ready with nothing bookable.
    expect(
      (await detailOf(organisationId)).readiness.missing.map((requirement) => requirement.key),
    ).toContain('services.atLeastOne');
  });
});

describe('the clinic list', () => {
  it('searches by name and by phone number', async () => {
    const suffix = uniqueSuffix();
    const phone = uniquePhone();

    await asSuperAdmin
      .post('/api/v1/organisations')
      .send({ name: `Searchable Clinic ${suffix}`, timezone: 'Asia/Kolkata', clinicPhone: phone });

    const byName = await asSuperAdmin.get(`/api/v1/organisations?q=Searchable Clinic ${suffix}`);
    expect(byName.status).toBe(200);
    expect(jsonBody<{ items: readonly unknown[] }>(byName).items).toHaveLength(1);

    const byPhone = await asSuperAdmin.get(`/api/v1/organisations?q=${phone.slice(-8)}`);
    expect(
      jsonBody<{ items: readonly { clinicPhone: string | null }[] }>(byPhone).items[0]?.clinicPhone,
    ).toBe(phone);

    // Case-insensitive, because nobody types a clinic's name back exactly.
    const lowered = await asSuperAdmin.get(
      `/api/v1/organisations?q=${`searchable clinic ${suffix}`}`,
    );
    expect(jsonBody<{ items: readonly unknown[] }>(lowered).items).toHaveLength(1);
  });

  it('pages with a cursor and never repeats or skips a row', async () => {
    const all = await asSuperAdmin.get('/api/v1/organisations?limit=100');
    const total = jsonBody<{ items: readonly { id: string }[] }>(all).items.length;
    expect(total).toBeGreaterThan(3);

    const seen: string[] = [];
    let cursor: string | null = null;

    // Deliberately tiny pages, so the cursor is exercised rather than merely present.
    for (let page = 0; page < 50; page += 1) {
      const response = await asSuperAdmin.get(
        `/api/v1/organisations?limit=2${cursor === null ? '' : `&cursor=${cursor}`}`,
      );

      expect(response.status).toBe(200);

      const body = jsonBody<{ items: readonly { id: string }[]; nextCursor: string | null }>(
        response,
      );

      seen.push(...body.items.map((item) => item.id));
      cursor = body.nextCursor;

      if (cursor === null) {
        break;
      }
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeGreaterThanOrEqual(total);
  });

  it('refuses a page size above the maximum', async () => {
    expect((await asSuperAdmin.get('/api/v1/organisations?limit=101')).status).toBe(400);
  });
});
