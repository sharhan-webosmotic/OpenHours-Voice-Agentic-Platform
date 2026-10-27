---
description: Security rules — enforces OWASP Top 10 compliance, auth patterns, and data protection
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.py"
  - "**/*.go"
  - "**/*.dart"
---

# Security Rules

## Authentication & Authorization

1. **Never store tokens in localStorage** — use httpOnly cookies or secure storage
2. **Never expose JWT secrets or API keys** in client-side code
3. **Validate auth on EVERY protected endpoint** — not just the frontend route
4. **Check permissions at the data layer** — users should only access their own data
5. **Use short-lived access tokens** with refresh token rotation

## Input Validation (OWASP: Injection Prevention)

6. **Validate ALL input at the API boundary** — type, format, length, range
7. **Use parameterized queries** — never concatenate user input into SQL/NoSQL queries
8. **Sanitize HTML input** — strip or escape before storage and rendering
9. **Validate file uploads** — check MIME type, extension, and file size
10. **Reject unexpected fields** — use strict DTOs/schemas, not pass-through objects

## Cross-Site Scripting (XSS)

11. **Never use `dangerouslySetInnerHTML`** without sanitization (DOMPurify)
12. **Never use `eval()`, `new Function()`, or `innerHTML`** with user data
13. **Escape dynamic content** in templates — frameworks do this by default, don't bypass it
14. **Set Content-Security-Policy headers** — restrict script sources

## Data Protection

15. **Hash passwords** — use bcrypt/argon2, never MD5/SHA1 for passwords
16. **Encrypt sensitive data at rest** — PII, financial data, health data
17. **Never log sensitive data** — passwords, tokens, credit card numbers, SSN
18. **Mask sensitive fields in API responses** — show `****1234` not full card number
18a. **Never leak credentials or PII into a URL (BLOCKING).** No sensitive value (password, token, session id, email, card number, SSN) may appear in a URL query string, path segment, `Referer` header, or a `GET` form submission — URLs are written to server access logs, proxy logs, and browser history, and leak cross-origin via `Referer`. Concretely for web forms: every HTML `<form>` sets `method="post"`, so a native submit that fires before or without JS hydration (first load over HTTP on a LAN IP or preview host — a non-secure context — or any hydration failure) puts fields in the request body, not the URL. A form with no `method` defaults to `method="get"`; a login form that GET-submits the password into the URL is a P0 leak. Client-side navigation and API calls must likewise keep secrets in headers/body, never in the query string. Backs `frontend-rules.md` Rule 19f.
19. **Implement data retention policies** — delete what you don't need

## API Security

20. **Rate limit all public endpoints** — especially auth routes
21. **Use CORS properly** — whitelist specific origins, not `*`
22. **Validate Content-Type headers** — reject unexpected content types
23. **Implement request size limits** — prevent denial-of-service via large payloads
24. **Use HTTPS everywhere** — no exceptions

## Secrets Management

25. **All secrets in environment variables** — never in code, never in git
26. **Use `.env.example`** with placeholder values (not real secrets)
27. **Rotate secrets regularly** — especially after team member departures
28. **Different secrets per environment** — dev, staging, production must use different keys

## Error Handling (Security Context)

29. **Never expose stack traces** in production error responses
30. **Never reveal database structure** in error messages
31. **Use generic error messages** for auth failures ("Invalid credentials" not "User not found")
32. **Log security events** — failed logins, permission denials, rate limit hits

## RBAC & Role Integrity (BLOCKING)

33. **Every protected endpoint must enforce role-level permission — not just auth** — after confirming a valid token exists, the handler (or a shared middleware) must check that the caller's role permits the action (e.g., `hasRole('admin')`, `can('delete', resource)`). A 401/403 distinction is mandatory: 401 = not authenticated, 403 = not authorized at the role level.

34. **JWT/session role must be re-validated against the database on each request** — do not trust the role claim embedded in the token at face value. Either: (a) keep token expiry ≤ 15 minutes and issue a fresh token on every role change, OR (b) store a `role_version` or `permissions_hash` in the DB and include it as a claim — reject any token whose claim does not match the current DB value. Stale-role bugs (role changed in DB but old token still grants old permissions) are a FAIL in audit.

35. **Client IP must be read from `X-Forwarded-For` (first value), not the socket/remote address** — in any environment behind a reverse proxy, load balancer, or CDN: `const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket.remoteAddress`. Never store or log `req.socket.remoteAddress` as "the user's IP" in audit logs.

35a. **RBAC testing must go beyond the static matrix (BLOCKING, methodology: AuthMatrix).** Static cells (role x action, role x field) are necessary but not sufficient. The `authz-matrix` skill + `mavs/authz.json` MUST also cover, for any project with roles:
   - **Dynamic permission-change propagation (two-actor):** Actor A changes Actor B's role/permission, then B re-validates. A GRANT must take effect, a REVOKE must take effect, and a revoke that still works on B's existing token until it expires is the stale-role bug (Rule 34) caught live: a `LEAK`.
   - **Cross-user IDOR chains:** create a resource as A, capture its id, access it as B by id. For `own-only`/`tenant-scoped` this must return 403/404. B reaching A's resource by id is a `LEAK`.
   - **CSRF on mutating requests:** a mutation with a missing/invalid CSRF token must be rejected.
   - **Three-state results** (PASS / LEAK / INCONCLUSIVE, the AuthMatrix green/red/blue): a `LEAK` blocks the merge, an `INCONCLUSIVE` (session/setup error) is surfaced for review but is not proof of a bypass and is re-run, not shipped as PASS.
   Prior art and methodology: AuthMatrix (PortSwigger) — replay each request under every role's session, with chained requests, scored in a role x request grid.

