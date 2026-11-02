# The Sarvam contract

## STATUS: THIS IS NOT THE VERIFIED CONTRACT DOCUMENT. DO NOT WRITE A PARSER FROM IT.

On 2026-11-02 the developer stated that a contract document built from Sarvam's official
documentation of 27 October exists and should be placed at this path. **It did not arrive.**
The message describing it came through; no file or pasted text did, and nothing matching it is
in the repository or in the session scratchpad.

This file therefore records two things and nothing else:

1. **What that message said the document contains**, so the information is not lost. It is
   second-hand, it is a summary, and it is marked as such below.
2. **What is missing before the webhook parser, the authoritative re-fetch, the recording
   download and the catch-up import can be written**, which is field-level detail a summary
   cannot carry.

Anyone reading this to implement against Sarvam should stop and ask for the real document.
`sarvam-voice-integration` is explicit about this: do not invent Sarvam endpoints, payloads or
headers. A parser written from the summary below, with contract tests built from payloads we
made up ourselves, would prove only that our fiction is self-consistent, and would fail on the
first real call in a way that looks like a bug rather than like a missing specification.

---

## Reported to exist in the official documentation (second-hand, 2026-11-02)

Recorded as stated. None of it has been read by anybody writing this code.

- **An inbound call-ended webhook**, documented field by field, including
  `interaction_transcript` (entries carrying a `role` and an `en_text`), `interaction_id`,
  `agent_phone_number`, a duration, and our own metadata echoed back.
- **Transcript retrieval:** `GET` on an analytics path of the form `.../transcripts/{interaction_id}`.
- **Recording retrieval:** `GET` on an analytics path of the form `.../recordings/{interaction_id}`,
  returning `audio/wav` as a stream. **No signed URL**, which means the recording is fetched
  by us with our credentials and copied into our own object storage before anybody can play
  it (D-007 already forbids proxying it through the API).
- **Listing interactions and attempts**, with filters and paging, which is what the catch-up
  job for undelivered calls needs.
- **Deployment create and update**, and an instant outbound call.

## Stated to be genuinely UNKNOWN, and to stay marked so

- **How a webhook is authenticated.** There is no documented signature scheme. Our own
  arrangement therefore stands unchanged (D-006): a long random secret in the URL path, an
  allow-list of Sarvam's two published source addresses, and re-fetching the interaction from
  the authenticated API before acting on anything a payload claims.
- **Whether deliveries are retried automatically, and what counts as a successful delivery.**
  This is why a catch-up job exists at all rather than being a nicety.
- **The exact HTTP request their API tool makes to our endpoints**, and what it does on a
  timeout or a non-2xx.
- **Whether the dialled number or any deployment metadata reaches a tool call.**

## Also unknown, and needed before any code is written against Sarvam

These are not in the list above because the summary could not carry them. Each one blocks a
specific piece of work:

| Unknown                                                                                 | What it blocks                                  |
| --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| The analytics base URL and API version                                                  | Every call to Sarvam                            |
| The authentication header for Sarvam's own API (name, scheme, where the key comes from) | Every call to Sarvam                            |
| The exact JSON nesting of the webhook body, and which fields are optional               | The webhook parser and its dedupe key           |
| The full list of event types, and which ones a call produces                            | Processing events idempotently and out of order |
| The paging parameters and response envelope for listing interactions                    | The catch-up import                             |
| Whether `interaction_id` is unique per call or per attempt                              | Whether dedupe keys on it are correct           |
| Rate limits, timeouts and retry expectations on their side                              | The job's backoff and the recording fetch       |

## What our side already commits to, which is ours to decide

Recorded here because the Sarvam configuration has to be filled in to match it.

- **Tool endpoints:** `POST /voice/tools/{clinic-info,lookup-patient,check-availability,book,reschedule,cancel}`.
- **Tool authentication:** `Authorization: Bearer <per-clinic tool secret>`. **Open question:**
  whether Sarvam's API tool can send a custom header. If it cannot, the fallback is the secret
  in the URL path, as the webhook does.
- **Tool responses:** always HTTP 200 with `{ ok, message, data }`, except 401 for a secret
  that does not authenticate and 429 for a throttled clinic (D-022).
- **Times:** tools take the clinic's local `date` (`YYYY-MM-DD`) and `time` (`HH:MM`), not a
  UTC instant, because that is what is said on the telephone and because a language model
  should not be doing timezone arithmetic.
- **Idempotency:** a tool call may send `callId` and `toolCallId`, which compose the
  idempotency key, or an `Idempotency-Key` header. With neither, a retried booking books
  twice, which is why the fourth unknown above matters.
- **Webhook URL:** to be issued per environment with the secret in its path, once the webhook
  lands.

## How this file gets replaced

When the official documentation arrives: rewrite this file from it, keep the UNKNOWN section
for whatever it genuinely does not answer, then write the adapter and the parser against it.
Afterwards, record any difference the first real call shows against what was documented. The
raw payload of that call is stored in `webhook_events.payload`, so the comparison can be made
from data rather than from memory.
