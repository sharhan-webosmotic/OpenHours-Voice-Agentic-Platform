# Pilot clinic setup

One real clinic, configured by hand, whose Sarvam agent is set up manually, so the console
and the voice agent can be tested together. No wizard, no approval workflow, no automated
provisioning.

## What we ask a clinic for

The intake checklist. Nothing here blocks a save: a clinic is configured over several
conversations and a half-collected clinic is a storable state. The readiness indicator on the
clinic page says what is still outstanding, and `packages/shared/clinic-readiness.ts` is the
one place that decides what "required before go-live" means.

| Section                  | What to ask for                                                                                                                                  | Required before go-live                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Clinic                   | Name, IANA time zone, status                                                                                                                     | Name, time zone                                                          |
| Identity and address     | Legal name, contact email, contact phone, website, street address, city, state, postal code, country, map link                                   | Phone, street address, city                                              |
| Opening hours            | Each weekday: closed, or one or more opening times                                                                                               | All seven weekdays stated, and open on at least one                      |
| Services                 | Name, duration, price                                                                                                                            | At least one active service                                              |
| Doctors                  | Name, specialty, buffer after each appointment                                                                                                   | At least one active doctor                                               |
| Booking policy           | Slot length, minimum notice, maximum advance, cancellation window, accepting new patients, default buffer, appointments per slot, no-show policy | Slot length, maximum advance                                             |
| Agent behaviour          | Greeting, languages, tone, what to say when fully booked, when to hand the call to a person, what never to promise                               | Greeting, at least one language, fully-booked response, escalation rules |
| Frequently asked answers | Question and the answer in the clinic's own words                                                                                                | Nothing. A clinic with none has an agent that offers to check            |
| Recording and consent    | Whether calls are recorded, how the caller is told, who at the clinic confirmed it                                                               | The decision, including a decision not to record, and the confirmation   |
| Sarvam mapping           | App id, app version, deployment id, connection id, agent number, clinic number, prompt version                                                   | App id, deployment id, agent number, tool secret, prompt version         |

Two things about this table are worth stating because they are easy to get wrong.

**A break is the gap between two opening times.** 09:00 to 13:00 and 17:00 to 20:00 is a
clinic with an afternoon break, and that shape expresses two breaks as easily as one.
Overnight hours are refused for now, in the schema and by a CHECK constraint.

**A weekly off is a weekday with no opening times, and that is not the same as a weekday
nobody has asked about.** Saving the hours always writes all seven days and records the time
it happened, so a clinic whose hours have never been collected is distinguishable from one
that is genuinely closed on Sunday. The agent is told to state no opening hours at all in the
first case, rather than asserting a closure nobody confirmed.

## Creating the first super admin

A one-off command, not an HTTP route. An endpoint that creates a super admin has to decide
who may call it, and before the first one exists there is nobody to authorise it.

```
BOOTSTRAP_SUPER_ADMIN_CONFIRM=i-am-bootstrapping-the-first-super-admin \
pnpm bootstrap:super-admin someone@clinicai.health "Their Name"
```

It refuses if any `SUPER_ADMIN` already exists, refuses without the exact confirmation
phrase, prints a random password once to stdout and never through the logger, sets
`mustChangePassword`, and writes an audit row whose actor is recorded as `bootstrap` rather
than as a user: an operator at a terminal did it, not an account.

**This one deliberately has no local-host guard**, unlike `pnpm provision:clinic`. Creating
the first real administrator on the real platform is the entire point, so the confirmation
variable is the control. It is not a secret and is not pretending to be one: it exists so
that running this cannot be an accident or a shell-history recall against a `DATABASE_URL`
somebody has forgotten about.

**Running it against production as a one-off task.** It needs only `DATABASE_URL` and the
confirmation variable, so it runs as a one-off ECS task on the API's task definition with the
command overridden, or over a bastion session with the database credentials from Secrets
Manager. Capture stdout: the password is shown once and is unrecoverable, because only an
argon2 hash is stored. Hand it over out of band and let the first sign-in replace it. If it
is lost, the account has to be removed in SQL and the command run again.

## Resetting a lost password

Also a one-off command and never an HTTP route, for the same reason.

```
pnpm reset-password someone@clinicai.health
```

It refuses an email no user has. Against a local database it runs as it is. Against any other
host it refuses unless `RESET_PASSWORD_CONFIRM=i-am-resetting-a-password-on-a-shared-database`
is set, so a `DATABASE_URL` left pointing at production cannot reset a real account by
accident. "Local" is the same allow-list `pnpm provision:clinic` uses.

