# OpenHours Voice Agentic Platform: Roadmap, Milestones and Tickets

Phase 1 MVP. Ordered checklist with a test gate per milestone and a Claude Code prompt per ticket.
Priority order: backend, then admin platform and clinic dashboard, then mobile last (lowest priority).

## How to use this file

1. Work tickets in order inside a milestone. Tick a ticket only when its "Done when" is met, `pnpm check` passes, and a second person has reviewed the PR.
2. Run every prompt on its own branch (`feat/<ticket-id>-short-name`), in plan mode, from the repo root. Prepend the **standard preamble** below.
3. A milestone is closed only when every box in its **Gate** is ticked. Then tag it (`git tag m1-done`), update `docs/STACK.md`, and hold a 15-minute retro: actual hours vs estimate, what to change in `CLAUDE.md` or the skills.
4. Changing scope, order or a decision: edit this file in a PR. Do not change it in chat.

### Standard preamble (prepend to every prompt)

```text
Read CLAUDE.md, the CLAUDE.md of the app you are working in, and the skills named in the ticket.
Show a plan first (files, tests, risks) and wait for my approval.
Make the smallest change that meets "Done when". Add tests in the same change.
Run pnpm check. Report anything you could not run as "not verified here" with the exact command.
Do not commit; I will review and commit.
```

### Legend

- Owners: **Dev 1** backend and data, **Dev 2** clinic dashboard, **Dev 3** admin platform (and later Android), **Lead** non-code decisions.
- Estimates are human hours including review (my judgement, recalibrate at the end of M1).
- `[x]` done, `[ ]` open. **M8 Mobile is lowest priority: do not start before M1 to M7 are closed.**

## Progress

| Milestone                                             | Tickets done | Status      |
| ----------------------------------------------------- | ------------ | ----------- |
| M0: Decisions and access                              | 1 / 8        | In progress |
| M1: Backend foundation                                | 1 / 14       | In progress |
| M2: Clinic core backend                               | 0 / 6        | Not started |
| M3: Voice integration (Sarvam)                        | 0 / 9        | Not started |
| M4: Shared UI kit and Internal Admin Platform         | 0 / 12       | Not started |
| M5: Clinic dashboard core                             | 0 / 11       | Not started |
| M6: Clinical records and automation                   | 0 / 11       | Not started |
| M7: Hardening, QA and deployment                      | 0 / 9        | Not started |
| M8: Call forwarding and Android app (lowest priority) | 0 / 12       | Not started |
| **Total**                                             | **2 / 92**   |             |

Update this table by hand when you close a milestone (counts are of ticket checkboxes).

## Suggested order across the team (parallel streams)

| Stream   | After M1 gate                                       | Notes                                             |
| -------- | --------------------------------------------------- | ------------------------------------------------- |
| Dev 1    | M2 then M3 then M6-04, M6-06 then M7 infra          | Critical path. Keep it unblocked                  |
| Dev 2    | M4-01 (UI kit), M5 then M6 backend modules and UI   | Starts on the OpenAPI mock as soon as M1-03 lands |
| Dev 3    | M4 admin platform, M3-08 simulator, M6-05 analytics | Starts on the mock as soon as M1-03 lands         |
| Everyone | M7 hardening and QA                                 | Then M8 mobile if time and budget remain          |

---

# M0: Decisions and access (Day 0)

**Goal:** nothing blocks the first week. **Owner:** Lead.

- [x] **M0-01** Claude Code setup pushed (CLAUDE.md files, skills, hooks, docs/STACK.md)
- [ ] **M0-02** Branch protection on `main` (PR plus 1 approval, no force-push); invite all devs; each dev installs corepack 0.36.0 or newer and Node 24
- [ ] **M0-03** AWS account in ap-south-1, separate staging and production, billing alerts
- [ ] **M0-04** Sarvam: obtain official API docs and sample payloads (tool calling, webhooks, outbound calls, recordings, signature scheme) and a test agent
- [ ] **M0-05** Choose telephony or number provider (who supplies the agent number and outbound caller ID)
- [ ] **M0-06** Choose email provider (SES or Resend) or approve temporary-password flow
- [ ] **M0-07** Confirm recording retention default, outbound call rules (window, 2 attempts, daily cap) and the 8 analytics metrics
- [ ] **M0-08** OpenHours: domain and trademark check (India classes 9, 42, 44), app-store name check

### Gate M0

- [ ] All M0 boxes ticked
- [ ] `docs/voice/sarvam-contract.md` has real payloads (or M3 is explicitly delayed)
- [ ] Open items in `docs/STACK.md` cleared or owned

---

# M1: Backend foundation (Days 1 to 2)

**Goal:** a secure, tested base: monorepo, schema, tenant isolation, auth, permissions, audit, admin APIs, API contract.
**Owner:** Dev 1.

- [x] **M1-01** Monorepo, tooling, CI, local environment (built and verified locally)
- [ ] **M1-01b** M1-01 reviewed, merged to `main`, CI green on GitHub
- [ ] **M1-02** Config, logging, errors, request context, hardening, validation
- [ ] **M1-03** OpenAPI stubs, generated client, mock server (unblocks Dev 2 and Dev 3)
- [ ] **M1-04** Prisma schema: identity, tenancy, audit
- [ ] **M1-05** Prisma schema: clinic domain
- [ ] **M1-06** SQL migration: constraints, row-level security, database roles
- [ ] **M1-07** Tenant-scoped Prisma client
- [ ] **M1-08** Authentication and device pairing
- [ ] **M1-09** Permissions matrix and support sessions
- [ ] **M1-10** Audit log
- [ ] **M1-11** Organisation, user, phone number and voice-agent APIs
- [ ] **M1-12** Foundation review in a fresh session
- [ ] **M1-13** CI follow-ups: coverage floors, format check, migration and policy checks

### Gate M1 (Gate 1)

Run and tick:

- [ ] From a clean clone: `pnpm install && pnpm check` passes
- [ ] Tenant-isolation suite passes as the restricted `app_user` role (RLS active)
- [ ] Permission tests generated from the matrix pass; changing one matrix cell fails exactly one test
- [ ] Auth tests pass (lockout, rotation, reuse, tampered token); no secret or token in captured logs
- [ ] Policy-coverage script: every tenant table has an RLS policy
- [ ] Concurrent overlapping-appointment test passes (one winner)
- [ ] `openapi.json` committed and fresh; mock server works; clinic-web and admin-web can call it
- [ ] STACK.md VERIFY items closed: zod 4 with the OpenAPI libraries, Prisma 7 with `set_config` inside transactions, express-rate-limit with Express 5
- [ ] M1-12 review has no open Blocker or High findings
- [ ] CI green on `main`
- [ ] Re-estimated M2 to M8 using real velocity; this file updated
- [ ] Tagged `m1-done`, retro held

## M1 tickets

### M1-01 Monorepo, tooling, CI, local environment (Dev 1, done)

Built on `feat/foundation-setup`: pnpm workspaces and Turborepo, tooling, API skeleton with `/health` and `/ready`, Postgres 16 and SeaweedFS compose stack, CI workflow. Remaining work is tracked in M1-01b and M1-13. To merge: read the staged diff, pin and verify the SeaweedFS image tag, run `cp .env.example .env && docker compose up -d` yourself, commit (`feat: set up monorepo foundation with api health endpoints`), push, open a PR.

### M1-02 Config, logging, errors, request context, hardening, validation (Dev 1, 3h)

Skills: backend-api-standards, tenant-security-phi. Blocked by: M1-01b.

```text
Prompt 1 already created config.ts, common/logger.ts and common/errors.ts. Extend them; do not recreate or rename them.

1. Logger: check the redaction list against CLAUDE.md rule 4. It must cover, at any depth: authorization, cookie, set-cookie, password, token, refreshToken, and fields named name, fullName, phone, dob, email, notes, transcript, prescription. Add what is missing, with a test that logs a nested object.
2. Errors: AppError subclasses for 400, 401, 403, 404, 409 and 429, rendered as problem+json (type, title, status, detail, requestId, errors[]), no stack traces in production. Add only what is missing.
3. Request context: AsyncLocalStorage holding { requestId, organisationId?, userId?, role? } with runWithContext() and getContext(). Middleware assigns the request ID (accept an inbound X-Request-Id only if it is a safe UUID, otherwise generate one), returns it in the response header, binds it to every log line.
4. Hardening: helmet, strict CORS allow-list from config (no wildcard with credentials), JSON body size limit, trust-proxy from config, rate-limiter factory (express-rate-limit; verify version and Express 5 compatibility on install and record the result in docs/STACK.md).
5. Validation middleware for params, query and body using zod 4: returns 400 problem+json with field errors, and registers each route's schemas in a registry that M1-03 will use for OpenAPI. Do not install any OpenAPI library here.

Done when: tests cover nested redaction, each AppError rendering, request-ID propagation including a malicious inbound header, CORS allow and deny, a 429 problem+json from the rate limiter, and a 400 with field errors from validation; pnpm check passes.
```

### M1-03 OpenAPI stubs, generated client, mock server (Dev 1, 3h)

Skills: backend-api-standards. Blocked by: M1-02. Unblocks: every frontend ticket.

```text
Generate an OpenAPI 3.1 document from the zod route registry, served at /api/docs.json, with Swagger UI at /api/docs outside production. Verify @asteasolutions/zod-to-openapi, openapi-typescript and openapi-fetch work with zod 4 and record the result in docs/STACK.md; if one does not, stop and propose an alternative.
Add pnpm openapi: writes openapi.json into packages/api-client and generates a typed client (openapi-typescript + openapi-fetch) with an auth wrapper that refreshes the token once on a 401. Replace the stub drift check: CI must fail if the committed openapi.json is stale.
Add pnpm mock: serves example responses so the frontends run without the real backend.
Create stub routes with realistic example responses (the real server returns 501 for them) for: auth, organisations, users, phone numbers, voice agents, doctors, services, availability, patients, appointments, calls, recordings, follow-ups, prescriptions, notifications, analytics summary, audit logs, support sessions, platform monitoring, usage, forwarding schedules and devices. Use /api/v1, cursor pagination ({ items, nextCursor }), problem+json errors.

Done when: a throwaway script in apps/clinic-web imports the client types and calls POST /auth/login against pnpm mock; CI fails when openapi.json is stale.
```

