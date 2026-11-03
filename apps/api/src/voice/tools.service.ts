import {
  formatMinuteOfDay,
  normalisePhone,
  zonedTimeToUtc,
  type AppointmentSource,
} from '@clinicai/shared';
import { requirePermission } from '../common/permissions.js';
import { organisationInScope } from '../common/organisation-scope.js';
import { withOrganisationScope } from '../db/principal-scope.js';
import type { TenantDb } from '../db/tenant-client.js';
import { recordRead } from '../modules/audit/audit.service.js';
import * as appointments from '../modules/appointments/appointments.service.js';
import * as appointmentRepository from '../modules/appointments/appointments.repository.js';
import * as patients from '../modules/patients/patients.service.js';
import * as patientRepository from '../modules/patients/patients.repository.js';
import * as repository from './voice.repository.js';
import { voicePrincipal } from './tool-auth.middleware.js';
import type { VoiceAgentIdentity } from './tool-secret.js';
import type {
  BookBody,
  CancelBody,
  CheckAvailabilityBody,
  ClinicInfoBody,
  LookupPatientBody,
  RescheduleBody,
  ToolEnvelope,
} from './tools.schemas.js';

/**
 * The six things the voice agent can do, as the agent sees them.
 *
 * ─── IT ADDS NO RULES OF ITS OWN ────────────────────────────────────────────────
 *
 * Booking, rescheduling and cancelling go through the SAME service functions the dashboard
 * uses, with the agent's own principal. So the status machine, the notice period, the
 * maximum advance, the doctor's working hours and the exclusion constraint that makes
 * double booking impossible all apply unchanged. A second implementation here would be a
 * second set of clinical rules, and the one that gets a rule wrong would be the one talking
 * to patients.
 *
 * ─── IT NEVER GUESSES ───────────────────────────────────────────────────────────
 *
 * Every ambiguity comes back as a question for the caller: two patients on one number, two
 * doctors whose names both match, a caller with three upcoming appointments. The agent can
 * ask. Picking the most likely row would be a booking made under somebody else's name, and
 * on a telephone nobody would notice until the patient arrived.
 *
 * ─── WHO THE CALLER IS ──────────────────────────────────────────────────────────
 *
 * The caller's OWN LINE, from the provider's call context (`callerNumber`), and nothing else.
 * A number the caller speaks is somebody's number, not proof of being them: identifying by it
 * let any caller hear a stranger's name, learn they were a patient here, and cancel their
 * appointment (Feature 3 review, C2 and I6). So:
 *
 *   - a line that matches a patient proceeds, without the name being said back
 *   - an unknown or withheld line is a new caller: details are taken, nothing is searched,
 *     and nothing says whether a record exists
 *   - moving or cancelling touches only appointments belonging to the caller's own line, and
 *     anything else is a sentence offering a call back
 *
 * ─── WHAT IT MAY SAY ────────────────────────────────────────────────────────────
 *
 * `message` is spoken to whoever is on the line, so it carries ONLY what that caller said in
 * this conversation. No stored name, no stored detail, ever, in `message` or in `data`: the
 * agent may repeat anything it is handed, and a family's shared line means even the right
 * line can be held by the wrong person.
 */

const SOURCE: AppointmentSource = 'VOICE_AGENT';

/** A refusal the agent can speak, with nothing in `data` to reason from. */
const refusal = (message: string): ToolEnvelope<never> => ({ ok: false, message, data: null });

const success = <T>(message: string, data: T): ToolEnvelope<T> => ({ ok: true, message, data });

/**
 * The caller's number, in E.164, or null if nothing usable was said.
 *
 * The shared normaliser is strict, which is right: a number it cannot complete is one the
 * clinic cannot ring back, and booking against a half-number would make the record useless
 * to the humans who have to use it.
 */
const callerPhone = (spoken: string): string | null => {
  const result = normalisePhone(spoken);
  return result.ok ? result.e164 : null;
};