In one transaction it stores the argon2 hash of a new random password, sets
`mustChangePassword`, clears any lockout, revokes every live refresh token, and writes a
`user.password_reset` audit row whose actor is the command. The password is printed once to
stdout and never logged. An access token issued before the reset still works until it expires
(15 minutes by default), because access tokens cannot be revoked (D-002). It cannot be renewed.

## Creating and configuring a clinic

1. Sign in to the admin console and open **Clinics**.
2. **Add clinic**: name, time zone and the clinic's own phone number. Those three are
   required because they are what makes a clinic identifiable in the list.
3. The clinic page opens with every section empty and a readiness indicator naming what is
   missing. Fill the sections in any order, saving each on its own.

**A double-submitted create cannot produce two clinics.** The button disables itself while
the request is in flight, and that is a courtesy rather than a control: a slow network, a
double click or a retried request all arrive as two POSTs the server cannot tell apart. The
real guard is a unique index on the clinic name, case-insensitively, which turns the second
request into a 409 telling the operator to search the list first. **That index assumes two
clinics with one name are a duplicate**, which holds while multi-branch clinics are out of
scope and is the thing to revisit when branches arrive.

### The owner's login, the prompt and the secrets, on the clinic page

- **Clinic owner** creates the owner's sign-in for the dashboard. The server generates a
  temporary password by the same code as `pnpm provision:clinic`, stores only its argon2 hash,
  and returns it in that one response, which no cache may keep. The page shows it once with a
  copy button. The owner must replace it at first sign-in (D-003). Governed by `clinic_users`.
- **Master prompt** renders the prompt on request, read-only, with a copy button, the version
  it came from, whether that wording is approved, and what is still missing. It records
  nothing: only saving the Sarvam mapping records a version.
- **Secrets** in the Sarvam mapping says whether each secret is set and when, never its value.

Opening the page, rendering the prompt and creating the owner each write an audit row, with ids
and flags only.

### Who can change what

The permission matrix governs each section separately, and the differences are real rather
than incidental:

| Section                                                   | Matrix cell              | Super admin | Internal admin |
| --------------------------------------------------------- | ------------------------ | ----------- | -------------- |
| Clinic name, time zone, status                            | `organisations`          | yes         | yes            |
| Address, hours, policy, agent behaviour, answers, consent | `clinic_settings`        | yes         | yes            |
| Services and doctors                                      | `doctors_services_hours` | yes         | **read only**  |
| Sarvam mapping                                            | `phone_voice_mapping`    | yes         | yes            |

**An internal admin can see a clinic's services and doctors and cannot change them.** That is
the matrix as agreed, and the pilot accepts it rather than widening the cell, because changing
a permission is a decision of its own. **It will need revisiting when support staff start
onboarding clinics**, since adding a service is exactly the kind of routine change an
onboarding person should be able to make without a super admin. The console shows the section
read-only and says so, rather than offering a form the server would refuse.

## Rendering the master prompt

```
pnpm prompt:render "Sunrise Dental" > prompt.txt
pnpm prompt:render 01a18766-7d5d-7000-a1e3-111dd84b9130
```

It takes the organisation id, or a fragment of the clinic name when that is unambiguous: two
matches is an error rather than a guess, because rendering the wrong clinic's prompt into a
provider console is not a mistake that announces itself. The prompt goes to stdout and every
warning to stderr, so the output can be redirected or piped.

It needs the API's environment, not just `DATABASE_URL`, because it goes through the same
`asSystem` scope the API uses. That is deliberate: reading a clinic's whole configuration from
a terminal leaves the same audit trail as reading it through the console.

**`v1` is the approved wording, and it is written for one clinic.** It is the Hindi-first
prompt for Sudhir Heart Care Clinic, tested on real calls and landed character for character in
`apps/api/src/voice/prompts/master-v1.ts`. Only the clinic name and the address are templated.
The persona, the doctor, the Devanagari name and the KNOWLEDGE block are that clinic's, so `v1`
is not the default: a clinic renders it only when its Sarvam mapping records `v1`. Every other
clinic still renders the unapproved `v0-caller-identity`, and the command warns on every render
of it. A second clinic needs its own version or a `v1` generalised into a new file.

### Clinics created before 2026-11-03 carry a version nobody recorded

