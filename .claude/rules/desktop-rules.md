---
paths:
  - "src-tauri/**"
  - "electron/**"
  - "**/electron/**"
  - "**/*.rs"
---

# Desktop Application Rules (Electron / Tauri)

> Loaded when a `Desktop` platform target is selected (`/do` Step 1) or `stack.md` declares a desktop app. Backs the Desktop target so it has real patterns instead of being offered-but-unsupported. Security is the dominant concern: a desktop app ships your code + a runtime to the user's machine.

## Framework choice (decided per the requirement, not by reflex)
- **Tauri** (default for a web-UI desktop app): small binary, Rust core, the web UI runs in the OS webview, native bits in Rust. Choose for footprint, security posture, and reuse of an existing React/Vue UI.
- **Electron**: mature, huge plugin ecosystem, full Node in the main process. Choose when you need that ecosystem or heavy in-process Node, and can accept the larger binary + memory.
- **Native** (Swift / WinUI / GTK): deep per-OS integration, maximum performance, separate codebases. Choose only when a native feature genuinely requires it.
- Record the choice + the signal in `stack.md` + the stack ADR.

## Process model & security (BLOCKING)
- **Electron:** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`. The renderer NEVER has direct Node access. All privileged operations go through a minimal `contextBridge` preload that exposes a typed, allow-listed API, never the whole `ipcRenderer` or `require`.
- **Tauri:** keep the `tauri.allowlist` minimal (enable only the APIs the app uses); validate every command argument in the Rust side; never expose `shell.open` / `fs` broadly.
- Validate and allow-list everything crossing the web-to-native boundary (IPC commands, deep links, file paths). Treat the renderer as untrusted input to the native side.
- Load only local or explicitly allow-listed remote content. No `webSecurity: false`. A strict CSP on the renderer. Never load untrusted remote URLs into a privileged window.

## Updates & distribution
- Auto-update is signed: Electron uses `electron-updater` with code-signing + a verified update feed; Tauri uses its built-in updater with a public-key-signed manifest. An unsigned auto-update channel is a remote-code-execution vector and is a defect.
- Code-sign + notarize per OS (Apple notarization for macOS, Authenticode for Windows). Document the signing identities (secrets, never in the repo).

## App behavior
- Handle the OS lifecycle: window-all-closed (quit on Windows/Linux, stay on macOS), single-instance lock, system tray if backgrounded, deep-link / file-association handlers.
- Persist user data in the OS-correct location (`app.getPath('userData')` / Tauri `app_data_dir`), never next to the binary. Migrate the local store with versioning.
- Offline-first where the product implies it: the app should degrade gracefully without network, sync when back.
- Reuse the web stack: the renderer UI follows `frontend-rules.md` (responsive within the window, the design system, react-hook-form + the chosen state lib). The desktop shell is the addition, not a rewrite.

## Testing & ops
- E2E the desktop app (Playwright for Electron via `_electron`, or WebDriver/`tauri-driver` for Tauri): launch the app, drive the real window, assert on the rendered UI.
- Crash + error reporting wired (Sentry has Electron/Tauri SDKs) per `docs/app-observability-standard.md`.
- Build per-OS artifacts in CI (mac/win/linux) with signing; never ship an unsigned build.

## Verification (what /audit checks for a desktop target)
- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, a preload `contextBridge` (not a raw `ipcRenderer` exposure), a strict CSP, no `webSecurity: false`.
- Tauri: a minimal allowlist, command-argument validation in Rust.
- Signed auto-update configured; code-signing identities documented; no untrusted remote content in a privileged window.

<!-- Version: 1.0.0 (2026-06-29): initial desktop (Electron/Tauri) rules (backs the Desktop platform target in /do + TECH-OPTIONS) -->
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
