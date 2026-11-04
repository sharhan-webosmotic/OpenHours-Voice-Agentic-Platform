import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createApp } from '../src/app.js';
import { generateOpaqueToken, hashToken } from '../src/common/tokens.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { addDays, weekdayOf, zonedParts, formatMinuteOfDay } from '@clinicai/shared';
import { assertLocalDatabase } from './provision-clinic.js';

/**
 * Measures the voice tool endpoints. It does not assert a target.
 *
 * ─── WHY MEASURED RATHER THAN ASSERTED ──────────────────────────────────────────
 *
 * The milestone names p95 under 400 ms at 20 concurrent calls. A test that asserted that
 * number would pass or fail on the speed of whatever machine ran it, so it would either be
 * flaky in CI or set so loose that it proved nothing. What is useful is the real figure on
 * a known machine against realistic data, and WHICH TOOL IS SLOWEST, because that is the
 * one a patient waits for mid-sentence.
 *
 * ─── OVER REAL HTTP, AGAINST A REAL DATABASE ────────────────────────────────────
 *
 * The app is started on an ephemeral port and driven with `fetch`, so the figures include
 * the server stack, the middleware, the credential lookup and PostgreSQL. They exclude the
 * internet between Sarvam and us, which is not ours to measure or to fix.
 *
 * ─── THE DATA IS REALISTIC, NOT A FIXTURE ───────────────────────────────────────
 *
 * One doctor, four services, Monday to Friday with a lunch break, 600 patients and roughly
 * 900 appointments over twelve weeks. That matters most for the two reads that scan: the
 * patient lookup by number and the day's occupancy inside the slot engine. Measured against
 * an empty clinic, every tool looks fast.
 *
 * ─── THE RATE LIMITER IS RAISED FOR THE RUN, DELIBERATELY ───────────────────────
 *
 * The `voice:measure` script sets both limits to a million, and the first run without that
 * is why: 700 calls for one clinic inside a minute is far past the configured 600, so two
 * tools reported a p95 over a hundred 429s. That is the limiter working, and it says
 * nothing about the limit being wrong for production, where twenty concurrent CALLS are
 * paced by people speaking rather than by a loop. These figures therefore exclude
 * throttling by design, and the script prints that it did so.
 *
 * Run it with `pnpm voice:measure` against a local database. It refuses anything else.
 */

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const TIME_ZONE = 'Asia/Kolkata';
const PATIENTS = 600;
const WEEKS = 12;

type Sample = { readonly tool: string; readonly ms: number; readonly ok: boolean };

const percentile = (sorted: readonly number[], fraction: number): number => {
  if (sorted.length === 0) {
    return Number.NaN;
  }
  // Nearest-rank, which is what a latency figure should be: an actual observation rather
  // than an interpolation between two of them.
  const rank = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[Math.max(0, rank)] ?? Number.NaN;
};

const summarise = (samples: readonly Sample[]): void => {
  const tools = [...new Set(samples.map((sample) => sample.tool))];
  const rows = tools.map((tool) => {
    const forTool = samples.filter((sample) => sample.tool === tool);
    const sorted = [...forTool.map((sample) => sample.ms)].sort((a, b) => a - b);

    return {
      tool,
      calls: forTool.length,
      refused: forTool.filter((sample) => !sample.ok).length,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      max: sorted.at(-1) ?? Number.NaN,
    };
  });

  const width = Math.max(...rows.map((row) => row.tool.length), 'tool'.length);
  const pad = (value: string): string => value.padEnd(width);
  const ms = (value: number): string => `${value.toFixed(0).padStart(6)} ms`;

  out('');
  out(`${pad('tool')}  calls  refused        p50        p95        p99        max`);
  out('-'.repeat(width + 58));
  for (const row of rows) {
    out(
      `${pad(row.tool)}  ${String(row.calls).padStart(5)}  ${String(row.refused).padStart(7)}  ${ms(row.p50)}  ${ms(row.p95)}  ${ms(row.p99)}  ${ms(row.max)}`,
    );
  }

  const slowest = [...rows].sort((a, b) => b.p95 - a.p95)[0];
  const overall = [...samples.map((sample) => sample.ms)].sort((a, b) => a - b);

  out('');
  out(
    `all tools together: p50 ${percentile(overall, 0.5).toFixed(0)} ms, p95 ${percentile(overall, 0.95).toFixed(0)} ms, p99 ${percentile(overall, 0.99).toFixed(0)} ms`,
  );
  if (slowest !== undefined) {
    out(`slowest at the 95th percentile: ${slowest.tool} at ${slowest.p95.toFixed(0)} ms`);
  }
};

