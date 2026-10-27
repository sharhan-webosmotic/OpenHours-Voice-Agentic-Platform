#!/usr/bin/env bash
# hooks/enforce-single-aidocs.sh — Force exactly ONE AI_DOCS, at the project root.
#
# The framework keeps all of its memory under a single AI_DOCS/ directory that
# lives at the project root. Skills, agents, and ad-hoc edits must never create a
# second AI_DOCS/ somewhere inside the application code (e.g. src/AI_DOCS/,
# packages/app/AI_DOCS/). A stray nested AI_DOCS silently splits project state:
# half the skills read the root one, half read the nested one, and memory drifts.
#
# This hook blocks any tool call that would place a file inside an AI_DOCS/ folder
# whose parent is NOT the project root.
#
# Project root resolution (for the AI_DOCS being written):
#   Walk UP from the directory that would contain the new AI_DOCS, to the nearest
#   ancestor that already contains .git/ or an existing AI_DOCS/. That ancestor is
#   the canonical root. Fall back to the session cwd when the walk finds nothing
#   (a brand-new project: the first AI_DOCS at cwd is therefore allowed).
#
#   - Write/Edit/MultiEdit: inspect tool_input.file_path.
#   - Bash: inspect tool_input.command for a nested `mkdir .../AI_DOCS`.
#
# Runs on: PreToolUse for Edit | Write | MultiEdit | Bash.
# Exit codes: 0 (allow) or 2 (block). Nothing else. No `set -e` (ADF hook rule).

set -uo pipefail

# Escape hatch: a project that genuinely needs a nested AI_DOCS can opt out.
if [[ "${ADF_ALLOW_NESTED_AIDOCS:-off}" == "on" ]]; then
  exit 0
