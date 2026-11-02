/**
 * Session transport names that both sides of the wire have to agree on.
 *
 * WHY THIS FILE EXISTS. The CSRF header name was declared twice, once in
 * `apps/api/src/common/csrf.ts` and once in `packages/api-client/src/client.ts`, with
 * nothing reconciling the two. The API suite imported the API's constant and the client
 * suite had its own literal, so neither could observe a disagreement. Renaming one of
 * them left 665 tests green while every refresh and every logout from both dashboards
 * answered 403, which signs every user out at the first boot refresh and is only visible
 * to the browser suite that is deliberately outside `pnpm check`. Review finding I1.
 *
 * The name is a decision (docs/DECISIONS.md D-011), so a rename is something somebody may
 * legitimately want to do. Declaring it here means a rename moves both sides at once and
 * cannot be half-applied.
 *
 * LOWER CASE, AND THAT IS NOT CARELESSNESS. HTTP header names are case-insensitive, Node
 * lower-cases every incoming name before it reaches `req.headers`, and the API compares
 * against this value directly. Sending it exactly as written keeps the two sides spelling
 * one string rather than two that happen to fold together.
 */

/**
 * The header a cookie-bearing request must carry to prove it came from one of our pages.
 *
 * Any value is accepted: its PRESENCE is the signal. A cross-site HTML form cannot set a
 * custom header at all, and a cross-site `fetch` that sets one triggers a CORS preflight
 * the API's origin allow-list refuses. Sent on `POST /api/v1/auth/refresh` and
 * `POST /api/v1/auth/logout`, which are the only two routes that authenticate from the
 * refresh cookie. See docs/architecture/adr-0001-session-and-csrf.md.
 */
export const CSRF_HEADER_NAME = 'x-clinicai-csrf';
