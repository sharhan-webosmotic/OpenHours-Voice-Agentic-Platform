#!/usr/bin/env bash
# hooks/pre-compact.sh — Mechanical snapshot before context compaction (v4).
#
# ADF's memory model: "the file is the memory, not the conversation."
# Skills are instructed to write session-state.md before compacting, but that's
# a convention. This hook is the safety net: it reads the canonical memory
# files and emits a compact (~4 KB) summary to stdout, which Claude Code
# forwards into the compacted context. It also persists the snapshot to disk.
#
# v4 schema: per-milestone capsules.
#   - Reads active milestone from session-state.md (or task-ledger.md fallback).
#   - Includes the active milestone's capsule.md + active task row from tasks.md.
#   - If task references a chunked plan, includes ~30 lines of the active chunk.
#   - Last 10 user prompts (was 3), last 10 decisions (was 5).
#   - Cap raised to 4 KB.
#
# Priority order is emission order. If the cap is hit, later sections truncate
# first — they are the lowest priority for context reconstruction.

set -uo pipefail
# Note: set -e intentionally off — missing memory files must not abort the hook.

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
MEM_DIR="$AI_DOCS_DIR/memory"
MS_DIR="$AI_DOCS_DIR/milestones"
SNAPSHOT_FILE="$MEM_DIR/compaction-snapshot.md"
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

SCRUB_SCRIPT="$(dirname "$0")/scrub.sh"
LOG_EVENT="$(dirname "$0")/log-event.sh"

# ── Helpers ───────────────────────────────────────────────────────────────────
head_lines() {
  local file="$1" n="$2"
  [[ -f "$file" ]] || return 0
  sed '/^[[:space:]]*$/d' "$file" 2>/dev/null | head -n "$n"
}

# field FILE PATTERN — extract "key: value" from FILE matching PATTERN (case-insensitive).
# A key written as a list item ("- Active task: T-03") is accepted too.
field() {
  local file="$1" pat="$2"
  [[ -f "$file" ]] || return 0
  grep -iE "^[[:space:]]*([-*][[:space:]]+)?${pat}[[:space:]]*:" "$file" 2>/dev/null | head -1 | sed 's/.*://; s/^[[:space:]]*//'
}

# resolve_active_milestone — return the active milestone slug (e.g. M01-auth) or empty.
resolve_active_milestone() {
  local from_state from_ledger
  from_state=$(field "$MEM_DIR/session-state.md" '(active[_ -]?milestone|current[_ -]?milestone|milestone)')
  if [[ -n "$from_state" ]]; then
    printf '%s' "$from_state"
    return
  fi
  # Fallback: look for "## Active milestone" section in task-ledger.md.
  if [[ -f "$MEM_DIR/task-ledger.md" ]]; then
    from_ledger=$(awk '/^## Active milestone/{flag=1; next} /^## /{flag=0} flag' \
      "$MEM_DIR/task-ledger.md" 2>/dev/null | tr -d '[:space:]')
    [[ -n "$from_ledger" ]] && printf '%s' "$from_ledger"
  fi
}

# ── Build snapshot ────────────────────────────────────────────────────────────
BUF=""
emit() { BUF+="$1"$'\n'; }

emit "=== ADF COMPACTION SNAPSHOT (${TS}) ==="
emit "The file is the memory. After compaction, run the recovery sequence in CLAUDE.md Section 2."
emit ""

# --- Working state from session-state.md ---------------------------------------
STATE_FILE="$MEM_DIR/session-state.md"
ACTIVE_MS=$(resolve_active_milestone)

# Initialised here because the sections below read these under `set -u` even
# when session-state.md is missing and the milestone came from task-ledger.md.
ACTIVE_TASK=""
LAST_DECISION=""
NEXT_ACTION=""
LAST_SKILL=""
CAPSULE_DIR=""

if [[ -f "$STATE_FILE" ]]; then
  ACTIVE_TASK=$(field "$STATE_FILE" '(active[_ -]?task|current[_ -]?task)')
  LAST_DECISION=$(field "$STATE_FILE" '(last[_ -]?decision)')
  NEXT_ACTION=$(field "$STATE_FILE" '(next[_ -]?action)')
  LAST_SKILL=$(field "$STATE_FILE" '(last[_ -]?skill|current[_ -]?skill)')

  emit "## Working state"
  [[ -n "${ACTIVE_MS:-}" ]]      && emit "- Active milestone: $ACTIVE_MS"
  [[ -n "${ACTIVE_TASK:-}" ]]    && emit "- Active task: $ACTIVE_TASK"
  [[ -n "${LAST_DECISION:-}" ]]  && emit "- Last decision: $LAST_DECISION"
  [[ -n "${NEXT_ACTION:-}" ]]    && emit "- Next action: $NEXT_ACTION"
  [[ -n "${LAST_SKILL:-}" ]]     && emit "- Last skill: $LAST_SKILL"