/** The first Monday at least a week out, which is where the bookable slots are. */
const firstMonday = (now: Date): string => {
  let day = addDays(zonedParts(now, TIME_ZONE).day, 8);
  while (weekdayOf(day) !== 'MONDAY') {
    day = addDays(day, 1);
  }
  return day;
};

type Clinic = {
  readonly organisationId: string;
  readonly secret: string;
  readonly doctorId: string;
  readonly serviceId: string;
  readonly phones: readonly string[];
  readonly appointmentIds: readonly string[];
};

/**
 * Builds the clinic, or rebuilds it: the script deletes its own organisation first.
 *
 * Deleting and rebuilding rather than reusing, because a second run against the
 * appointments the first one made would measure a different clinic, and the figures would
 * drift upwards every time somebody ran it.
 */
const buildClinic = async (prisma: PrismaClient, now: Date): Promise<Clinic> => {
  const name = 'Voice Measurement Clinic';

  /**
   * Deleted dependents first, in order.
   *
   * `organisation.deleteMany` alone fails: `users.organisation_id` is a restricting foreign
   * key in the database, so PostgreSQL refuses the parent delete rather than cascading. That
   * is the correct arrangement for a clinic (a clinic cannot be deleted out from under its
   * users), and it means a script that rebuilds its own fixture has to clear up after
   * itself explicitly.
   */
  const previous = await prisma.organisation.findMany({ where: { name }, select: { id: true } });
  const ids = previous.map((row) => row.id);

  if (ids.length > 0) {
    const where = { organisationId: { in: ids } };

    await prisma.appointment.deleteMany({ where });
    await prisma.call.deleteMany({ where });
    await prisma.patient.deleteMany({ where });
    await prisma.doctorService.deleteMany({ where });
    await prisma.doctorWorkingHours.deleteMany({ where });
    await prisma.doctorTimeOff.deleteMany({ where });
    await prisma.doctor.deleteMany({ where });
    await prisma.service.deleteMany({ where });
    await prisma.clinicHours.deleteMany({ where });
    await prisma.clinicBookingPolicy.deleteMany({ where });
    await prisma.clinicProfile.deleteMany({ where });
    await prisma.clinicFaq.deleteMany({ where });
    await prisma.voiceAgent.deleteMany({ where });
    await prisma.auditLog.deleteMany({ where });
    await prisma.user.deleteMany({ where });
    await prisma.organisation.deleteMany({ where: { id: { in: ids } } });
  }

  const organisationId = uuidV7();
  const secret = generateOpaqueToken();

  await prisma.organisation.create({
    data: {
      id: organisationId,
      name,
      timezone: TIME_ZONE,
      settings: {},
      openingHoursCollectedAt: now,
    },
  });

  await prisma.user.create({
    data: {
      id: uuidV7(),
      organisationId,
      email: `voice.measure.${organisationId}@test.invalid`,
      passwordHash: await hashPassword(generateOpaqueToken()),
      fullName: 'Measurement Owner',
      role: 'CLINIC_OWNER',
      status: 'ACTIVE',
    },
  });

  await prisma.voiceAgent.create({
    data: {
      id: uuidV7(),
      organisationId,
      provider: 'SARVAM',
      toolSecretHash: hashToken(secret),
      toolSecretSetAt: now,
    },
  });

  const doctorId = uuidV7();
  await prisma.doctor.create({
    data: {
      id: doctorId,
      organisationId,
      fullName: 'Dr Measurement',
      bufferMinutes: 0,
      active: true,
    },
  });

  const services = await Promise.all(
    [
      ['Consultation', 30, 50_000],
      ['Follow-up', 15, 20_000],
      ['Cleaning', 45, 150_000],
      ['Extraction', 60, 300_000],
    ].map(async ([serviceName, durationMinutes, priceMinor]) => {
      const id = uuidV7();
      await prisma.service.create({
        data: {
          id,
          organisationId,
          name: String(serviceName),
          durationMinutes: Number(durationMinutes),
          priceMinor: Number(priceMinor),
          active: true,
        },
      });
      await prisma.doctorService.create({
        data: { id: uuidV7(), organisationId, doctorId, serviceId: id },
      });
      return id;
    }),
  );

  const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

  for (const weekday of weekdays) {
    // Two segments a day, which is how a break is expressed (D-013), so the engine has to
    // do the gap arithmetic rather than one long window.
    for (const { opensAtMinute, closesAtMinute } of [
      { opensAtMinute: 9 * 60, closesAtMinute: 13 * 60 },
      { opensAtMinute: 14 * 60, closesAtMinute: 18 * 60 },
    ]) {
      await prisma.clinicHours.create({
        data: { id: uuidV7(), organisationId, weekday, opensAtMinute, closesAtMinute },
      });
      await prisma.doctorWorkingHours.create({
        data: {
          id: uuidV7(),
          organisationId,
          doctorId,
          weekday,
          startAtMinute: opensAtMinute,
          endAtMinute: closesAtMinute,
        },
      });
    }
  }

  await prisma.clinicBookingPolicy.create({
    data: {
      id: uuidV7(),
      organisationId,
      slotGranularityMinutes: 15,
      minimumNoticeMinutes: 60,
      /**
       * A year, which is wider than a real clinic would set.
       *
       * The measurement books a hundred appointments beyond the twelve occupied weeks, and
       * with a realistic 120 days the last few were refused as too far ahead. That refusal
       * is a cheap path, so including it would flatter the figure for `book`.
       */
      maximumAdvanceDays: 365,
      defaultBufferMinutes: 0,
      maxPerSlot: 1,
    },
  });

  await prisma.clinicProfile.create({
    data: {
      id: uuidV7(),
      organisationId,
      addressLine1: '12 Measurement Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      country: 'IN',
    },
  });

  for (const [index, { question, answer }] of [
    { question: 'Do you take walk-ins?', answer: 'Walk-ins are seen when there is a gap.' },
    { question: 'Is there parking?', answer: 'There is parking behind the building.' },
    { question: 'Do you do root canals?', answer: 'Yes, with an appointment.' },
  ].entries()) {
    await prisma.clinicFaq.create({
      data: { id: uuidV7(), organisationId, question, answer, sortOrder: index, active: true },
    });
  }

  const phones: string[] = [];
  const patientIds: string[] = [];

  for (let index = 0; index < PATIENTS; index += 1) {
    const id = uuidV7();
    // Distinct numbers, so the lookup measures one row rather than the ambiguous path.
    const phone = `+9199${String(10_000_000 + index).slice(0, 8)}`;
    patientIds.push(id);
    phones.push(phone);
    await prisma.patient.create({
      data: { id, organisationId, fullName: `Measured Patient ${index}`, phone },
    });
  }

  const appointmentIds: string[] = [];
  const monday = firstMonday(now);
  const duration = 30;

  for (let week = 0; week < WEEKS; week += 1) {
    for (const [dayOffset] of weekdays.entries()) {
      const day = addDays(monday, week * 7 + dayOffset);

      // Fifteen appointments a day: a working clinic, and enough occupancy that the slot
      // engine has real work to do rather than an empty diary to hand back.
      for (let slot = 0; slot < 15; slot += 1) {
        const startMinute = 9 * 60 + slot * duration;
        const startAt = new Date(`${day}T${formatMinuteOfDay(startMinute - 330)}:00.000Z`);
        const id = uuidV7();
        appointmentIds.push(id);

        await prisma.appointment.create({
          data: {
            id,
            organisationId,
            patientId: patientIds[(week * 75 + slot) % patientIds.length] ?? patientIds[0] ?? '',
            doctorId,
            serviceId: services[slot % services.length] ?? services[0] ?? '',
            startAt,
            endAt: new Date(startAt.getTime() + duration * 60_000),
            status: 'SCHEDULED',
            source: 'DASHBOARD',
          },
        });
      }
    }
  }

  return {
    organisationId,
    secret,
    doctorId,
    serviceId: services[0] ?? '',
    phones,
    appointmentIds,
  };
};