Until 2026-11-03, creating a clinic stamped `v0-placeholder` as its prompt version, so the
readiness item "which master prompt version is loaded in Sarvam" was met before anyone had
opened Sarvam. New clinics no longer get one. Clinics created before then still show the item
as met, and need this once on each database that holds any.

A stamped version is distinguishable from a recorded one through the audit trail: an operator
recording a version is a `phone_voice_mapping.updated` row whose `fields` include
`promptVersion`. The statement clears the version only where no such row exists, so a version
somebody actually recorded is left alone. It is idempotent.

```sql
BEGIN;
-- Row-level security is forced even for the table owner, so the update declares platform
-- scope for this transaction only.
SELECT set_config('app.platform', 'on', true);
UPDATE voice_agents AS agent
SET prompt_version = NULL
WHERE agent.prompt_version = 'v0-placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM audit_logs AS entry
    WHERE entry.organisation_id = agent.organisation_id
      AND entry.action = 'phone_voice_mapping.updated'
      AND entry.metadata -> 'fields' ? 'promptVersion'
  );
COMMIT;
```

Run it as the database owner on a local or development database. Checked on 2026-11-03 against
a scratch database: a clinic whose version was only stamped is cleared, one whose version an
operator recorded is kept, and a second run changes nothing. It is a documented step rather than a migration because it decides
what to change by reading the audit trail, and it should not run against staging or production
without a second person reading it first (root `CLAUDE.md`). Run the readiness check afterwards:
the clinics it changed now list the prompt version as missing.

### What is baked into the prompt, and what must never be

**Baked in:** opening hours, services and durations, doctors, the booking policy, the address
and contact details, the greeting and tone, the frequently asked answers, and the
never-promise list. All of it changes rarely.

**Never baked in: availability.** Not which slots are free, not "we have space on Tuesday",
not a count of remaining appointments. A prompt is a snapshot taken when somebody last pasted
it into Sarvam, and an agent answering from a snapshot will offer a slot that was taken an
hour ago. The agent is told explicitly that it does not know what is free and must use its
tools. Those tool endpoints arrive with the voice work; until they exist the agent says it
will check rather than claiming to know.

**Never baked in: anything about a patient.** A prompt lives in a provider's configuration,
which is not a place patient data may go.

**The baked set is expected to shrink.** Once the tool endpoints exist, hours and services can
be fetched too, and should be, because the same staleness argument applies to a clinic that
changed its Saturday hours and did not re-paste its prompt. Revisit it then rather than
inheriting it.

## The Sarvam steps that are still manual, in order

Nothing in the platform provisions anything in Sarvam. One agent per clinic with its own tool
secret (D-004), and numbers bought inside Sarvam (D-005).

1. **In our console:** create the clinic and fill in every section except the Sarvam mapping.
   Get the readiness indicator down to the mapping's own items.
2. **In our console:** render the prompt and keep it to hand.
3. **In Sarvam:** create the application for this clinic. Note the app id and version.
4. **In Sarvam:** paste the rendered prompt into the application.
5. **In Sarvam:** buy or assign the phone number patients will dial.
6. **In Sarvam:** create the deployment and the connection that binds the number to the
   application. Note both ids.
7. **In our console:** fill in the Sarvam mapping and save. **Two secrets are generated by us
   and shown exactly once on that save:** the tool secret and the webhook secret. Copy both
   immediately. They are different values because they travel differently: one is a bearer
   header on the tool endpoints, the other is a path segment in the webhook URL, where proxies
   and access logs can see it.
8. **In Sarvam:** configure the tool endpoints with the tool secret, and the deployment's
   webhook URL with the webhook secret in its path. The exact settings are in
   `docs/operations/first-real-call.md`.
9. **In our console:** confirm the readiness indicator reads ready.
10. **Place a test call** to the agent number, following
    `docs/operations/first-real-call.md`, which also says what to verify afterwards and what
    to write down.

**The tool secret is ours to generate, not the operator's to supply.** It is the entire
authentication for the tool endpoints the agent calls, so a secret typed in by a person would
be as strong as whoever typed it felt like making it, and would arrive by whatever channel
they chose. It is minted from the CSPRNG, returned in one response, and stored only as a
SHA-256 hash: no endpoint can read it back.

**Regenerating it breaks the live agent** until the new value is pasted into Sarvam, so the
console asks for confirmation first and an ordinary save never mints a new one.

## The pilot clinic: values to confirm before a real patient call

Sudhir Heart Care Clinic was provisioned on 2026-11-04 from details the clinic gave. Two
consultation prices and durations were confirmed by the clinic. **Every other service's duration
and price is a placeholder** and must be confirmed with the clinic before a real patient call,
because the agent quotes prices aloud and books by duration.