### M1-04 Prisma schema: identity, tenancy, audit (Dev 1, 3h)

Skills: database-prisma-postgres. Blocked by: M1-02.

```text
Install Prisma at the pinned stable 7.10.1 (both prisma and @prisma/client; never latest). Confirm how Prisma 7 driver adapters work with interactive transactions and set_config('app.org_id', ...) and record the result in docs/STACK.md before building on it.

Design the first schema in apps/api/prisma/schema.prisma for: organisations, users, refresh_tokens, devices, pairing_codes, phone_numbers, voice_agents, notifications, audit_logs.
Conventions: UUID primary keys (v7 generated in the app), snake_case via @map/@@map, timestamptz, organisation_id on every tenant table with composite indexes that start with it. Enums: role (SUPER_ADMIN, INTERNAL_ADMIN, CLINIC_OWNER, CLINIC_MANAGER, DOCTOR, STAFF), user status, organisation status, provider (SARVAM), phone kind (CLINIC_LINE, AGENT_NUMBER).
Rules: users.organisation_id is null for the two platform roles and required for the rest (CHECK goes in M1-06); users.email unique case-insensitively (citext); agent-number e164 globally unique; (provider, external_agent_id) unique; refresh_tokens stores token_hash, family_id, expires_at, revoked_at; organisations has timezone, status, settings (json), recording_retention_days.
First show the full schema and a Mermaid ERD and list any table you made tenant-less and why. After approval, create the migration and an idempotent seed: one super admin, one demo clinic with an owner, a doctor and a staff user (synthetic data only).

Done when: migrating an empty database works; running the seed twice changes nothing; the ERD matches the schema; the exactOptionalPropertyTypes setting does not block Prisma types (if it does, relax it for apps/api only and say so).
```

### M1-05 Prisma schema: clinic domain (Dev 1, 2h)

Skills: database-prisma-postgres. Blocked by: M1-04.

```text
Extend the Prisma schema with the clinic domain: clinic_hours, doctors, doctor_working_hours, doctor_time_off, services, doctor_services, patients (phone indexed not unique, deleted_at, trigram index on full_name added in M1-06), appointments (status, source, idempotency_key unique per organisation, rescheduled_from_id), calls, webhook_events (unique provider + external_event_id), prescriptions, prescription_items, follow_ups, outbound_calls (unique dedupe_key), forwarding_schedules, forwarding_events. Same conventions as M1-04. Show the schema diff and updated ERD first, then migrate and extend the seed (a doctor with hours, two services, three patients, a few appointments).

Done when: migration applies on top of M1-04; seed is idempotent; every new tenant table has organisation_id-led indexes.
```

### M1-06 SQL migration: constraints, row-level security, database roles (Dev 1, 4h)

Skills: database-prisma-postgres, tenant-security-phi. Blocked by: M1-05.

```text
Create a hand-written SQL migration in apps/api/prisma/sql/, applied by a script after prisma migrate and tracked so it is idempotent. It must: (1) enable btree_gist, pg_trgm, citext; (2) add the appointments_no_overlap exclusion constraint (doctor_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&, WHERE status IN ('SCHEDULED','CONFIRMED')); (3) add the users role/organisation CHECK; (4) add the trigram index on patients.full_name; (5) for every table with organisation_id, ENABLE and FORCE row level security and create a tenant_isolation policy using current_setting('app.org_id', true) or app.platform = 'on', generated from one list; (6) create roles app_owner (migrations) and app_user (API: no BYPASSRLS, not owner, INSERT and SELECT only on audit_logs).

Testcontainers tests connecting as app_user must prove: with app.org_id = A no row of B is visible or insertable on any tenant table; with no setting, zero rows; two concurrent overlapping appointment inserts leave exactly one; UPDATE and DELETE on audit_logs fail. Add a script that fails CI if any table with organisation_id has no policy.

Done when: all four tests and the policy-coverage script pass.
```

### M1-07 Tenant-scoped Prisma client (Dev 1, 4h)

Skills: tenant-security-phi, database-prisma-postgres. Blocked by: M1-06.

```text
Implement application-level tenant isolation. apps/api/src/db/tenantClient.ts exports withTenant(ctx, fn): opens an interactive Prisma transaction, runs set_config('app.org_id', ctx.organisationId, true) (and app.platform = 'on' only for platform roles), and passes fn a Prisma client extension that injects organisation_id into where and data for every model that has it and throws if no tenant context exists. Middleware wraps each authenticated request in withTenant and stores the client in request context. Add an ESLint no-restricted-imports rule so @prisma/client is imported only in src/**/repositories and src/db. Replace the pg readiness probe in health.service.ts with a repository call. Add asSystem(reason, fn) for voice, webhook, job and login paths, where the organisation is resolved explicitly; every use writes an audit entry.

Tests (table-driven over every repository method): a user from org A gets NotFound (not Forbidden) for org B ids on get, update and delete; a foreign organisationId in a request body is ignored or rejected.

Done when: tests pass, and one test with the extension disabled still shows row-level security blocking cross-tenant access.
```

### M1-08 Authentication and device pairing (Dev 1, 5h)

Skills: tenant-security-phi, backend-api-standards, testing-quality-gates. Blocked by: M1-07.

```text
Implement apps/api/src/modules/auth: POST /api/v1/auth/login, /refresh, /logout, /change-password and GET /me. Passwords with argon2id, minimum 12 characters, lockout for 15 minutes after 5 failures, login rate-limited per IP and per email, same response time for unknown email. Access JWT (jose) valid 15 minutes carrying sub, org, role. Refresh token: opaque 256-bit random, stored hashed, httpOnly Secure SameSite=Lax cookie, 14 days, rotated on every use, reuse of an old token revokes the whole family. must_change_password flag for admin-set temporary passwords. Login and refresh run through asSystem. Add requireAuth and requireDevice middleware. Pairing: POST /api/v1/devices/pairing-codes (owner or manager; 6 characters, 10 minutes, single use) and POST /api/v1/devices/pair, which exchanges the code for a device token (stored hashed) that can only call forwarding endpoints. Audit login success and failure, logout, password change, token reuse and device pairing. Replace the matching stubs and regenerate the client.

Tests: happy path, wrong password, lockout, expired/rotated/reused refresh tokens, tampered JWT, deactivated user fails at next refresh, device token cannot call user endpoints and the reverse.

Done when: all pass and no password or token appears in captured logs.
```

### M1-09 Permissions matrix and support sessions (Dev 1, 4h)

Skills: tenant-security-phi. Blocked by: M1-08.

```text
Create packages/shared/src/permissions.ts: a typed matrix of role x resource x action taken from the Roles and permissions table in the plan document (paste the table here). The API checks it with requirePermission(resource, action) in the service layer; frontends use it only to hide UI. Add data-scope rules: a doctor sees only their own appointments and the patients on them; staff access to recordings depends on an organisation setting; platform roles get patient fields (name, phone, dob, notes) nulled unless a support session is active. Add POST /api/v1/support-sessions { organisationId, reason } for platform roles, creating a 60-minute audited grant.

Generate one test per matrix cell from the same matrix so the table and tests cannot drift, plus tests for the data-scope rules.

Done when: changing a single cell in the matrix fails exactly one generated test, and all tests pass.
```

### M1-10 Audit log (Dev 1, 3h)

Skills: tenant-security-phi. Blocked by: M1-08.

```text
Build apps/api/src/modules/audit: audit.record({ action, entityType, entityId, metadata }) reads actor, role, organisation, IP, user agent and request ID from context and writes inside the current transaction. Never store patient field values; store IDs and changed field names only. Add GET /api/v1/audit-logs (cursor pagination; filters actor, action, entity, date) governed by the permission matrix. Add an auditRead(entityType) wrapper for read endpoints on patients, prescriptions and recordings, and a test that fails if any route flagged sensitivity: 'phi' does not call the audit module.

Done when: tests pass and an audit row exists for each flagged route in an integration run.
```

### M1-11 Organisation, user, phone number and voice-agent APIs (Dev 1, 5h)

Skills: backend-api-standards, tenant-security-phi. Blocked by: M1-09, M1-10.

```text
Implement under /api/v1/admin (platform roles) and /api/v1/org (clinic roles): organisations (create with an owner user and a one-time temporary password, list and search, update, activate and deactivate); platform users (super admin only); clinic users (owner manages, manager reads, clinic roles only, deactivate instead of delete, cannot remove the last owner); phone numbers (E.164 via libphonenumber-js, agent number globally unique); Sarvam voice-agent mapping (organisation, external agent ID, agent number, config validated by schema, status); GET /api/v1/admin/overview with organisation counts by status. Deactivating an organisation blocks its logins and its voice tool calls. Each endpoint has zod schemas, permission check, audit and isolation tests. Replace the matching stubs from M1-03 and regenerate the client.

Done when: an integration test onboards a clinic, logs in as its owner, and a deactivated organisation's users receive 403 on their next request.
```

### M1-12 Foundation review in a fresh session (Dev 1 plus a reviewer, 2h)

Skills: code-review-checklist. Blocked by: M1-11. Run in a new Claude Code session, not the one that wrote the code.

```text
Use the code-review-checklist skill. Review the diff between main and <branch> for the whole foundation (M1-02 to M1-11). Report a table: severity, file:line, issue, concrete failure scenario, suggested fix. Do not edit code. State what you could not verify.

Done when: no open Blocker or High finding; Medium findings have tickets.
```

### M1-13 CI follow-ups (Dev 1, 2h)

Skills: release-readiness, testing-quality-gates. Blocked by: M1-06.

