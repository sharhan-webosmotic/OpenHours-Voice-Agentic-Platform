import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { uuidV7 } from '../src/common/uuid.js';
import {
  AppointmentSource,
  AppointmentStatus,
  PhoneKind,
  Role,
  UserStatus,
  Weekday,
} from '../src/generated/prisma/enums.js';

/**
 * Idempotent development seed. SYNTHETIC DATA ONLY: no real person's name, phone number
 * or email may ever appear here (root CLAUDE.md rule 6).
 *
 * Idempotency is create-if-absent rather than upsert, because an upsert with an empty
 * update still issues an UPDATE and moves `updated_at`. Running this twice must leave
 * the database byte-identical, which is what the M1-04 acceptance asks for.
 *
 * Ids are fixed constants, not generated, so repeated runs address the same rows.
 */

const DEMO_ORGANISATION_ID = '01930000-0000-7000-8000-000000000001';

/** Fixed ids so repeated runs address the same rows instead of inserting duplicates. */
const ID = {
  doctorUser: '01930000-0000-7000-8000-000000000103',
  doctor: '01930000-0000-7000-8000-000000000201',
  serviceConsult: '01930000-0000-7000-8000-000000000211',
  serviceFollowUp: '01930000-0000-7000-8000-000000000212',
  clinicLine: '01930000-0000-7000-8000-000000000221',
  agentNumber: '01930000-0000-7000-8000-000000000222',
  patients: [
    '01930000-0000-7000-8000-000000000231',
    '01930000-0000-7000-8000-000000000232',
    '01930000-0000-7000-8000-000000000233',
  ],
  appointments: [
    '01930000-0000-7000-8000-000000000241',
    '01930000-0000-7000-8000-000000000242',
    '01930000-0000-7000-8000-000000000243',
  ],
} as const;

const WEEKDAYS: readonly Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
];

const MINUTE = 60 * 1000;

/** Local development password for every seeded user. Never used outside a dev database. */
const DEV_PASSWORD = 'clinicai-dev-password';

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

type SeedUser = {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: Role;
  readonly organisationId: string | null;
};

const SEED_USERS: readonly SeedUser[] = [
  {
    id: '01930000-0000-7000-8000-000000000101',
    email: 'super.admin@clinicai.test',
    fullName: 'Platform Super Admin',
    role: Role.SUPER_ADMIN,
    organisationId: null,
  },
  {
    id: '01930000-0000-7000-8000-000000000102',
    email: 'owner@demo-clinic.test',
    fullName: 'Demo Clinic Owner',
    role: Role.CLINIC_OWNER,
    organisationId: DEMO_ORGANISATION_ID,
  },
  {
    id: '01930000-0000-7000-8000-000000000105',
    email: 'manager@demo-clinic.test',
    fullName: 'Demo Clinic Manager',
    role: Role.CLINIC_MANAGER,
    organisationId: DEMO_ORGANISATION_ID,
  },
  {
    id: '01930000-0000-7000-8000-000000000103',
    email: 'doctor@demo-clinic.test',
    fullName: 'Demo Clinic Doctor',
    role: Role.DOCTOR,
    organisationId: DEMO_ORGANISATION_ID,
  },
  {
    id: '01930000-0000-7000-8000-000000000104',
    email: 'staff@demo-clinic.test',
    fullName: 'Demo Clinic Staff',
    role: Role.STAFF,
    organisationId: DEMO_ORGANISATION_ID,
  },
];

/**
 * Clinic-domain demo data. Synthetic throughout: the names are obviously fictional and
 * the phone numbers sit in a reserved test range, so no real person can be contacted by
 * a mistake in development.
 */
