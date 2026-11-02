import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config, type Config } from '../config.js';
import { logger } from '../common/logger.js';

/**
 * Object storage, against anything that speaks S3.
 *
 * THE PROVIDER IS CONFIGURATION, NOT CODE (D-018). It is Cloudflare R2 today, it was AWS
 * S3 before that, it is SeaweedFS locally, and Lightsail object storage would work too.
 * Four variables decide: `S3_ENDPOINT`, `AWS_REGION`, `S3_FORCE_PATH_STYLE` and the
 * credential pair. Nothing in this file names a provider.
 *
 * ─── WHAT IS IN THESE BUCKETS ───────────────────────────────────────────────────
 *
 * Call recordings, which are the rawest patient data the platform holds, and database
 * dumps, which contain all of it. So:
 *
 *  - NOTHING IS EVER PUBLIC. There is no ACL argument anywhere in this file, which means
 *    every object is created private, and a bucket that allows public reads is a
 *    misconfiguration this code cannot detect. The runbook covers it.
 *  - A RECORDING IS SERVED AS A PRESIGNED URL AND NEVER PROXIED (D-007). The API buffers
 *    responses until the transaction commits, so it cannot stream a file, and streaming
 *    patient audio through the application would put it in every log and metric on the
 *    path.
 *  - A PRESIGNED URL IS A BEARER CREDENTIAL. Anyone holding the link can play the audio
 *    until it expires, which is why the lifetime is five minutes by default and an hour
 *    at most, and why neither the URL nor its signature is ever logged.
 *  - KEYS CARRY IDS, NEVER NAMES. `recordings/<organisationId>/<callId>.mp3`, never a
 *    patient's name or number: a key appears in provider logs, in a bucket listing and in
 *    a billing export, none of which are under this product's control.
 */

export type StorageClient = {
  readonly put: (input: {
    readonly bucket: string;
    readonly key: string;
    readonly body: Uint8Array | string;
    readonly contentType: string;
  }) => Promise<void>;
  readonly presignGet: (input: {
    readonly bucket: string;
    readonly key: string;
    readonly expiresInSeconds?: number;
  }) => Promise<string>;
  readonly list: (input: {
    readonly bucket: string;
    readonly prefix: string;
    /**
     * Keys per request. Only the continuation loop depends on it, so it exists mainly so a
     * test can force more than one page without creating a thousand objects. A retention
     * sweep may also want smaller pages to keep its memory flat.
     */
    readonly pageSize?: number;
  }) => Promise<readonly { readonly key: string; readonly lastModified: Date | undefined }[]>;
  readonly remove: (input: { readonly bucket: string; readonly key: string }) => Promise<void>;
};

/**
 * Builds the SDK client from configuration.
 *
 * `endpoint` is omitted entirely when empty, rather than passed as an empty string: the
 * SDK derives the AWS endpoint from the region, and handing it `''` makes it try to parse
 * one.
 *
 * Credentials are passed explicitly rather than left to the provider chain. The chain
 * would otherwise reach for an instance profile or a shared credentials file, and on a
 * Lightsail box with no instance role that is a slow failure with a confusing message.
 */
export const createS3Client = (appConfig: Config = config): S3Client =>
  new S3Client({
    region: appConfig.AWS_REGION,
    forcePathStyle: appConfig.S3_FORCE_PATH_STYLE,
    ...(appConfig.S3_ENDPOINT === '' ? {} : { endpoint: appConfig.S3_ENDPOINT }),
    ...(appConfig.AWS_ACCESS_KEY_ID === ''
      ? {}
      : {
          credentials: {
            accessKeyId: appConfig.AWS_ACCESS_KEY_ID,
            secretAccessKey: appConfig.AWS_SECRET_ACCESS_KEY,
          },
        }),
  });

/**
 * The storage surface the application uses, over an injectable client.
 *
 * Injectable because the integration test drives it against a real S3-compatible server in
 * a container, and because the voice work will want to drive it against a stub.
 */
export const createObjectStorage = (
  client: S3Client = createS3Client(),
  appConfig: Config = config,
): StorageClient => ({
  put: async ({ bucket, key, body, contentType }) => {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    // The key, never the body and never a URL. A key is an id path by construction.
    logger.info({ bucket, key }, 'object stored');
  },

  presignGet: async ({ bucket, key, expiresInSeconds }) => {
    const expiresIn = Math.min(
      expiresInSeconds ?? appConfig.PRESIGNED_URL_TTL_SECONDS,
      appConfig.PRESIGNED_URL_TTL_SECONDS,
    );

    /**
     * The URL is returned and NOT logged, at any level.
     *
     * It carries a signature that grants read access to patient audio for as long as it
     * lives, so a log line holding one is a log line holding the recording.
     */
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn,
    });
  },

  list: async ({ bucket, prefix, pageSize }) => {
    const keys: { key: string; lastModified: Date | undefined }[] = [];
    let continuationToken: string | undefined;

    /**
     * Paginated, because a listing is capped at 1000 keys per call and a backups bucket
     * passes that in under three years. A loop that ignored the token would silently
     * stop deleting anything older than the first page.
     */
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ...(pageSize === undefined ? {} : { MaxKeys: pageSize }),
          ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken }),
        }),
      );

      for (const object of page.Contents ?? []) {
        if (object.Key !== undefined) {
          keys.push({ key: object.Key, lastModified: object.LastModified });
        }
      }

      continuationToken = page.IsTruncated === true ? page.NextContinuationToken : undefined;
    } while (continuationToken !== undefined);

    return keys;
  },

  remove: async ({ bucket, key }) => {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    logger.info({ bucket, key }, 'object removed');
  },
});

/**
 * The key a call's recording is stored under.
 *
 * Organisation first, so a clinic's recordings are one prefix: that is what makes a
 * per-clinic retention sweep and a per-clinic deletion on offboarding possible without a
 * database query.
 */
export const recordingKey = (
  organisationId: string,
  callId: string,
  /**
   * `wav`, because that is what the provider sends.
   *
   * It was `mp3` when this helper was written, before anybody had read the contract.
   * `docs/sarvam-contract.md` section 5 is explicit: the recording endpoint answers
   * `audio/wav` as a binary stream. A key whose extension disagrees with its bytes is the
   * kind of thing that works until a browser refuses to play it or a support engineer
   * downloads a file their player will not open. The parameter exists because the extension
   * is a property of what we fetched, not of this function.
   */
  extension: 'wav' | 'mp3' = 'wav',
): string => `recordings/${organisationId}/${callId}.${extension}`;

/**
 * The key a nightly dump is stored under.
 *
 * `YYYY/MM/DD` as the prefix rather than a flat date, so a listing can be narrowed to a
 * month and a lifecycle rule can be written per year without parsing file names.
 */
export const backupKey = (takenAt: Date): string => {
  const year = takenAt.getUTCFullYear();
  const month = String(takenAt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(takenAt.getUTCDate()).padStart(2, '0');
  const stamp = takenAt.toISOString().replace(/[:.]/g, '-');

  return `postgres/${year}/${month}/${day}/clinicai-${stamp}.sql.gz`;
};
