#!/usr/bin/env bash
# Shell safety: no `set -e` — this hook renders the session-start banner from
# a pile of optional AI_DOCS state files, and a missing or malformed one must
# degrade gracefully (print what's available) rather than abort the whole
# banner. `set -u` is safe here: every variable is either assigned
# unconditionally before use, or assigned and used only within the same
# guarding `if` block, and the handful of globals set inside a conditional
# block (ACTIVE_MS_SS, CAPSULE_DIR_SS, A_COUNT/B_COUNT/C_COUNT) are already
# referenced later via the `${var:-}` default form, so an unset value there
# resolves to empty instead of erroring.
set -uo pipefail

# claude-skills Session Start Hook
# Runs on every SessionStart:
#   1. Auto-pulls framework updates from git
#   2. Detects breaking changes and flags migration if needed
#   3. Shows project state and recovery notice

CLAUDE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$CLAUDE_DIR/.adf-version"
UPGRADING_FILE="$CLAUDE_DIR/UPGRADING.md"
MIGRATION_FILE="AI_DOCS/memory/pending-migration.md"

# ── 1. Auto-pull framework ────────────────────────────────────────────────────
PREV_VERSION="$(cat "$VERSION_FILE" 2>/dev/null || echo "unknown")"

echo "========================================"
echo "  claude-skills Framework"
echo "========================================"

UPDATED=false
PULL_STAMP="AI_DOCS/memory/.last-session-pull"
PULL_INTERVAL=21600  # rate limit: pull at most once per 6 hours
SKIP_PULL=false
if [ -f "$PULL_STAMP" ]; then
  last_pull=$(cat "$PULL_STAMP" 2>/dev/null || echo 0)
  now_pull=$(date +%s)
  pull_age=$((now_pull - last_pull))
  if [ "$pull_age" -lt "$PULL_INTERVAL" ]; then
    SKIP_PULL=true
  fi
fi

if [ "$SKIP_PULL" = true ]; then
  echo "  Framework: pull skipped (checked within last 6h — using cached)"
elif [ -e "$CLAUDE_DIR/.git" ]; then
  # Pull only when .claude is its OWN checkout. "git -C .claude rev-parse" also
  # succeeds when .claude is a plain folder inside the project's repository, and
  # the pull then fast-forwarded the user's project branch at session start.
  PULL_OUTPUT=$(timeout 10 git -C "$CLAUDE_DIR" pull --ff-only 2>&1)
  PULL_EXIT=$?
  mkdir -p AI_DOCS/memory 2>/dev/null
  date +%s > "$PULL_STAMP" 2>/dev/null

  if [ $PULL_EXIT -eq 0 ]; then
    if echo "$PULL_OUTPUT" | grep -q "Already up to date"; then
      echo "  Framework: up to date (v$(cat "$VERSION_FILE" 2>/dev/null || echo "?"))"
    else
      UPDATED=true
      echo "  Framework: UPDATED"
      echo "$PULL_OUTPUT" | grep -E "files? changed|Updating" | sed 's/^/    /' | head -3
    fi
  else
    echo "  Framework: could not pull (offline or conflict — using cached)"
  fi
else
  echo "  Framework: not a git repo — skipping auto-update"
fi

NEW_VERSION="$(cat "$VERSION_FILE" 2>/dev/null || echo "unknown")"

