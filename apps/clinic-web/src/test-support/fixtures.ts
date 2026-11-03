import type {
  AgendaResult,
  AppointmentListPage,
  AppointmentView,
  AvailabilityResult,
  CallDetail,
  CallListPage,
  CallView,
  ClinicDetailView,
  OverviewResult,
  PatientDetail,
  PatientListPage,
} from '@clinicai/api-client';
import type { StubRoutes } from './harness';

/**
 * Synthetic responses for the screen tests.
 *
 * ALL OF IT IS OBVIOUSLY FAKE, which is the rule for test data in a product that holds
 * patient records (root CLAUDE.md rule 6). The names are "Test Patient One", the numbers are
 * in the Indian mobile range and belong to nobody, and no value here resembles a real person.
 *
 * THE INSTANTS ARE FIXED AND IN UTC, and the clinic is `Asia/Kolkata`, so every assertion
 * about a rendered time is also an assertion that the conversion happened: 03:30Z is 09:00 to
 * this clinic, and a screen that rendered "3:30 am" would be reading the browser's zone.
 */

/**
 * `org-1`, which is what `user()` in the harness puts on the signed-in principal.
 *
 * The id has to match, because the clinic query asks for the organisation on the session and
 * a stub keyed by any other id answers 404. A uuid-shaped value here looked more realistic and
 * made every screen test render its error state.
 */
export const ORGANISATION_ID = 'org-1';
export const PATIENT_ID = '0199ff00-0000-7000-8000-00000000d222';
export const DOCTOR_ID = '0199ff00-0000-7000-8000-00000000e333';
export const SERVICE_ID = '0199ff00-0000-7000-8000-00000000f444';
export const APPOINTMENT_ID = '0199ff00-0000-7000-8000-000000010555';

export const clinic: ClinicDetailView = {
  organisation: {
    id: ORGANISATION_ID,
    name: 'Test Clinic One',
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE',
    clinicPhone: '+919900000001',
    createdAt: '2026-01-01T00:00:00.000Z',
    openingHoursCollectedAt: '2026-01-02T00:00:00.000Z',
    recordingRetentionDays: 90,
  },
  profile: {
    legalName: 'Test Clinic One Private Limited',
    contactEmail: 'reception@test.invalid',
    contactPhone: '+919900000002',
    website: null,
    addressLine1: '1 Test Road',
    addressLine2: null,
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: null,
    mapUrl: null,
  },
  hours: [
    { weekday: 'MONDAY', segments: [{ opensAtMinute: 540, closesAtMinute: 1020 }] },
    { weekday: 'TUESDAY', segments: [{ opensAtMinute: 540, closesAtMinute: 1020 }] },
    { weekday: 'WEDNESDAY', segments: [{ opensAtMinute: 540, closesAtMinute: 1020 }] },
    { weekday: 'THURSDAY', segments: [{ opensAtMinute: 540, closesAtMinute: 1020 }] },
    { weekday: 'FRIDAY', segments: [{ opensAtMinute: 540, closesAtMinute: 1020 }] },
    { weekday: 'SATURDAY', segments: [] },
    { weekday: 'SUNDAY', segments: [] },
  ],
  bookingPolicy: {
    slotGranularityMinutes: 15,
    minimumNoticeMinutes: 0,
    maximumAdvanceDays: 60,
    cancellationWindowHours: 24,
    acceptsNewPatients: true,
    defaultBufferMinutes: 0,
    maxPerSlot: 1,
    noShowPolicy: null,
  },
  agentProfile: {
    greeting: 'Test Clinic One, how can I help?',
    languages: ['en-IN'],
    tone: 'FRIENDLY',
    fullyBookedResponse: null,
    escalationRules: null,
    neverPromise: [],
  },
  telephony: null,
  faqs: [],
  services: [
    { id: SERVICE_ID, name: 'Consultation', durationMinutes: 30, priceMinor: 50000, active: true },
    {
      id: '0199ff00-0000-7000-8000-00000000f445',
      name: 'Retired Service',
      durationMinutes: 15,
      priceMinor: null,
      active: false,
    },
  ],
  doctors: [
    {
      id: DOCTOR_ID,
      fullName: 'Dr Test Doctor',
      specialty: 'General',
      bufferMinutes: 0,
      active: true,
    },
  ],
  sarvamMapping: null,
  readiness: {
    ready: true,
    satisfiedCount: 10,
    totalCount: 10,
    incompleteSections: [],
    missing: [],
  },
};

export const appointment: AppointmentView = {
  id: APPOINTMENT_ID,
  // 03:30Z is 09:00 in Asia/Kolkata.
  startAt: '2026-11-16T03:30:00.000Z',
  endAt: '2026-11-16T04:00:00.000Z',
  status: 'SCHEDULED',
  source: 'VOICE_AGENT',
  patient: { id: PATIENT_ID, fullName: 'Test Patient One', phone: '+919876543210' },
  doctor: { id: DOCTOR_ID, fullName: 'Dr Test Doctor' },
  service: { id: SERVICE_ID, name: 'Consultation', durationMinutes: 30 },
  cancelledAt: null,
  cancellationReason: null,
  rescheduledFromId: null,
  notes: 'Prefers the first slot of the morning.',
  createdAt: '2026-11-01T00:00:00.000Z',
};

export const patientList: PatientListPage = {
  items: [
    {
      id: PATIENT_ID,
      fullName: 'Test Patient One',
      phone: '+919876543210',
      dateOfBirth: '1988-06-14',
      lastAppointmentAt: '2026-10-01T03:30:00.000Z',
      nextAppointmentAt: '2026-11-16T03:30:00.000Z',
      nextAppointment: {
        startAt: '2026-11-16T03:30:00.000Z',
        status: 'SCHEDULED',
        source: 'VOICE_AGENT',
        serviceName: 'Consultation',
      },
      createdAt: '2026-01-05T00:00:00.000Z',
    },
  ],
  nextCursor: null,
};

