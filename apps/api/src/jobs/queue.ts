import { PgBoss } from 'pg-boss';
import { config } from '../config.js';
import { logger } from '../common/logger.js';

/**
 * The job runner: pg-boss on the application's own PostgreSQL.
 *
 * ─── WHY A QUEUE AT ALL ─────────────────────────────────────────────────────────
 *
 * A webhook must be answered in under a second (`sarvam-voice-integration`), and the work it
 * triggers is three network calls to Sarvam and a file upload. Doing that inside the request
 * would mean a provider timing out and re-sending an event we are halfway through handling.
 * So the route stores the event and returns, and everything else happens here.
 *
 * ─── WHY NOT A SECOND PIECE OF INFRASTRUCTURE ───────────────────────────────────
 *
 * pg-boss keeps its queues in the database the platform already runs, in its own schema. For
 * one clinic on one Lightsail box (D-020) that is the whole argument: no Redis to provision,
 * no second thing to back up, and a job that is enqueued in the same database the work was
 * recorded in.
 *
 * ─── IT IS STARTED EXPLICITLY, AND NEVER BY IMPORTING THIS FILE ─────────────────
 *
 * `start` creates its schema and begins polling. Tests that do not want a worker simply do
 * not call it, which is why there is no module-level instance here: an import that quietly
 * opened a connection pool and started migrating a schema would make every unrelated test
 * depend on a database.
 */

export const VOICE_QUEUES = {
  /** Parse a stored webhook event, resolve its clinic, write the call and its transcript. */
  processWebhookEvent: 'voice.webhook-event.process',
  /** Fetch the recording from the provider and copy it into our own object storage. */
  downloadRecording: 'voice.recording.download',
  /** Find calls the provider has that we do not, for deliveries that never arrived. */
  catchUpInteractions: 'voice.interactions.catch-up',
} as const;

export type VoiceQueue = (typeof VOICE_QUEUES)[keyof typeof VOICE_QUEUES];

export type ProcessWebhookEventJob = { readonly webhookEventId: string };
export type DownloadRecordingJob = { readonly callId: string; readonly organisationId: string };
export type CatchUpJob = { readonly hours: number };

let boss: PgBoss | undefined;

/**
 * Retry policy, stated once.
 *
 * Six attempts with exponential backoff, which from a 30-second base reaches roughly a
 * quarter of an hour. Two things drive those numbers rather than taste: the contract says the
 * interactions list is cached for 60 seconds (section 5), so verifying a call just after it
 * ended can find nothing and must be retried rather than believed; and it says 429 carries
 * `Retry-After` and 5xx should be retried with backoff (section 1).
 */
const RETRY = { retryLimit: 6, retryDelay: 30, retryBackoff: true } as const;

export const startQueue = async (): Promise<PgBoss> => {
  if (boss !== undefined) {
    return boss;
  }

  const instance = new PgBoss({
    connectionString: config.DATABASE_URL,
    // Its own schema, so pg-boss's tables never appear in a `prisma migrate diff` and the
    // application's migrations never collide with its own.
    schema: 'pgboss',
    /**
     * Two at a time. The box is a 2 GB Lightsail instance (D-020) and the heaviest job
     * buffers a recording in memory, so a generous pool would be the thing that pushed the
     * API out of RAM rather than a throughput win.
     */
    max: 2,
  });

  instance.on('error', (error: unknown) => {
    // pg-boss emits rather than throwing for background failures. Unhandled, these are
    // invisible until a queue has silently stopped.
    logger.error({ err: error }, 'job runner error');
  });

  await instance.start();

  for (const queue of Object.values(VOICE_QUEUES)) {
    await instance.createQueue(queue);
  }

  boss = instance;
  logger.info({ queues: Object.values(VOICE_QUEUES) }, 'job runner started');

  return instance;
};

/**
 * Stops polling and waits for jobs in flight.
 *
 * `graceful` with a timeout, because the alternative is a recording half-written to object
 * storage and a job row left in flight: pg-boss would re-run it, which is safe, and the half
 * object would be overwritten, which is also safe, but a clean stop is cheaper than relying
 * on both of those being true.
 */
export const stopQueue = async (): Promise<void> => {
  if (boss === undefined) {
    return;
  }

  const stopping = boss;
  boss = undefined;

  await stopping.stop({ graceful: true, timeout: config.SHUTDOWN_TIMEOUT_MS });
  logger.info('job runner stopped');
};

/**
 * Enqueues a job, or does nothing if the runner is not started.
 *
 * SILENT WHEN THERE IS NO RUNNER, and that is a deliberate trade with a cost. The webhook
 * route must answer 200 to a provider that has already handed us the event, and failing the
 * response because a worker is not running would make the provider re-send an event we have
 * already stored. The event is in `webhook_events` either way, with status RECEIVED, so the
 * catch-up job is what eventually picks it up. The absence is logged at warn.
 */
export const enqueue = async (
  queue: VoiceQueue,
  data: object,
  options: { readonly startAfterSeconds?: number } = {},
): Promise<string | null> => {
  if (boss === undefined) {
    logger.warn({ queue }, 'job enqueued with no runner started; it will be caught up later');
    return null;
  }

  return boss.send(queue, data, {
    ...RETRY,
    ...(options.startAfterSeconds === undefined ? {} : { startAfter: options.startAfterSeconds }),
  });
};

/** For tests and for the worker process: the running instance, or undefined. */
export const currentQueue = (): PgBoss | undefined => boss;
