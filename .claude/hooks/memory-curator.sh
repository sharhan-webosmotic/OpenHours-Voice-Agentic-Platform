#!/usr/bin/env bash
# hooks/memory-curator.sh — Memory hygiene advisor (v3.4).
#
# Fires on Stop. Rate-limited to once per 24h via
# AI_DOCS/memory/.curator-last-run. Checks thresholds on the main memory
# files; if anything warrants attention, writes AI_DOCS/memory/curator-suggestions.md
# for session-start.sh to surface next session.
#
# Does NOT auto-modify any file. Purely advisory. Claude or the user reads
# the suggestions file and decides whether to act.
#
# Silent on every normal path. Exit 0 always.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
MEM_DIR="$AI_DOCS_DIR/memory"
TASKS_DIR="$AI_DOCS_DIR/planning/tasks"
LAST_RUN_FILE="$MEM_DIR/.curator-last-run"
SUGGESTIONS_FILE="$MEM_DIR/curator-suggestions.md"

[[ ! -d "$MEM_DIR" ]] && exit 0

# ── Rate-limit: once per 24 hours ──────────────────────────────────────────────
NOW_EPOCH=$(date -u +%s)
DAY=86400
if [[ -f "$LAST_RUN_FILE" ]]; then
  LAST=$(cat "$LAST_RUN_FILE" 2>/dev/null | tr -d '[:space:]')
  if [[ -n "$LAST" ]] && (( NOW_EPOCH - LAST < DAY )); then
    exit 0
  fi
fi

# ── Thresholds (tune here, not in the body) ────────────────────────────────────
DECISION_ROWS_THRESHOLD=100
METRICS_MB_THRESHOLD=5
PROMPTS_MB_THRESHOLD=5
STALE_TASK_DAYS=14
SNAPSHOT_AGE_DAYS=7
LEDGER_ARCHIVE_ROWS_THRESHOLD=30  # v3.7

SUGGESTIONS=""
append() { SUGGESTIONS+="$1"$'\n'; }

# ── Check 1: decision-log.md row count ─────────────────────────────────────────
# awk-based count is robust — grep -c + "|| echo 0" creates "0\n0" edge cases
# that break bash arithmetic.
DECISION_FILE="$MEM_DIR/decision-log.md"
if [[ -f "$DECISION_FILE" ]]; then
  ROWS=$(awk '/^\| *[0-9]/ { c++ } END { print c+0 }' "$DECISION_FILE" 2>/dev/null)
  ROWS=${ROWS:-0}
  if (( ROWS > DECISION_ROWS_THRESHOLD )); then
    append "- **decision-log.md** has $ROWS rows (> $DECISION_ROWS_THRESHOLD). Consider summarizing rows older than 90 days into a single 'Q1 2026 highlights' row."
  fi
fi

# ── Check 2: metrics.jsonl size ────────────────────────────────────────────────
METRICS_FILE="$MEM_DIR/metrics.jsonl"
if [[ -f "$METRICS_FILE" ]]; then
  SIZE_BYTES=$(wc -c < "$METRICS_FILE" 2>/dev/null | tr -d '[:space:]')
  SIZE_MB=$(( SIZE_BYTES / 1048576 ))
  if (( SIZE_MB > METRICS_MB_THRESHOLD )); then
    append "- **metrics.jsonl** is ${SIZE_MB} MB (> ${METRICS_MB_THRESHOLD} MB). Truncate: \`tail -n 10000 $METRICS_FILE > $METRICS_FILE.tmp && mv $METRICS_FILE.tmp $METRICS_FILE\`."
  fi
fi

# ── Check 3: user-prompts.log size ─────────────────────────────────────────────
PROMPTS_FILE="$MEM_DIR/user-prompts.log"
if [[ -f "$PROMPTS_FILE" ]]; then
  SIZE_BYTES=$(wc -c < "$PROMPTS_FILE" 2>/dev/null | tr -d '[:space:]')
  SIZE_MB=$(( SIZE_BYTES / 1048576 ))
  if (( SIZE_MB > PROMPTS_MB_THRESHOLD )); then
    append "- **user-prompts.log** is ${SIZE_MB} MB (> ${PROMPTS_MB_THRESHOLD} MB). Truncate: \`tail -n 2000 $PROMPTS_FILE > $PROMPTS_FILE.tmp && mv $PROMPTS_FILE.tmp $PROMPTS_FILE\`."
  fi
fi

