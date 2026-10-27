#!/usr/bin/env bash
# hooks/user-prompt-log.sh — Persist user prompts for compaction survival (v3.3).
#
# Claude Code fires UserPromptSubmit on every user turn. The hook reads the
# prompt from stdin (JSON with a "prompt" field), scrubs secrets, and appends
# one timestamped record to AI_DOCS/memory/user-prompts.log.
#
# This is the ONLY place raw user words are guaranteed to survive compaction.
# pre-compact.sh tails the last 3 prompts into its snapshot.
#
# Silent exit on every normal path. NEVER emit to stdout — stdout is injected
# into the user's turn as a system note; this hook has nothing to say.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
LOG_DIR="$AI_DOCS_DIR/memory"
LOG_FILE="$LOG_DIR/user-prompts.log"
SCRUB_SCRIPT="$(dirname "$0")/scrub.sh"

# Read stdin JSON.
INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Extract the prompt through json-field.sh (jq when present, a decoding sed
# fallback otherwise). The private sed copy cut the prompt at its first quote.
PROMPT=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" prompt 2>/dev/null)

[[ -z "$PROMPT" ]] && exit 0

# Collapse multi-line prompts to single line for log readability.
# Preserve the content but replace literal newlines with " / " separators.
PROMPT_ONE_LINE=$(printf '%s' "$PROMPT" | tr '\n' '\r' | sed 's/\r\r*/ \/ /g' | tr -d '\r')

# Cap length per entry. Very long pastes should not balloon the log.
MAX_CHARS=2000
if (( ${#PROMPT_ONE_LINE} > MAX_CHARS )); then
  PROMPT_ONE_LINE="${PROMPT_ONE_LINE:0:$MAX_CHARS} [truncated]"
fi

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ENTRY="[${TS}] ${PROMPT_ONE_LINE}"

mkdir -p "$LOG_DIR" 2>/dev/null

# Scrub secrets before writing.
if [[ -f "$SCRUB_SCRIPT" ]]; then
  printf '%s\n' "$ENTRY" | bash "$SCRUB_SCRIPT" >> "$LOG_FILE" 2>/dev/null || true
else
  printf '%s\n' "$ENTRY" >> "$LOG_FILE" 2>/dev/null || true
fi

exit 0
