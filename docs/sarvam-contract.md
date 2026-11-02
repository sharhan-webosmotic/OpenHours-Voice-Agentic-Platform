# Sarvam voice agent contract (for OpenHours)

Source: official Sarvam docs (docs.sarvam.ai/voice-agents), read 2026-10-27.
Rule: only what the docs state is written as fact. Anything else is marked **UNKNOWN** and is a question for Sarvam (section 9). Do not code against an UNKNOWN; hide it behind the `VoiceProvider` adapter and a config flag.

## 1. Common

- Auth on every management API call: header `X-API-Key: <workspace key>` (Settings -> API Key). Bearer tokens are not accepted on analytics.
- IDs: `org_id`, `workspace_id` (dashboard URL or Settings), `app_id` (agent id, "Copy agent ID"), `deployment_id`, `interaction_id` (`<YYYYMMDD>/<id>`, contains a slash, send as-is or `%2F`; without a slash -> 400), `attempt_id`.
- Base URLs (v1):
  - Deployments: `https://apps.sarvam.ai/api/app-authoring`
  - Campaigns, cohorts, webhook deliveries: `https://apps.sarvam.ai/api/scheduling`
  - Instant outbound: `https://apps.sarvam.ai/api/outbounds`
  - Analytics: `https://apps.sarvam.ai/api/analytics`
- Path style differs: deployments/scheduling/outbounds use `/v1/orgs/{org_id}/workspaces/{workspace_id}/...`; analytics uses `/v1/{org_id}/{workspace_id}/{app_id}/...`.
- Errors: `detail` (string); 422 = list of `{loc,msg,type}` or `{error:{code,message}}` depending on service. 429 has `Retry-After` (seconds). 500/503: retry with backoff. Rate limits are per API key, set per org; numbers UNKNOWN.
- Phone numbers (`user_contact`) are unmasked personal data: never log them; store encrypted/hashed per our rules.

## 2. Feature: mid-call tools (check availability, book, reschedule, cancel, clinic info)

Mechanism: the agent's **API tool** calls our HTTPS endpoint.

Documented:

- Methods GET/POST/PUT/PATCH/DELETE; URL, headers and body are configured in the Sarvam dashboard per tool.
- Auth options: none, bearer, api_key, basic. Secrets are stored in the Sarvam workspace and referenced by the tool.
- A response template turns our JSON into what the agent says/uses. Max wait is up to 30 s (we target p95 < 400 ms).
- Modes: run (during the conversation), on_start, on_end.
- Call-context variables available to tools: User Identifier (caller phone), Call Transcript, Interaction ID, Call Length.
- Sarvam egress IPs: `4.213.167.70`, `35.154.84.150` (allowlist at the edge as defence in depth, not as the only auth).

Our endpoints (design, not Sarvam-defined): `POST /voice/tools/{check-availability|book|reschedule|cancel|clinic-info}`, always HTTP 200 with `{ok, message, data}` so the agent can speak the failure.

**UNKNOWN:** exact request wire format Sarvam sends (is body a template we author? are variables substituted by us in JSON?); behaviour on non-2xx/timeout; how the dialled (agent) number or a clinic identifier reaches the tool.
**Design that works regardless:** one Sarvam agent (or tool config) per clinic, each tool configured with a per-clinic secret (`Authorization: Bearer <clinic tool token>`) and the caller phone as `User Identifier` in the body. Clinic is resolved from the token, never from the body. Rotating = update the Sarvam secret. This costs setup per clinic but needs no undocumented behaviour. If Sarvam confirms the dialled number or deployment metadata reaches tools, one shared agent becomes possible.

## 3. Feature: inbound call finished (log call, transcript, outcome)