```text
Extend CI and pnpm check: (1) enforce coverage floors from CLAUDE.md (90% lines for auth, tenancy, permissions, booking, webhooks; 80% elsewhere in apps/api) using per-path thresholds; (2) add format:check to CI; (3) add a CI job that applies all migrations to an empty PostgreSQL 16, runs the SQL migration, and runs the policy-coverage script; (4) cache pnpm and turbo. Keep the pnpm audit step at high.

Done when: a PR that lowers coverage below a floor, adds an unformatted file, or adds a tenant table without a policy fails CI.
```

---

# M2: Clinic core backend (Days 3 to 4)

**Goal:** doctors, services, availability, patients and appointments work through the API with no double booking. **Owner:** Dev 1. Needs M1 closed.

- [ ] **M2-01** Doctors, working hours, time off, services, clinic hours APIs
- [ ] **M2-02** Availability engine and endpoint
- [ ] **M2-03** Patients API: search, phone matching, merge
- [ ] **M2-04** Appointments API: book, reschedule, cancel, status machine
- [ ] **M2-05** Calendar read endpoints
- [ ] **M2-06** Performance seed script (realistic volume)

### Gate M2

- [ ] `pnpm check` passes; coverage floors met for booking code
- [ ] Concurrency test: two simultaneous bookings of one slot give one success and one 409
- [ ] Availability tests pass including DST, buffers, time off and `[start, end)` boundaries
- [ ] Permission and tenant-isolation tests extended for every new endpoint
- [ ] Idempotency test: replaying a create with the same `Idempotency-Key` returns the original result
- [ ] On seeded volume (M2-06), availability and calendar queries meet budget (see performance-optimisation skill); `EXPLAIN` output saved in the PR
- [ ] OpenAPI stubs for these modules replaced by real routes; client regenerated
- [ ] Tagged `m2-done`, retro held

## M2 tickets

### M2-01 Doctors, working hours, time off, services, clinic hours (Dev 1, 4h)

Skills: backend-api-standards, database-prisma-postgres.

```text
Implement modules doctors (CRUD, weekly working hours, time off), services (CRUD, duration, buffer), doctor-services links and clinic hours under /api/v1. Permissions follow the matrix (Owner and Manager write, Doctor and Staff read). Validate: working-hour ranges within a day must not overlap, minutes from midnight in the clinic timezone, end after start, time off end after start. Audit writes. Repositories use the tenant client only. Replace the OpenAPI stubs and regenerate the client.

Done when: CRUD tests pass per role, cross-tenant tests return 404, invalid ranges return 400 with field errors.
```

### M2-02 Availability engine and endpoint (Dev 1, 5h)

Skills: backend-api-standards, performance-optimisation, testing-quality-gates. Blocked by: M2-01.

```text
Build a pure availability function and GET /api/v1/availability?doctorId&serviceId&from&to. Slots = clinic hours intersect doctor working hours, minus time off, minus active appointments (SCHEDULED, CONFIRMED), sized by service duration plus buffer, computed in the clinic timezone including DST changes and returned as UTC. Use one query window (no per-day loops). Booking window limits and a minimum notice come from organisation settings. Unit-test the pure function heavily (DST day, back-to-back slots, buffer, time off at the edges, a service longer than the gap).

Done when: unit and integration tests pass; p95 under 150 ms on seeded volume (M2-06) for a 7-day range, with EXPLAIN attached.
```

### M2-03 Patients API: search, phone matching, merge (Dev 1, 4h)

Skills: backend-api-standards, tenant-security-phi.

```text
Implement patients: create, update, get, list with cursor pagination, search by name (trigram) and phone, soft delete. Normalise phones to E.164 with libphonenumber-js using the clinic's default country. Phone is not unique: add a duplicate-hint endpoint (same phone, similar name, same date of birth) and a merge endpoint (Manager, Staff, Owner) that moves appointments, calls, prescriptions and follow-ups to the surviving patient in one transaction and audits it. Doctors can read only patients on their own appointments. All reads and writes are flagged sensitivity: phi and audited; logs contain IDs only.

Done when: tests cover search, phone formats, duplicates, merge atomicity (failure leaves nothing moved), doctor scope, platform-role masking and audit rows.
```

### M2-04 Appointments API: book, reschedule, cancel, status machine (Dev 1, 6h)

Skills: backend-api-standards, database-prisma-postgres, testing-quality-gates. Blocked by: M2-02, M2-03.

```text
Implement appointments: create, get, list, reschedule (creates the new appointment linked via rescheduled_from_id and cancels the old one in one transaction), cancel (with reason), and a status state machine (SCHEDULED to CONFIRMED to COMPLETED, NO_SHOW or CANCELLED; reject invalid transitions with 409). Create re-validates the slot inside the transaction and relies on the appointments_no_overlap constraint; map the exclusion violation to 409 and include up to 3 alternative slots in the response. Accept Idempotency-Key (unique per organisation) and return the original result on replay. Source is DASHBOARD or VOICE_AGENT. Doctors see and update only their own appointments. Audit all changes.

Done when: a concurrency test (parallel bookings of one slot) yields one success and the rest 409; idempotent replay test passes; invalid transitions rejected; permission and cross-tenant tests pass.
```

### M2-05 Calendar read endpoints (Dev 1, 3h)

Skills: performance-optimisation, database-prisma-postgres. Blocked by: M2-04.

```text
Add GET /api/v1/calendar?from&to&doctorId&status returning lightweight appointment DTOs (id, start, end, status, doctor, patient display name, service) for a visible range, capped at 31 days, ordered and indexed (organisation_id, doctor_id, start_at). Patient names are included only for roles allowed to see them. No N+1.

Done when: EXPLAIN (ANALYZE, BUFFERS) on seeded volume shows an index scan and p95 under 150 ms; tests cover range limits, filters and masking.
```

### M2-06 Performance seed script (Dev 1, 2h)

Skills: database-prisma-postgres, performance-optimisation.

```text
Create a dev-only script (pnpm db:seed:perf) that generates synthetic data: 20 clinics, 50,000 patients and 500,000 appointments spread over 18 months, plus doctors, services and working hours. Faker-style synthetic names only; refuse to run unless DATABASE_URL points at localhost. Document how to run it and how to reset.

Done when: the script runs in a few minutes locally, is idempotent per run label, and refuses non-local databases.
```

---

# M3: Voice integration, Sarvam (Days 5 to 6)

**Goal:** a real phone call to a Sarvam agent can look up a patient, check availability and book, reschedule or cancel; call data and recordings are stored. **Owner:** Dev 1 (Dev 3 for the simulator). Needs M2 closed and M0-04 done.

- [ ] **M3-01** Write the verified Sarvam contract document
- [ ] **M3-02** VoiceProvider interface and Sarvam adapter
- [ ] **M3-03** Tool endpoints for the agent
- [ ] **M3-04** Job framework (pg-boss) and worker process
- [ ] **M3-05** Webhook inbox and processing
- [ ] **M3-06** Call processing and linking
- [ ] **M3-07** Recordings and transcripts to private storage
- [ ] **M3-08** Sarvam simulator for tests (Dev 3)
- [ ] **M3-09** Live test with a real Sarvam agent on staging

### Gate M3 (Gate 3)

- [ ] `pnpm check` passes; coverage floors met for webhooks
- [ ] Signature failure rejected; the same webhook event delivered twice has one effect; out-of-order events handled
- [ ] Simulator runs a full call lifecycle: lookup, availability, book, reschedule, cancel, call ended, recording fetched
- [ ] Tool endpoints p95 under 400 ms at 20 concurrent calls (load script output saved)
- [ ] Deactivated or unknown organisation gets a neutral failure message and an alert
- [ ] A real call on staging books an appointment that appears in the calendar API
- [ ] No patient data in logs for any voice path (redaction test)
- [ ] `docs/voice/sarvam-contract.md` updated with what was observed on the live test
- [ ] Tagged `m3-done`, retro held

## M3 tickets

### M3-01 Verified Sarvam contract document (Dev 1, 2h)

Skills: sarvam-voice-integration. Blocked by: M0-04.

```text
I will paste Sarvam's official documentation and sample payloads below. Create docs/voice/sarvam-contract.md containing only what is in them: authentication and signature scheme, tool-call request and response format, webhook event types and payloads, outbound call API, how recordings and transcripts are retrieved, rate limits, retries and timeouts, and a list of open questions. Mark anything not stated as UNKNOWN. Do not invent endpoints or fields and write no code.

Done when: every item above is present or marked UNKNOWN, and I have resolved the open questions with Sarvam before M3-02.
```

### M3-02 VoiceProvider interface and Sarvam adapter (Dev 1, 5h)

Skills: sarvam-voice-integration. Blocked by: M3-01.

```text
Create apps/api/src/voice with the VoiceProvider interface (verifyAndParseWebhook to a normalised CallEvent, placeOutboundCall, fetchRecording, fetchTranscript, syncAgentConfig) and normalised types. Implement providers/sarvam strictly from docs/voice/sarvam-contract.md. Contract tests use recorded sample payloads stored as fixtures (synthetic or scrubbed). Core code must import only the interface. Provider timeouts and errors map to typed errors.

Done when: contract tests pass for every documented event type and for a bad signature; nothing outside providers/sarvam knows Sarvam payload shapes.
```

### M3-03 Tool endpoints for the agent (Dev 1, 6h)

Skills: sarvam-voice-integration, backend-api-standards, performance-optimisation. Blocked by: M3-02, M2-04.

```text
Implement /voice/tools/lookup-patient, check-availability, book, reschedule, cancel and clinic-info, authenticated by the provider secret or signature as in the contract. Resolve the organisation from the agent ID or dialled number via asSystem; a deactivated or unknown organisation returns a neutral failure message and raises an alert. Responses are { ok, message, data } where message is one short sentence the agent can speak and contains no patient data beyond what the caller supplied. Idempotency key = provider call ID + tool call ID. A booking conflict returns a spoken alternative. No external calls inside these handlers. Unsafe or unsupported requests return a message telling the agent to offer a callback; the agent never decides anything clinical.

Done when: tests cover each tool, idempotent replay, conflict with alternatives, unknown agent, deactivated organisation, malformed input; load script shows p95 under 400 ms at 20 concurrent calls.
```

