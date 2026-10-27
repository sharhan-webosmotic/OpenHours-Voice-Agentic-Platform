#!/usr/bin/env bash
# hooks/enforce-anchors.sh — Anchor manifest enforcement (v4)
# PreToolUse hook for Edit/Write/MultiEdit.
# Reads the active chunk file's frontmatter `requires:` list (resolved via
# session-state → milestone capsule → tasks.md → plan.md → pending chunk).
# Legacy fallback: planning/tasks/active-task.md (kept for backwards compat).
# For each required file: critical=true → block if unread; false → warn.
#
# Default enforcement_mode: advisory (critical anchors only block).
# Escalated to strict by setting enforcement_mode: strict in frontmatter.
#
# Performance budget: SLOW_BUDGET_MS (5000 ms). Auto-disables after 3 consecutive
# runs above it.
#
# IMPORTANT: never use `set -e` here. Hook scripts assign vars from
# grep|head|sed pipelines where a no-match grep is a NORMAL state. With
# `set -e` + `pipefail` those assignments kill the script with exit 1 and
# empty stderr, which Claude Code reports as a hook error and the edit fails.
# Allowed exit codes: 0 (allow) and 2 (deliberate block). Nothing else.

set -uo pipefail

START_NS=$(date +%s%N 2>/dev/null || echo 0)

# Slow-run budget in milliseconds. A run is logged as slow only above it, and the
# auto-disable valve counts only logged runs above it. The budget used to be
# 50 ms, which a bash hook cannot meet on Windows (1.4 to 2 s measured), so three
# ordinary edits switched the gate off for good.
SLOW_BUDGET_MS=5000

TOOL_NAME="${1:-}"
TARGET_FILE="${2:-}"

# When invoked with no args (settings.json hook style), parse the hook JSON
# from stdin. Works without jq via a sed fallback (jq is often absent on
# Windows Git Bash, and a missing jq must never break edits).
if [[ -z "$TOOL_NAME" ]]; then
  INPUT=$(cat 2>/dev/null || echo "")
  if [[ -n "$INPUT" ]]; then
    JSON_FIELD="$(dirname "$0")/json-field.sh"
    TOOL_NAME=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" tool_name 2>/dev/null)
    TARGET_FILE=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" file_path 2>/dev/null)
  fi
fi

# Normalize Windows backslashes (raw or JSON-escaped) so the exclusion
# regexes below match paths like code\api\prisma\schema.prisma.
if [[ -n "$TARGET_FILE" ]]; then
  TARGET_FILE=$(printf '%s' "$TARGET_FILE" | tr '\\' '/' | sed 's#//*#/#g')
fi

# Only enforce on edit-style tools.
case "$TOOL_NAME" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *) exit 0 ;;
esac

# Never enforce on excluded paths.
EXCLUDED='(^|/)(node_modules|\.next|dist|build|\.git|coverage|AI_DOCS/memory)(/|$)|\.lock$|\.(md|svg|ico)$'
if [[ -n "$TARGET_FILE" ]] && echo "$TARGET_FILE" | grep -qE "$EXCLUDED"; then
  exit 0
fi

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

# v4: resolve the active anchor source from:
#   1. Active milestone's DOING task row → plan.md → pending chunk file (has requires: frontmatter)
#   2. Legacy: planning/tasks/active-task.md (backwards compat)
TASK_FILE=""

STATE_FILE_AE="$AI_DOCS_DIR/memory/session-state.md"
if [[ -f "$STATE_FILE_AE" ]]; then
  ACTIVE_MS_AE=$(grep -iE '^[[:space:]]*-?[[:space:]]*active[_ -]?milestone[[:space:]]*:' "$STATE_FILE_AE" 2>/dev/null \
                 | head -1 | sed 's/.*://; s/^[[:space:]]*//' | tr -d '[:space:]')
  if [[ -n "$ACTIVE_MS_AE" ]]; then
    CAPSULE_DIR_AE=$(ls -d "$AI_DOCS_DIR/milestones/${ACTIVE_MS_AE}"* 2>/dev/null | head -1)
    if [[ -n "$CAPSULE_DIR_AE" ]] && [[ -f "$CAPSULE_DIR_AE/tasks.md" ]]; then
      DOING_ROW_AE=$(grep -E '^\|[^|]+\|[^|]+\|[[:space:]]*DOING[[:space:]]*\|' "$CAPSULE_DIR_AE/tasks.md" 2>/dev/null | head -1)
      PLAN_REL_AE=$(printf '%s' "$DOING_ROW_AE" | sed -nE 's|.*(planning/tasks/active/[^|` )]+/plan\.md).*|\1|p' | head -1)
      if [[ -n "$PLAN_REL_AE" ]]; then
        PLAN_FULL_AE="$AI_DOCS_DIR/$PLAN_REL_AE"
        PLAN_DIR_AE=$(dirname "$PLAN_FULL_AE")
        if [[ -f "$PLAN_FULL_AE" ]]; then
          PENDING_CHUNK_AE=$(grep -m1 -E '^- \[ \]' "$PLAN_FULL_AE" 2>/dev/null \
                             | sed -nE 's/.*([cC]hunk-[0-9]+[A-Za-z0-9_-]*\.md).*/\1/p' | head -1)
          if [[ -n "$PENDING_CHUNK_AE" ]] && [[ -f "$PLAN_DIR_AE/$PENDING_CHUNK_AE" ]]; then
            TASK_FILE="$PLAN_DIR_AE/$PENDING_CHUNK_AE"
          fi
        fi
      fi
    fi
  fi
