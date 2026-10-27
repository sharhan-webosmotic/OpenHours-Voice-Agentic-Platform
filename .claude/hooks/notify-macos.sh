#!/usr/bin/env bash
# notify-macos.sh — macOS desktop notification for ADF (v3.8).
#
# Usage: notify-macos.sh "<title>" "<message>"
#
# Uses osascript (built-in, no install). First run may prompt the user to
# allow notifications for "Script Editor" or "osascript" in System Settings.
# terminal-notifier (if installed via brew) is used preferentially — it
# respects the app's notification preferences and survives App Nap better.

set -uo pipefail

TITLE="${1:-Claude Code}"
MESSAGE="${2:-}"

# Escape double quotes for AppleScript.
escape_as() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
T=$(escape_as "$TITLE")
M=$(escape_as "$MESSAGE")

if command -v terminal-notifier >/dev/null 2>&1; then
  terminal-notifier -title "$TITLE" -message "$MESSAGE" -sender "com.anthropic.claude" >/dev/null 2>&1
  exit 0
fi

if command -v osascript >/dev/null 2>&1; then
  osascript -e "display notification \"$M\" with title \"$T\"" >/dev/null 2>&1
fi

exit 0
