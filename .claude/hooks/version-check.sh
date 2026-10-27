#!/usr/bin/env bash
# hooks/version-check.sh — SessionStart hook: catch framework + hook-wiring drift
#
# Runs at the start of every Claude Code session. Triggers upgrade.sh --auto on
# EITHER of two drift signals:
#
#   1. Version drift: .adf-version (current framework on disk after a git pull)
#      differs from .adf-version.previous (what upgrade.sh last stamped). Catches
#      pulls done outside `.claude/` where the post-merge hook never fired.
#
#   2. Hook-wiring drift: the content hash of settings.template.json differs from
#      .adf-settings.hash (the last-synced hash). This is the critical fix for
#      the "new hook never fires after a fast-forward pull" gap: a hook added or
#      changed in a release does NOT always bump .adf-version, and a fast-forward
#      `git pull` never runs the git post-merge hook. Content-hashing the template
#      makes propagation independent of both the version string and git hook
#      events, so a newly added hook is wired into the live settings.json on the
#      next session regardless of how the update arrived.
#
# Silent when nothing drifted. Timeboxed so it never blocks session start. On a
# successful run the markers are stamped HERE (not only at the end of upgrade.sh),
# so a mid-run timeout leaves the markers stale and the sync retries next session
# instead of being falsely marked complete.

set -u

FRAMEWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$FRAMEWORK_DIR/.adf-version"
PREV_VERSION_FILE="$FRAMEWORK_DIR/.adf-version.previous"
SETTINGS_TEMPLATE="$FRAMEWORK_DIR/settings.template.json"
HASH_FILE="$FRAMEWORK_DIR/.adf-settings.hash"
UPGRADE_SCRIPT="$FRAMEWORK_DIR/upgrade.sh"

# No-op if framework files missing.
[[ ! -f "$VERSION_FILE" ]] && exit 0
[[ ! -f "$UPGRADE_SCRIPT" ]] && exit 0

CURRENT="$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]')"
PREVIOUS="$(cat "$PREV_VERSION_FILE" 2>/dev/null | tr -d '[:space:]')"

# Content hash of the settings template (where hooks are wired). Degrade
# gracefully if no hashing tool is present (hook drift simply not detected then).
hash_template() {
  [[ -f "$SETTINGS_TEMPLATE" ]] || { echo ""; return 0; }
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$SETTINGS_TEMPLATE" 2>/dev/null | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$SETTINGS_TEMPLATE" 2>/dev/null | awk '{print $1}'
  elif command -v cksum >/dev/null 2>&1; then
    cksum "$SETTINGS_TEMPLATE" 2>/dev/null | awk '{print $1"-"$2}'
  else
    echo ""
  fi
}
CUR_HASH="$(hash_template)"
PREV_HASH="$(cat "$HASH_FILE" 2>/dev/null | tr -d '[:space:]')"

# First run after install: set markers and exit quietly.
if [[ -z "$PREVIOUS" ]]; then
  echo "$CURRENT" > "$PREV_VERSION_FILE" 2>/dev/null || true
  [[ -n "$CUR_HASH" ]] && { echo "$CUR_HASH" > "$HASH_FILE" 2>/dev/null || true; }
  exit 0
fi

VERSION_DRIFT=0
HOOK_DRIFT=0
[[ "$CURRENT" != "$PREVIOUS" ]] && VERSION_DRIFT=1
# Only flag hook drift when we could actually hash the template.
[[ -n "$CUR_HASH" && "$CUR_HASH" != "$PREV_HASH" ]] && HOOK_DRIFT=1

# Nothing drifted: silent exit.
if [[ "$VERSION_DRIFT" -eq 0 && "$HOOK_DRIFT" -eq 0 ]]; then
  exit 0
fi

REASON=""
[[ "$VERSION_DRIFT" -eq 1 ]] && REASON="version $PREVIOUS -> $CURRENT"
if [[ "$HOOK_DRIFT" -eq 1 ]]; then
  [[ -n "$REASON" ]] && REASON="$REASON; hook wiring changed" || REASON="hook wiring changed (settings.template.json)"
fi

echo ""
echo "========================================================"
echo "  Framework drift: $REASON"
echo "  Running migration (auto-mode) to sync hooks + settings..."
echo "========================================================"

# Timeboxed execution. 120s (raised from 30s): a full version migration was
# measured at about 40s on Windows Git Bash (frontmatter retrofit about 25s,
# global skills mirror about 12s), so the old 30s box killed every run, left the
# markers stale, and retried on every session start. 120s leaves real margin and
# stays far below the 600s default timeout Claude Code applies to command hooks.
# The migration runs only when something actually drifted.
RC=0
if command -v timeout >/dev/null 2>&1; then
  timeout 120 bash "$UPGRADE_SCRIPT" --auto
  RC=$?
else
  bash "$UPGRADE_SCRIPT" --auto
  RC=$?
fi

if [[ "$RC" -eq 0 ]]; then
  # Success: stamp both markers so the drift clears. Done here (not only inside
  # upgrade.sh) so a partial/timed-out run does NOT falsely mark itself synced.
  echo "$CURRENT" > "$PREV_VERSION_FILE" 2>/dev/null || true
  [[ -n "$CUR_HASH" ]] && { echo "$CUR_HASH" > "$HASH_FILE" 2>/dev/null || true; }
else
  echo "[version-check] upgrade.sh --auto exceeded 120s or errored (rc=$RC)."
  echo "[version-check] Markers left stale on purpose; sync retries next session."
  echo "[version-check] Re-run manually: bash .claude/upgrade.sh"
fi

exit 0
