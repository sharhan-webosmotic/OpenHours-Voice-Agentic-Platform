#!/usr/bin/env bash
# hooks/ledger-writer.sh — Task ledger manipulator (v3.7).
#
# Reads and rewrites AI_DOCS/memory/task-ledger.md. Four subcommands:
#
#   --open REQUEST PLAN_PATH CHUNK_COUNT TASK_ID
#       Seed the Active block. Refuses if Active is already populated
#       (use --close first, or pass --force as a 5th arg to override).
#
#   --progress CHUNK_PATH
#       Append a line to the Active block's Progress log based on CHUNK_PATH's
#       Status field and title. Regenerate Status line from plan.md.
#
#   --close [COMMIT_HASH]
#       Move current Active → Archive (prepend 1-liner), clear Active,
#       trim Archive to 20 most-recent rows.
#
#   --refresh-status
#       Regenerate only the Status line by re-reading plan.md. Idempotent.
#
# Called by: skills/task-planner/SKILL.md (Phase 3.4 + 5.4),
# hooks/post-chunk-review-detect.sh (v3.4+), hooks/task-router.sh (v3.3+)
# under LEDGER_AUTOSEED_ADHOC=on.
#
# Invariant: the file always has exactly one @active-begin...@active-end
# pair, one Archive section, and is safe to hand-edit outside those blocks.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
LEDGER_FILE="$AI_DOCS_DIR/memory/task-ledger.md"
SCRUB="$(dirname "$0")/scrub.sh"
LOG_EVENT="$(dirname "$0")/log-event.sh"

# ── Helpers ───────────────────────────────────────────────────────────────────

now_iso() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
today() { date -u +"%Y-%m-%d"; }

# Ensure ledger file exists with correct skeleton.
ensure_ledger_exists() {
  mkdir -p "$(dirname "$LEDGER_FILE")" 2>/dev/null || true
  if [[ ! -f "$LEDGER_FILE" ]]; then
    cat > "$LEDGER_FILE" <<'EOF'
# Task Ledger

<!-- @active-begin -->
<!-- @active-end -->

## Archive (last 20, most recent first)
EOF
  fi
  # Validate sentinels exist. If corrupted, append fresh ones.
  if ! grep -q '@active-begin' "$LEDGER_FILE" 2>/dev/null; then
    {
      echo ""
      echo "<!-- @active-begin -->"
      echo "<!-- @active-end -->"
    } >> "$LEDGER_FILE"
  fi
}

# True if the Active block has a Task ID (i.e. something is active).
active_is_populated() {
  awk '/@active-begin/{flag=1; next} /@active-end/{flag=0} flag' "$LEDGER_FILE" 2>/dev/null \
    | grep -qE '^Task ID:[[:space:]]+[^[:space:]]'
}

# Extract a single field's value from the Active block.
get_active_field() {
  local field="$1"
  awk '/@active-begin/{flag=1; next} /@active-end/{flag=0} flag' "$LEDGER_FILE" 2>/dev/null \
    | grep -m1 "^${field}:" | sed "s/^${field}:[[:space:]]*//"
}

# Count Progress log lines in the current Active block.
count_progress_lines() {
  awk '
    /@active-begin/ { inblock=1; next }
    /@active-end/   { inblock=0 }
    inblock && /^### Progress log/ { inprogress=1; next }
    inblock && inprogress && /^- / { c++ }
    END { print c+0 }
  ' "$LEDGER_FILE" 2>/dev/null
}