### M3-04 Job framework (pg-boss) and worker process (Dev 1, 4h)

Skills: backend-api-standards, sarvam-voice-integration. Blocked by: M1-07.

```text
Install pg-boss 12.x and verify it against PostgreSQL 16 and the restricted app_user role (it needs its own schema; document the grants). Create apps/api/src/jobs: queue registry, typed job payloads validated with zod, a worker entrypoint (separate command from the API, same image), retry with exponential backoff and jitter, dead-letter handling, singleton keys for deduplication, graceful shutdown, structured logging with job id. Jobs that act for a clinic run through asSystem with the organisation in the payload. Add a failed-job listing function for the admin monitoring page.

Done when: tests prove retries, dedupe by key, a job survives a worker restart, and shutdown waits for in-flight jobs.
```

### M3-05 Webhook inbox and processing (Dev 1, 4h)

Skills: sarvam-voice-integration, tenant-security-phi. Blocked by: M3-02, M3-04.

```text
Implement POST /voice/webhooks/sarvam: verify the signature on the raw body before parsing, insert into webhook_events (unique provider + external_event_id; a duplicate returns 200 immediately), enqueue a processing job, and respond in under 1 second. The processing job parses via the adapter, handles events idempotently and out of order, records status, attempts and error, and never logs payload contents. Failed events are visible to platform admins and can be re-queued by a platform role (audited).

Done when: tests cover bad signature (401, nothing stored), duplicate delivery, out-of-order events, processing failure and retry, and re-queue.
```

### M3-06 Call processing and linking (Dev 1, 4h)

Skills: sarvam-voice-integration, database-prisma-postgres. Blocked by: M3-05.

```text
On call events create and update calls: direction, status, from, to, started_at, ended_at, duration, outcome, cost. Link the caller to a patient by normalised phone when exactly one patient matches, otherwise leave unlinked; link appointments created or changed by the call. Expose GET /api/v1/calls (filters, cursor pagination) and GET /api/v1/calls/:id per the permission matrix, with audit on detail reads. Missed and abandoned calls are recorded too.

Done when: tests cover a normal call, missed call, unmatched number, two patients on one number, appointment linking and permissions per role.
```

### M3-07 Recordings and transcripts to private storage (Dev 1, 4h)

Skills: sarvam-voice-integration, tenant-security-phi. Blocked by: M3-06.

```text
Add a job that fetches the recording and transcript after a call ends, copies the recording to private S3 (server-side encryption, key per organisation and call), and stores the object key, not a URL. GET /api/v1/calls/:id/recording returns a 5-minute signed URL only for roles allowed by the matrix and the organisation's staff-access setting, and writes an audit row. Use @aws-sdk/client-s3 and verify against SeaweedFS locally (presigned URLs are unverified so far; record the result in STACK.md). Retry transient provider errors; a permanently missing recording marks the call, not the job, as failed.

Done when: tests cover success, retry, permanent failure, permission denied, expired URL behaviour and audit rows.
```

### M3-08 Sarvam simulator for tests (Dev 3, 4h)

Skills: sarvam-voice-integration, testing-quality-gates. Blocked by: M3-05.

```text
Build a test-only simulator (apps/api/test/sarvam-sim) that behaves like Sarvam per the contract: places a fake inbound call to an agent number, issues signed tool calls and signed webhook events with realistic timing, duplicates and out-of-order delivery on request. Add an end-to-end test that runs a full call (lookup, availability, book, reschedule, cancel, call ended, recording fetched) and a load script for 20 concurrent calls that prints p50, p95 and p99.

Done when: the e2e test and the load script run in CI-friendly form and the load output is saved in the PR.
```

### M3-09 Live test with a real Sarvam agent on staging (Dev 1 and Lead, 4h)

Skills: sarvam-voice-integration, release-readiness. Blocked by: M3-07 and a staging environment (M7-01 early part).

```text
Checklist, not a coding prompt: map a Sarvam test agent to the demo clinic in the admin API; place a real call; book, reschedule and cancel by voice; confirm the appointment in the calendar API, the call record, the recording and the transcript; deliberately test an unavailable slot, a cancelled-then-rebooked slot, and an unknown caller. Record exact payload differences from the contract in docs/voice/sarvam-contract.md and fix the adapter. Ask Claude Code only to update the adapter and fixtures from the observed payloads, after showing the diff.

Done when: a real call books an appointment end to end and the contract document matches reality.
```

---

# M4: Shared UI kit and Internal Admin Platform (starts right after M1-03; runs in parallel with M2 and M3)

**Goal:** platform staff can onboard and support clinics. **Owners:** Dev 2 (M4-01), Dev 3 (the rest). Start on the mock server; switch each screen to the real API when its backend ticket is merged.

- [ ] **M4-01** Shared UI kit (`packages/ui`) and design tokens (Dev 2)
- [ ] **M4-02** admin-web scaffold and app shell
- [ ] **M4-03** Admin sign-in, forced password change, session handling
- [ ] **M4-04** Clinics list and search
- [ ] **M4-05** Clinic onboarding wizard
- [ ] **M4-06** Clinic detail, edit, activate and deactivate
- [ ] **M4-07** Platform users and clinic users screens
- [ ] **M4-08** Support session flow and masked-data banner
- [ ] **M4-09** Backend: monitoring, usage and settings APIs
- [ ] **M4-10** Platform monitoring screens
- [ ] **M4-11** Usage and reporting screen
- [ ] **M4-12** Platform settings and audit log viewer

### Gate M4

- [ ] `pnpm check` passes for admin-web (typecheck, lint, tests, bundle budget)
- [ ] Playwright journey passes: sign in, onboard a clinic (clinic, owner, numbers, agent), sign in as that owner, deactivate the clinic, owner blocked
- [ ] Every screen shows loading, empty, error and no-permission states (checked in review)
- [ ] Axe accessibility scan has no serious issues on the main screens
- [ ] Support session: patient fields masked until a session starts, masked again after it ends
- [ ] No patient data in URLs, localStorage or Sentry payloads (grep and review)
- [ ] All screens use the real API, not the mock
- [ ] Tagged `m4-done`, retro held

## M4 tickets

### M4-01 Shared UI kit and design tokens (Dev 2, 6h)

Skills: ui-design-system, frontend-react-standards. Blocked by: M1-03.

```text
Create packages/ui (@openhours/ui) with the Tailwind 4 theme tokens and primitives from the ui-design-system skill: Button, Input, Select, Textarea, DatePicker, TimePicker, Checkbox, Switch, Table (sticky header, sort, pagination, empty state), Dialog, Drawer, ConfirmDialog, Toast, Badge, Tabs, Skeleton, EmptyState, PageHeader, StatCard, FormField (label, hint, error). Build on Radix primitives, typed props, keyboard accessible, AA contrast, no hard-coded hex values. Add a small component gallery (Vite page or Storybook) and tests for the interactive components. Update CLAUDE.md in apps/clinic-web and apps/admin-web so they point to packages/ui instead of components/ui. The product name is read from one config constant ("OpenHours").

Done when: both web apps import from @openhours/ui, tests pass, the gallery shows every component in every state, and an axe scan of the gallery has no serious issues.
```

### M4-02 admin-web scaffold and app shell (Dev 3, 3h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M1-03, M4-01 (can start with a minimal kit).

```text
Scaffold apps/admin-web: Vite, React 19, TypeScript strict, Tailwind 4 via @tailwindcss/vite, React Router, TanStack Query, @openhours/ui, @openhours/api-client pointed at the mock server by default (env switch to the real API). App shell: sidebar navigation (Clinics, Users, Monitoring, Usage, Settings, Audit), top bar with user menu, route-level lazy loading, error boundary, 404 and 403 pages, query client defaults, a bundle-size budget enforced in the build, Vitest + Testing Library + MSW set up with one test.

Done when: pnpm dev shows the shell against the mock, pnpm check passes for the app, and the bundle budget fails the build when exceeded.
```

### M4-03 Admin sign-in, forced password change, session handling (Dev 3, 4h)

Skills: frontend-react-standards, tenant-security-phi. Blocked by: M4-02 (real API after M1-08).

```text
Implement sign-in, forced password change (when must_change_password), sign-out and silent refresh. The access token lives in memory only; refresh uses the httpOnly cookie via the generated client; one in-flight refresh at a time; on refresh failure return to sign-in and keep the intended route. Route guards by role (only SUPER_ADMIN and INTERNAL_ADMIN). Show lockout and rate-limit messages from problem+json. Nothing sensitive in localStorage.

Done when: tests cover success, wrong password, lockout message, forced password change, expired session, guard redirect; manual check that no token is in storage.
```

### M4-04 Clinics list and search (Dev 3, 3h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M4-03.

```text
Build the Clinics list: server-side search and status filter, cursor pagination, columns (name, status, timezone, agent status, created), loading skeleton, empty state with a "Create clinic" action, row click to detail. Filters live in the URL.

Done when: tests cover loading, empty, error, pagination and search; works against the mock and the real API.
```

### M4-05 Clinic onboarding wizard (Dev 3, 6h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M4-04, M1-11.

```text
Build a 4-step wizard: (1) clinic details (name, timezone, address, contact), (2) owner user (name, email) with the one-time temporary password shown once with a copy button and a warning, (3) phone numbers (clinic line, agent number, E.164 validation from the shared schema), (4) Sarvam agent mapping (external agent ID, agent number, config) and review. Validate each step with the shared zod schemas, keep progress when navigating back, handle server errors per field (for example agent number already used), and make the final submit safe against double clicks.

Done when: tests cover each step's validation, back and forward navigation, server conflict errors and the one-time password display; the Playwright onboarding journey passes.
```

### M4-06 Clinic detail, edit, activate and deactivate (Dev 3, 4h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M4-05.

```text
Clinic detail page with tabs: Overview, Numbers and agent, Users, Activity. Edit clinic fields, add or remove numbers, update the agent mapping. Activate and deactivate use a ConfirmDialog that states the consequences (logins and voice calls stop) and requires typing the clinic name. Show the effective status clearly.

Done when: tests cover edit, validation errors, deactivation confirmation and a permission difference between SUPER_ADMIN and INTERNAL_ADMIN.
```

