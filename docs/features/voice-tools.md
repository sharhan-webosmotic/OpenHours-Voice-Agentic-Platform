# The voice tool endpoints

What the Sarvam agent calls while a patient is on the telephone. Phase 3 of the clinic
dashboard feature, first half. Binding choices: D-004, D-006, D-012, D-021, D-022.

## The six endpoints

All are `POST`, all under `/voice/tools`, all authenticated by the per-clinic tool secret as
`Authorization: Bearer <secret>`, and all answer `{ ok, message, data }`.

| Endpoint             | Takes                                                                               | Answers                                                  | PHI          |
| -------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------ |
| `clinic-info`        | `topic` (`hours`, `address`, `services`, `general`)                                 | name, address, hours, services, the clinic's own answers | no           |
| `lookup-patient`     | `callerNumber`, optional `fullName`                                                 | whether the caller's own line has a record               | yes, audited |
| `check-availability` | `date`, and the doctor and service by id or by name                                 | bookable times, or why there are none                    | no           |
| `book`               | `callerNumber`, optional `phone` and `fullName`, `date`, `time`, doctor and service | the appointment                                          | yes, audited |
| `reschedule`         | `callerNumber`, optional `appointmentId` and `fullName`, `date`, `time`             | the moved appointment                                    | yes, audited |
| `cancel`             | `callerNumber`, optional `appointmentId`, `fullName` and `reason`                   | confirmation                                             | yes, audited |

`message` is a whole short sentence, because it is spoken. It carries only what the caller said
in this call: no stored name and no stored detail, in `message` or in `data`.

## Who the caller is

**The caller's own line, never a number they speak** (Feature 3 review, C2 and I6). Before
this, a caller could say a neighbour's number, hear the neighbour's name, learn they were a
patient here and cancel their appointment.

`callerNumber` is the number the call is coming from. **In each Sarvam tool's body template it
must be filled from the call context's "User Identifier" variable** (`docs/sarvam-contract.md`
section 2), never from anything the agent heard. The exact substitution syntax is not yet
confirmed with Sarvam (contract section 9, question 3), so it has to be checked on the first
configured agent before the first real call.

