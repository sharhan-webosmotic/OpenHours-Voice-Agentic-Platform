import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { ForbiddenError } from './errors.js';

/**
 * CSRF protection for the two routes that carry an ambient credential.
 *
 * WHY ONLY TWO ROUTES. Cross-site request forgery needs a credential the browser attaches
 * by itself. Exactly one exists in this API: the refresh cookie, scoped to
 * `/api/v1/auth`. Every other route authenticates from an `Authorization` header, which a
 * cross-site page cannot set on the victim's behalf, so there is nothing to forge. Adding
 * a token to those routes would be ceremony, not protection.
 *
 * WHAT `SameSite=Strict` ALREADY DOES, AND WHAT IT DOES NOT. The cookie is
 * `SameSite=Strict` (docs/DECISIONS.md D-002), so a browser does not attach it to a
 * request from another site at all. That covers the ordinary attacker on an unrelated
 * domain. It does NOT cover a sibling subdomain: SameSite is evaluated on the registrable
 * domain, and `app`, `admin` and `api` are subdomains of one domain, which is exactly why
 * `Strict` was free. The same property means a compromised or hostile host under that
 * domain is same-site and WOULD be sent the cookie. That residual case is what the origin
 * assertion below is for, and it is the layer doing the real work here.
 *
 * WHY NO DOUBLE-SUBMIT COOKIE. The usual second mechanism is a JavaScript-readable cookie
 * echoed back in a header. It is not used, for two reasons. It adds a cookie that scripts
 * can read, cutting against D-002's reasoning, and against the sibling-subdomain case it
 * buys nothing: a cookie scoped to the registrable domain is readable by that sibling, and
 * one scoped host-only to the API is not readable by the app that has to echo it.
 */

export const CSRF_HEADER = 'x-openhours-csrf';

/** Any value is accepted. The header's PRESENCE is the signal, not its contents. */
const hasCustomHeader = (req: Request): boolean => {
  const value = req.headers[CSRF_HEADER];
  return typeof value === 'string' && value.length > 0;
};

/**
 * Whether the browser's own account of where this request came from is acceptable.
 *
 * ABSENT HEADERS PASS, and that is deliberate rather than a gap. Both headers are set by
 * the browser and cannot be removed by page script, so a forged cross-site request made
 * through a browser carries at least one of them. A caller presenting neither is not a
 * browser, and a non-browser client holds no ambient cookie to abuse: it has to send a
 * credential explicitly, which is not forgery. Refusing on absence would instead break
 * every server-to-server and command-line caller for no gain.
 *
 * `Sec-Fetch-Site` is checked when present because it is the browser's direct statement
 * of the relationship and cannot be spoofed by page script. `Origin` is checked against
 * the same allow-list CORS uses, which is what catches a sibling subdomain that
 * `SameSite=Strict` would have let through.
 */
const hasAcceptableProvenance = (req: Request): boolean => {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'same-site') {
    return false;
  }

  const origin = req.headers.origin;
  if (typeof origin === 'string' && !config.CORS_ALLOWED_ORIGINS.includes(origin)) {
    return false;
  }

  return true;
};

/**
 * Refuses a request that carries the refresh cookie without proving it came from one of
 * our own pages.
 *
 * The client detail says what to do and names neither header, because an attacker reading
 * it would otherwise be told exactly what to add. The internal message, which is logged
 * and never sent, says which check failed.
 */
export const requireSameSiteRequest = (req: Request, _res: Response, next: NextFunction): void => {
  if (!hasCustomHeader(req)) {
    next(
      new ForbiddenError(
        `missing ${CSRF_HEADER} header`,
        'This request could not be verified. Please sign in again.',
      ),
    );
    return;
  }

  if (!hasAcceptableProvenance(req)) {
    next(
      new ForbiddenError(
        'request provenance rejected',
        'This request could not be verified. Please sign in again.',
      ),
    );
    return;
  }

  next();
};
