#!/usr/bin/env bash
# hooks/enforce-ship-gate.sh: Production deploy gate (v1.0, ADF 4.6).
#
# PreToolUse[Bash] guard. Blocks production deploy commands unless the project
# has a passing audit AND Gate 5 (Scope Closure) PASSED. This is the mechanical
# backstop for the /ship skill's prose pre-flight: it fires even when a deploy
# command is run directly, bypassing /ship.
#
# Blocked (production) deploy command families:
#   vercel ... --prod, netlify deploy ... --prod, wrangler [pages] deploy,
#   fly|flyctl deploy, npm|pnpm|yarn run deploy|release|ship,
#   yarn deploy|release|ship, pnpm release|ship
# Preview/dev deploys (bare `vercel`, `netlify deploy` without --prod) are
# intentionally NOT matched, to avoid blocking routine preview pushes.
#
# Clearance required (both):
#   - AI_DOCS/audit/audit-report.md  →  **Verdict:** PASS
#   - AI_DOCS/memory/gate-status.md  →  a "Gate 5" line that is PASSED/APPROVED
#
# Escape hatch: ADF_SHIP_OVERRIDE=on (must be logged in decision-log.md).
# POC fast-path: planning_depth: poc in stack.md is not gated.
# Fail-open contract: only a positive deploy-command match WITHOUT clearance
# exits 2. Anything unexpected (no AI_DOCS/, unreadable stdin, no command match)
# exits 0.
#
# Runs on: PreToolUse for Bash. Exit codes: 0 (allow) or 2 (block). Nothing else.

set -uo pipefail

[ "${ADF_SHIP_OVERRIDE:-}" = "on" ] && exit 0
[ -d AI_DOCS ] || exit 0

INPUT=$(cat 2>/dev/null || true)
[ -n "$INPUT" ] || exit 0

# Read the command through json-field.sh (jq when present, a decoding sed
# fallback otherwise). Grepping the raw payload also matched the tool call's
# description text, so a harmless command described with the words of a gated
# one was blocked. The raw payload stays only as the last resort when nothing
# can be extracted, so a parse failure degrades to enforcement.
CMD=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" command 2>/dev/null)
[ -n "$CMD" ] || CMD="$INPUT"

# Production deploy command families only.
PATTERN='vercel[[:space:]].*--prod'
PATTERN="$PATTERN|netlify[[:space:]]+deploy.*--prod"
PATTERN="$PATTERN|wrangler[[:space:]]+(pages[[:space:]]+)?deploy"
PATTERN="$PATTERN|fly(ctl)?[[:space:]]+deploy"
# The script name must END there: deploy:staging and release-notes are other
# scripts. yarn runs a script without "run", and so does pnpm for release and
# ship. "pnpm deploy" is a pnpm builtin (it copies a workspace package), so
# pnpm and npm need "run" for a script called deploy. A production suffix
# (deploy:prod, deploy:production, release:live, deploy-prod) still names the
# production script, so it may sit between the name and its end.
END="([:-](prod|production|live))?([[:space:];&|)\"']|\$)"
PATTERN="$PATTERN|(npm|pnpm|yarn)[[:space:]]+run[[:space:]]+(deploy|release|ship)$END"
PATTERN="$PATTERN|yarn[[:space:]]+(deploy|release|ship)$END"
PATTERN="$PATTERN|pnpm[[:space:]]+(release|ship)$END"

# A backslash-newline continues the command line. Join those before the
# line-based grep, so "netlify deploy \<newline> --prod" is read as one line.
CMD_JOINED=$(printf '%s\n' "$CMD" | sed -e ':a' -e '/\\$/N' -e 's/\\\n/ /' -e 'ta')
printf '%s\n' "$CMD_JOINED" | grep -qE "$PATTERN" || exit 0

# POC projects are not gated.
STACK_MD="AI_DOCS/memory/stack.md"
if [ -f "$STACK_MD" ] && grep -iqE '^[[:space:]]*planning_depth[[:space:]]*:[[:space:]]*poc' "$STACK_MD" 2>/dev/null; then
  exit 0
fi

AUDIT="AI_DOCS/audit/audit-report.md"
GATE_STATUS="AI_DOCS/memory/gate-status.md"

AUDIT_OK=0
if [ -f "$AUDIT" ] && grep -iqE 'verdict[^a-z]*pass' "$AUDIT" 2>/dev/null; then
  AUDIT_OK=1
fi

# Read Gate 5's OWN row or line and the status position on it
# (hooks/gate-status-read.sh). The old read accepted any line that mentioned
# Gate 5 and contained passed or approved anywhere, so
# "| Gate 5 | PENDING | must be PASSED before /ship |" cleared the gate.
# passed-first: the dashboard row decides when there is one, otherwise the
# FIRST mention decides, as the old "head -1" read did. A later history or
# changelog line that says PASSED never clears a Gate 5 that is now PENDING.
GATE5_OK=0
if [ -f "$GATE_STATUS" ] \
   && bash "$(dirname "$0")/gate-status-read.sh" passed-first "$GATE_STATUS" 'gate[ \t-]*5' passed pass approved >/dev/null 2>&1; then
  GATE5_OK=1
fi

if [ "$AUDIT_OK" = "1" ] && [ "$GATE5_OK" = "1" ]; then
  exit 0
fi

{
  echo ""
  echo "========================================"
  echo "  SHIP GATE"
  echo "========================================"
  echo "  Production deploy command detected, but"
  echo "  this project is not cleared to ship."
  echo ""
  [ "$AUDIT_OK" = "1" ] || echo "  - Audit not PASS:    $AUDIT"
  [ "$GATE5_OK" = "1" ] || echo "  - Gate 5 not PASSED: $GATE_STATUS"
  echo ""
  echo "  ACTION REQUIRED:"
  echo "  1. Run /audit until the verdict is PASS."
  echo "  2. Run gate-enforcement Gate 5 (scope"
  echo "     closure) until it is PASSED."
  echo "  3. Ship via /ship (it runs the full"
  echo "     pre-flight), then retry."
  echo ""
  echo "  Emergency escape: ADF_SHIP_OVERRIDE=on"
  echo "  (must be logged in decision-log.md)."
  echo "========================================"
} >&2
exit 2