const main = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL must be set to measure the voice tools');
  }

  assertLocalDatabase(connectionString);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const now = new Date();

  try {
    out(
      `rate limits for this run: ${process.env.VOICE_TOOL_CALLS_PER_MINUTE_PER_CLINIC ?? 'default'} per clinic per minute (raised, so the figures measure work rather than throttling)`,
    );
    out('building a clinic with realistic data…');
    const clinic = await buildClinic(prisma, now);
    out(`built: ${PATIENTS} patients, ${clinic.appointmentIds.length} appointments`);

    const app = createApp({ readiness: () => Promise.resolve() });
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    const base = `http://127.0.0.1:${String(port)}/voice/tools`;

    const refusalSeen = new Set<string>();
    const call = async (tool: string, body: unknown): Promise<Sample> => {
      const started = performance.now();
      const response = await fetch(`${base}/${tool}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${clinic.secret}`,
        },
        body: JSON.stringify(body),
      });
      const envelope = (await response.json()) as { ok: boolean; message: string };
      const ms = performance.now() - started;

      /**
       * The first refusal per tool is printed, with the sentence the agent would have
       * spoken.
       *
       * Not decoration: the first run of this script reported a p95 for `book` over a
       * hundred refusals, because the body named no service, and a refusal short-circuits
       * before the work. A measurement of a tool that refused is a measurement of nothing,
       * and silence about it is how such a figure gets quoted.
       */
      if (!(response.ok && envelope.ok) && !refusalSeen.has(tool)) {
        refusalSeen.add(tool);
        out(`  first refusal from ${tool}: ${envelope.message}`);
      }

      return { tool, ms, ok: response.ok && envelope.ok };
    };

    const monday = firstMonday(now);
    const samples: Sample[] = [];

    const bodyFor = (tool: string, index: number): unknown => {
      switch (tool) {
        case 'clinic-info':
          return { topic: 'hours' };
        case 'lookup-patient':
          return { callerNumber: clinic.phones[index % clinic.phones.length] };
        case 'check-availability':
          /**
           * The service is NAMED, and the first run of this script is why.
           *
           * The measurement clinic has four services, so a body that named none was
           * correctly answered with "what would you like to come in for?" and the figures
           * were 200 refusals: a short-circuit that never reached the slot engine, and
           * faster than the real thing. The agent names a service in practice, because it
           * has just read the list out.
           */
          return { date: addDays(monday, index % 5), serviceId: clinic.serviceId };
        case 'book': {
          /**
           * The slot is derived from THE ITERATION NUMBER, not from a shared counter.
           *
           * A mutable cursor read by twenty concurrent workers handed the same slot to two
           * of them, and 36 of 100 bookings came back "that time is no longer available".
           * The exclusion constraint was right and the measurement was wrong: it was
           * timing a conflict, which is a different and faster path than a booking.
           *
           * Eight slots a day inside the morning segment, because a ninth would be 13:00
           * and the clinic breaks for lunch, and whole weekdays only, because Saturday
           * would be measured as "the clinic is closed".
           */
          const slotsPerDay = 8;
          const dayIndex = Math.floor(index / slotsPerDay);
          const target = addDays(
            monday,
            7 * WEEKS + 7 + Math.floor(dayIndex / 5) * 7 + (dayIndex % 5),
          );
          const minute = 9 * 60 + (index % slotsPerDay) * 30;

          return {
            callerNumber: clinic.phones[index % clinic.phones.length],
            date: target,
            time: formatMinuteOfDay(minute),
            serviceId: clinic.serviceId,
          };
        }
        default:
          return {};
      }
    };

    /**
     * Concurrency 20, which is the milestone's own number, and it is the figure that
     * matters: a tool measured one call at a time says nothing about twenty patients on
     * the line at once.
     */
    const run = async (tool: string, iterations: number, concurrency: number): Promise<void> => {
      // Warm-up, excluded from the figures: the first call pays for the connection pool and
      // the query plans, and reporting it as a p99 would be a lie about steady state.
      await call(tool, bodyFor(tool, 0));

      let index = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (index < iterations) {
          index += 1;
          samples.push(await call(tool, bodyFor(tool, index)));
        }
      });

      await Promise.all(workers);
      out(`measured ${tool}`);
    };

    await run('clinic-info', 200, 20);
    await run('lookup-patient', 200, 20);
    await run('check-availability', 200, 20);
    // Fewer, because each one writes a row and takes a slot. The figure is still a p95 over
    // a hundred observations, and it is the only tool that contends on the exclusion
    // constraint.
    await run('book', 100, 20);

    summarise(samples);

    out('');
    out('what is NOT in these figures: the network between Sarvam and this process, the');
    out('Sarvam agent’s own turn latency, and the reschedule and cancel tools, each of');
    out('which is a locate plus the same write as book.');

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
  } finally {
    await prisma.$disconnect();
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
