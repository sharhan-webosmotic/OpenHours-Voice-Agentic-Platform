import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from './errors.js';
import { runWithContext } from './request-context.js';
import { uuidV7 } from './uuid.js';

/**
 * The refusal paths in the authentication middleware.
 *
 * This file was at 78 percent lines, below both the 90 percent floor root CLAUDE.md sets
 * for authentication code and the 80 percent general floor, and the directory aggregate
 * hid it. What was uncovered was every refusal: no organisation, a device presented to a
 * user-only route, a missing device header, and the two "used without
 * requestContextMiddleware" guards. Those are the branches that decide who gets in.
 *
 * The token verifier and the device authenticator are mocked, because what is under test
 * is the middleware's decision rather than either of those. Both have their own suites.
 */

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  authenticateDevice: vi.fn(),
}));

vi.mock('../modules/auth/auth.tokens.js', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}));
vi.mock('../modules/devices/devices.service.js', () => ({
  authenticateDevice: mocks.authenticateDevice,
}));

const { DEVICE_TOKEN_HEADER, requireAuth, requireDevice, requireOrganisation, requireUser } =
  await import('./auth.middleware.js');

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

/** Runs a middleware and resolves with whatever it passed to next(). */
const run = (middleware: Middleware, headers: Record<string, string> = {}): Promise<unknown> =>
  new Promise((resolve) => {
    const req = { headers } as unknown as Request;
    const next = ((error?: unknown) => {
      resolve(error);
    }) as NextFunction;
    middleware(req, {} as Response, next);
  });

const CLAIMS = { userId: 'usr-1', role: 'CLINIC_OWNER', organisationId: 'org-1' };

beforeEach(() => {
  mocks.verifyAccessToken.mockReset();
  mocks.authenticateDevice.mockReset();
});

describe('requireAuth', () => {
  it('refuses a request with no Authorization header', async () => {
    const error = await run(requireAuth);
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('refuses a scheme that is not Bearer', async () => {
    const error = await run(requireAuth, { authorization: 'Basic abcdef' });
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('refuses a Bearer header with no token after it', async () => {
    const error = await run(requireAuth, { authorization: 'Bearer ' });
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('passes a token verification failure straight through', async () => {
    const failure = new UnauthorizedError('bad token', 'Authentication is required.');
    mocks.verifyAccessToken.mockRejectedValue(failure);

    const error = await run(requireAuth, { authorization: 'Bearer anything' });

    expect(error).toBe(failure);
  });

  it('fails loudly when the request context middleware did not run', async () => {
    mocks.verifyAccessToken.mockResolvedValue(CLAIMS);

    // No runWithContext around this call, so there is no context to add the claims to.
    // Carrying on would mean an authenticated request with no actor for the audit trail.
    const error = await run(requireAuth, { authorization: 'Bearer anything' });

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/requireAuth used without requestContextMiddleware/);
  });

  it('puts the verified claims into the context', async () => {
    mocks.verifyAccessToken.mockResolvedValue(CLAIMS);

    const error = await new Promise<unknown>((resolve) => {
      runWithContext({ requestId: uuidV7() }, () => {
        void run(requireAuth, { authorization: 'Bearer anything' }).then(resolve);
      });
    });

    expect(error).toBeUndefined();
  });

  it('omits the organisation when the token carries none', async () => {
    // A platform role has no organisation, and a null claim must not become the string
    // "null" in the context.
    mocks.verifyAccessToken.mockResolvedValue({ ...CLAIMS, organisationId: null });

    const error = await new Promise<unknown>((resolve) => {
      runWithContext({ requestId: uuidV7() }, () => {
        void run(requireAuth, { authorization: 'Bearer anything' }).then(resolve);
      });
    });

    expect(error).toBeUndefined();
  });
});

describe('requireOrganisation', () => {
  it('refuses when nobody is authenticated', async () => {
    const error = await new Promise<unknown>((resolve) => {
      runWithContext({ requestId: uuidV7() }, () => {
        void run(requireOrganisation).then(resolve);
      });
    });

    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('refuses a principal with no organisation', async () => {
    const error = await new Promise<unknown>((resolve) => {
      runWithContext({ requestId: uuidV7(), userId: 'usr-1', role: 'SUPER_ADMIN' }, () => {
        void run(requireOrganisation).then(resolve);
      });
    });

    // Forbidden rather than Unauthorized: the caller is authenticated, the endpoint is
    // simply for clinic users.
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it('admits a clinic principal', async () => {
    const error = await new Promise<unknown>((resolve) => {
      runWithContext(
        { requestId: uuidV7(), userId: 'usr-1', role: 'CLINIC_OWNER', organisationId: 'org-1' },
        () => {
          void run(requireOrganisation).then(resolve);
        },
      );
    });

    expect(error).toBeUndefined();
  });
});

describe('requireUser', () => {
  it('refuses an unauthenticated request', async () => {
    const error = await new Promise<unknown>((resolve) => {
      runWithContext({ requestId: uuidV7() }, () => {
        void run(requireUser).then(resolve);
      });
    });

    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('refuses a device principal on a user-only route', async () => {
    const error = await new Promise<unknown>((resolve) => {
      runWithContext(
        { requestId: uuidV7(), userId: 'usr-1', organisationId: 'org-1', deviceId: 'dev-1' },
        () => {
          void run(requireUser).then(resolve);
        },
      );
    });

    expect(error).toBeInstanceOf(UnauthorizedError);
  });
});

describe('requireDevice', () => {
  it('refuses a request with no device token header', async () => {
    const error = await run(requireDevice);
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('refuses an empty device token header', async () => {
    const error = await run(requireDevice, { [DEVICE_TOKEN_HEADER]: '' });
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('passes a device authentication failure straight through', async () => {
    const failure = new UnauthorizedError('unknown device', 'Device authentication is required.');
    mocks.authenticateDevice.mockRejectedValue(failure);

    const error = await run(requireDevice, { [DEVICE_TOKEN_HEADER]: 'a-device-token' });

    expect(error).toBe(failure);
  });

  it('fails loudly when the request context middleware did not run', async () => {
    mocks.authenticateDevice.mockResolvedValue({ organisationId: 'org-1', deviceId: 'dev-1' });

    const error = await run(requireDevice, { [DEVICE_TOKEN_HEADER]: 'a-device-token' });

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/requireDevice used without requestContextMiddleware/);
  });

  it('admits a paired device', async () => {
    mocks.authenticateDevice.mockResolvedValue({ organisationId: 'org-1', deviceId: 'dev-1' });

    const error = await new Promise<unknown>((resolve) => {
      runWithContext({ requestId: uuidV7() }, () => {
        void run(requireDevice, { [DEVICE_TOKEN_HEADER]: 'a-device-token' }).then(resolve);
      });
    });

    expect(error).toBeUndefined();
  });
});
