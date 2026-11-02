# The clinic dashboard

The working dashboard for a clinic, built as the prototype has it and wired to real
endpoints, with the voice agent booking into the same calendar.

This document is written as the feature is built. Phase 1, the API the dashboard needs, is
complete. Phases 2 to 4 (the screens, the voice integration, and the first real call) follow,
and their sections are added as they land rather than promised here.

## What binds this work

- `docs/DECISIONS.md` D-015, one data layer: Redux Toolkit and RTK Query, with the API client
  as the transport.
- D-016, which amends D-008: M1-14 lands immediately after the first real call, and before
  either a load test or a second clinic.
- D-013, five configuration tables with every field nullable until collected, and a clinic
  with no hours recorded being a clinic nobody has asked rather than one that is closed.
- D-009, two standalone web applications, each holding its own copy of the shared layer.

## The prototype is the specification

Every screen is built from `ClinicFlow Interactive Prototype/`, captured into
`docs/prototype/` at three widths. The captures are the reference a reviewer compares against,
so nothing in this feature is designed from memory or from a screenshot in a conversation.

## Deviations from the prototype, and why

Each one was agreed before building. Nothing here was changed silently.

### Decided with the ticket

| Deviation                                                                                                                                                                                                                                                                             | Why                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Single doctor, as the prototype has it.** No doctor column in the appointments list, no doctor step in the booking form, no doctor filter.                                                                                                                                          | The pilot clinic genuinely has one doctor. The SCHEMA stays multi-doctor: `doctors`, `doctor_working_hours`, `doctor_time_off` and `doctor_services` are all per-doctor, every endpoint takes a `doctorId`, and the slot engine answers per doctor. Going multi-doctor is a user-interface change: a column in the list, a step in the wizard, and a filter. |
| **Month view and day agenda only.** No week view.                                                                                                                                                                                                                                     | The prototype has a month grid with a day agenda beside it and no week view to copy. The API already answers `range=week`, so the screen is the only missing piece.                                                                                                                                                                                          |
| **Transcript panel and audio player added to the call drawer.**                                                                                                                                                                                                                       | The prototype's call drawer shows a prose summary and nothing else. A real call has a transcript and a recording, so the drawer gains a scrollable list of turns with the speaker labelled and a standard player fed a short-lived presigned URL, following the drawer's own patterns rather than a new layout. Lands with Phase 3.                          |
| **Follow-ups and Notifications are chrome, not features.** The notifications popover and the global search panel are built as captured, with honest empty states. The Follow-ups screen is not built, and the follow-ups section of the patient profile says it is not available yet. | Neither has a backend. Building the shell keeps the prototype's layout honest; faking the contents would put invented clinical follow-ups on a screen.                                                                                                                                                                                                       |
| **Reports and Reminders show honest empty states.**                                                                                                                                                                                                                                   | No analytics endpoints and no reminder tables exist. Both are their own features later.                                                                                                                                                                                                                                                                      |
| **Money in INR as integer minor units, phones in E.164 with a +91 default, every time rendered in the clinic's zone.**                                                                                                                                                                | The prototype shows dollars, US phone formats and bare dates. Root `CLAUDE.md` settles all three.                                                                                                                                                                                                                                                            |
| **Patient-identifying fields are masked for platform roles.**                                                                                                                                                                                                                         | The matrix gives `read: 'masked'` on `patients` and `appointments` to the two platform roles. The prototype has no masked state because it has no platform roles.                                                                                                                                                                                            |
| **The Overview re-flows below 1920 pixels.**                                                                                                                                                                                                                                          | The prototype's Overview is a Figma export with `min-w-[1920px]` and no responsive behaviour: it clips rather than re-flowing. The card order and visual hierarchy are kept. Anything that cannot re-flow sensibly is raised rather than guessed. Lands with Phase 2.                                                                                        |

### Found while building Phase 1

