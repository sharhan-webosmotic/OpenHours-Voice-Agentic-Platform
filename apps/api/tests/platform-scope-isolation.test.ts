import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
/**
 * The REAL `asOrganisationSystem`, from the application, not a test helper.
 *
 * That is the point of the file: the helpers in `support/db.ts` use an unextended client, so
 * driving them would prove nothing about the extension that does the confining.
 */
import { asOrganisationSystem } from '../src/db/tenant-client.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import * as patients from '../src/modules/patients/patients.repository.js';
import * as appointments from '../src/modules/appointments/appointments.repository.js';
import type { TenantDb } from '../src/db/tenant-client.js';

/**
 * No repository function returns another clinic's rows under a platform scope.
 *
 * ─── WHY THIS FILE EXISTS, STATED PLAINLY ───────────────────────────────────────
 *
 * A clinic user's query has two locks: the client extension injects `organisation_id`, and
 * row-level security refuses anything that slips past it. A PLATFORM user's query, which the
 * matrix allows for a masked read of patients and appointments, had neither: `asSystem` sets
 * `app.platform = 'on'`, which switches row-level security off for the connection, and the
 * extension injected nothing. Confinement to one clinic rested entirely on every repository
 * function remembering to put `organisationId` in its `where`.
 *
 * That is a convention, not a control. A function added in a later feature without the filter
 * would return every clinic's patients, and no existing test would notice. So the lock moved
 * back into the extension, through the `platform-organisation` scope, and this file is the
 * proof that it holds for each function rather than in principle.
 *
 * ─── HOW TO SABOTAGE IT, WHICH IS HOW TO TRUST IT ───────────────────────────────
 *
 * Delete the `platform-organisation` branch from `src/db/tenant-extension.ts`, so that scope
 * falls through uninjected like plain platform scope does, and every `sees nothing of the
 * other clinic` case below fails. Removing one repository function's own `organisationId`
 * filter does NOT fail them, and that is the point: the filters are a second layer, and the
 * extension is the control.
 */

let own: OrganisationGraph;
let other: OrganisationGraph;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    own = await createOrganisationGraph(tx, 'PlatformScopeOwn');
    other = await createOrganisationGraph(tx, 'PlatformScopeOther');
  });
}, 240_000);

afterAll(async () => {
  await disconnectAll();
});

/**
 * Every read a repository exposes, as a named case.
 *
 * ENUMERATED BY HAND AND CHECKED AGAINST THE MODULE'S EXPORTS BELOW. A hand-written list
 * drifts, so the test after this one asserts that the list covers every exported function
 * whose first two parameters are a database and an organisation id. A new repository read is
 * therefore a failing test until somebody decides how to prove it.
 */