/** The caller's own line, in E.164, or null when the provider sent none or nothing usable. */
const callerLine = (callerNumber: string | undefined): string | null =>
  callerNumber === undefined ? null : callerPhone(callerNumber);

/** What a caller hears when this call cannot safely act on a booking. */
const CALL_BACK =
  'I am not able to change that booking on this call. I can have the clinic call you back.';

type Resolved<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly ask: string };

/**
 * Matches what a patient called something against what the clinic calls it.
 *
 * Exact match first, then a contained match, because "Dr Mehta" should find "Dr Anjali
 * Mehta" while "a" should not find everybody. A name that matches more than one row is a
 * question, never the first row.
 */
const byName = <T extends { readonly id: string }>(
  rows: readonly T[],
  spoken: string,
  nameOf: (row: T) => string,
): readonly T[] => {
  const wanted = spoken.trim().toLowerCase();
  const exact = rows.filter((row) => nameOf(row).toLowerCase() === wanted);

  return exact.length > 0
    ? exact
    : rows.filter((row) => nameOf(row).toLowerCase().includes(wanted));
};

const resolveTarget = <T extends { readonly id: string }>(
  rows: readonly T[],
  nameOf: (row: T) => string,
  input: { readonly id?: string | undefined; readonly name?: string | undefined },
  asked: { readonly none: string; readonly many: string },
): Resolved<T> => {
  if (input.id !== undefined) {
    const found = rows.find((row) => row.id === input.id);
    return found === undefined ? { ok: false, ask: asked.none } : { ok: true, value: found };
  }

  if (input.name !== undefined) {
    const matches = byName(rows, input.name, nameOf);

    if (matches.length === 1 && matches[0] !== undefined) {
      return { ok: true, value: matches[0] };
    }

    return { ok: false, ask: matches.length === 0 ? asked.none : asked.many };
  }

  /**
   * Nothing named, so the only safe default is a clinic with exactly one of them.
   *
   * Which is the pilot's shape and the prototype's: one doctor. A clinic with three and a
   * caller who named none gets asked, rather than being given whichever row sorted first.
   */
  if (rows.length === 1 && rows[0] !== undefined) {
    return { ok: true, value: rows[0] };
  }

  return { ok: false, ask: rows.length === 0 ? asked.none : asked.many };
};

const minuteOfDay = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
};

/** `09:00 to 13:00 and 14:00 to 18:00`, from however many segments a day has. */
const spokenHours = (
  segments: readonly { readonly opensAtMinute: number; readonly closesAtMinute: number }[],
): string =>
  segments
    .map(
      (segment) =>
        `${formatMinuteOfDay(segment.opensAtMinute)} to ${formatMinuteOfDay(segment.closesAtMinute)}`,
    )
    .join(' and ');

