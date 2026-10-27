import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role, UserStatus } from '../src/generated/prisma/enums.js';

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

/** Local development password for every seeded user. Never used outside a dev database. */
const DEV_PASSWORD = 'openhours-dev-password';

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
    email: 'super.admin@openhours.test',
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
    });
  } finally {
    await prisma.$disconnect();
  }
};

await main();
