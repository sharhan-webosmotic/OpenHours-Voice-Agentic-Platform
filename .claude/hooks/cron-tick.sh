#!/usr/bin/env bash
# Shell safety: no `set -e` — a missing scheduler, an unreadable jobs file, or
# a failed tick must not break session start. `set -u` is safe: every
# variable (SCRIPT_DIR, CLAUDE_DIR, JOBS_FILE, SCHEDULER, STAMP_FILE,
# last_tick, now, age, PY, c, output) is assigned unconditionally before use, or
# assigned then used only within the same guarding `if` block.
set -uo pipefail

# hooks/cron-tick.sh — SessionStart hook (ADF v4.0)
# Checks cron/jobs.json for due scheduled tasks and injects them into Claude context.
# Rate-limited: fires at most once per 50 minutes to avoid repeat triggers in quick restarts.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
JOBS_FILE="$CLAUDE_DIR/cron/jobs.json"
SCHEDULER="$CLAUDE_DIR/cron/scheduler.py"
STAMP_FILE="$CLAUDE_DIR/.cron-last-tick"

# Skip if no scheduler or jobs file (not yet initialized)
[[ -f "$JOBS_FILE" ]] || exit 0
[[ -f "$SCHEDULER" ]] || exit 0

# Rate limit: skip if ticked within last 50 minutes (3000 seconds)
if [[ -f "$STAMP_FILE" ]]; then
  last_tick=$(cat "$STAMP_FILE" 2>/dev/null || echo 0)
  now=$(date +%s)
  age=$((now - last_tick))
  if [[ "$age" -lt 3000 ]]; then
    exit 0
  fi
fi

# Resolve one working interpreter the way upgrade.sh does (candidate list plus a
# probe that actually runs it). A hardcoded python3 made this hook a silent no-op
# on a stock python.org Windows install, where python3 is missing or is the Store
# stub that only prints an error. scheduler.py needs Python 3.7 or newer.
PY=""
for c in python3.13 python3.12 python3 python; do
  if command -v "$c" >/dev/null 2>&1 \
     && "$c" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 7) else 1)" >/dev/null 2>&1; then
    PY="$c"
    break
  fi
done
[[ -n "$PY" ]] || exit 0

# Run scheduler: it prints nothing if no jobs are due (silent by design).
# PYTHONIOENCODING keeps the injected text UTF-8 on Windows, where a piped Python
# stdout otherwise uses the ANSI code page. The rate-limit stamp is written only
# after a successful tick, so a failed run is retried at the next session start
# instead of being silenced for 50 minutes.
if output=$(PYTHONIOENCODING=utf-8 "$PY" "$SCHEDULER" tick 2>/dev/null); then
  date +%s > "$STAMP_FILE"
  if [[ -n "$output" ]]; then
    echo ""
    echo "$output"
    echo ""
  fi
fi

exit 0