export const clinicInfo = async (
  identity: VoiceAgentIdentity,
  body: ClinicInfoBody,
): Promise<ToolEnvelope<unknown>> => {
  const principal = voicePrincipal(identity);
  requirePermission('clinic_settings', 'read', principal);
  const organisationId = organisationInScope(principal, undefined);

  return withOrganisationScope(principal, organisationId, 'voice.clinic-info', async (db) => {
    const clinic = await repository.clinicInformation(db, organisationId);

    if (clinic === null) {
      return refusal('I am not able to reach the clinic’s details right now.');
    }

    const byWeekday = new Map<string, typeof clinic.hours>();
    for (const row of clinic.hours) {
      byWeekday.set(row.weekday, [...(byWeekday.get(row.weekday) ?? []), row]);
    }

    const address = [
      clinic.profile?.addressLine1,
      clinic.profile?.addressLine2,
      clinic.profile?.city,
      clinic.profile?.state,
      clinic.profile?.postalCode,
    ]
      .filter((part): part is string => part !== null && part !== undefined && part !== '')
      .join(', ');

    /**
     * WHAT IS NOT COLLECTED IS NOT ANSWERED. D-013: an empty `clinic_hours` with no
     * `opening_hours_collected_at` means nobody has asked this clinic its timings, which is
     * a different thing from being closed. The agent is told it does not know, so it offers
     * to have somebody call back instead of announcing a closure the clinic never confirmed.
     */
    const hoursMessage = !clinic.hoursCollected
      ? 'I do not have the clinic’s timings to hand. I can have somebody call you back with them.'
      : clinic.hours.length === 0
        ? 'The clinic has no opening times listed at the moment.'
        : [...byWeekday.entries()]
            .map(([weekday, segments]) => `${weekday.toLowerCase()}: ${spokenHours(segments)}`)
            .join('; ');

    const message =
      body.topic === 'address'
        ? address === ''
          ? 'I do not have the clinic’s address to hand.'
          : `The clinic is at ${address}.`
        : body.topic === 'hours'
          ? hoursMessage
          : body.topic === 'services'
            ? clinic.services.length === 0
              ? 'I do not have a list of services to hand.'
              : `The clinic offers ${clinic.services.map((service) => service.name).join(', ')}.`
            : `This is ${clinic.name}.`;

    return success(message, {
      name: clinic.name,
      timeZone: clinic.timezone,
      address: address === '' ? null : address,
      hoursCollected: clinic.hoursCollected,
      hours: clinic.hours,
      services: clinic.services,
      faqs: clinic.faqs,
    });
  });
};

type PatientMatch =
  | { readonly kind: 'one'; readonly id: string }
  | { readonly kind: 'none' }
  | { readonly kind: 'several' };

/**
 * Which patient this caller is.
 *
 * `several` is not an edge case: a family shares a number, and `patients.phone` is
 * deliberately not unique for that reason. The caller is asked for a name, and the name
 * narrows the same list rather than starting a new search.
 */
const matchPatient = async (
  db: TenantDb,
  organisationId: string,
  phone: string,
  fullName: string | undefined,
): Promise<PatientMatch> => {
  const rows = await patientRepository.findByExactPhone(db, organisationId, phone);

  const narrowed = fullName === undefined ? rows : byName(rows, fullName, (row) => row.fullName);

  if (narrowed.length === 1 && narrowed[0] !== undefined) {
    return { kind: 'one', id: narrowed[0].id };
  }

  return narrowed.length === 0 ? { kind: 'none' } : { kind: 'several' };
};

export const lookupPatient = async (
  identity: VoiceAgentIdentity,
  body: LookupPatientBody,
): Promise<ToolEnvelope<unknown>> => {
  const principal = voicePrincipal(identity);
  requirePermission('patients', 'read', principal);
  const organisationId = organisationInScope(principal, undefined);

  const line = callerLine(body.callerNumber);

  if (line === null) {
    // No line to identify anybody by, so a new caller. Nothing is searched, so nothing is read.
    return success('Could I take your full name, please?', { found: false, needsName: true });
  }

  return withOrganisationScope(principal, organisationId, 'voice.lookup-patient', async (db) => {
    const match = await matchPatient(db, organisationId, line, body.fullName);

    /**
     * Audited as a read of patient data, because that is what it is: somebody rang and the
     * platform looked them up. No number and no name in the row, per rule 5.
     */
    await recordRead(db, 'patient', match.kind === 'one' ? match.id : undefined, {
      via: 'voice',
      outcome: match.kind,
    });

    if (match.kind === 'several') {
      // Deliberately does NOT list the names. Several records on one number is usually a
      // family, and reading their names out to whoever is holding the phone is a
      // disclosure the clinic never agreed to.
      return success('Could I take the full name of the patient, please?', {
        found: false,
        needsName: true,
      });
    }

    if (match.kind === 'none') {
      // A new caller. The sentence is the same whether or not a record exists elsewhere.
      return body.fullName === undefined
        ? success('Could I take your full name, please?', { found: false, needsName: true })
        : success('Thank you.', { found: false, needsName: false });
    }

    // Found, and the stored name is neither said nor handed to the agent to say.
    return success('Thank you, I can help you with that.', { found: true, needsName: false });
  });
};