| Service                            | Duration | Price    | Status                  |
| ---------------------------------- | -------- | -------- | ----------------------- |
| Cardiac consultation (first visit) | 15 min   | Rs 700   | Confirmed by the clinic |
| Cardiac consultation (follow-up)   | 15 min   | Rs 400   | Confirmed by the clinic |
| ECG                                | 15 min   | Rs 300   | **Placeholder**         |
| 2D Echo                            | 30 min   | Rs 1,500 | **Placeholder**         |
| TMT (stress test)                  | 45 min   | Rs 2,000 | **Placeholder**         |
| Holter monitoring                  | 15 min   | Rs 2,500 | **Placeholder**         |
| BP and cholesterol management      | 15 min   | Rs 400   | **Placeholder**         |
| Heart check-up                     | 45 min   | Rs 3,000 | **Placeholder**         |

Also not yet stored, because the clinic has not said or the platform has no field for it:

- **No slot length.** Nothing can be booked until it is set.
- **No greeting, and no recording consent decision.** Both are readiness items. The `v1` prompt
  carries its own greeting, so the stored one is for readiness and the console only.
- **No public holiday calendar.** The platform has none. Closure on public holidays is an FAQ
  answer, so the agent can still offer a free slot on a holiday.
- **The doctor's experience and languages, payment modes, walk-ins and the landmark** are stored
  as FAQ answers, because there are no fields for them. `v1` states the experience and payment
  modes itself, in its KNOWLEDGE block.

## Known gaps

- **Only one clinic has approved prompt wording.** `v1` is Sudhir Heart Care Clinic's. The default for any other clinic is still the placeholder.
- **Overnight opening hours are refused.** A clinic open 22:00 to 02:00 cannot be expressed.
  Refused in the schema and by a CHECK constraint rather than stored wrongly.
- ~~**Availability is not fetched.**~~ **CLOSED.** The six tool endpoints exist
  (`docs/features/voice-tools.md`), so the agent can check availability, book, reschedule and
  cancel. What has not happened is a real call: see `docs/operations/first-real-call.md`.
- **Internal admins cannot edit services or doctors**, as above. Revisit when support staff
  onboard clinics.
- **One clinic name, platform-wide.** The double-submit guard assumes same name means
  duplicate. Revisit when multi-branch clinics are in scope.
- **The language tags are not validated against Sarvam's supported set.** They are checked for
  BCP-47 shape only, because that set is the provider's and has not been confirmed. Confirm
  the codes during step 3 above.
- **The admin console has primitives the clinic dashboard does not** (select, textarea, table,
  badge). D-009 holds a copy of the shared layer in each application, and these are new pieces
  rather than changes to shared ones, so copying them into a dashboard that has no form
  needing them would be dead code. When the dashboard grows its first select, port
  `apps/admin-web/src/components/ui/Input.tsx` and `Table.tsx` rather than reinventing them.
  The same applies to the query client added to the console's test harness.
- **`packages/api-client` grew by hand again.** The clinic surface is hand-written for the same
  reason the five auth endpoints are: M1-03 owes the generator, and this enlarges what it has
  to replace. Recorded in `docs/BACKLOG.md`.
- **A clinic cannot be deleted.** Status moves to `SUSPENDED` or `DEACTIVATED` and the records
  are kept, which is the right default for a system holding patient data. There is no
  hard-delete path and nothing in this feature needs one.

## What is tested, and what is not

`pnpm check` covers it: 213 shared contract tests, 660 API tests including the database suite
against real migrations and live row-level security, and 77 console component tests.

The guards worth knowing about, because a new route trips them deliberately:

- `tests/declared-permissions-are-enforced.test.ts` drives every route declaring a permission
  as all six roles and derives the expected answer from the matrix.
- `tests/clinic-configuration-is-audited.test.ts` drives every configuration write and asserts
  the audit row appears, attributed to the actor.
- `tests/password-change-gate.test.ts` requires every new route to be accounted for.
- `pnpm db:check-policies` fails if a tenant table lacks its row-level security.

The browser tests are outside the gate and were run for this feature: 4 of 4 in the admin
console, against a real database and a real browser, which is the only layer that can prove
the refresh cookie is actually sent.

**Not tested:** the Sarvam side of anything. No test places a call, loads a prompt into a
provider or exercises a tool endpoint, because none of that exists yet.
