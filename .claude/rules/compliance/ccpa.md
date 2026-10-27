---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# CCPA / CPRA — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `ccpa` or `cpra`. California Consumer
> Privacy Act as amended by the CPRA. Lean version: enforces what is testable in
> code/config and flags policy items. The same engine satisfies most other US-state
> privacy laws (Virginia VCDPA, Colorado CPA, Connecticut CTDPA, Utah UCPA): build the
> rights endpoints once, apply broadly.

## Applicability
- [ ] Triggered if you serve California residents AND meet a threshold (gross revenue,
  volume of consumers' personal information, or revenue from selling/sharing PI). When
  the user base is broad US consumer, assume it applies.

## Consumer rights (must be reachable in product or via a documented process)
- [ ] **Right to know / access**: a consumer can request the categories and specific
  pieces of PI collected. Export endpoint or admin tool exists.
- [ ] **Right to delete**: deletion endpoint/process; cascades to service providers.
  Soft-deletes flagged for hard-deletion within the retention window.
- [ ] **Right to correct** (CPRA): consumers can correct inaccurate PI.
- [ ] **Right to opt out of sale/sharing** (CPRA adds "sharing" for cross-context
  behavioral advertising): a **"Do Not Sell or Share My Personal Information"** link in
  the site footer, and honoring the **Global Privacy Control (GPC)** browser signal.
- [ ] **Right to limit use of sensitive PI** (CPRA): a "Limit the Use of My Sensitive
  Personal Information" mechanism if you process sensitive PI (precise geolocation,
  race, health, financial account, etc.).
- [ ] **Non-discrimination**: a consumer exercising rights is not denied service or
  charged differently (price incentives must be tied to the value of the data, disclosed).

## Notice and minimization
- [ ] Privacy policy lists categories of PI collected, purposes, and whether PI is
  sold/shared, updated at least every 12 months.
- [ ] **Notice at collection**: at or before collection, disclose categories and
  purposes. Collect only PI reasonably necessary for the disclosed purpose.
- [ ] Retention period disclosed per category; auto-delete at expiry.

## Service providers and contracts
- [ ] Data processing agreements with every service provider that receives PI; they are
  contractually barred from selling it or using it for their own purposes.
- [ ] Records of opt-out requests honored within 15 business days (GPC) and applied
  downstream to providers.

## Verification (lean)
`/audit` checks:
- `docs/privacy-policy.md` exists and is dated within 12 months → CONCERNS if missing/stale.
- Rights endpoints exist: data export (`GET /me/export` or equivalent), data delete
  (`DELETE /me`), opt-out of sale/share → CONCERNS if absent.
- A **"Do Not Sell or Share"** link is referenced in the client footer/entry point
  (consumer web) → CONCERNS if absent when sharing/sale is in scope.
- **GPC honored**: client reads the `Sec-GPC` request header / `navigator.globalPrivacyControl`
  and suppresses sale/share tracking when set → CONCERNS if tracking fires regardless.
- No `Math.random` for security-sensitive values (RNG check, shared with `gdpr.md`).
- Retention config present in `stack.md → retention` or `docs/retention.md`.

> If both `gdpr` and `ccpa` are in scope, the export/delete/correct machinery is shared;
> the CCPA-specific deltas are the Do-Not-Sell/Share link, GPC signal handling, and the
> sensitive-PI limitation mechanism.

<!-- Version: 1.0.0 — 2026-06-25 — initial CCPA/CPRA lean checklist: consumer rights endpoints (know/delete/correct/opt-out of sale+share/limit sensitive PI), Do-Not-Sell-or-Share link + GPC signal, shared export/delete engine with gdpr.md, covers other US-state privacy laws -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
