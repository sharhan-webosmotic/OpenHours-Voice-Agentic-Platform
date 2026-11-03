import {
  addDays,
  clinicDayOf,
  daysBetween,
  endOfClinicDay,
  startOfClinicDay,
  type ClinicDay,
} from '@clinicai/shared';
import {
  MATCHES_NO_DOCTOR,
  requirePermission,
  scopeFilter,
  type Principal,
} from '../../common/permissions.js';
import { organisationInScope } from '../../common/organisation-scope.js';
import { withOrganisationScope } from '../../db/principal-scope.js';
import { organisationTimeZone } from '../appointments/appointments.repository.js';
import * as repository from './analytics.repository.js';
import type { OverviewRange } from './analytics.schemas.js';

/**
 * The overview's figures, every one of them derived from rows the platform holds.
 *
 * ─── WHAT EACH CARD MEANS, SINCE THE DESIGN ONLY GIVES IT A LABEL ───────────────
 *
 *   Calls Answered      inbound calls that completed, by when they began
 *   AI Bookings         appointments the agent booked, by when the booking was MADE
 *   Booking Requests    upcoming appointments still awaiting confirmation, which is what
 *                       "awaiting review" can mean on a platform with no review queue
 *   Needs Attention     calls that ended unanswered: missed, abandoned or failed. Each is a
 *                       patient somebody should ring back
 *
 * No revenue figure: it is hidden for the pilot until its formula is agreed (D-023).
 *
 * Each has the same measure over the equal period immediately before it, so the design's
 * "+12.4% vs last week" is a comparison of two real numbers rather than a decoration.
 *
 * ─── IN THE CLINIC'S DAYS ───────────────────────────────────────────────────────
 *
 * "Last 7 days" means seven of the clinic's calendar days, ending today in Kolkata, and a
 * call at 00:30 IST is on the day it happened there rather than on the UTC day before.
 */

type Window = {
  readonly from: Date;
  readonly to: Date;
  readonly previousFrom: Date;
  readonly previousTo: Date;
  readonly days: readonly ClinicDay[];
};

const monthStart = (day: ClinicDay): ClinicDay => `${day.slice(0, 7)}-01`;

const previousMonthStart = (day: ClinicDay): ClinicDay => {
  const [year, month] = day.split('-').map(Number) as [number, number];
  const moved = new Date(Date.UTC(year, month - 2, 1));
  return moved.toISOString().slice(0, 10);
};

/**
 * The range and the equal range before it, in clinic days.
 *
 * "This month" is compared with the same number of days at the start of LAST month, not with
 * the whole of last month: three days of November against thirty of October would make every
 * month look like a collapse until the 30th.
 */
export const windowFor = (range: OverviewRange, now: Date, timeZone: string): Window => {
  const today = clinicDayOf(now, timeZone);

  const span = (first: ClinicDay, last: ClinicDay, previousFirst: ClinicDay): Window => {
    const days = daysBetween(first, last);
    const previousLast = addDays(previousFirst, days.length - 1);

    return {
      from: startOfClinicDay(first, timeZone),
      to: endOfClinicDay(last, timeZone),
      previousFrom: startOfClinicDay(previousFirst, timeZone),
      previousTo: endOfClinicDay(previousLast, timeZone),
      days,
    };
  };

  switch (range) {
    case 'today':
      return span(today, today, addDays(today, -1));
    case '7d':
      return span(addDays(today, -6), today, addDays(today, -13));
    case '30d':
      return span(addDays(today, -29), today, addDays(today, -59));
    case 'month':
      return span(monthStart(today), today, previousMonthStart(today));
    case 'last-month': {
      const first = previousMonthStart(today);
      const last = addDays(monthStart(today), -1);
      return span(first, last, previousMonthStart(first));
    }
  }
};

const isAnswered = (call: repository.CallFact): boolean =>
  call.direction === 'INBOUND' && call.status === 'COMPLETED';

const needsAttention = (call: repository.CallFact): boolean =>
  call.status === 'MISSED' || call.status === 'ABANDONED' || call.status === 'FAILED';

/**
 * A booking the agent MADE. A reschedule writes a new row that inherits the original's
 * source, so counting rows by source alone counted a moved AI booking twice, and credited the
 * agent with every reschedule a receptionist did. The original row is the booking; the row a
 * reschedule creates is not a new one, whoever moved it.
 */
const isAiBooking = (appointment: repository.AppointmentFact): boolean =>
  appointment.source === 'VOICE_AGENT' && appointment.rescheduledFromId === null;