export const checkAvailability = async (
  identity: VoiceAgentIdentity,
  body: CheckAvailabilityBody,
): Promise<ToolEnvelope<unknown>> => {
  const principal = voicePrincipal(identity);
  requirePermission('appointments', 'read', principal);
  const organisationId = organisationInScope(principal, undefined);

  const chosen = await withOrganisationScope(
    principal,
    organisationId,
    'voice.resolve-targets',
    async (db) => {
      const targets = await repository.resolvableTargets(db, organisationId);

      return {
        doctor: resolveTarget(
          targets.doctors,
          (row) => row.fullName,
          { id: body.doctorId, name: body.doctorName },
          {
            none: 'I could not find that doctor. Which doctor would you like to see?',
            many: 'Which doctor would you like to see?',
          },
        ),
        service: resolveTarget(
          targets.services,
          (row) => row.name,
          { id: body.serviceId, name: body.serviceName },
          {
            none: 'I could not find that treatment. What would you like to come in for?',
            many: 'What would you like to come in for?',
          },
        ),
      };
    },
  );

  if (!chosen.doctor.ok) {
    return refusal(chosen.doctor.ask);
  }

  if (!chosen.service.ok) {
    return refusal(chosen.service.ask);
  }

  const result = await appointments.availability(principal, undefined, {
    doctorId: chosen.doctor.value.id,
    serviceId: chosen.service.value.id,
    date: body.date,
  });

  if (result.slots.length === 0) {
    /**
     * The engine's reason, turned into something speakable. `HOURS_NOT_COLLECTED` is the
     * one that must never be spoken as "we are closed": nobody has told the platform the
     * clinic's hours, and asserting a closure on that basis would turn a configuration gap
     * into a patient being sent away.
     */
    const message =
      result.reason === 'HOURS_NOT_COLLECTED'
        ? 'I cannot check the diary for that day. I can have somebody call you back.'
        : result.reason === 'CLINIC_CLOSED'
          ? 'The clinic is closed that day. Would another day suit you?'
          : result.reason === 'DOCTOR_NOT_WORKING'
            ? 'The doctor is not in that day. Would another day suit you?'
            : result.reason === 'DAY_IN_THE_PAST'
              ? 'That day has already passed. Which day would you like?'
              : result.reason === 'BEYOND_MAXIMUM_ADVANCE'
                ? 'That is further ahead than the clinic books. Could we look at something sooner?'
                : 'There is nothing free that day. Would another day suit you?';

    return success(message, { date: body.date, slots: [], reason: result.reason });
  }

  const spoken = result.slots.slice(0, 3).map((slot) => slot.label);

  return success(
    `There is ${spoken.join(', ')}${result.slots.length > spoken.length ? ' and more' : ''} on that day. Which would you like?`,
    {
      date: result.date,
      timeZone: result.timeZone,
      doctorId: chosen.doctor.value.id,
      serviceId: chosen.service.value.id,
      slots: result.slots,
      reason: null,
    },
  );
};

/**
 * The idempotency key for a write the agent makes.
 *
 * The provider's call id and tool call id if it sent them, otherwise the
 * `Idempotency-Key` header, otherwise nothing. Nothing is the honest answer rather than a
 * composed-from-the-body key: a key built from the patient and the time would make a
 * deliberate second booking for the same slot look like a retry, and whether Sarvam sends
 * either identifier is an open question in the contract document.
 */
const idempotencyKey = (
  body: { readonly callId?: string | undefined; readonly toolCallId?: string | undefined },
  header: string | undefined,
): string | undefined => {
  if (body.callId !== undefined && body.toolCallId !== undefined) {
    return `voice:${body.callId}:${body.toolCallId}`;
  }

  return header;
};