fi

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Extract tool name, file_path, and command through json-field.sh (jq when
# present, a decoding sed fallback otherwise). The private sed copy that used to
# live here stopped at the first escaped quote, so  mkdir -p "src/AI_DOCS"  was
# read as  mkdir -p \  and the nested-AI_DOCS check never saw the path.
JSON_FIELD="$(dirname "$0")/json-field.sh"
TOOL=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" tool_name 2>/dev/null)
FILE=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" file_path 2>/dev/null)
CMD=$(printf '%s' "$INPUT" | bash "$JSON_FIELD" command 2>/dev/null)

CWD_NORM=$(pwd 2>/dev/null | tr '\\' '/' | tr -s '/')

# ── Helper: given a candidate AI_DOCS parent dir, decide allow(0)/block(1) ──────
# A nested AI_DOCS is one whose parent is not the resolved project root.
aidocs_parent_is_root() {
  local aid_parent="$1"
  [[ -z "$aid_parent" ]] && aid_parent="$CWD_NORM"

  # A builder worktree (<project>/.claude/worktrees/<name>/) is a checkout of
  # its own: the AI_DOCS/ at the worktree root is that checkout's root AI_DOCS,
  # not a nested one.
  case "${aid_parent%/}" in
    */.claude/worktrees/*/*|.claude/worktrees/*/*) : ;;
    */.claude/worktrees/*|.claude/worktrees/*) return 0 ;;
  esac

  local root="" dir="$aid_parent" hops=0
  while [[ -n "$dir" && "$dir" != "/" && $hops -lt 30 ]]; do
    if [[ -d "$dir/.git" || -d "$dir/AI_DOCS" ]]; then
      root="$dir"
      break
    fi
    local parent="${dir%/*}"
    [[ "$parent" == "$dir" ]] && break
    dir="$parent"
    hops=$((hops + 1))
  done
  [[ -z "$root" ]] && root="$CWD_NORM"

  # Normalize trailing slashes before comparing.
  aid_parent="${aid_parent%/}"
  root="${root%/}"
  [[ "$aid_parent" == "$root" ]]
}

# ── Compute the AI_DOCS parent dir from an absolute, normalized path ────────────
# Strips from the first /AI_DOCS segment (case-insensitive) to the end, leaving
# the directory that would contain that AI_DOCS.
aidocs_parent_of() {
  printf '%s' "$1" | sed -E 's#/[Aa][Ii]_[Dd][Oo][Cc][Ss](/.*)?$##'
}

make_absolute() {
  local p
  p=$(printf '%s' "$1" | tr '\\' '/' | tr -s '/')
  if [[ "$p" = /* || "$p" =~ ^[A-Za-z]:/ ]]; then
    printf '%s' "$p"
  else
    printf '%s' "$CWD_NORM/$p" | tr -s '/'
  fi
}

block() {
  local target="$1"
  cat <<EOF >&2

========================================
  ADF SINGLE-AI_DOCS BLOCK
========================================
Target:  $target

This would create or write into an AI_DOCS/ folder that is NOT at the project
root. The framework allows exactly ONE AI_DOCS/, and it must live at the project
root so every skill reads and writes the same project memory.

Do one of:

  1. Write to the root AI_DOCS instead (e.g. AI_DOCS/memory/..., AI_DOCS/milestones/...).
  2. If this file is application code, it does not belong under any AI_DOCS/ —
     drop the AI_DOCS segment from the path.
  3. If a nested AI_DOCS is genuinely required (rare), the user can opt out for
     this session: export ADF_ALLOW_NESTED_AIDOCS=on

This block came from hooks/enforce-single-aidocs.sh.
========================================
EOF
  exit 2
}

case "$TOOL" in
  Edit|Write|MultiEdit|"")
    [[ -z "$FILE" ]] && exit 0
    FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')
    # Only inspect paths that contain an AI_DOCS segment.
    case "/$FILE_NORM/" in
      */[Aa][Ii]_[Dd][Oo][Cc][Ss]/*) : ;;
      *) exit 0 ;;
    esac
    ABS=$(make_absolute "$FILE_NORM")
    AID_PARENT=$(aidocs_parent_of "$ABS")
    if aidocs_parent_is_root "$AID_PARENT"; then
      exit 0
    fi
    block "$FILE"
    ;;

  Bash)
    [[ -z "$CMD" ]] && exit 0
    CMD_NORM=$(printf '%s' "$CMD" | tr '\\' '/' | tr -s '/')
    # Only inspect commands that mention a NESTED AI_DOCS (a slash before AI_DOCS).
    # A root-relative `mkdir AI_DOCS` or `mkdir AI_DOCS/memory` has no preceding
    # path segment and is allowed. Catch `mkdir`, `md`, and `New-Item` forms.
    case "$CMD_NORM" in
      *mkdir*|*New-Item*|*"md "*) : ;;
      *) exit 0 ;;
    esac
    # Pull each token that ends in /AI_DOCS or /AI_DOCS/<sub> and check its parent.
    # A quoted path is ONE token even when it contains a space. Splitting
    # "<dir with space>/proj/AI_DOCS" at the space would read the tail as a
    # nested relative path and block a legitimate root AI_DOCS.
    AID='[Aa][Ii]_[Dd][Oo][Cc][Ss]'
    NESTED=$(printf '%s' "$CMD_NORM" \
      | grep -oE "\"[^\"]*/${AID}(/[^\"]*)?\"|'[^']*/${AID}(/[^']*)?'|[^[:space:]\"']+/${AID}(/[^[:space:]\"']*)?" \
      | head -1 | sed -e "s/^[\"']//" -e "s/[\"']\$//")
    [[ -z "$NESTED" ]] && exit 0
    # `./AI_DOCS` and a bare absolute-root match are handled by the root walk.
    ABS=$(make_absolute "$NESTED")
    AID_PARENT=$(aidocs_parent_of "$ABS")
    if aidocs_parent_is_root "$AID_PARENT"; then
      exit 0
    fi
    block "$NESTED"
    ;;

  *)
    exit 0
    ;;
esac

exit 0
