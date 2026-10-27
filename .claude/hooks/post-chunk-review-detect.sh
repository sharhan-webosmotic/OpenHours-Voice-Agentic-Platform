#!/usr/bin/env bash
# hooks/post-chunk-review-detect.sh — Queue a code review when a chunk closes (v3.4).
#
# Fires on PostToolUse for Edit|Write|MultiEdit. If the edited file matches
# chunk-NN-*.md AND its Status header is DONE, append one JSON line to
# AI_DOCS/memory/pending-reviews.jsonl requesting a review of that chunk's
# Files Affected. Idempotent: won't queue twice for the same chunk while the
# previous entry is still status=pending.
#
# session-start.sh surfaces the queue on the next session; Claude is expected
# to invoke the code-reviewer agent (Chunk Review Mode — see
# agents/code-reviewer.md).
#
# Silent on all normal paths. Exit 0 always — never block edits.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
QUEUE_FILE="$AI_DOCS_DIR/memory/pending-reviews.jsonl"
LOG_EVENT="$(dirname "$0")/log-event.sh"

# Stdin is the Claude Code PostToolUse payload. We only need tool_input.file_path.
INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

if command -v jq >/dev/null 2>&1; then
  FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
fi

[[ -z "$FILE_PATH" ]] && exit 0

# Claude Code sends an absolute path, with backslashes on Windows. Normalise to
# forward slashes here, so the stored chunk_file, the plan lookup and the
# idempotency check below all see the same string on every run.
FILE_PATH=$(printf '%s' "$FILE_PATH" | tr '\\' '/' | tr -s '/')

# Only react to chunk files. Match chunk-NN-*.md anywhere in the path.
BASENAME=$(basename "$FILE_PATH")
case "$BASENAME" in
  chunk-[0-9]*-*.md|chunk-[0-9]*.md) ;;
  *) exit 0 ;;
esac

# File must exist (edits can be to non-existent paths in some race conditions).
[[ ! -f "$FILE_PATH" ]] && exit 0

# Read the Status header. Accept DONE, done, Done — case-insensitive.
STATUS=$(grep -m1 -iE '^Status[[:space:]]*:' "$FILE_PATH" 2>/dev/null | sed 's/.*://; s/^[[:space:]]*//' | tr -d '[:space:]')
STATUS_UPPER=$(printf '%s' "$STATUS" | tr '[:lower:]' '[:upper:]')

# Only queue when the chunk just went DONE.
[[ "$STATUS_UPPER" != "DONE" ]] && exit 0

# Normalize path — strip leading ./ to match what we'll store.
NORM_PATH=$(printf '%s' "$FILE_PATH" | sed 's|^\./||')

mkdir -p "$(dirname "$QUEUE_FILE")" 2>/dev/null
touch "$QUEUE_FILE"

# Idempotency: skip if we already have a pending entry for this chunk. The path
# is matched as a fixed string: as a regex, a folder such as "proj (1)" never
# matched itself and the same chunk was queued again.
if grep -F -- "\"chunk_file\":\"$NORM_PATH\"" "$QUEUE_FILE" 2>/dev/null | grep -q '"status":"pending"'; then
  exit 0
fi

# Extract Files Affected as a JSON array.
FILES_SECTION=$(awk '/^## Files Affected/{flag=1; next} /^## /{flag=0} flag' "$FILE_PATH" 2>/dev/null)

# Build the array. Each line like "- CREATE: src/foo.ts" or "- MODIFY: src/bar.ts:12-40" → "src/foo.ts".
FILES_JSON="[]"
if [[ -n "$FILES_SECTION" ]]; then
  FILES_LIST=$(printf '%s\n' "$FILES_SECTION" \
    | grep -E '^[[:space:]]*-[[:space:]]*(CREATE|MODIFY|UPDATE|DELETE|RENAME)[[:space:]]*:' \
    | sed -E 's/^[[:space:]]*-[[:space:]]*(CREATE|MODIFY|UPDATE|DELETE|RENAME)[[:space:]]*:[[:space:]]*//' \
    | sed -E 's/:[0-9]+([-–][0-9]+)?[[:space:]]*$//' \
    | sed -E 's/[[:space:]]+.*$//' \
    | sed 's/`//g' \
    | grep -v '^$')
  if [[ -n "$FILES_LIST" ]]; then
    # Join into a JSON array via jq if possible; else hand-roll.
    if command -v jq >/dev/null 2>&1; then
      FILES_JSON=$(printf '%s\n' "$FILES_LIST" | jq -R . | jq -s -c . 2>/dev/null || echo "[]")
    else
      # Hand-rolled — escape double quotes, wrap each line, join with commas.
      JOINED=$(printf '%s\n' "$FILES_LIST" | awk 'BEGIN{ORS=""} NR>1{print ","} {gsub(/"/, "\\\""); print "\"" $0 "\""}')
      FILES_JSON="[$JOINED]"
    fi
  fi
fi

# Find the plan file (directory of the chunk should contain plan.md).
CHUNK_DIR=$(dirname "$NORM_PATH")
PLAN_REL=""
if [[ -f "$CHUNK_DIR/plan.md" ]]; then
  # Compute path relative to AI_DOCS/planning/tasks if possible — matches how
  # pre-compact.sh references it.
  case "$CHUNK_DIR" in
    *"planning/tasks/"*)
      PLAN_REL=$(printf '%s' "$CHUNK_DIR/plan.md" | sed 's|^.*planning/tasks/||')
      ;;
    *)
      PLAN_REL="$CHUNK_DIR/plan.md"
      ;;
  esac
fi

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Emit one JSON line.
ENTRY=$(cat <<EOF
{"ts":"$TS","chunk_file":"$NORM_PATH","plan":"$PLAN_REL","files":$FILES_JSON,"status":"pending"}
EOF
)

# Scrub secrets (belt-and-suspenders; chunk files shouldn't contain them).
SCRUB_SCRIPT="$(dirname "$0")/scrub.sh"
if [[ -f "$SCRUB_SCRIPT" ]]; then
  printf '%s\n' "$ENTRY" | bash "$SCRUB_SCRIPT" >> "$QUEUE_FILE" 2>/dev/null || true
else
  printf '%s\n' "$ENTRY" >> "$QUEUE_FILE" 2>/dev/null || true
fi

# Telemetry.
if [[ -f "$LOG_EVENT" ]]; then
  bash "$LOG_EVENT" "\"event\":\"hook.chunk_review_queued\",\"chunk\":\"$NORM_PATH\"" 2>/dev/null || true
fi

# v4.0: Record chunk completion in SQLite state database.
DB_PY="$(dirname "$0")/../state/db.py"
if [[ -f "$DB_PY" ]]; then
  python3 "$DB_PY" insert-event \
    --type chunk_completed \
    --payload "{\"chunk\":\"$NORM_PATH\",\"files\":$FILES_JSON}" \
    2>/dev/null || true
fi

exit 0
