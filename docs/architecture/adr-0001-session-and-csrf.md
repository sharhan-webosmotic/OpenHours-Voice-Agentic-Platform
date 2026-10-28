# ADR-0001: Session transport and CSRF protection

**Status:** accepted. **Date:** 2026-10-28. **Supersedes:** nothing.
**Relates to:** `docs/DECISIONS.md` D-002 (token storage), which this ADR builds on rather
than revisits.

## Context

The platform holds patient health data behind two browser applications, the clinic
dashboard and the internal admin console, which are subdomains of one registrable domain
alongside the API. D-002 settled where the tokens live: the refresh token in an `httpOnly`,
`Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth`, and the access token in a
JavaScript variable, never in `localStorage`, `sessionStorage`, IndexedDB or a
script-readable cookie.

That left two questions D-002 did not answer, and this ADR answers both.

First, cross-site request forgery. A cookie the browser attaches by itself is a credential
an attacker can use without ever reading it, which is the whole of CSRF. The repository had
no protection of any kind: there was no token, no origin check, no custom-header
requirement, and, contrary to an assumption carried into the sign-in feature's brief, no
half-finished mechanism waiting on the cookie decision. The word CSRF appeared nowhere in
the ticket history except one M7 security-audit line about response headers. The only thing
standing in an attacker's way was `SameSite=Strict`.

Second, which application a person signed in to. The clinic dashboard must refuse platform
roles and the admin console must refuse clinic roles, which needs the API to know which
front end asked.

## The CSRF decision

**A required custom request header plus an origin assertion, on
`POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout` only. No double-submit cookie.**

### Why only those two routes

Forgery needs a credential the browser sends unprompted. Exactly one exists in this API:
the refresh cookie. Every other route authenticates from an `Authorization` header, which a
cross-site page cannot set on the victim's behalf, so there is no ambient credential to
abuse and nothing to forge. Extending a token to those routes would be ceremony that reads
as protection, which is the failure mode the foundation review already found once in the
decorative `permission` field on route descriptors.

### Why `SameSite=Strict` is not sufficient on its own

This is the deciding argument, and it is the same property that made `Strict` free in
D-002. SameSite is evaluated on the **registrable domain**, not the origin. `app`, `admin`
and `api` are subdomains of one domain, so they are same-site, which is why `Strict` cost
nothing. The identical property means any other host under that domain is also same-site,
and a browser **will** attach the cookie to a request from it. So a hostile or compromised
sibling subdomain, a stale marketing host, a forgotten staging name, a subdomain takeover,
is precisely the case `SameSite=Strict` does not cover, and it is the realistic residual
risk once the obvious cross-origin attacker is handled.

The origin assertion is therefore the layer doing the real work, not a belt on top of a
working control.

### The two layers

1. **A required custom header, `X-OpenHours-Csrf`.** Any value is accepted: its presence is
   the signal. A cross-site HTML form cannot set a custom header at all, and a cross-site
   `fetch` that sets one triggers a CORS preflight, which the existing strict allow-list
   refuses. This is also the mechanism the project's own `tenant-security-phi` skill
   already named ("refresh endpoint only via cookie + custom header"), so this ADR records
   an existing intent rather than choosing something new.
2. **An origin assertion.** When `Origin` is present it must appear in
   `CORS_ALLOWED_ORIGINS`. When `Sec-Fetch-Site` is present it must be `same-origin` or
   `same-site`. This is what catches the sibling-subdomain case above.

**Absent headers pass, deliberately.** Both are set by the browser and cannot be removed by
page script, so a forged cross-site request made through a browser carries at least one of
them. A caller presenting neither is not a browser, and a non-browser client holds no
ambient cookie to abuse: it has to present a credential explicitly, which is not forgery.
Refusing on absence would break every server-to-server and command-line caller, and the
entire supertest suite, for no security gain.

### Options rejected

| Option                                                                                                 | Why not                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Double-submit cookie**: a script-readable cookie echoed in a header                                  | Two reasons. It adds a cookie that scripts can read, which cuts against D-002's reasoning that anything readable by JavaScript leaves with the first XSS. And against the case that actually matters it buys nothing: a cookie scoped to the registrable domain is readable by the hostile sibling, and one scoped host-only to the API is not readable by the dashboard that has to echo it. |
| **Synchroniser token tied to the refresh-token family**, returned in the login body and held in memory | Breaks on a cold page load. A new tab holds the cookie but no token, so its first call must be `/refresh`, which is the very route that would demand the token it does not yet have.                                                                                                                                                                                                          |
| **`SameSite=Lax` plus a token**                                                                        | `Lax` relaxes exactly the case this cookie never uses, a top-level navigation, and gives away protection for nothing. D-002 settled this.                                                                                                                                                                                                                                                     |
| **`SameSite=Strict` alone, no further control**                                                        | Leaves the sibling-subdomain case entirely uncovered, which is the one realistic residual risk.                                                                                                                                                                                                                                                                                               |

### Consequences accepted

- Both web applications must send the header on refresh and logout. `packages/api-client`
  owns that, so no feature code has to remember it.
- The header is added to the CORS `allowedHeaders` list, because the dashboard and the API
  are different **origins** even though they are same-**site**, so the preflight is real.
- Fourteen existing test call sites had to start sending the header. That is the correct
  direction: a test that still passed without it would mean the control was not enforced.
- Moving the dashboard to a different registrable domain remains a new decision, not an
  edit, exactly as D-002 says. It would force `SameSite=None`, at which point the origin
  assertion stops being defence in depth and becomes the primary control.

## The wrong-application decision

**Login accepts an optional `audience` of `clinic` or `admin`, validated by zod, and the
service refuses an incompatible role before any token is issued.**

This is **user experience and defence in depth, not a security boundary.** What actually
protects the admin surface is the permission matrix in `packages/shared`, enforced in the
service layer, plus `requireOrganisation` for clinic routes. That must not weaken because
this field exists, and no route may ever rely on `audience` having been sent as a reason to
skip a permission check.

It does not violate the root rule that organisation and role come only from the verified
token:
`audience` selects neither. It can only cause a refusal, so a client that lies about it
refuses itself and gains nothing. Refusing before a token is issued is the point: checking
in the front end alone would leave a valid refresh cookie set for a session the application
then rejects.

## Failure modes

| Hop                    | Slow                                                                   | Error                                                                  | Twice                                                                                                                      | Never returns                                                  |
| ---------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Browser to `/refresh`  | Access token may expire first; the client retries once, single-flight  | 401 means sign in again, 403 means the request could not be attributed | Rotation makes the second presentation a reuse, which revokes the family: correct, and the client must not retry a refresh | Client falls back to sign-in and keeps the intended route      |
| `/refresh` to database | Request-wide transaction holds, response buffered until commit (D-007) | Rejection is logged by user id and answered generically                | Idempotent: a rotation either committed or did not                                                                         | Connection timeout surfaces as a 503 from readiness, not a 500 |

The client detail on a CSRF refusal names neither header. An attacker reading it would
otherwise be told exactly what to add. The internal message, which is logged and never
sent, says which check failed.