35b. **Dynamic permission-based access (PBAC) is validated by PERMISSION, never by role name (BLOCKING).** Two models exist: STATIC (fixed roles each with a fixed permission set, a role check is acceptable) and DYNAMIC (custom roles created at runtime, permissions assigned/toggled per role or per user, plus direct grants). For DYNAMIC (`authz-matrix.yaml` `mode: dynamic`):
   - **Permission is the atomic unit.** Each `resource.action` and `resource.field` declares the permission(s) it `requires:`. Access is decided by the user's EFFECTIVE permission set (role bundles + direct grants), not by role name or id. Two users with the same role name can hold different permissions, so a role-name check is wrong by construction.
   - **No role-name guards.** A code authorization branch on a role NAME/id (`role === 'admin'`, `roles.includes('manager')`) in dynamic mode is a FAIL: it breaks for custom roles and per-user grants. The guard must check the permission (`can('case.delete')` / `hasPermission(user, 'case.delete')`). The `/build` RBAC gate enforces this in dynamic mode.
   - **Each permission (checkmark) is validated independently.** Granting exactly one permission grants exactly its capability and nothing else, revoking it removes exactly that. Tested per permission at the API + the data-perm UI layer, and the permission-level two-actor toggle (Actor A toggles ONE checkmark on B, B re-validates that one capability changed).
   - **Permission dependencies are validated.** A permission may depend on another (e.g. `project.assign` needs `user.read` to search users). The effective requirement is the dependency closure: a persona with a permission but missing its dependency is a broken grant, the dependent capability must be correctly disabled (not broken-but-clickable), and granting a permission must handle its dependencies (auto-grant, require, or disable).
   - A capability reachable WITHOUT its required permission, or a role-name guard that mis-grants a custom-role / granted user, is a `LEAK`.
   The full permission model (catalog, role bundles, mode, dependencies, field-level) lives in tech-spec S3 and `authz-matrix.yaml`, generated from it.

## Auth Implementation Patterns (canonical — do not reinvent per project)

> **MAVS-enforced (not just prose).** Rule 34 (stale-role), 38 (refresh rotation + reuse), 40 (password reset single-use/expiry), and session-expiry are now machine-checked. The static side is `/build` RBAC gate Check A3 (the guard re-reads the role from the DB) and the API-envelope gate. The executable side is the required auth-flow suite in `e2e-testing`, which writes `AI_DOCS/quality/mavs/auth.json` (a revoked role is actually denied, a reused refresh revokes the family, a reset token is single-use). `mavs-gate.sh` blocks the milestone merge on a FAIL. These stopped being audit-time prose and became a gated test.

36. **Session vs JWT is a decision, not a default** — server-rendered web app or same-origin SPA: HttpOnly cookie sessions with a server-side store (Redis/DB). Mobile clients, third-party API consumers, or multi-service backends: short-lived JWT access token (≤15 min) + rotating refresh token. Pick ONE per client type and record it as an ADR. Mixing both ad hoc in one app is a finding.

37. **Password hashing: argon2id preferred, bcrypt cost ≥12 acceptable** — never SHA-family, MD5, or reversible encryption. Add a breach check (haveibeenpwned k-anonymity API) on signup and password change where feasible.

38. **Refresh tokens rotate on every use** — store only a hash server-side, detect reuse (a replayed old refresh token revokes the whole token family), absolute lifetime ≤30 days.

39. **Logout means server-side invalidation** — delete the session / revoke the refresh-token family. Client-side token deletion alone is not logout.

40. **Password reset discipline** — single-use token, ≤30 min expiry, stored hashed, endpoint rate-limited, identical response whether the account exists or not, and ALL active sessions invalidated on successful reset.

41. **MFA: TOTP minimum for admin roles** — recovery codes generated once, shown once, stored hashed.

42. **OAuth / social login** — enforce `state` + PKCE for public clients, verify `aud`/`iss`/`exp`/signature on ID tokens server-side, and never auto-merge accounts on an unverified email claim.

<!-- Version: 1.2.0 — 2026-06-12 — Added Auth Implementation Patterns (Rules 36–42): session-vs-JWT decision rule, argon2id/bcrypt, refresh rotation + reuse detection, server-side logout, reset-token discipline, MFA for admins, OAuth state/PKCE/claim verification -->
<!-- Version: 1.3.0 — 2026-06-29 — Marked Rules 34/38/40 + session-expiry as MAVS-enforced (mavs/auth.json via e2e-testing + /build Check A3), not just audit prose -->

<!-- Version: 1.4.0 — 2026-06-29 — Added Rule 35a: RBAC testing must cover dynamic permission-change propagation (two-actor), cross-user IDOR chains, CSRF on mutations, and three-state PASS/LEAK/INCONCLUSIVE results (AuthMatrix methodology), enforced via mavs/authz.json -->

<!-- Version: 1.1.0 — 2026-05-01 — Added RBAC & Role Integrity section (Rules 33–35): role-level check on every endpoint, JWT role re-validation vs DB, X-Forwarded-For IP extraction -->

<!-- Version: 1.5.0 — 2026-06-29 — Added Rule 35b: dynamic permission-based access (PBAC) validated by permission not role name, per-permission (checkmark) independence, no role-name guards in dynamic mode, and permission dependencies (closure validation); model lives in tech-spec S3 + authz-matrix.yaml -->

<!-- Version: 1.6.0 — 2026-07-01 — Added Rule 18a: never leak credentials/PII into a URL (query string, path, Referer, GET form). Every web form sets method=post so a pre-hydration native submit puts fields in the body, not the URL. A GET-submitted password is a P0 leak. Backs frontend-rules 19f. -->
