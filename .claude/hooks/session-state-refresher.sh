#!/usr/bin/env bash
# hooks/session-state-refresher.sh — Periodic session-state.md refresh nudge (v3.7).
#
# Fires on UserPromptSubmit. Counts prompts since session-state.md was last
# written. Every 15 prompts without a refresh, emits a short stdout note
# suggesting the user update session-state.md. Silent otherwise.
#
# State: AI_DOCS/memory/.prompt-counter (plain integer). Reset to 0 whenever
# session-state.md mtime changes.
#
# v3.7 adds a second, orchestrator-only advisory (PLAN-execution-speed.md
# Part 1 item 2): reuses the same counter/mtime mechanism to track whether
# the nudge has now fired twice in a row with no session-state.md write in
# between. Two consecutive nudges without a write is read as the session
# grinding through a long inline stretch instead of dispatching. When that
# happens, one extra line is appended to the nudge suggesting delegation to
# a subagent per context-efficiency-rules.md Rule 7. Advisory only, same as
# the base nudge, no enforcement.
#
# Extra state: AI_DOCS/memory/.prompt-counter-nudge-streak (consecutive
# nudge count) and .prompt-counter-last-nudge-mtime (session-state.md mtime
# observed at the previous nudge). Both reset the same way the base counter
# does: any session-state.md write breaks the streak.
#
# Why: pre-compact.sh is a mechanical safety net, but it can only capture
# what's already on disk. Claude tends to forget to refresh session-state.md
# mid-session. This nudge is a cheap reminder — no enforcement.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
MEM_DIR="$AI_DOCS_DIR/memory"
STATE_FILE="$MEM_DIR/session-state.md"
COUNTER_FILE="$MEM_DIR/.prompt-counter"
LAST_MTIME_FILE="$MEM_DIR/.prompt-counter-last-mtime"
NUDGE_STREAK_FILE="$MEM_DIR/.prompt-counter-nudge-streak"
LAST_NUDGE_MTIME_FILE="$MEM_DIR/.prompt-counter-last-nudge-mtime"

NUDGE_INTERVAL=15

# Nothing to nudge about if no memory dir or no session-state file to refresh.
[[ ! -d "$MEM_DIR" ]] && exit 0

mkdir -p "$MEM_DIR" 2>/dev/null

# Current mtime of session-state.md (0 if missing — treat as "never written").
CURRENT_MTIME=0
if [[ -f "$STATE_FILE" ]]; then
  CURRENT_MTIME=$(stat -c %Y "$STATE_FILE" 2>/dev/null || stat -f %m "$STATE_FILE" 2>/dev/null || echo 0)
fi

# Previous mtime we observed.
LAST_MTIME=0
if [[ -f "$LAST_MTIME_FILE" ]]; then
  LAST_MTIME=$(cat "$LAST_MTIME_FILE" 2>/dev/null | tr -d '[:space:]')
  [[ -z "$LAST_MTIME" ]] && LAST_MTIME=0
fi

# Counter.
COUNTER=0
if [[ -f "$COUNTER_FILE" ]]; then
  COUNTER=$(cat "$COUNTER_FILE" 2>/dev/null | tr -d '[:space:]')
  [[ -z "$COUNTER" ]] && COUNTER=0
fi

# If session-state.md was refreshed since last check, reset counter.
if [[ "$CURRENT_MTIME" != "$LAST_MTIME" ]]; then
  COUNTER=0
fi

# Increment for this prompt.
COUNTER=$(( COUNTER + 1 ))

# Persist state.
printf '%s' "$COUNTER" > "$COUNTER_FILE" 2>/dev/null || true
printf '%s' "$CURRENT_MTIME" > "$LAST_MTIME_FILE" 2>/dev/null || true

