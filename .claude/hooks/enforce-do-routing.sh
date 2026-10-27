#!/usr/bin/env bash
# hooks/enforce-do-routing.sh: Block app-code Edit/Write when no /do flow is active (v5).
#
# Implements the ADF v4 hard-enforcement rule from CLAUDE.md Section 1:
#   For any coding/fixing/building/designing/shipping request, /do must be
#   invoked first. /do creates an active task in the active milestone's
#   tasks.md (or in task-ledger.md). If no such task exists when an Edit/Write
#   targets app code, this hook blocks the edit and tells Claude what to do.
#
# Rules:
#   - ADF_BYPASS=on            → allow (user explicitly opted out for this session)
#   - decision-log.md has a "## Bypass" heading dated today (local date) with no
#     later "## Resume framework" heading → allow (the recorded Section 1 opt-out)
#   - File is memory/docs       → allow (AI_DOCS/, .claude/, *.md at root, README, CHANGELOG)
#   - task-ledger.md has a table row with a DOING cell            → allow
#   - any milestones/*/tasks.md has a table row with a DOING cell → allow
#   - legacy @active-begin sentinel block with a Task ID          → allow
#   - Otherwise → BLOCK with exit 2 and remediation
#
# v5 hardening (fixes "ledger updated but still blocked"):
#   - DOING detection is column-agnostic: any cell in a table row that is
#     DOING (tolerating spaces, **bold**, _italics_, `code`, case) counts.
#     v4 required DOING in exactly column 3 with the milestone in column 1,
#     which rejected legitimate ledgers with a different column order.
#   - Project root is resolved by walking UP from the edited file's directory
#     to the nearest folder containing AI_DOCS/. v4 only looked at the hook's
#     cwd, which fails when the session is opened above the repo root
#     (e.g. session at D:\Projects\app, repo at D:\Projects\app\app).
#
# v6 addition:
#   - Belt-and-suspenders Gate 1 (Planning Completeness) check. Even with a DOING
#     task present, a non-POC project is blocked from app-code edits when
#     gate-status.md explicitly shows Gate 1 PENDING/FAILED. Conservative: a
#     passed/approved/locked Gate 1, a missing gate-status.md, a missing Gate 1
#     line, or planning_depth: poc all allow the edit. This closes the seam where
#     a hand-created DOING task bypasses planning without false-blocking projects
#     whose Gate 1 already passed.
#
# v8 additions:
#   - The recorded opt-out is honored on its own (see "Recorded opt-out" below).
#   - Paths under .claude/worktrees/<name>/ are classified by their location
#     inside the worktree, so a builder's app-code edits are routed like any other.
#   - Doc files are allowlisted by basename, and a root-level *.md is recognised
#     relative to the directory that holds AI_DOCS/.
#   - Gate 1 is read from its own record (hooks/gate-status-read.sh).
#
# v9 additions:
#   - A worktree edit is allowed when EITHER the main checkout's state OR the
#     worktree's own AI_DOCS state satisfies the check. A builder agent's DOING
#     row lives in the main checkout, while a session that itself runs inside a
#     worktree (claude --worktree) writes its DOING row into the worktree.
#   - The opt-out record must be a real "## Bypass" heading dated today by the
#     LOCAL clock, outside fenced code blocks. A heading that says DENIED,
#     declined, ended, revoked, or rejected does not open the gate.
#
# Runs on: PreToolUse for Edit | Write | MultiEdit.
# Exit codes: 0 (allow) or 2 (block). Nothing else.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