export const book = async (
  identity: VoiceAgentIdentity,
  body: BookBody,
  header: string | undefined,
): Promise<ToolEnvelope<unknown>> => {
  const principal = voicePrincipal(identity);
  requirePermission('appointments', 'write', principal);
  const organisationId = organisationInScope(principal, undefined);

  const line = callerLine(body.callerNumber);
  /**
   * The number a NEW patient's record is made with: their own line when we can see it,
   * otherwise one they spoke, so a withheld line does not cost them the appointment. The
   * spoken one is never searched, so it cannot reach anybody else's record.
   */
  const contact = line ?? (body.phone === undefined ? null : callerPhone(body.phone));

  if (contact === null) {
    return refusal(
      body.phone === undefined
        ? 'Could I take a number the clinic can reach you on?'
        : 'I could not make out that number. Could you say it again, digit by digit?',
    );
  }

  const resolved = await withOrganisationScope(
    principal,
    organisationId,
    'voice.resolve-booking',
    async (db) => {
      const targets = await repository.resolvableTargets(db, organisationId);

      return {
        patient:
          line === null
            ? ({ kind: 'none' } as const)
            : await matchPatient(db, organisationId, line, body.fullName),
        doctor: resolveTarget(
          targets.doctors,
          (row) => row.fullName,
          { id: body.doctorId, name: body.doctorName },
          {
            none: 'I could not find that doctor. Which doctor would you like to see?',
            many: 'Which doctor would you like to see?',
          },
        ),
        service: resolveTarget(
          targets.services,
          (row) => row.name,
          { id: body.serviceId, name: body.serviceName },
          {
            none: 'I could not find that treatment. What would you like to come in for?',
            many: 'What would you like to come in for?',
          },
        ),
      };
    },
  );

  if (!resolved.doctor.ok) {
    return refusal(resolved.doctor.ask);
  }

  if (!resolved.service.ok) {
    return refusal(resolved.service.ask);
  }

  if (resolved.patient.kind === 'several') {
    return refusal('Could I take the full name of the patient, please?');
  }

  if (resolved.patient.kind === 'none' && body.fullName === undefined) {
    return refusal('Could I take the patient’s full name, please?');
  }

  /**
   * A new caller gets a record before the booking, which is a write the agent is granted
   * (`patients: rw` in the matrix) because the alternative is an agent that cannot book for
   * anybody new. It is a CREATE only: there is no tool that edits an existing record.
   */
  const patientId =
    resolved.patient.kind === 'one'
      ? resolved.patient.id
      : (
          await patients.create(principal, undefined, {
            fullName: body.fullName ?? '',
            phone: contact,
            dateOfBirth: null,
            notes: null,
          })
        ).patientId;

  const timeZone = await withOrganisationScope(
    principal,
    organisationId,
    'voice.clinic-zone',
    (db) => appointmentRepository.organisationTimeZone(db, organisationId),
  );

  const startAt = zonedTimeToUtc(body.date, minuteOfDay(body.time), timeZone);

  const result = await appointments.book(
    principal,
    undefined,
    {
      patientId,
      doctorId: resolved.doctor.value.id,
      serviceId: resolved.service.value.id,
      startAt: startAt.toISOString(),
    },
    { source: SOURCE, idempotencyKey: idempotencyKey(body, header) },
  );

  return success(
    `That is booked for ${body.time} on ${body.date}. ${
      result.replayed ? 'That was already booked, so nothing has changed.' : ''
    }`.trim(),
    {
      appointmentId: result.appointmentId,
      startAt: result.startAt,
      endAt: result.endAt,
      patientId,
      replayed: result.replayed,
    },
  );
};

/**
 * The caller's own upcoming appointments that still hold a slot.
 *
 * Bounded: a patient with more than this many upcoming visits is asked which day, the same as
 * one with two, so the bound changes no answer.
 */
const UPCOMING_LIMIT = 10;

type Located =
  | { readonly ok: true; readonly appointmentId: string }
  | { readonly ok: false; readonly ask: string };