const CASES: readonly {
  readonly name: string;
  readonly run: (db: TenantDb, organisationId: string) => Promise<unknown>;
  /**
   * An expectation of its own, for the one function whose result echoes its input.
   *
   * `appointmentBounds` answers "for each of these patient ids, when was the last visit and
   * when is the next", so it returns a row per id it was GIVEN, including ids it found
   * nothing for. The id in that row is the caller's own input rather than something read from
   * the database, so the default check (does the result mention the other clinic) flags it
   * while nothing has leaked. What matters is that both dates are null, which is what proves
   * the grouped query underneath was confined.
   */
  readonly expect?: (result: unknown) => void;
}[] = [
  {
    name: 'patients.findById',
    run: (db, organisationId) => patients.findById(db, organisationId, other.ids.patients ?? ''),
  },
  {
    name: 'patients.list',
    run: (db, organisationId) => patients.list(db, { organisationId, take: 50, sort: 'recent' }),
  },
  {
    name: 'patients.list with a search',
    run: (db, organisationId) =>
      patients.list(db, { organisationId, take: 50, sort: 'name', search: 'Patient' }),
  },
  {
    name: 'patients.appointmentHistory',
    run: (db, organisationId) =>
      patients.appointmentHistory(db, organisationId, other.ids.patients ?? '', 50),
  },
  {
    name: 'patients.appointmentBounds',
    run: (db, organisationId) =>
      patients.appointmentBounds(db, organisationId, [other.ids.patients ?? ''], new Date()),
    expect: (result) => {
      const rows = result as readonly {
        readonly lastAppointmentAt: Date | null;
        readonly nextAppointmentAt: Date | null;
      }[];

      // The other clinic's patient HAS an appointment in the fixture, so a leak here would
      // show as a date rather than as a missing row.
      expect(rows).toHaveLength(1);
      expect(rows[0]?.lastAppointmentAt).toBeNull();
      expect(rows[0]?.nextAppointmentAt).toBeNull();
    },
  },
  {
    name: 'patients.doctorHasSeenPatient',
    run: (db, organisationId) =>
      patients.doctorHasSeenPatient(
        db,
        organisationId,
        other.ids.doctors ?? '',
        other.ids.patients ?? '',
      ),
  },
  {
    name: 'patients.findDoctorIdForUser',
    run: (db, organisationId) =>
      patients.findDoctorIdForUser(db, organisationId, other.ids.users ?? ''),
  },
  {
    name: 'appointments.findById',
    run: (db, organisationId) =>
      appointments.findById(db, organisationId, other.ids.appointments ?? ''),
  },
  {
    name: 'appointments.list',
    run: (db, organisationId) => appointments.list(db, { organisationId, take: 50 }),
  },
  {
    name: 'appointments.statusCounts',
    run: (db, organisationId) =>
      appointments.statusCounts(db, {
        organisationId,
        from: new Date('2000-01-01T00:00:00.000Z'),
        to: new Date('2100-01-01T00:00:00.000Z'),
      }),
  },
  {
    name: 'appointments.findByIdempotencyKey',
    run: (db, organisationId) =>
      appointments.findByIdempotencyKey(db, organisationId, 'platform-scope-probe'),
  },
  {
    name: 'appointments.dayOccupancy',
    run: (db, organisationId) =>
      appointments.dayOccupancy(
        db,
        organisationId,
        other.ids.doctors ?? '',
        new Date('2000-01-01T00:00:00.000Z'),
        new Date('2100-01-01T00:00:00.000Z'),
      ),
  },
  {
    name: 'appointments.bookingTargets',
    run: (db, organisationId) =>
      appointments.bookingTargets(
        db,
        organisationId,
        other.ids.patients ?? '',
        other.ids.doctors ?? '',
        other.ids.services ?? '',
      ),
  },
  {
    name: 'appointments.slotInputs',
    run: (db, organisationId) =>
      appointments.slotInputs(
        db,
        organisationId,
        other.ids.doctors ?? '',
        other.ids.services ?? '',
      ),
  },
];

/**
 * Whether a value mentions the other clinic anywhere inside it.
 *
 * The shapes differ per function: a row, an array of rows, a count, a boolean, a nested
 * object of six loads. Serialising and looking for the other organisation's ids catches every
 * one of them without this file knowing any of the shapes, and a row of the other clinic
 * always carries at least one of those ids.
 */
const mentionsOtherClinic = (value: unknown): boolean => {
  const serialised = JSON.stringify(value ?? null);
  const foreignIds = [other.organisationId, ...Object.values(other.ids)].filter(
    (id): id is string => typeof id === 'string' && id !== '',
  );

  return foreignIds.some((id) => serialised.includes(id));
};

/**
 * The cases that prove WHERE the control lives.
 *
 * Everything above calls a repository function, which applies its own `organisation_id`
 * filter as well, so those cases pass as long as EITHER layer holds. These issue the query
 * the way a repository function that forgot its filter would, so they can only pass if the
 * extension is injecting. They are the reason a missing filter in a function written next
 * year is contained rather than catastrophic.
 */
