#!/usr/bin/env bash
# hooks/notify.sh — Cross-platform desktop notification dispatcher (v3.8).
#
# Fires on Claude Code's Notification event (on by default) and optionally on
# Stop (when ADF_NOTIFY_ON_STOP=1 is set). Reads the payload JSON from stdin,
# extracts the message, enriches with task context when possible, and hands
# off to the platform-specific notifier:
#
#   Windows → notify-windows.ps1 (BurntToast preferred, raw API fallback)
#   macOS   → notify-macos.sh    (osascript — no install needed)
#   Linux   → notify-linux.sh    (notify-send — apt install libnotify-bin)
#
# Opt out entirely: set ADF_NOTIFY_DISABLED=1 in .claude/settings.local.json
# env block, or remove this hook from settings.json.
#
# Silent on every normal path; never blocks the triggering event.

set -uo pipefail

# ── Opt-out short-circuit ──────────────────────────────────────────────────────
if [[ "${ADF_NOTIFY_DISABLED:-0}" = "1" ]]; then
  exit 0
fi

HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"
AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

# ── Read payload and derive title/message ──────────────────────────────────────
INPUT=$(cat 2>/dev/null || echo "")

MESSAGE=""
EVENT=""
if [[ -n "$INPUT" ]]; then
  JSON_FIELD="$HOOKS_DIR/json-field.sh"
  MESSAGE=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" message 2>/dev/null)
  EVENT=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" hook_event_name 2>/dev/null)
  [[ -z "$EVENT" ]] && EVENT=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" event 2>/dev/null)
fi

# ── Stop-event gate: only fire when explicitly opted in ────────────────────────
if [[ "$EVENT" = "Stop" ]] && [[ "${ADF_NOTIFY_ON_STOP:-0}" != "1" ]]; then
  exit 0
fi

# ── Derive title + enriched message ────────────────────────────────────────────
TITLE="Claude Code"

# For Stop events (when opted in), enrich with active task from task-ledger.
if [[ "$EVENT" = "Stop" ]]; then
  LEDGER="$AI_DOCS_DIR/memory/task-ledger.md"
  if [[ -f "$LEDGER" ]]; then
    ACTIVE_REQUEST=$(awk '
      /@active-begin/ { flag=1; next }
      /@active-end/   { flag=0 }
      flag && /^Request:/ { sub(/^Request:[[:space:]]*/, ""); print; exit }
    ' "$LEDGER" 2>/dev/null)
    if [[ -n "$ACTIVE_REQUEST" ]]; then
      TITLE="Claude Code — task paused"
      # Truncate for notification sanity.
      SHORT=$(printf '%s' "$ACTIVE_REQUEST" | cut -c1-120)
      MESSAGE="$SHORT"
    else
      TITLE="Claude Code — idle"
      MESSAGE="Session stopped. No active task in the ledger."
    fi
  fi
fi

# Default messages if we still have nothing.
if [[ -z "$MESSAGE" ]]; then
  case "$EVENT" in
    Notification) MESSAGE="Claude needs your attention" ;;
    Stop)         MESSAGE="Turn complete" ;;
    *)            MESSAGE="Event: ${EVENT:-unknown}" ;;
  esac
fi

# Truncate message defensively (notification OS limits vary).
MESSAGE=$(printf '%s' "$MESSAGE" | tr '\n' ' ' | cut -c1-240)

# ── Detect platform and dispatch ───────────────────────────────────────────────
UNAME_OUT="$(uname -s 2>/dev/null || echo unknown)"
case "$UNAME_OUT" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    # Windows via Git Bash / MSYS / Cygwin / WSL.
    if command -v powershell.exe >/dev/null 2>&1; then
      PS=powershell.exe
    elif command -v pwsh >/dev/null 2>&1; then
      PS=pwsh
    elif command -v powershell >/dev/null 2>&1; then
      PS=powershell
    else
      exit 0
    fi
    PS_SCRIPT="$HOOKS_DIR/notify-windows.ps1"
    [[ -f "$PS_SCRIPT" ]] || exit 0
    "$PS" -NoProfile -ExecutionPolicy Bypass -File "$PS_SCRIPT" "$TITLE" "$MESSAGE" >/dev/null 2>&1 &
    ;;
  Darwin)
    SH="$HOOKS_DIR/notify-macos.sh"
    [[ -f "$SH" ]] || exit 0
    bash "$SH" "$TITLE" "$MESSAGE" >/dev/null 2>&1 &
    ;;
  Linux)
    SH="$HOOKS_DIR/notify-linux.sh"
    [[ -f "$SH" ]] || exit 0
    bash "$SH" "$TITLE" "$MESSAGE" >/dev/null 2>&1 &
    ;;
  *)
    # Unknown OS — silently do nothing.
    exit 0
    ;;
esac

# Detach child so hook returns immediately (notifications are fire-and-forget).
disown 2>/dev/null || true
exit 0
