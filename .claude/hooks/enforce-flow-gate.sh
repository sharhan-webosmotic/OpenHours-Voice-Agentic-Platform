#!/usr/bin/env bash
# hooks/enforce-flow-gate.sh: Block app-code edits for a Tier F flow that has not
# been approved or waived (Gate FLOW). v2, the proven-to-fire rewrite (PLAN-v4.20 C-2).
#
# PLAN-flow-validation.md Part 2.5 (Enforcement and the post-build loop-back):
# implementation tasks belonging to a Tier F flow (one that spans 3+ screens,
# involves role handoffs, branching outcomes, money movement, or cross-entity
# relations) carry a `flow:` tag once milestone-planning emits it. Before code
# for that flow may be written, the operator must have clicked through the
# flow-prototypes journey variants and approved one (or explicitly waived
# validation with a reason). Without this gate, a scope-complete task can still
# ship a journey the operator would not have approved had they seen it first.
#
# Fires only when ALL of these hold, otherwise exit 0:
#   1. The edited path is app code (same allowlist as enforce-do-routing.sh:
#      AI_DOCS/, .claude/, root README/CHANGELOG/LICENSE/etc. are not app code).
#   2. AI_DOCS/design/flow-validation-plan.md exists (the gate is only active once
#      flow-prototypes has run the triage for this project).
#   3. At least one DOING row, collected from EVERY milestones/*/tasks.md AND
#      task-ledger.md (all of them, no first-match short-circuit: a ledger
#      milestone-summary DOING row never carries the tag, the capsule task rows
#      do), carries a `flow:` tag.
#   4. Any tagged flow's plan row does not have Status `approved` or `waived`.
#      The Status CELL is read by pipe-column position (6th pipe field of the
#      | Flow ID | Flow name | Tier | Priority | Status | Chosen variant | Date |
#      schema) and compared exactly, so a flow NAMED "Approved vendor onboarding"
#      cannot pass while pending. A missing row blocks too: a flow the plan does
#      not record as approved/waived is exactly the case this gate exists to catch.
#
# Escape, recorded in decision-log.md:
#   - A "## Bypass" heading dated today (LOCAL date), outside a fenced code
#     block, with no later "## Resume framework" heading. It may name
#     ADF_FLOW_GATE_BYPASS or ADF_BYPASS, or no control at all (the CLAUDE.md
#     Section 1 opt-out). The heading alone opens the gate: a variable exported
#     from a Bash call never reaches this hook. A heading that says DENIED,
#     declined, ended, revoked, or rejected does not open it.
#   - ADF_FLOW_GATE_BYPASS=on (or ADF_BYPASS=on) in the hook environment PLUS a
#     same-day decision-log line that names that variable. The variable without
#     a record still blocks, and a line that merely mentions a variable does not
#     open the gate without the variable.
# Same-day scoping mirrors hooks/infra-cost-gate.sh, so one recorded override
# never satisfies every future bypass forever.
#
# Worktrees: an edit inside .claude/worktrees/<name>/ is allowed when EITHER the
# main checkout's state OR the worktree's own AI_DOCS state satisfies the gate.
#
# Runs on: PreToolUse for Edit | Write | MultiEdit.
# Exit codes: 0 (allow) or 2 (block). Nothing else. No `set -e`. No jq required.
# Fails open on any infra error so it never breaks a tool call outside the gate.
#
# Proven to fire (both directions): hooks/tests/enforce-flow-gate.test.sh.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Extract target file path through json-field.sh (jq when present, a sed
# fallback otherwise, jq is often absent on Windows).
FILE=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" file_path 2>/dev/null)
[[ -z "$FILE" ]] && exit 0

# Normalize Windows backslashes for matching, then squeeze repeated slashes.
FILE_NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr -s '/')

# ── Condition 1: is this app code? (same classification as enforce-do-routing.sh) ─
# Builder agents edit inside an isolated git worktree that Claude Code creates at
# <project>/.claude/worktrees/<name>/. Such a path contains "/.claude/", so the
# framework allowlist below used to exempt every app-code edit a builder made.
# Classify a worktree path by its location INSIDE the worktree. State is read
# from the MAIN checkout first and then from the worktree's own AI_DOCS.
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

TODAY=$(date +%Y-%m-%d 2>/dev/null)
TODAY_UTC=$(date -u +%Y-%m-%d 2>/dev/null)

