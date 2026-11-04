# The first real call: runbook

Phase 4 of the clinic dashboard feature. Everything here is manual, and **every step marked
EXTERNAL changes something outside this repository** (Sarvam's configuration, a real telephone
number, a deployed environment). None of those have been taken.

Read `docs/features/pilot-clinic.md` first: it has the clinic-provisioning sequence this
extends. Read `docs/sarvam-contract.md` for what Sarvam documents and what it does not.

## Before anything: what must be true

| Check                                                 | How                                                            | Why it blocks                                                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations applied, including the two from this phase | `pnpm db:migrate && pnpm db:sql`                               | `webhook_secret_hash` and `call_transcript_turns` are new. `db:sql` is what gives the new table its row-level security policy                  |
| Policies intact                                       | `pnpm db:check-policies`                                       | A tenant table without a policy is a tenant table without its second lock                                                                      |
| The gate is green                                     | `pnpm check`                                                   | 941 API tests, 202 in the dashboard                                                                                                            |
| The API has Sarvam's credentials                      | `SARVAM_API_KEY`, `SARVAM_ORG_ID`, `SARVAM_WORKSPACE_ID`       | Without them the transcript fetch, the recording copy and the authoritative re-read all refuse at the point of use, naming the missing setting |
| Object storage is reachable                           | `RECORDINGS_BUCKET` exists and the credentials can write to it | The recording job fails and retries six times otherwise                                                                                        |
| The job runner started                                | `job runner started` in the log at boot                        | Without it the webhook still stores every event, and the hourly catch-up is what eventually ingests them                                       |

## The sequence

Steps 1 to 7 are `docs/features/pilot-clinic.md`'s. What follows replaces its step 8.

### 8. Configure the tool endpoints in Sarvam — EXTERNAL

One API tool per endpoint. For each:

- **URL:** `https://<api host>/voice/tools/<tool>`, where `<tool>` is one of `clinic-info`,
  `lookup-patient`, `check-availability`, `book`, `reschedule`, `cancel`.
- **Method:** `POST`.
- **Auth:** bearer, with the tool secret from step 7. The contract says Sarvam's API tool
  supports none, bearer, api_key and basic (section 2), so bearer is available; what is
  **UNKNOWN** is the exact request it sends, which is question 3 to Sarvam.
- **Body:** JSON, with the clinic-local `date` as `YYYY-MM-DD` and `time` as `HH:MM`, and the
  caller's number from the `User Identifier` call-context variable. The full field list per
  tool is in `apps/api/src/voice/tools.schemas.ts`.
- **Response template:** speak `message`. Every answer is an HTTP 200 carrying
  `{ ok, message, data }`, so the agent always has a sentence (D-022).

Do not send the clinic's id in any body. The clinic is resolved from the secret and a body
that named one would be ignored.

### 9. Configure the webhook in Sarvam — EXTERNAL

In the deployment's `webhook_config`:

- **url:** `https://<api host>/webhooks/sarvam/<webhook secret>`, using the webhook secret
  shown once beside the tool secret in step 7. It is a different value from the tool secret on
  purpose: this one travels in a URL, where proxies and access logs can see it.
- **metadata:** `{ "clinic_id": "<organisation id>" }`. It is a **cross-check only**. The
  clinic comes from the secret in the path, and a mismatch is logged and ignored.

### 10. Turn on the source-address allow-list — EXTERNAL (configuration)

Set `SARVAM_WEBHOOK_SOURCE_IPS=4.213.167.70,35.154.84.150`, the two addresses the contract
publishes (section 2). The API will not start without a choice here (D-006): either this list,
or `SARVAM_WEBHOOK_IP_CHECK_DISABLED=true`, which runs without the check and should be a
deliberate decision for this deployment, not a default.

**UNKNOWN, and worth confirming before relying on it:** whether those addresses apply to
webhooks as well as to tool calls. The contract marks it so. If a test call's webhook is
refused with a 404 and the log says the source address is not allow-listed, that is the answer:
replace the list with `SARVAM_WEBHOOK_IP_CHECK_DISABLED=true`, record what was observed, and
rely on the URL secret and the after-the-fact verification until the right addresses are known.

