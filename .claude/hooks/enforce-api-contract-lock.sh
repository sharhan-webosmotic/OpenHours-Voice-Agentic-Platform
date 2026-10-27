#!/usr/bin/env bash
# hooks/enforce-api-contract-lock.sh: Block edits to api-contract.md while it is LOCKED.
#
# The contract is the single source of truth for every endpoint. It locks at Gate 1
# so frontend and backend cannot silently drift apart; intentional changes route
# through /change-request, which lifts this row, edits, and re-locks in ONE commit.
#
# D-022 (2026-07-15) — why this is a script and not an inline grep:
# the previous inline hook ran `grep -q "LOCKED" gate-status.md`, a substring match
# over the WHOLE file. Arming the App-shell lock on 2026-07-14 added a row whose
# status cell reads "SHELL LOCKED", which CONTAINS that substring. From that commit
# on the hook matched a DIFFERENT lock's row and blocked api-contract edits
# unconditionally, even while the api-contract row itself read LIFTED. The sanctioned
# lift procedure silently stopped working, and the only way through was a Bash
# redirect that bypasses this hook entirely. A control that forces a bypass trains
# the bypass.
#
# The fix: anchor the match to the api-contract row's OWN status cell. Two
# independent locks must never be coupled by a loose substring over a shared file.
#
# Known limitation (documented, not silently accepted): this is a PreToolUse hook on
# Edit|Write|MultiEdit, so a `cat >> api-contract.md` in Bash still slips past. Shell
# guarding is left out deliberately rather than half-done with brittle command
# parsing. The row-state check below is the control; Bash discipline is on the author.
#
# Escape: ADF_CONTRACT_UNLOCK=on AND a matching recorded line in decision-log.md
# (mirrors enforce-shell-lock.sh: the override must be recorded, not just toggled).
#
# Runs on: PreToolUse for Edit | Write | MultiEdit.
# Exit codes: 0 (allow) or 2 (block). Nothing else. No `set -e`. No jq required.
# Fails open on any infra error so it never breaks a tool call outside the lock.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Extract file_path: jq first, then ALWAYS fall back to sed when jq yields nothing.
# The fallback is not just a no-jq path. A lock whose only reader is a strict JSON
# parser opens silently the moment that parser chokes (on Windows the payload is
# full of escaped backslashes), and a silently-opening lock is the D-022 failure
# mode again. The sed path is lenient by design, so a parse hiccup degrades to
# enforcement rather than to a hole.
# hooks/json-field.sh implements exactly that order (jq, then the sed fallback
# whenever jq yields nothing), so the extraction lives there once.
FILE=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" file_path 2>/dev/null)
[[ -z "$FILE" ]] && exit 0
FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')

# Only this one file is guarded.
case "$FILE_NORM" in
  */api-contract.md|api-contract.md) ;;
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

# No gate file (not an ADF project, or pre-Gate-1) -> nothing to enforce.
[[ -f "$GATE_STATUS" ]] || exit 0

# Read the lock from the contract's OWN record, never from a bare "LOCKED"
# anywhere in the file (D-022). hooks/gate-status-read.sh, mode contract-locked,
# accepts the shapes the framework really writes:
#   | api-contract.md lock | <owner> | LOCKED |     the dedicated row (as before)
#   | api-contract.md | LOCKED | <date> |           status in the next cell
#   | Gate 1 | LOCKED | <date> | |                  "Gate 1 records LOCKED" (/plan table)
#   | Gate 1 | PASSED | <date> | api-contract.md LOCKED |
#   - api-contract.md: LOCKED (<date>)              and  Gate 1: LOCKED
# v2: the old read took column 3 of a row named exactly "api-contract.md lock".
# No skill or template writes that row, so on a project that recorded the lock
# the documented way (CLAUDE.md Section 7) the contract stayed freely editable.
# LIFTED, UNLOCKED, and "not locked" still win, and a Gate 1 row that is PENDING
# or FAILED never arms the lock. Nothing recorded -> fail open, as before.
LOCK_STATE=$(bash "$(dirname "$0")/gate-status-read.sh" contract-locked "$GATE_STATUS" 2>/dev/null)
[[ "$LOCK_STATE" == "armed" ]] || exit 0

# Verified escape: env toggle AND a recorded override in decision-log.md.
if [[ "${ADF_CONTRACT_UNLOCK:-off}" == "on" ]]; then
  if grep -qi "ADF_CONTRACT_UNLOCK" "$DECISION_LOG" 2>/dev/null; then
    exit 0
  fi
  cat <<EOF >&2

========================================
  ADF API-CONTRACT LOCK: override not recorded
========================================
ADF_CONTRACT_UNLOCK=on is set but decision-log.md has no matching entry.
Record the override first (append a "## Bypass — ADF_CONTRACT_UNLOCK" line with
the reason to AI_DOCS/memory/decision-log.md), then retry.
From hooks/enforce-api-contract-lock.sh.
========================================
EOF
  exit 2
fi

cat <<EOF >&2

========================================
  ADF API-CONTRACT LOCK BLOCK
========================================
Target: $FILE
api-contract.md is LOCKED (recorded in gate-status.md). The
contract is the bridge both sides build against, so it does not change ad hoc.

To change it, route through /change-request. It lifts the lock, edits the
contract, and restores the lock in ONE commit, with a decision-log entry:
  1. Add this row anywhere in AI_DOCS/memory/gate-status.md (or set an existing
     "api-contract.md lock" row to it), then retry the edit:
       | api-contract.md lock | CR-<NNN> | LIFTED |
  2. Edit api-contract.md.
  3. Restore the same row to:
       | api-contract.md lock | CR-<NNN> | LOCKED |
  4. Record the change request id and reason in decision-log.md.
A dedicated LIFTED row wins over every other LOCKED record in the file. Never
write the contract through a Bash redirect to get past the lock.

From hooks/enforce-api-contract-lock.sh.
========================================
EOF
exit 2
