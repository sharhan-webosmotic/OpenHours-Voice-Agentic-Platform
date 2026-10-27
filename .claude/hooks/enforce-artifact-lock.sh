#!/usr/bin/env bash
# hooks/enforce-artifact-lock.sh: Freeze the locked planning artifacts after Gate 1.
#
# Mirrors the api-contract.md lock, extended to the two machine-readable sources of
# truth added in MAVS Wave 2:
#   - AI_DOCS/architecture/database-schema.md  (marker: "SCHEMA LOCKED")
#   - AI_DOCS/architecture/authz-matrix.yaml   (marker: "AUTHZ MATRIX LOCKED")
# Once Gate 1 records the marker in gate-status.md, the artifact is frozen so code
# is validated against a stable contract. Changes route through /change-request,
# which updates the spec + the artifact + re-locks.
#
# Escape (per artifact): the env toggle AND a recorded line in decision-log.md
#   - schema:  ADF_SCHEMA_UNLOCK=on  + a logged "ADF_SCHEMA_UNLOCK" entry
#   - authz:   ADF_AUTHZ_UNLOCK=on   + a logged "ADF_AUTHZ_UNLOCK" entry
# The toggle alone is not enough (the override must be recorded). Matches the
# enforce-shell-lock.sh / infra-cost-gate ledger pattern.
#
# Runs on: PreToolUse for Edit | Write | MultiEdit.
# Exit codes: 0 (allow) or 2 (block). No set -e. No jq required. Fails open on any
# infra error so it never breaks a tool call outside the lock.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Extract file_path through json-field.sh (jq when present, sed fallback otherwise).
FILE=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" file_path 2>/dev/null)
[[ -z "$FILE" ]] && exit 0
FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')

# Which locked artifact, if any, is this edit targeting?
ARTIFACT=""
case "$FILE_NORM" in
  *architecture/database-schema.md) ARTIFACT="schema"; MARKER="SCHEMA LOCKED"; ENVV="ADF_SCHEMA_UNLOCK" ;;
  *architecture/authz-matrix.yaml)  ARTIFACT="authz";  MARKER="AUTHZ MATRIX LOCKED"; ENVV="ADF_AUTHZ_UNLOCK" ;;
  *) exit 0 ;;
esac

# Resolve project root by walking up to the folder containing AI_DOCS/ (cwd-safe).
ROOT="."
if [[ "$FILE_NORM" == */* ]]; then
  DIR="${FILE_NORM%/*}"; HOPS=0
  while [[ -n "$DIR" && "$DIR" != "." && "$DIR" != "/" && $HOPS -lt 25 ]]; do
    if [[ -d "$DIR/$AI_DOCS_DIR" ]]; then ROOT="$DIR"; break; fi
    PARENT="${DIR%/*}"; [[ "$PARENT" == "$DIR" ]] && break; DIR="$PARENT"; HOPS=$((HOPS + 1))
  done
fi

GATE_STATUS="$ROOT/$AI_DOCS_DIR/memory/gate-status.md"
DECISION_LOG="$ROOT/$AI_DOCS_DIR/memory/decision-log.md"

# Only enforce once the artifact is actually locked: the marker must be RECORDED
# on a line or in a table cell, not merely mentioned (hooks/gate-status-read.sh).
# A whole-file grep armed the lock on a sentence such as "will be marked SCHEMA
# LOCKED at Gate 1". A line that says LIFTED or UNLOCKED does not arm it either.
bash "$(dirname "$0")/gate-status-read.sh" marker "$GATE_STATUS" "$MARKER" >/dev/null 2>&1 || exit 0

# Verified escape: env toggle AND a recorded override in decision-log.md.
TOGGLE="${!ENVV:-off}"
if [[ "$TOGGLE" == "on" ]]; then
  if grep -qi "$ENVV" "$DECISION_LOG" 2>/dev/null; then
    exit 0
  fi
  cat <<EOF >&2

========================================
  ADF ARTIFACT-LOCK: override not recorded
========================================
$ENVV=on is set but decision-log.md has no matching entry.
Record the override first (append a "## Bypass — $ENVV" line with the reason to
AI_DOCS/memory/decision-log.md), then retry.
From hooks/enforce-artifact-lock.sh.
========================================
EOF
  exit 2
fi

cat <<EOF >&2

========================================
  ADF ARTIFACT-LOCK BLOCK ($ARTIFACT)
========================================
Target: $FILE
This artifact is LOCKED (gate-status.md: $MARKER). Code is validated against it, so
it must not drift by hand.

To change it, route through /change-request (it updates the spec + the artifact +
re-locks). If a deliberate override is truly needed:
  1. Append a "## Bypass — $ENVV" reason line to decision-log.md, then
  2. export $ENVV=on   (then retry)

From hooks/enforce-artifact-lock.sh.
========================================
EOF
exit 2