# Regenerate the Status 1-liner from a plan.md path.
# Reads the plan's Chunk Index (lines like "- [x] **C1**: schema → chunk-01-schema.md").
# Outputs: "N done (C1 title, C2 title), M in progress, K pending"
regenerate_status() {
  local plan_path="$1"
  if [[ -z "$plan_path" || "$plan_path" == "(ad-hoc)" || "$plan_path" == "(ad-hoc — no plan file)" ]]; then
    echo "In progress (ad-hoc — no plan)"
    return 0
  fi

  # Plan path in the ledger may be relative to project root (starts with "AI_DOCS/...")
  # or already absolute-ish. Normalize for reading.
  local full
  if [[ -f "$plan_path" ]]; then
    full="$plan_path"
  elif [[ -f "$AI_DOCS_DIR/planning/tasks/$plan_path" ]]; then
    full="$AI_DOCS_DIR/planning/tasks/$plan_path"
  elif [[ -f "./$plan_path" ]]; then
    full="./$plan_path"
  else
    echo "In progress (plan file not found: $plan_path)"
    return 0
  fi

  awk '
    # Match chunk-index lines. Accept both "[x]" and "[ ]" and "[/]" markers.
    /^- \[x\] / { done++; if (!done_titles) done_titles=""
                  # Extract title between ** and colon
                  if (match($0, /\*\*([^*]+)\*\*/, m)) {
                    if (done_titles != "") done_titles=done_titles", "
                    done_titles=done_titles m[1]
                  }
                }
    /^- \[\/\]/ { inprog++ }
    /^- \[ \]/  { pending++ }
    END {
      done+=0; inprog+=0; pending+=0
      if (done+inprog+pending == 0) {
        print "No chunks parsed from plan"
      } else {
        s = done " done"
        if (done_titles) s = s " (" done_titles ")"
        s = s ", " inprog " in progress, " pending " pending"
        print s
      }
    }
  ' "$full" 2>/dev/null
}

# Rewrite the Active block. Pass the full replacement content via stdin.
# Preserves everything outside the sentinels.
rewrite_active_block() {
  local tmp
  tmp=$(mktemp) || return 1
  awk -v newblock="$(cat)" '
    /@active-begin/ {
      print
      print newblock
      inblock=1
      next
    }
    /@active-end/ {
      inblock=0
      print
      next
    }
    !inblock { print }
  ' "$LEDGER_FILE" > "$tmp" && mv "$tmp" "$LEDGER_FILE"
}

# Append a row to the top of the Archive section (after "## Archive" heading).
prepend_archive() {
  local row="$1"
  local tmp
  tmp=$(mktemp) || return 1
  awk -v row="$row" '
    /^## Archive/ {
      print
      print row
      inserted=1
      next
    }
    { print }
    END {
      if (!inserted) {
        print ""
        print "## Archive (last 20, most recent first)"
        print row
      }
    }
  ' "$LEDGER_FILE" > "$tmp" && mv "$tmp" "$LEDGER_FILE"
}

# Trim Archive to MAX_ARCHIVE rows.
MAX_ARCHIVE=20
trim_archive() {
  local tmp
  tmp=$(mktemp) || return 1
  awk -v max="$MAX_ARCHIVE" '
    /^## Archive/ { inarc=1; print; next }
    !inarc { print; next }
    inarc && /^- / {
      kept++
      if (kept <= max) print
      next
    }
    # Non-row line inside archive (blank, heading, etc.) — always print
    { print }
  ' "$LEDGER_FILE" > "$tmp" && mv "$tmp" "$LEDGER_FILE"
}

# Clear the Active block (leave only sentinels).
clear_active() {
  printf '' | rewrite_active_block
}

# Scrub secrets from a string via scrub.sh.
scrub_str() {
  if [[ -x "$SCRUB" ]]; then
    printf '%s' "$1" | "$SCRUB"
  else
    printf '%s' "$1"
  fi
}

# Emit telemetry event.
emit_event() {
  if [[ -x "$LOG_EVENT" ]]; then
    "$LOG_EVENT" "$1" 2>/dev/null || true
  fi
}

# ── Subcommands ───────────────────────────────────────────────────────────────

