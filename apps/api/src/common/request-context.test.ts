import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { createApp } from '../app.js';
import { makeTestConfig } from '../test-support/config.js';
import { buildLoggerOptions } from './logger.js';
import { getContext, runWithContext, withIdentity } from './request-context.js';
import { requestContextMiddleware } from './request-context.middleware.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VALID_UUID = '0189d7f1-9b3a-4c2e-8f1a-2b3c4d5e6f70';

const buildApp = () => createApp({ readiness: () => Promise.resolve(), config: makeTestConfig() });

describe('request id assignment', () => {
  it('generates a UUID when no header is sent', async () => {
    const response = await request(buildApp()).get('/health');

    expect(response.headers['x-request-id']).toMatch(UUID_RE);
  });

  it('accepts and echoes a valid inbound UUID', async () => {
    const response = await request(buildApp()).get('/health').set('X-Request-Id', VALID_UUID);

    expect(response.headers['x-request-id']).toBe(VALID_UUID);
  });

  it('lower-cases an upper-case inbound UUID so logs correlate', async () => {
    const response = await request(buildApp())
      .get('/health')
      .set('X-Request-Id', VALID_UUID.toUpperCase());

    expect(response.headers['x-request-id']).toBe(VALID_UUID);
  });
});

describe('request id rejects hostile inbound headers', () => {
  // The request id is echoed into a response header and into every log line, so an
  // unchecked value allows header injection, log forging and unbounded growth.
  const transportable: Record<string, string> = {
    'path traversal': '../../etc/passwd',
    'html/script': '<script>alert(1)</script>',
    'sql-ish': "1' OR '1'='1",
    'very long': 'a'.repeat(10_000),
    empty: '',
    'almost a uuid': '0189d7f1-9b3a-4c2e-8f1a-2b3c4d5e6f7',
    'uuid with suffix': `${VALID_UUID}; drop table users`,
    'nil uuid (invalid version)': '00000000-0000-0000-0000-000000000000',
    'uuid with leading space': ` ${VALID_UUID}`,
  };

  for (const [label, value] of Object.entries(transportable)) {
    it(`replaces a ${label} request id with a generated UUID`, async () => {
      const response = await request(buildApp()).get('/health').set('X-Request-Id', value);

      const assigned = response.headers['x-request-id'];
      expect(assigned).toMatch(UUID_RE);
      expect(assigned).not.toBe(value);
      expect(response.status).toBe(200);
    });
  }

  /**
   * CR/LF cannot be sent through Node's HTTP client, which rejects the header before it
   * reaches the wire. That client-side guard is not a defence: an attacker writing to a
   * raw socket has no such check. The middleware is therefore driven directly, with the
   * forged header already in place, which is what the server would actually see.
   */
  const injected: Record<string, string> = {
    'crlf header injection': 'abc\r\nX-Admin: true',
    'newline log forging': 'abc\ninjected-log-line',
    'lone carriage return': 'abc\rX-Admin: true',
  };

  for (const [label, value] of Object.entries(injected)) {
    it(`replaces a ${label} request id with a generated UUID`, () => {
      const setHeader = vi.fn();
      const req = { headers: { 'x-request-id': value } } as unknown as Request;
      const res = { setHeader } as unknown as Response;
      let observed: string | undefined;

      requestContextMiddleware(req, res, () => {
        observed = getContext()?.requestId;
      });

      expect(observed).toMatch(UUID_RE);
      expect(observed).not.toBe(value);
      expect(observed).not.toContain('\n');
      expect(observed).not.toContain('\r');
      expect(setHeader).toHaveBeenCalledWith('x-request-id', observed);
    });
  }

  it('ignores a non-string header value', () => {
    const setHeader = vi.fn();
    // Node parses a repeated header into an array; an array is not a safe id.
    const req = { headers: { 'x-request-id': [VALID_UUID, 'other'] } } as unknown as Request;
    const res = { setHeader } as unknown as Response;
    let observed: string | undefined;

    requestContextMiddleware(req, res, () => {
      observed = getContext()?.requestId;
    });

    expect(observed).toMatch(UUID_RE);
    expect(observed).not.toBe(VALID_UUID);
  });
});

describe('client headers cannot set tenancy or role', () => {
  // Root CLAUDE.md rule 2: organisationId and role come only from a verified token or
  // a resolved mapping, never from anything the client controls.
  it('ignores X-Organisation-Id and X-Role', async () => {
    const app = express();
    let captured: ReturnType<typeof getContext>;

    app.use(requestContextMiddleware);
    app.get('/probe', (_req, res) => {
      captured = getContext();
      res.status(200).json({ ok: true });
    });

    await request(app)
      .get('/probe')
      .set('X-Organisation-Id', 'org_attacker')
      .set('X-Role', 'PLATFORM_ADMIN')
      .set('X-User-Id', 'usr_attacker');

    expect(captured?.organisationId).toBeUndefined();
    expect(captured?.role).toBeUndefined();
    expect(captured?.userId).toBeUndefined();
    expect(captured?.requestId).toMatch(UUID_RE);
  });
});

describe('request id reaches the log line', () => {
  it('logs the same id that is returned in the response header', async () => {
    const lines: string[] = [];
    const logger = pino(
      { ...buildLoggerOptions(), level: 'info' },
      { write: (line: string) => lines.push(line) },
    );

    const app = express();
    app.use(requestContextMiddleware);
    app.use(
      pinoHttp({
        logger,
        genReqId: () => getContext()?.requestId ?? 'unknown',
        serializers: { err: (value: unknown) => value },
      }),
    );
    app.get('/probe', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/probe').set('X-Request-Id', VALID_UUID);

    const headerId = response.headers['x-request-id'];
    expect(headerId).toBe(VALID_UUID);

    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      // Bound by the mixin on every line...
      expect(entry.requestId).toBe(headerId);
      // ...and used as pino-http's own request id, so both agree.
      expect((entry.req as { id?: unknown } | undefined)?.id ?? headerId).toBe(headerId);
    }
  });
});

describe('context store', () => {
  it('returns undefined outside a request', () => {
    expect(getContext()).toBeUndefined();
  });

  it('survives async boundaries', async () => {
    await runWithContext({ requestId: VALID_UUID }, async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(getContext()?.requestId).toBe(VALID_UUID);
    });
  });

  it('keeps concurrent requests isolated', async () => {
    const ids = ['0189d7f1-9b3a-4c2e-8f1a-000000000001', '0189d7f1-9b3a-4c2e-8f1a-000000000002'];

    const observed = await Promise.all(
      ids.map((id) =>
        runWithContext({ requestId: id }, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return getContext()?.requestId;
        }),
      ),
    );

    expect(observed).toEqual(ids);
  });

  it('withIdentity adds identity without mutating the outer context', () => {
    runWithContext({ requestId: VALID_UUID }, () => {
      withIdentity({ organisationId: 'org_1', role: 'CLINIC_OWNER' }, () => {
        expect(getContext()).toMatchObject({
          requestId: VALID_UUID,
          organisationId: 'org_1',
          role: 'CLINIC_OWNER',
        });
      });
      // The outer context is unchanged: identity cannot leak sideways.
      expect(getContext()?.organisationId).toBeUndefined();
    });
  });

  it('withIdentity refuses to run outside a request', () => {
    expect(() => withIdentity({ userId: 'usr_1' }, () => undefined)).toThrow(
      /outside a request context/,
    );
  });
});