Create/maintain per clinic: `POST /api/app-authoring/v1/orgs/{org}/workspaces/{ws}/deployments`
Body: `name` (<=50), `app_id`, `app_version` (int), `connection_configs[]` {`connection_id`, `agent_phone_number`}, optional `description` (<=150), `inbound_config` {`start_time`,`end_time` HH:MM, `allowed_days[]`, `timezone` default Asia/Kolkata}, optional `webhook_config` {`url`, `metadata{}`}.
Response 200: `deployment_id`, `app_id`, `app_version`, `connection_configs`, `channel_direction`, `status` (`active`|`paused`), timestamps, etc. Created active immediately.
Update: `PATCH .../deployments/{deployment_id}` with any subset of the same fields (no `status` field: pause/resume is **UNKNOWN**).
Doc inconsistency: examples show `phone_numbers[]` inside `connection_configs`, schema says `agent_phone_number` (string). Test against the real API; wrap in adapter.

Webhook we receive after each inbound call (fields documented): `app_id`, `app_version`, `deployment_id`, `interaction_id`, `user_phone_number`, `agent_phone_number`, `duration`, `final_agent_variables`, `output_agent_variables`, `start_datetime`, `end_datetime`, `interaction_transcript[]` {`role`, `en_text`, `indic_text?`}, `metadata` (our `webhook_config.metadata`, e.g. clinic id).
Clinic resolution: by `deployment_id` / `agent_phone_number` lookup in our table, cross-checked with `metadata.clinic_id`.
Idempotency key: `interaction_id` (unique per provider).

## 4. Feature: outbound reminder and confirmation calls

Instant outbound: `POST https://apps.sarvam.ai/api/outbounds/v1/orgs/{org}/workspaces/{ws}/outbounds`
Body:

```json
{
  "app_config": {
    "app_id": "...",
    "app_version": 3,
    "app_type": "agent",
    "connection_config": { "connection_id": "...", "agent_phone_number": "+91..." },
    "agent_variables": {
      "patient_first_name": "...",
      "appointment_time": "...",
      "appointment_id": "..."
    },
    "app_overrides": {
      "initial_bot_message": "...",
      "initial_state_name": "...",
      "initial_language_name": "..."
    }
  },
  "user_config": { "user_phone_number": "+91..." },
  "webhook_config": {
    "url": "https://api.../webhooks/sarvam",
    "metadata": { "outbound_call_id": "<our id>" }
  }
}
```

Response: `{ "attempt_id": "..." }` -> store on `outbound_calls.provider_attempt_id`.
Webhook on completion: `attempt_id`, `status` (`connected`|`no_answer`|`busy`|`failed`), `channel_info`, `duration`, `interaction_id`, `failure_reason`, `final_agent_variables`, `webhook_config` (echoed, includes our metadata), `interaction_transcript[]` {`role`,`en_text`}.
Mapping to our state machine: connected -> COMPLETED, no_answer/busy -> NO_ANSWER (retry per rules), failed -> FAILED.
Idempotency: our `dedupe_key` on `outbound_calls` prevents double-calling; Sarvam-side dedupe is **UNKNOWN**, so never retry a create blindly (an HTTP timeout may still have placed the call: reconcile via attempts list before retrying).
Campaigns/cohorts exist (`/api/scheduling`) but are not needed for MVP.
**UNKNOWN:** DND/NDNC scrubbing responsibility, calling-hour enforcement, per-call price; confirm with Sarvam/telephony provider. We enforce our own window (e.g. 09:00-20:00 clinic time) before calling.

## 5. Feature: recording and transcript retrieval

- Transcript: `GET /api/analytics/v1/{org}/{ws}/{app_id}/transcripts/{interaction_id}` -> `{interaction_id, messages:[{turn_id, role: assistant|user, content, language_name}]}`. Unknown id returns 200 with empty `messages` (do not treat as error; retry later). No per-turn timestamps.
- Recording: `GET .../recordings/{interaction_id}` -> `audio/wav` binary stream (not JSON, no signed URL, no documented expiry). Our job downloads it and writes to our S3 (SSE, tenant-prefixed key), then serves staff via short-lived presigned URLs and audit-logs each access. Do the download in a pg-boss job after the webhook (idempotent by interaction_id).
- List interactions: `GET .../interactions?start_datetime&end_datetime[&limit<=1000&offset&sort_by&sort_order&filter_conditions&include_transcript]`; list attempts: `GET .../attempts` (same filters). Both cached 60 s. Fields incl. `ended_by`, `failure_reason`, `duration_in_seconds`, `channel_direction`, `language_name`, `agent_variables`, `audio_url`, `goal_overall_status`. No cost field.
- Use these list endpoints for the **reconciliation job** (see 6), not for the hot path.
- Retention at Sarvam: **UNKNOWN**. We must copy what we need.

