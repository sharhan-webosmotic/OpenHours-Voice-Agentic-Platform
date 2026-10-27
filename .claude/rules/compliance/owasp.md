---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# OWASP Top-10 — checklist (lean)

> Loaded by `/audit` when `stack.md → compliance:` is non-empty. Each item maps to a grep `/audit` runs and a fix instruction. No commentary.

## A01 — Broken access control
- [ ] Auth middleware applied to every non-public endpoint listed in `api.md` (grep handler files for `auditLog|requireAuth|@auth_required` or equivalent).
- [ ] Role/scope checks present on admin endpoints.
- [ ] Direct object references checked (`/users/:id` verifies `id == session.user.id` or admin).

## A02 — Cryptographic failures
- [ ] Passwords hashed with bcrypt/argon2. Never plain, never sha256.
- [ ] Session tokens generated via crypto-strong RNG (`crypto.randomBytes` / `secrets.token_hex`), not `Math.random`.
- [ ] PII at rest encrypted (column-level for HIPAA/SOC2).
- [ ] TLS only — no `http://` URLs in production config.

## A03 — Injection
- [ ] No string concatenation into SQL. ORM/parameterized queries only.
- [ ] No `eval()`, `new Function()`, or `exec()` on user-influenced strings.
- [ ] No shell commands built from user input. Use language libraries instead.
- [ ] HTML rendering: no `dangerouslySetInnerHTML` / `v-html` / `innerHTML =` with non-allowlisted content.

## A04 — Insecure design
- [ ] Rate limits on: login, signup, password-reset, email-sending, billing endpoints.
- [ ] CAPTCHA or proof-of-work on public signup if abuse risk.
- [ ] No security-by-obscurity (don't rely on hidden URLs).

## A05 — Security misconfiguration
- [ ] CORS: no `*` origin in production. Exact list.
- [ ] Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict` for stricter regimes).
- [ ] CSP header set, no `unsafe-inline` for scripts.
- [ ] No default credentials anywhere.
- [ ] Stack traces NOT returned to clients in production.

## A06 — Vulnerable & outdated components
- [ ] `pnpm audit` / `pip-audit` clean of high+critical.
- [ ] Lock file committed.
- [ ] Pinned exact versions for security-sensitive deps (auth, crypto).

## A07 — Identification and authentication failures
- [ ] No predictable session IDs.
- [ ] Session expiry enforced (idle + absolute).
- [ ] MFA for admin accounts.
- [ ] Password policy: ≥12 chars or use passphrase + breach check.

## A08 — Software & data integrity failures
- [ ] No `npm install` from arbitrary URLs.
- [ ] CI: lockfile not modified by build steps.
- [ ] Auto-update libraries reviewed before merge.

## A09 — Security logging & monitoring
- [ ] Auth events logged (login success/failure, password changes, role changes).
- [ ] Failed-auth alerting threshold defined.
- [ ] Logs don't contain secrets, tokens, full request bodies for sensitive endpoints.

## A10 — Server-side request forgery (SSRF)
- [ ] User-supplied URLs are validated against an allowlist before fetching.
- [ ] No fetching of internal addresses (`169.254.169.254`, `127.0.0.1`, `10.*`, `172.16-31.*`, `192.168.*`).
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