| The caller's line                   | What happens                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matches a patient                   | Proceeds. The name is not said back                                                                                                                              |
| Matches several (a family's line)   | Asks for the full name and narrows by what the caller says. Never lists names                                                                                    |
| Unknown                             | A new caller. Details are taken, nothing is searched, and nothing says whether a record exists                                                                   |
| Missing, withheld or unusable       | Still bookable, so the appointment is not lost: the caller's spoken `phone` becomes the new patient's contact number. It is never searched, so it reaches nobody |
| Any case, for reschedule and cancel | Acts only on that line's own upcoming appointments. Anything else, including an `appointmentId` that is not theirs, is a sentence offering a call back           |

## It adds no rules of its own

Booking, moving and cancelling call the same service functions the dashboard calls, with the
agent's own principal. The status machine, the minimum notice, the maximum advance, the
doctor's working hours and the `appointments_no_overlap` exclusion constraint all apply
unchanged. A second implementation here would be a second set of clinical rules, and the one
that got a rule wrong would be the one talking to patients.

## It refuses to guess

| Situation                                            | What it does                                                                                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two patient records share the caller's line          | Asks for the full name. **Does not read the names out:** one number is usually a family, and whoever is holding the phone has not been authorised to learn who else lives there. |
| The named doctor or service matches none, or several | Asks which, and books nothing                                                                                                                                                    |
| Neither is named and the clinic has more than one    | Asks which. Defaults only when the clinic has exactly one, which is the pilot's shape                                                                                            |
| The caller has more than one upcoming appointment    | Asks which day. Moving the wrong one of two is worse than a question                                                                                                             |
| A new caller gives no name                           | Asks for it. Nothing is written: a record with no name is worse than no record                                                                                                   |
| The clinic's hours were never collected              | Says it does not know and offers a call back. **Never says "we are closed"** (D-013)                                                                                             |

## Which scope it resolves through

The ordinary **tenant** scope. The principal carries the organisation resolved from the secret
and the `VOICE_AGENT` role, which is not a platform role, so `withOrganisationScope` sends it
through `withTenant`: row-level security and the Prisma tenant extension both apply exactly as
they do for a clinic user.

The one unscoped query is the credential lookup, which cannot be scoped because it is what
decides the scope. It runs through `asAuthenticator`, which is `asSystem` without the audit
row, because `asSystem` writes a row in a transaction of its own and would file one per
sentence a patient speaks. Its call sites are enumerated by
`tests/credential-scope-call-sites.test.ts`, so a second use cannot appear unnoticed.

**M1-14 interaction:** `asAuthenticator` opens platform scope with the `app.platform` GUC that
M1-14 removes. That ticket must move it to the `app_platform` role with the other platform
reads, or every voice tool call stops authenticating.

## Measured latency

`pnpm voice:measure` against a local PostgreSQL 16 container, 600 patients and 900
appointments over twelve weeks, one doctor, four services, Monday to Friday with a lunch
break, 20 concurrent callers, over real HTTP. Two runs on 2026-11-02, on an Intel i5-8500B at
3.0 GHz with Node 22.21.

| Tool                 | p50           | p95               | p99           |
| -------------------- | ------------- | ----------------- | ------------- |
| `lookup-patient`     | 88 to 96 ms   | 106 to 157 ms     | 112 to 162 ms |
| `clinic-info`        | 111 to 125 ms | 154 to 195 ms     | 192 to 216 ms |
| `check-availability` | 169 to 173 ms | 228 to 246 ms     | 238 to 258 ms |
| `book`               | 240 to 248 ms | **275 to 285 ms** | 287 to 301 ms |
| All together         | 124 to 135 ms | 250 to 258 ms     | 274 to 284 ms |

**The slowest tool is `book`, not the slot engine.** `check-availability` runs the engine and
answers at a p95 of about 240 ms; `book` is the engine's work again plus the write, plus a
second scope to resolve the doctor and service, and comes in roughly 40 ms behind it. So the
engine is about half of the slowest path rather than the whole of it, and the first place to
look for time is the number of separate scopes a booking opens (three today: resolve, read the
time zone, book).

**Under the 400 ms target, with the caveats stated.** The figures exclude the network between
Sarvam and us, the agent's own turn latency, and throttling: the measurement raises the rate
limit to a million, because 700 calls for one clinic inside a minute is far past the
configured 600 and the first run reported a p95 over a hundred 429s.

**Three defects in the measurement itself were found and fixed before these figures**, which
is why the script prints the first refusal from each tool: a body that named no service was
answered "what would you like to come in for?" and timed a short-circuit; a shared slot cursor
read by twenty workers made a third of the bookings collide on the exclusion constraint; and
the last few bookings fell outside the clinic's 120-day horizon. A refusal is a cheaper path
than the work, so every one of those flattered the result.

## Deviations, and why

| Deviation                                                            | Why                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Not under `/api/v1`.**                                             | `sarvam-voice-integration` prescribes `/voice/tools/*`. It is a provider surface with its own authentication, and the shared prefix would imply that a session reaches it.                                                                        |
| **401 and 429 are not HTTP 200**, though the ticket says always 200. | A secret that does not authenticate is a misconfigured deployment or somebody probing. Neither is a thing to say to a caller, and a 200 would hide both from monitoring. 429 lets the provider back off.                                          |
| **Times are the clinic's local `date` and `time`, not an instant.**  | It is what is said on the telephone, and asking a language model for a UTC instant invites an appointment five and a half hours out that reads as a plausible time.                                                                               |
| **The audit row cannot name the agent.**                             | `audit_logs.actor_role` is the database's `role` enum. Recorded as backlog item V1 with two candidate fixes.                                                                                                                                      |
| **No `permission` field in the route registry.**                     | The guard that reads it proves a declaration by signing in as each role. This principal has no session. The matrix check is still in the service; its grants are proven in `tests/voice-tools.test.ts` and its denials in the matrix's own suite. |

## Tests

- `tests/voice-tools.test.ts`: 23, driven over HTTP with a real secret. Authentication, a
  suspended clinic answered indistinguishably from an unknown secret, cross-tenant refusal
  **with a positive control**, the refuse-to-guess cases, idempotent replay, a taken slot
  answered as a sentence rather than a 500, and the shape of the audit row.
- `tests/voice-phi-never-logged.test.ts`: replaces the logger module with a capturing one,
  drives real calls carrying a name, a number and a sentence of symptoms, and greps every
  line. **Sabotaged to confirm it fails**, which also demonstrates the point: redaction works
  by field name, so a value interpolated into a new field is exactly what it would miss.
- `tests/voice-tool-rate-limit.test.ts`: lowers the limit to three and watches one clinic
  throttle while its neighbour, same process and same moment, is served.
- `src/voice/tool-secret.test.ts`: the constant-time comparison, including that a length
  mismatch neither throws nor short-circuits.
- `tests/credential-scope-call-sites.test.ts`: the unaudited cross-tenant scope has exactly
  one call site.
- `tests/phi-routes-are-audited.test.ts`: four new recipes drive the four PHI-sensitive voice
  routes and assert the declared audit row appears.
- `tests/password-change-gate.test.ts`: all six routes carried as ones a user access token
  does not authenticate, each driven with a gated user's token.

## The second half: the webhook, the transcript, the recording and the catch-up

Built from `docs/sarvam-contract.md`, read from Sarvam's own documentation on 2026-10-27.

### Where Sarvam's shapes live

`apps/api/src/voice/providers/sarvam.ts` and its fixture, and nowhere else. The rest of the
platform sees a normalised `CallEvent` with no provider field names in it, which is what the
`VoiceProvider` interface is for. Two details from the contract that cost something to get
wrong, and are therefore each in one place:

- **`interaction_id` contains a slash** (`<YYYYMMDD>/<id>`), so it is stored verbatim and
  `encodeURIComponent`-ed at the point of use. The contract says an id without a slash is
  answered with a 400.
- **Analytics has a different path shape** from the other services, `/v1/{org}/{ws}/{app}/…`
  rather than `/v1/orgs/{org}/workspaces/{ws}/…`, and authenticates with `X-API-Key` rather
  than a bearer token. Getting either wrong is a 404 that reads as a missing interaction.

### How a webhook is authenticated, given that it is not signed

D-006 as amended on 2026-11-04:

1. A per-clinic secret in the URL path, stored only as a hash, in its own column. It resolves
   the clinic, so a request without it addresses nobody. The request log replaces it with
   `[REDACTED]`.
2. An allow-list of Sarvam's egress addresses, **or an explicit decision to run without one**.
   The API refuses to start with neither (`SARVAM_WEBHOOK_SOURCE_IPS` or
   `SARVAM_WEBHOOK_IP_CHECK_DISABLED=true`) and with both.

`metadata.clinic_id` is never used to route: a mismatch is logged and the secret's answer
stands.

**Validated on the way in.** The adapter's schema checks the body's shape, types and length
bounds (ids 200 characters, phones 32, times 64, a duration of at most a day, at most 2,000
transcript turns of at most 20,000 characters). A body that fails is answered 200 with
`{ ok: false, received: false }`, logged with the failing field paths only, and stored nowhere.
So is a body the JSON parser cannot read. The webhook has its own 1 MB body limit
(`WEBHOOK_BODY_LIMIT`), because a long call's transcript in two languages passes the general
100 kb one.

**Used as it arrived, verified after.** A valid body becomes a call and a transcript with no
provider call in front of it. The recording job, two minutes later, asks Sarvam two separate
questions and records two separate answers:

| Question                   | Asked of               | Recorded as                                                  |
| -------------------------- | ---------------------- | ------------------------------------------------------------ |
| Is there audio?            | the recording endpoint | `calls.has_recording`, and the copied file                   |
| Did Sarvam have this call? | the interactions list  | `calls.verification`: `UNCHECKED`, `VERIFIED` or `NOT_FOUND` |

They are kept apart because the recording endpoint answers 404 both for a call that never
happened and for a real call that was not recorded. The interactions list is cached for 60
seconds (contract section 5), so a call absent from it is only marked `NOT_FOUND` once five
minutes have passed since we received it; before that the job retries. The lookup's window is
anchored on our own receive time, never on a time the payload claims. A call the catch-up job
creates, or finds, is `VERIFIED` by construction, since it came from that same list. The Call
History drawer warns on `NOT_FOUND` only.

### The jobs

pg-boss 12.38.0, pinned, in its own `pgboss` schema in the same database. Three queues: process
an event, copy a recording, catch up. Every one is idempotent on the interaction id by unique
index rather than by checking. The worker runs in the API process, which is a decision with a
stated cost (see `jobs/queue.ts`) and the same scaling trigger as D-020.

The catch-up runs hourly over a **six-hour window**, deliberately overlapping, because the
contract records UNKNOWN against whether Sarvam retries a delivery at all. Re-reading hours it
has already seen writes nothing.

### Deviations in the ingestion half

| Deviation                                                                                                                                  | Why                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The transcript is its own table**, not the `call_transcripts` the contract's mapping names, and `calls.transcript` keeps the plain text. | The dashboard shows an attributed conversation, so the turns need rows. The text column already existed and is what an export or a search wants.                                                                     |
| **`calls.outcome` is never written.**                                                                                                      | Deciding that a call resulted in a booking means reading what the agent did during it. That is the outcome work, and inventing it from the status would be a fact the clinic acts on. The UI reads "Not classified". |
| **Outbound calls are parsed but not ingested.**                                                                                            | `attempt_id` marks an outbound attempt (contract section 4), and an outbound webhook arriving here must not be filed as somebody ringing the clinic. Outbound reminders are a later milestone.                       |
| **Verification is a filtered list lookup**, not a read of one interaction.                                                                 | The contract documents no single-interaction endpoint, so the recording job lists the window around our receive time and looks for the id. Question 3 in the contract's own list is what would replace it.           |

## The Call History screens

`docs/prototype/laptop-14-calls-list.png` and `laptop-15-call-detail.png`, which are the most
fictional captures in the export: the prototype's own banner says its call records and
summaries are invented. So the work here was mostly deciding what to say instead.

| The capture shows                                    | Here                                                                                    | Why                                                                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A generated **conversation summary**                 | The card keeps its place and says no summary is generated, with the transcript below it | A summary of a clinical conversation invented by this screen would be read as the clinic's own record of the call                                                |
| **Call type**: New patient, Reschedule, Cancellation | Direction: incoming or outgoing                                                         | Deriving a call type from a transcript is an inference the clinic would act on                                                                                   |
| **Outcome**: Booked, Updated, Resolved               | The status, plus the outcome when it is set                                             | Nothing writes `calls.outcome` yet, so a filter on it would only ever match one value                                                                            |
| A **REVIEW column** and "Mark as reviewed"           | The column is gone; the drawer's control is present and visibly disabled                | A column saying the same thing on every row is decoration. The control belongs where somebody would look for it, inert, as with the header's search box          |
| **Create follow-up**                                 | Present and disabled                                                                    | Follow-ups were left out of this feature entirely                                                                                                                |
| No recording and no transcript at all                | Both, in the drawer's own idiom                                                         | Agreed as an addition. Three honest states each, because "no recording", "not copied yet" and "your role may not hear it" are different things to a receptionist |

The recording URL is minted when somebody presses play, never when the drawer opens, because
every mint is an audit row against the person who asked and a drawer opening is not somebody
listening.

## What Phase 3 does not cover

- **No outbound calls.** Reminders and confirmations are a later milestone, and the adapter
  only reads the direction so one cannot be mistaken for an inbound call.
- **No `reschedule` or `cancel` in the measured figures.** Each is a locate plus the same
  write as `book`, so the honest expectation is `book` plus one read, and it is not measured.
- **No load test at 20 concurrent CALLS**, only 20 concurrent tool requests. A call is a
  sequence of tool calls with a person speaking between them, which is a gentler shape.
- **No real call has happened.** Every fixture is synthetic and built from the documented
  field list. The adapter is provisional until the pilot call, after which the raw body in
  `webhook_events.payload` is the evidence to check it against.
- **The webhook's IP allow-list is off by default**, so it is a production setting somebody
  has to turn on. `release-readiness` owns that.