## 6. Webhook reliability (our side)

Documented: webhook deliveries can be listed (`GET /api/scheduling/v1/orgs/{org}/workspaces/{ws}/deployments/{deployment_id}/webhooks`, filter `status` running|completed|failed, cursor paging, fields `attempt_id`,`status`,`start_time`,`close_time`) and re-sent manually (`POST .../webhooks/retry` body `{attempt_ids:[<=200]}` -> 202 queued).
**UNKNOWN:** automatic retries, timeout, which response code counts as success, signature/secret.
Our design: `/webhooks/sarvam` verifies what can be verified (see 7), writes the raw event to `webhook_inbox` (unique `provider+external_event_id`), returns 200 immediately, processes in a job. Daily and hourly reconciliation job: list interactions/attempts for the last N hours, compare with `calls`/`outbound_calls`, ingest anything missing; also use the webhook-deliveries list + retry for failed ones.

## 7. Webhook authentication (the main gap)

Documented: nothing about signing. `webhook_config` has only `url` and `metadata`.
Workable mitigations until Sarvam answers (use all):

1. Put a long random per-deployment secret in the URL path or query: `/webhooks/sarvam/{deployment_secret}`; store only its hash; rotate by `PATCH` deployment.
2. Allowlist Sarvam IPs `4.213.167.70`, `35.154.84.150` (verify whether they apply to webhooks too: **UNKNOWN**).
3. Never trust payload fields for authorisation: look up clinic by `deployment_id`/`agent_phone_number` in our DB; ignore unknown ones.
4. Re-fetch the interaction from the analytics API (authenticated by our key) before acting on anything sensitive. Cheap, and it makes a forged webhook harmless.

## 8. Mapping to our tables

| Sarvam                                                   | Ours                                                 |
| -------------------------------------------------------- | ---------------------------------------------------- |
| deployment_id, app_id, connection_id, agent_phone_number | `voice_agents` / `clinic_phone_numbers` (per clinic) |
| interaction_id                                           | `calls.provider_interaction_id` (unique)             |
| attempt_id                                               | `outbound_calls.provider_attempt_id`                 |
| webhook metadata                                         | clinic id / outbound_call id (cross-check only)      |
| transcript                                               | `call_transcripts` (PHI, tenant-scoped, not logged)  |
| recording wav                                            | S3 object, `calls.recording_key`                     |
| `ended_by`, `failure_reason`, `status`                   | `calls.outcome`, `outbound_calls.status`             |

## 9. Questions to send Sarvam (blockers marked *)

1. - Are inbound/outbound webhooks signed or authenticated? Header/secret scheme? Source IPs?
2. - Do webhooks retry automatically? Policy, timeout, which status codes count as success?
3. - Exact HTTP request an API tool sends (body templating, variable substitution), and what happens on non-2xx/timeouts. Sample request and response.
4. - Can a tool receive the dialled number, deployment id or deployment metadata? (decides one shared agent vs agent per clinic)
5. Wire contract and use of on_start / on_end hooks (can on_start return caller context, e.g. patient name?).
6. How do we provision numbers and `connection_id` (Sarvam-rented, Exotel, Plivo, Vobiz, Twilio)? Indian DID availability, price, KYC, TRAI rules.
7. Outbound: DND/NDNC scrubbing, calling windows, caller-id, price per minute, concurrency limits, idempotency on create.
8. Pause/resume of a deployment via API; `phone_numbers` vs `agent_phone_number` field mismatch.
9. Rate limits per key; retention of interactions, transcripts, recordings; region/data residency for DPDP (is data processed and stored in India?).
10. Sandbox/test agent and test numbers; staging vs production workspaces; multiple workspaces per org (one per environment).
11. Is there an OpenAPI file we can pin (`openapi.json`) so the adapter and tests can be generated and diffed on change?
12. Language/voice settings per agent version; can app_version be pinned per deployment (yes via `app_version`) and rolled back?
