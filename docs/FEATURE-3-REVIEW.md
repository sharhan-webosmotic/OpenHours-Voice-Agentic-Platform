# Feature 3 review (trimmed, five sections)

Reviewed: `feat/clinic-dashboard` at `9d525f2`, the range `5ceeaa2..9d525f2` (48 commits).
Reviewer: an independent session that did not write this code. Date: 2026-11-03.
Scope: the five sections named in the review brief, nothing else. Read first: root
`CLAUDE.md`, `docs/DECISIONS.md` (D-004, D-006, D-007, D-012, D-017, D-021, D-022),
`docs/sarvam-contract.md`.

Method: every experiment ran in a separate detached worktree
(`../OpenHours-feature-3-review`) against throwaway databases (Testcontainers per run, plus
one private PostgreSQL container for the migration check), so nothing touched a shared
database or another session's worktree. Probes were temporary test files that recorded what
they observed. Every sabotage was reverted with `git checkout` and the worktree was left clean.

## Verdict

**Request changes.** The gate is green and the core isolation design holds up under sabotage,
but three findings break non-negotiable rules (patient data and a secret in logs, patient
identity spoken to an unauthenticated caller), and the webhook's strongest measure fails open
for a half-configured clinic. None is large to fix.

## The gate, as run

`pnpm check` in the review worktree: **exit 0**.

| Package                | Test files | Tests        |
| ---------------------- | ---------- | ------------ |
| `@clinicai/api`        | 67         | 1,043 passed |
| `@clinicai/shared`     | 11         | 308 passed   |
| `@clinicai/clinic-web` | 12         | 253 passed   |
| `@clinicai/admin-web`  | 6          | 108 passed   |
| `@clinicai/api-client` | 1          | 14 passed    |

API coverage: lines 92.84% (2776/2990), statements 92.83%, functions 94.12%, branches 81.19%.
The browser suites (`pnpm e2e`) were not run.

---

## Critical

### C1. A malformed JSON body puts the patient's name, number and words into the log

- **Where:** `apps/api/src/app.ts:151` (`express.json` runs for every router, including
  `/voice/tools` and `/webhooks/sarvam`) and `apps/api/src/app.ts:199-212` (the app-level
  handler logs `{ err: error }`). `apps/api/src/common/redaction.ts:100` copies every own
  property of an error, and body-parser's `SyntaxError` carries the raw request text in its
  own `body` property, which is not a redacted key.
- **Failure scenario:** a webhook delivery truncated in transit, or a tool call whose template
  renders invalid JSON. Probe: a book call with a broken body containing a synthetic name,
  number and "crushing chest pain since breakfast" logged all three. The same broken body to
  `/webhooks/sarvam/:secret`, carrying a transcript turn, logged all three as well. For the
  webhook that is a whole transcript in the log. Root `CLAUDE.md` rule 4.
- **Suggested fix:** in the app-level handler, translate body-parser errors before logging
  and log only `{ type, status }`, never the error object. Add `body` (and `rawBody`) to the
  redacted keys as a second layer. Add a test that sends a broken body with PHI to both
  surfaces and greps the captured log, in `tests/voice-phi-never-logged.test.ts`.
- **Verified.**

### C2. Any caller who says a number hears the name on that patient's record

- **Where:** `apps/api/src/voice/tools.service.ts:289`
  (`` `Thank you, I have your record, ${match.fullName}.` ``), also returned in `data.fullName`.
- **Failure scenario:** the number in `lookup-patient` is what the caller SAYS, not the line
  they are calling from. A stranger rings the clinic, gives a neighbour's number, and the
  agent reads out the neighbour's full name and confirms they are a patient of this clinic.
  Probe: `{ phone }` alone returned `"Thank you, I have your record, Patient ProbeA."`. The
  file's own header (lines 48-53) says a message "confirms a name the caller gave, never a
  name the database holds for somebody else". This path breaks that rule, and for some clinics
  being a patient at all is the sensitive fact.
- **Suggested fix:** never speak or return a stored name. When the caller gives no name, ask
  for one and confirm only a match (`found: true`, no name). Decide with the clinic whether
  the lookup should key on Sarvam's caller identifier (contract section 2, "User Identifier")
  rather than a spoken number. That is a product decision, not a code review one.
- **Verified.**

### C3. The webhook secret is written to the log on every delivery

- **Where:** `apps/api/src/app.ts:141` (`pino-http` logs `req.url`) with
  `apps/api/src/common/logger.ts:18`, which redacts headers only.