describe('a repository function that forgets its own filter', () => {
  const unfiltered: readonly {
    readonly name: string;
    readonly run: (db: TenantDb) => Promise<readonly unknown[]>;
  }[] = [
    { name: 'patient.findMany', run: (db) => db.patient.findMany({ select: { id: true } }) },
    {
      name: 'appointment.findMany',
      run: (db) => db.appointment.findMany({ select: { id: true } }),
    },
    { name: 'doctor.findMany', run: (db) => db.doctor.findMany({ select: { id: true } }) },
    { name: 'service.findMany', run: (db) => db.service.findMany({ select: { id: true } }) },
    {
      name: 'clinicHours.findMany',
      run: (db) => db.clinicHours.findMany({ select: { id: true } }),
    },
  ];

  for (const probe of unfiltered) {
    it(`${probe.name} with no organisation filter still sees only the scoped clinic`, async () => {
      const rows = await asOrganisationSystem(
        `platform-scope-isolation unfiltered ${probe.name}`,
        own.organisationId,
        (db) => probe.run(db),
      );

      // Both clinics hold a row in every one of these tables, so a result that is not
      // confined contains at least two and includes the other clinic's id.
      expect(mentionsOtherClinic(rows)).toBe(false);
      expect(rows.length).toBeGreaterThan(0);
    }, 120_000);
  }

  /**
   * An aggregate leaks a NUMBER rather than a row, so it needs its own assertion.
   *
   * `groupBy` and `count` return no ids at all, which means the id check above cannot see a
   * leak in them: an inflated count looks exactly like a correct one. Comparing the
   * unfiltered aggregate against the explicitly filtered one is what catches it, and a count
   * of another clinic's appointments is itself disclosure, so it is worth catching.
   */
  it('counts only the scoped clinic, even though a count carries no ids to inspect', async () => {
    const { unscoped, scoped, grouped } = await asOrganisationSystem(
      'platform-scope-isolation aggregates',
      own.organisationId,
      async (db) => ({
        unscoped: await db.appointment.count({}),
        scoped: await db.appointment.count({ where: { organisationId: own.organisationId } }),
        grouped: await db.appointment.groupBy({ by: ['status'], _count: { _all: true } }),
      }),
    );

    expect(unscoped).toBe(scoped);
    expect(grouped.reduce((total, row) => total + row._count._all, 0)).toBe(scoped);
  }, 120_000);

  it('reads the other clinic when that clinic is the one named, so this is scope and not a filter on one id', async () => {
    const rows = await asOrganisationSystem(
      'platform-scope-isolation other clinic',
      other.organisationId,
      (db) => db.patient.findMany({ select: { id: true } }),
    );

    expect(rows.map((row) => row.id)).toContain(other.ids.patients);
  }, 120_000);
});

describe('a platform scope confined to one organisation', () => {
  for (const testCase of CASES) {
    it(`${testCase.name} sees nothing of the other clinic`, async () => {
      /**
       * Asked for the OTHER clinic's rows, by id, while scoped to `own`.
       *
       * Every case passes the other organisation's ids deliberately. Under a correct scope
       * the answer is nothing: not an error, not a refusal, just no rows, which is what rule 7
       * requires a cross-tenant read to look like.
       */
      const result = await asOrganisationSystem(
        `platform-scope-isolation ${testCase.name}`,
        own.organisationId,
        (db) => testCase.run(db, own.organisationId),
      );

      if (testCase.expect === undefined) {
        expect(mentionsOtherClinic(result)).toBe(false);
      } else {
        testCase.expect(result);
      }
    }, 120_000);
  }

  it('still reads its OWN clinic, so the scope is confining rather than breaking', async () => {
    // A test that only proves "returns nothing" would pass with a scope that returns nothing
    // for everyone, which would be isolation by breakage.
    const patient = await asOrganisationSystem(
      'platform-scope-isolation positive control',
      own.organisationId,
      (db) => patients.findById(db, own.organisationId, own.ids.patients ?? ''),
    );

    expect(patient?.id).toBe(own.ids.patients);
  }, 120_000);

  it('covers every repository read that takes an organisation id', () => {
    /**
     * The drift guard. A new read added to either repository without a case here fails this,
     * which is the only moment anyone is still thinking about whether it is confined.
     *
     * Writes are excluded: they are refused for platform roles by the matrix before any scope
     * is opened, and the permission guard proves that separately for all six roles.
     */
    const writes = new Set(['create', 'update', 'changeStatus']);

    const exported = [
      ...Object.keys(patients).map((name) => `patients.${name}`),
      ...Object.keys(appointments).map((name) => `appointments.${name}`),
    ].filter((name) => {
      const bare = name.split('.')[1] ?? '';
      return !writes.has(bare) && !bare.startsWith('is') && bare !== 'organisationTimeZone';
    });

    const covered = new Set(CASES.map((testCase) => testCase.name.split(' ')[0]));
    const uncovered = exported.filter((name) => !covered.has(name));

    expect(uncovered).toEqual([]);
  });
});
