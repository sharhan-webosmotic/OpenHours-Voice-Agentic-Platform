#!/usr/bin/env bash
# hooks/session-end.sh — Per-project memory writer (Issue 6)
# Writes a project-scoped memory pointer on session Stop.
# Scope key: stable .claude-project-id UUID (created at kickoff).

# No `set -e` in hook scripts: a failing sub-command must not kill the hook.
set -uo pipefail

PROJECT_ID_FILE=".claude-project-id"
if [[ ! -f "$PROJECT_ID_FILE" ]]; then
  # No project UUID — skip (session-start / kickoff will create on next init)
  exit 0
fi

PROJECT_ID=$(cat "$PROJECT_ID_FILE" | tr -d '[:space:]')
[[ -z "$PROJECT_ID" ]] && exit 0

MEMORY_DIR="$HOME/.claude/projects"
# Fall back to a per-user memory dir if the standard Claude Code dir is absent.
mkdir -p "$MEMORY_DIR"

MEMORY_FILE="$MEMORY_DIR/project_${PROJECT_ID}.md"

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
STATE_FILE="$AI_DOCS_DIR/memory/session-state.md"

PROJECT_NAME=$(basename "$(pwd)")
PHASE="unknown"
ACTIVE_TASK="none"
LAST_SKILL="none"
if [[ -f "$STATE_FILE" ]]; then
  PHASE=$(grep -iE '^(phase|current_phase)[[:space:]]*:' "$STATE_FILE" | head -1 | sed 's/.*://; s/^[[:space:]]*//' || echo "unknown")
  ACTIVE_TASK=$(grep -iE '^(active[_-]task|current_task)[[:space:]]*:' "$STATE_FILE" | head -1 | sed 's/.*://; s/^[[:space:]]*//' || echo "none")
  LAST_SKILL=$(grep -iE '^(last_skill|current_skill)[[:space:]]*:' "$STATE_FILE" | head -1 | sed 's/.*://; s/^[[:space:]]*//' || echo "none")
fi

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Build payload and scrub secrets.
SCRUB_SCRIPT="$(dirname "$0")/scrub.sh"
PAYLOAD=$(cat <<EOF
---
name: project-${PROJECT_ID}
description: Last-known state for ${PROJECT_NAME}; used on next session resume to pick up where we left off
type: project
---

Project: ${PROJECT_NAME}
Path: $(pwd)
Last session ended: ${TS}
Phase: ${PHASE}
Active task: ${ACTIVE_TASK}
Last skill invoked: ${LAST_SKILL}

Read AI_DOCS/memory/session-state.md on resume for the authoritative current state.
This memory entry is a pointer only — may be stale if the project changed since session end.
EOF
)

if [[ -f "$SCRUB_SCRIPT" ]]; then
  printf '%s\n' "$PAYLOAD" | bash "$SCRUB_SCRIPT" > "$MEMORY_FILE"
else
  printf '%s\n' "$PAYLOAD" > "$MEMORY_FILE"
fi

# Emit telemetry event.
LOG_EVENT="$(dirname "$0")/log-event.sh"
if [[ -f "$LOG_EVENT" ]]; then
  bash "$LOG_EVENT" "\"event\":\"session.end\",\"project_id\":\"$PROJECT_ID\",\"phase\":\"$PHASE\""
fi

# v4.0: Sync [SHARED] decisions to ~/.adf/shared/ and update project registry
SHARED_SYNC="$(dirname "$0")/shared-memory-sync.sh"
if [[ -f "$SHARED_SYNC" ]]; then
  bash "$SHARED_SYNC" 2>/dev/null || true
fi

# v4.0: Record session end event in SQLite state database.
DB_PY="$(dirname "$0")/../state/db.py"
if [[ -f "$DB_PY" ]]; then
  python3 "$DB_PY" insert-event \
    --type session_end \
    --payload "{\"phase\":\"$PHASE\",\"project\":\"$(basename "$(pwd)")\"}" \
    2>/dev/null || true
fi
