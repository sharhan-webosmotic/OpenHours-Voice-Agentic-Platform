import { describe, expect, it } from 'vitest';
import { redactRequestUrl, redactUrl } from './url-redaction.js';

describe('redactUrl', () => {
  const SECRET = 'xJNpR4AHbaUl9XirCjszQvqlmUBKCAuihVcGcTXzNlg';

  it('replaces the webhook secret segment', () => {
    expect(redactUrl(`/webhooks/sarvam/${SECRET}`)).toBe('/webhooks/sarvam/[REDACTED]');
  });

  it('keeps what follows the segment, so the line still says what was asked', () => {
    expect(redactUrl(`/webhooks/sarvam/${SECRET}?retry=1`)).toBe(
      '/webhooks/sarvam/[REDACTED]?retry=1',
    );
    expect(redactUrl(`/webhooks/sarvam/${SECRET}/extra`)).toBe('/webhooks/sarvam/[REDACTED]/extra');
  });

  it('leaves every other path alone', () => {
    expect(redactUrl('/voice/tools/book')).toBe('/voice/tools/book');
    expect(redactUrl('/api/v1/patients?search=x')).toBe('/api/v1/patients?search=x');
  });
});

describe('redactRequestUrl', () => {
  it('rewrites the url and nothing else', () => {
    const serialized = { id: 'r1', method: 'POST', url: '/webhooks/sarvam/abcdefghijklmnopqrstu' };

    expect(redactRequestUrl(serialized)).toEqual({
      id: 'r1',
      method: 'POST',
      url: '/webhooks/sarvam/[REDACTED]',
    });
  });
});
