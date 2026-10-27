#!/usr/bin/env bash
# hooks/design-gate.sh: Block visual/UI work until the UX structure is validated.
#
# Track G (gated Requirement -> UX -> UI pipeline): the UI gate does not open until
# UX is validated. No color, no tokens, no design-system components until Gate UX-1
# (UX Structure Validated) has passed. This PreToolUse backstop blocks edits to:
#   - anything under design-system/** (tokens.json + components), and
#   - the token file (src/design/tokens.*, tailwind.config.*).
# until gate-status.md records the UX-1 pass.
#
# Scoping: only enforced when the gated pipeline is ACTIVE for the project, i.e.
# AI_DOCS/design/ux-brief.md exists (produced by /ux-foundation). POC and legacy
# projects that do not run the pipeline are unaffected (fail open).
#
# Escape: ADF_DESIGN_UNLOCK=on AND a matching line in decision-log.md (recorded,
# not just toggled). Mirrors the shell-lock / infra-cost-gate ledger pattern.
#
# Runs on: PreToolUse for Edit | Write | MultiEdit.
# Exit codes: 0 (allow) or 2 (block). Nothing else. No `set -e`. No jq required.
# Fails open on any infra error so it never breaks a tool call outside the gate.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Extract file_path through json-field.sh (jq when present, sed fallback otherwise).
FILE=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" file_path 2>/dev/null)
[[ -z "$FILE" ]] && exit 0
FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')

# Is the target a visual/UI-system file the gate guards?
GUARDED=""
case "$FILE_NORM" in
  */design-system/*|design-system/*) GUARDED=1 ;;
  */src/design/tokens.*|src/design/tokens.*) GUARDED=1 ;;
  */tailwind.config.*|tailwind.config.*) GUARDED=1 ;;
esac
[[ -z "$GUARDED" ]] && exit 0

# Resolve project root by walking up to the folder containing AI_DOCS/ (cwd-safe).
ROOT="."
if [[ "$FILE_NORM" == */* ]]; then
  DIR="${FILE_NORM%/*}"; HOPS=0
  while [[ -n "$DIR" && "$DIR" != "." && "$DIR" != "/" && $HOPS -lt 25 ]]; do
    if [[ -d "$DIR/$AI_DOCS_DIR" ]]; then ROOT="$DIR"; break; fi
    PARENT="${DIR%/*}"; [[ "$PARENT" == "$DIR" ]] && break; DIR="$PARENT"; HOPS=$((HOPS + 1))
  done
fi

UX_BRIEF="$ROOT/$AI_DOCS_DIR/design/ux-brief.md"
GATE_STATUS="$ROOT/$AI_DOCS_DIR/memory/gate-status.md"
DECISION_LOG="$ROOT/$AI_DOCS_DIR/memory/decision-log.md"

# Pipeline not active for this project -> do not enforce (fail open).
[[ -f "$UX_BRIEF" ]] || exit 0

# UX-1 passed -> allow visual work. The gate's OWN row or line is read, and the
# status position on it (hooks/gate-status-read.sh). Accepted spellings:
# "Gate UX-1: PASS", "UX-1 PASS", "G_UX1 = PASS", and a table row whose Status
# cell is PASS, PASSED, or APPROVED. The old read matched "Gate UX-1.*PASS"
# anywhere on a line, so "| Gate UX-1 | PENDING | must PASS before color |"
# opened the gate.
if bash "$(dirname "$0")/gate-status-read.sh" passed "$GATE_STATUS" '(gate[ \t-]*)?ux[ \t-]*1|g_ux1' pass passed approved >/dev/null 2>&1; then
  exit 0
fi

# Verified escape: env toggle AND a recorded override in decision-log.md.
if [[ "${ADF_DESIGN_UNLOCK:-off}" == "on" ]]; then
  if grep -qi "ADF_DESIGN_UNLOCK" "$DECISION_LOG" 2>/dev/null; then
    exit 0
  fi
  cat <<EOF >&2

========================================
  ADF DESIGN-GATE: override not recorded
========================================
ADF_DESIGN_UNLOCK=on is set but decision-log.md has no matching entry.
Record the override first (append a "## Bypass - ADF_DESIGN_UNLOCK" line with the
reason to AI_DOCS/memory/decision-log.md), then retry.
From hooks/design-gate.sh.
========================================
EOF
  exit 2
fi

cat <<EOF >&2

========================================
  ADF DESIGN-GATE BLOCK
========================================
Target: $FILE
The UI gate is not open yet. Gate UX-1 (UX Structure Validated) has not passed, so
color, tokens, and design-system components must not be written. Requirement -> UX
-> UI is three gates: validate the grayscale UX structure (IA, flows, the full
enterprise state set, WCAG 2.2 structural pass) first.

Finish Phase 1 (design-direction grayscale + design-screens) and record the UX-1
pass in gate-status.md, then retry. If a deliberate override is truly needed:
  1. Append a "## Bypass - ADF_DESIGN_UNLOCK" reason line to decision-log.md, then
  2. export ADF_DESIGN_UNLOCK=on   (then retry)

From hooks/design-gate.sh.
========================================
EOF
exit 2