### M4-07 Platform users and clinic users screens (Dev 3, 4h)

Skills: frontend-react-standards. Blocked by: M4-04, M1-11.

```text
Platform users (SUPER_ADMIN only): list, create with temporary password, change role, deactivate. Clinic users per clinic (read and support actions): list, deactivate, reset password (new one-time password). Use the permission hook to hide controls; the API remains the control. Confirm destructive actions; prevent removing the last owner (surface the API error clearly).

Done when: tests cover each role's visible controls, create, deactivate, reset and the last-owner error.
```

### M4-08 Support session flow and masked-data banner (Dev 3, 4h)

Skills: tenant-security-phi, frontend-react-standards. Blocked by: M1-09.

```text
Implement "Start support session" for a clinic: requires a reason, calls POST /support-sessions, shows a persistent banner "Support session active for <clinic>, expires at <time>" with an End button. Patient fields are masked by default and unmasked only during an active session; on end or expiry clear cached query data for that clinic. Every unmasked view is audited by the API; the UI never stores unmasked data outside the query cache.

Done when: tests cover masked state, start with reason, banner countdown, manual end, expiry clearing cache, and a role without permission.
```

### M4-09 Backend: monitoring, usage and settings APIs (Dev 3, 6h)

Skills: backend-api-standards, database-prisma-postgres, tenant-security-phi. Blocked by: M3-04, M3-05 (data sources). Can start with the parts that exist.

```text
In apps/api add platform-role endpoints: GET /api/v1/admin/monitoring (failed webhooks with request IDs and reasons, failed or stuck jobs from pg-boss, integration status per clinic's agent, recent 5xx counts), POST re-queue for a failed webhook event or job (audited), GET /api/v1/admin/usage (per clinic and date range: call count, answered, missed, total minutes, cost, bookings by source; aggregated in SQL), and a platform settings module (key-value settings validated per key; supported provider settings; changes audited, SUPER_ADMIN only). Metadata only; no patient data in any response. Replace stubs and regenerate the client.

Done when: tests cover permissions (platform roles only), aggregation correctness on seeded data, re-queue idempotency and audit rows; usage query meets the performance budget on seeded volume.
```

### M4-10 Platform monitoring screens (Dev 3, 4h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M4-09.

```text
Monitoring page: integration health per clinic (agent status), tables of failed webhooks and failed jobs with timestamp, clinic, reason, attempts and request ID (copy button), filters, re-queue action with confirmation, auto-refresh every 30 seconds with a visible last-updated time. Empty state says "No failures in the selected period".

Done when: tests cover loading, empty, error, re-queue success and failure, and polling behaviour.
```

### M4-11 Usage and reporting screen (Dev 3, 4h)

Skills: frontend-react-standards, ui-design-system, dataviz skill if available. Blocked by: M4-09.

```text
Usage page: date-range picker, per-clinic table (calls, answered, missed, minutes, cost, bookings), totals row, simple trend chart (calls per day), CSV export of the table. Charts must be accessible (labels, not colour alone). Numbers formatted consistently; cost in the right currency from settings.

Done when: tests cover range changes, totals, empty data and export content.
```

### M4-12 Platform settings and audit log viewer (Dev 3, 4h)

Skills: frontend-react-standards, tenant-security-phi. Blocked by: M4-09, M1-10.

```text
Settings page for global configuration (provider settings, feature flags defined by the API), SUPER_ADMIN edit and INTERNAL_ADMIN read, with a change confirmation. Audit viewer: filters (actor, action, entity, date range), cursor pagination, expandable row showing metadata (IDs only).

Done when: tests cover permissions, validation errors from the API, filters and pagination.
```

---

# M5: Clinic dashboard core (parallel with M2 and M3)

**Goal:** a clinic can run its day: doctors, patients, appointments, calendar, calls, recordings, settings, staff. **Owner:** Dev 2. Start on the mock; switch to the real API as M2 and M3 tickets merge.

- [ ] **M5-01** clinic-web scaffold, app shell, role-aware navigation
- [ ] **M5-02** Sign-in, forced password change, session handling
- [ ] **M5-03** Doctors, services and hours
- [ ] **M5-04** Patients: list, search, detail, create, edit, merge
- [ ] **M5-05** Appointments: create, reschedule, cancel, list
- [ ] **M5-06** Calendar (day and week by doctor)
- [ ] **M5-07** Call history and call detail
- [ ] **M5-08** Recordings and transcripts viewer
- [ ] **M5-09** Clinic settings
- [ ] **M5-10** Staff and roles management
- [ ] **M5-11** Dashboard home

### Gate M5

- [ ] `pnpm check` passes for clinic-web (typecheck, lint, tests, bundle budget)
- [ ] Playwright journeys pass: sign in; create a patient; book, reschedule and cancel an appointment; double-booking attempt shows the conflict with alternatives; view call history and open a recording as Owner; Staff cannot open a recording when the setting is off
- [ ] Each role (Owner, Manager, Doctor, Staff) sees only permitted navigation and actions; the API rejects the rest (verified by a test that calls the API directly)
- [ ] Calendar renders a busy week (200+ appointments) smoothly and fetches only the visible range
- [ ] Times shown in the clinic timezone; a test around a DST change passes
- [ ] Axe scan has no serious issues; keyboard-only run through booking works
- [ ] All screens use the real API
- [ ] Tagged `m5-done`, retro held

## M5 tickets

### M5-01 clinic-web scaffold, app shell, role-aware navigation (Dev 2, 4h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M1-03, M4-01.

```text
Scaffold apps/clinic-web with the same stack as admin-web (Vite, React 19, TS strict, Tailwind 4, React Router, TanStack Query, @openhours/ui, @openhours/api-client on the mock by default). Build the shell: sidebar (Dashboard, Calendar, Appointments, Patients, Doctors and services, Calls, Prescriptions, Follow-ups, Analytics, Settings) filtered by role using useCan from packages/shared, top bar with notification placeholder and user menu, clinic name from organisation settings, timezone helper module (one place for formatting and converting times), route-level lazy loading, error boundary, 403 and 404 pages, bundle budget, Vitest + Testing Library + MSW.

Done when: the shell renders per role against the mock, the timezone helper has DST tests, and pnpm check passes.
```

### M5-02 Sign-in, forced password change, session handling (Dev 2, 3h)

Skills: frontend-react-standards, tenant-security-phi. Blocked by: M5-01.

```text
Same behaviour as M4-03 for clinic roles: sign-in, forced password change, silent refresh with a single in-flight refresh, token in memory only, lockout and rate-limit messages, post-login redirect to the intended route, role-based landing page (Doctor lands on their schedule).

Done when: tests cover success, failure, lockout, forced change, session expiry and landing per role.
```

### M5-03 Doctors, services and hours (Dev 2, 6h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M5-02, M2-01.

```text
Screens: doctors list and profile (name, speciality, active, linked login), weekly working-hours editor (multiple ranges per day, validation of overlaps, copy-to-days), time-off list and dialog, services list and form (duration, buffer, active), doctor-service assignment, clinic operating hours. Owner and Manager edit; Doctor and Staff read. Show server validation errors on the right field.

Done when: tests cover editing hours with overlap errors, time off, service duration changes, role permissions and loading, empty and error states.
```

### M5-04 Patients (Dev 2, 6h)

Skills: frontend-react-standards, ui-design-system, tenant-security-phi. Blocked by: M5-02, M2-03.

```text
Patients list with server-side search (name or phone), cursor pagination and masked phone in the list for roles without need; patient detail with tabs (Overview, Appointments, Calls, Prescriptions, Follow-ups; later tabs show "coming soon" until their milestone); create and edit forms (phone normalisation and validation from shared schema, date of birth, notes); duplicate hint banner and a merge dialog with a clear preview and confirmation. No patient data in URLs (use IDs).

Done when: tests cover search, create with duplicate hint, merge flow, role differences (Doctor sees only their own patients) and all four view states.
```

### M5-05 Appointments (Dev 2, 8h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M5-03, M5-04, M2-04.

```text
Appointments list (filters: date range, doctor, status, patient; pagination) and a booking dialog: choose patient (search or create inline), service, doctor, date, then pick from the slots returned by the availability endpoint; submit with an Idempotency-Key generated once per dialog open; on 409 show the conflict and the alternative slots returned by the API. Reschedule and cancel dialogs (cancel requires a reason; confirm). Status changes (confirm, complete, no-show) with valid transitions only. Optimistic updates only for status changes with rollback.

Done when: tests cover booking happy path, conflict with alternatives, double-submit protection, reschedule, cancel with reason, invalid transitions hidden, and permissions per role.
```

### M5-06 Calendar (Dev 2, 8h)

Skills: frontend-react-standards, ui-design-system, performance-optimisation. Blocked by: M5-05, M2-05.

```text
Day and week calendar by doctor (doctor columns in day view, doctor filter in week view), colour by status with an icon or label as well, working hours and time off shown as shaded areas, current-time line, click an empty slot to open the booking dialog prefilled, click an appointment to open its drawer with actions. Fetch only the visible range from the calendar endpoint and keep previous data while navigating. Drag to reschedule only if the server confirms (show a pending state, revert on 409). Keyboard accessible alternative to drag. Virtualise if a day has many items.

Done when: tests cover range fetching, shading, slot click, drawer actions, drag then success and drag then conflict revert; a 200-appointment week renders without jank (note the measurement in the PR).
```

### M5-07 Call history and call detail (Dev 2, 5h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M5-02, M3-06.

```text
Call history list (direction, status, time, duration, linked patient, outcome) with filters (date range, status, direction, linked or unlinked) and pagination. Call detail drawer or page: metadata, linked patient (link or unlink for staff), related appointment activity, recording and transcript sections (rendered in M5-08). Missed calls are visually clear with a "create follow-up" shortcut (the action is wired in M6-08). Phone numbers masked according to role.

Done when: tests cover filters, unlinked caller, linked patient, permissions and all four view states.
```

