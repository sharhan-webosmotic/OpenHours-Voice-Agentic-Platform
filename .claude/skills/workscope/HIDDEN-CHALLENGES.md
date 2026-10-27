# Hidden Challenges Discovery Details

> Extracted from [SKILL.md](SKILL.md) Phase 2.5 — detailed challenge categories and format.

---

### Category 1 — Feature Ambiguities

Surface all questions like:
- "You mentioned 'real-time notifications' — does this mean WebSocket (persistent connection) or push notifications on mobile or both? These have very different implementations."
- "You mentioned 'admin can manage users' — what does 'manage' include? View only? Edit? Suspend? Delete? Reset password? Each adds implementation time."
- "You have a 'reports' feature — is this a pre-built report the user exports, or a custom report builder where users can filter? The latter is 3-5x more complex."
- "Payments are mentioned but is there a split-pay / payout flow to vendors/drivers? That's a full separate system (escrow, settlement, refunds)."

### Category 2 — Scale & Performance Hidden Costs

Surface concerns like:
- "You expect 10,000 concurrent users. Your current stack choice (single Node server) won't handle that without horizontal scaling — have you budgeted for AWS ECS/EKS or load balancers?"
- "Your catalog has 'unlimited products' — without pagination and indexed queries on MongoDB, the browse screen will be slow. Confirm: backend pagination is in scope?"
- "File uploads are in scope. Where are they stored? AWS S3 requires configuration, CDN for fast delivery needs CloudFront. Is this in scope or does the client handle storage?"

### Category 3 — Integration Loopholes

Surface hidden third-party complexity:
- "Payments via Stripe: you're in [country]. Stripe requires business verification in the UAE/MENA region — the account setup alone can take 2-4 weeks. Has the client started this?"
- "Google Maps SDK: the billing model changed. At scale (>50k API calls/month) this becomes expensive. Has the client been told about Google Maps billing?"
- "WhatsApp Cloud API requires Facebook Business verification which can take 1-3 weeks. If WhatsApp notifications are a launch requirement, this process must start before development."

### Category 4 — Missing Flows That Are Always Needed

Always check for these — they are often forgotten but always needed:
- [ ] **Forgot Password / Reset Password flow** — Is it in scope? (always needed for email/password auth)
- [ ] **Email verification on signup** — Is it in scope?
- [ ] **Account deletion / GDPR right to erasure** — Is it required?
- [ ] **Session expiry / forced logout** — Defined?
- [ ] **Terms of Service & Privacy Policy acceptance** — Required on signup?
- [ ] **Error pages (404, 500, maintenance mode)** — In scope?
- [ ] **Loading/skeleton states** — Explicitly in scope or assumed?
- [ ] **Empty states (no data yet)** — Who designs these?
- [ ] **Onboarding tour / first-run experience** — In scope?
- [ ] **Multi-tab behavior** — Does login in one tab affect other tabs?
- [ ] **Deep links (mobile)** — If a notification is tapped, does it open a specific screen?
- [ ] **App store submission** — Is submitting to App Store / Play Store in scope?
- [ ] **Data seeding** — Does the client need demo/seed data at launch?

### Category 5 — Tech Stack Risk Flags

Based on the confirmed stack, flag any risks:
- "You chose MongoDB with complex relational data (orders → line items → products → inventory). Consider if a hybrid PostgreSQL approach would be safer for transactional data."
- "React Native chosen — confirm: are you targeting both iOS and Android? Apple App Store submission requires a Mac or CI runner with macOS. Is this available?"
- "You chose custom JWT auth — this requires implementing: refresh tokens, revocation, device management, 2FA support. NextAuth.js handles all of this out of the box. Worth reconsidering?"

---

**Format for each challenge**:
```markdown
### [CHALLENGE-ID]: [Title]
**Category**: [Feature Ambiguity / Scale / Integration / Missing Flow / Tech Risk]
**Description**: [What the issue is and why it matters]
**Impact if unresolved**: [What goes wrong in development]
**Options**:
  - A: [Resolution option A]
  - B: [Resolution option B]
**User Decision**: [ ] IN SCOPE  [ ] OUT OF SCOPE  [ ] [custom answer]
```
