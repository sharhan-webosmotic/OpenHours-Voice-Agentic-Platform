import { describe, expect, it } from 'vitest';
import { backupKey, createS3Client, recordingKey } from './object-storage.js';
import { makeTestConfig } from '../test-support/config.js';

/**
 * The configuration mapping, which is the part of this module that decides WHICH provider
 * it is talking to.
 *
 * Driven against the client's resolved configuration rather than by sending anything: these
 * assertions are about what the SDK was told, and sending is what the integration test in
 * `tests/object-storage.test.ts` does against a real server.
 */

const resolve = async (client: ReturnType<typeof createS3Client>) => ({
  endpoint: await client.config
    .endpoint?.()
    .then((value) => (value === undefined ? undefined : `${value.protocol}//${value.hostname}`)),
  region: await client.config.region(),
  forcePathStyle: client.config.forcePathStyle,
});

describe('createS3Client', () => {
  it('uses a custom endpoint with path-style addressing, which is what R2 needs', async () => {
    const client = createS3Client(
      makeTestConfig({
        S3_ENDPOINT: 'https://account123.r2.cloudflarestorage.com',
        AWS_REGION: 'auto',
        S3_FORCE_PATH_STYLE: true,
      }),
    );

    expect(await resolve(client)).toMatchObject({
      endpoint: 'https://account123.r2.cloudflarestorage.com',
      region: 'auto',
      forcePathStyle: true,
    });
  });

  it('omits the endpoint entirely when none is configured, so the SDK derives the AWS one', async () => {
    /**
     * Omitted, not empty. Passing `endpoint: ''` makes the SDK try to parse it as a URL,
     * which fails at the first request rather than at construction, a long way from the
     * cause.
     */
    const client = createS3Client(
      makeTestConfig({ S3_ENDPOINT: '', AWS_REGION: 'ap-south-1', S3_FORCE_PATH_STYLE: false }),
    );

    const resolved = await resolve(client);

    expect(resolved.region).toBe('ap-south-1');
    expect(resolved.forcePathStyle).toBe(false);
    /**
     * `undefined`, not a string: with no endpoint configured the SDK leaves the field unset
     * and its endpoint resolver derives `s3.<region>.amazonaws.com` per request. That is the
     * behaviour being relied on, and asserting the absence is what catches a future change
     * that starts passing an empty string instead.
     */
    expect(resolved.endpoint).toBeUndefined();
  });

  it('passes credentials explicitly rather than leaving them to the provider chain', async () => {
    const client = createS3Client(
      makeTestConfig({ AWS_ACCESS_KEY_ID: 'key-id', AWS_SECRET_ACCESS_KEY: 'secret' }),
    );

    // The chain would otherwise reach for an instance profile, which a Lightsail box does
    // not have: a slow failure with a message about metadata rather than about credentials.
    expect(await client.config.credentials()).toMatchObject({ accessKeyId: 'key-id' });
  });
});

describe('the keys', () => {
  it('puts the organisation first in a recording key, so a clinic is one prefix', () => {
    // `wav`, which is what docs/sarvam-contract.md section 5 says the provider sends.
    expect(recordingKey('org-1', 'call-9')).toBe('recordings/org-1/call-9.wav');
  });

  it('builds a dated, sortable backup key', () => {
    expect(backupKey(new Date('2026-11-02T18:30:00.000Z'))).toBe(
      'postgres/2026/11/02/clinicai-2026-11-02T18-30-00-000Z.sql.gz',
    );
  });

  it('pads single-digit months and days, so keys sort lexicographically', () => {
    // Without padding, `postgres/2026/9/` sorts after `postgres/2026/10/` and a retention
    // sweep that walks keys in order deletes the wrong ones.
    expect(backupKey(new Date('2026-09-05T00:00:00.000Z'))).toContain('postgres/2026/09/05/');
  });

  it('contains no patient identifier of any kind', () => {
    // A key reaches provider logs, bucket listings and billing exports, none of which this
    // product controls. Ids only, which this asserts structurally.
    expect(recordingKey('org-1', 'call-9')).toMatch(/^recordings\/[\w-]+\/[\w-]+\.wav$/);
  });
});
