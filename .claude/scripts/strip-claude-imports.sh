#!/usr/bin/env bash
# scripts/strip-claude-imports.sh: remove token-heavy @-imports from a project CLAUDE.md
#
# Why (v4.28.0): an `@path` line in CLAUDE.md loads the whole file into every
# session and every subagent. Older /project-context output imported nine rule
# files plus AI_DOCS/architecture/api-contract.md, component-registry.md and
# design-dna.md, which bypassed path-scoped rule loading and, in a mature
# project, put the full API contract into every turn. This script replaces
# those imports with on-demand pointers.
#
# Usage: bash scripts/strip-claude-imports.sh <path/to/CLAUDE.md>
#
# Safety:
#   - Only lines that are exactly an import of `.claude/rules/...` or
#     `AI_DOCS/...` are removed. Any other @-import the project wrote is kept.
#   - A timestamped backup (CLAUDE.md.bak-imports-YYYYMMDD-HHMMSS) is written
#     before the first change. No change means no backup and no write.
#   - Idempotent: the pointer block carries a marker and is added once.
#   - No `set -e`, no jq, exit 0 always (it must never break an upgrade).
set -u

FILE="${1:-}"
[[ -n "$FILE" && -f "$FILE" ]] || exit 0

IMPORT_RE='^@(\.claude/rules/|AI_DOCS/)[^[:space:]]+[[:space:]]*$'
MARKER='<!-- adf: on-demand-reads (v4.28.0) -->'

count="$(grep -cE "$IMPORT_RE" "$FILE" 2>/dev/null || true)"
count="${count:-0}"
if [[ "$count" -eq 0 ]]; then
  echo "  ok: no rule or AI_DOCS @-imports in $(basename "$FILE")"
  exit 0
fi

stamp="$(date +%Y%m%d-%H%M%S)"
backup="$FILE.bak-imports-$stamp"
cp "$FILE" "$backup" 2>/dev/null || { echo "  WARN: could not back up $FILE, leaving it unchanged"; exit 0; }

tmp="$FILE.tmp-imports-$$"
awk -v re="$IMPORT_RE" -v marker="$MARKER" '
  BEGIN { done = 0 }
  $0 ~ /^## Mandatory Reading/ && !done {
    print "## Read on demand (never @-import)"
    print ""
    print marker
    print "- Rules: the always-on chat rules load automatically, domain rules load by `paths:` when a matching file is touched (`.claude/rules/README.md`)."
    print "- `AI_DOCS/architecture/api-contract.md`: read the current task'"'"'s endpoint rows before API work (grep or Read with offset/limit)."
    print "- `AI_DOCS/design/component-registry.md`: grep it before creating a UI component."
    print "- `AI_DOCS/design/design-dna.md`: read it before UI design or styling work."
    done = 1
    next
  }
  $0 ~ re { next }
  { print }
  END {
    if (!done) {
      print ""
      print "## Read on demand (never @-import)"
      print ""
      print marker
      print "- Rules load automatically (always-on) or by `paths:` scoping (`.claude/rules/README.md`)."
      print "- Read `AI_DOCS/architecture/api-contract.md`, `AI_DOCS/design/component-registry.md` and `AI_DOCS/design/design-dna.md` when the task needs them, never by import."
    }
  }
' "$FILE" > "$tmp" 2>/dev/null

if [[ -s "$tmp" ]] && ! grep -qE "$IMPORT_RE" "$tmp"; then
  mv "$tmp" "$FILE"
  echo "  + removed $count @-import(s) from $(basename "$FILE") (backup: $(basename "$backup"))"
else
  rm -f "$tmp" 2>/dev/null
  echo "  WARN: import cleanup failed for $FILE, file left unchanged (backup kept)"
fi
exit 0
