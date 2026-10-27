#!/usr/bin/env bash
# scripts/design-lookup.sh: offline design knowledge lookup (vendored ui-ux-pro-max).
# The dataset SEEDS options. It never decides. design-system/tokens.json stays
# the single source of truth and principal-designer still gates.
#
# Usage: bash .claude/scripts/design-lookup.sh "<query>" [flags]
#
# Useful lookups:
#   "fintech dashboard" --design-system -p "Name"   full recommendation (style, palette, fonts, landing pattern)
#   "saas" --domain color                           palette rows by product type
#   "elegant serif" --domain typography             font pairings (with Google Fonts URL and CSS import)
#   "form feedback" --domain ux                     UX guidelines (Category/Issue is the citation key, plus Do, Don't, good/bad example)
#   "conversion" --domain landing                   landing Pattern ID and section order (use short keywords, e.g. "call to action", "conversion")
#   "trend over time" --domain chart                chart type selection with accessibility notes
#   "banking" --domain product                      product type to style/landing/palette mapping
#   "glass" --domain style                          style rows
#   "navigation" --stack flutter                    stack guidance (also react-native, swiftui,
#                                                   jetpack-compose, react, nextjs, vue, svelte, shadcn ...)
#   "dashboard" --domain icons | --domain gsap | --domain react
# Tip: add -f markdown to --design-system for clean output (default ascii uses ANSI colors).
# Flags: -n/--max-results 1-20, --json, --full, --variance/--motion/--density 1-10 (with --design-system)
#
# Refused: --persist (and --page, --output-dir, --force). Persisting writes a MASTER.md
# that would compete with design-system/tokens.json.
# Exit code is the Python exit code. No network, stdlib only, runs with python -I (isolated mode).

set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEARCH="$HERE/../vendor/ui-ux-pro-max/scripts/search.py"

if [ ! -f "$SEARCH" ]; then
  echo "design-lookup: vendored search.py not found at $SEARCH" >&2
  exit 2
fi

for a in "$@"; do
  case "$a" in
    --pe*|--pa*|--page|--page=*|--output-dir|--output-dir=*|-o|--force|--fo*)
      echo "design-lookup: refused flag '$a'. Persisting a MASTER.md would compete with design-system/tokens.json (single source of truth). Use lookups read-only." >&2
      exit 2
      ;;
  esac
done

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info[0]==3 else 1)' >/dev/null 2>&1; then
    PY="$c"; break
  fi
done
if [ -z "$PY" ]; then
  echo "design-lookup: no python3 found" >&2
  exit 2
fi

cd "${TMPDIR:-/tmp}" 2>/dev/null || cd "$HERE" || exit 2
# -I drops the script dir from sys.path, so add only the vendored scripts dir explicitly.
"$PY" -I -c 'import sys, runpy; p = sys.argv[1]; sys.path.insert(0, p.rsplit("/", 1)[0] if "/" in p else "."); sys.argv = sys.argv[1:]; runpy.run_path(p, run_name="__main__")' "$SEARCH" "$@"
exit $?
