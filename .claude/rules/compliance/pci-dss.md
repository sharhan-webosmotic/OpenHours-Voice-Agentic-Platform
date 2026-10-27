---
paths:
  - "docs/**"
  - "AI_DOCS/audit/**"
---

# PCI-DSS — required controls (checklist)

> Loaded by `/audit` when `compliance:` includes `pci` or `pci-dss`. PCI-DSS v4.0.
> Lean version: enforces what is testable in code/config and flags the scope-defining
> decision that changes everything else.

## The scope-defining decision (read first)

The single most important PCI control is **scope reduction**: the less your systems
touch cardholder data (CHD), the smaller your audit burden.

- [ ] **Never let raw card data hit your servers.** Use a tokenizing processor's
  hosted fields or client-side SDK (Stripe Elements / Payment Element, Razorpay
  Checkout, Braintree Hosted Fields, Adyen Components). The PAN goes browser →
  processor; your backend only ever sees a token. This puts you in **SAQ-A** (the
  smallest scope) instead of SAQ-D.
- [ ] If you A) store, B) process, or C) transmit a PAN through your own
  infrastructure, you are in full scope. Do not do this for an MVP without an
  explicit, logged decision and a QSA engagement. Flag it loudly.
- [ ] No PAN, CVV, full track data, or PIN in your database, logs, analytics, cache,
  queue payloads, error reports, or backups. CVV must NEVER be stored after
  authorization, even encrypted. Tokens and the last 4 digits are fine.

## The 12 requirements (code/config-testable subset)

### Build and maintain a secure network (Req 1-2)
- [ ] No default credentials anywhere (DB, admin, services).
- [ ] Network segmentation: the cardholder-data environment (if any) is isolated from
  the rest of the network. (For SAQ-A: the processor holds CHD, so this is mostly N/A.)

### Protect cardholder data (Req 3-4)
- [ ] No PAN at rest in your stores (see scope decision). If unavoidable: strong
  cryptography, keys managed in a KMS/HSM, PAN masked on display (first 6 / last 4 max).
- [ ] TLS 1.2+ on every channel that could carry CHD or a payment token. No `http://`
  in production payment flows.

### Maintain a vulnerability management program (Req 5-6)
- [ ] Dependency scanning clean of high/critical (`pnpm audit` / `pip-audit`) in CI.
- [ ] Secure SDLC: input validation at trust boundaries, no injection
  (parameterized queries, no `eval`), output encoding. Maps to `owasp.md`.
- [ ] Change management: PRs reviewed, CI required to merge.

### Implement strong access control (Req 7-8)
- [ ] Least-privilege RBAC on any payment/refund/billing endpoint.
- [ ] Unique IDs per user (no shared accounts). MFA for admin and any access to a CHD
  environment.
- [ ] Strong authentication (≥12 chars or passphrase + breach check), session expiry.

### Monitor and test networks (Req 10-11)
- [ ] Audit logs for all access to payment functions and any CHD (see `audit-logs.md`).
  Logs retained ≥1 year, immutable, no PAN/CVV in the log body.
- [ ] Failed-auth and anomaly alerting on payment endpoints.
- [ ] Rate limiting on payment, refund, and card-add endpoints (abuse + carding
  attack prevention).

### Maintain an information security policy (Req 12)
- [ ] Security policy + incident response runbook in repo (`docs/security-policy.md`,
  `runbooks/incident-response.md`).
- [ ] Each third party that touches the payment flow has an AOC (Attestation of
  Compliance) on file: the processor (Stripe/Razorpay), the host.

## Verification (lean)

`/audit` runs the OWASP grep checklist + secrets scan + audit-log path verification,
and additionally:
- **PAN/CVV in code or logs**: grep for hardcoded card-like patterns
  (`\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b`) and for `cvv`,
  `cvc`, `card[_-]?number`, `pan` written to a logger or DB column → FAIL.
- **Tokenized flow confirmed**: a payment integration references the processor's
  client-side/hosted component (Stripe Elements/PaymentElement, Razorpay Checkout,
  Braintree Hosted Fields, Adyen Components) rather than collecting raw card fields in
  your own form posting to your backend. Raw card fields posted to your API → FAIL
  (you just pulled yourself into SAQ-D scope).
- **TLS only** on payment routes (no `http://` in production config) → FAIL if found.
- **Rate limit** present on payment/refund endpoints → CONCERNS if absent.
- **Audit logs** on payment/refund/card-add endpoints (see `audit-logs.md`) → FAIL if
  absent.
- `docs/security-policy.md` and `runbooks/incident-response.md` exist → CONCERNS if
  missing.

<!-- Version: 1.0.0 — 2026-06-25 — initial PCI-DSS v4.0 lean checklist: scope reduction (SAQ-A via tokenized processor) is the primary control; no PAN/CVV in stores/logs/cache/queues; tokenized-flow + card-pattern grep verification -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
