#!/usr/bin/env bash
# hooks/milestone-order-check.sh: Enforce data-dependency milestone ordering.
#
# A feature that CONSUMES an entity (dashboard, report, FK child) must be planned
# in a LATER milestone than the feature that PRODUCES that entity. This is the
# "dashboard built before its data" guard from milestone-planning Critical Rule 7.
#
# How it reads intent: milestone-planning tags each task's Notes column with
#   produces:<entity>[,<entity>...]   and   consumes:<entity>[,<entity>...]
# Milestone number comes from the capsule directory name (M01-..., M02-...).
# A consumer whose producer is in the same or a later milestone is a violation.
#
# Invocation (both supported):
#   - PostToolUse on Write|Edit|MultiEdit (JSON on stdin, file_path extracted)
#   - standalone: bash milestone-order-check.sh [path/to/AI_DOCS or a tasks.md]
#
# Runs on: PostToolUse for Edit | Write | MultiEdit (backstop), or by milestone-planning.
# Exit codes: 0 (ok / not applicable) or 2 (ordering violation). Nothing else.
# No `set -e` (per ADF hook safety). No jq dependency (sed/awk fallback).

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

# ── Resolve the target/context path ───────────────────────────────────────────
INPUT=$(cat 2>/dev/null || echo "")
FILE=""
if [[ -n "$INPUT" ]]; then
  if command -v jq >/dev/null 2>&1; then
    FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
  else
    FILE=$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  fi
fi
# Standalone arg overrides stdin.
[[ -n "${1:-}" ]] && FILE="$1"

FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')

# When invoked as a PostToolUse backstop, only react to milestone tasks.md edits.
# When run standalone with no path, scan from cwd.
if [[ -n "$INPUT" && -n "$FILE_NORM" ]]; then
  case "$FILE_NORM" in
    *"/milestones/"*"/tasks.md") : ;;   # relevant, continue
    *) exit 0 ;;                          # unrelated edit, not our concern
  esac
fi

# ── Find the milestones directory ─────────────────────────────────────────────
AI_DOCS_BASE="$AI_DOCS_DIR"
if [[ "$FILE_NORM" == */* ]]; then
  DIR="${FILE_NORM%/*}"
  HOPS=0
  while [[ -n "$DIR" && "$DIR" != "." && "$DIR" != "/" && $HOPS -lt 20 ]]; do
    if [[ -d "$DIR/$AI_DOCS_DIR" ]]; then AI_DOCS_BASE="$DIR/$AI_DOCS_DIR"; break; fi
    if [[ -d "$DIR/milestones" && -d "$DIR/memory" ]]; then AI_DOCS_BASE="$DIR"; break; fi
    PARENT="${DIR%/*}"
    [[ "$PARENT" == "$DIR" ]] && break
    DIR="$PARENT"; HOPS=$((HOPS + 1))
  done
fi

MS_DIR="$AI_DOCS_BASE/milestones"
[[ -d "$MS_DIR" ]] || exit 0

# Any milestone task files at all?
shopt -s nullglob
TASK_FILES=("$MS_DIR"/*/tasks.md)
shopt -u nullglob
(( ${#TASK_FILES[@]} > 0 )) || exit 0

# ── Validate ordering in one awk pass ─────────────────────────────────────────
# prod[entity]  = lowest milestone number that produces the entity
# cons_*        = parallel arrays of (entity, milestone, file) for every consume
REPORT=$(awk '
  function mnum(path,   n) {
    n = path
    sub(/.*\/M/, "", n)          # greedy: strip up to the last "/M"
    sub(/[^0-9].*/, "", n)       # keep leading digits only
    if (n == "") return -1
    return n + 0
  }
  BEGIN { c = 0 }
  {
    num = mnum(FILENAME)
    if (num < 0) next

    s = $0
    while (match(s, /produces:[A-Za-z0-9_,-]+/)) {
      tok = substr(s, RSTART, RLENGTH); sub(/^produces:/, "", tok)
      k = split(tok, ents, ",")
      for (i = 1; i <= k; i++) { e = ents[i]; if (e != "") { if (!(e in prod) || num < prod[e]) prod[e] = num } }
      s = substr(s, RSTART + RLENGTH)
    }
    s = $0
    while (match(s, /consumes:[A-Za-z0-9_,-]+/)) {
      tok = substr(s, RSTART, RLENGTH); sub(/^consumes:/, "", tok)
      k = split(tok, ents, ",")
      for (i = 1; i <= k; i++) {
        e = ents[i]
        if (e != "") { cons_ent[c] = e; cons_mile[c] = num; cons_file[c] = FILENAME; c++ }
      }
      s = substr(s, RSTART + RLENGTH)
    }
  }
  END {
    viol = 0
    for (j = 0; j < c; j++) {
      e = cons_ent[j]; cm = cons_mile[j]
      if (e in prod) {
        pm = prod[e]
        if (pm > cm) {
          printf("  - \"%s\" consumed in M%02d but produced later in M%02d [%s]\n", e, cm, pm, cons_file[j])
          viol++
        }
      }
    }
    if (viol > 0) exit 3
  }
' "${TASK_FILES[@]}" 2>/dev/null)
AWK_STATUS=$?

if (( AWK_STATUS == 3 )); then
  cat <<EOF >&2

========================================
  ADF MILESTONE ORDER VIOLATION
========================================
A feature is planned before the data it needs. Producers must precede consumers
(milestone-planning Critical Rule 7). Move the consuming feature to a later
milestone, or move its producer earlier:

$REPORT

Fix the milestone assignment in dependency-graph.md and the affected tasks.md,
then re-seed. Aggregation / dashboard / report milestones are always last.
This block came from hooks/milestone-order-check.sh.
========================================
EOF
  exit 2
fi

exit 0
