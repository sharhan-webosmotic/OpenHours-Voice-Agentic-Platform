#!/usr/bin/env bash
# hooks/log-event.sh — Telemetry event logger (Issue 10)
# Appends a structured JSON event to AI_DOCS/memory/metrics.jsonl
# Local-only. Scrubs secrets before write. Honors telemetry opt-out.
#
# Usage:
#   log-event.sh '"event":"skill.invoke","skill":"design-system"'
#   log-event.sh '"event":"hook.anchor_block","file":"api-contract.md","task":"T-042"'
#
# The caller provides the body of the JSON object (no outer braces, no ts field).
# The script wraps it with {"ts": "...", <body>} and appends one line.

# No `set -e` in hook scripts: a failing sub-command must not kill the hook.
set -uo pipefail

BODY="${1:-}"
[[ -z "$BODY" ]] && exit 0

# v4.0: Normalize skill_invoked events — ensure skill_id and skill_name fields are present
# so skill-curator can count invocations from metrics.jsonl
if echo "$BODY" | grep -q '"event":"skill'; then
  if ! echo "$BODY" | grep -q '"skill_id"'; then
    # Extract skill name if present and look up its ID
    SKILL_NAME=$(echo "$BODY" | python3 -c "
import sys, json
try:
    d = json.loads('{' + sys.stdin.read() + '}')
    print(d.get('skill', d.get('skill_name', '')))
except:
    print('')
" 2>/dev/null || echo "")
    if [[ -n "$SKILL_NAME" ]]; then
      CATALOG=".claude/skill-lab/catalog.yaml"
      # A catalog entry is "- id: SK-NNN" followed by "  name: <skill>", so the
      # id is on the line BEFORE the name. -x keeps "do" from matching "docx".
      SKILL_ID=$(tr -d '\r' 2>/dev/null < "$CATALOG" | grep -B1 -x "  name: $SKILL_NAME" | grep "id:" | head -1 | sed 's/.*id: //' | tr -d "'" || echo "")
      [[ -n "$SKILL_ID" ]] && BODY="$BODY,\"skill_id\":\"$SKILL_ID\",\"skill_name\":\"$SKILL_NAME\""
    fi
  fi
fi

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
METRICS_DIR="$AI_DOCS_DIR/memory"
METRICS_FILE="$METRICS_DIR/metrics.jsonl"

# Telemetry opt-out check. settings.local.json wins over settings.json, the
# same precedence Claude Code applies. Each file is flattened to one line
# first, because the "telemetry" block is normally pretty-printed over several
# lines and a line-based grep never saw "telemetry" and "enabled" together.
telemetry_setting() {
  [[ -f "$1" ]] || return 0
  tr -d '\r\n' 2>/dev/null < "$1" \
    | grep -oE '"telemetry"[[:space:]]*:[[:space:]]*\{[^}]*"enabled"[[:space:]]*:[[:space:]]*(true|false)' \
    | head -1 | grep -oE '(true|false)$'
}
TELEMETRY_ENABLED=$(telemetry_setting ".claude/settings.local.json")
[[ -z "$TELEMETRY_ENABLED" ]] && TELEMETRY_ENABLED=$(telemetry_setting ".claude/settings.json")
[[ "$TELEMETRY_ENABLED" == "false" ]] && exit 0

mkdir -p "$METRICS_DIR"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LINE="{\"ts\":\"$TS\",$BODY}"

SCRUB_SCRIPT="$(dirname "$0")/scrub.sh"
if [[ -f "$SCRUB_SCRIPT" ]]; then
  printf '%s\n' "$LINE" | bash "$SCRUB_SCRIPT" >> "$METRICS_FILE"
else
  printf '%s\n' "$LINE" >> "$METRICS_FILE"
fi

# v4.0: Mirror skill_invoked events to SQLite for cross-session analytics.
if echo "$BODY" | grep -q '"event":"skill'; then
  DB_PY="$(dirname "$0")/../state/db.py"
  if [[ -f "$DB_PY" ]]; then
    SKILL_N=$(echo "$BODY" | python3 -c "
import sys,json
try:
    d=json.loads('{' + sys.stdin.read() + '}')
    print(d.get('skill_name', d.get('skill', '')))
except: print('')
" 2>/dev/null || echo "")
    SKILL_I=$(echo "$BODY" | python3 -c "
import sys,json
try:
    d=json.loads('{' + sys.stdin.read() + '}')
    print(d.get('skill_id',''))
except: print('')
" 2>/dev/null || echo "")
    if [[ -n "$SKILL_N" ]]; then
      python3 "$DB_PY" insert-event \
        --type skill_invoked \
        --payload "{\"skill_name\":\"$SKILL_N\",\"skill_id\":\"$SKILL_I\"}" \
        2>/dev/null || true
    fi
  fi
fi
