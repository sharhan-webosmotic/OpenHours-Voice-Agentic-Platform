#!/usr/bin/env bash
# hooks/vertical-slice-check.sh: Backstop for vertical-slice completeness.
#
# /build gates the per-layer checks on a task's CHANGED files (RBAC api/ui,
# integration, seed) at implement time. This hook is the cross-cutting backstop
# that runs when a task row is closed: a feature marked DONE that PRODUCES an
# entity must have seed data for that entity somewhere in the repo, so dashboards
# and E2E have data to run against (vertical-slice-rules.md layer 4).
#
# Intent comes from the tasks.md Notes tag `produces:<entity>`. A row may opt out
# of the seed requirement with `seed:na` (read/aggregation features that consume
# existing data).
#
# Also backstops vertical-slice-rules.md Rule 7 (multi-surface input symmetry):
# a DONE row whose Notes tag `surfaces:` lists more than one surface must carry
# `symmetry:verified` or `symmetry:na` — proof the accepted-input matrix was
# checked to match across FE/API/worker (or explicitly does not apply).
#
# Invocation:
#   - PostToolUse on Write|Edit|MultiEdit to a milestones/*/tasks.md (JSON stdin)
#   - standalone: bash vertical-slice-check.sh [path]
#
# Exit codes: 0 (ok / not applicable) or 2 (a produced entity has no seed). No more.
# No `set -e`. No jq dependency.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

INPUT=$(cat 2>/dev/null || echo "")
FILE=""
if [[ -n "$INPUT" ]]; then
  if command -v jq >/dev/null 2>&1; then
    FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
  else
    FILE=$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  fi
fi
[[ -n "${1:-}" ]] && FILE="$1"
FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')

# As a PostToolUse backstop, only react to milestone tasks.md edits.
if [[ -n "$INPUT" && -n "$FILE_NORM" ]]; then
  case "$FILE_NORM" in
    *"/milestones/"*"/tasks.md") : ;;
    *) exit 0 ;;
  esac
fi

