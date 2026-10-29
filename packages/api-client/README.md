# @openhours/api-client

The typed client for the OpenHours API. Both web applications talk to the API only
through this package.

It owns three things no feature should have to remember:

- **The access token**, in a closure and nowhere else. Never `localStorage`,
  `sessionStorage` or React state. See `docs/DECISIONS.md` D-002.
- **The CSRF header** on the two cookie-bearing routes, refresh and logout. See
  `docs/architecture/adr-0001-session-and-csrf.md`.
- **Refresh on a 401**, single-flight, with a hard sign-out when it fails.

Today it covers the five auth endpoints and is hand-written. M1-03 replaces it with a
client generated from an OpenAPI document (`docs/BACKLOG.md`).
