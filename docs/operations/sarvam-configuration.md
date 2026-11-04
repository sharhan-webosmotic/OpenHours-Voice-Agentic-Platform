# Sarvam agent configuration sheet

A sheet to work from while configuring one clinic's Sarvam agent by hand. It is read from the
code as merged to `main` at `9ffb2a4` (2026-11-04), not from memory. If the code changes, this
sheet is wrong until it is updated.

Companion documents:

- `docs/operations/first-real-call.md`: the runbook, the call script and what to check afterwards
- `docs/sarvam-contract.md`: what Sarvam documents, and what it does not
- `docs/features/voice-tools.md`: why the tools behave as they do

**Every item marked UNKNOWN or UNCONFIRMED is something the first configuration tests rather
than follows.** They are collected in the last section.

## 0. The values you need before starting

| Value               | Where it comes from                                                      | Used in                                   |
| ------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `<api host>`        | The tunnel's public HTTPS host, for example `abc123.ngrok-free.app`      | Every URL below                           |
| `<tool secret>`     | Admin console, clinic page, Sarvam mapping. Shown once when generated    | The `Authorization` header of all 6 tools |
| `<webhook secret>`  | The same place, shown once beside the tool secret. A **different** value | The webhook URL path                      |
| `<organisation id>` | The clinic page URL in the admin console                                 | Webhook `metadata` (cross-check only)     |
| The rendered prompt | Clinic page, "Master prompt", or `pnpm prompt:render "<clinic name>"`    | The agent's instructions in Sarvam        |

If either secret was not copied when it was shown, regenerate it from the console. Regenerating
the tool secret breaks every tool in an agent that still holds the old one. Regenerating the
webhook secret breaks the webhook URL in the deployment that still holds the old one.

## 1. What is the same for all six tools

| Item             | Value                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| URL              | `https://<api host>/voice/tools/<tool>`                                                |
| Method           | `POST`                                                                                 |
| Auth header      | `Authorization: Bearer <tool secret>` (Sarvam auth type "bearer")                      |
| Content type     | `Content-Type: application/json`. The body is JSON, at most 100 kb                     |
| Clinic identity  | **Never in the body.** The clinic is resolved from the secret alone                    |
| Rate limit       | 600 calls a minute per clinic, 3,000 a minute per source address before authentication |
| Not checked here | The source-address allow-list. It guards the webhook only, not the tools               |

The scheme word `Bearer` is matched case-insensitively. The value must follow a single space.
Anything else (no header, another scheme, a wrong or revoked secret, a suspended agent or
clinic) is the same 401.

### The response, for every tool

```json
{ "ok": true, "message": "A whole sentence.", "data": {} }
```

| Field     | Type             | Tell the agent                                                                                                                        |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `message` | string           | **Say this to the caller.** It is always a complete, speakable sentence, including on a refusal. Often it is the next question to ask |
| `ok`      | boolean          | `false` means nothing was done. Do not say anything was booked, moved or cancelled. Follow `message`, which says what is needed       |
| `data`    | object or `null` | For reasoning only, never to be read out. `null` whenever `ok` is `false`. Per-tool fields are below                                  |

Status codes:

| Status | When                                                     | Body                                                                              |
| ------ | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 200    | Every answer, including refusals and unexpected failures | The envelope above                                                                |
| 401    | The secret does not authenticate                         | `{ "ok": false, "message": "This voice agent is not authorised.", "data": null }` |
| 429    | A rate limit is exceeded                                 | `{ "ok": false, "message": "Too many requests.", "data": null }`                  |

Three 200 refusals tell you the configuration, not the caller, is wrong:

| `message`                                                                | Meaning                                                                                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `The request is invalid.`                                                | The body failed validation: a wrong field name, a wrong type, a bad date or time format |
| `Sorry, I did not catch that. Could you say it again?`                   | The body was not valid JSON, or was over the size limit                                 |
| `I am not able to do that right now. I can have somebody call you back.` | An unexpected server failure. The API log has the cause as "voice tool call failed"     |

### Where each body field comes from

Two fields come from Sarvam's **call context**, never from what was said. Everything else comes
from the conversation.

