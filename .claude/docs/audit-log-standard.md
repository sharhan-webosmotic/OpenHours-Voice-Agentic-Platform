# Audit Log Standard (global)

> The canonical audit-log contract for EVERY ADF project, not only compliance
> ones. Compliance regimes (HIPAA/SOC2/GDPR/PCI) add retention and scope on top
> of this baseline via `rules/compliance/audit-logs.md`. Scaffolded by
> `/guardrails`, enforced on sensitive endpoints by `/build`, verified by
> `/audit`.

## Why baseline, not compliance-only

Audit logs answer "who did what, when, and what happened" after the fact. That
question matters for any app with accounts and roles, long before a compliance
regime is declared: account takeover triage, accidental admin actions, support
investigations, and data-loss forensics all depend on it. So a minimal,
consistent audit trail is the global default. Compliance turns the dial up
(longer retention, more event types, stricter storage), it does not introduce
the concept.

## The schema (canonical fields)

Every audit event records:

| Field | Notes |
|---|---|
| `timestamp` | UTC, ISO 8601 with milliseconds |
| `event` | string from a closed enum, `<resource>.<action>` (e.g. `user.login`, `order.delete`) |
| `actorId` | user id, or `system` for automated actions |
| `actorIp` | when available (may be approximate for compliance) |
| `targetType` + `targetId` | e.g. `user`, `123` |
| `outcome` | `success` \| `failure` \| `denied` |
| `reason` | short machine-readable reason when failure/denied |
| `metadata` | redacted JSON: no secrets, no full request bodies |

## Always log (baseline)

- Auth: login success, login failure (with IP), logout, password change, MFA enrollment/reset.
- Account: signup, role/permission grant/revoke, account deletion/deactivation.
- Sensitive data access: PII/PHI read or export, payment-method add/remove, billing changes.
- Admin actions: any privileged action by an admin against another user's data.
- Configuration: security/compliance-affecting feature-flag and retention changes.

## Never log

- Passwords (even hashed), full session tokens / API keys / JWT bodies.
- Full request bodies for endpoints handling PII/PHI (log redacted summaries).
- High-volume non-business events (page views), those are analytics, not audit.

## Storage

- Append-only. Never UPDATE or DELETE an audit row.
- Separate table/store from app data, read access restricted.
- Retention baseline: 90 days. Compliance overrides: GDPR per lawful basis, SOC2 ≥ 1 year, HIPAA 6 years for PHI access, PCI ≥ 1 year (`rules/compliance/audit-logs.md`).

## Implementation (scaffolded by /guardrails)

Provide one audit sink and call it from sensitive handlers. Typical shapes:

- Prisma: an extension/middleware that writes an `AuditLog` row, plus an explicit `auditLog(event, ctx)` helper for non-DB events (login, export).
- API decorator/middleware: `@audited('order.delete')` or an Express/Nest interceptor that records the canonical fields.

`/guardrails` scaffolds the `AuditLog` model + the `auditLog()` helper at project setup so handlers have something to call from day one.

## Enforcement

- `/build` (Vertical-slice + RBAC gates): a task touching a sensitive endpoint (auth, payment, export, admin, PII access) must call the audit sink. Missing → BLOCKED.
- `/audit` (Phase 2): for every non-`public` endpoint in `api-contract.md`, grep the handler for an audit-log call. Missing on a sensitive endpoint → CONCERNS (baseline) or FAIL (compliance regimes).

<!-- Version: 1.0.0 - 2026-06-23 - New global audit-log standard: baseline audit trail for every project, scaffolded by guardrails, enforced by build, verified by audit, compliance adds retention/scope on top. -->
