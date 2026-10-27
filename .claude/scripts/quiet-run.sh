#!/usr/bin/env bash
# scripts/quiet-run.sh: run a command, keep the full output in a log file,
# print only what matters (token saver for the builder verify battery).
#
# Usage: bash scripts/quiet-run.sh <command...>
# Env:   QUIET_RUN_MAX_FAIL (default 120) cap on failure lines printed
#        QUIET_RUN_MAX_TAIL (default 40)  tail size when nothing matched
# Exit:  always the wrapped command's exit code (2 on usage error).
# No set -e on purpose: the wrapped exit code must never be swallowed.

if [[ $# -eq 0 ]]; then
  echo "usage: quiet-run.sh <command...>" >&2
  exit 2
fi

MAX_FAIL="${QUIET_RUN_MAX_FAIL:-120}"
MAX_TAIL="${QUIET_RUN_MAX_TAIL:-40}"
MAX_SUM=15

if [[ -d AI_DOCS ]]; then
  LOGDIR="AI_DOCS/.temp/quiet-run"
else
  LOGDIR="${TMPDIR:-/tmp}/quiet-run"
fi
mkdir -p "$LOGDIR" 2>/dev/null || LOGDIR="${TMPDIR:-/tmp}"

SLUG=$(printf '%s' "$*" | tr -c 'A-Za-z0-9' '-' | tr -s '-' | cut -c1-40)
LOG="$LOGDIR/$(date +%Y%m%d-%H%M%S)-${SLUG}-$$.log"

"$@" >"$LOG" 2>&1
RC=$?

SUMMARY_RE='Tests:|Test Files|Test Suites:|[0-9]+ (passed|failed)|=+ .*(passed|failed).* =+|^(ok|FAIL)[[:space:]]|^PASS|Found [0-9]+ errors?|[0-9]+ problems?|BUILD (SUCCESSFUL|FAILED)|(gzip|kB|KB|MB)[[:space:]]*$|Compiled|built in'
FAIL_RE='FAIL|Error|error TS|AssertionError|✕|●|panic:|--- FAIL'

echo "[quiet-run] exit=$RC cmd: $*"

SUMLINES=$(grep -E "$SUMMARY_RE" "$LOG" | tail -n "$MAX_SUM")

if [[ $RC -eq 0 ]]; then
  if [[ -n "$SUMLINES" ]]; then
    printf '%s\n' "$SUMLINES"
  else
    tail -n "$MAX_TAIL" "$LOG"
  fi
else
  FAILLINES=$(awk -v re="$FAIL_RE" '
    ctx > 0 { print; ctx--; next }
    /^Traceback/ { print; ctx = 15; next }
    $0 ~ re { print }
  ' "$LOG" | head -n "$MAX_FAIL")
  if [[ -n "$FAILLINES" || -n "$SUMLINES" ]]; then
    [[ -n "$FAILLINES" ]] && printf '%s\n' "$FAILLINES"
    [[ -n "$SUMLINES" ]] && printf '%s\n' "$SUMLINES"
  else
    tail -n "$MAX_TAIL" "$LOG"
  fi
  echo "Full log: $LOG"
fi

exit $RC
