#!/usr/bin/env bash
# hooks/task-router.sh — Route task-intent prompts through /do (v4.0).
#
# Fires on UserPromptSubmit. If the user's prompt contains task-intent
# keywords (Fix/Build/Add/Implement/Refactor/Create/Bug/Feature/Migrate/Task/
# Update/Change) AND there is NO active milestone in task-ledger.md (no row
# with Status=DOING), emit a short nudge to stdout pointing the user at /do.
# Claude Code injects hook stdout into the turn as a system note, so Claude
# sees the nudge alongside the user's prompt.
#
# Silent on: (a) no intent, (b) active milestone already exists, (c) prompt
# explicitly invokes a slash-command (user chose a different path), (d)
# ADF_BYPASS=on (user opted out of the framework for this session).

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
LEDGER="$AI_DOCS_DIR/memory/task-ledger.md"

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Bypass: user explicitly opted out of the framework this session.
if [[ "${ADF_BYPASS:-off}" == "on" ]]; then
  exit 0
fi

PROMPT=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" prompt 2>/dev/null)

[[ -z "$PROMPT" ]] && exit 0

# Skip if user invoked a slash-command — they chose the flow explicitly.
if printf '%s' "$PROMPT" | grep -qE '^[[:space:]]*/[a-zA-Z]'; then
  exit 0
fi

# Skip for trivial conversational prompts (length < 12 chars).
STRIPPED=$(printf '%s' "$PROMPT" | tr -d '[:space:]')
if (( ${#STRIPPED} < 12 )); then
  exit 0
fi

# Skip if an active milestone already exists in task-ledger.md.
# An active milestone has Status=DOING in the milestone-summary table,
# OR a non-empty "## Active milestone" section.
if [[ -f "$LEDGER" ]]; then
  # Match any row with status DOING in the milestone summary table.
  if grep -qE '^\|[[:space:]]*M[0-9]+' "$LEDGER" 2>/dev/null && \
     grep -qE '^\|[[:space:]]*M[0-9]+[^|]*\|[^|]*\|[[:space:]]*DOING[[:space:]]*\|' "$LEDGER" 2>/dev/null; then
    exit 0
  fi
  # Or check the ## Active milestone section.
  ACTIVE_MS=$(awk '/^## Active milestone/{flag=1; next} /^## /{flag=0} flag' "$LEDGER" 2>/dev/null | tr -d '[:space:]')
  if [[ -n "$ACTIVE_MS" ]]; then
    exit 0
  fi
fi

# Intent detection. Word-boundary match on verbs that typically precede work.
INTENT_PATTERN='\b(fix|build|add|implement|refactor|create|update|change|migrate|improve|wire|integrate|port|rewrite|scaffold|bug|feature|task|requirement|make|start|ship|deploy|release)\b'

if ! printf '%s' "$PROMPT" | grep -iqE "$INTENT_PATTERN"; then
  exit 0
fi

# Emit the nudge. Kept short — every byte here enters Claude's context.
cat <<'EOF'
=== ADF router ===
This prompt looks like a task request, and there is no active milestone in task-ledger.md.

Route through /do first. /do will:
  - read project state and pick the next task from the active milestone capsule
  - dispatch /build (or /plan if no project exists yet)
  - keep working context per-milestone (under ~50KB even on big projects)
  - stop at milestone boundaries to confirm with you

If you want to skip the framework for this one ("freestyle"), say so explicitly — that bypass is logged to decision-log.md and lasts for the session.
=== /ADF router ===
EOF

exit 0