export type Overview = {
  readonly range: OverviewRange;
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly kpis: {
    readonly callsAnswered: { readonly value: number; readonly previous: number };
    readonly aiBookings: { readonly value: number; readonly previous: number };
    readonly bookingRequests: { readonly value: number; readonly today: number };
    readonly needsAttention: { readonly value: number; readonly previous: number };
  };
  readonly daily: readonly {
    readonly day: string;
    readonly callsAnswered: number;
    readonly aiBookings: number;
    readonly bookingRequests: number;
    readonly needsAttention: number;
  }[];
  readonly outcomes: Readonly<
    Record<'BOOKED' | 'RESCHEDULED' | 'CANCELLED' | 'INFORMATION' | 'TRANSFERRED' | 'NONE', number>
  >;
  readonly agent: {
    readonly lastCallAt: string | null;
  };
};

/**
 * INR, for every clinic, today.
 *
 * Prices are integer minor units with no currency column beside them, because the platform
 * serves Indian clinics and the services screen already renders them as rupees. A clinic in
 * another country is a schema change, and this constant is where the overview would read it.
 */
const CURRENCY = 'INR';

export const overview = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  range: OverviewRange,
  now: Date = new Date(),
): Promise<Overview> => {
  const scope = requirePermission('analytics', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'analytics.overview', async (db) => {
    const timeZone = await organisationTimeZone(db, organisationId);
    const window = windowFor(range, now, timeZone);

    /**
     * A DOCTOR reads `own`: their appointments and the calls attached to them. A doctor
     * with no doctor row reads NOTHING, rather than the clinic, which is the direction a
     * misconfigured account must fail in.
     */
    const doctorId =
      scopeFilter(scope, principal).kind === 'own-doctor'
        ? ((await repository.doctorIdForUser(db, organisationId, principal.userId)) ??
          MATCHES_NO_DOCTOR)
        : undefined;

    const [appointments, previousAppointments, calls, previousCalls, pending, agent] =
      await Promise.all([
        repository.appointmentsCreated(db, organisationId, window.from, window.to, doctorId),
        repository.appointmentsCreated(
          db,
          organisationId,
          window.previousFrom,
          window.previousTo,
          doctorId,
        ),
        repository.callsBetween(db, organisationId, window.from, window.to, doctorId),
        repository.callsBetween(
          db,
          organisationId,
          window.previousFrom,
          window.previousTo,
          doctorId,
        ),
        repository.pendingRequests(db, organisationId, now, doctorId),
        repository.agentSnapshot(db, organisationId),
      ]);

    const aiBookings = appointments.filter(isAiBooking);
    const previousAiBookings = previousAppointments.filter(isAiBooking);
    const today = clinicDayOf(now, timeZone);

    const daily = window.days.map((day) => ({
      day,
      callsAnswered: calls.filter(
        (call) => isAnswered(call) && clinicDayOf(call.at, timeZone) === day,
      ).length,
      aiBookings: aiBookings.filter((row) => clinicDayOf(row.createdAt, timeZone) === day).length,
      bookingRequests: pending.filter((row) => clinicDayOf(row.createdAt, timeZone) === day).length,
      needsAttention: calls.filter(
        (call) => needsAttention(call) && clinicDayOf(call.at, timeZone) === day,
      ).length,
    }));

    const outcomes = {
      BOOKED: 0,
      RESCHEDULED: 0,
      CANCELLED: 0,
      INFORMATION: 0,
      TRANSFERRED: 0,
      NONE: 0,
    };

    for (const call of calls) {
      const key = call.outcome as keyof typeof outcomes;
      outcomes[key in outcomes ? key : 'NONE'] += 1;
    }

    return {
      range,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      timeZone,
      currency: CURRENCY,
      kpis: {
        callsAnswered: {
          value: calls.filter(isAnswered).length,
          previous: previousCalls.filter(isAnswered).length,
        },
        aiBookings: { value: aiBookings.length, previous: previousAiBookings.length },
        bookingRequests: {
          value: pending.length,
          today: pending.filter((row) => clinicDayOf(row.createdAt, timeZone) === today).length,
        },
        needsAttention: {
          value: calls.filter(needsAttention).length,
          previous: previousCalls.filter(needsAttention).length,
        },
      },
      daily,
      outcomes,
      agent: {
        lastCallAt: agent.lastCallAt?.toISOString() ?? null,
      },
    };
  });
};
