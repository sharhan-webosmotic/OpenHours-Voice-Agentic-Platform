import type { PgBoss } from 'pg-boss';
import { logger } from '../common/logger.js';
import { runWithContext } from '../common/request-context.js';
import { uuidV7 } from '../common/uuid.js';
import {
  catchUpInteractions,
  downloadRecording,
  processWebhookEvent,
  VerificationPendingError,
} from '../voice/ingest.service.js';
import {
  enqueue,
  VOICE_QUEUES,
  type CatchUpJob,
  type DownloadRecordingJob,
  type ProcessWebhookEventJob,
} from './queue.js';

/**
 * What each queue does when a job arrives.
 *
 * ─── EVERY HANDLER RUNS IN A REQUEST CONTEXT OF ITS OWN ─────────────────────────
 *
 * A job has no request, and the context is what carries the id that ties a log line to the
 * work that produced it. Without one, `audit.record` files rows with no request id and every
 * log line from a job is unattributable. The id is minted here, once per job.
 *
 * ─── FAILURES THROW, AND THAT IS THE POINT ──────────────────────────────────────
 *
 * pg-boss retries a job that throws, six times with exponential backoff (see `queue.ts`), so
 * a handler must not swallow. What it must not do either is throw on a condition that will
 * never improve: those are recorded against the event row and returned normally, because a
 * payload that cannot be parsed will not parse better in four minutes.
 */

/** How long after a call is processed its recording and verification are first attempted. */
const RECORDING_JOB_DELAY_SECONDS = 120;

const withJobContext = async <T>(name: string, run: () => Promise<T>): Promise<T> =>
  runWithContext({ requestId: uuidV7() }, async () => {
    const started = Date.now();

    try {
      const result = await run();
      logger.info({ job: name, ms: Date.now() - started }, 'job finished');
      return result;
    } catch (error) {
      if (error instanceof VerificationPendingError) {
        // Expected while Sarvam's interactions list catches up (it is cached for 60 seconds).
        // Re-thrown so pg-boss retries it later, but not an error, or real ones get buried.
        logger.info(
          { job: name, ms: Date.now() - started },
          'job deferred: call not verifiable yet',
        );
        throw error;
      }

      // Logged here as well as re-thrown, because pg-boss stores the message on the job row
      // and not the stack, and this is the only place the cause is visible.
      logger.error({ job: name, err: error, ms: Date.now() - started }, 'job failed');
      throw error;
    }
  });

export const registerVoiceHandlers = async (boss: PgBoss): Promise<void> => {
  /**
   * Parse a stored event, write the call and its transcript, then queue the recording.
   *
   * The recording is a SEPARATE JOB rather than the tail of this one, for two reasons: it is
   * the slow part, and it is the part that fails on its own schedule. A recording that is not
   * ready yet must not drag a call row and a transcript through six retries with it.
   */
  await boss.work<ProcessWebhookEventJob>(
    VOICE_QUEUES.processWebhookEvent,
    { batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) {
        await withJobContext(VOICE_QUEUES.processWebhookEvent, async () => {
          const result = await processWebhookEvent(job.data.webhookEventId);
          const { callId, organisationId } = result;

          if (callId !== null && organisationId !== null && result.recordingQueued) {
            /**
             * Two minutes later, not now. The same job verifies the call against Sarvam's
             * interactions list, which is cached for 60 seconds, so an immediate first try
             * would usually be deferred and retried for nothing.
             */
            await enqueue(
              VOICE_QUEUES.downloadRecording,
              { callId, organisationId } satisfies DownloadRecordingJob,
              { startAfterSeconds: RECORDING_JOB_DELAY_SECONDS },
            );
          }
        });
      }
    },
  );

  await boss.work<DownloadRecordingJob>(
    VOICE_QUEUES.downloadRecording,
    { batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) {
        await withJobContext(VOICE_QUEUES.downloadRecording, () =>
          downloadRecording(job.data.callId, job.data.organisationId),
        );
      }
    },
  );

  await boss.work<CatchUpJob>(VOICE_QUEUES.catchUpInteractions, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await withJobContext(VOICE_QUEUES.catchUpInteractions, async () => {
        const result = await catchUpInteractions(job.data.hours);

        /**
         * `callsCreated` above zero means a webhook did not arrive, which is the one fact
         * worth a log line at info: the contract records UNKNOWN against Sarvam's retry
         * behaviour, and this counter is the evidence either way.
         */
        logger.info({ ...result }, 'catch-up finished');
      });
    }
  });

  /**
   * The catch-up runs on a schedule, hourly, over a window wider than the interval.
   *
   * SIX HOURS EVERY HOUR, deliberately overlapping. The contract records UNKNOWN against
   * whether Sarvam retries a webhook at all (section 6), so a delivery can simply never
   * arrive, and a window equal to the interval would miss anything that was not yet visible
   * in the provider's own list when the job ran. Re-reading five hours it has already seen
   * costs one list call per clinic and writes nothing, because every ingest is idempotent on
   * the interaction id.
   *
   * `schedule` is upserted by name, so starting the API twice does not create two of them.
   */
  await boss.schedule(VOICE_QUEUES.catchUpInteractions, '7 * * * *', {
    hours: 6,
  } satisfies CatchUpJob);

  logger.info('voice job handlers registered');
};
