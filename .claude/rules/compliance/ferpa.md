---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# FERPA — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `ferpa`. US Family Educational Rights
> and Privacy Act: protects the privacy of student education records (schools, edtech
> acting as a "school official").

## Required controls
- [ ] **Consent before disclosure**: written consent from the parent or eligible student
  (18+ or in postsecondary) before disclosing education records, except for permitted
  exceptions (school officials with legitimate interest, etc.).
- [ ] **Directory information**: if disclosed, parents/students can opt out; the categories
  are defined and notice given.
- [ ] **Access rights**: parents/eligible students can inspect and review the student's
  education records within 45 days of request.
- [ ] **Amendment**: a process to request correction of inaccurate records.
- [ ] **Annual notification** of FERPA rights.
- [ ] **Recordkeeping of disclosures**: log who accessed/received records and the purpose.
- [ ] **Edtech as school official**: data used only for the authorized educational purpose,
  not for advertising; no onward disclosure; deletion on contract end.

## Verification (lean)
`/audit` checks:
- Role-based access control restricts education records to authorized roles → FAIL if a
  student record is fetchable without an authorization check (overlaps RBAC gate).
- An **access/inspection** path for parents/eligible students exists → CONCERNS if absent.
- **Audit logging** of record access and disclosure (see `audit-logs.md`) → FAIL if absent
  (FERPA requires a disclosure record).
- No advertising/behavioral SDKs initialized over student records → FAIL if found.
- Directory-information opt-out mechanism present where directory info is disclosed.

<!-- Version: 1.0.0 — 2026-06-25 — initial FERPA lean checklist: consent-before-disclosure, directory-info opt-out, access/amendment rights, annual notice, disclosure recordkeeping, edtech school-official limits -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
