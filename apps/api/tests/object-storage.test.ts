import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { CreateBucketCommand } from '@aws-sdk/client-s3';
import {
  createObjectStorage,
  createS3Client,
  type StorageClient,
} from '../src/storage/object-storage.js';
import { makeTestConfig } from '../src/test-support/config.js';

/**
 * Object storage against a REAL S3-compatible server on a custom, path-style endpoint.
 *
 * ─── WHY THIS EXISTS WHEN THE UNIT TESTS ALREADY CHECK THE CONFIGURATION ────────
 *
 * The unit tests assert what the SDK was told. This asserts that the thing actually works
 * against a server that is not AWS, which is the claim D-018 rests on: upload, download
 * through a presigned URL, list, delete, and a refusal without credentials.
 *
 * SeaweedFS stands in for Cloudflare R2. It is not R2, and that limitation is stated
 * rather than glossed: what it shares with R2, and what this test therefore proves, is the
 * combination that breaks naive S3 code, which is a custom endpoint with path-style
 * addressing and SigV4 presigning against a host that is not `*.amazonaws.com`. What it
 * cannot prove is R2's own quirks, and the runbook carries a short manual check to run once
 * against the real bucket with real credentials.
 *
 * THE PRESIGNED URL IS FETCHED WITH PLAIN `fetch`, deliberately. A signed URL that only
 * works through the SDK is not a signed URL a browser can use, and a browser is the entire
 * point: D-007 forbids proxying recordings through the API.
 */

const ACCESS_KEY = 'clinicai-integration-access-key';
const SECRET_KEY = 'clinicai-integration-secret-key';
const BUCKET = 'clinicai-recordings-test';

/** The identity file SeaweedFS needs. One identity, credentials required, no anonymous. */
const IDENTITIES = JSON.stringify({
  identities: [
    {
      name: 'clinicai-integration',
      credentials: [{ accessKey: ACCESS_KEY, secretKey: SECRET_KEY }],
      actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'],
    },
  ],
});

let container: StartedTestContainer;
let storage: StorageClient;
let endpoint: string;

beforeAll(async () => {
  container = await new GenericContainer('chrislusf/seaweedfs:3.97')
    .withCopyContentToContainer([{ content: IDENTITIES, target: '/etc/s3-identities.json' }])
    .withCommand([
      'server',
      '-dir=/data',
      '-ip=0.0.0.0',
      '-master.volumeSizeLimitMB=64',
      '-s3',
      '-s3.port=8333',
      '-s3.config=/etc/s3-identities.json',
    ])
    .withExposedPorts(8333)
    // Any HTTP response means the gateway is up: an unsigned request is refused, which is
    // itself the behaviour the local setup relies on.
    .withWaitStrategy(Wait.forHttp('/', 8333).forStatusCodeMatching(() => true))
    .withStartupTimeout(120_000)
    .start();

  endpoint = `http://${container.getHost()}:${String(container.getMappedPort(8333))}`;

  const appConfig = makeTestConfig({
    S3_ENDPOINT: endpoint,
    AWS_REGION: 'auto',
    S3_FORCE_PATH_STYLE: true,
    AWS_ACCESS_KEY_ID: ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY: SECRET_KEY,
    RECORDINGS_BUCKET: BUCKET,
    PRESIGNED_URL_TTL_SECONDS: 300,
  });

  const client = createS3Client(appConfig);
  await client.send(new CreateBucketCommand({ Bucket: BUCKET }));

  storage = createObjectStorage(client, appConfig);
}, 180_000);

afterAll(async () => {
  await container.stop();
});

describe('object storage against a custom S3-compatible endpoint', () => {
  it('stores an object and serves it back through a presigned URL a browser can fetch', async () => {
    const key = 'recordings/org-test/call-1.mp3';
    const body = 'synthetic-audio-bytes';

    await storage.put({ bucket: BUCKET, key, body, contentType: 'audio/mpeg' });

    const url = await storage.presignGet({ bucket: BUCKET, key });

    // Path-style, against a host that is not AWS: `endpoint/bucket/key`.
    expect(url.startsWith(`${endpoint}/${BUCKET}/${key}`)).toBe(true);
    expect(url).toContain('X-Amz-Signature=');
    expect(url).toContain('X-Amz-Expires=300');

    const response = await fetch(url);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
  }, 120_000);

  it('refuses the same object without the signature, so nothing is public', async () => {
    const key = 'recordings/org-test/call-1.mp3';

    const response = await fetch(`${endpoint}/${BUCKET}/${key}`);

    // The bucket holds patient audio. An unsigned read must not succeed, and this is the
    // assertion that would fail if a provider or a bucket policy ever allowed public reads.
    expect(response.status).toBeGreaterThanOrEqual(400);
  }, 120_000);

  it('caps the signed lifetime at the configured maximum, however long the caller asks for', async () => {
    const url = await storage.presignGet({
      bucket: BUCKET,
      key: 'recordings/org-test/call-1.mp3',
      expiresInSeconds: 86_400,
    });

    // A day was requested and five minutes was issued: a recording URL is a bearer
    // credential for patient audio, so the configured ceiling is the authority.
    expect(url).toContain('X-Amz-Expires=300');
  }, 120_000);

  it('lists by prefix across more than one page', async () => {
    /**
     * THE PAGE SIZE IS FORCED TO TWO, so three objects take two requests and the
     * continuation token is genuinely followed.
     *
     * A listing returns at most 1000 keys by default, and the retention sweep deletes what
     * the listing returns, so a loop that ignored the token would silently stop deleting
     * anything after the first page: backups older than about three years would accumulate
     * for ever and nothing would say so. Creating 1001 objects would prove the same thing
     * slowly.
     */
    for (const index of [1, 2, 3]) {
      await storage.put({
        bucket: BUCKET,
        key: `postgres/2026/11/0${String(index)}/dump.sql.gz`,
        body: `dump-${String(index)}`,
        contentType: 'application/gzip',
      });
    }

    const listed = await storage.list({
      bucket: BUCKET,
      prefix: 'postgres/2026/11/',
      pageSize: 2,
    });

    expect(listed.map((object) => object.key).toSorted()).toEqual([
      'postgres/2026/11/01/dump.sql.gz',
      'postgres/2026/11/02/dump.sql.gz',
      'postgres/2026/11/03/dump.sql.gz',
    ]);
    expect(listed.every((object) => object.lastModified instanceof Date)).toBe(true);
  }, 120_000);

  it('does not list a prefix it was not asked about', async () => {
    const listed = await storage.list({ bucket: BUCKET, prefix: 'recordings/' });

    expect(listed.map((object) => object.key)).toEqual(['recordings/org-test/call-1.mp3']);
  }, 120_000);

  it('removes an object, after which the presigned URL answers not-found', async () => {
    const key = 'postgres/2026/11/01/dump.sql.gz';

    await storage.remove({ bucket: BUCKET, key });

    const response = await fetch(await storage.presignGet({ bucket: BUCKET, key }));

    // 404, not 403: the signature is still valid, so this is the object being gone rather
    // than the credential being wrong, which is what a retention sweep should leave behind.
    expect(response.status).toBe(404);
  }, 120_000);
});
