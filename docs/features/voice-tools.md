# The voice tool endpoints

What the Sarvam agent calls while a patient is on the telephone. Phase 3 of the clinic
dashboard feature, first half. Binding choices: D-004, D-006, D-012, D-021, D-022.

## The six endpoints

All are `POST`, all under `/voice/tools`, all authenticated by the per-clinic tool secret as
`Authorization: Bearer <secret>`, and all answer `{ ok, message, data }`.

| Endpoint             | Takes                                                            | Answers                                                  | PHI          |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- | ------------ |
| `clinic-info`        | `topic` (`hours`, `address`, `services`, `general`)              | name, address, hours, services, the clinic's own answers | no           |
| `lookup-patient`     | `phone`, optional `fullName`                                     | whether the caller has a record                          | yes, audited |
| `check-availability` | `date`, and the doctor and service by id or by name              | bookable times, or why there are none                    | no           |
| `book`               | `phone`, optional `fullName`, `date`, `time`, doctor and service | the appointment                                          | yes, audited |
| `reschedule`         | `appointmentId` or `phone`, `date`, `time`                       | the moved appointment                                    | yes, audited |
| `cancel`             | `appointmentId` or `phone`, optional `reason`                    | confirmation                                             | yes, audited |

`message` is a whole short sentence, because it is spoken. It carries no patient data beyond
what the caller just supplied: it confirms a name the caller gave, never a name the database
holds for somebody else.

## It adds no rules of its own

Booking, moving and cancelling call the same service functions the dashboard calls, with the
agent's own principal. The status machine, the minimum notice, the maximum advance, the
doctor's working hours and the `appointments_no_overlap` exclusion constraint all apply
unchanged. A second implementation here would be a second set of clinical rules, and the one
that got a rule wrong would be the one talking to patients.

## It refuses to guess

| Situation                                            | What it does                                                                                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two patient records share the caller's number        | Asks for the full name. **Does not read the names out:** one number is usually a family, and whoever is holding the phone has not been authorised to learn who else lives there. |
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

## What this half does not cover

- **No webhook, no transcript, no recording, no catch-up import.** All four need Sarvam's
  payload shapes and API paths. `docs/sarvam-contract.md` says what is missing and why
  writing them from a summary would be worse than not writing them.
- **No Call History screens**, which read call rows that nothing writes yet.
- **No `reschedule` or `cancel` in the measured figures.** Each is a locate plus the same
  write as `book`, so the honest expectation is `book` plus one read, and it is not measured.
- **No load test at 20 concurrent CALLS**, only 20 concurrent tool requests. A call is a
  sequence of tool calls with a person speaking between them, which is a gentler shape.
