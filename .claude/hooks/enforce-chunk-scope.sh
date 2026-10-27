#!/usr/bin/env bash
# hooks/enforce-chunk-scope.sh — Lock edits to the active chunk's scope (v4).
#
# Sibling of enforce-anchors.sh. Runs as a PreToolUse hook on Edit/Write/
# MultiEdit. Resolves the active complex-task plan.md path from:
#   1. session-state.md → active milestone → capsule tasks.md → DOING row Notes
#   2. Legacy fallback: INDEX.md (kept for backwards compat)
# Then:
#   1. Finds the first PENDING chunk in plan.md's Chunk Index.
#   2. Reads that chunk's "## Files Affected" section.
#   3. Blocks (exit 2) if the target file is not listed.
#
# Escape hatches:
#   - Add the file to the chunk's "## Files Affected" section, then retry.
#   - Mark the chunk DONE and move to the next (implies re-plan).
#   - Set CHUNK_SCOPE_ENFORCE=off in the environment or settings.local.json
#     to disable globally (e.g., during refactors that necessarily sprawl).
#
# Performance budget: SLOW_BUDGET_MS (5000 ms). Same auto-disable pattern as
# enforce-anchors.

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

case "$TOOL_NAME" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *) exit 0 ;;
esac

# Global escape hatch.
[[ "${CHUNK_SCOPE_ENFORCE:-on}" == "off" ]] && exit 0

# Never enforce on excluded paths — framework memory, design tokens, etc.
EXCLUDED='(^|/)(node_modules|\.next|dist|build|\.git|coverage|AI_DOCS)(/|$)|\.lock$|\.(md|svg|ico|png|jpg|jpeg|gif|webp)$'
if [[ -n "$TARGET_FILE" ]] && echo "$TARGET_FILE" | grep -qE "$EXCLUDED"; then
  exit 0
fi

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

HEALTH_LOG="$AI_DOCS_DIR/memory/hook-health.log"
mkdir -p "$(dirname "$HEALTH_LOG")" 2>/dev/null

# Auto-disable after 3 recent slow runs. Only entries whose logged value exceeds
# the budget count, so a health log full of entries from the old 50 ms threshold
# does not keep the gate off.
if [[ -f "$HEALTH_LOG" ]]; then
  OVER_BUDGET=$(tail -3 "$HEALTH_LOG" 2>/dev/null | grep "enforce-chunk-scope slow" \
                | sed -nE 's/.*slow=([0-9]+)ms.*/\1/p' \
                | awk -v b="$SLOW_BUDGET_MS" '$1 + 0 > b + 0 { c++ } END { print c + 0 }')
  if [[ "${OVER_BUDGET:-0}" -ge 3 ]]; then
    exit 0
  fi
fi

# v4: find the active complex task's plan.md path by reading:
#   1. session-state.md → active milestone → capsule tasks.md → DOING row Notes column
#   2. Legacy: INDEX.md (backwards compat)
PLAN_PATH=""

STATE_FILE_CS="$AI_DOCS_DIR/memory/session-state.md"
if [[ -f "$STATE_FILE_CS" ]]; then
  ACTIVE_MS_CS=$(grep -iE '^[[:space:]]*-?[[:space:]]*active[_ -]?milestone[[:space:]]*:' "$STATE_FILE_CS" 2>/dev/null \
                 | head -1 | sed 's/.*://; s/^[[:space:]]*//' | tr -d '[:space:]')
  if [[ -n "$ACTIVE_MS_CS" ]]; then
    CAPSULE_DIR_CS=$(ls -d "$AI_DOCS_DIR/milestones/${ACTIVE_MS_CS}"* 2>/dev/null | head -1)
    if [[ -n "$CAPSULE_DIR_CS" ]] && [[ -f "$CAPSULE_DIR_CS/tasks.md" ]]; then
      DOING_ROW_CS=$(grep -E '^\|[^|]+\|[^|]+\|[[:space:]]*DOING[[:space:]]*\|' "$CAPSULE_DIR_CS/tasks.md" 2>/dev/null | head -1)
      PLAN_PATH=$(printf '%s' "$DOING_ROW_CS" | sed -nE 's|.*(planning/tasks/active/[^|` )]+/plan\.md).*|\1|p' | head -1)
    fi
  fi
fi
# Legacy fallback: read from INDEX.md if it exists.
if [[ -z "$PLAN_PATH" ]]; then
  INDEX_FILE="$AI_DOCS_DIR/planning/tasks/INDEX.md"
  if [[ -f "$INDEX_FILE" ]]; then
    PLAN_PATH=$(awk '/^## Active/{flag=1; next} /^## [^A]/{flag=0} flag && /^\| T-/ {print; exit}' "$INDEX_FILE" 2>/dev/null \
                | sed -nE 's/.*`(active\/[^`]+\/plan\.md)`.*/\1/p' \
                | head -1)
  fi
fi

if [[ -z "$PLAN_PATH" ]]; then
  exit 0  # no complex task active → nothing to enforce
fi

# The capsule Notes path already starts with planning/tasks/, the legacy
# INDEX.md path starts at active/. Strip the prefix so both resolve. Without
# this the capsule form looked under planning/tasks/planning/tasks/ and the
# gate never enforced anything.
PLAN_FULL="$AI_DOCS_DIR/planning/tasks/${PLAN_PATH#planning/tasks/}"
[[ ! -f "$PLAN_FULL" ]] && exit 0

PLAN_DIR=$(dirname "$PLAN_FULL")