fi
# Legacy fallback
if [[ -z "$TASK_FILE" ]]; then
  TASK_FILE="$AI_DOCS_DIR/planning/tasks/active-task.md"
fi
[[ ! -f "$TASK_FILE" ]] && exit 0

HEALTH_LOG="$AI_DOCS_DIR/memory/hook-health.log"
mkdir -p "$(dirname "$HEALTH_LOG")"

# If auto-disabled, skip silently. Only entries whose logged value exceeds the
# budget count, so a health log full of entries from the old 50 ms threshold
# does not keep the gate off.
if [[ -f "$HEALTH_LOG" ]]; then
  OVER_BUDGET=$(tail -3 "$HEALTH_LOG" 2>/dev/null | sed -nE 's/.*slow=([0-9]+)ms.*/\1/p' \
                | awk -v b="$SLOW_BUDGET_MS" '$1 + 0 > b + 0 { c++ } END { print c + 0 }')
  if [[ "${OVER_BUDGET:-0}" -ge 3 ]]; then
    exit 0
  fi
fi

# Parse frontmatter requires: list. Simplified YAML parse — expects the
# structure produced by task-planner.sh.
FM=$(awk '/^---/{c++; next} c==1{print}' "$TASK_FILE")
MODE=$(echo "$FM" | grep -E '^enforcement_mode[[:space:]]*:' | head -1 | sed 's/.*://; s/^[[:space:]]*//' || echo "advisory")

READ_SESSION_FILE="$AI_DOCS_DIR/memory/session-reads.log"
touch "$READ_SESSION_FILE"

CRITICAL_UNREAD=()
ADVISORY_UNREAD=()

# Parse requires list — each entry is `- path: X` optionally followed by `critical: true|false`.
current_path=""
current_critical="false"
while IFS= read -r line; do
  if echo "$line" | grep -qE '^[[:space:]]*-[[:space:]]*path[[:space:]]*:'; then
    # Flush prior entry.
    if [[ -n "$current_path" ]]; then
      # Substring match (-F, no -x): session-reads.log records absolute
      # paths while requires: anchors are project-relative.
      if ! grep -qF "$current_path" "$READ_SESSION_FILE" 2>/dev/null; then
        if [[ "$current_critical" == "true" ]] || [[ "$MODE" == "strict" ]]; then
          CRITICAL_UNREAD+=("$current_path")
        else
          ADVISORY_UNREAD+=("$current_path")
        fi
      fi
    fi
    current_path=$(echo "$line" | sed 's/.*path[[:space:]]*:[[:space:]]*//; s/^["'"'"']//; s/["'"'"']$//' | tr -d '[:space:]')
    current_critical="false"
  elif echo "$line" | grep -qE '^[[:space:]]+critical[[:space:]]*:[[:space:]]*true'; then
    current_critical="true"
  fi
done <<< "$(echo "$FM" | awk '/^requires:/{f=1; next} f && /^[^[:space:]-]/{f=0} f{print}')"

# Final flush.
if [[ -n "$current_path" ]] && ! grep -qF "$current_path" "$READ_SESSION_FILE" 2>/dev/null; then
  if [[ "$current_critical" == "true" ]] || [[ "$MODE" == "strict" ]]; then
    CRITICAL_UNREAD+=("$current_path")
  else
    ADVISORY_UNREAD+=("$current_path")
  fi
fi

# Emit warnings for advisory unread.
if [[ ${#ADVISORY_UNREAD[@]} -gt 0 ]]; then
  echo "⚠ anchor-advisory: unread anchors referenced by active task:" >&2
  for f in "${ADVISORY_UNREAD[@]}"; do echo "   - $f" >&2; done
fi

# Block on critical unread.
if [[ ${#CRITICAL_UNREAD[@]} -gt 0 ]]; then
  {
    echo "✗ anchor-enforce: BLOCKED — critical anchors unread."
    echo ""
    echo "Read these files first, then retry the edit:"
    for f in "${CRITICAL_UNREAD[@]}"; do echo "   Read $f"; done
    echo ""
    echo "To override: set 'enforcement_mode: advisory' in $TASK_FILE and mark the anchor as critical:false, OR read the required files."
  } >&2

  LOG_EVENT="$(dirname "$0")/log-event.sh"
  if [[ -f "$LOG_EVENT" ]]; then
    for f in "${CRITICAL_UNREAD[@]}"; do
      bash "$LOG_EVENT" "\"event\":\"hook.anchor_block\",\"file\":\"$f\",\"tool\":\"$TOOL_NAME\""
    done
  fi

  exit 2
fi

# Performance tracking.
END_NS=$(date +%s%N 2>/dev/null || echo 0)
if [[ "$START_NS" =~ ^[0-9]+$ && "$END_NS" =~ ^[0-9]+$ && "$START_NS" != "0" && "$END_NS" != "0" ]]; then
  ELAPSED_MS=$(( (END_NS - START_NS) / 1000000 ))
  if [[ $ELAPSED_MS -gt $SLOW_BUDGET_MS ]]; then
    echo "$(date -u +%FT%TZ) enforce-anchors slow=${ELAPSED_MS}ms" >> "$HEALTH_LOG" 2>/dev/null || true
  fi
fi

exit 0
