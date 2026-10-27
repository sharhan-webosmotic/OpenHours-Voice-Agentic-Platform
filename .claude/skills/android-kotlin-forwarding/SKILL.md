---
name: android-kotlin-forwarding
description: Use when working in apps/android - the Kotlin call-forwarding scheduler app - including USSD/MMI forwarding codes, exact alarms, WorkManager, device pairing, FCM sync, battery restrictions, Compose UI and the device and carrier compatibility matrix.
---

# Android call-forwarding app (Kotlin)

Status: DEFERRED. Use only when the final phase starts (after API, admin-web and clinic-web are done). The stack here is provisional; confirm Kotlin vs React Native with the developer first.

## Scope
Prefilled agent number; schedules (days, start, end); manual on/off; status and errors. Nothing else. No patient data on the device.

## Architecture
Kotlin, Jetpack Compose, MVVM with a single `UiState` per screen, Hilt, Room (cache of schedules and pending events), WorkManager + AlarmManager, kotlinx.serialization with Retrofit or Ktor, Firebase Cloud Messaging, Timber (no PHI/tokens in logs). minSdk 26.

## Forwarding mechanics (verify on real devices; record every result)
- Activate/deactivate via carrier MMI/USSD codes (e.g. conditional or unconditional forwarding set/erase/query) sent through `TelephonyManager.sendUssdRequest` or a dial intent, per SIM slot. Codes and behaviour vary by carrier; keep them in a per-carrier config, not hard-coded in UI.
- Requires the phone permission (runtime), correct SIM selection for dual SIM, and the phone being on and with signal.
- Verify when possible by querying forwarding status; otherwise report `UNVERIFIED`, never `SUCCESS`.
- Events: every attempt posts a forwarding event (action, trigger schedule/manual, result SUCCESS/FAILED/UNVERIFIED, message, time). Queue offline and retry.

## Scheduling reliability
- Use exact alarms (declare the permission and handle the user-revoked case) to start/stop windows at the right minute; WorkManager as backup and for sync.
- Re-schedule on boot, app update, timezone change and schedule change.
- Doze and OEM battery killers: detect restrictions, guide the user to exempt the app, and show a visible "may not run" warning. Document per-manufacturer steps.
- Server owns the schedule (version number). On FCM push or poll, fetch, diff, reschedule. Conflicts: server wins.

## Security
Device token in Keystore-backed encrypted storage; HTTPS only with certificate validation; no secrets in the APK; obfuscation (R8) on release; pairing by one-time code, revocable from the dashboard.

## UX
Clear status card (ON/OFF/Scheduled next at ...), last result with plain-language error and next step, manual toggle with confirmation, schedule list with edit/delete. Works in poor connectivity.

## Quality
ktlint + detekt clean; unit tests for schedule maths and state machines (JUnit, Turbine); instrumented tests on the matrix. Update `docs/android-compatibility-matrix.md` (device, Android version, carrier, SIM slot, result, notes) with every test run. Distribution for the MVP is an internal APK/track; Play review of call-related permissions may add delay.