cmd_open() {
  local request="${1:-}"
  local plan_path="${2:-(ad-hoc — no plan file)}"
  local chunk_count="${3:-0}"
  local task_id="${4:-ad-hoc}"
  local force="${5:-}"

  if [[ -z "$request" ]]; then
    echo "ledger-writer: --open requires REQUEST argument" >&2
    return 2
  fi

  ensure_ledger_exists

  if active_is_populated && [[ "$force" != "--force" ]]; then
    echo "ledger-writer: Active block is already populated (Task: $(get_active_field 'Task ID')). Use --close first, or pass --force as the 5th argument." >&2
    return 3
  fi

  local request_scrubbed
  request_scrubbed=$(scrub_str "$request")

  # Initial Status (0 done) and Next action.
  local status_line next_action
  if [[ "$chunk_count" -gt 0 ]] && [[ "$plan_path" != "(ad-hoc"* ]]; then
    status_line="0 done, 0 in progress, $chunk_count pending"
    # Try to read first pending chunk's title as Next action.
    local full_plan
    if [[ -f "$plan_path" ]]; then
      full_plan="$plan_path"
    elif [[ -f "$AI_DOCS_DIR/planning/tasks/$plan_path" ]]; then
      full_plan="$AI_DOCS_DIR/planning/tasks/$plan_path"
    else
      full_plan=""
    fi
    if [[ -n "$full_plan" ]]; then
      local first_chunk_title
      first_chunk_title=$(grep -m1 '^- \[ \]' "$full_plan" 2>/dev/null \
        | sed -E 's/^- \[ \][[:space:]]*//; s/ → .*$//; s/\*\*//g' \
        | head -c 80)
      next_action="Start ${first_chunk_title:-first chunk}"
    else
      next_action="Start first chunk"
    fi
  else
    status_line="In progress (ad-hoc — no chunks)"
    next_action="(set Next action in task-ledger.md)"
  fi

  local plan_display="$plan_path"
  if [[ "$chunk_count" -gt 0 ]] && [[ "$plan_path" != "(ad-hoc"* ]]; then
    plan_display="$plan_path ($chunk_count chunks)"
  fi

  # Compose new Active block (printed between sentinels).
  local block
  block=$(cat <<EOF

## Active
Started:      $(now_iso)
Task ID:      $task_id
Request:      $request_scrubbed
Plan:         $plan_display
Status:       $status_line
Next action:  $next_action

### Progress log
- $(now_iso) · Task opened
EOF
  )

  printf '%s\n' "$block" | rewrite_active_block

  emit_event "\"event\":\"hook.ledger_open\",\"task_id\":\"$task_id\""
  return 0
}

