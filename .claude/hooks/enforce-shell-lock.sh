#!/usr/bin/env bash
# hooks/enforce-shell-lock.sh: Block edits to the locked app-shell after it is frozen.
#
# Track H (design-to-code fidelity): once the polished app-shell + primitives are
# built, craft-reviewed, and LOCKED (gate-status.md contains "SHELL LOCKED"), the
# chrome must not drift. Feature work COMPOSES from the locked shell, it never
# re-edits it ad hoc. This PreToolUse backstop blocks edits to:
#   - anything under src/components/layout/** (AppShell, TopNav, SideNav, etc.), and
#   - any component whose name is listed in the component-registry's
#     "Locked app-shell (frozen)" section (DataTable, Pagination, Card, state comps).
# Intentional shell changes route through /change-request.
#
# Escape: ADF_SHELL_UNLOCK=on AND a matching line in decision-log.md (the override
# must be recorded, not just toggled). Mirrors the infra-cost-gate ledger pattern.
#
# Runs on: PreToolUse for Edit | Write | MultiEdit.
# Exit codes: 0 (allow) or 2 (block). Nothing else. No `set -e`. No jq required.
# Fails open on any infra error so it never breaks a tool call outside the lock.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Extract file_path: jq first, then ALWAYS fall back to sed when jq yields nothing.
# v3 (2026-07-15, D-022): the fallback is not just a no-jq path. This used to be an
# if/else, so whenever jq was PRESENT but failed to parse (the payload carries
# escaped Windows backslashes), FILE came back empty and the lock silently opened.
# A lock that fails open on a parse hiccup is the same class of defect as the
# api-contract lock that matched the wrong row. Degrade to enforcement, never to a
# hole. Mirrors hooks/enforce-api-contract-lock.sh.
FILE=""
if command -v jq >/dev/null 2>&1; then
  FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
fi
if [[ -z "$FILE" ]]; then
  FILE=$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
fi
[[ -z "$FILE" ]] && exit 0
FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')

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
REGISTRY="$ROOT/$AI_DOCS_DIR/design/component-registry.md"

# Read the App-shell row's OWN status cell (column 3), not a whole-file grep for
# a bare "SHELL LOCKED". v4 (2026-08-24, FF-046): the whole-file grep was the
# D-022 defect that `enforce-api-contract-lock.sh` was already fixed for, and it
# had a second consequence here. gate-status.md documents a lift/restore
# procedure for this row ("edit the Status cell, make the change, restore, one
# commit, decision-log entry, the api-contract CR pattern"), but the code never
# read that cell, so the documented procedure did nothing and the ONLY escape
# was an env var. An env var exported from a shell call does not reach the Edit
# tool's hook environment, and writing it into settings is itself refused, so
# the sanctioned escape was unreachable from inside a session. A control whose
# escape cannot be exercised teaches its users to route around it with Bash,
# which this hook does not match at all. Honouring the row makes the documented
# procedure real and keeps the block intact for everyone who has not performed it.
[[ -f "$GATE_STATUS" ]] || exit 0

SHELL_ROW=$(grep -i '^[[:space:]]*|[[:space:]]*App-shell lock[[:space:]]*|' "$GATE_STATUS" 2>/dev/null | head -1)
# Row absent -> the lock was never recorded; fail open rather than block forever.
[[ -n "$SHELL_ROW" ]] || exit 0

SHELL_STATUS=$(printf '%s' "$SHELL_ROW" | awk -F'|' '{print $4}' | tr '[:upper:]' '[:lower:]')

# LIFTED wins even when the cell also names past locks, so check the lift FIRST.
case "$SHELL_STATUS" in
  *lifted*|*unlocked*) exit 0 ;;
  *locked*) ;;
  *) exit 0 ;;
esac

# Is the target a locked-shell file?
# v2 (2026-07-14, FF-010): also match src/components/app-shell/** (this project's shell dir),
# and compare registry PascalCase names against kebab-case file basenames case-insensitively
# (hyphens/underscores stripped from both sides) — the original exact-match could never hit.
BLOCK=""
case "$FILE_NORM" in
  */src/components/layout/*|src/components/layout/*) BLOCK=1 ;;
  */src/components/app-shell/*|src/components/app-shell/*) BLOCK=1 ;;
esac
if [[ -z "$BLOCK" && -f "$REGISTRY" ]]; then
  BASE="${FILE_NORM##*/}"; NAME="${BASE%.*}"
  NAME_FLAT=$(printf '%s' "$NAME" | tr -d '_-' | tr '[:upper:]' '[:lower:]')
  # Names listed under the "Locked app-shell (frozen)" registry section.
  LOCKED_NAMES=$(sed -n '/Locked app-shell (frozen)/,/^## /p' "$REGISTRY" 2>/dev/null | grep -oE '\b[A-Z][A-Za-z0-9]+\b' 2>/dev/null)
  if [[ -n "$NAME_FLAT" ]]; then
    while IFS= read -r LOCKED_NAME; do
      [[ -z "$LOCKED_NAME" ]] && continue
      LOCKED_FLAT=$(printf '%s' "$LOCKED_NAME" | tr '[:upper:]' '[:lower:]')
      if [[ "$LOCKED_FLAT" == "$NAME_FLAT" ]]; then BLOCK=1; break; fi
    done <<< "$LOCKED_NAMES"
  fi
fi
[[ -z "$BLOCK" ]] && exit 0

# Verified escape: env toggle AND a recorded override in decision-log.md.
if [[ "${ADF_SHELL_UNLOCK:-off}" == "on" ]]; then
  if grep -qi "ADF_SHELL_UNLOCK" "$DECISION_LOG" 2>/dev/null; then
    exit 0
  fi
  cat <<EOF >&2

========================================
  ADF SHELL-LOCK: override not recorded
========================================
ADF_SHELL_UNLOCK=on is set but decision-log.md has no matching entry.
Record the override first (append a "## Bypass — ADF_SHELL_UNLOCK" line with
the reason to AI_DOCS/memory/decision-log.md), then retry.
From hooks/enforce-shell-lock.sh.
========================================
EOF
  exit 2
fi

cat <<EOF >&2

========================================
  ADF SHELL-LOCK BLOCK
========================================
Target: $FILE
The app-shell is LOCKED (gate-status.md: SHELL LOCKED). The polished chrome and
primitives are frozen so feature work composes from them instead of drifting.

To change a locked shell component, route through /change-request (it updates the
design + registry + re-locks). For a deliberate one-off, use the LIFT/RESTORE
procedure, which is the path that works from inside a session:
  1. Append a scoped reason to AI_DOCS/memory/decision-log.md (name the FILE and
     the change; a reason logged for one file does not authorise its neighbours),
  2. edit the "App-shell lock" row in gate-status.md, status cell -> LIFTED (<why>),
  3. make the change, then RESTORE the cell to SHELL LOCKED in the same commit.

The older escape (ADF_SHELL_UNLOCK=on plus a decision-log entry) still works when
the env var can actually be set, but it is unreachable from most session
harnesses. Prefer lift/restore.

From hooks/enforce-shell-lock.sh.
========================================
EOF
exit 2