- **Failure scenario:** D-006 measure 1 is a secret in the URL path, and D-012 stores it only
  as a hash so that nobody can read it back. Probe: the full secret
  (`/webhooks/sarvam/xJNpR4...`) appeared in the request log line of an ordinary delivery.
  Anyone with log access holds every clinic's webhook credential, and log shipping copies it
  off the box. Root `CLAUDE.md` rule 4 ("never log ... secrets").
- **Suggested fix:** a `pino-http` `serializers.req` that replaces the path segment after
  `/webhooks/sarvam/` with `[REDACTED]` (and `req.params.secret`), plus a test asserting the
  secret is absent from captured log lines. Rotate any secret already issued in an
  environment whose logs are retained.
- **Verified.**

---

## Important

### I1. A forged webhook is acted on when the clinic's agent has no Sarvam app id

- **Where:** `apps/api/src/voice/ingest.service.ts:162`
  (`if (config.SARVAM_REFETCH_BEFORE_ACTING && agent?.appId != null)`).
- **Failure scenario:** the re-fetch, the measure D-006 calls "the one that holds", is
  silently skipped when `sarvam_app_id` is NULL. That state is reachable: the first save of a
  Sarvam mapping mints the webhook secret whether or not an app id was entered
  (`modules/organisations/organisations.service.ts:725`). Probe, provider stub answering "no
  such interaction": with an app id the event became `unresolvable` (0 calls). With the app id
  NULL the same forged payload was `processed`, creating 1 call and 1 forged transcript turn.
  Because `calls.external_call_id` is unique platform-wide, a forged event naming a real
  future interaction id would also pre-empt the genuine clinic's row (`claimedElsewhere`).
- **Suggested fix:** with the flag on and no app id, mark the event FAILED ("cannot verify")
  and do not act. Optionally refuse to mint a webhook secret until an app id exists.
- **Verified.**

### I2. `updateManyAndReturn` is not in the extension's operation list

- **Where:** `apps/api/src/db/tenant-extension.ts:19-33`.
- **Failure scenario:** under `asOrganisationSystem` for clinic A,
  `patient.updateManyAndReturn({ where: { id: <clinic B patient> } })` returned clinic B's
  row and changed its `notes`. On this scope row-level security is off, so nothing stops it.
  Nothing in `src` calls it today, so this is latent. It is exactly the "a function added in a
  later feature" case D-017 exists for, and `tests/platform-scope-isolation.test.ts` has no
  case for it.
- **Suggested fix:** add it to `WHERE_OPERATIONS`. Better, refuse any operation not in an
  explicit allow-list rather than passing unknown ones through. Add a case to the suite.
- **Verified.**

### I3. Nested relation writes and reads are outside the extension

- **Where:** `apps/api/src/db/tenant-extension.ts:202-229`. `$allOperations` sees only the
  top-level operation.
- **Failure scenario:** under `asOrganisationSystem` for clinic A,
  `appointment.update({ data: { patient: { connect: { id: <clinic B patient> } } } })`
  succeeded: clinic A's appointment now points at clinic B's patient, and a later `include`
  would read B's patient through it. Latent: no `connect` exists in `src/modules` or
  `src/voice` today. Under ordinary tenant scope, row-level security still backstops this.
- **Suggested fix:** state in D-017 that nested writes and `include` are not confined on this
  scope, add a lint rule or test that forbids nested `connect` / `connectOrCreate` in
  repositories, or add `organisation_id` to the foreign keys (composite). Add a case either way.
- **Verified.**

### I4. A new caller's booking leaves orphan and duplicate patient records

- **Where:** `apps/api/src/voice/tools.service.ts:474-505`. `patients.create` commits in its
  own transaction before `appointments.book`.
- **Failure scenario:** ten new callers racing for one slot gave 1 booking and **10 patient
  rows, 9 with no appointment**. One new caller whose tool call is retried ten times without
  an idempotency key gave **9 patient records for one person**. Each orphan is a real-looking
  record with a name and number that nobody asked to keep. The dashboard path is correct:
  ten concurrent bookings gave 1 success and nine 409s, no 500, one row.
- **Suggested fix:** create the patient and the appointment in one transaction (pass the
  `db` through to the two `*Within` functions), so a refused booking rolls the record back.
  Then the retry case needs a lookup by phone and name inside that transaction.
- **Verified.**

### I5. `maxPerSlot` above 1 offers slots the database then refuses

- **Where:** `apps/api/src/modules/availability/availability.engine.ts:348` permits a second
  appointment at the same start, and `apps/api/prisma/sql/001_constraints_rls_roles.sql:32-37`
  (`appointments_no_overlap`) forbids any overlap for one doctor.