# Find the first PENDING chunk in plan.md's Chunk Index.
# Matches lines like: `- [ ] **C1**: title → chunk-01-schema.md`
PENDING_CHUNK_FILE=$(grep -m1 -E '^- \[ \]' "$PLAN_FULL" 2>/dev/null \
                    | sed -nE 's/.*` ?([^`]*\.md)`.*/\1/p; s/.*([cC]hunk-[0-9]+[A-Za-z0-9_-]*\.md).*/\1/p' \
                    | head -1)

if [[ -z "$PENDING_CHUNK_FILE" ]]; then
  # Fallback: find any chunk-NN-*.md file whose header says Status: PENDING.
  PENDING_CHUNK_FILE=$(grep -l '^Status:[[:space:]]*PENDING' "$PLAN_DIR"/chunk-*.md 2>/dev/null | head -1 | xargs -I{} basename {} 2>/dev/null)
fi

[[ -z "$PENDING_CHUNK_FILE" ]] && exit 0

CHUNK_FULL="$PLAN_DIR/$PENDING_CHUNK_FILE"
[[ ! -f "$CHUNK_FULL" ]] && exit 0

# Extract the Files Affected section. Everything between "## Files Affected"
# and the next "## " heading.
FILES_SECTION=$(awk '/^## Files Affected/{flag=1; next} /^## /{flag=0} flag' "$CHUNK_FULL" 2>/dev/null)

if [[ -z "$FILES_SECTION" ]]; then
  # Chunk missing a Files Affected section — cannot enforce, don't block.
  exit 0
fi

# Extract paths. Expected forms:
#   - CREATE: src/foo.ts
#   - MODIFY: src/bar.ts:45-80
#   - UPDATE: src/baz.ts
# Strip the action prefix and any line-range suffix.
ALLOWED_PATHS=$(printf '%s\n' "$FILES_SECTION" \
  | grep -E '^[[:space:]]*-[[:space:]]*(CREATE|MODIFY|UPDATE|DELETE|RENAME)[[:space:]]*:' \
  | sed -E 's/^[[:space:]]*-[[:space:]]*(CREATE|MODIFY|UPDATE|DELETE|RENAME)[[:space:]]*:[[:space:]]*//' \
  | sed -E 's/:[0-9]+([-–][0-9]+)?[[:space:]]*$//' \
  | sed -E 's/[[:space:]]+.*$//' \
  | sed 's/`//g' \
  | grep -v '^$')

if [[ -z "$ALLOWED_PATHS" ]]; then
  exit 0  # empty Files Affected list — don't block
fi

# Normalize target: strip leading ./ and make comparison path-basename-tolerant.
TARGET_NORM=$(printf '%s' "$TARGET_FILE" | sed 's|^\./||')

# Match if TARGET_NORM equals any allowed path OR ends with /allowed-path.
IN_SCOPE="no"
while IFS= read -r allowed; do
  [[ -z "$allowed" ]] && continue
  allowed_norm=$(printf '%s' "$allowed" | sed 's|^\./||')
  if [[ "$TARGET_NORM" == "$allowed_norm" ]] || \
     [[ "$TARGET_NORM" == *"/$allowed_norm" ]] || \
     [[ "$allowed_norm" == *"/$(basename "$TARGET_NORM")" && "$TARGET_NORM" == *"$(basename "$allowed_norm")" ]]; then
    IN_SCOPE="yes"
    break
  fi
done <<< "$ALLOWED_PATHS"

if [[ "$IN_SCOPE" == "no" ]]; then
  {
    echo "✗ chunk-scope: BLOCKED — edit target is outside the active chunk's scope."
    echo ""
    echo "  Active chunk: $PENDING_CHUNK_FILE"
    echo "  Plan:         $PLAN_PATH"
    echo "  Edit target:  $TARGET_FILE"
    echo ""
    echo "  Files listed in this chunk's '## Files Affected':"
    printf '%s\n' "$ALLOWED_PATHS" | sed 's/^/     - /'
    echo ""
    echo "  To proceed, either:"
    echo "     1. Edit one of the listed files."
    echo "     2. Update the chunk's '## Files Affected' to include $TARGET_FILE, then retry."
    echo "     3. Mark chunk DONE and advance to the next (implies re-plan)."
    echo "     4. To switch this gate off for a sprawling refactor, add"
    echo "        \"CHUNK_SCOPE_ENFORCE\": \"off\" to the \"env\" block of"
    echo "        .claude/settings.local.json and restart the session (an export"
    echo "        from a Bash call never reaches this hook). Remove it afterwards."
  } >&2

  LOG_EVENT="$(dirname "$0")/log-event.sh"
  if [[ -f "$LOG_EVENT" ]]; then
    bash "$LOG_EVENT" "\"event\":\"hook.chunk_scope_block\",\"file\":\"$TARGET_FILE\",\"chunk\":\"$PENDING_CHUNK_FILE\"" 2>/dev/null || true
  fi

  exit 2
fi

END_NS=$(date +%s%N 2>/dev/null || echo 0)
if [[ "$START_NS" =~ ^[0-9]+$ && "$END_NS" =~ ^[0-9]+$ && "$START_NS" != "0" && "$END_NS" != "0" ]]; then
  ELAPSED_MS=$(( (END_NS - START_NS) / 1000000 ))
  if [[ $ELAPSED_MS -gt $SLOW_BUDGET_MS ]]; then
    echo "$(date -u +%FT%TZ) enforce-chunk-scope slow=${ELAPSED_MS}ms" >> "$HEALTH_LOG" 2>/dev/null || true
  fi
fi

exit 0
