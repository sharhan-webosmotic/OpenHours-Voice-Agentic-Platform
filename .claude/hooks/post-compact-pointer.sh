#!/usr/bin/env bash
# post-compact-pointer.sh - PostCompact hook (advisory, never blocks).
#
# After a compaction, paths-scoped rules and nested instruction files are NOT
# reloaded until a matching file is Read again (official Claude Code behavior).
# This hook prints a three-line pointer so the model re-anchors on the active
# milestone state immediately instead of acting on the compacted summary alone.
#
# No set -e by design: a missing AI_DOCS or session-state.md is a normal state
# (fresh project, framework repo itself) and must never break the hook chain.
# Uses set -u only, every expansion below is assigned or defaulted first.
set -uo pipefail

SS_FILE="AI_DOCS/memory/session-state.md"
SNAP_FILE="AI_DOCS/memory/compaction-snapshot.md"

[ -d "AI_DOCS" ] || exit 0

ACTIVE_MS=""
ACTIVE_TASK=""
if [ -f "$SS_FILE" ]; then
  ACTIVE_MS=$(grep -im1 "active milestone" "$SS_FILE" 2>/dev/null | head -1 || true)
  ACTIVE_TASK=$(grep -im1 "active task" "$SS_FILE" 2>/dev/null | head -1 || true)
fi

echo "Post-compaction pointer: ${ACTIVE_MS:-active milestone unknown, read $SS_FILE} | ${ACTIVE_TASK:-active task unknown}"
echo "Paths-scoped rules and nested instruction files were not reloaded by compaction. They return only when a matching file is Read, so re-Read the active capsule and any rule-governed file before editing it."
[ -f "$SNAP_FILE" ] && echo "Full pre-compaction snapshot: $SNAP_FILE"

exit 0
