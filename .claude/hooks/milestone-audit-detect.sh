#!/usr/bin/env bash
# hooks/milestone-audit-detect.sh — Queue a milestone audit on PHASE-GATE approval (v3.5).
#
# Fires on PostToolUse for Edit|Write to AI_DOCS/memory/gate-status.md.
# Detects a PHASE-GATE row with verdict APPROVED (that wasn't already queued)
# and appends an entry to AI_DOCS/memory/milestone-audit-queue.jsonl.
# session-start.sh surfaces the queue; user or Claude runs /project-audit.
#
# Idempotent: a gate row is queued exactly once per unique milestone + date.
# Silent on every normal path. Exit 0 always.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
GATE_FILE="$AI_DOCS_DIR/memory/gate-status.md"
QUEUE_FILE="$AI_DOCS_DIR/memory/milestone-audit-queue.jsonl"

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
fi

# Claude Code sends an absolute path, with backslashes on Windows. Normalise to
# forward slashes before matching, or the case below never matches there.
FILE_PATH=$(printf '%s' "$FILE_PATH" | tr '\\' '/' | tr -s '/')

# Must be gate-status.md (handle both absolute and relative paths).
case "$FILE_PATH" in
  *"memory/gate-status.md"|"$GATE_FILE") ;;
  *) exit 0 ;;
esac

[[ ! -f "$GATE_FILE" ]] && exit 0

# Find PHASE-GATE rows with APPROVED verdict. Accepted formats:
#   | PHASE-GATE (M2) | 2026-04-20 | APPROVED | ... |
#   - PHASE-GATE M2 — 2026-04-20 — APPROVED — ...
#   PHASE-GATE-M2: APPROVED (2026-04-20)
# We extract milestone identifier + date as a dedup key.
APPROVED_LINES=$(grep -iE 'PHASE-?GATE' "$GATE_FILE" 2>/dev/null | grep -iE '\bAPPROVED\b' || true)
[[ -z "$APPROVED_LINES" ]] && exit 0

mkdir -p "$(dirname "$QUEUE_FILE")" 2>/dev/null
touch "$QUEUE_FILE"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NEW_ENTRIES=0

while IFS= read -r line; do
  [[ -z "$line" ]] && continue

  # Extract milestone marker (M-something or milestone number). Fall back to the whole line hash.
  MILESTONE=$(printf '%s' "$line" | grep -oE 'M[0-9]+([[:space:]-]+[^|—\-]+)?' | head -1 | tr -d ' ')
  [[ -z "$MILESTONE" ]] && MILESTONE=$(printf '%s' "$line" | md5sum 2>/dev/null | head -c 8)
  [[ -z "$MILESTONE" ]] && MILESTONE="unknown"

  # Date, if present.
  DATE=$(printf '%s' "$line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  DATE=${DATE:-unknown}

  KEY="$MILESTONE|$DATE"

  # Idempotency — skip if key already queued or completed.
  if grep -qF "\"key\":\"$KEY\"" "$QUEUE_FILE" 2>/dev/null; then
    continue
  fi

  # Extract a short title from the line for the queue entry.
  SUMMARY=$(printf '%s' "$line" | tr -s ' ' ' ' | cut -c1-160 | sed 's/"/\\"/g')

  ENTRY="{\"ts\":\"$TS\",\"key\":\"$KEY\",\"milestone\":\"$MILESTONE\",\"gate_date\":\"$DATE\",\"summary\":\"$SUMMARY\",\"status\":\"pending\"}"
  printf '%s\n' "$ENTRY" >> "$QUEUE_FILE" 2>/dev/null || true
  NEW_ENTRIES=$(( NEW_ENTRIES + 1 ))
done <<< "$APPROVED_LINES"

# Telemetry.
if (( NEW_ENTRIES > 0 )); then
  LOG_EVENT="$(dirname "$0")/log-event.sh"
  if [[ -f "$LOG_EVENT" ]]; then
    bash "$LOG_EVENT" "\"event\":\"hook.milestone_audit_queued\",\"entries\":$NEW_ENTRIES" 2>/dev/null || true
  fi
fi

exit 0