# Emit nudge every Nth prompt.
if (( COUNTER >= NUDGE_INTERVAL )); then
  # Reset so we don't nag every turn until user refreshes. COUNTER is reset in
  # memory too: the telemetry check at the end of this script reads it, and
  # with only the file reset that check could never be true.
  printf '0' > "$COUNTER_FILE" 2>/dev/null || true
  COUNTER=0

  # Second-nudge grinding check (reuses the same counter/mtime style as the
  # base nudge above): has session-state.md's mtime stayed the same since
  # the PREVIOUS nudge too? If so this is at least the second nudge in a row
  # with no write in between, read as the session grinding inline.
  NUDGE_STREAK=0
  if [[ -f "$NUDGE_STREAK_FILE" ]]; then
    NUDGE_STREAK=$(cat "$NUDGE_STREAK_FILE" 2>/dev/null | tr -d '[:space:]')
    [[ -z "$NUDGE_STREAK" ]] && NUDGE_STREAK=0
  fi
  LAST_NUDGE_MTIME=""
  if [[ -f "$LAST_NUDGE_MTIME_FILE" ]]; then
    LAST_NUDGE_MTIME=$(cat "$LAST_NUDGE_MTIME_FILE" 2>/dev/null | tr -d '[:space:]')
  fi
  if [[ -n "$LAST_NUDGE_MTIME" && "$CURRENT_MTIME" = "$LAST_NUDGE_MTIME" ]]; then
    NUDGE_STREAK=$(( NUDGE_STREAK + 1 ))
  else
    NUDGE_STREAK=1
  fi
  printf '%s' "$NUDGE_STREAK" > "$NUDGE_STREAK_FILE" 2>/dev/null || true
  printf '%s' "$CURRENT_MTIME" > "$LAST_NUDGE_MTIME_FILE" 2>/dev/null || true

  GRINDING_LINE=""
  if (( NUDGE_STREAK >= 2 )); then
    GRINDING_LINE="This nudge has now fired ${NUDGE_STREAK} times in a row with no session-state.md write in between: if the current stretch is read-heavy or edit-heavy, delegate it to a subagent instead of continuing inline (context-efficiency-rules.md Rule 7)."
  fi

  if [[ "$CURRENT_MTIME" = "0" ]]; then
    cat <<EOF
=== ADF session-state refresher ===
session-state.md has never been written this project. Create it now — the
pre-compact hook and session-start banner depend on it for context survival.

Quick template:

    # Session State
    Phase: <discovery|specification|design|implementation|testing|deployment>
    Active_milestone: M<#> — <name>
    Active_task: T-YYYY-MM-DD-NNN
    Active_wave: <W<NN> [T-xx, T-yy] — only when a parallel wave is running>
    Last_skill: <name>

    ## WIP
    - <short note on current work>

    ## Next action
    - <what to do if the session ends now>
EOF
    [[ -n "$GRINDING_LINE" ]] && printf '\n%s\n' "$GRINDING_LINE"
    cat <<'EOF'
=== /ADF session-state refresher ===
EOF
  else
    NOW_EPOCH=$(date -u +%s)
    AGE_SEC=$(( NOW_EPOCH - CURRENT_MTIME ))
    AGE_MIN=$(( AGE_SEC / 60 ))
    cat <<EOF
=== ADF session-state refresher ===
session-state.md hasn't been refreshed in ${NUDGE_INTERVAL} user prompts
(last write was ~${AGE_MIN} minutes ago).

Take 10 seconds to update:
  - Current phase
  - Active task + what's WIP (and Active wave: W<NN> [...] if a parallel wave is running)
  - Next action if the session ends now

This is advisory — continue if the current state is still accurate.
EOF
    [[ -n "$GRINDING_LINE" ]] && printf '\n%s\n' "$GRINDING_LINE"
    cat <<'EOF'
=== /ADF session-state refresher ===
EOF
  fi
fi

# Telemetry (only on nudge events to keep the stream quiet).
if (( COUNTER == 0 )); then  # was just nudged & reset
  LOG_EVENT="$(dirname "$0")/log-event.sh"
  if [[ -f "$LOG_EVENT" ]]; then
    bash "$LOG_EVENT" "\"event\":\"hook.state_refresher_nudge\"" 2>/dev/null || true
  fi
fi

exit 0
