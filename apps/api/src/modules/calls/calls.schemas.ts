import { z } from 'zod';

/**
 * The call history's contract.
 *
 * WHAT A CLINIC ROLE SEES AND WHAT A PLATFORM ROLE DOES NOT. The matrix gives platform roles
 * `call_history: read` at scope `metadata` and `recordings: none`, which is not a nicety: a
 * recording is the rawest patient data the platform holds, and the numbers on a call are
 * personal data in their own right. So the presenter nulls the numbers and the patient for a
 * platform role, and the recording endpoint refuses them outright.
 */

export const callStatusValues = [
  'RINGING',
  'IN_PROGRESS',
  'COMPLETED',
  'MISSED',
  'ABANDONED',
  'FAILED',
] as const;

export const listCallsQuerySchema = z.object({
  /** Clinic-local day bounds are resolved by the service, which knows the time zone. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  status: z
    .union([z.enum(callStatusValues), z.array(z.enum(callStatusValues))])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    ),
  /** Matched against the caller's number. Digits only; two or more or it is ignored. */
  q: z.string().trim().min(1).max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  /** A platform role must name the clinic it is asking about, as elsewhere. */
  organisationId: z.uuid().optional(),
});

export const callParamsSchema = z.object({ callId: z.uuid() });

export const callScopeQuerySchema = z.object({ organisationId: z.uuid().optional() });

const callViewSchema = z.object({
  id: z.string(),
  externalCallId: z.string(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  status: z.enum(callStatusValues),
  outcome: z.string(),
  /** Null for a platform role, whose scope is `metadata`. */
  fromE164: z.string().nullable(),
  toE164: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  patient: z.object({ id: z.string(), fullName: z.string().nullable() }).nullable(),
  appointmentId: z.string().nullable(),
  /** Whether a recording exists, never the key: the key is not a thing a client may hold. */
  hasRecording: z.boolean(),
  createdAt: z.string(),
});

export const callListResponseSchema = z.object({
  items: z.array(callViewSchema),
  nextCursor: z.string().nullable(),
});

export const callDetailResponseSchema = z.object({
  call: callViewSchema,
  transcript: z.array(z.object({ role: z.enum(['AGENT', 'CALLER', 'OTHER']), text: z.string() })),
});

export const recordingUrlResponseSchema = z.object({
  /** A short-lived presigned URL. Never a path on our API: no route may stream (D-007). */
  url: z.string(),
  expiresInSeconds: z.number(),
});

export type ListCallsQuery = z.infer<typeof listCallsQuerySchema>;
export type CallParams = z.infer<typeof callParamsSchema>;
