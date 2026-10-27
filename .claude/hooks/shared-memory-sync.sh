#!/usr/bin/env bash
# hooks/shared-memory-sync.sh — Cross-project memory sync (ADF v4.0)
# Called by session-end.sh on session Stop.
#
# What it does:
#   1. Extracts decisions tagged [SHARED] from decision-log.md
#   2. Appends them to ~/.adf/shared/decisions.md (deduplicated by hash)
#   3. Updates ~/.adf/projects/{project-id}.md registry entry

# No `set -e` in hook scripts: a failing sub-command must not kill the hook.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ADF_HOME="$HOME/.adf"
SHARED_DECISIONS="$ADF_HOME/shared/decisions.md"
PROJECTS_DIR="$ADF_HOME/projects"

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
DECISION_LOG="$AI_DOCS_DIR/memory/decision-log.md"
PROJECT_ID_FILE=".claude-project-id"

# Require ~/.adf/ to exist (created by setup.sh)
[[ -d "$ADF_HOME" ]] || exit 0

# ── Sync [SHARED] decisions ───────────────────────────────────────────────────
if [[ -f "$DECISION_LOG" ]]; then
  mkdir -p "$(dirname "$SHARED_DECISIONS")"
  [[ -f "$SHARED_DECISIONS" ]] || printf '# Shared Decisions\n\n<!-- Decisions tagged [SHARED] sync here automatically -->\n' > "$SHARED_DECISIONS"

  # Extract lines containing [SHARED] tag
  SHARED_LINES=$(grep '\[SHARED\]' "$DECISION_LOG" 2>/dev/null || true)

  if [[ -n "$SHARED_LINES" ]]; then
    PROJECT_NAME=$(basename "$(pwd)")
    TS=$(date -u +"%Y-%m-%d")

    while IFS= read -r line; do
      [[ -z "$line" ]] && continue

      # Deduplicate: hash the line, check if already in shared decisions
      LINE_HASH=$(printf '%s' "$line" | python3 -c "import sys,hashlib; print(hashlib.md5(sys.stdin.buffer.read()).hexdigest()[:8])" 2>/dev/null || \
                  printf '%s' "$line" | cksum | awk '{print $1}')

      if ! grep -q "<!-- hash:$LINE_HASH -->" "$SHARED_DECISIONS" 2>/dev/null; then
        printf '\n<!-- hash:%s --> <!-- from:%s on %s -->\n%s\n' \
          "$LINE_HASH" "$PROJECT_NAME" "$TS" "$line" \
          >> "$SHARED_DECISIONS"
      fi
    done <<< "$SHARED_LINES"
  fi
fi

# ── Update project registry ───────────────────────────────────────────────────
if [[ -f "$PROJECT_ID_FILE" ]]; then
  PROJECT_ID=$(cat "$PROJECT_ID_FILE" | tr -d '[:space:]')
  [[ -z "$PROJECT_ID" ]] && exit 0

  mkdir -p "$PROJECTS_DIR"
  REGISTRY_FILE="$PROJECTS_DIR/${PROJECT_ID}.md"

  PROJECT_NAME=$(basename "$(pwd)")
  PROJECT_PATH=$(pwd)
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Read current state if available
  STATE_FILE="$AI_DOCS_DIR/memory/session-state.md"
  PHASE="unknown"
  ACTIVE_TASK="none"
  if [[ -f "$STATE_FILE" ]]; then
    PHASE=$(grep -iE '^(phase|current_phase)[[:space:]]*:' "$STATE_FILE" | head -1 | sed 's/.*://; s/^[[:space:]]*//' || echo "unknown")
    ACTIVE_TASK=$(grep -iE '^(active[_-]task|current_task)[[:space:]]*:' "$STATE_FILE" | head -1 | sed 's/.*://; s/^[[:space:]]*//' || echo "none")
  fi

  cat > "$REGISTRY_FILE" << EOF
---
project_id: ${PROJECT_ID}
name: ${PROJECT_NAME}
type: adf-project
---

Project: ${PROJECT_NAME}
Path: ${PROJECT_PATH}
Last synced: ${TS}
Phase: ${PHASE}
Active task: ${ACTIVE_TASK}

Read \`AI_DOCS/memory/session-state.md\` for authoritative current state.
EOF
fi

exit 0
