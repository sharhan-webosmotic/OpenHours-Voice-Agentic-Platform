---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# GDPR — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `gdpr`. Lean version: enforces what's testable in code/config + flags policy items.

## Lawful basis & consent
- [ ] Consent mechanism captures: timestamp, IP, version of policy consented to.
- [ ] Granular consent for marketing vs analytics vs third-party sharing (where required).
- [ ] Withdraw-consent endpoint exists and is documented.
- [ ] Records of processing activity (RoPA) maintained (`docs/ropa.md` or registry).

## Subject rights
- [ ] Access (Art. 15): user can export their data — endpoint or admin tool exists.
- [ ] Rectification (Art. 16): users can correct their data.
- [ ] Erasure (Art. 17): "right to be forgotten" — deletion endpoint or process documented; soft-deletes are flagged for hard-deletion within retention window.
- [ ] Restriction (Art. 18): user can request restriction.
- [ ] Portability (Art. 20): export in machine-readable format (JSON or CSV).
- [ ] Objection (Art. 21): opt-out of profiling/marketing.

## Data minimization & storage
- [ ] Only collect fields needed for the lawful basis. Document why each field exists.
- [ ] Retention period declared per data type.
- [ ] Auto-delete jobs scheduled for retention expiry.

## Cross-border transfers
- [ ] If data leaves EU/EEA: SCCs in place + transfer impact assessment.
- [ ] Sub-processors listed publicly with countries and roles.

## Breach notification
- [ ] 72-hour notification to supervisory authority capability documented.
- [ ] Breach detection: monitoring + on-call.

## Cookies & tracking
- [ ] Consent banner before any non-essential cookie/tracker.
- [ ] Granular consent persistence; refusal must work without dark patterns.

## Verification (lean)
`/audit` checks:
- `docs/privacy-policy.md`, `docs/ropa.md` exist (CONCERNS if missing).
- Endpoints exist for: data export (`GET /me/export`), data delete (`DELETE /me`).
- Cookie consent component referenced in client entry point (web only).
- Retention config present in `stack.md → retention` or `docs/retention.md`.
- No `Math.random` for security-sensitive values (RNG check from OWASP A02).
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