| Deviation                                                                                            | Why                                                                                                                                                                                                                                                                                                                                                         | State                                                      |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **An appointment has no notes field.** The prototype's booking form and detail drawer both show one. | `appointments` has no `notes` column. Accepting the field and dropping it would lose a receptionist's note silently, which is worse than not offering it, so neither the shared schema nor the API has it.                                                                                                                                                  | Needs an additive migration. Awaiting sign-off.            |
| **A walk-in is recorded as `DASHBOARD`.**                                                            | `AppointmentSource` is `VOICE_AGENT`, `DASHBOARD`, `IMPORT`. The brief asks for manual, walk-in and AI as three distinguishable sources.                                                                                                                                                                                                                    | Needs an additive enum value `WALK_IN`. Awaiting sign-off. |
| **The session is not in the Redux store.** The ticket put it there.                                  | `AuthProvider` owns the session and the access token lives in the API client's closure (D-002), an arrangement the Playwright suite verified in a real browser. A copy in a slice would be a second place the session can be wrong, and the only thing it would add is dev-tools visibility of exactly the data that must stay out of a dev-tools snapshot. | Deliberate.                                                |

## Phase 1: the API the dashboard needs

### What was built

| Endpoint                                              | Notes                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `GET/POST /api/v1/patients`                           | Search across name and phone, cursor pagination, two sorts. |
| `GET/PATCH /api/v1/patients/:patientId`               | Profile with a bounded appointment history.                 |
| `GET /api/v1/appointments`                            | A window of the schedule, soonest first.                    |
| `POST /api/v1/appointments`                           | Books a slot. Accepts `Idempotency-Key`.                    |
| `GET /api/v1/appointments/agenda`                     | Day, week or month, with status counts.                     |
| `GET /api/v1/appointments/availability`               | Bookable slots for a doctor, service and date.              |
| `GET /api/v1/appointments/:appointmentId`             | One appointment.                                            |
| `POST /api/v1/appointments/:appointmentId/reschedule` | Writes a new row and links it to the old one.               |
| `POST /api/v1/appointments/:appointmentId/cancel`     | With a reason.                                              |
| `POST /api/v1/appointments/:appointmentId/status`     | Any transition the table allows.                            |

No schema change was needed: `patients`, `appointments`, `doctors`, `services`, the hours
tables and `clinic_booking_policies` all existed, as did the `appointments_no_overlap`
exclusion constraint.

### The slot engine

`apps/api/src/modules/availability/availability.engine.ts` is a pure function over data
somebody else loaded. It takes `now` as a parameter, reads no clock and no database, and
returns either slots or a reason there are none.

It applies, in order: the clinic having recorded hours at all, the booking window (not in the
past, not inside the minimum notice, not beyond the maximum advance), the clinic's opening
segments for that weekday, the doctor's working segments inside them, time off subtracted,
candidate starts on the granularity grid that fit entirely inside a window, existing
appointments with the buffer counted on both sides, and `maxPerSlot` for a clinic that
deliberately overbooks.

**A break is the gap between two opening segments** (D-013), so nothing in the engine knows
what a break is: 09:00-13:00 and 14:00-18:00 is a clinic with a lunch hour.

**The grid is anchored to midnight, not to each window**, so a clinic that opens at 09:10 with
a 15-minute grid offers 09:15, and the afternoon lines up with the morning.

**Every policy default is the safe reading of "not configured"**: `maxPerSlot` falls back to 1,
the maximum advance is capped at a year whatever the policy says, and the granularity falls
back to the service's own duration.

Its tests are worked examples written out by hand from a clinic described in the test, not
captured from the engine's output. Two of them are in zones with daylight saving, because the
pilot's lack of it is what would let an offset bug sit undetected.

### Double booking

The engine's check is **not** the control and the code says so in both places. Two bookings for
one slot arriving together both see it free, because both read before either wrote. The
exclusion constraint decides, and the service's job is to recognise its SQLSTATE and answer
409 with a sentence a receptionist can act on rather than the 500 an unrecognised driver error
would produce.

