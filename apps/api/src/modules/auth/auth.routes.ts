import {
  Router,
  type CookieOptions,
  type RequestHandler,
  type Request,
  type Response,
} from 'express';
import { config } from '../../config.js';
import { readCookie } from '../../common/cookies.js';
import { createRateLimiter } from '../../common/rate-limit.js';
import { UnauthorizedError } from '../../common/errors.js';
import { getContext } from '../../common/request-context.js';
import { validate, validatedData } from '../../common/validate.js';
import { registerRoute } from '../../common/route-registry.js';
import { requireAuth, requireUser } from '../../common/auth.middleware.js';
import { changePasswordBodySchema, loginBodySchema } from './auth.schemas.js';
import * as service from './auth.service.js';

/**
 * Auth routes.
 *
 * The refresh token travels only in an httpOnly cookie, so JavaScript in the browser
 * cannot read it even if a script is injected. The access token is returned in the body
 * and is expected to live in memory only.
 */

export const REFRESH_COOKIE = 'openhours_refresh';

const refreshCookieOptions = (expiresAt: Date): CookieOptions => ({
  httpOnly: true,
  secure: config.COOKIE_SECURE,
  // Lax, not Strict: the dashboard is a separate origin and a Strict cookie would not be
  // sent on a top-level navigation back into the app. Not None, which would let any site
  // trigger a refresh.
  sameSite: 'lax',
  // Scoped to the auth routes, so the cookie is not attached to every API call.
  path: '/api/v1/auth',
  expires: expiresAt,
});

/**
 * Two limiters on login: by IP to blunt a distributed sweep, and by email so one account
 * cannot be ground down from many addresses. Lockout handles the slow case; these handle
 * the fast one. Both are module singletons with an in-memory store, which is why
 * authRouter lets a test supply its own.
 */
const loginIpLimiter = createRateLimiter({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: config.AUTH_RATE_LIMIT_MAX_PER_IP,
});
const loginEmailLimiter = createRateLimiter({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: config.AUTH_RATE_LIMIT_MAX_PER_EMAIL,
  // Lower-cased so capitalisation cannot buy a fresh bucket; emails are citext anyway.
  keyGenerator: (req) => {
    const body = req.body as { email?: unknown } | undefined;
    return typeof body?.email === 'string' ? body.email.toLowerCase() : 'unknown';
  },
});
const refreshLimiter = createRateLimiter({
  windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: config.AUTH_RATE_LIMIT_MAX_PER_IP * 3,
});

/**
 * The API surface is static, so routes are registered once at import. Registering
 * inside authRouter() would throw on a second call, and the registry is right to refuse:
 * two registrations of one path would leave the generated OpenAPI describing only one.
 */
registerRoute({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Exchange credentials for an access token',
  body: loginBodySchema,
  phiSensitive: false,
});

registerRoute({
  method: 'post',
  path: '/api/v1/auth/refresh',
  summary: 'Rotate the refresh token and issue a new access token',
  phiSensitive: false,
});

registerRoute({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'Revoke the current session',
  phiSensitive: false,
});

registerRoute({
  method: 'post',
  path: '/api/v1/auth/change-password',
  summary: 'Change the signed-in user password',
  body: changePasswordBodySchema,
  permission: 'self:update',
  phiSensitive: false,
});

registerRoute({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'The signed-in principal',
  permission: 'self:read',
  phiSensitive: false,
});

export type AuthRouterOptions = {
  /** Overridable so a test can mount a deliberately low limit and assert the 429. */
  readonly ipLimiter?: RequestHandler;
  readonly emailLimiter?: RequestHandler;
};

export const authRouter = (options: AuthRouterOptions = {}): Router => {
  const router = Router();
  const ipLimiter = options.ipLimiter ?? loginIpLimiter;
  const emailLimiter = options.emailLimiter ?? loginEmailLimiter;

  router.post(
    '/login',
    ipLimiter,
    emailLimiter,
    validate({ body: loginBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, { email: string; password: string }>(req);
      const result = await service.login(body.email, body.password);

      res.cookie(
        REFRESH_COOKIE,
        result.refreshToken,
        refreshCookieOptions(result.refreshTokenExpiresAt),
      );
      res.status(200).json({
        accessToken: result.accessToken,
        mustChangePassword: result.mustChangePassword,
        user: result.user,
      });
    },
  );

  router.post('/refresh', refreshLimiter, async (req: Request, res: Response) => {
    const presented = readCookie(req.headers.cookie, REFRESH_COOKIE);

    if (presented === undefined) {
      throw new UnauthorizedError('no refresh cookie', 'Please sign in again.');
    }

    const result = await service.refresh(presented);

    res.cookie(
      REFRESH_COOKIE,
      result.refreshToken,
      refreshCookieOptions(result.refreshTokenExpiresAt),
    );
    res.status(200).json({
      accessToken: result.accessToken,
      mustChangePassword: result.mustChangePassword,
      user: result.user,
    });
  });

  router.post('/logout', async (req: Request, res: Response) => {
    await service.logout(readCookie(req.headers.cookie, REFRESH_COOKIE));
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    res.status(204).send();
  });

  router.post(
    '/change-password',
    requireAuth,
    requireUser,
    validate({ body: changePasswordBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<
        unknown,
        unknown,
        { currentPassword: string; newPassword: string }
      >(req);
      const userId = getContext()?.userId;

      if (userId === undefined) {
        throw new UnauthorizedError('not authenticated', 'Authentication is required.');
      }

      await service.changePassword(userId, body.currentPassword, body.newPassword);
      // Every session ended, so the client must sign in again.
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      res.status(204).send();
    },
  );

  router.get('/me', requireAuth, requireUser, async (_req: Request, res: Response) => {
    const userId = getContext()?.userId;

    if (userId === undefined) {
      throw new UnauthorizedError('not authenticated', 'Authentication is required.');
    }

    res.status(200).json(await service.currentUser(userId));
  });

  return router;
};