### M5-08 Recordings and transcripts viewer (Dev 2, 4h)

Skills: frontend-react-standards, tenant-security-phi. Blocked by: M5-07, M3-07.

```text
In call detail add a recording player that requests a signed URL only when the user presses play (never autoplay), with loading and expiry handling (refetch on expiry), and a transcript viewer (speaker turns, copy, search within). Show a clear message when the role or the clinic setting does not allow access (403 from the API) and when no recording exists. Never store the signed URL beyond the component lifetime and never log it.

Done when: tests cover play, expired URL refetch, 403 message, no recording, transcript search; manual check that the URL is not persisted.
```

### M5-09 Clinic settings (Dev 2, 5h)

Skills: frontend-react-standards. Blocked by: M5-02, M1-11.

```text
Settings with tabs: Profile (name, address, contact), Hours and timezone, Booking rules (minimum notice, booking window, default buffer), Agent (greeting text and clinic-level options exposed by the API; the call-recording consent line shown but not removable), Recordings (retention days within allowed bounds, staff access toggle), Notifications (preferences). Owner edits; Manager reads. Warn before changing timezone and explain the effect on existing appointments.

Done when: tests cover each tab's validation, permission differences, timezone warning and unsaved-changes prompt.
```

### M5-10 Staff and roles management (Dev 2, 4h)

Skills: frontend-react-standards, tenant-security-phi. Blocked by: M5-02, M1-11.

```text
Owner-only staff screen: list users, invite or create with a role (Manager, Doctor, Staff), temporary password shown once, link a Doctor user to a doctor profile, change role, deactivate. Prevent removing the last Owner (show the API error). Explain each role in a short tooltip using the permission matrix.

Done when: tests cover create, role change, deactivation, last-owner protection and the Owner-only guard.
```

### M5-11 Dashboard home (Dev 2, 4h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M5-06, M5-07 (follow-up and reminder cards fill in during M6).

```text
Home page: today's appointments (next first), recent calls with missed ones highlighted, quick actions (book, add patient), and placeholders for pending follow-ups and failed reminders that are filled in M6. One query per card, each with its own loading and error state so one failure never blanks the page. Doctor sees only their own schedule.

Done when: tests cover per-card states, role differences and links into the relevant screens.
```

---

# M6: Clinical records and automation (Days 7 to 8)

**Goal:** prescriptions, follow-ups, reminder calls, notifications and analytics. **Owners:** Dev 2 (prescriptions, follow-ups, notifications and their screens), Dev 1 (reminders, retention), Dev 3 (analytics). Needs M2 and M3 closed.

- [ ] **M6-01** Prescriptions API (Dev 2)
- [ ] **M6-02** Follow-ups API (Dev 2)
- [ ] **M6-03** Notifications module (Dev 2)
- [ ] **M6-04** Reminder scheduler and outbound calls (Dev 1)
- [ ] **M6-05** Analytics endpoints, 8 metrics (Dev 3)
- [ ] **M6-06** Retention job and consent settings (Dev 1)
- [ ] **M6-07** Prescriptions screens (Dev 2)
- [ ] **M6-08** Follow-ups screens (Dev 2)
- [ ] **M6-09** Reminder settings and execution status screens (Dev 2)
- [ ] **M6-10** Notifications screens (Dev 2)
- [ ] **M6-11** Analytics screens (Dev 2 or Dev 3)

### Gate M6 (Gate 4, feature freeze for everything except mobile)

- [ ] `pnpm check` passes across the repo
- [ ] Prescriptions: only Doctor creates and edits; Owner reads; Staff and Manager get 403; every read and write is audited (tests)
- [ ] Reminder jobs: no duplicate call when the worker restarts mid-run, when an appointment is cancelled or rescheduled (pending reminders cancelled), or when the same job is enqueued twice (tests)
- [ ] Outbound rules enforced: calling window, maximum 2 attempts, daily cap (tests with a fake clock)
- [ ] Retention job deletes expired recordings and leaves audit rows
- [ ] Analytics match hand-computed numbers on a seeded dataset (test), and respond within budget on seeded volume
- [ ] Notifications created for upcoming appointments, overdue follow-ups, failed reminders and read state works
- [ ] Playwright journeys pass: doctor writes a prescription; staff creates and completes a follow-up; failed reminder shows a notification
- [ ] No unfinished scope-document feature except forwarding and mobile (M8); cut list from the plan applied only with sign-off
- [ ] Tagged `m6-done`, retro held

## M6 tickets

### M6-01 Prescriptions API (Dev 2, 5h)

Skills: backend-api-standards, tenant-security-phi, database-prisma-postgres. Blocked by: M2-04.

```text
Implement prescriptions with items (drug, dose, frequency, duration, instructions) linked to a patient, optionally an appointment, and the issuing doctor. Create and update only by a Doctor (own prescriptions); Owner read; others denied. Statuses DRAFT, ISSUED, CANCELLED; an issued prescription is immutable except cancellation with a reason (corrections are a new prescription). All reads and writes are sensitivity: phi and audited; logs contain IDs only. No AI authorship: the voice agent has no access to these endpoints. Replace stubs and regenerate the client.

Done when: tests cover each role, immutability after issue, cancellation, cross-tenant, audit rows and doctor scope.
```

### M6-02 Follow-ups API (Dev 2, 4h)

Skills: backend-api-standards. Blocked by: M2-04.

```text
Implement follow-ups: create (patient, optional appointment, type, notes, due date, assignee, optional call_enabled), update, assign, complete, cancel, list with filters (status, assignee, overdue, due range). Overdue is computed from the clinic timezone. Owner, Manager, Staff and Doctor can act per the matrix; Staff on assigned items. Creating a follow-up from a missed call is supported via an optional call id. Audit changes.

Done when: tests cover transitions, overdue calculation across timezones, assignee scope, permissions and cross-tenant.
```

### M6-03 Notifications module (Dev 2, 4h)

Skills: backend-api-standards. Blocked by: M6-02.

```text
Implement in-app notifications: model, GET list (unread filter, cursor), mark read and mark all read, unread count endpoint. Producers (called from services or jobs, never from controllers): appointment starting soon (scheduled job), follow-up due or overdue, reminder call failed, recording fetch failed. Notifications target a user or a role in the organisation, never contain patient names (use ids and generic text such as "Follow-up overdue"), and are deduplicated by a key.

Done when: tests cover creation, dedupe, targeting, read state and tenant isolation.
```

### M6-04 Reminder scheduler and outbound calls (Dev 1, 8h)

Skills: sarvam-voice-integration, backend-api-standards, testing-quality-gates. Blocked by: M3-02, M3-04, M2-04.

```text
Implement outbound reminders and approved follow-up calls using outbound_calls and pg-boss. On appointment create or reschedule, schedule reminder(s) per clinic settings (for example 24 hours and 2 hours before) with a unique dedupe_key (target, kind, slot); cancel pending ones when the appointment is cancelled or moved. Rules: only inside the clinic calling window, at most 2 attempts with spacing, daily cap per clinic. State machine SCHEDULED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED: claim the row transactionally before calling, store the provider call id, reconcile through the webhook, retry transient failures with backoff, and treat a stale IN_PROGRESS as retryable only after checking the provider. Never call a patient twice for the same slot. Failed final attempts raise a notification. Follow-up calls only when call_enabled and the clinic setting allow it. The call script comes from the clinic's configured message; no clinical content.

Done when: tests with a fake clock cover window and cap rules, duplicate enqueue, worker restart mid-call, cancellation, reschedule, transient and permanent failure; a simulator run (M3-08) completes a reminder call.
```

### M6-05 Analytics endpoints, 8 metrics (Dev 3, 5h)

Skills: backend-api-standards, database-prisma-postgres, performance-optimisation. Blocked by: M3-06, M2-04.

```text
Implement GET /api/v1/analytics with date range and granularity: total calls, answered vs missed, average duration, bookings by source (voice vs dashboard), appointments by status, no-show rate, reminder success rate, pending and overdue follow-ups. Aggregate in SQL grouped by day in the clinic timezone; no row loading in Node; each metric returns the numerator and denominator. Doctor sees only own metrics. Range capped at 12 months.

Done when: a seeded dataset with known counts produces exactly the expected numbers (test), timezone day boundaries are correct, and each query meets the performance budget with EXPLAIN attached.
```

### M6-06 Retention job and consent settings (Dev 1, 4h)

Skills: tenant-security-phi, sarvam-voice-integration. Blocked by: M3-07.

```text
Add a daily job that deletes recordings (S3 objects and keys) and transcripts older than the clinic's recording_retention_days, with a dry-run mode and an audit entry per run (counts only). Enforce bounds on retention (minimum and maximum from platform settings). Ensure the agent greeting always includes the recording-consent line: the clinic cannot remove it; sync it to the Sarvam agent config on change and record the sync result.

Done when: tests cover expiry boundaries, dry run, partial S3 failure (retry later, no orphan keys), and the consent line cannot be removed via the API.
```

### M6-07 Prescriptions screens (Dev 2, 6h)

Skills: frontend-react-standards, ui-design-system, tenant-security-phi. Blocked by: M6-01, M5-04.

```text
Prescriptions list (Doctor: own; Owner: all), patient-tab view, and a form for a Doctor: patient and optional appointment, repeatable items (drug, dose, frequency, duration, instructions) with add and remove, notes, save as draft, issue (confirm dialog that says it becomes immutable), cancel with reason. Print-friendly view (browser print stylesheet) with clinic header and doctor name; no PDF library. Hide create and edit for other roles (API remains the control). Nothing sensitive in URLs or storage.

Done when: tests cover draft, issue, immutability in the UI, cancel, role differences and print view rendering.
```

### M6-08 Follow-ups screens (Dev 2, 5h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M6-02, M5-07.

```text
Follow-ups list with filters (status, assignee, overdue, due range), quick complete, create and edit dialog (patient, type, due date and time, assignee, notes, optional call toggle), and the "create follow-up" shortcut from a missed call (M5-07). Overdue items are clearly marked with an icon and text. Staff see assigned items by default. Fill the follow-up card on the dashboard home (M5-11).

Done when: tests cover creation from a call, completion, overdue display in the clinic timezone, permissions and view states.
```

