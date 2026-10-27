---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# HIPAA — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `hipaa`. Items marked `R` are required, `A` are addressable (must implement OR document an equivalent).

## Administrative safeguards
- [R] BAA in place with every vendor that touches PHI (cloud, email, monitoring, analytics).
- [R] Role-based access control on PHI; principle of least privilege.
- [R] Periodic access review (quarterly).
- [R] Workforce training documented.
- [R] Incident response runbook exists; tested at least annually.
- [R] Sanction policy for non-compliance.

## Physical safeguards
- [R] Production data only on cloud providers with HIPAA-eligible services. No PHI on developer laptops, screenshots, or local dumps.
- [R] Disposal of media: cloud provider attests crypto-erase.

## Technical safeguards
- [R] Unique user identification (no shared accounts).
- [R] Automatic logoff (idle session expiry — recommend 15 min).
- [A] Encryption at rest for PHI columns/tables.
- [R] Encryption in transit (TLS 1.2+).
- [R] Audit logs for PHI access (see `audit-logs.md`).
- [R] Integrity controls — append-only audit logs; checksums or signatures on PHI exports.
- [R] Authentication: MFA for admins; password policy ≥12 chars + breach check OR passphrase.

## Breach notification
- [R] Plan documented: who to notify, by when, what to communicate. 60-day max.
- [R] Logging supports forensics — what data, whose, when, how accessed.

## Verification (lean)
`/audit` runs the OWASP grep checklist + audit-log path verification + secrets scan, and looks for:
- `BAA-vendors.md` or equivalent in repo (CONCERNS if missing).
- `runbooks/incident-response.md` (CONCERNS if missing).
- Session expiry config ≤ 15 minutes (FAIL if longer).
- TLS-only (no `http://` in production config) (FAIL if found).
- Encryption-at-rest config present in `stack.md → security` (CONCERNS if absent).
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
