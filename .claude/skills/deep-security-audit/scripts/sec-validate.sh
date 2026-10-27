#!/usr/bin/env bash
# sec-validate.sh: run the vendored Cloudflare validators on a deep-security-audit run.
#
# Usage:
#   bash sec-validate.sh findings <path/to/findings.json>
#   bash sec-validate.sh ledger   <path/to/coverage-ledger.json>
#   bash sec-validate.sh selftest            # run both validator test suites
#
# On Windows (Git Bash / MSYS / Cygwin) it uses the ADF win32 overlay copies in
# vendor/cloudflare-security-audit/adf-win32/, regenerating them when missing.
# Everywhere else it runs the upstream validators unchanged. The first output
# line names the mode so the run report can disclose it. Exit code is the
# validator's own (0 = valid).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
VENDOR="$(cd "$HERE/../../../vendor/cloudflare-security-audit" 2>/dev/null && pwd)"
if [[ -z "$VENDOR" ]]; then
  echo "sec-validate: vendor/cloudflare-security-audit not found" >&2
  exit 2
fi
command -v node >/dev/null 2>&1 || { echo "sec-validate: node is required" >&2; exit 2; }

case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*) MODE="win32-overlay"; DIR="$VENDOR/adf-win32" ;;
  *)                    MODE="upstream";      DIR="$VENDOR/upstream" ;;
esac
if [[ "$MODE" == "win32-overlay" && ! -f "$DIR/validate-findings.cjs" ]]; then
  node "$HERE/patch-win32.cjs" "$VENDOR" >/dev/null || { echo "sec-validate: win32 overlay generation failed" >&2; exit 2; }
fi
echo "validator-mode: $MODE"

# Run node from a neutral directory so nothing in the audited tree is loaded.
NEUTRAL="${TMPDIR:-${TEMP:-$HOME}}"
cmd="${1:-}"
case "$cmd" in
  findings) [[ -n "${2:-}" ]] || { echo "usage: sec-validate.sh findings <file>" >&2; exit 2; }
            f="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
            (cd "$NEUTRAL" && node "$DIR/validate-findings.cjs" "$f") ;;
  ledger)   [[ -n "${2:-}" ]] || { echo "usage: sec-validate.sh ledger <file>" >&2; exit 2; }
            f="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
            (cd "$NEUTRAL" && node "$DIR/validate-coverage-ledger.cjs" "$f") ;;
  selftest) (cd "$NEUTRAL" && node --test "$DIR/validate-findings.test.cjs" "$DIR/validate-coverage-ledger.test.cjs") ;;
  *)        echo "usage: sec-validate.sh findings|ledger <file> | selftest" >&2; exit 2 ;;
esac