### 11. Place the call — EXTERNAL

Dial the agent number from a phone whose number is **not** a patient record, then:

1. Ask the clinic's timings. (`clinic-info`)
2. Ask for an appointment, give a name when asked. (`lookup-patient`, `check-availability`)
3. Accept a time. (`book`)
4. Ring again and move it. (`reschedule`)
5. Ring again and cancel it. (`cancel`)
6. Deliberately ask for a time that is already taken, and one on a day the clinic is closed.

### 12. Verify, in this order

| What                       | Where                | What good looks like                                                                                                                             |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| The booking                | Appointments screen  | The appointment, with "AI Booking" as its status                                                                                                 |
| The call                   | Call History         | One row per call, newest first, with the duration                                                                                                |
| The transcript             | The call drawer      | The conversation, each turn attributed                                                                                                           |
| The recording              | The call drawer      | "Play recording" appears and plays. If it says the copy may still be running, wait for the job and reload                                        |
| The audit trail            | `audit_logs`         | `call.webhook_received`, `call.ingested`, `appointment.created` with `metadata.source = VOICE_AGENT`, and `call.recording_accessed` for the play |
| The inbox                  | `webhook_events`     | `status = 'PROCESSED'`, `attempts = 1`                                                                                                           |
| No patient data in the log | The API's own output | No name, no number, no sentence of the conversation                                                                                              |

## What to do when it does not work

| Symptom                                                                        | First thing to check                                                                                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The agent says it cannot do that, every time                                   | The tool secret. A 401 from `/voice/tools/*` is in the API log as "voice tool call refused"                                                                     |
| The agent books but the call history stays empty                               | The webhook URL's secret, and the IP allow-list. A refused webhook is a 404 and logs "webhook refused"                                                          |
| A call row appears with no transcript                                          | The webhook carried none: the transcript is taken from the payload as it arrived, with no separate fetch. Look at the stored event's `interaction_transcript`   |
| A webhook is answered `{ "ok": false, "received": false }` and no call appears | The body failed validation. The log line "webhook refused: body failed validation" names the failing field paths                                                |
| The Call History drawer says "Sarvam has no record of this call"               | The interactions lookup did not find it. Check `SARVAM_ORG_ID` and `SARVAM_WORKSPACE_ID` before suspecting a forgery: a wrong workspace looks exactly like this |
| Everything works and no recording arrives                                      | `RECORDINGS_BUCKET` and the storage credentials. The job logs its failure with the status Sarvam answered                                                       |

## Rolling back — EXTERNAL

There is no deployment to roll back in this phase, so rolling back means taking the agent off
the air, in this order:

1. **In Sarvam:** pause or delete the deployment, which stops calls reaching the agent. Pausing
   by API is **UNKNOWN** (contract section 3), so this may mean deleting the deployment.
2. **In our console:** regenerate the tool secret, which invalidates the one Sarvam holds and
   makes every tool call fail closed. Confirmed explicitly, because it is not reversible.
3. Leave the data. Calls, transcripts and recordings already ingested are the clinic's records.

## After the call: the one thing that must be written down

**Compare what arrived against `docs/sarvam-contract.md` and record every difference there.**
The raw body of each call is in `webhook_events.payload`, so this is a comparison against data
rather than against memory. The adapter in `apps/api/src/voice/providers/sarvam.ts` is marked
provisional for exactly this reason, and its fixture
(`src/voice/providers/__fixtures__/inbound-call-finished.ts`) is synthetic until a real payload
replaces it.

Four questions from the contract's own list should have answers after this call, and they are
the ones that change the design rather than the wording:

1. Is a webhook signed, and do the published source addresses apply to it?
2. Are deliveries retried, and what counts as a success?
3. What exactly does an API tool send, and what does it do on a timeout or a non-2xx?
4. Can a tool receive the dialled number or the deployment metadata? This one decides whether
   one shared agent is possible instead of one per clinic.
