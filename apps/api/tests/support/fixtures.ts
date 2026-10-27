import { uuidV7 } from '../../src/common/uuid.js';
import {
  AppointmentSource,
  AppointmentStatus,
  CallDirection,
  CallStatus,
  FollowUpStatus,
  NotificationChannel,
  OutboundCallStatus,
  PhoneKind,
  PrescriptionStatus,
  Provider,
  Role,
  Weekday,
  WebhookEventStatus,
} from '../../src/generated/prisma/enums.js';
import type { Tx } from './db.js';

/**
 * Creates exactly one row in EVERY tenant table for one organisation.
 *
 * The isolation suite asserts "no row of organisation B is reachable from A" per table,
 * so each table must actually hold a row for both. A table left empty would pass every
 * assertion while proving nothing, which is the failure mode this fixture exists to
 * prevent.
 *
 * All data is synthetic. Phone numbers are in a reserved test range.
 */

export type OrganisationGraph = {
  readonly organisationId: string;
  /** Row id per table, so a test can target a specific foreign organisation's row. */
  readonly ids: Readonly<Record<string, string>>;
};

/**
 * Every globally-unique column is derived from the organisation id rather than a
 * counter. A module-level counter restarts in each test FILE, which collided on the
 * globally unique columns (agent e164, external ids, dedupe keys) as soon as a second
 * file built a fixture. Deriving from the id makes uniqueness structural.
 */
const uniqueSuffix = (organisationId: string): string => {
  const digits = BigInt(`0x${organisationId.replaceAll('-', '').slice(-12)}`) % 100_000_000n;
  return String(digits).padStart(8, '0');
};