# True when decision-log.md records an opt-out that is open today: a heading
# that starts "## Bypass" followed by a separator, the date, or a control name,
# that carries today's LOCAL date (people and Claude write local dates), sits
# outside a fenced code block, and is not closed by a later "## Resume
# framework" heading. $2 lists the control names that count (a heading that
# names another control, ADF_SHELL_UNLOCK for example, is that control's
# record). A heading with no control name always counts.
bypass_recorded() {
  local log="$1" ctls="${2:-}" d
  [[ -f "$log" ]] || return 1
  d=$(date +%Y-%m-%d 2>/dev/null)
  [[ -n "$d" ]] || return 1
  LC_ALL=C awk -v d="$d" -v ctls=" $ctls " '
    { sub(/\r$/, "") }
    /^[ \t]*(```|~~~)/ { fence = !fence; next }
    fence { next }
    /^##[ \t]+[Rr]esume[ \t]+framework/ { open = 0; next }
    /^##[ \t]+[Bb]ypass/ {
      low = tolower($0)
      if (low ~ /(denied|declined|ended|revoked|rejected)/) { open = 0; next }
      t = $0; sub(/^##[ \t]+[Bb]ypass/, "", t)
      if (t != "" && t !~ /^[ \t]*([-:(]|[^ -~]|[0-9]|ADF_)/ && t !~ /^[ \t]*$/) next
      ctl = ""
      if (match($0, /ADF_[A-Z_]+/)) ctl = substr($0, RSTART, RLENGTH)
      if (ctl != "" && index(ctls, " " ctl " ") == 0) next
      if (index($0, d) == 0) next
      open = 1
      next
    }
    END { exit (open ? 0 : 1) }
  ' "$log" 2>/dev/null
}

# Bypass: user opted out of framework this session.
if [[ "${ADF_BYPASS:-off}" == "on" ]]; then
  exit 0
fi

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Extract target file path through json-field.sh (jq when present, a sed
# fallback otherwise, jq is often absent on Windows).
FILE=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" file_path 2>/dev/null)

# No file path → can't decide; allow (other hooks may catch).
[[ -z "$FILE" ]] && exit 0

# Normalize Windows backslashes for matching, then squeeze repeated slashes.
# The sed fallback above does NOT JSON-decode, so "D:\\Projects\\x" arrives
# with doubled backslashes and would otherwise become "D://Projects//x".
FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')

# Builder agents edit inside an isolated git worktree that Claude Code creates at
# <project>/.claude/worktrees/<name>/. Such a path contains "/.claude/", so the
# framework allowlist below used to exempt every app-code edit a builder made.
# Classify a worktree path by its location INSIDE the worktree. Task and gate
# state are read from the MAIN checkout first (a builder's DOING row lives there,
# the worktree's AI_DOCS is a snapshot taken when the branch was cut) and then
# from the worktree's own AI_DOCS (a session that runs inside the worktree keeps
# its state there). Either one satisfying the check allows the edit.
EVAL_PATH="$FILE_NORM"
MAIN_ROOT=""
WT_ROOT=""
case "$FILE_NORM" in
  *"/.claude/worktrees/"*/*)
    MAIN_ROOT="${FILE_NORM%%/.claude/worktrees/*}"
    EVAL_PATH="${FILE_NORM#*/.claude/worktrees/}"
    WT_ROOT="$MAIN_ROOT/.claude/worktrees/${EVAL_PATH%%/*}"
    EVAL_PATH="${EVAL_PATH#*/}"
    ;;
  ".claude/worktrees/"*/*)
    MAIN_ROOT="."
    EVAL_PATH="${FILE_NORM#.claude/worktrees/}"
    WT_ROOT=".claude/worktrees/${EVAL_PATH%%/*}"
    EVAL_PATH="${EVAL_PATH#*/}"
    ;;
esac

# Memory/doc allowlist. Allow:
#   - AI_DOCS/ (the memory)
#   - .claude/ (skills, hooks, rules, settings)
#   - common doc and repo-meta files, matched on the BASENAME only
#     (README*, CHANGELOG*, LICENSE*, CONTRIBUTING*, .gitignore, .editorconfig)
#   - any .md file directly under the project root (CLAUDE.md, NOTES.md, etc.)
case "$EVAL_PATH" in
  *"/AI_DOCS/"*|"AI_DOCS/"*) exit 0 ;;
  *"/.claude/"*|".claude/"*) exit 0 ;;
esac
# The doc names used to be matched anywhere in the path (*README*), so
# src/READMEParser.ts passed as a doc, and so did every file of a project whose
# folder name contained LICENSE or CHANGELOG.
case "${EVAL_PATH##*/}" in
  README|README.*|CHANGELOG|CHANGELOG.*|LICENSE|LICENSE.*|LICENSE-*|CONTRIBUTING|CONTRIBUTING.*) exit 0 ;;
  .gitignore|.editorconfig|.gitattributes) exit 0 ;;
esac

# ── Resolve the project root ──────────────────────────────────────────────────
# Hooks run at the session cwd, which is not always the repo that owns the
# edited file. Walk up from the edited file's directory looking for AI_DOCS/.
# Fall back to the cwd-relative AI_DOCS_DIR when the walk finds nothing
# (covers relative file paths and the common single-repo session). A worktree
# path resolves to the main checkout's AI_DOCS first (see above).
AI_DOCS_BASE="$AI_DOCS_DIR"
ROOT_DIR=""
if [[ -n "$MAIN_ROOT" && -d "$MAIN_ROOT/$AI_DOCS_DIR" ]]; then
  AI_DOCS_BASE="$MAIN_ROOT/$AI_DOCS_DIR"
elif [[ "$FILE_NORM" == */* ]]; then
  DIR="${FILE_NORM%/*}"
  HOPS=0
  while [[ -n "$DIR" && "$DIR" != "." && "$DIR" != "/" && $HOPS -lt 20 ]]; do
    if [[ -d "$DIR/$AI_DOCS_DIR" ]]; then
      AI_DOCS_BASE="$DIR/$AI_DOCS_DIR"
      ROOT_DIR="$DIR"
      break
    fi
    PARENT="${DIR%/*}"
    [[ "$PARENT" == "$DIR" ]] && break
    DIR="$PARENT"
    HOPS=$((HOPS + 1))
  done
fi

# Root-level *.md is documentation. "Root" is the directory that holds AI_DOCS/
# (the worktree root for a builder, the session cwd when no AI_DOCS exists yet),
# not a count of path segments. Claude Code sends absolute paths, so the old
# segment count never matched and CLAUDE.md itself was blocked.
if [[ "$EVAL_PATH" == *.md ]]; then
  FILE_DIR="${FILE_NORM%/*}"
  if [[ "$EVAL_PATH" != */* ]]; then
    exit 0
  elif [[ -n "$ROOT_DIR" ]]; then
    [[ "$FILE_DIR" == "$ROOT_DIR" ]] && exit 0
  elif [[ -z "$MAIN_ROOT" ]]; then
    [[ "$FILE_DIR" == "$(pwd 2>/dev/null)" || "$FILE_DIR" == "$(pwd -W 2>/dev/null)" ]] && exit 0
  fi
fi

# ── The state check, for one AI_DOCS base ─────────────────────────────────────
# Returns 0 when the state under $1 allows the edit. Otherwise returns 1 and
# leaves the reason in BLOCK_KIND ("routing" or "gate1"), LEDGER, GATE_STATUS.
#
# Recorded opt-out (CLAUDE.md Section 1). v8 (same reasoning as
# enforce-shell-lock.sh v4, FF-046): the documented opt-out was "append a
# ## Bypass entry, then export ADF_BYPASS=on". A variable exported from a Bash
# tool call never reaches the hook process, so the sanctioned escape could not
# be exercised from inside a session. The recorded heading is the audit trail
# the protocol asks for, so it alone opens the gate for the day it is dated,
# until a "## Resume framework" heading follows it. ADF_BYPASS=on in the hook
# environment (settings env, or exported before launch) still works above.
#
# Active task. A "DOING cell" is a markdown table cell whose content is DOING,
# tolerating surrounding spaces and inline emphasis (**DOING**, _DOING_,
# `DOING`), in any column. Case-insensitive. Examples that match:
#   | M13-deploy | Interactive deploy script | DOING | 0/1 | ... |
#   | T-01 | Wire script | acceptance... | **DOING** | | | |
#
# Gate 1 (Planning Completeness) required before app code (non-POC), v7. Close
# the forge vector (T-F.2): a DOING row alone is NOT sufficient to edit app code.
# An agent can append a "| DOING |" row to a tasks.md under AI_DOCS (which is
# allowlisted), so the DOING signal is self-satisfiable. A non-POC project must
# ALSO have Gate 1 affirmatively PASSED in gate-status.md. A missing
# gate-status.md, a missing Gate 1 line, or a pending/failed Gate 1 all BLOCK.
DOING_CELL='\|[[:space:]`*_]*DOING[[:space:]`*_]*\|'
state_allows() {
  local base="$1" active=0 tasks
  LEDGER="$base/memory/task-ledger.md"
  GATE_STATUS="$base/memory/gate-status.md"
  BLOCK_KIND="routing"

  bypass_recorded "$base/memory/decision-log.md" "ADF_BYPASS" && return 0

  # 1. task-ledger.md has any table row with a DOING cell.
  if [[ -f "$LEDGER" ]] && grep -iqE "^[[:space:]]*\|.*${DOING_CELL}" "$LEDGER" 2>/dev/null; then
    active=1
  fi
  # 2. Any milestone capsule's tasks.md has a table row with a DOING cell.
  if (( active == 0 )) && [[ -d "$base/milestones" ]]; then
    for tasks in "$base"/milestones/*/tasks.md; do
      [[ -f "$tasks" ]] || continue
      if grep -iqE "^[[:space:]]*\|.*${DOING_CELL}" "$tasks" 2>/dev/null; then
        active=1
        break
      fi
    done
  fi
  # 3. Last-resort fallback: legacy task-ledger sentinel block (ledger-writer compatibility).
  if (( active == 0 )) && [[ -f "$LEDGER" ]]; then
    if awk '/@active-begin/{flag=1; next} /@active-end/{flag=0} flag' "$LEDGER" 2>/dev/null \
       | grep -qE '^Task ID:[[:space:]]+[^[:space:]]'; then
      active=1
    fi
  fi
  (( active == 1 )) || return 1

  BLOCK_KIND="gate1"
  # POC projects intentionally skip the planning gates.
  if [[ -f "$base/memory/stack.md" ]] \
     && grep -iqE '^[[:space:]]*planning_depth[[:space:]]*:[[:space:]]*poc' "$base/memory/stack.md" 2>/dev/null; then
    return 0
  fi
  # v8: read Gate 1's OWN record and the status position on it
  # (hooks/gate-status-read.sh). The old read accepted any line that mentioned
  # Gate 1 and contained passed, approved, or locked anywhere, so
  # "| Gate 1 | FAILED | api-contract not LOCKED yet |" passed the gate. The
  # reader stays compatible with the old read for every record whose own
  # status is not negative.
  if [[ -f "$GATE_STATUS" ]] \
     && bash "$(dirname "$0")/gate-status-read.sh" passed "$GATE_STATUS" 'gate[ \t-]*1' passed pass approved locked >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

if state_allows "$AI_DOCS_BASE"; then
  exit 0
fi
MAIN_KIND="$BLOCK_KIND"; MAIN_LEDGER="$LEDGER"; MAIN_GATE_STATUS="$GATE_STATUS"
if [[ -n "$WT_ROOT" && -d "$WT_ROOT/$AI_DOCS_DIR" && "$WT_ROOT/$AI_DOCS_DIR" != "$AI_DOCS_BASE" ]]; then
  if state_allows "$WT_ROOT/$AI_DOCS_DIR"; then
    exit 0
  fi
fi
BLOCK_KIND="$MAIN_KIND"; LEDGER="$MAIN_LEDGER"; GATE_STATUS="$MAIN_GATE_STATUS"

if [[ "$BLOCK_KIND" == "gate1" ]]; then
  GATE1_STATE=$( [[ -f "$GATE_STATUS" ]] && echo "Gate 1 not recorded as PASSED in gate-status.md" || echo "gate-status.md not found (planning has not run)" )
  cat <<EOF >&2

========================================
  ADF PLANNING GATE BLOCK (Gate 1)
========================================
File:    $FILE
Status:  $GATE1_STATE

A task is marked DOING, but Gate 1 (Planning Completeness) is not PASSED for this
non-POC project. A DOING row by itself does not authorize app-code edits: it can be
written by hand. The framework requires planning to be complete, and recorded, before
app code is written.

To proceed, either:

  1. Run /do  (recommended). It runs Phase 0 planning and Gate 1, then builds.
  2. If planning is genuinely complete, run /gate-enforcement (or have /do run it)
     so AI_DOCS/memory/gate-status.md records Gate 1 as PASSED / APPROVED / LOCKED.
  3. For a throwaway POC, stamp 'planning_depth: poc' in AI_DOCS/memory/stack.md.
  4. To opt out of the framework this session, the user says "skip the framework".
     Append a "## Bypass" heading that carries today's date (YYYY-MM-DD) and the
     user's phrase to decision-log.md, then retry. The hook reads that entry.

This block came from hooks/enforce-do-routing.sh (v7, Gate 1 required before app code).
========================================
EOF
  exit 2
fi

# ── Block ─────────────────────────────────────────────────────────────────────
cat <<EOF >&2

========================================
  ADF ROUTING BLOCK
========================================
File:    $FILE
Ledger:  $LEDGER $( [[ -f "$LEDGER" ]] && echo "(found, no DOING row)" || echo "(NOT FOUND. Wrong project root?)" )

No active task found. The framework requires routing through /do before
editing application code. /do reads memory, picks/creates a task, and
dispatches /build.

To proceed, either:

  1. Run /do  (recommended, keeps memory consistent)
       Reply: "Routing to /do for <intent>." then invoke /do via the Skill
       tool. /do will set a task to DOING and the edit will pass.

  2. If /do already created the task, make sure the DOING status is a real
     table cell in one of these files (any column. The cell content must be
     DOING, e.g. | M13-deploy | Interactive deploy script | DOING | 0/1 | |):
       - $LEDGER
       - ${LEDGER%/memory/task-ledger.md}/milestones/<M..>/tasks.md
     Statuses like "in progress", "WIP", or DOING outside a | table | row do
     not count.

  3. Opt out of the framework for this session (the user must say so).
       The user must say one of:
         "skip the framework" / "I'll code on my own" / "freestyle"
       Then:
         a) append a "## Bypass" heading that carries today's date (YYYY-MM-DD)
            and the user's phrase to AI_DOCS/memory/decision-log.md
         b) retry the edit. The hook reads that entry.
       The bypass lapses when the date changes or when a "## Resume framework"
       entry follows it. (ADF_BYPASS=on also works, but only when it is set in
       the hook environment before the session starts. An export from a Bash
       call never reaches this hook.)

  4. Edits to AI_DOCS/, .claude/, or root README/CHANGELOG/LICENSE files
     proceed without routing (memory & docs).

This block came from hooks/enforce-do-routing.sh (v5).
========================================
EOF

exit 2