const seedClinicDomain = async (
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
): Promise<void> => {
  const organisationId = DEMO_ORGANISATION_ID;

  if ((await tx.doctor.findUnique({ where: { id: ID.doctor }, select: { id: true } })) === null) {
    await tx.doctor.create({
      data: {
        id: ID.doctor,
        organisationId,
        userId: ID.doctorUser,
        fullName: 'Demo Clinic Doctor',
        specialty: 'General Medicine',
        bufferMinutes: 10,
      },
    });
    out('created doctor');

    // Clinic hours and the doctor's working hours: 09:00-17:00, weekdays.
    for (const weekday of WEEKDAYS) {
      await tx.clinicHours.create({
        data: {
          id: uuidV7(),
          organisationId,
          weekday,
          opensAtMinute: 9 * 60,
          closesAtMinute: 17 * 60,
        },
      });
      await tx.doctorWorkingHours.create({
        data: {
          id: uuidV7(),
          organisationId,
          doctorId: ID.doctor,
          weekday,
          startAtMinute: 9 * 60,
          endAtMinute: 17 * 60,
        },
      });
    }
    out('created clinic hours and doctor working hours (weekdays 09:00-17:00)');
  } else {
    out('doctor already present, left unchanged');
  }

  const services = [
    { id: ID.serviceConsult, name: 'Consultation', durationMinutes: 30, priceMinor: 50_000 },
    { id: ID.serviceFollowUp, name: 'Follow-up', durationMinutes: 15, priceMinor: 25_000 },
  ];
  for (const service of services) {
    if (
      (await tx.service.findUnique({ where: { id: service.id }, select: { id: true } })) !== null
    ) {
      continue;
    }
    await tx.service.create({ data: { ...service, organisationId } });
    await tx.doctorService.create({
      data: { id: uuidV7(), organisationId, doctorId: ID.doctor, serviceId: service.id },
    });
    out(`created service: ${service.name}`);
  }

  for (const [index, patientId] of ID.patients.entries()) {
    if (
      (await tx.patient.findUnique({ where: { id: patientId }, select: { id: true } })) !== null
    ) {
      continue;
    }
    await tx.patient.create({
      data: {
        id: patientId,
        organisationId,
        fullName: `Test Patient ${index + 1}`,
        // Reserved test range: never routable to a real handset.
        phone: `+9199000000${String(index + 1).padStart(2, '0')}`,
        dateOfBirth: new Date(Date.UTC(1990, index, 15)),
      },
    });
    out(`created patient ${index + 1}`);
  }

  // Three non-overlapping appointments on one fixed weekday, so the exclusion
  // constraint added in M1-06 is satisfied by the seed as well.
  const base = Date.parse('2026-11-02T09:00:00.000Z');
  for (const [index, appointmentId] of ID.appointments.entries()) {
    if (
      (await tx.appointment.findUnique({ where: { id: appointmentId }, select: { id: true } })) !==
      null
    ) {
      continue;
    }
    const startAt = new Date(base + index * 60 * MINUTE);
    await tx.appointment.create({
      data: {
        id: appointmentId,
        organisationId,
        patientId: ID.patients[index] ?? ID.patients[0],
        doctorId: ID.doctor,
        serviceId: ID.serviceConsult,
        startAt,
        endAt: new Date(startAt.getTime() + 30 * MINUTE),
        status: AppointmentStatus.SCHEDULED,
        source: AppointmentSource.DASHBOARD,
      },
    });
    out(`created appointment ${index + 1}`);
  }

  const phoneNumbers = [
    { id: ID.clinicLine, e164: '+919900001000', kind: PhoneKind.CLINIC_LINE, label: 'Reception' },
    {
      id: ID.agentNumber,
      e164: '+919900001001',
      kind: PhoneKind.AGENT_NUMBER,
      label: 'Voice agent',
    },
  ];
  for (const phone of phoneNumbers) {
    if (
      (await tx.phoneNumber.findUnique({ where: { id: phone.id }, select: { id: true } })) !== null
    ) {
      continue;
    }
    await tx.phoneNumber.create({ data: { ...phone, organisationId } });
    out(`created phone number: ${phone.kind}`);
  }
};

const main = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL must be set to run the seed');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });

  try {
    await prisma.$transaction(async (tx) => {
      // Platform scope: the seed writes across organisations, and row-level security
      // (added in M1-06) applies even to the table owner once FORCE is set. Declaring
      // platform scope here keeps the seed working after that migration lands.
      await tx.$executeRawUnsafe(`SELECT set_config('app.platform', 'on', true)`);

      const existingOrg = await tx.organisation.findUnique({
        where: { id: DEMO_ORGANISATION_ID },
        select: { id: true },
      });

      if (existingOrg === null) {
        await tx.organisation.create({
          data: {
            id: DEMO_ORGANISATION_ID,
            name: 'Demo Clinic',
            timezone: 'Asia/Kolkata',
            recordingRetentionDays: 90,
            settings: { recordings_visible_to_staff: false },
          },
        });
        out('created organisation: Demo Clinic');
      } else {
        out('organisation already present, left unchanged');
      }

      for (const user of SEED_USERS) {
        const existing = await tx.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        });

        if (existing !== null) {
          out(`user already present, left unchanged: ${user.role}`);
          continue;
        }

        await tx.user.create({
          data: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            organisationId: user.organisationId,
            passwordHash,
            status: UserStatus.ACTIVE,
          },
        });
        out(`created user: ${user.role}`);
      }

      await seedClinicDomain(tx);
    });
  } finally {
    await prisma.$disconnect();
  }
};

await main();
