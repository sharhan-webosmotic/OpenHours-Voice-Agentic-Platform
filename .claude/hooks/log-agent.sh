#!/usr/bin/env bash
# Shell safety: no `set -e` — a failure writing the audit log must not block
# or fail the agent invocation it is recording. `set -u` is safe: INPUT,
# EVENT, AGENT_NAME, AGENT_ID, and TIMESTAMP are all assigned unconditionally
# before use.
set -uo pipefail

# ADF SubagentStart + SubagentStop Hook (v2, merged from log-agent.sh and
# log-agent-stop.sh in v4.32.0). Audit trail for agent invocations. Records
# every agent start and stop to AI_DOCS/audit/agent-log.md.
#
# Event selection: $1 (start|stop) when settings passes it, otherwise the
# hook_event_name field of the stdin JSON (SubagentStart|SubagentStop).
# Anything unrecognized is ignored, so the hook can never write a wrong row.
#
# Both events carry `agent_type` (the agent name) and `agent_id`. Neither has
# a `subagent_name` or `status` field. The Notes cell holds the agent id, which
# pairs a STOP row with its START row when several agents of one type run in
# parallel.

INPUT=$(cat)
JSON_FIELD="$(dirname "$0")/json-field.sh"

EVENT="${1:-}"
if [ -z "$EVENT" ]; then
  EVENT=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" hook_event_name 2>/dev/null)
fi
case "$EVENT" in
  start|START|SubagentStart) LABEL="START" ;;
  stop|STOP|SubagentStop)    LABEL="STOP " ;;
  *) exit 0 ;;
esac

AGENT_NAME=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" agent_type 2>/dev/null)
[ -z "$AGENT_NAME" ] && AGENT_NAME="unknown"
AGENT_ID=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" agent_id 2>/dev/null)
[ -z "$AGENT_ID" ] && AGENT_ID="-"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Ensure audit directory exists
mkdir -p AI_DOCS/audit

# Initialize log with header if new (whichever event arrives first creates it)
if [ ! -f AI_DOCS/audit/agent-log.md ]; then
  echo "# Agent Audit Log" > AI_DOCS/audit/agent-log.md
  echo "" >> AI_DOCS/audit/agent-log.md
  echo "| Timestamp | Event | Agent | Notes |" >> AI_DOCS/audit/agent-log.md
  echo "|-----------|-------|-------|-------|" >> AI_DOCS/audit/agent-log.md
fi

echo "| $TIMESTAMP | $LABEL | $AGENT_NAME | $AGENT_ID |" >> AI_DOCS/audit/agent-log.md

exit 0
