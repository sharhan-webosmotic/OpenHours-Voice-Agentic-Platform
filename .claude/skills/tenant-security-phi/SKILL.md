---
name: tenant-security-phi
description: Use for any work touching authentication, sessions, roles and permissions, tenant isolation, row-level security, audit logging, patient health data (PHI), recordings, secrets, or logging. Security rules for a multi-tenant clinic platform.
---

# Tenant isolation, security and PHI

## Threat model in one paragraph
A user from clinic A must never read or change clinic B's data; staff must not exceed their role; platform staff must not browse patient data casually; patient data must not leak through logs, errors, URLs, caches or analytics; the voice provider endpoints are public and must not be forgeable.

## Tenant isolation (two locks)
1. App lock: repositories get the tenant-scoped Prisma client from `withTenant`, which injects `organisation_id`.
2. Database lock: row-level security with `app.org_id` set per transaction; the API connects as non-owner `app_user`.
`asSystem(reason, fn)` is only for login, voice/webhook resolution and jobs; each use is audited. Never use it to "make a query work".
Cross-tenant ids return 404.

## Authentication
- Passwords: argon2id, min 12 chars, lockout after 5 failures, uniform timing for unknown users.
- Access JWT 15 min; refresh token opaque, hashed at rest, httpOnly Secure cookie, rotated every use, reuse revokes the family.
- Android device token: scoped to forwarding endpoints only, hashed at rest, revocable.
- Voice provider: verify signature/shared secret before parsing; resolve organisation from agent id or dialled number; reject unknown or deactivated organisations.

## Authorization
Matrix in `packages/shared/permissions.ts`; enforced in services; data-scope rules (doctor sees own patients; platform roles get masked fields unless a support session is active). Tests are generated from the matrix.

## PHI handling
- Never in logs, error messages, URLs, analytics, Sentry payloads, test fixtures from real people, or localStorage.
- Logger redaction list must cover: name, phone, dob, email, notes, transcript, prescription, authorization, cookie, password, token.
- Every read or write of patients, prescriptions, recordings, transcripts calls `audit.record` with ids only.
- Recordings: private S3, server-side encryption, 5-minute signed URLs, retention job per clinic.
- Fixtures and seeds use synthetic data only.

## Secrets and config
Secret manager in cloud, `.env` locally (never committed). Rotate-able. No secrets in code, images, CI logs or client bundles.

## HTTP hardening
helmet, strict CORS allow-list, body size limits, rate limits on auth and webhooks, no wildcard origins with credentials, cookies SameSite and Secure, CSRF-safe design (refresh endpoint only via cookie + custom header), dependency audit in CI.

## Review questions (answer before finishing)
1. Can any new query run without a tenant context? 2. Does any new input decide organisation or role? 3. Which role may call this, and is there a test per role? 4. What is logged, and could it contain PHI? 5. Is there an audit row? 6. What happens with a replayed or forged request?