| Field           | Source                                                    | Rule                                                                                                                                  |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `callerNumber`  | Call context: **User Identifier** (the caller's own line) | Must be templated in from the call context. Never filled by the model. It is the only thing that identifies a patient                 |
| `callId`        | Call context: **Interaction ID**, if used at all          | Only meaningful together with `toolCallId`. See the warning under `book`                                                              |
| everything else | The conversation                                          | `date` as `YYYY-MM-DD` and `time` as `HH:MM` (24-hour), both in the **clinic's local time**. The API converts to UTC, never the agent |

`callerNumber` may arrive in any common format (`+919876543210`, `09876543210`, `98765 43210`).
It is normalised with India as the default region. If it is missing or unusable, the caller is
treated as new: nothing is looked up, moved or cancelled.

## 2. The six tools

### 2.1 `clinic-info`

`POST https://<api host>/voice/tools/clinic-info`

Request body:

| Field   | Type   | Required | Values                                                        | Source       |
| ------- | ------ | -------- | ------------------------------------------------------------- | ------------ |
| `topic` | string | no       | `hours`, `address`, `services`, `general` (default `general`) | Conversation |

Example:

```json
{ "topic": "hours" }
```

Response `data` (when `ok` is `true`):

| Field            | Type                                                                                 | Tell the agent                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `name`           | string                                                                               | The clinic's name                                                                                                            |
| `timeZone`       | string, IANA (for example `Asia/Kolkata`)                                            | Ignore. Times it sends and receives are already clinic-local                                                                 |
| `address`        | string or `null`                                                                     | `null` means not known. Do not invent one                                                                                    |
| `hoursCollected` | boolean                                                                              | If `false`, the clinic's hours are **not known**. Never say the clinic is closed on that basis. Offer a call back            |
| `hours`          | array of `{ weekday: "MONDAY".."SUNDAY", opensAtMinute: int, closesAtMinute: int }`  | Minutes from local midnight. A weekday with no entry is a weekly off, but only if `hoursCollected` is `true`                 |
| `services`       | array of `{ id: uuid, name: string, durationMinutes: int, priceMinor: int or null }` | `id` can be passed as `serviceId` to the availability and booking tools. `priceMinor` is in paise (divide by 100 for rupees) |
| `faqs`           | array of `{ question: string, answer: string }`                                      | The clinic's own answers. Use them as written                                                                                |

Example response:

```json
{
  "ok": true,
  "message": "monday: 09:00 to 13:00 and 16:00 to 20:00; tuesday: 09:00 to 13:00",
  "data": {
    "name": "Sunrise Dental",
    "timeZone": "Asia/Kolkata",
    "address": "12 MG Road, Pune, Maharashtra, 411001",
    "hoursCollected": true,
    "hours": [
      { "weekday": "MONDAY", "opensAtMinute": 540, "closesAtMinute": 780 },
      { "weekday": "MONDAY", "opensAtMinute": 960, "closesAtMinute": 1200 },
      { "weekday": "TUESDAY", "opensAtMinute": 540, "closesAtMinute": 780 }
    ],
    "services": [
      {
        "id": "0192f0a1-0000-7000-8000-000000000001",
        "name": "Consultation",
        "durationMinutes": 30,
        "priceMinor": 50000
      }
    ],
    "faqs": [{ "question": "Is there parking?", "answer": "Yes, in the basement." }]
  }
}
```

### 2.2 `lookup-patient`

`POST https://<api host>/voice/tools/lookup-patient`

Request body:

| Field          | Type   | Required | Source                            |
| -------------- | ------ | -------- | --------------------------------- |
| `callerNumber` | string | no       | **Call context: User Identifier** |
| `fullName`     | string | no       | Conversation, once asked          |

Example:

```json
{ "callerNumber": "+919876543210" }
```

Response `data`:

| Field       | Type    | Tell the agent                                                                                                        |
| ----------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `found`     | boolean | `true`: the caller's line has exactly one matching record. Proceed. The stored name is never returned, and never said |
| `needsName` | boolean | `true`: ask for the full name (the `message` does), then call this tool again with `fullName` added                   |

`found: false, needsName: false` means a new caller whose name is already given. Proceed as a
new patient. Several records on one line (a family) returns `needsName: true`, and the names
are never listed.

```json
{
  "ok": true,
  "message": "Could I take your full name, please?",
  "data": { "found": false, "needsName": true }
}
```

### 2.3 `check-availability`

`POST https://<api host>/voice/tools/check-availability`

Request body:

| Field         | Type                | Required | Source                          |
| ------------- | ------------------- | -------- | ------------------------------- |
| `date`        | string `YYYY-MM-DD` | **yes**  | Conversation, clinic-local date |
| `doctorId`    | uuid                | no       | A previous tool's `data`        |
| `doctorName`  | string              | no       | Conversation                    |
| `serviceId`   | uuid                | no       | `clinic-info` `services[].id`   |
| `serviceName` | string              | no       | Conversation                    |

There is no `callerNumber` here: a slot list names nobody. Send an id when one is known,
otherwise the name the caller used. If neither is sent, the clinic's only doctor or service is
used, and the agent is asked which one when there is more than one.

```json
{ "date": "2026-11-10", "serviceName": "consultation" }
```

Response `data` when there are free slots:

| Field       | Type                                                            | Tell the agent                                                                                       |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `date`      | string `YYYY-MM-DD`                                             | The day checked                                                                                      |
| `timeZone`  | string                                                          | Ignore                                                                                               |
| `doctorId`  | uuid                                                            | **Pass it to `book` unchanged**, so the booking is for the same doctor                               |
| `serviceId` | uuid                                                            | **Pass it to `book` unchanged**                                                                      |
| `slots`     | array of `{ startAt: ISO UTC, endAt: ISO UTC, label: "HH:MM" }` | Offer **only** these. `label` is the clinic-local time, in exactly the format `book` takes as `time` |
| `reason`    | `null`                                                          |                                                                                                      |

When the day has nothing free, `ok` is still `true`, `slots` is `[]`, and `reason` is one of
`HOURS_NOT_COLLECTED`, `CLINIC_CLOSED`, `DOCTOR_NOT_WORKING`, `DAY_IN_THE_PAST`,
`BEYOND_MAXIMUM_ADVANCE`, or another value meaning simply fully booked. The `message` already
says the right thing. `HOURS_NOT_COLLECTED` is never "closed".

When the doctor or service cannot be resolved, `ok` is `false` and `message` is the question to
ask ("Which doctor would you like to see?").

```json
{
  "ok": true,
  "message": "There is 10:00, 10:30, 11:00 and more on that day. Which would you like?",
  "data": {
    "date": "2026-11-10",
    "timeZone": "Asia/Kolkata",
    "doctorId": "0192f0a1-0000-7000-8000-0000000000d1",
    "serviceId": "0192f0a1-0000-7000-8000-000000000001",
    "slots": [
      {
        "startAt": "2026-11-10T04:30:00.000Z",
        "endAt": "2026-11-10T05:00:00.000Z",
        "label": "10:00"
      }
    ],
    "reason": null
  }
}
```

### 2.4 `book`

`POST https://<api host>/voice/tools/book`

Request body:

| Field          | Type                | Required | Source                                                                         |
| -------------- | ------------------- | -------- | ------------------------------------------------------------------------------ |
| `callerNumber` | string              | no       | **Call context: User Identifier**                                              |
| `phone`        | string              | no       | Conversation. Only needed when the caller's line is withheld or unusable       |
| `fullName`     | string              | no       | Conversation. Required for a new caller, and for a line several patients share |
| `date`         | string `YYYY-MM-DD` | **yes**  | Conversation, clinic-local                                                     |
| `time`         | string `HH:MM`      | **yes**  | A `label` from `check-availability`                                            |
| `doctorId`     | uuid                | no       | `check-availability` `data.doctorId`                                           |
| `doctorName`   | string              | no       | Conversation, if no id                                                         |
| `serviceId`    | uuid                | no       | `check-availability` `data.serviceId`                                          |
| `serviceName`  | string              | no       | Conversation, if no id                                                         |
| `callId`       | string              | no       | Call context: Interaction ID. **Leave out** for now, see below                 |
| `toolCallId`   | string              | no       | **Leave out.** No known source                                                 |

Optional header: `Idempotency-Key`, up to 200 printable characters.

```json
{
  "callerNumber": "+919876543210",
  "fullName": "Asha Rao",
  "date": "2026-11-10",
  "time": "10:00",
  "doctorId": "0192f0a1-0000-7000-8000-0000000000d1",
  "serviceId": "0192f0a1-0000-7000-8000-000000000001"
}
```

Response `data`:

| Field           | Type    | Tell the agent                                                                                         |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `appointmentId` | uuid    | Keep it for the rest of the call. Pass it to `reschedule` or `cancel` if the caller changes their mind |
| `startAt`       | ISO UTC | Ignore. Confirm the time the caller chose, which `message` already does                                |
| `endAt`         | ISO UTC | Ignore                                                                                                 |
| `replayed`      | boolean | `true`: this exact booking already existed and nothing new was made                                    |

```json
{
  "ok": true,
  "message": "That is booked for 10:00 on 2026-11-10.",
  "data": {
    "appointmentId": "0192f0a1-0000-7000-8000-0000000000a1",
    "startAt": "2026-11-10T04:30:00.000Z",
    "endAt": "2026-11-10T05:00:00.000Z",
    "replayed": false
  }
}
```

A refused booking (slot taken, too little notice, unknown doctor, missing name or number) is
`ok: false` with the question or explanation in `message`. Nothing is created, including the
new patient's record.

**Warning on duplicate protection.** A retried call is recognised as a replay only when the
body carries **both** `callId` and `toolCallId`, or when the `Idempotency-Key` header is set.
Do **not** configure a fixed `Idempotency-Key` header or a fixed `toolCallId` in Sarvam: every
later booking for that clinic would be answered as a replay of the first, and nothing new would
be booked. Sarvam is not known to supply a per-invocation id (UNKNOWN), so for the first calls
leave all three out. The cost is that a tool call Sarvam retries books twice, and whether
Sarvam retries is also UNKNOWN.

### 2.5 `reschedule`

`POST https://<api host>/voice/tools/reschedule`

Request body:

| Field                  | Type                | Required | Source                                                                     |
| ---------------------- | ------------------- | -------- | -------------------------------------------------------------------------- |
| `callerNumber`         | string              | no*      | **Call context: User Identifier**. *Without it, nothing can be moved       |
| `appointmentId`        | uuid                | no       | `book`'s `data.appointmentId`, only if booked earlier **in the same call** |
| `fullName`             | string              | no       | Conversation, when the line is shared                                      |
| `date`                 | string `YYYY-MM-DD` | **yes**  | The new day, clinic-local                                                  |
| `time`                 | string `HH:MM`      | **yes**  | The new time, ideally a `label` from `check-availability`                  |
| `callId`, `toolCallId` | string              | no       | Accepted and **not used**. Leave out                                       |

```json
{ "callerNumber": "+919876543210", "date": "2026-11-12", "time": "16:30" }
```

Response `data`:

| Field           | Type    | Tell the agent         |
| --------------- | ------- | ---------------------- |
| `appointmentId` | uuid    | Keep it, as for `book` |
| `startAt`       | ISO UTC | Ignore                 |
| `endAt`         | ISO UTC | Ignore                 |

Only the caller's own line's upcoming appointments can be moved. With exactly one, it is moved.
With none, or an `appointmentId` that is not theirs, the answer is a call-back offer. With more
than one, the agent is asked "Which day were you calling about?", and see the limitation in
section 5: there is no field to send that answer.

### 2.6 `cancel`

`POST https://<api host>/voice/tools/cancel`

Request body:

| Field                  | Type   | Required | Source                                                                   |
| ---------------------- | ------ | -------- | ------------------------------------------------------------------------ |
| `callerNumber`         | string | no*      | **Call context: User Identifier**. *Without it, nothing can be cancelled |
| `appointmentId`        | uuid   | no       | As for `reschedule`                                                      |
| `fullName`             | string | no       | Conversation, when the line is shared                                    |
| `reason`               | string | no       | Conversation, at most 500 characters. Tell the agent: no symptoms here   |
| `callId`, `toolCallId` | string | no       | Accepted and **not used**. Leave out                                     |

```json
{ "callerNumber": "+919876543210", "reason": "The patient asked to cancel" }
```

Response `data`:

| Field           | Type   | Tell the agent            |
| --------------- | ------ | ------------------------- |
| `appointmentId` | uuid   | The cancelled appointment |
| `cancelled`     | `true` |                           |

Same ownership rule and the same limitation as `reschedule`.

## 3. The webhook

| Item     | Value                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Where    | The **deployment's** `webhook_config.url`, not a tool                                                              |
| URL      | `https://<api host>/webhooks/sarvam/<webhook secret>`                                                              |
| Secret   | The whole last path segment, as shown in the console. 20 to 200 characters. Nothing in the query string, no header |
| Method   | `POST`, JSON body, at most 1 MB                                                                                    |
| Metadata | `webhook_config.metadata`: `{ "clinic_id": "<organisation id>" }`                                                  |

The URL is a credential. It is redacted from the API's own request log, but anything else that
sees the URL (the tunnel's inspector, for one) sees the secret.

What we answer:

| Status | Body                                                     | When                                                                                                                                               |
| ------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200    | `{ "ok": true, "received": true, "eventId": "<uuid>" }`  | Stored for the first time, and a job enqueued                                                                                                      |
| 200    | `{ "ok": true, "received": false, "eventId": "<uuid>" }` | The same `interaction_id` was already stored. Nothing new happens                                                                                  |
| 200    | `{ "ok": false, "received": false }`                     | The body failed validation, or could not be read. **Not stored.** Logged as "webhook refused: body failed validation" with the failing field paths |
| 404    | problem+json                                             | Unknown secret, suspended agent or clinic, or a source address not on the allow-list. All look the same                                            |
| 429    | problem+json                                             | More than 600 requests a minute from one address                                                                                                   |

What we do with each field of Sarvam's payload:

| Field                                             | Required | What happens to it                                                                                                                                                                                                                    |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interaction_id`                                  | **yes**  | The deduplication key and the call's provider id. Printable ASCII, at most 200. Used later to fetch the recording and to verify the call                                                                                              |
| `user_phone_number`                               | no       | Normalised to E.164 and stored as the call's caller. If exactly one patient has that number, the call is linked to them. Unusable becomes empty                                                                                       |
| `agent_phone_number`                              | no       | Normalised and stored as the number dialled. Parsed for routing but **not used** to choose the clinic                                                                                                                                 |
| `deployment_id`                                   | no       | Parsed, **not used**. The clinic comes from the URL secret                                                                                                                                                                            |
| `app_id`, `app_version`                           | no       | Validated, **not used**. The recording fetch uses the app id saved in our console                                                                                                                                                     |
| `duration`                                        | no       | Seconds, number or numeric string. Above 0 marks the call `COMPLETED`, otherwise `MISSED`                                                                                                                                             |
| `start_datetime`, `end_datetime`                  | no       | Parsed as dates. An unparseable value is stored as empty, never as a wrong date                                                                                                                                                       |
| `interaction_transcript[]`                        | no       | Each turn's `role` maps `assistant`/`agent`/`bot` to Agent, `user`/`caller`/`customer` to Caller, anything else to Other. `en_text` is stored, `indic_text` only when there is no English. Empty turns are dropped. Up to 2,000 turns |
| `metadata.clinic_id`                              | no       | Cross-check only. A mismatch with the secret's clinic is logged and ignored                                                                                                                                                           |
| `final_agent_variables`, `output_agent_variables` | no       | Validated, **not used**                                                                                                                                                                                                               |
| `attempt_id`                                      | no       | Its presence marks the call as outbound                                                                                                                                                                                               |
| `status`, `failure_reason`                        | no       | Validated, **not used**                                                                                                                                                                                                               |
| any other field                                   | no       | Ignored by the parser                                                                                                                                                                                                                 |

The **whole raw body** is stored unaltered in `webhook_events.payload`, so every field above,
used or not, can be compared against the contract afterwards. A job then creates the call and
its transcript, and a second job copies the recording into our bucket and checks the
interaction against Sarvam's interactions list (needs the three `SARVAM_*` credentials below).

## 4. Environment for a tunnelled run

The tunnel (ngrok, cloudflared or similar) forwards public HTTPS to the API on this machine.
Only the API needs to be reachable from outside. The dashboards stay on `localhost`.

```dotenv
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
DATABASE_URL=postgresql://app_user:<password>@127.0.0.1:5432/clinicai
JWT_SECRET=<at least 32 characters, random>

# The tunnel is exactly one proxy hop in front of the API.
TRUST_PROXY=1

# Choose EXACTLY ONE of these two. The API refuses to start with neither or both.
SARVAM_WEBHOOK_SOURCE_IPS=4.213.167.70,35.154.84.150
# SARVAM_WEBHOOK_IP_CHECK_DISABLED=true

# Needed by the recording copy and the call verification, not by the tools or the webhook.
SARVAM_API_KEY=<workspace API key>
SARVAM_ORG_ID=<org id>
SARVAM_WORKSPACE_ID=<workspace id>
# SARVAM_ANALYTICS_BASE_URL defaults to https://apps.sarvam.ai/api/analytics

# Recordings. Local SeaweedFS shown. For R2, use its endpoint and AWS_REGION=auto.
S3_ENDPOINT=http://127.0.0.1:8333
AWS_REGION=ap-south-1
S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
RECORDINGS_BUCKET=clinicai-recordings

# Only for the dashboards on plain-HTTP localhost.
COOKIE_SECURE=false
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

Ports, the database URL and the dashboard origins above are examples. Use your local values.

**Why `TRUST_PROXY=1` and not the default `false`.** Behind a tunnel every request reaches the
API from the tunnel's local agent, so with `false` the API sees `127.0.0.1` as the source of
every webhook, the allow-list refuses them all with a 404, and the log says "webhook refused:
source address is not allow-listed" with `address: 127.0.0.1`. With `1`, the API takes the
right-most `X-Forwarded-For` entry, which is the one the tunnel appended: Sarvam's real address.
`true` is refused at startup, because it would let a caller choose its own address.

**Only set `1` while all traffic comes through the tunnel.** With `TRUST_PROXY=1`, anybody who
can reach the port directly can write any address into `X-Forwarded-For` and pass the
allow-list. Do not expose the API's port another way during the run.

**Which webhook choice to start with.** Start with the allow-list on. Whether those two
addresses apply to webhooks is UNKNOWN, and that is exactly what this run can show. If the call's
webhook is refused with a 404 and the log names an address that is not `127.0.0.1`, that address
is the answer: write it down, then switch to `SARVAM_WEBHOOK_IP_CHECK_DISABLED=true` (and remove
the list) as `first-real-call.md` step 10 describes. If the log says `127.0.0.1`, the problem is
`TRUST_PROXY`, not Sarvam.

The tool endpoints do not use the allow-list, so they work either way.

## 5. What is UNKNOWN: testing, not following

From `docs/sarvam-contract.md` and the code. Each of these is what the first configuration
finds out.

| #   | Item                                                                                                          | Status                                             | What the run shows                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | The exact request an API tool sends: how the body is templated and how call-context variables are substituted | UNKNOWN (contract Q3)                              | Whether the bodies in section 2 arrive as written. `The request is invalid.` spoken on a call means they do not     |
| 2   | The syntax for inserting **User Identifier** into a tool body, and the number's format                        | UNKNOWN (Q3)                                       | Whether `callerNumber` arrives at all. If not, every caller is treated as new and nothing can be moved or cancelled |
| 3   | Whether the bearer header is sent exactly as `Authorization: Bearer <secret>`                                 | Documented as an option, exact request UNKNOWN     | A 401 on every tool. The fallback (secret in the path) needs a code change                                          |
| 4   | What the agent does on a 401, a 429 or a timeout                                                              | UNKNOWN (Q3)                                       | What the caller hears when a tool fails outright                                                                    |
| 5   | Whether a tool receives a per-invocation id, and whether Sarvam retries a tool call                           | UNKNOWN                                            | Whether a retried `book` can double-book. Until known, the duplicate protection is off (section 2.4)                |
| 6   | Whether a tool receives the dialled number or deployment metadata                                             | UNKNOWN (Q4)                                       | Nothing on this run depends on it: one agent per clinic is the design                                               |
| 7   | Response templates: how our JSON is turned into what the agent says and uses                                  | Documented as existing, syntax not in the contract | Whether `message` is spoken and `data` is visible to the model                                                      |
| 8   | Whether the webhook is signed                                                                                 | Nothing documented (Q1)                            | Look for any signature header on the stored request. We do not check one                                            |
| 9   | Whether the published source addresses apply to webhooks                                                      | UNKNOWN (Q1)                                       | Section 4: the address in the log                                                                                   |
| 10  | Whether webhooks are retried, and what counts as success                                                      | UNKNOWN (Q2)                                       | Repeat deliveries show as `received: false`. We always answer 200 except for the 404 cases                          |
| 11  | The webhook payload as actually sent: date format of `start_datetime`, the `role` values, `duration`'s type   | Fields documented, formats not                     | Compare `webhook_events.payload` against section 3. The adapter's test fixture is synthetic until then              |
| 12  | Whether the interactions list cleanly omits an unknown id                                                     | UNCONFIRMED (contract section 7)                   | `first-real-call.md` step 12. A call marked "Sarvam has no record" is a reason to look, not proof of forgery        |
| 13  | `phone_numbers[]` against `agent_phone_number` in the deployment's `connection_configs`                       | Doc inconsistency (Q8)                             | Which one the dashboard or API accepts                                                                              |
| 14  | Pausing a deployment by API                                                                                   | UNKNOWN (Q8)                                       | Rollback may mean deleting the deployment                                                                           |

One limitation that is ours, not Sarvam's: **a caller with more than one upcoming appointment
cannot move or cancel either by voice.** The tools ask "Which day were you calling about?", but
there is no body field for the answer, and the agent has no way to learn the `appointmentId` of
an appointment booked on an earlier call. Such a caller is offered a call back in practice. Test
it only to confirm that is what happens.
