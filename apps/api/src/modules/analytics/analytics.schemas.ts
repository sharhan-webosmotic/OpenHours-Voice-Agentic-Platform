import { z } from 'zod';

/**
 * The overview's contract: aggregates only, for the dashboard's cards and charts.
 *
 * ─── NOTHING HERE NAMES A PERSON ────────────────────────────────────────────────
 *
 * Counts, sums and per-day series. No patient, no number, no transcript. That is why the
 * route is not marked PHI-sensitive and why a platform role, whose `analytics` scope is
 * `usage` ("aggregate counts only, never per-patient figures"), may read it. The tables on
 * the same screen that DO name people come from the appointment and call endpoints, which
 * are audited on their own.
 */

export const OVERVIEW_RANGES = ['today', '7d', '30d', 'month', 'last-month'] as const;

export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export const overviewQuerySchema = z.object({
  range: z.enum(OVERVIEW_RANGES).default('7d'),
  organisationId: z.uuid().optional(),
});

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;

const metric = z.object({
  value: z.number().int().nonnegative(),
  /** The same measure over the equal period immediately before, for the delta. */
  previous: z.number().int().nonnegative(),
});

export const overviewResponseSchema = z.object({
  range: z.enum(OVERVIEW_RANGES),
  from: z.string(),
  to: z.string(),
  timeZone: z.string(),
  /** ISO 4217. Every price on the platform is integer minor units in this currency. */
  currency: z.string(),
  kpis: z.object({
    callsAnswered: metric,
    aiBookings: metric,
    /** Upcoming appointments still awaiting confirmation, and how many arrived today. */
    bookingRequests: z.object({
      value: z.number().int().nonnegative(),
      today: z.number().int().nonnegative(),
    }),
    /** Calls that ended without being answered: missed, abandoned or failed. */
    needsAttention: metric,
  }),
  daily: z.array(
    z.object({
      day: z.string(),
      callsAnswered: z.number().int().nonnegative(),
      aiBookings: z.number().int().nonnegative(),
      bookingRequests: z.number().int().nonnegative(),
      needsAttention: z.number().int().nonnegative(),
    }),
  ),
  /** Every call in the range by its recorded outcome, including the ones nobody classified. */
  outcomes: z.object({
    BOOKED: z.number().int().nonnegative(),
    RESCHEDULED: z.number().int().nonnegative(),
    CANCELLED: z.number().int().nonnegative(),
    INFORMATION: z.number().int().nonnegative(),
    TRANSFERRED: z.number().int().nonnegative(),
    NONE: z.number().int().nonnegative(),
  }),
  agent: z.object({
    lastCallAt: z.string().nullable(),
  }),
});