### M6-09 Reminder settings and execution status screens (Dev 2, 4h)

Skills: frontend-react-standards. Blocked by: M6-04.

```text
Settings: enable reminders, reminder offsets, calling window, retry limit (within platform bounds), message text. Execution status: list of outbound calls (target, scheduled time, status, attempts, last error in plain language), filter by status, and a retry or cancel action where the API allows. Appointment drawer shows reminder status.

Done when: tests cover validation against bounds, status display, retry and cancel, and role permissions.
```

### M6-10 Notifications screens (Dev 2, 3h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M6-03.

```text
Bell icon with unread count (polled every 60 seconds and on focus), dropdown with the latest items, a full notifications page with filters and mark all read; each item links to its target screen. Accessible live-region announcement for new notifications without being intrusive.

Done when: tests cover count updates, read state, deep links and empty or error states.
```

### M6-11 Analytics screens (Dev 2 or Dev 3, 6h)

Skills: frontend-react-standards, ui-design-system, dataviz skill if available. Blocked by: M6-05.

```text
Analytics page with a date range and the 8 metrics: stat cards with the underlying numerator and denominator on hover, trend charts for calls and bookings, a breakdown for appointment statuses. Accessible charts (labels, patterns or icons, not colour alone), consistent colours across charts, CSV export. Doctor sees own metrics only. Handle empty ranges without NaN or broken charts.

Done when: tests cover each metric display against mocked API data, empty range, range change, export content and role difference.
```

---

# M7: Hardening, QA and deployment (Days 9 to 10)

**Goal:** the Definition of Done in the plan document is fully ticked. **Owners:** everyone; Dev 1 leads infrastructure. Infrastructure tickets M7-01 and M7-02 should start as early as M2 so staging exists for M3-09.

- [ ] **M7-01** Infrastructure as code: staging (AWS Mumbai)
- [ ] **M7-02** CI/CD to staging and production, migrations step, smoke tests, rollback
- [ ] **M7-03** Observability: error tracking, logs, alarms
- [ ] **M7-04** Security pass and full-repo review in a fresh session
- [ ] **M7-05** Load test of voice endpoints and key APIs
- [ ] **M7-06** End-to-end journeys (Playwright) in CI
- [ ] **M7-07** Backup and restore drill
- [ ] **M7-08** Runbook, documentation, handover
- [ ] **M7-09** Production deployment and go-live checklist

### Gate M7 (Gate 5, Definition of Done)

- [ ] Every box of the Definition of Done in the plan document ticked (copy the list into the PR)
- [ ] `pnpm check` and the full Playwright suite pass on staging
- [ ] Security review (M7-04) has no open Blocker or High findings
- [ ] Restore drill succeeded with recorded recovery point and time
- [ ] Alarms fire in a test and reach a human
- [ ] Sarvam production agent mapped to a real pilot clinic; one supervised live call completed
- [ ] Rollback tested once on staging
- [ ] Tagged `v1.0.0`, retro held

## M7 tickets

### M7-01 Infrastructure as code: staging (Dev 1, 8h)

Skills: release-readiness. Blocked by: M0-03.

```text
Write Terraform under infra/ for a staging environment in ap-south-1: VPC with private subnets, RDS PostgreSQL 16 (encrypted, automated backups with point-in-time recovery, private), ECS Fargate services for the API and the worker (same image, different command) behind an ALB with TLS, S3 private bucket for recordings (SSE, block public access, lifecycle), S3 + CloudFront for the two web apps on separate subdomains, Secrets Manager entries, CloudWatch log groups. Parameterise for staging and production. Do not run terraform apply; produce plan output and the exact commands for me to review and run.

Done when: terraform validate and plan succeed, no secret appears in the code or state outputs, and I have applied staging myself.
```

### M7-02 CI/CD to staging and production (Dev 1, 6h)

Skills: release-readiness. Blocked by: M7-01.

```text
Extend GitHub Actions: on merge to main build and push images, deploy to staging, run migrations as a separate pipeline step using the owner role before starting the new version (migrations must be backward compatible with the previous version), run smoke tests (health, ready, login, a booking through the API), then require manual approval for production and repeat. Automatic rollback when the health check fails. Use OIDC to AWS, no long-lived keys.

Done when: a merge deploys to staging end to end, a deliberately failing health check rolls back, and production deploy requires approval.
```

### M7-03 Observability (Dev 1, 4h)

Skills: release-readiness, tenant-security-phi. Blocked by: M7-01.

```text
Add Sentry to the API, worker and both web apps with PHI scrubbing (verify with a test event containing fake patient fields), request ID in every log line and in error reports, CloudWatch alarms and routing for: 5xx rate, p95 latency of voice tool endpoints, failed webhooks, failed or stuck jobs, queue depth, database CPU, connections and storage, certificate expiry.

Done when: a forced error appears in Sentry with no patient data; each alarm is triggered once in staging and reaches a human.
```

### M7-04 Security pass and full-repo review (all, 8h)

Skills: code-review-checklist, tenant-security-phi. Run in fresh sessions, one per area.

```text
Use the code-review-checklist skill on the whole repository, one session each for: (1) apps/api auth, tenancy, permissions and audit; (2) voice endpoints and webhooks; (3) database migrations and RLS; (4) clinic-web and admin-web (token handling, XSS, PHI exposure, CORS); (5) infrastructure. Then run: dependency audit, secret scan of the git history, a permission-matrix regression run, a cross-tenant fuzz over every route using two seeded clinics (every id from clinic A requested as clinic B must return 404), and header checks (CSP, HSTS, cookies). Report a table of findings with severity and fixes; do not edit code.

Done when: no open Blocker or High; Medium findings ticketed; the fuzz test is added to CI.
```

### M7-05 Load test of voice endpoints and key APIs (Dev 1 with Dev 3, 4h)

Skills: performance-optimisation. Blocked by: M3-08, M7-01.

```text
Using the simulator (M3-08) and a load tool (k6 or autocannon), run against staging: 20 concurrent calls on the tool endpoints, 50 concurrent dashboard users on calendar, patients and appointments, and a webhook burst of 200 events. Capture p50, p95, p99, error rate and database metrics, find and fix the top bottlenecks (indexes, N+1, pool size), and re-run. Save the before and after numbers in docs/perf.md.

Done when: voice tool p95 under 400 ms at 20 concurrent calls, dashboard reads p95 under 300 ms, zero errors in the burst.
```

### M7-06 End-to-end journeys in CI (Dev 2 and Dev 3, 6h)

Skills: testing-quality-gates. Blocked by: M5, M4.

```text
Create the Playwright suite (apps/e2e or per app) with a seeded environment: onboarding a clinic in admin and signing in as its owner; booking, rescheduling and cancelling with the conflict case; patient merge; call history and recording access by role; prescription by a doctor and denial for staff; follow-up lifecycle; reminder failure notification; support session masking. Run in CI against a docker-compose stack, with traces on failure and no flaky retries masking real failures.

Done when: the suite passes three times in a row in CI and runs on every PR in under 15 minutes.
```

### M7-07 Backup and restore drill (Dev 1, 3h)

Skills: release-readiness. Blocked by: M7-01.

```text
Document and perform a point-in-time restore of the staging database to a new instance, run the migration check and a read-only smoke test against it, and record the recovery point and recovery time achieved. Verify S3 versioning on the recordings bucket and test restoring a deleted object. Write the steps in docs/runbook.md.

Done when: the restore succeeded with measured recovery point of 15 minutes or less and recovery time of 4 hours or less, or the gap is documented with a plan.
```

### M7-08 Runbook, documentation, handover (Dev 1 and Lead, 4h)

Skills: release-readiness. Blocked by: M7-02.

```text
Write docs/runbook.md and docs/ARCHITECTURE.md: architecture overview, environment variables and secrets list, how to onboard a clinic, how to rotate secrets, how to restore a backup, how to handle a Sarvam outage and a stuck job queue, on-call checklist, how to roll back, how to add a migration safely. Add an ADR folder with the key decisions made (self-managed auth, RLS plus scoped client, pg-boss, SeaweedFS for local only, AWS Mumbai). Review for accuracy against the actual repository; mark anything you could not verify.

Done when: a developer who has not seen the project can follow the runbook to deploy staging and onboard a clinic.
```

### M7-09 Production deployment and go-live checklist (Lead and Dev 1, 4h)

Skills: release-readiness. Blocked by: all gates.

```text
Checklist, not a coding prompt: apply production infrastructure; rotate all secrets away from staging values; map the Sarvam production agent; confirm the recording-consent line; enable alarms and the on-call route; deploy through the pipeline with manual approval; run smoke tests; complete one supervised live call with the pilot clinic; verify backups and the retention job; announce the rollback plan and the support channel.

Done when: the pilot clinic completes a day on the platform and the Definition of Done is signed off.
```

---

# M8: Call forwarding and Android app (LOWEST PRIORITY, start only after M1 to M7 are closed)

**Goal:** an authorised clinic user schedules call forwarding from the dashboard, and an Android phone executes it and reports the result. **Owner:** Dev 3 (Dev 2 for the dashboard screen). The scope is only: prefilled agent number, forwarding schedules, manual on/off, status and errors. No patient data on the device. The Android stack (Kotlin or React Native) is decided in M8-03.

Note: pairing codes and the device token endpoints already exist from M1-08.

- [ ] **M8-01** Backend: forwarding schedules, events and device endpoints (Dev 3)
- [ ] **M8-02** Android feasibility spike on real devices and carriers (Dev 3)
- [ ] **M8-03** Decision: Android stack and carrier code configuration (Lead)
- [ ] **M8-04** Dashboard: forwarding schedules screen (Dev 2)
- [ ] **M8-05** Android app scaffold
- [ ] **M8-06** Pairing and secure token storage
- [ ] **M8-07** Schedule sync (push and polling)
- [ ] **M8-08** Forwarding execution engine (alarms and carrier codes)
- [ ] **M8-09** App screens: status, schedules, manual toggle
- [ ] **M8-10** Event reporting with offline queue
- [ ] **M8-11** Device and carrier matrix testing
- [ ] **M8-12** Internal distribution

