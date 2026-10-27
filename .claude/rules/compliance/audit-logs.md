---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# Audit logs — what to log when

> Loaded by `/audit` when `compliance:` is non-empty. `/audit` verifies that handlers for sensitive endpoints in `api.md` actually call the audit-log API. Missing → CONCERNS (HIPAA/SOC2) or FAIL (stricter).

## Always log
- Auth: login success, login failure (with IP), logout, password change, MFA enrollment / reset.
- Account: signup, role/permission grant/revoke, account deletion or deactivation.
- Sensitive data access: PHI/PII read or export, payment-method add/remove, billing changes.
- Admin actions: any privileged action by an admin against another user's data.
- Configuration: feature-flag changes affecting security or compliance, retention-policy changes.

## Never log
- Passwords, even hashed.
- Full session tokens / API keys / JWT bodies.
- Full request bodies for endpoints handling PHI/PII (log redacted summaries).
- Non-business-relevant high-volume events (page views) — those go to analytics, not audit logs.

## Log fields (canonical)
- `timestamp` (UTC, ISO 8601 with milliseconds)
- `event` (string from a closed enum)
- `actorId` (user id or `system`)
- `actorIp` (when available; can be approximate for compliance)
- `targetType` + `targetId` (e.g., `user`, `123`)
- `outcome` (`success` | `failure` | `denied`)
- `reason` (when failure/denied — short, machine-readable)
- `metadata` (redacted JSON; no secrets, no full bodies)

## Storage
- Append-only. Never UPDATE or DELETE an audit row.
- Retention: 1 year minimum (HIPAA: 6 years for PHI access logs, SOC2: 1 year, GDPR: as long as needed for the lawful basis).
- Separate database/table from app data. Read access restricted.
- Backup tested at least quarterly.

## Verification (what /audit checks)
For each endpoint in `api.md` whose `Auth` column is `session` or stricter:
- Find the handler file (by route → file mapping convention).
- Grep for one of: `auditLog\(|logger\.audit\(|AuditLog\.create|audit_event\(`.
- If absent → finding (severity per compliance regime).
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
