#!/usr/bin/env bash
# hooks/log-skill-invoke.sh — PostToolUse[Skill] telemetry (M01:T-14).
#
# Records each Skill invocation to AI_DOCS/memory/metrics.jsonl as a
# `skill.invoke` event, so the retrospective and skill-curator can count which
# skills actually ran. Before this hook, metrics.jsonl captured only hook-level
# events (pre_compact, chunk_review) because nothing called log-event.sh on a
# skill invocation. Reads the tool JSON on stdin; extracts tool_input.skill.
#
# Fail-open: hook plumbing must never break a tool call (always exit 0).

set -uo pipefail

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

SKILL=$(printf '%s' "$INPUT" | bash .claude/hooks/json-field.sh skill 2>/dev/null || echo "")
[[ -z "$SKILL" ]] && exit 0

bash .claude/hooks/log-event.sh "\"event\":\"skill.invoke\",\"skill\":\"$SKILL\"" 2>/dev/null || true
exit 0
