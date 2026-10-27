#!/usr/bin/env bash
# mavs-gate-advisory.test.sh - proving test for the mavs-gate parser's ADVISORY
# doctrine (docs/mavs-report-schema.md: an ADVISORY report never blocks, not on
# its failure counts and not on staleness, while FAIL, failed>0, and STALE keep
# blocking for every other status).
#
# Method: extracts the embedded Python parser from hooks/mavs-gate.sh verbatim
# (so the test always exercises the shipped logic, never a copy) and drives it
# against a fixture report directory in a throwaway sandbox. Both directions
# are asserted: the advisory reports must NOT block, the genuinely failing and
# stale reports MUST block.
#
# No set -e by design, matching house hook rules: assertions handle their own
# exits and the trap cleans up on every path.
set -uo pipefail

HOOK="$(cd "$(dirname "$0")/.." && pwd)/mavs-gate.sh"
[ -f "$HOOK" ] || { echo "FAIL: cannot locate mavs-gate.sh from $0"; exit 1; }

PY=""
for c in python3.13 python3.12 python3 python; do
  command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }
done
[ -n "$PY" ] || { echo "SKIP: no python available, cannot run parser test"; exit 0; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
PARSER="$SANDBOX/parser.py"

# Extract the embedded parser between the PYEOF heredoc markers, dropping the
# marker lines themselves.
sed -n "/<<'PYEOF'/,/^PYEOF$/p" "$HOOK" | sed '1d;$d' > "$PARSER"
[ -s "$PARSER" ] || { echo "FAIL: parser extraction produced an empty file"; exit 1; }

FIX="$SANDBOX/mavs"
mkdir -p "$FIX"
HEAD_COMMIT="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
OLD_COMMIT="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

# Advisory lane with findings AND a stale commit: must never block.
cat > "$FIX/slop.json" <<JSON
{"validator":"slop","status":"ADVISORY","failed":3,"source_commit":"$OLD_COMMIT"}
JSON
# Advisory lane, clean counts, stale commit: must never block.
cat > "$FIX/ui-review.json" <<JSON
{"validator":"ui-review","status":"ADVISORY","failed":0,"source_commit":"$OLD_COMMIT"}
JSON
# A real failure: must block.
cat > "$FIX/qa.json" <<JSON
{"validator":"qa","status":"FAIL","failed":1,"source_commit":"$HEAD_COMMIT"}
JSON
# A stale PASS: must block.
cat > "$FIX/api.json" <<JSON
{"validator":"api","status":"PASS","failed":0,"source_commit":"$OLD_COMMIT"}
JSON
# A current PASS: must not block.
cat > "$FIX/a11y.json" <<JSON
{"validator":"a11y","status":"PASS","failed":0,"source_commit":"$HEAD_COMMIT"}
JSON
printf 'qa\n' > "$FIX/required.txt"

OUT="$SANDBOX/out.txt"
"$PY" "$PARSER" "$FIX" "$HEAD_COMMIT" >"$OUT" 2>&1
RC=$?

PASS_COUNT=0
FAIL_COUNT=0
assert() {
  local desc="$1"; local ok="$2"
  if [ "$ok" = "yes" ]; then
    echo "PASS: $desc"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL: $desc"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

[ "$RC" -eq 2 ] && assert "gate blocks overall (qa FAIL + api STALE present)" yes || assert "gate blocks overall (qa FAIL + api STALE present)" no
grep -q "BLOCK  qa: status=FAIL" "$OUT" && assert "qa FAIL blocks" yes || assert "qa FAIL blocks" no
grep -q "BLOCK  api: STALE" "$OUT" && assert "stale PASS blocks" yes || assert "stale PASS blocks" no
grep -q "slop: ADVISORY with 3 findings, not blocking" "$OUT" && assert "advisory findings warn, not block" yes || assert "advisory findings warn, not block" no
grep -q "BLOCK  slop" "$OUT" && assert "slop never appears as a BLOCK line" no || assert "slop never appears as a BLOCK line" yes
grep -q "BLOCK  ui-review" "$OUT" && assert "stale advisory never appears as a BLOCK line" no || assert "stale advisory never appears as a BLOCK line" yes
grep -q "BLOCK  a11y" "$OUT" && assert "current PASS never blocks" no || assert "current PASS never blocks" yes

# Direction two: with the failing and stale reports removed, the gate allows.
rm -f "$FIX/qa.json" "$FIX/api.json"
printf 'a11y\n' > "$FIX/required.txt"
"$PY" "$PARSER" "$FIX" "$HEAD_COMMIT" >"$OUT" 2>&1
RC2=$?
[ "$RC2" -eq 0 ] && assert "gate allows when only advisory + clean PASS remain" yes || assert "gate allows when only advisory + clean PASS remain" no

echo
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "RESULT: ALL $PASS_COUNT ASSERTIONS PASSED (both directions proven)"
  exit 0
else
  echo "RESULT: $FAIL_COUNT ASSERTION(S) FAILED"
  exit 1
fi