### Gate M8

- [ ] Backend tests pass: schedule validation, version bump on change, device token limited to forwarding endpoints, events accepted idempotently
- [ ] `docs/android-compatibility-matrix.md` filled for every target device, Android version, carrier and SIM slot, with SUCCESS, FAILED or UNVERIFIED and notes; unsupported combinations documented
- [ ] A schedule created in the dashboard reaches a paired phone and activates and deactivates forwarding at the right minute on at least the agreed matrix, with events visible in the dashboard
- [ ] Manual on/off works; failures show a clear next step; the app never reports success when unverified
- [ ] Phone restart, timezone change, airplane mode and battery saver cases tested and documented
- [ ] ktlint, detekt and unit tests pass in CI; release build is signed
- [ ] Tagged `m8-done`, retro held

## M8 tickets

### M8-01 Backend: forwarding schedules, events and device endpoints (Dev 3, 5h)

Skills: backend-api-standards, tenant-security-phi. Blocked by: M1-08.

```text
Implement forwarding_schedules CRUD for Owner and Manager (days of week, start and end minute in the clinic timezone, active flag, version incremented on every change), GET /api/v1/device/schedules for the device token (returns the current schedules and version, supports If-None-Match style version check), POST /api/v1/device/events (idempotent by device event id: action ACTIVATE or DEACTIVATE, trigger SCHEDULE or MANUAL, result SUCCESS, FAILED or UNVERIFIED, message, occurred_at), GET /api/v1/forwarding/events for the dashboard, device list with last seen and revoke. Validate no overlapping windows. Optionally send an FCM data message on schedule change (behind a config flag; FCM credentials are a secret). Replace stubs and regenerate the client.

Done when: tests cover validation, versioning, idempotent events, device token scope, revoke, permissions and tenant isolation.
```

### M8-02 Android feasibility spike on real devices and carriers (Dev 3, 8h)

Skills: android-kotlin-forwarding. No product code is kept from this ticket.

```text
Build a throwaway test app (not in the repo's main branch) to try activating, deactivating and querying call forwarding with carrier codes on each target device and SIM. Record per row in docs/android-compatibility-matrix.md: device, Android version, carrier, SIM slot, code used, whether the activation worked, whether the status query confirmed it, whether it worked with the screen off and in battery saver. Conclude go, go with limits, or recommend carrier-side forwarding at the telephony provider instead.

Done when: the matrix has real results for at least 3 devices and 2 carriers and a written recommendation exists.
```

### M8-03 Decision: Android stack and carrier code configuration (Lead)

Decide using M8-02 results and the developer's skills: Kotlin with Jetpack Compose (recommended for background reliability) or React Native with a native module (as in the scope document). Record the decision as an ADR and update `docs/STACK.md`, `apps/android/CLAUDE.md` and the android skill.

### M8-04 Dashboard: forwarding schedules screen (Dev 2, 5h)

Skills: frontend-react-standards, ui-design-system. Blocked by: M8-01.

```text
In clinic-web add Call forwarding: schedule list with create and edit (days, start, end, active), overlap validation messages, device list (paired phones, last seen, revoke), pairing code dialog (code, expiry countdown, one-time), recent events with result badges (SUCCESS, FAILED, UNVERIFIED) and plain-language explanations. Owner and Manager only. A note explains that forwarding depends on the phone and carrier.

Done when: tests cover schedule CRUD, overlap error, pairing code expiry, revoke, events display and permissions.
```

### M8-05 Android app scaffold (Dev 3, 4h)

Skills: android-kotlin-forwarding. Blocked by: M8-03.

```text
Scaffold apps/android per the decision in M8-03 (default: Kotlin, Jetpack Compose, MVVM with a single UiState per screen, Hilt, Room, WorkManager, kotlinx.serialization with Retrofit or Ktor, Timber). minSdk 26. Configure ktlint and detekt, unit-test setup, build variants (staging, production) with base URLs from build config, R8 on release, and a CI job that builds, lints and tests it. Read apps/android/CLAUDE.md first.

Done when: the app builds and launches to an empty screen, CI builds it, and lint and unit tests pass.
```

### M8-06 Pairing and secure token storage (Dev 3, 4h)

Skills: android-kotlin-forwarding, tenant-security-phi. Blocked by: M8-05.

```text
Implement pairing: enter the 6-character code, call /devices/pair, store the device token in Keystore-backed encrypted storage, prefill the assigned agent number from the response (editable), handle expired or used codes and unpaired state (revoked token returns to the pairing screen). Never log the token. HTTPS only with normal certificate validation.

Done when: unit tests cover success, invalid and expired codes, revoked token handling; manual check that the token is not in logs or plain preferences.
```

### M8-07 Schedule sync, push and polling (Dev 3, 5h)

Skills: android-kotlin-forwarding. Blocked by: M8-06, M8-01.

```text
Sync schedules from the server (the source of truth): fetch on app start, on FCM data message, and by periodic WorkManager polling as a fallback; compare versions; store in Room; on change cancel and reschedule alarms. Handle offline (use the last known schedules) and conflicts (server wins).

Done when: unit tests cover version diff, offline start and reschedule on change; manual test shows a dashboard edit reaching the phone within the polling interval.
```

### M8-08 Forwarding execution engine (Dev 3, 8h)

Skills: android-kotlin-forwarding. Blocked by: M8-07, M8-02.

```text
Implement activation and deactivation using the carrier codes and method proven in M8-02, per SIM slot, from a per-carrier configuration (not hard-coded in UI). Schedule exact alarms for window start and end (handle the revoked exact-alarm permission), use WorkManager as a backup, reschedule on boot, app update, timezone change and schedule change. Verify by querying status when possible; otherwise record UNVERIFIED. Retry on transient failure with limits. Surface restrictions (battery optimisation, missing permission, no signal) as explicit states. Report every attempt via M8-10.

Done when: unit tests cover scheduling maths (including overnight windows and DST), retry and result classification; instrumented tests pass on the matrix devices.
```

### M8-09 App screens: status, schedules, manual toggle (Dev 3, 6h)

Skills: android-kotlin-forwarding, ui-design-system. Blocked by: M8-07.

```text
Compose screens: Status card (Forwarding ON, OFF or next window at ..., last result in plain language with a next step), Schedules list (read from the server, edit and delete via the API with validation), Agent number (prefilled, editable), Manual on and off with a confirmation, permission and battery-setting guidance with deep links to system settings. Accessible, large touch targets, works in poor connectivity, no patient data anywhere.

Done when: ViewModel tests cover each UiState; screenshot or UI tests cover the main states; manual run-through on two devices.
```

### M8-10 Event reporting with offline queue (Dev 3, 3h)

Skills: android-kotlin-forwarding. Blocked by: M8-08.

```text
Store every attempt (action, trigger, result, message, time, device event id) in Room and upload to /device/events with retry and backoff; upload is idempotent by event id; the queue survives restarts; the status card shows the last result even when offline.

Done when: unit tests cover queueing offline, retry, duplicate suppression and ordering.
```

### M8-11 Device and carrier matrix testing (Dev 3 and Lead, 8h)

Skills: android-kotlin-forwarding, testing-quality-gates. Blocked by: M8-10.

```text
Checklist, not a coding prompt: run the full scenario list on every device and carrier in the target matrix: pair, schedule created in the dashboard, window start and end, manual toggle, restart, airplane mode, battery saver, timezone change, schedule edit while the phone is offline, dual SIM. Fill docs/android-compatibility-matrix.md with results and per-manufacturer battery instructions; mark unsupported combinations. Ask Claude Code only to fix defects found and to update the document, after showing the diff.

Done when: the matrix is complete and signed off by the Lead.
```

### M8-12 Internal distribution (Dev 3, 3h)

Skills: android-kotlin-forwarding, release-readiness. Blocked by: M8-11.

```text
Set up signed release builds in CI (keystore in secrets, never in the repo), versioning, and internal distribution (signed APK download with a checksum, or an internal testing track). Document installation steps for clinics, including permissions and battery settings. Note that Play Store review of call-related permissions may add delay and is out of scope for the MVP.

Done when: a clinic staff member installs the signed build on a clean phone from the documented steps and pairs it successfully.
```

---

# Appendix: Open decisions and risks log

| #   | Item                                                 | Owner           | Needed by            | Status     |
| --- | ---------------------------------------------------- | --------------- | -------------------- | ---------- |
| 1   | Sarvam official docs and sample payloads             | Lead            | Before M3-01         | Open       |
| 2   | Telephony or number provider                         | Lead            | Before M3-09         | Open       |
| 3   | Email provider or temporary-password flow            | Lead            | M1-11                | Open       |
| 4   | Recording retention default                          | Lead with legal | M6-06                | Open       |
| 5   | Outbound call rules (window, attempts, cap)          | Lead            | M6-04                | Proposed   |
| 6   | Android stack (Kotlin or React Native)               | Lead            | M8-03                | Open       |
| 7   | OpenHours domain and trademark                       | Lead            | Before public launch | Open       |
| 8   | Prisma 7 with RLS `set_config` in transactions       | Dev 1           | M1-04                | Unverified |
| 9   | zod 4 with the OpenAPI libraries                     | Dev 1           | M1-03                | Unverified |
| 10  | Presigned URLs against the local S3-compatible store | Dev 1           | M3-07                | Unverified |
| 11  | CI first run on GitHub (corepack pin)                | Dev 1           | M1-01b               | Unverified |

**Risks to watch:** Dev 1 is on the critical path (keep frontends on the mock and give Dev 2 and Dev 3 their own backend modules); the 172 to 205 hour estimate is a judgement to be re-checked at the M1 gate; Android forwarding depends on carriers and phone makers and may need a carrier-side alternative; if time slips, apply the cut list in the plan document (only with sign-off) and never cut tenant isolation, permissions, audit, webhook idempotency, backups or the overlap constraint.
