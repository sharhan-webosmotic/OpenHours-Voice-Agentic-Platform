#!/usr/bin/env bash
# hooks/uncommitted-work-check.sh: warn at session end about work with no restore point.
#
# FF-035. The previous control was an inline one-liner in settings.json scoped to
# `git diff AI_DOCS/`, so it watched the DOCUMENTATION directory and nothing else.
# A whole milestone of finished application code (over a hundred modified files,
# new migrations, new components) sat uncommitted in the working tree of the
# PRODUCTION branch with no milestone branch cut and no commit anywhere, and this
# control said nothing, because none of it was under AI_DOCS.
#
# That matters more than "you forgot to commit". The same project's notes record
# builders reporting work complete that the git tree showed was never written.
# Ground truth lives in the tree. An uncommitted tree has no history to check a
# self-report against, so the one reliable detector is unavailable exactly when
# the most work is at risk.
#
# Two checks, both advisory, both exit 0 always:
#   1. Working-tree size, escalating. A few files is a note. A large surface with
#      no commit this session is a loud warning that names the risk.
#   2. Branch versus the active milestone's declared branch, but ONLY when the
#      project actually declares a per-milestone branching strategy. Trunk-based
#      and Kanban projects have no per-milestone branch concept and must not be
#      nagged about one.
#
# Never blocks. A warning at Stop cannot block anything anyway; the value is that
# it is SEEN, and that it scales its volume to the amount at risk.

set -uo pipefail

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
LOUD_THRESHOLD="${ADF_UNCOMMITTED_LOUD:-50}"

TRACKED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
TOTAL=$(( TRACKED + STAGED + UNTRACKED ))

if (( TOTAL > 0 )); then
  # Migrations and schema files are disproportionately expensive to lose and to
  # reconstruct, so their presence escalates the message regardless of count.
  RISKY=$(git status --porcelain 2>/dev/null \
    | grep -cE '(migrations?/|schema\.prisma|\.sql$|alembic/)' || true)

  if (( TOTAL >= LOUD_THRESHOLD || RISKY > 0 )); then
    echo "" >&2
    echo "WARNING: $TOTAL uncommitted files in the working tree, with no restore point." >&2
    if (( RISKY == 1 )); then
      echo "  One of them is a migration or schema file. Those are the expensive ones to lose." >&2
    elif (( RISKY > 1 )); then
      echo "  $RISKY of them are migration or schema files. Those are the expensive ones to lose." >&2
    fi
    echo "  Branch: $(git branch --show-current 2>/dev/null || echo 'detached')" >&2
    echo "  Nothing here is recoverable if the tree is lost, and there is no history" >&2
    echo "  to check any completion claim against. Commit to the milestone branch." >&2
  else
    echo "Note: $TOTAL uncommitted file(s). Commit before ending if the work is done." >&2
  fi
fi

# ── Branch versus the active milestone's declared branch ───────────────────────
#
# Gated on the project DECLARING a per-milestone strategy. Silent otherwise.
STRATEGY_FILE="$AI_DOCS_DIR/deployment/git-strategy.md"
[[ -f "$STRATEGY_FILE" ]] || exit 0
grep -qiE 'branch per milestone|one branch per milestone|milestone-[0-9N]' "$STRATEGY_FILE" 2>/dev/null || exit 0

BRANCH=$(git branch --show-current 2>/dev/null)
[[ -n "$BRANCH" ]] || exit 0

LEDGER="$AI_DOCS_DIR/memory/task-ledger.md"
[[ -f "$LEDGER" ]] || exit 0

# The active milestone is the row whose Status cell says DOING.
ACTIVE=$(grep -iE '^\|[^|]*\|[^|]*DOING' "$LEDGER" 2>/dev/null \
  | head -1 | awk -F'|' '{gsub(/^ +| +$/,"",$2); gsub(/\*/,"",$2); print $2}')
[[ -n "$ACTIVE" ]] || exit 0

# A slug match is enough: branches are conventionally named for their milestone,
# and an exact-name requirement would false-fire on every reasonable variation.
SLUG=$(printf '%s' "$ACTIVE" | tr '[:upper:]' '[:lower:]')
CURRENT=$(printf '%s' "$BRANCH" | tr '[:upper:]' '[:lower:]')
if [[ "$CURRENT" != *"${SLUG%%-*}"* ]]; then
  echo "" >&2
  echo "NOTE: branch '$BRANCH' does not look like the active milestone '$ACTIVE'." >&2
  echo "  This project declares a per-milestone branching strategy. Either cut the" >&2
  echo "  milestone branch, or record why this milestone shares another branch." >&2
fi

exit 0