- **Failure scenario:** both dashboards accept 1 to 10 (`packages/shared/src/clinic.ts:312`).
  Probe with `maxPerSlot = 2`: after one booking at a time, `check-availability` still
  offered that time, and the second booking was refused with "That time was just taken". The
  agent offers a slot and then takes it back from the patient, every time.
- **Suggested fix:** either restrict `maxPerSlot` to 1 until overbooking is designed (the
  constraint would need to allow N per start), or remove the overbooking branch from the
  engine. Pick one with the clinic.
- **Verified.**

### I6. Reschedule and cancel trust a spoken number or a bare appointment id

- **Where:** `apps/api/src/voice/tools.service.ts:556-612`.
- **Failure scenario:** `cancel` with `{ phone }` cancels that number's only upcoming
  appointment, whoever is calling (this is what `voice-tools.test.ts` "cancels, and says so
  without needing an id from the caller" asserts). An `appointmentId` in the body skips
  identification entirely. A probe also showed the refusal itself discloses that a stranger's
  number has "more than one appointment booked". Rule 9 lets the agent cancel, but nothing ties
  the cancellation to the patient.
- **Suggested fix:** require the caller's name to match the record before a write, and decide
  whether the caller-line identifier should be used. Ignore a body `appointmentId` unless it
  belongs to the identified patient.
- **Verified** (the behaviour). Whether Sarvam can send the caller's line is **Unverified**
  (contract section 9, question 3).

### I7. A broken or oversized body to a tool endpoint is not a speakable 200

- **Where:** `apps/api/src/app.ts:151`, ahead of `toSpokenError`
  (`apps/api/src/voice/tools.routes.ts:205`).
- **Failure scenario:** malformed JSON returned 400 `application/problem+json`, and a 200 KB
  body returned 413. D-022 allows only 401 and 429. The patient hears silence or a crash
  mid-sentence, which is the failure D-022 exists to prevent.
- **Suggested fix:** mount a body parser and error mapping on the voice router itself, or
  have the app-level handler hand `/voice/tools` errors to `toSpokenError`. Fix together
  with C1.
- **Verified.**

### I8. The end-to-end PHI log test does not test redaction

- **Where:** `apps/api/tests/voice-phi-never-logged.test.ts:77` onward.
- **Failure scenario:** with `redactLogObject` replaced by the identity function, that suite
  still passed 5 of 5. Two unit tests in `src/common` failed ("redacts PHI nested several
  levels deep", "redacts a real Error with a nested cause carrying a phone"), so the brief's
  "sabotage the redaction and confirm a test fails" is met, but only at the unit level. The
  integration suite proves that today's paths happen to log nothing identifiable. It does not
  prove that redaction would catch a path that did, and it did not cover C1.
- **Suggested fix:** add to that suite one case that deliberately drives a PHI-bearing error
  through the real handler (C1's broken body is a ready-made one), so switching redaction
  off fails it.
- **Verified.**

---

## Minor

### M1. A same-clinic race is logged as "belongs to another clinic"

- **Where:** `apps/api/src/modules/calls/calls.repository.ts:118-146`, read at
  `apps/api/src/voice/ingest.service.ts:243`.
- **Failure scenario:** five concurrent `processWebhookEvent` runs on one event left the
  right result (1 call, 3 turns). But four of them took the `skipDuplicates` path, logged
  "already belongs to another clinic", returned a `callId` that does not exist, and in
  production each would enqueue a recording job for that id (`jobs/handlers.ts:65-73`). A
  false cross-tenant alarm trains people to ignore the real one.
- **Suggested fix:** after a skipped insert, re-read by `(provider, external_call_id)` in
  this organisation. If found, return it as `created: false`. Only a miss means another clinic.
- **Verified.**

### M2. Concurrent recording downloads upload and audit once each

- **Where:** `apps/api/src/voice/ingest.service.ts:330-363`.
- **Failure scenario:** five concurrent `downloadRecording` calls for one call made 5
  uploads to one key and wrote 5 `call.recording_stored` audit rows. The object is correct.
  The audit trail and the provider fetches are five times over.
- **Suggested fix:** `pg-boss` `singletonKey` on the call id when enqueuing, or a
  conditional `UPDATE ... WHERE recording_key IS NULL` that decides who audits.
- **Verified.**

### M3. Minimum notice is compared in whole minutes

- **Where:** `apps/api/src/modules/availability/availability.engine.ts:297-309`.
- **Failure scenario:** with 120 minutes of notice at 10:00:30, `notBefore` is 12:00:30, its
  minute of day is 720, and 12:00 is offered and bookable, 30 seconds inside the notice.
  Booking uses the same engine, so this is not an offered-then-refused case.
- **Suggested fix:** use the ceiling of the minute when `notBefore` has seconds.
- **Unverified** (by reading only).

### M4. D-017 quotes a stale count

- **Where:** `docs/DECISIONS.md:358`, "fails six named cases".
- **Failure scenario:** the sabotage now fails 16 named cases. A reader who reproduces it and
  sees 16 will wonder what else is out of date.
- **Suggested fix:** say "fails every case in the first three describe blocks" rather than a
  number.
- **Verified.**

### M5. `call_transcript_turns` is unprotected between `migrate deploy` and `db:sql`

- **Where:** migration `20261102140000_call_transcript_turns` and
  `apps/api/prisma/sql/004_call_transcript_turns_rls.sql`.
- **Failure scenario:** on an existing database, after `prisma migrate deploy` and before
  `pnpm db:sql`, the new table has no policy, not enabled and not forced. The guard catches
  it (it exited 1 naming the table in that window), and nothing writes transcripts until a
  call arrives, so the risk is a deploy that stops halfway.
- **Suggested fix:** the deploy runbook should run `db:sql` and `db:check-policies` as one
  step with the migration, and fail the deploy on the guard.
- **Verified.**

---

## What was checked and held up

### 1. Tenant isolation on the platform-organisation scope

- **Sabotage of the extension** (`platform-organisation` made to skip injection like
  `platform`): **16 named failures** in `tests/platform-scope-isolation.test.ts`, across
  `findMany`, `count`/`groupBy`, `findUnique`, `findUniqueOrThrow`, the organisation by
  foreign id, `create`, `createMany`, `upsert`, `update`, `updateMany`/`deleteMany` and the
  directory summary. Verified.
- **Sabotage of one repository filter** (`organisationId` removed from the patient list in
  `patients.repository.ts`): **271 of 271 passed** across `platform-scope-isolation`,
  `organisation-write-confinement`, `tenant-isolation` and `clinic-dashboard`. This is the
  demonstration that the extension, not the filter, is the control. Verified.
- `findUnique` by a foreign id answers null, and `findUniqueOrThrow` raises not-found.
  Covered by the suite and failed under sabotage. Verified.
- `count` and `groupBy` have cases. `aggregate` has none: a probe showed it confined
  (2 rows for the scoped clinic out of 9 in the database). Verified.
- Writes: `create`, `createMany`, `upsert`, `update`, `updateMany`, `delete`, `deleteMany`
  are covered. An `update` whose data names another organisation was refused by Prisma rather
  than moving the row. Verified. Gaps: I2 and I3.
- Raw SQL on the path: none. The only raw statements in `src` are the `set_config` calls in
  `db/tenant-client.ts` and the health probe's `SELECT 1`. Verified by search.

### 2. Voice tool endpoints

- Constant-time comparison: `digestsMatch` in `voice/tool-secret.ts` uses `timingSafeEqual`
  with a decoy on a length mismatch. The lookup is by hash, so "unknown" and "wrong" are the
  same code path. Measured interleaved, 300 requests each: median 8.84 ms for an unknown
  secret, 9.28 ms for one a character off a real secret. Verified.
- A clinic id in the body (`organisationId`, `clinicId`, `organisation_id` all set to another
  clinic) was ignored. The other clinic's patient was not found. Verified.
- The routes do not pass through `requireAuth`, `requirePasswordChangeComplete` or
  `tenantMiddleware`. All six are in the route registry, and the four that touch patient data
  declare an audit action. Verified by reading.
- No user can hold `VOICE_AGENT`: the enum test refuses the cast (existing test). A validly
  signed access token carrying it got 401 "Authentication failed." on `GET /api/v1/patients`.
  Verified.
- The rate limit is keyed on the organisation from the verified secret (`tools.routes.ts:61`),
  with an address backstop ahead of authentication. Existing test throttles one clinic without
  touching another. Verified.
- Failures inside the router return 200 with a sentence and `data: null`, with no stack and
  no internal id. Exception: I7.

### 3. The webhook and patient data

- No secret in the path: 404. A wrong secret: 404. A right secret from a source outside the
  allow-list: 404 with the same body as a wrong secret. A right secret from an allowed
  address: 200. (Allow-list on, `TRUST_PROXY=1`, address via `X-Forwarded-For`.) Verified.
- An interaction Sarvam has no record of is refused when the agent has an app id. Fails open
  without one (I1).
- The same event 5 times in sequence and 5 times concurrently: 200 every time, **one**
  `webhook_events` row each, `received: true` exactly once, one audit row per stored event.
  Processing the stored event 5 times concurrently: **one** call row, **one** transcript
  (3 turns). The recording: one object, but 5 uploads and 5 audit rows (M2). Verified.
- `metadata.clinic_id` is never used for routing: the clinic comes from the URL secret, and a
  mismatch is only logged (`ingest.service.ts:150-158`). Verified by reading.
- Grep for the synthetic name, number, symptom and transcript text across everything the
  probes produced: **0** audit rows, **0** `webhook_events.last_error` values. Log lines:
  clean on every path except C1.

### 4. Booking correctness

- The slot engine's tests state their expected slots by hand, with the working shown in a
  comment above each assertion. They are not pasted from output.
- Three cases worked on paper and compared:
  - **A day with a break** (09:00 to 13:00 and 14:00 to 18:00, 30-minute grid and service):
    16 starts, 09:00 to 12:30 and 14:00 to 17:30. Matches `FULL_DAY`.
  - **A service longer than the gap before closing** (45 minutes on a 15-minute grid): the
    last morning start is 12:15 (ends 13:00) and the last afternoon start 17:15. Matches.
  - **Minimum notice** (now 10:10, notice 120 minutes): earliest 12:10, so 12:30 on the grid.
    Matches. The seconds edge case is M3.
- Offered-then-refused: booking re-runs the same engine (`assertSlotIsOfferable`), so the two
  agree except where the database is stricter than the engine (I5).
- Ten concurrent dashboard bookings for one slot: **1 success, nine 409, no 500, one row.**
  Through the voice tool: one booking and nine spoken refusals, but orphan patients (I4).

### 5. The six migrations (the second review)

- **Empty database:** all migrations, then `001` to `004`. `check-policies`: "OK: 31 tenant
  tables each have tenant_isolation, ENABLED and FORCED". Verified.
- **Populated database:** migrations up to `20261029100959` and SQL `001` to `003` from the
  base commit, synthetic rows in two clinics (agents, doctor, service, patient, appointment,
  call), then the six new migrations and `004`. All applied. Every row survived, and the new
  columns (`notes`, `price_minor`, `sex`, `email`, `webhook_secret_hash`) are NULL as the
  migrations state. Guard OK on 31 tables. Verified.
- **Nothing destructive:** six additive changes (two unique indexes, one plain index, one
  table, nullable columns, three CHECK constraints that hold on NULL). No `DROP`, no rewrite.
- **No applied migration edited:** each of the six has one commit, and no earlier migration
  has more than one commit in its whole history. Verified with `git log`.
- **Policy on anything new:** `call_transcript_turns` is the one new tenant table, covered by
  `004`. The guard exits 1 naming it if `004` has not run (M5). Verified.
- Not a finding but worth knowing: `call_transcript_turns.call_id` references `calls(id)`
  alone, not `(organisation_id, id)`. That matches every other foreign key in the schema (none
  is composite), and it is what makes I3 possible.

---

## What this review did not check

The brief was trimmed to five sections, so these were **not reviewed at all**:

- the clinic dashboard screens and every change under `apps/clinic-web` and `apps/admin-web`
  (beyond their unit tests passing in the gate), and the browser suites (`pnpm e2e` not run)
- the analytics overview (D-023), call history API and its presigned recording URLs,
  patients and appointments endpoints other than booking, and the agenda
- permissions and the masking of platform reads, other than the `VOICE_AGENT` token case
- performance, including the p95 under 400 ms target for the tool endpoints
- the master prompt and the Feature 2 fixes merged at `9d525f2`
- the catch-up job beyond reading it, and the real Sarvam adapter against a real Sarvam
  account (every provider call in the probes was a stub)

Within the five sections, these were **not verified**:

- **pg-boss job failure records.** The queue is not started in tests, so no job ever failed
  for real. The adapter's own errors carry paths only, but a Prisma validation error raised
  inside a job would carry its query arguments into `pgboss.job.output`. Not tested.
- Whether Sarvam sends malformed or truncated bodies, retries, or a caller-line identifier to
  tools. All are open questions in `docs/sarvam-contract.md` section 9.
- The source allow-list behind a real load balancer. Tested only with `X-Forwarded-For` and
  `TRUST_PROXY=1`.
- M3, by reading only.
- Logs in a `development` build, where `pino-pretty` is the transport. Only the JSON output
  was captured.

## Evidence

The probe test files, their JSON-lines output and the gate log were kept in this session's
scratchpad and are not committed. The review worktree `../OpenHours-feature-3-review`
(detached at `9d525f2`, clean) can be removed with `git worktree remove`.