cmd_progress() {
  local chunk_path="${1:-}"
  if [[ -z "$chunk_path" ]]; then
    echo "ledger-writer: --progress requires CHUNK_PATH argument" >&2
    return 2
  fi

  ensure_ledger_exists

  if ! active_is_populated; then
    # No active task — silently no-op (caller may be post-chunk-review-detect
    # in an ad-hoc scenario where no ledger was opened).
    return 0
  fi

  # Derive chunk label + status + terse detail.
  local status title chunk_label
  if [[ -f "$chunk_path" ]]; then
    status=$(grep -m1 -iE '^Status[[:space:]]*:' "$chunk_path" 2>/dev/null | sed 's/^[^:]*:[[:space:]]*//; s/[[:space:]]*$//')
    title=$(grep -m1 '^# ' "$chunk_path" 2>/dev/null | sed 's/^# //')
  else
    status="UNKNOWN"
    title=$(basename "$chunk_path" .md)
  fi
  # Infer chunk number from filename (chunk-02-xxx.md → C2).
  chunk_label=$(basename "$chunk_path" | sed -nE 's/^chunk-0*([0-9]+).*/C\1/p')
  [[ -z "$chunk_label" ]] && chunk_label=$(basename "$chunk_path" .md)
  # Strip "Chunk N: " prefix from title (chunk_label already carries that info).
  title=$(printf '%s' "$title" | sed -E 's/^[Cc]hunk[[:space:]]+[0-9]+:?[[:space:]]*//')

  local entry="- $(now_iso) · ${chunk_label} ${title:-work} ${status:-PROGRESS}"

  # Regenerate Status from plan.md.
  local plan_field
  plan_field=$(get_active_field "Plan" | sed -E 's/ \(.*\)$//')  # strip "(N chunks)" suffix
  local new_status
  new_status=$(regenerate_status "$plan_field")

  # Rebuild the entire Active block, preserving existing header + fields,
  # replacing Status, and appending the new Progress line.
  local started task_id request plan_display next_action
  started=$(get_active_field "Started")
  task_id=$(get_active_field "Task ID")
  request=$(get_active_field "Request")
  plan_display=$(get_active_field "Plan")
  next_action=$(get_active_field "Next action")

  # Gather all existing Progress log lines + the new one.
  local existing_log
  existing_log=$(awk '
    /@active-begin/ { flag=1; next }
    /@active-end/   { flag=0 }
    flag && /^### Progress log/ { inlog=1; next }
    flag && inlog && /^- / { print }
  ' "$LEDGER_FILE" 2>/dev/null)

  local combined_log
  if [[ -n "$existing_log" ]]; then
    combined_log="$existing_log"$'\n'"$entry"
  else
    combined_log="$entry"
  fi

  local block
  block=$(cat <<EOF

## Active
Started:      $started
Task ID:      $task_id
Request:      $request
Plan:         $plan_display
Status:       $new_status
Next action:  $next_action

### Progress log
$combined_log
EOF
  )

  printf '%s\n' "$block" | rewrite_active_block

  emit_event "\"event\":\"hook.ledger_progress\",\"chunk\":\"$(basename "$chunk_path")\""
  return 0
}

cmd_close() {
  local commit_hash="${1:-}"

  ensure_ledger_exists

  if ! active_is_populated; then
    # Nothing to close.
    return 0
  fi

  local task_id request plan_display progress_count
  task_id=$(get_active_field "Task ID")
  request=$(get_active_field "Request")
  plan_display=$(get_active_field "Plan")
  progress_count=$(count_progress_lines)

  # Compose archive row.
  local request_short
  request_short=$(printf '%s' "$request" | cut -c1-80)
  [[ ${#request} -gt 80 ]] && request_short="${request_short}…"

  local chunk_note=""
  if [[ "$plan_display" != "(ad-hoc"* ]]; then
    # Extract chunk count from plan_display: "path (N chunks)"
    local n
    n=$(printf '%s' "$plan_display" | sed -nE 's/.*\(([0-9]+) chunks?\).*/\1/p')
    [[ -n "$n" ]] && chunk_note="$n chunks DONE"
  fi
  [[ -z "$chunk_note" ]] && chunk_note="ad-hoc"

  local row
  if [[ -n "$commit_hash" ]]; then
    row="- $(today) · \"$request_short\" · $task_id · $chunk_note · commit $commit_hash"
  else
    row="- $(today) · \"$request_short\" · $task_id · $chunk_note"
  fi

  prepend_archive "$row"
  trim_archive
  clear_active

  emit_event "\"event\":\"hook.ledger_close\",\"task_id\":\"$task_id\""
  return 0
}

cmd_refresh_status() {
  ensure_ledger_exists
  if ! active_is_populated; then
    return 0
  fi

  local plan_field new_status
  plan_field=$(get_active_field "Plan" | sed -E 's/ \(.*\)$//')
  new_status=$(regenerate_status "$plan_field")

  # Minimal-change rewrite: only replace the Status line inside the Active
  # block. Preserves all surrounding content byte-for-byte — idempotent.
  local tmp
  tmp=$(mktemp) || return 1
  awk -v new_status="$new_status" '
    /@active-begin/ { inblock=1 }
    /@active-end/   { inblock=0 }
    inblock && /^Status:/ { print "Status:       " new_status; next }
    { print }
  ' "$LEDGER_FILE" > "$tmp" && mv "$tmp" "$LEDGER_FILE"
  return 0
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

case "${1:-}" in
  --open)           shift; cmd_open "$@" ;;
  --progress)       shift; cmd_progress "$@" ;;
  --close)          shift; cmd_close "$@" ;;
  --refresh-status) shift; cmd_refresh_status ;;
  -h|--help|"")
    cat <<'USAGE'
Usage:
  ledger-writer.sh --open REQUEST PLAN_PATH CHUNK_COUNT TASK_ID [--force]
  ledger-writer.sh --progress CHUNK_PATH
  ledger-writer.sh --close [COMMIT_HASH]
  ledger-writer.sh --refresh-status
USAGE
    exit 0
    ;;
  *)
    echo "ledger-writer: unknown subcommand: $1" >&2
    exit 2
    ;;
esac