The suite drives two simultaneous bookings and then five. Either refusal is accepted, because
which one a run produces is a matter of commit timing: if the loser's check runs after the
winner committed, the engine refuses it; if they interleave past the check, the constraint
does. What is asserted is that exactly one wins and that nothing answers 500.

### Tenancy, and how a platform role reads

These routes do **not** use `tenantMiddleware`, for the same reason the clinic configuration
routes do without it: that middleware requires an organisation in the request context, and the
two platform roles have none, so gating on it would refuse exactly the roles the matrix grants
a masked read to. The scope is resolved per principal through `withPrincipalScope`.

Because `asSystem` injects no organisation filter, **every repository function takes an
organisation id and filters on it explicitly**. Under a clinic scope that filter is verified
against the active tenant rather than trusted. A platform role must name the clinic it is
asking about, and a platform read with no clinic named is a 400 rather than every clinic's
rows in one response.

**The confinement is the application lock, not the hand-written filters.** A platform read runs
under `asOrganisationSystem`, a scope the extension injects for (D-017). The repository's own
`organisation_id` filters remain as a second layer. Which layer is doing the work is proven
rather than asserted: `tests/platform-scope-isolation.test.ts` drives every repository read
under that scope and also issues the unfiltered queries a function that forgot its filter would
issue. Removing the extension's branch fails six named cases. Removing one repository filter
fails none.

**One real hole was found by asking what the extension does with each operation.** The
`Organisation` model is scoped by its primary key, so a supplied `where.id` passed straight
through and relied on row-level security, which this scope switches off: reading an
organisation by another clinic's id returned that clinic's name, time zone and settings. Nothing
on the dashboard path passed a foreign id, so nothing leaked, but it was a loaded gun. The
extension now appends the scoped id to `where.AND`, which answers null instead. `findUnique`
needs no rewrite to `findFirst` on Prisma 7, and all six write operations are covered; every one
of those statements is a test rather than a claim.

**This scope depends on `app.platform`, which M1-14 removes.** Landing that migration without
pointing `asOrganisationSystem` at the new `app_platform` role makes every platform read of a
clinic return nothing. Recorded on both D-017 and the M1-14 backlog entry.

**The permission check runs before the clinic is resolved**, and the order is load-bearing: the
other way round turned "you may not do that" into "name a clinic", which told an internal
admin that a missing parameter was all that stood between them and a write. The permission
guard caught it.

### Tests

| What                                                                                      | Where                                                      |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Slot engine, 27 worked examples including both daylight-saving directions                 | `src/modules/availability/availability.engine.test.ts`     |
| Clinic-time conversion, 24 worked examples                                                | `packages/shared/src/clinic-time.test.ts`                  |
| Every one of the 25 ordered status pairs, allowed and refused                             | `packages/shared/src/appointment.test.ts`                  |
| Concurrency, tenancy, idempotency, masking, the doctor scope, the agenda, patient records | `apps/api/tests/clinic-dashboard.test.ts`                  |
| Every new route enforces its matrix cell for all six roles, through the real middleware   | `apps/api/tests/declared-permissions-are-enforced.test.ts` |
| Every new PHI route writes its declared audit row when driven                             | `apps/api/tests/phi-routes-are-audited.test.ts`            |
| A temporary-password holder reaches none of them                                          | `apps/api/tests/password-change-gate.test.ts`              |

Coverage for the three new modules: patients 98.4% of lines, availability 98.0%, appointments
93.2%, against a 90% floor for booking code.

### What Phase 1 does not cover

- **A patient create has no `Idempotency-Key`.** Rule 8 asks for one on every create the voice
  agent can reach, and `patients` has no key column. The booking the agent makes is idempotent;
  the patient record it may create first is not. It needs the same additive migration as the
  notes column.
- **A support session does not unmask anything yet.** `hasSupportSession` is a named stub that
  returns false, which is the fail-closed direction. The admin console has no patient screens,
  so wiring it would be code no caller reaches.
- **Reminders, reports, prescriptions and follow-ups have no endpoints.** By decision, not by
  omission.