# ── Check 4: stale active tasks (no edits > 14 days) ───────────────────────────
if [[ -d "$TASKS_DIR/active" ]]; then
  NOW_DAY_EPOCH=$NOW_EPOCH
  # Find all plan.md files in active/; emit those where mtime is older than threshold.
  for plan in "$TASKS_DIR/active"/*/plan.md; do
    [[ ! -f "$plan" ]] && continue
    MTIME=$(stat -c %Y "$plan" 2>/dev/null || stat -f %m "$plan" 2>/dev/null || echo "$NOW_DAY_EPOCH")
    AGE_DAYS=$(( (NOW_DAY_EPOCH - MTIME) / DAY ))
    if (( AGE_DAYS > STALE_TASK_DAYS )); then
      SLUG=$(basename "$(dirname "$plan")")
      append "- **Stale task**: \`$SLUG\` hasn't been touched in $AGE_DAYS days. Review plan.md — archive, block with reason, or resume with /task-planner."
    fi
  done
fi

# ── Check 5: compaction-snapshot.md age ────────────────────────────────────────
SNAPSHOT_FILE="$MEM_DIR/compaction-snapshot.md"
if [[ -f "$SNAPSHOT_FILE" ]]; then
  MTIME=$(stat -c %Y "$SNAPSHOT_FILE" 2>/dev/null || stat -f %m "$SNAPSHOT_FILE" 2>/dev/null || echo "$NOW_EPOCH")
  AGE_DAYS=$(( (NOW_EPOCH - MTIME) / DAY ))
  if (( AGE_DAYS > SNAPSHOT_AGE_DAYS )); then
    append "- **compaction-snapshot.md** is $AGE_DAYS days old. Trigger /compact once to refresh — old snapshot probably doesn't reflect current state."
  fi
fi

# ── Check 7 (v3.7): task-ledger.md Archive row count ───────────────────────────
LEDGER_FILE_MC="$MEM_DIR/task-ledger.md"
if [[ -f "$LEDGER_FILE_MC" ]]; then
  # Count "- " lines that appear after the "## Archive" heading.
  ARCHIVE_ROWS=$(awk '
    /^## Archive/ { flag=1; next }
    flag && /^- / { c++ }
    END { print c+0 }
  ' "$LEDGER_FILE_MC" 2>/dev/null)
  ARCHIVE_ROWS=${ARCHIVE_ROWS:-0}
  if (( ARCHIVE_ROWS > LEDGER_ARCHIVE_ROWS_THRESHOLD )); then
    append "- **task-ledger.md Archive** has $ARCHIVE_ROWS rows (> $LEDGER_ARCHIVE_ROWS_THRESHOLD). Trim older entries: \`head -n 20\` the rows after '## Archive' and replace. Older tasks can be summarized in a single 'Q1 2026 completed' row."
  fi
fi

# ── Check v4.0: SQLite state db size (advisory only) ───────────────────────────
DB_PY="$(dirname "$0")/../state/db.py"
if [[ -f "$DB_PY" ]]; then
  STATS=$(python3 "$DB_PY" stats 2>/dev/null || echo "")
  if [[ -n "$STATS" ]]; then
    # Check if state db has data — if it does, surface a prompt to query history
    DECISION_COUNT=$(echo "$STATS" | grep "Decisions recorded" | awk '{print $3}' | tr -d '(' || echo "0")
    if [[ "${DECISION_COUNT:-0}" -gt 50 ]]; then
      append "- **SQLite state**: $DECISION_COUNT decisions indexed. Use \`/history-query\` for cross-session search."
    fi
  fi
fi

# ── Check 6: pending chunk reviews queue depth ─────────────────────────────────
QUEUE_FILE="$MEM_DIR/pending-reviews.jsonl"
if [[ -f "$QUEUE_FILE" ]]; then
  PENDING=$(awk '/"status":"pending"/ { c++ } END { print c+0 }' "$QUEUE_FILE" 2>/dev/null)
  PENDING=${PENDING:-0}
  if (( PENDING >= 3 )); then
    append "- **$PENDING chunks** are waiting for code review. Clear the queue: invoke code-reviewer on each in sequence (see agents/code-reviewer.md Chunk Review Mode)."
  fi
fi

# ── Nothing to suggest — remove stale suggestions file, stamp run, exit ────────
if [[ -z "$SUGGESTIONS" ]]; then
  rm -f "$SUGGESTIONS_FILE" 2>/dev/null || true
  printf '%s' "$NOW_EPOCH" > "$LAST_RUN_FILE" 2>/dev/null || true
  exit 0
fi

# ── Write suggestions file (overwrites each run — always current state) ────────
TS_HUMAN=$(date -u +"%Y-%m-%d %H:%M UTC")
{
  echo "# Memory Curator Suggestions"
  echo ""
  echo "Run at: $TS_HUMAN  "
  echo "Thresholds: decision-log ≥ ${DECISION_ROWS_THRESHOLD} rows, metrics.jsonl ≥ ${METRICS_MB_THRESHOLD} MB, user-prompts.log ≥ ${PROMPTS_MB_THRESHOLD} MB, stale-task age ≥ ${STALE_TASK_DAYS}d, snapshot age ≥ ${SNAPSHOT_AGE_DAYS}d."
  echo ""
  echo "## Suggestions"
  echo ""
  printf '%s' "$SUGGESTIONS"
  echo ""
  echo "---"
  echo ""
  echo "_This file is advisory. Next run: in 24 hours. Delete this file to silence until the next check cycle._"
} > "$SUGGESTIONS_FILE" 2>/dev/null || true

printf '%s' "$NOW_EPOCH" > "$LAST_RUN_FILE" 2>/dev/null || true

# Telemetry.
LOG_EVENT="$(dirname "$0")/log-event.sh"
if [[ -f "$LOG_EVENT" ]]; then
  SUGGEST_COUNT=$(printf '%s' "$SUGGESTIONS" | grep -c '^- ' || echo 0)
  bash "$LOG_EVENT" "\"event\":\"hook.curator_run\",\"suggestions\":$SUGGEST_COUNT" 2>/dev/null || true
fi

exit 0
