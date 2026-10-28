# Decisions that bind future work

Read this before planning or writing anything. These are settled choices, not suggestions:
a change that contradicts one is a change to the decision, which goes through the person
who owns the ticket, not through code review.

Each entry is the decision and one line of why. Where the code does not yet match, the
entry says so rather than pretending.

---

## D-001 Work feature by feature, not layer by layer

One feature is taken from requirement to working endpoint with tests before the next one
starts: schema, service, route, permissions, audit and tests land together in the same
change.

**Why:** a layer finished across ten features is ten features with no proof any of them
work, and the integration defects all arrive at once, at the end.

---

## D-002 The refresh token lives in an httpOnly cookie; the access token lives in memory only

The refresh token is set as `httpOnly`, `Secure`, `SameSite=Strict`, scoped to
`/api/v1/auth`. The access token is returned in the response body and held in a JavaScript
variable. Neither goes in `localStorage`, `sessionStorage`, IndexedDB or a non-httpOnly
cookie, ever.

**Why:** an injected script can read anything in browser storage, so a token that is
readable by JavaScript is a token that leaves with the first XSS.

**Code does not match yet.** `apps/api/src/modules/auth/auth.routes.ts` sets
`sameSite: 'lax'`, and `tests/auth.test.ts` asserts `SameSite=Lax`. The comment beside it
reasons from origin rather than site. Resolve before the sign-in work: see the note at the
bottom of this file.

---

## D-003 New users get a temporary password until an email provider exists

An admin creates the user with a one-time password handed over out of band, and
`mustChangePassword` forces a change on first sign-in. No invite link, no reset email, no
token-by-email flow is built until a provider is chosen and approved.

**Why:** every email-based flow needs a deliverable, monitored provider, and building one
against a provider that does not exist yet means building it twice.

---

## D-004 One Sarvam agent per clinic, with a per-clinic tool secret

Each organisation has its own Sarvam agent, and the tool endpoints authenticate the agent
with a secret issued per clinic, not one shared across the platform.

**Why:** a shared agent or a shared secret makes one clinic's compromise every clinic's
compromise, and the tenant boundary is the thing this product cannot get wrong.

---

## D-005 Phone numbers are bought inside Sarvam

Numbers are provisioned through Sarvam rather than a separate telephony provider, and the
platform stores the mapping from number to organisation and agent.

**Why:** one provider for the number and the agent removes a second integration, a second
contract and a second place for the number-to-clinic mapping to drift.

---

## D-006 Sarvam webhooks are authenticated by three measures, because Sarvam documents none

Until Sarvam publishes a signature scheme: a long random secret in the webhook URL path, an
IP allowlist in front of the endpoint, and re-fetching the authoritative record from Sarvam
before acting on anything the payload claims.

**Why:** none of the three is sufficient alone, and the third is the one that holds: a
forged payload cannot make the platform act if the platform only ever acts on what it
re-read from the provider.

**Replaces, not supplements:** when Sarvam documents a signature scheme, verify the
signature and keep the re-fetch. Record that as a new decision rather than editing this one.

---

## D-007 Responses are buffered until the transaction commits, so no route may stream

`tenantMiddleware` collects the handler's bytes and sends them only once `COMMIT` has
resolved. Consequences, binding on every route: no route streams a response, and call
recordings and other large media are served as presigned S3 URLs, never proxied through the
API.

**Why:** ending the transaction on the response's `finish` event put `COMMIT` after the
client already held a 201, so a client that wrote and immediately read back did not see its
own row, and a failed `COMMIT` could not change a response that had gone out.

**The longer-term fix is per-operation transactions**, not a request-wide one, which would
remove the streaming ban. Deferred, not forgotten. Detail in `docs/STACK.md`.

---

## D-008 M1-14 lands before the voice work starts

The `app.platform` escape clause is removed from all 25 row-level security policies and
replaced by a separate `app_platform` database role, before M3 begins.

**Why:** the `OR current_setting('app.platform', true) = 'on'` disjunct makes the whole
policy predicate non-indexable, so every tenant query sequentially scans its table, measured
at 32.1 ms against 2.45 ms for an index-only scan on 50,000 rows, and M3's gate requires
voice tool endpoints at p95 under 400 ms with 20 concurrent calls.

**It is also the security fix:** `app.platform` is a client-settable GUC, so the API's own
database role can grant itself cross-tenant access. The current transaction-local reset
contains that per transaction; it does not remove it.

---

## Open, and blocking the sign-in work

**D-002's `SameSite` value.** The decision says `Strict`, the code says `Lax`, and the
choice depends on a deployment fact not yet settled: `SameSite` is scoped to the
registrable domain, not the origin.

- If the dashboard and the API are subdomains of one domain (`app.openhours.in` and
  `api.openhours.in`), they are **same-site**, `Strict` works, and the code should change to
  `Strict`.
- If they are different domains (a dashboard on a hosting provider's domain, say), they are
  **cross-site**, and `Lax` does not work either: `Lax` sends the cookie on a top-level
  navigation, not on the `fetch` that calls the refresh endpoint. Only `SameSite=None` works
  cross-site, which is a weaker position and would need the decision revisited.

No test can see this. The suite drives the app with supertest, which sends no `Origin`
header, so `SameSite` is never exercised. It needs a browser against the deployed pair.