# A same-day decision-log line that names $2 (used only together with the
# variable in the hook environment). Today is the local date, and the UTC date
# the old check used is accepted too.
recorded_today() {
  local log="$1"
  # Fail open when the clock itself is unavailable (infra error, not a violation).
  [[ -z "$TODAY$TODAY_UTC" ]] && return 0
  grep -i -- "$2" "$log" 2>/dev/null | grep -qE -- "${TODAY:-x}|${TODAY_UTC:-x}"
}

# The recorded opt-out heading, same reading as enforce-do-routing.sh: a line
# that starts "## Bypass" followed by a separator, the date, or a control name,
# dated today (local), outside a fenced code block, not closed by a later
# "## Resume framework" heading, naming none or one of the controls in $2.
bypass_recorded() {
  local log="$1" ctls="${2:-}"
  [[ -f "$log" ]] || return 1
  [[ -n "$TODAY" ]] || return 1
  LC_ALL=C awk -v d="$TODAY" -v ctls=" $ctls " '
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

# ── Conditions 2 to 4 and the recorded escape, for one AI_DOCS base ───────────
# Returns 0 when the gate does not block for the state under $1. Otherwise
# returns 1 and leaves FLOW_PLAN, UNAPPROVED, and BYPASS_REQUESTED set.
DOING_CELL='\|[[:space:]`*_]*DOING[[:space:]`*_]*\|'
flow_state_allows() {
  local base="$1" ledger rows tasks all_doing="" flow_ids fid flow_row status log
  FLOW_PLAN="$base/design/flow-validation-plan.md"
  UNAPPROVED=""
  BYPASS_REQUESTED=""

  # Condition 2: the flow-validation plan must exist for this gate to be active.
  [[ -f "$FLOW_PLAN" ]] || return 0

  # Condition 3: collect EVERY DOING row, then every flow: tag across them.
  # Same DOING-cell detection as enforce-do-routing.sh. v2 fix: no first-match
  # short-circuit. The ledger's milestone-summary DOING row never carries a flow
  # tag, so stopping there let every tagged capsule task through.
  ledger="$base/memory/task-ledger.md"
  if [[ -f "$ledger" ]]; then
    rows=$(grep -iE "^[[:space:]]*\|.*${DOING_CELL}" "$ledger" 2>/dev/null || true)
    [[ -n "$rows" ]] && all_doing+="$rows"$'\n'
  fi
  if [[ -d "$base/milestones" ]]; then
    for tasks in "$base"/milestones/*/tasks.md; do
      [[ -f "$tasks" ]] || continue
      rows=$(grep -iE "^[[:space:]]*\|.*${DOING_CELL}" "$tasks" 2>/dev/null || true)
      [[ -n "$rows" ]] && all_doing+="$rows"$'\n'
    done
  fi
  # No DOING row anywhere -> enforce-do-routing.sh already handles that case.
  [[ -z "$all_doing" ]] && return 0

  # Extract every flow id from `flow:<id>` tags across ALL collected rows.
  # v2 fix: the match is anchored on a preceding start-of-line, pipe, whitespace,
  # or backtick, so `workflow:` and `overflow:` can never match (both precede
  # "flow:" with a letter). The id is [A-Za-z0-9_-]+, a space after the colon is
  # tolerated. The trailing sed keeps only the id (everything after the colon).
  flow_ids=$(printf '%s' "$all_doing" \
    | grep -ioE '(^|[|[:space:]`])flow:[[:space:]]*[A-Za-z0-9_-]+' 2>/dev/null \
    | sed -E 's/.*:[[:space:]]*//' \
    | sort -u)
  # No DOING row carries a flow: tag -> Gate FLOW does not apply.
  [[ -z "$flow_ids" ]] && return 0

  # Condition 4: every tagged flow's Status cell must be approved or waived.
  # The plan row schema is:
  #   | Flow ID | Flow name | Tier | Priority | Status | Chosen variant | Date |
  # so with awk -F'|' the Status cell is field 6 ($1 is the empty text before the
  # leading pipe). The cell is trimmed of spaces/backticks/emphasis and compared
  # exactly (case-insensitive) against approved/waived. A missing row blocks: it
  # means the flow was never triaged or is still pending.
  while IFS= read -r fid; do
    [[ -z "$fid" ]] && continue
    flow_row=$(grep -iE "^[[:space:]]*\|[[:space:]]*\`?${fid}\`?[[:space:]]*\|" "$FLOW_PLAN" 2>/dev/null | head -1)
    status=""
    if [[ -n "$flow_row" ]]; then
      status=$(printf '%s\n' "$flow_row" | awk -F'|' '{
        s = $6
        gsub(/^[[:space:]`*_]+/, "", s)
        gsub(/[[:space:]`*_\r]+$/, "", s)
        print tolower(s)
      }' 2>/dev/null)
    fi
    case "$status" in
      approved|waived) : ;;
      *)
        if [[ -n "$flow_row" ]]; then
          UNAPPROVED+="  - ${fid} (row found, Status cell is \"${status:-empty}\", not approved/waived)"$'\n'
        else
          UNAPPROVED+="  - ${fid} (no row in the plan: never triaged or still pending)"$'\n'
        fi
        ;;
    esac
  done <<< "$flow_ids"
  # Every tagged flow is approved or waived -> allow.
  [[ -z "$UNAPPROVED" ]] && return 0

  # The recorded escape. v3 (same reasoning as enforce-shell-lock.sh v4, FF-046):
  # a "## Bypass" heading dated today is sufficient on its own, because a
  # variable exported from a Bash tool call never reaches the hook process.
  log="$base/memory/decision-log.md"
  bypass_recorded "$log" "ADF_BYPASS ADF_FLOW_GATE_BYPASS" && return 0
  # With the variable in the hook environment, the old rule: the variable plus a
  # same-day decision-log line that names it.
  if [[ "${ADF_FLOW_GATE_BYPASS:-off}" == "on" ]]; then
    recorded_today "$log" "ADF_FLOW_GATE_BYPASS" && return 0
    BYPASS_REQUESTED="ADF_FLOW_GATE_BYPASS"
  fi
  if [[ "${ADF_BYPASS:-off}" == "on" ]]; then
    recorded_today "$log" "ADF_BYPASS" && return 0
    [[ -z "$BYPASS_REQUESTED" ]] && BYPASS_REQUESTED="ADF_BYPASS"
  fi
  return 1
}

