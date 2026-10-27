#!/usr/bin/env bash
# notify-linux.sh — Linux desktop notification for ADF (v3.8).
#
# Usage: notify-linux.sh "<title>" "<message>"
#
# Uses notify-send (libnotify-bin). Silent no-op if not installed —
# setup.sh prints the install command on first run if missing.

set -uo pipefail

TITLE="${1:-Claude Code}"
MESSAGE="${2:-}"

if ! command -v notify-send >/dev/null 2>&1; then
  # Last-resort: dunst's dunstify if present.
  if command -v dunstify >/dev/null 2>&1; then
    dunstify "$TITLE" "$MESSAGE" >/dev/null 2>&1 || true
  fi
  exit 0
fi

# -a sets the application name shown in the notification.
# Urgency "normal" avoids the persistent "critical" treatment that requires
# manual dismissal — we want Claude notifications to auto-dismiss.
notify-send -a "Claude Code" -u normal "$TITLE" "$MESSAGE" >/dev/null 2>&1 || true

exit 0