# Resolve AI_DOCS base (walk up from the file) and the repo root (its parent).
AI_DOCS_BASE="$AI_DOCS_DIR"
if [[ "$FILE_NORM" == */* ]]; then
  DIR="${FILE_NORM%/*}"; HOPS=0
  while [[ -n "$DIR" && "$DIR" != "." && "$DIR" != "/" && $HOPS -lt 20 ]]; do
    if [[ -d "$DIR/$AI_DOCS_DIR" ]]; then AI_DOCS_BASE="$DIR/$AI_DOCS_DIR"; break; fi
    if [[ -d "$DIR/milestones" && -d "$DIR/memory" ]]; then AI_DOCS_BASE="$DIR"; break; fi
    PARENT="${DIR%/*}"; [[ "$PARENT" == "$DIR" ]] && break; DIR="$PARENT"; HOPS=$((HOPS + 1))
  done
fi
MS_DIR="$AI_DOCS_BASE/milestones"
[[ -d "$MS_DIR" ]] || exit 0
REPO_ROOT="${AI_DOCS_BASE%/*}"
[[ -n "$REPO_ROOT" && -d "$REPO_ROOT" ]] || REPO_ROOT="."

FIXTURES="$AI_DOCS_BASE/quality/test-fixtures.md"

# Collect entities that are PRODUCED on a row that is DONE and not opted-out.
# A qualifying row contains a DONE cell, a produces:<entity> tag, and no seed:na.
ENTITIES=""
shopt -s nullglob
for TASKS in "$MS_DIR"/*/tasks.md; do
  [[ -f "$TASKS" ]] || continue
  while IFS= read -r line; do
    case "$line" in *seed:na*) continue ;; esac
    # Must be a DONE row carrying a produces: tag.
    printf '%s' "$line" | grep -iqE '\|[[:space:]`*_]*DONE[[:space:]`*_]*\|' || continue
    printf '%s' "$line" | grep -iq 'produces:' || continue
    # Pull every produces:<list> token on the line.
    for tok in $(printf '%s' "$line" | grep -oiE 'produces:[A-Za-z0-9_,-]+'); do
      tok="${tok#produces:}"; tok="${tok#produces:}"
      IFS=',' read -ra ents <<< "$tok"
      for e in "${ents[@]}"; do [[ -n "$e" ]] && ENTITIES="$ENTITIES $e"; done
    done
  done < "$TASKS"
done
shopt -u nullglob

# has_entity ENTITY FILE: true when FILE names ENTITY at the start of a word.
# A plain substring match let "border" satisfy the entity "order". The name
# must follow a non-letter ("orders", "seed_orders", "prisma.order" all count)
# or open a camelCase hump ("createOrder").
has_entity() {
  local cap
  grep -iqE "(^|[^[:alpha:]])$1" "$2" 2>/dev/null && return 0
  cap="$(printf '%s' "${1:0:1}" | tr '[:lower:]' '[:upper:]')${1:1}"
  grep -qE "[[:lower:][:digit:]]$cap" "$2" 2>/dev/null
}

# Seed check runs only when DONE rows produced entities. The Rule 7 symmetry
# check below runs regardless (a multi-surface row need not produce an entity).
MISSING=""
if [[ -n "${ENTITIES// /}" ]]; then
  # De-duplicate.
  ENTITIES=$(printf '%s\n' $ENTITIES | sort -u)

  # Pre-list candidate seed files once (pruned, name-based).
  SEED_FILES=$(find "$REPO_ROOT" \
    \( -name node_modules -o -name .git -o -name dist -o -name build -o -name .next -o -name .venv -o -name __pycache__ \) -prune \
    -o -type f \( -iname 'seed*' -o -iname '*seed*.ts' -o -iname '*seed*.js' -o -iname '*seed*.py' -o -iname '*seed*.sql' \) -print 2>/dev/null)

  for e in $ENTITIES; do
    found=0
    if [[ -f "$FIXTURES" ]] && has_entity "$e" "$FIXTURES"; then found=1; fi
    if (( found == 0 )) && [[ -n "$SEED_FILES" ]]; then
      while IFS= read -r sf; do
        [[ -f "$sf" ]] || continue
        if has_entity "$e" "$sf"; then found=1; break; fi
      done <<< "$SEED_FILES"
    fi
    (( found == 0 )) && MISSING="$MISSING\n  - $e (produced by a DONE feature, no seed rows + no test-fixtures entry)"
  done
fi

FAIL=0
if [[ -n "$MISSING" ]]; then
  {
    printf '\n========================================\n'
    printf '  ADF VERTICAL-SLICE GAP (seed layer)\n'
    printf '========================================\n'
    printf 'A feature is DONE but the entity it produces has no seed data.\n'
    printf 'Dashboards and E2E need rows to run against (vertical-slice-rules.md layer 4):\n'
    printf "$MISSING\n"
    printf '\nAdd seed rows (and a test user that can exercise the entity), surface them\n'
    printf 'into AI_DOCS/quality/test-fixtures.md, or mark the row seed:na if it only\n'
    printf 'consumes existing data. From hooks/vertical-slice-check.sh.\n'
    printf '========================================\n'
  } >&2
  FAIL=1
fi

# Rule 7 backstop: multi-surface DONE rows need a symmetry stamp.
SYM_MISSING=""
shopt -s nullglob
for TASKS in "$MS_DIR"/*/tasks.md; do
  [[ -f "$TASKS" ]] || continue
  while IFS= read -r line; do
    printf '%s' "$line" | grep -iqE '\|[[:space:]`*_]*DONE[[:space:]`*_]*\|' || continue
    printf '%s' "$line" | grep -iqE 'surfaces:[a-z0-9_-]+,' || continue
    printf '%s' "$line" | grep -iqE 'symmetry:(verified|na)' && continue
    TITLE=$(printf '%s' "$line" | awk -F'|' '{print $3}' | sed 's/^ *//; s/ *$//')
    SYM_MISSING="$SYM_MISSING\n  - ${TITLE:-<row>} (surfaces: spans >1 surface, no symmetry:verified / symmetry:na tag)"
  done < "$TASKS"
done
shopt -u nullglob

if [[ -n "$SYM_MISSING" ]]; then
  {
    printf '\n========================================\n'
    printf '  ADF VERTICAL-SLICE GAP (Rule 7 symmetry)\n'
    printf '========================================\n'
    printf 'A DONE feature spans multiple surfaces but its accepted-input symmetry was\n'
    printf 'never stamped (vertical-slice-rules.md Rule 7). The FE must not advertise an\n'
    printf 'input the API or worker never handles:\n'
    printf "$SYM_MISSING\n"
    printf '\nVerify the accepted-input matrix matches across the listed surfaces (formats,\n'
    printf 'size limits, content types — prefer one shared constant), then tag the row\n'
    printf 'symmetry:verified, or symmetry:na (reason) when inputs genuinely do not cross\n'
    printf 'surfaces. From hooks/vertical-slice-check.sh.\n'
    printf '========================================\n'
  } >&2
  FAIL=1
fi

if [[ $FAIL -eq 1 ]]; then
  exit 2
fi

exit 0
