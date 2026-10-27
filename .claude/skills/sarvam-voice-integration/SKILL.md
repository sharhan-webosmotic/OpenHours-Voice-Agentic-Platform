---
name: sarvam-voice-integration
description: Use when working on the Sarvam voice agent integration - tool-call endpoints the agent invokes, webhooks for call events, recordings and transcripts, outbound reminder and follow-up calls, the VoiceProvider interface, and background jobs for calling.
---

# Sarvam voice integration

## Ground rule
Do not invent Sarvam endpoints, payloads or headers. The verified contract lives in `docs/voice/sarvam-contract.md`. If it is missing or incomplete, stop and ask the developer to supply the official docs or sample payloads, then record them there before coding.

## Architecture
- `VoiceProvider` interface in `apps/api/src/voice`: verify and parse webhook -> normalised event; place outbound call; fetch recording/transcript; sync agent config. Only `providers/sarvam` knows Sarvam shapes. Core code sees normalised types.
- Tool endpoints (`check-availability`, `book`, `reschedule`, `cancel`, `lookup-patient`, `clinic-info`) are provider-neutral HTTP endpoints under `/voice/tools/*`, authenticated by the provider secret/signature, running as the organisation resolved from the agent id or dialled number.

## Webhooks (inbox pattern)
1. Verify signature/secret on the raw body. 2. Insert into `webhook_events` with unique (provider, external_event_id); duplicate -> return 200 immediately. 3. Enqueue processing job. 4. Process idempotently, update `calls`, link patient/appointment, enqueue recording fetch. 5. Record status, attempts and error for the admin monitoring page. Always return quickly (< 1 s).

## Tool endpoint rules
- Latency target p95 < 400 ms; one read, one write; no external calls.
- Response: `{ ok, message, data }` where `message` is a short sentence the agent can speak (no PHI beyond what the caller supplied), and `data` is structured.
- Be forgiving of input (spoken dates, name variants) but strict in what you commit: confirm slot availability inside the booking transaction, rely on the exclusion constraint, return 409 -> a spoken alternative.
- Idempotency: key from provider call id + tool call id; a replay returns the original result.
- Never decide clinically. Unknown or unsafe requests return a message telling the agent to offer a callback.
- Deactivated organisation or unknown agent -> neutral failure message and an alert.

## Outbound calls (reminders, follow-ups)
- Scheduling rules: only within the clinic's calling window, max 2 attempts, daily cap per clinic, one call per target per slot via unique `dedupe_key`.
- State machine: SCHEDULED -> IN_PROGRESS -> COMPLETED | FAILED | CANCELLED; claim a row transactionally before calling; record provider call id; reconcile via webhook; on worker crash, an unclaimed or stale IN_PROGRESS row is retried safely.
- Cancel pending reminders when an appointment is cancelled or rescheduled.

## Recordings and transcripts
Copy to private S3 in a job (provider links may expire), store the key not the URL, retention per clinic, access only via short-lived signed URLs and audited reads.

## Testing
Contract tests with recorded sample payloads; replay tests (same event twice); out-of-order events; signature failure; provider timeout; load test of tool endpoints at 20 concurrent calls.
