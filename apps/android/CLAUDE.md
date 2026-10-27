# apps/android rules

DEFERRED: this app is built last, after the API, admin-web and clinic-web are complete. Do not scaffold or work here before then. The stack below is provisional and is confirmed when Android work starts.

Read the root `CLAUDE.md` first. Skill: `android-kotlin-forwarding`.

- Kotlin, Jetpack Compose, MVVM with unidirectional state, Hilt, Room, WorkManager, kotlinx.serialization, Retrofit or Ktor. minSdk 26. Lint with ktlint + detekt; both must pass.
- Scope is only: prefilled agent number, forwarding schedules, manual on/off, status and errors. No patient data, appointments, call history or analytics on the device.
- The server is the source of truth for schedules. The app syncs (push via FCM, polling fallback), executes locally, and reports every attempt as a forwarding event.
- Device token is stored in Android Keystore-backed encrypted storage. Never log it. No secrets in the APK.
- Forwarding is carrier-dependent. Never report "success" unless verified; use `SUCCESS`, `FAILED` or `UNVERIFIED` and show the user what to do next.
- Every behaviour change needs a row in `docs/android-compatibility-matrix.md` (device, Android version, carrier, SIM slot, result).