export const createOrganisationGraph = async (
  tx: Tx,
  label: string,
): Promise<OrganisationGraph> => {
  const organisationId = uuidV7();
  const suffix = uniqueSuffix(organisationId);

  await tx.organisation.create({
    data: {
      id: organisationId,
      name: `Test Clinic ${label}`,
      timezone: 'Asia/Kolkata',
      settings: { recordings_visible_to_staff: false },
    },
  });

  const userId = uuidV7();
  await tx.user.create({
    data: {
      id: userId,
      organisationId,
      email: `owner.${label.toLowerCase()}.${suffix}@test.invalid`,
      passwordHash: 'not-a-real-hash',
      fullName: `Owner ${label}`,
      role: Role.CLINIC_OWNER,
    },
  });

  const clinicLineId = uuidV7();
  await tx.phoneNumber.create({
    data: {
      id: clinicLineId,
      organisationId,
      e164: `+9199${suffix}`,
      kind: PhoneKind.CLINIC_LINE,
    },
  });

  const voiceAgentId = uuidV7();
  await tx.voiceAgent.create({
    data: {
      id: voiceAgentId,
      organisationId,
      provider: Provider.SARVAM,
      externalAgentId: `agent-${suffix}`,
    },
  });

  const deviceId = uuidV7();
  await tx.device.create({
    data: {
      id: deviceId,
      organisationId,
      label: `Device ${label}`,
      tokenHash: `device-token-hash-${suffix}`,
    },
  });

  const pairingCodeId = uuidV7();
  await tx.pairingCode.create({
    data: {
      id: pairingCodeId,
      organisationId,
      codeHash: `pairing-code-hash-${suffix}`,
      createdByUserId: userId,
      expiresAt: new Date(Date.now() + 600_000),
    },
  });

  const notificationId = uuidV7();
  await tx.notification.create({
    data: {
      id: notificationId,
      organisationId,
      userId,
      channel: NotificationChannel.IN_APP,
      kind: 'appointment.created',
      payload: { appointmentId: uuidV7() },
    },
  });

  const auditLogId = uuidV7();
  await tx.auditLog.create({
    data: {
      id: auditLogId,
      organisationId,
      actorUserId: userId,
      actorRole: Role.CLINIC_OWNER,
      action: 'fixture.created',
      entityType: 'organisation',
      entityId: organisationId,
    },
  });

  const clinicHoursId = uuidV7();
  await tx.clinicHours.create({
    data: {
      id: clinicHoursId,
      organisationId,
      weekday: Weekday.MONDAY,
      opensAtMinute: 9 * 60,
      closesAtMinute: 17 * 60,
    },
  });

  const doctorId = uuidV7();
  await tx.doctor.create({
    data: { id: doctorId, organisationId, fullName: `Doctor ${label}` },
  });

  const workingHoursId = uuidV7();
  await tx.doctorWorkingHours.create({
    data: {
      id: workingHoursId,
      organisationId,
      doctorId,
      weekday: Weekday.MONDAY,
      startAtMinute: 9 * 60,
      endAtMinute: 17 * 60,
    },
  });

  const timeOffId = uuidV7();
  await tx.doctorTimeOff.create({
    data: {
      id: timeOffId,
      organisationId,
      doctorId,
      startAt: new Date('2026-12-24T00:00:00.000Z'),
      endAt: new Date('2026-12-26T00:00:00.000Z'),
    },
  });

  const serviceId = uuidV7();
  await tx.service.create({
    data: { id: serviceId, organisationId, name: 'Consultation', durationMinutes: 30 },
  });

  const doctorServiceId = uuidV7();
  await tx.doctorService.create({
    data: { id: doctorServiceId, organisationId, doctorId, serviceId },
  });

  const patientId = uuidV7();
  await tx.patient.create({
    data: {
      id: patientId,
      organisationId,
      fullName: `Patient ${label}`,
      phone: `+9188${suffix}`,
    },
  });

  const appointmentId = uuidV7();
  // A fixed time is safe: the exclusion constraint keys on doctor_id, and every
  // organisation in a fixture has its own doctor.
  const startAt = new Date('2026-11-02T03:00:00.000Z');
  await tx.appointment.create({
    data: {
      id: appointmentId,
      organisationId,
      patientId,
      doctorId,
      serviceId,
      startAt,
      endAt: new Date(startAt.getTime() + 30 * 60_000),
      status: AppointmentStatus.SCHEDULED,
      source: AppointmentSource.DASHBOARD,
      idempotencyKey: `idem-${suffix}`,
    },
  });

  const callId = uuidV7();
  await tx.call.create({
    data: {
      id: callId,
      organisationId,
      externalCallId: `call-${suffix}`,
      direction: CallDirection.INBOUND,
      status: CallStatus.COMPLETED,
      fromE164: `+9177${suffix}`,
      toE164: `+9199${suffix}`,
      patientId,
      appointmentId,
    },
  });

  const webhookEventId = uuidV7();
  await tx.webhookEvent.create({
    data: {
      id: webhookEventId,
      organisationId,
      externalEventId: `event-${suffix}`,
      eventType: 'call.completed',
      status: WebhookEventStatus.PROCESSED,
      payload: { callId: `call-${suffix}` },
    },
  });

  const prescriptionId = uuidV7();
  await tx.prescription.create({
    data: {
      id: prescriptionId,
      organisationId,
      patientId,
      doctorId,
      appointmentId,
      status: PrescriptionStatus.ISSUED,
      issuedAt: new Date(),
    },
  });

  const prescriptionItemId = uuidV7();
  await tx.prescriptionItem.create({
    data: {
      id: prescriptionItemId,
      organisationId,
      prescriptionId,
      medication: 'Test Medication',
      dosage: '500mg',
    },
  });

  const followUpId = uuidV7();
  await tx.followUp.create({
    data: {
      id: followUpId,
      organisationId,
      patientId,
      doctorId,
      appointmentId,
      assignedUserId: userId,
      dueAt: new Date(Date.now() + 86_400_000),
      status: FollowUpStatus.PENDING,
    },
  });

  const outboundCallId = uuidV7();
  await tx.outboundCall.create({
    data: {
      id: outboundCallId,
      organisationId,
      patientId,
      dedupeKey: `dedupe-${suffix}`,
      kind: 'reminder',
      status: OutboundCallStatus.QUEUED,
      scheduledAt: new Date(Date.now() + 3_600_000),
    },
  });

  const forwardingScheduleId = uuidV7();
  await tx.forwardingSchedule.create({
    data: {
      id: forwardingScheduleId,
      organisationId,
      weekday: Weekday.MONDAY,
      startAtMinute: 18 * 60,
      endAtMinute: 22 * 60,
    },
  });

  const forwardingEventId = uuidV7();
  await tx.forwardingEvent.create({
    data: {
      id: forwardingEventId,
      organisationId,
      scheduleId: forwardingScheduleId,
      deviceId,
      outcome: 'applied',
    },
  });

  return {
    organisationId,
    ids: {
      organisations: organisationId,
      users: userId,
      phone_numbers: clinicLineId,
      voice_agents: voiceAgentId,
      devices: deviceId,
      pairing_codes: pairingCodeId,
      notifications: notificationId,
      audit_logs: auditLogId,
      clinic_hours: clinicHoursId,
      doctors: doctorId,
      doctor_working_hours: workingHoursId,
      doctor_time_off: timeOffId,
      services: serviceId,
      doctor_services: doctorServiceId,
      patients: patientId,
      appointments: appointmentId,
      calls: callId,
      webhook_events: webhookEventId,
      prescriptions: prescriptionId,
      prescription_items: prescriptionItemId,
      follow_ups: followUpId,
      outbound_calls: outboundCallId,
      forwarding_schedules: forwardingScheduleId,
      forwarding_events: forwardingEventId,
    },
  };
};