else
  emit "## Working state"
  emit "- session-state.md MISSING — run /session-management to rebuild."
  [[ -n "${ACTIVE_MS:-}" ]] && emit "- (resolved milestone from task-ledger: $ACTIVE_MS)"
fi
emit ""

# --- Active milestone capsule -------------------------------------------------
if [[ -n "$ACTIVE_MS" ]]; then
  # Find the capsule directory (slug may include trailing description).
  CAPSULE_DIR=$(ls -d "$MS_DIR/${ACTIVE_MS}"* 2>/dev/null | head -1)
  if [[ -z "$CAPSULE_DIR" ]] && [[ -d "$MS_DIR/$ACTIVE_MS" ]]; then
    CAPSULE_DIR="$MS_DIR/$ACTIVE_MS"
  fi

  if [[ -n "$CAPSULE_DIR" ]] && [[ -d "$CAPSULE_DIR" ]]; then
    # Capsule overview: capture Purpose + Exit criteria + Active task.
    if [[ -f "$CAPSULE_DIR/capsule.md" ]]; then
      CAPSULE_HEAD=$(awk '
        /^## (Purpose|Exit criteria|Active task)/ { flag=1; print; next }
        /^## / && flag                            { flag=0 }
        flag                                       { print }
      ' "$CAPSULE_DIR/capsule.md" 2>/dev/null | head -25)
      if [[ -n "$CAPSULE_HEAD" ]]; then
        emit "## Active milestone capsule ($ACTIVE_MS)"
        emit "$CAPSULE_HEAD"
        emit ""
      fi
    fi

    # Active task row from tasks.md.
    if [[ -f "$CAPSULE_DIR/tasks.md" ]] && [[ -n "$ACTIVE_TASK" ]]; then
      # Pull just the task ID without title parens.
      TASK_ID=$(printf '%s' "$ACTIVE_TASK" | grep -oE 'T-?[0-9]+' | head -1)
      if [[ -n "$TASK_ID" ]]; then
        TASK_ROW=$(grep -E "^\|[[:space:]]*$TASK_ID\b" "$CAPSULE_DIR/tasks.md" 2>/dev/null | head -1)
        if [[ -n "$TASK_ROW" ]]; then
          emit "## Active task row"
          emit "$TASK_ROW"
          emit ""
        fi
      fi
    fi
  fi
fi

# --- Active chunked plan excerpt (if any) -------------------------------------
# If the active task references a chunked plan, include ~30 lines of the active
# chunk so the post-compaction model knows exactly where it was.
if [[ -n "$ACTIVE_MS" ]] && [[ -n "$ACTIVE_TASK" ]] && [[ -n "$CAPSULE_DIR" ]] && [[ -d "$CAPSULE_DIR" ]]; then
  TASK_ROW=${TASK_ROW:-}
  PLAN_PATH=$(printf '%s' "$TASK_ROW" | sed -nE 's|.*(planning/tasks/active/[^|`)]+/plan\.md).*|\1|p' | head -1)
  if [[ -n "$PLAN_PATH" ]]; then
    PLAN_FULL="$AI_DOCS_DIR/$PLAN_PATH"
    PLAN_DIR=$(dirname "$PLAN_FULL")
    if [[ -f "$PLAN_FULL" ]]; then
      # First incomplete chunk file (line starting "- [ ]" referencing chunk-NN-*.md).
      PENDING_CHUNK=$(grep -m1 -E '^- \[ \]' "$PLAN_FULL" 2>/dev/null \
                      | sed -nE 's/.*([cC]hunk-[0-9]+[A-Za-z0-9_-]*\.md).*/\1/p' | head -1)
      if [[ -n "$PENDING_CHUNK" ]] && [[ -f "$PLAN_DIR/$PENDING_CHUNK" ]]; then
        CHUNK_EXCERPT=$(head -30 "$PLAN_DIR/$PENDING_CHUNK" 2>/dev/null)
        if [[ -n "$CHUNK_EXCERPT" ]]; then
          emit "## Active chunk (first 30 lines)"
          emit "File: $PLAN_PATH → $PENDING_CHUNK"
          emit '```'
          emit "$CHUNK_EXCERPT"
          emit '```'
          emit ""
        fi
      fi
    fi
  fi
fi

# --- Gate status (head only) --------------------------------------------------
GATE_FILE="$MEM_DIR/gate-status.md"
if [[ -f "$GATE_FILE" ]]; then
  GATE_SNIP=$(head_lines "$GATE_FILE" 12 | sed 's/^/  /')
  if [[ -n "$GATE_SNIP" ]]; then
    emit "## Gate status (top 12 lines)"
    emit "$GATE_SNIP"
    emit ""
  fi
fi

# --- Unresolved security findings (CRITICAL/HIGH) -----------------------------
SEC_FILE="$MEM_DIR/security-findings.md"
if [[ -f "$SEC_FILE" ]]; then
  UNRESOLVED=$(grep -iE '(CRITICAL|HIGH)' "$SEC_FILE" 2>/dev/null | grep -ivE '(resolved|fixed|closed)' | head -5 | sed 's/^/  /')
  if [[ -n "$UNRESOLVED" ]]; then
    emit "## Unresolved security findings (CRITICAL/HIGH)"
    emit "$UNRESOLVED"
    emit ""
  fi
fi

# --- Pending AI cost approvals ------------------------------------------------
AI_COST_FILE="$MEM_DIR/ai-cost-approvals.md"
if [[ -f "$AI_COST_FILE" ]]; then
  PENDING=$(grep -iE '(PENDING|AWAITING)' "$AI_COST_FILE" 2>/dev/null | head -3 | sed 's/^/  /')
  if [[ -n "$PENDING" ]]; then
    emit "## Pending AI cost approvals"
    emit "$PENDING"
    emit ""
  fi
fi

# --- Recent user prompts (last 10 — raw words, compaction-proof) --------------
PROMPTS_FILE="$MEM_DIR/user-prompts.log"
if [[ -f "$PROMPTS_FILE" ]]; then
  RECENT_PROMPTS=$(tail -10 "$PROMPTS_FILE" 2>/dev/null)
  if [[ -n "$RECENT_PROMPTS" ]]; then
    TRIMMED_PROMPTS=$(printf '%s\n' "$RECENT_PROMPTS" | awk 'length($0) > 200 { print substr($0, 1, 200) " [...]" ; next } { print }')
    emit "## Recent user prompts (last 10, raw)"
    emit "$TRIMMED_PROMPTS"
    emit ""
  fi
fi

# --- Recent decisions (last 10 from decision-log.md) --------------------------
DECISION_FILE="$MEM_DIR/decision-log.md"
if [[ -f "$DECISION_FILE" ]]; then
  RECENT_DEC=$(grep -E '^\| *[0-9]' "$DECISION_FILE" 2>/dev/null | tail -10)
  if [[ -n "$RECENT_DEC" ]]; then
    emit "## Recent decisions (last 10)"
    emit "$RECENT_DEC"
    emit ""
  fi
fi

# --- Recent skill invocations (last 5 from metrics.jsonl) ---------------------
METRICS_FILE="$MEM_DIR/metrics.jsonl"
if [[ -f "$METRICS_FILE" ]]; then
  RECENT=$(grep '"event":"skill.invoke"' "$METRICS_FILE" 2>/dev/null | tail -5)
  if [[ -n "$RECENT" ]]; then
    emit "## Recent skill invocations (last 5)"
    FORMATTED=$(printf '%s\n' "$RECENT" | sed -nE 's/.*"ts":"([^"]+)".*"skill":"([^"]+)".*/  - \1 \2/p')
    emit "$FORMATTED"
    emit ""
  fi
fi

# --- Recovery instruction -----------------------------------------------------
emit "## On resume"
emit "1. Read CLAUDE.md Section 2 (Compaction Recovery) — non-negotiable sequence."
emit "2. Re-read AI_DOCS/memory/session-state.md, task-ledger.md, then the active milestone capsule."
emit "3. Acknowledge in one line: 'Recovered: <milestone>/<task>/<last decision>/<next action>.'"

# ── Truncate to ~4 KB safety cap ──────────────────────────────────────────────
# 4096 bytes ≈ 1000 tokens. Raised from 3 KB in v3 to fit capsule head + 10
# prompts + 10 decisions. Truncation drops tail first (skill invocations,
# decisions, prompts).
MAX_BYTES=4096
BUF_BYTES=${#BUF}
if (( BUF_BYTES > MAX_BYTES )); then
  BUF="${BUF:0:$MAX_BYTES}"
  BUF+=$'\n[truncated — snapshot exceeded 4 KB cap]\n'
fi

# ── Scrub secrets, emit to stdout, persist to disk ────────────────────────────
mkdir -p "$MEM_DIR" 2>/dev/null

if [[ -f "$SCRUB_SCRIPT" ]]; then
  SCRUBBED=$(printf '%s' "$BUF" | bash "$SCRUB_SCRIPT")
else
  SCRUBBED="$BUF"
fi

# stdout → Claude Code injects into compacted context
printf '%s\n' "$SCRUBBED"

# disk → audit + SessionStart recovery fallback
printf '%s\n' "$SCRUBBED" > "$SNAPSHOT_FILE" 2>/dev/null || true

# telemetry
if [[ -f "$LOG_EVENT" ]]; then
  bash "$LOG_EVENT" "\"event\":\"hook.pre_compact\",\"bytes\":${#SCRUBBED}" 2>/dev/null || true
fi

exit 0