/**
 * Which appointment a reschedule or cancel acts on: one belonging to the CALLER'S OWN LINE.
 *
 * No line, a line with no record, or an `appointmentId` that is not one of that line's
 * upcoming appointments are all the same answer, a call back. Saying which would tell a
 * caller something about a record they have not shown they own.
 */
const locateAppointment = async (
  identity: VoiceAgentIdentity,
  body: {
    readonly callerNumber?: string | undefined;
    readonly appointmentId?: string | undefined;
    readonly fullName?: string | undefined;
  },
  now: Date,
): Promise<Located> => {
  const line = callerLine(body.callerNumber);

  if (line === null) {
    return { ok: false, ask: CALL_BACK };
  }

  const principal = voicePrincipal(identity);
  const organisationId = organisationInScope(principal, undefined);

  return withOrganisationScope(
    principal,
    organisationId,
    'voice.locate-appointment',
    async (db): Promise<Located> => {
      const patient = await matchPatient(db, organisationId, line, body.fullName);

      if (patient.kind === 'several') {
        return { ok: false, ask: 'Could I take the full name of the patient, please?' };
      }

      if (patient.kind === 'none') {
        return { ok: false, ask: CALL_BACK };
      }

      const upcoming = await appointmentRepository.list(db, {
        organisationId,
        patientId: patient.id,
        from: now,
        status: ['SCHEDULED', 'CONFIRMED'],
        take: UPCOMING_LIMIT,
      });

      if (body.appointmentId !== undefined) {
        return upcoming.some((row) => row.id === body.appointmentId)
          ? { ok: true, appointmentId: body.appointmentId }
          : { ok: false, ask: CALL_BACK };
      }

      if (upcoming.length === 1 && upcoming[0] !== undefined) {
        return { ok: true, appointmentId: upcoming[0].id };
      }

      return upcoming.length === 0
        ? { ok: false, ask: CALL_BACK }
        : {
            ok: false,
            ask: 'There is more than one appointment booked. Which day were you calling about?',
          };
    },
  );
};

export const reschedule = async (
  identity: VoiceAgentIdentity,
  body: RescheduleBody,
  now: Date = new Date(),
): Promise<ToolEnvelope<unknown>> => {
  const principal = voicePrincipal(identity);
  requirePermission('appointments', 'write', principal);
  const organisationId = organisationInScope(principal, undefined);

  const located = await locateAppointment(identity, body, now);

  if (!located.ok) {
    return refusal(located.ask);
  }

  const timeZone = await withOrganisationScope(
    principal,
    organisationId,
    'voice.clinic-zone',
    (db) => appointmentRepository.organisationTimeZone(db, organisationId),
  );

  const startAt = zonedTimeToUtc(body.date, minuteOfDay(body.time), timeZone);

  const result = await appointments.reschedule(
    principal,
    undefined,
    located.appointmentId,
    { startAt: startAt.toISOString(), reason: 'Moved by the voice agent' },
    now,
    { actorSource: SOURCE },
  );

  return success(`That is moved to ${body.time} on ${body.date}.`, {
    appointmentId: result.appointmentId,
    startAt: result.startAt,
    endAt: result.endAt,
  });
};

export const cancel = async (
  identity: VoiceAgentIdentity,
  body: CancelBody,
  now: Date = new Date(),
): Promise<ToolEnvelope<unknown>> => {
  const principal = voicePrincipal(identity);
  requirePermission('appointments', 'write', principal);

  const located = await locateAppointment(identity, body, now);

  if (!located.ok) {
    return refusal(located.ask);
  }

  await appointments.cancel(
    principal,
    undefined,
    located.appointmentId,
    { reason: body.reason ?? 'Cancelled by the patient on a call' },
    now,
    { actorSource: SOURCE },
  );

  return success('That appointment is cancelled.', {
    appointmentId: located.appointmentId,
    cancelled: true,
  });
};