if flow_state_allows "$AI_DOCS_BASE"; then
  exit 0
fi
M_PLAN="$FLOW_PLAN"; M_UNAPPROVED="$UNAPPROVED"; M_REQ="$BYPASS_REQUESTED"
if [[ -n "$WT_ROOT" && -d "$WT_ROOT/$AI_DOCS_DIR" && "$WT_ROOT/$AI_DOCS_DIR" != "$AI_DOCS_BASE" ]]; then
  if flow_state_allows "$WT_ROOT/$AI_DOCS_DIR"; then
    exit 0
  fi
fi
FLOW_PLAN="$M_PLAN"; UNAPPROVED="$M_UNAPPROVED"; BYPASS_REQUESTED="$M_REQ"

if [[ -n "$BYPASS_REQUESTED" ]]; then
  cat <<EOF >&2

========================================
  ADF FLOW GATE: override not recorded
========================================
$BYPASS_REQUESTED=on is set but decision-log.md has no line that names
$BYPASS_REQUESTED and carries today's date ($TODAY).
Record the override first: append a line like

  ## Bypass $BYPASS_REQUESTED $TODAY: <reason>

to AI_DOCS/memory/decision-log.md, then retry. The date scoping is deliberate:
an override recorded once must not satisfy every future bypass forever.
From hooks/enforce-flow-gate.sh.
========================================
EOF
  exit 2
fi

cat <<EOF >&2

========================================
  ADF FLOW GATE BLOCK (Gate FLOW)
========================================
File:   $FILE
Plan:   $FLOW_PLAN
Flows blocking this edit:
$UNAPPROVED
An active DOING task carries a flow: tag for each flow above, and none of them
is approved or waived in the flow-validation plan. Their journeys have not been
approved as clickable prototypes, so implementation must not start yet: a
scope-complete build against an unvalidated journey is the exact failure mode
this gate exists to catch (PLAN-flow-validation.md).

To proceed, either:

  1. Run flow-prototypes for the flow(s) (recommended). It generates the journey
     variants, gets the operator's approval, and writes an "approved" Status
     into the flow's row in $FLOW_PLAN.
  2. Waive validation with a stated reason: set the flow's Status cell to
     "waived" in $FLOW_PLAN and log the reason in decision-log.md.
  3. If a deliberate override is truly needed:
       a) append a "## Bypass ADF_FLOW_GATE_BYPASS $TODAY: <reason>" heading to
          AI_DOCS/memory/decision-log.md (it must carry today's date)
       b) retry. The recorded heading is what this hook reads.

From hooks/enforce-flow-gate.sh.
========================================
EOF
exit 2