# ── 2. Migration detection ────────────────────────────────────────────────────
if [ "$UPDATED" = true ] && [ "$PREV_VERSION" != "$NEW_VERSION" ] && [ "$PREV_VERSION" != "unknown" ]; then
  # Extract breaking changes for the new version from UPGRADING.md
  BREAKING_CHANGES=""
  if [ -f "$UPGRADING_FILE" ]; then
    BREAKING_CHANGES=$(awk -v ver="v$NEW_VERSION" '
      $0 ~ ("^## " ver) { found=1 }
      found && /^## Breaking Changes/ { capture=1; next }
      found && capture && /^---/ { exit }
      found && capture && /^## [^#]/ { exit }
      capture { print }
    ' "$UPGRADING_FILE" 2>/dev/null | sed '/^[[:space:]]*$/d' | head -30)
  fi

  echo ""
  if [ -n "$BREAKING_CHANGES" ]; then
    echo "  ⚠  FRAMEWORK UPDATED: v$PREV_VERSION → v$NEW_VERSION"
    echo "  ⚠  Breaking changes detected — migration may be required."
    echo ""

    # Write pending migration notice for Claude to surface
    mkdir -p AI_DOCS/memory
    cat > "$MIGRATION_FILE" << EOF
# Pending Migration: v$PREV_VERSION → v$NEW_VERSION

**Detected**: $(date '+%Y-%m-%d %H:%M:%S')
**Status**: PENDING — awaiting user confirmation

## Breaking Changes in v$NEW_VERSION

$BREAKING_CHANGES

## What to do

Before starting work this session, ask the user:

> "The claude-skills framework was updated from v$PREV_VERSION to v$NEW_VERSION.
> There are breaking changes. Would you like me to walk you through the migration
> steps now, or skip and continue?"

- If **yes** → open UPGRADING.md, follow the migration steps for v$NEW_VERSION,
  then delete this file when done.
- If **no / later** → delete this file and continue normally.
EOF
    echo "  Migration notice written to AI_DOCS/memory/pending-migration.md"
  else
    echo "  Framework updated: v$PREV_VERSION → v$NEW_VERSION — no breaking changes."
    rm -f "$MIGRATION_FILE" 2>/dev/null
  fi
else
  # Clean up any stale migration file from a prior update
  rm -f "$MIGRATION_FILE" 2>/dev/null
fi

# ── 3. Project state ──────────────────────────────────────────────────────────
echo ""
BRANCH=$(git branch --show-current 2>/dev/null)
if [ -n "$BRANCH" ]; then
  echo "  Project branch: $BRANCH"
fi

AGENT_COUNT=$(ls "$CLAUDE_DIR/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
SKILL_COUNT=$(find "$CLAUDE_DIR/skills" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
echo "  Agents: $AGENT_COUNT available | Skills: $SKILL_COUNT available"

if [ -f AI_DOCS/review-mode.txt ]; then
  MODE=$(cat AI_DOCS/review-mode.txt | tr -d '[:space:]')
  echo "  Review mode: $MODE"
fi

# ── 4. Milestone summary + active task resume (v4 capsule schema) ────────────
LEDGER_FILE_SS="AI_DOCS/memory/task-ledger.md"
STATE_FILE_SS="AI_DOCS/memory/session-state.md"

if [ -f "$LEDGER_FILE_SS" ]; then
  echo ""
  echo "=== Milestones ==="
  # Print the milestone summary table rows (lines starting with | M##)
  grep -E '^\|[[:space:]]*M[0-9]+' "$LEDGER_FILE_SS" 2>/dev/null | head -10 | sed 's/^/  /'

  # Determine active milestone from session-state or task-ledger "## Active milestone" section.
  ACTIVE_MS_SS=""
  if [ -f "$STATE_FILE_SS" ]; then
    ACTIVE_MS_SS=$(grep -iE '^[[:space:]]*-?[[:space:]]*active[_ -]?milestone[[:space:]]*:' "$STATE_FILE_SS" 2>/dev/null \
                   | head -1 | sed 's/.*://; s/^[[:space:]]*//' | tr -d '[:space:]')
  fi
  if [ -z "$ACTIVE_MS_SS" ]; then
    ACTIVE_MS_SS=$(awk '/^## Active milestone/{flag=1; next} /^## /{flag=0} flag' "$LEDGER_FILE_SS" 2>/dev/null | tr -d '[:space:]')
  fi

  if [ -n "$ACTIVE_MS_SS" ]; then
    CAPSULE_DIR_SS=$(ls -d AI_DOCS/milestones/${ACTIVE_MS_SS}* 2>/dev/null | head -1)
    if [ -n "$CAPSULE_DIR_SS" ] && [ -f "$CAPSULE_DIR_SS/tasks.md" ]; then
      # Look for a task currently DOING
      DOING_ROW=$(grep -E '^\|[^|]+\|[^|]+\|[[:space:]]*DOING[[:space:]]*\|' "$CAPSULE_DIR_SS/tasks.md" 2>/dev/null | head -1)
      if [ -n "$DOING_ROW" ]; then
        echo ""
        echo "========================================"
        echo "  UNFINISHED TASK DETECTED — resume it"
        echo "========================================"
        echo "  Milestone: $ACTIVE_MS_SS"
        echo "  $DOING_ROW" | sed 's/^[[:space:]]*/  /'
        echo ""
        echo "  >>> Run /do to resume <<<"
        echo "========================================"
      else
        NEXT_ROW=$(grep -E '^\|[^|]+\|[^|]+\|[[:space:]]*TODO[[:space:]]*\|' "$CAPSULE_DIR_SS/tasks.md" 2>/dev/null | head -1)
        if [ -n "$NEXT_ROW" ]; then
          echo ""
          echo "  Next task ($ACTIVE_MS_SS):"
          echo "  $NEXT_ROW" | sed 's/^[[:space:]]*/    /'
          echo "  >>> Run /do to start <<<"
        fi
      fi
    fi
  fi
fi

# ── 5. Project init check ─────────────────────────────────────────────────────
if [ ! -f AI_DOCS/memory/project-context.md ]; then
  echo ""
  echo "========================================"
  echo "  NO PROJECT CONTEXT FOUND"
  echo "========================================"
  echo "  This project has not been initialized."
  echo "  >>> Run /session-management to set up AI memory <<<"
  echo "========================================"
elif [ ! -f CLAUDE.md ]; then
  echo ""
  echo "  ⚠  CLAUDE.md missing. Run /project-context to regenerate"
fi

# ── 6. Session recovery ───────────────────────────────────────────────────────
if [ -f AI_DOCS/memory/session-state.md ]; then
  echo ""
  echo "=== RECOVERY: Session State Found ==="
  cat AI_DOCS/memory/session-state.md
  echo ""
  echo ">>> Run /session-management to restore working context <<<"
  echo "====================================="
fi

# Gate status
if [ -f AI_DOCS/memory/gate-status.md ]; then
  echo ""
  echo "=== Gate Status ==="
  head -20 AI_DOCS/memory/gate-status.md 2>/dev/null
fi

# FF-010 arming assertion: a fail-open marker hook silently degrades to allow-all
# when its stamping step was skipped. If the registry declares a frozen app-shell
# but gate-status.md lacks the shell-lock marker, enforce-shell-lock.sh is inert.
if [ -f AI_DOCS/design/component-registry.md ] \
   && grep -q "Locked app-shell (frozen)" AI_DOCS/design/component-registry.md 2>/dev/null \
   && ! grep -q "SHELL LOCKED" AI_DOCS/memory/gate-status.md 2>/dev/null; then
  echo ""
  echo "  !! SHELL LOCK NOT ARMED: component-registry.md declares a frozen app-shell"
  echo "     but gate-status.md lacks the SHELL LOCKED marker, so enforce-shell-lock.sh"
  echo "     is inert (fail-open). Re-arm it or record why (FF-010, decision-log 2026-07-14)."
fi

# ── 6a. Current work: session-state quick view ────────────────────────────────
if [ -f AI_DOCS/memory/session-state.md ]; then
  NEXT_ACTION_SS=$(grep -iE '^[[:space:]]*-?[[:space:]]*next[_ -]?action[[:space:]]*:' AI_DOCS/memory/session-state.md 2>/dev/null \
                   | head -1 | sed 's/.*://; s/^[[:space:]]*//')
  LAST_DEC_SS=$(grep -iE '^[[:space:]]*-?[[:space:]]*last[_ -]?decision[[:space:]]*:' AI_DOCS/memory/session-state.md 2>/dev/null \
                | head -1 | sed 's/.*://; s/^[[:space:]]*//')
  if [ -n "$NEXT_ACTION_SS" ]; then
    echo ""
    echo "=== Resuming from session-state ==="
    [ -n "$LAST_DEC_SS" ] && echo "  Last decision: $LAST_DEC_SS"
    echo "  Next action: $NEXT_ACTION_SS"
    echo "  >>> Run /do to continue <<<"
  fi
fi

# ── 7. Pending chunk reviews (v3.4 — post-chunk-review-detect queue) ──────────
REVIEW_QUEUE="AI_DOCS/memory/pending-reviews.jsonl"
if [ -f "$REVIEW_QUEUE" ]; then
  # awk-based count avoids the "grep -c + || echo 0 = '0\n0'" trap that breaks
  # arithmetic; always prints a single integer.
  PENDING_COUNT=$(awk '/"status":"pending"/ { c++ } END { print c+0 }' "$REVIEW_QUEUE" 2>/dev/null)
  [ -z "$PENDING_COUNT" ] && PENDING_COUNT=0
  if [ "$PENDING_COUNT" -gt 0 ]; then
    echo ""
    echo "=== Pending Chunk Reviews ($PENDING_COUNT) ==="
    echo "  Chunks closed without a code review. Recommended before advancing:"
    grep '"status":"pending"' "$REVIEW_QUEUE" 2>/dev/null | tail -5 \
      | sed -nE 's/.*"chunk_file":"([^"]+)".*/    - \1/p'
    echo ""
    echo "  >>> Invoke code-reviewer agent (Chunk Review Mode) on each <<<"
    echo "  See: agents/code-reviewer.md"
  fi
fi

# ── 7a. Next-chunk preview (v4) — from active milestone capsule ───────────────
# If the active task in tasks.md references a chunked plan, show the next
# PENDING chunk header — orient Claude cheaply without loading the full plan.
if [ -n "${ACTIVE_MS_SS:-}" ] && [ -n "${CAPSULE_DIR_SS:-}" ] && [ -f "$CAPSULE_DIR_SS/tasks.md" ]; then
  # Find a DOING task row that has a plan reference in Notes.
  DOING_ROW_V4=$(grep -E '^\|[^|]+\|[^|]+\|[[:space:]]*DOING[[:space:]]*\|' "$CAPSULE_DIR_SS/tasks.md" 2>/dev/null | head -1)
  if [ -n "$DOING_ROW_V4" ]; then
    PLAN_REL_V4=$(printf '%s' "$DOING_ROW_V4" | sed -nE 's|.*(planning/tasks/active/[^|` )]+/plan\.md).*|\1|p' | head -1)
    if [ -n "$PLAN_REL_V4" ]; then
      PLAN_FULL_V4="AI_DOCS/$PLAN_REL_V4"
      PLAN_DIR_V4=$(dirname "$PLAN_FULL_V4")
      if [ -f "$PLAN_FULL_V4" ]; then
        NEXT_CHUNK_V4=$(grep -m1 -E '^- \[ \]' "$PLAN_FULL_V4" 2>/dev/null \
                        | sed -nE 's/.*([cC]hunk-[0-9]+[A-Za-z0-9_-]*\.md).*/\1/p' | head -1)
        if [ -n "$NEXT_CHUNK_V4" ] && [ -f "$PLAN_DIR_V4/$NEXT_CHUNK_V4" ]; then
          CHUNK_FULL_V4="$PLAN_DIR_V4/$NEXT_CHUNK_V4"
          CHUNK_TITLE_V4=$(grep -m1 '^# ' "$CHUNK_FULL_V4" 2>/dev/null | sed 's/^# //')
          echo ""
          echo "=== Next Chunk Preview ==="
          echo "  Milestone: $ACTIVE_MS_SS"
          echo "  Plan:      $PLAN_REL_V4 → $NEXT_CHUNK_V4"
          [ -n "$CHUNK_TITLE_V4" ] && echo "  Title:     $CHUNK_TITLE_V4"
          echo "  Files Affected:"
          awk '/^## Files Affected/{flag=1; next} /^## /{flag=0} flag' "$CHUNK_FULL_V4" 2>/dev/null \
            | grep -E '^[[:space:]]*-[[:space:]]*(CREATE|MODIFY|UPDATE|DELETE|RENAME)' \
            | head -6 | sed 's/^/    /'
          VERIFY_V4=$(awk '/^## Verification/{flag=1; next} /^## /{flag=0} flag' "$CHUNK_FULL_V4" 2>/dev/null \
                      | grep -m1 -iE '^(Command|Manual):' | head -1)
          [ -n "$VERIFY_V4" ] && echo "  Verify:    $VERIFY_V4"
          echo ""
          echo "  >>> Read $NEXT_CHUNK_V4 only (not plan.md or context.md) <<<"
        fi
      fi
    fi
  fi
fi

# ── 8. Memory curator suggestions (v3.4) ──────────────────────────────────────
CURATOR_FILE="AI_DOCS/memory/curator-suggestions.md"
if [ -f "$CURATOR_FILE" ] && [ -s "$CURATOR_FILE" ]; then
  echo ""
  echo "=== Memory Curator Suggestions ==="
  # Print the ## Suggestions section only (skip header + trailing footer).
  awk '/^## Suggestions/{flag=1; next} /^---$/{flag=0} flag' "$CURATOR_FILE" 2>/dev/null | sed 's/^/  /'
  echo ""
  echo "  Delete $CURATOR_FILE to silence until next 24h check."
fi

# ── 8a. Drift report (v3.5) ───────────────────────────────────────────────────
# drift-detector.sh is wired as its own SessionStart hook that runs BEFORE
# this script, so the report file (if any) is already written by now.
DRIFT_FILE="AI_DOCS/quality/drift-report.md"
if [ -f "$DRIFT_FILE" ] && [ -s "$DRIFT_FILE" ]; then
  TOTAL_LINE=$(grep -m1 '^Total findings:' "$DRIFT_FILE" 2>/dev/null || echo "")
  A_COUNT=$(awk '/^## A\)/ { match($0, /\(([0-9]+)\)/, a); print a[1]; exit }' "$DRIFT_FILE" 2>/dev/null)
  B_COUNT=$(awk '/^## B\)/ { match($0, /\(([0-9]+)\)/, a); print a[1]; exit }' "$DRIFT_FILE" 2>/dev/null)
  C_COUNT=$(awk '/^## C\)/ { match($0, /\(([0-9]+)\)/, a); print a[1]; exit }' "$DRIFT_FILE" 2>/dev/null)
  echo ""
  echo "=== Drift Report ==="
  [ -n "${A_COUNT:-}" ] && echo "  Routes in code but NOT in api-contract.md:  $A_COUNT"
  [ -n "${B_COUNT:-}" ] && echo "  Routes in api-contract.md but NOT in code:  $B_COUNT"
  [ -n "${C_COUNT:-}" ] && echo "  Acceptance criteria without test coverage:  $C_COUNT"
  echo "  Full report: $DRIFT_FILE"
fi

# ── 8b. Milestone audit queue (v3.5) ──────────────────────────────────────────
MILESTONE_QUEUE="AI_DOCS/memory/milestone-audit-queue.jsonl"
if [ -f "$MILESTONE_QUEUE" ]; then
  MILESTONE_PENDING=$(awk '/"status":"pending"/ { c++ } END { print c+0 }' "$MILESTONE_QUEUE" 2>/dev/null)
  [ -z "$MILESTONE_PENDING" ] && MILESTONE_PENDING=0
  if [ "$MILESTONE_PENDING" -gt 0 ]; then
    echo ""
    echo "=== Milestone Audit Queue ($MILESTONE_PENDING) ==="
    echo "  PHASE-GATE(s) approved — run /project-audit to close out the milestone:"
    awk -F'"' '/"status":"pending"/ {
      for (i=1; i<=NF; i++) {
        if ($i == "milestone") m=$(i+2)
        if ($i == "gate_date") d=$(i+2)
      }
      printf "    - %s (%s)\n", m, d
    }' "$MILESTONE_QUEUE" 2>/dev/null | head -5
  fi
fi

# ── 8c. Hook health — self-disabled gates (v4.18) ─────────────────────────────
# enforce-chunk-scope.sh and enforce-anchors.sh each auto-disable (fail-open)
# after 3 recent slow runs recorded in AI_DOCS/memory/hook-health.log. A
# silently-disabled gate looks identical to a passing one, so surface it here.
# Wrapped so a missing/unreadable log never breaks the banner.
HEALTH_LOG_SS="AI_DOCS/memory/hook-health.log"
# Same budget and same parse as the two gates: only logged runs above the budget
# count, so the banner reports a disable only when the gate really is off.
SLOW_BUDGET_MS_SS=5000
if [ -f "$HEALTH_LOG_SS" ]; then
  TAIL3_SS=$(tail -3 "$HEALTH_LOG_SS" 2>/dev/null)
  if [ -n "$TAIL3_SS" ]; then
    CHUNK_SLOW_SS=$(printf '%s\n' "$TAIL3_SS" | grep "enforce-chunk-scope slow" \
                    | sed -nE 's/.*slow=([0-9]+)ms.*/\1/p' \
                    | awk -v b="$SLOW_BUDGET_MS_SS" '$1 + 0 > b + 0 { c++ } END { print c + 0 }')
    [ -z "$CHUNK_SLOW_SS" ] && CHUNK_SLOW_SS=0
    ANCHOR_SLOW_SS=$(printf '%s\n' "$TAIL3_SS" | sed -nE 's/.*slow=([0-9]+)ms.*/\1/p' \
                     | awk -v b="$SLOW_BUDGET_MS_SS" '$1 + 0 > b + 0 { c++ } END { print c + 0 }')
    [ -z "$ANCHOR_SLOW_SS" ] && ANCHOR_SLOW_SS=0

    if [ "$CHUNK_SLOW_SS" -eq 3 ]; then
      echo ""
      echo "  !! GATE SELF-DISABLED: enforce-chunk-scope.sh (3 runs above ${SLOW_BUDGET_MS_SS} ms logged in $HEALTH_LOG_SS). Re-enable by clearing the log (e.g. \`> $HEALTH_LOG_SS\`) once the slow root cause is fixed."
    fi
    if [ "$ANCHOR_SLOW_SS" -ge 3 ]; then
      echo ""
      echo "  !! GATE SELF-DISABLED: enforce-anchors.sh (3 runs above ${SLOW_BUDGET_MS_SS} ms logged in $HEALTH_LOG_SS). Re-enable by clearing the log (e.g. \`> $HEALTH_LOG_SS\`) once the slow root cause is fixed."
    fi
  fi
fi

# ── 9. Pending migration prompt ───────────────────────────────────────────────
if [ -f "$MIGRATION_FILE" ]; then
  echo ""
  echo "========================================"
  echo "  ACTION REQUIRED — FRAMEWORK MIGRATION"
  echo "========================================"
  cat "$MIGRATION_FILE"
  echo "========================================"
fi

echo ""
exit 0