export const patientDetail: PatientDetail = {
  ...patientList.items[0]!,
  notes: 'Prefers morning appointments.',
  updatedAt: '2026-10-01T00:00:00.000Z',
  appointments: [
    {
      id: APPOINTMENT_ID,
      startAt: '2026-11-16T03:30:00.000Z',
      endAt: '2026-11-16T04:00:00.000Z',
      status: 'SCHEDULED',
      source: 'VOICE_AGENT',
      doctorName: 'Dr Test Doctor',
      serviceName: 'Consultation',
    },
  ],
};

export const appointmentList: AppointmentListPage = {
  items: [appointment],
  nextCursor: null,
};

export const agenda = (range: AgendaResult['range'] = 'day'): AgendaResult => ({
  range,
  from: '2026-11-15T18:30:00.000Z',
  to: '2026-11-16T18:30:00.000Z',
  timeZone: 'Asia/Kolkata',
  counts: { SCHEDULED: 1, CONFIRMED: 2, COMPLETED: 3, CANCELLED: 0, NO_SHOW: 0 },
  appointments: [appointment],
});

export const availability = (
  slots: readonly { readonly startAt: string; readonly label: string }[] = [
    { startAt: '2026-11-16T03:30:00.000Z', label: '09:00' },
    { startAt: '2026-11-16T04:00:00.000Z', label: '09:30' },
  ],
): AvailabilityResult => ({
  date: '2026-11-16',
  timeZone: 'Asia/Kolkata',
  doctorId: DOCTOR_ID,
  serviceId: SERVICE_ID,
  durationMinutes: 30,
  slots: slots.map((slot) => ({
    startAt: slot.startAt,
    endAt: new Date(new Date(slot.startAt).getTime() + 30 * 60_000).toISOString(),
    label: slot.label,
  })),
  reason: slots.length === 0 ? 'FULLY_BOOKED' : null,
});

/** The routes every screen needs, which a test then overrides one at a time. */
/**
 * The overview's figures for a week, chosen so every card has something different to say:
 * a rise (calls 6 against 4), a figure from nothing ("New" for AI bookings against 0), and a
 * fall (attention 1 against 2).
 */
export const overviewWeek: OverviewResult = {
  range: '7d',
  from: '2026-10-27T18:30:00.000Z',
  to: '2026-11-03T18:30:00.000Z',
  timeZone: 'Asia/Kolkata',
  currency: 'INR',
  kpis: {
    callsAnswered: { value: 6, previous: 4 },
    aiBookings: { value: 3, previous: 0 },
    bookingRequests: { value: 2, today: 1 },
    needsAttention: { value: 1, previous: 2 },
  },
  revenue: {
    valueMinor: 150_000,
    previousMinor: 0,
    series: [0, 0, 0, 0, 0, 0, 0, 50_000, 0, 50_000, 0, 50_000],
  },
  daily: [
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
  ].map((day, index) => ({
    day,
    callsAnswered: index % 2,
    aiBookings: index === 6 ? 1 : 0,
    bookingRequests: 0,
    needsAttention: 0,
  })),
  outcomes: { BOOKED: 2, RESCHEDULED: 0, CANCELLED: 0, INFORMATION: 1, TRANSFERRED: 0, NONE: 3 },
  agent: { status: 'ACTIVE', lastCallAt: '2026-11-03T06:00:00.000Z' },
};

export const CALL_ID = '01932b00-0000-7000-8000-00000000c411';

export const call: CallView = {
  id: CALL_ID,
  // The provider's id carries a slash, which is the shape the contract documents.
  externalCallId: '20261102/int_fixture_0001',
  direction: 'INBOUND',
  status: 'COMPLETED',
  outcome: 'NONE',
  fromE164: '+919876543210',
  toE164: '+918000000001',
  startedAt: '2026-11-02T06:30:00.000Z',
  endedAt: '2026-11-02T06:31:32.000Z',
  durationSeconds: 92,
  patient: { id: PATIENT_ID, fullName: 'Test Patient One' },
  appointmentId: APPOINTMENT_ID,
  hasRecording: true,
  createdAt: '2026-11-02T06:31:40.000Z',
};

export const callList: CallListPage = { items: [call], nextCursor: null };

export const callDetail: CallDetail = {
  call,
  transcript: [
    { role: 'CALLER', text: 'I would like an appointment on Tuesday.' },
    { role: 'AGENT', text: 'There is ten thirty. Shall I book that?' },
  ],
};

export const baseRoutes: StubRoutes = {
  [`GET /api/v1/organisations/${ORGANISATION_ID}`]: { body: clinic },
  'GET /api/v1/patients': { body: patientList },
  'GET /api/v1/patients/summary': { body: { registered: 1, upcomingVisits: 1 } },
  [`GET /api/v1/patients/${PATIENT_ID}`]: { body: patientDetail },
  'GET /api/v1/appointments': { body: appointmentList },
  'GET /api/v1/appointments/agenda': { body: agenda() },
  'GET /api/v1/appointments/availability': { body: availability() },
  [`GET /api/v1/appointments/${APPOINTMENT_ID}`]: { body: appointment },
  'GET /api/v1/calls': { body: callList },
  'GET /api/v1/analytics/overview': { body: overviewWeek },
  [`GET /api/v1/calls/${CALL_ID}`]: { body: callDetail },
  [`GET /api/v1/calls/${CALL_ID}/recording-url`]: {
    body: { url: 'https://storage.test/recording.wav?signature=stub', expiresInSeconds: 300 },
  },
};
