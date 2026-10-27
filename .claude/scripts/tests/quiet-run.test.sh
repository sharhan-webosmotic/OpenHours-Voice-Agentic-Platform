#!/usr/bin/env bash
# Tests for scripts/quiet-run.sh. Run: bash scripts/tests/quiet-run.test.sh

HERE="$(cd "$(dirname "$0")" && pwd)"
QR="$HERE/../quiet-run.sh"
WORK=$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/qr-test-$$")
mkdir -p "$WORK"
cd "$WORK" || exit 1
mkdir -p AI_DOCS

PASS=0
FAILS=0
check() {
  if [[ "$2" == "ok" ]]; then PASS=$((PASS+1)); echo "ok   $1"
  else FAILS=$((FAILS+1)); echo "FAIL $1"; fi
}

cat > jest_pass.sh <<'X'
#!/usr/bin/env bash
echo "PASS src/a.test.ts"
echo "Test Suites: 3 passed, 3 total"
echo "Tests:       12 passed, 12 total"
exit 0
X
cat > py_fail.sh <<'X'
#!/usr/bin/env bash
echo "collected 3 items"
echo "Traceback (most recent call last):"
echo '  File "t.py", line 4, in test_x'
echo "AssertionError: 1 != 2"
echo "=== 1 failed, 2 passed in 0.12s ==="
exit 1
X
cat > tsc_fail.sh <<'X'
#!/usr/bin/env bash
echo "src/a.ts(1,1): error TS2322: bad type"
echo "src/b.ts(2,2): error TS2304: not found"
echo "Found 2 errors in 2 files."
exit 2
X
cat > noisy.sh <<'X'
#!/usr/bin/env bash
for i in $(seq 1 2000); do echo "noise line $i"; done
echo "Tests:       5 passed, 5 total"
exit 0
X

out=$(bash "$QR" bash jest_pass.sh); rc=$?
check "jest rc 0" "$([[ $rc -eq 0 ]] && echo ok)"
check "jest summary shown" "$(grep -q 'Tests:' <<<"$out" && echo ok)"
echo "  jest printed $(wc -l <<<"$out") lines"

out=$(bash "$QR" bash py_fail.sh); rc=$?
check "pytest rc 1" "$([[ $rc -eq 1 ]] && echo ok)"
check "pytest traceback shown" "$(grep -q 'AssertionError' <<<"$out" && echo ok)"
check "pytest full log line" "$(grep -q '^Full log:' <<<"$out" && echo ok)"
echo "  pytest printed $(wc -l <<<"$out") lines"

out=$(bash "$QR" bash tsc_fail.sh); rc=$?
check "tsc rc 2" "$([[ $rc -eq 2 ]] && echo ok)"
check "tsc errors shown" "$(grep -q 'error TS2322' <<<"$out" && grep -q 'Found 2 errors' <<<"$out" && echo ok)"
echo "  tsc printed $(wc -l <<<"$out") lines"

out=$(bash "$QR" bash noisy.sh); rc=$?
n=$(wc -l <<<"$out")
check "noisy rc 0" "$([[ $rc -eq 0 ]] && echo ok)"
check "noisy <= 20 lines" "$([[ $n -le 20 ]] && echo ok)"
echo "  noisy printed $n lines (full 2001)"
log=$(ls -t AI_DOCS/.temp/quiet-run/*noisy* 2>/dev/null | head -1)
check "log exists in AI_DOCS" "$([[ -f "$log" ]] && echo ok)"
check "log has all lines" "$([[ $(wc -l <"$log") -eq 2001 ]] && echo ok)"

out=$(QUIET_RUN_MAX_FAIL=1 bash "$QR" bash tsc_fail.sh)
check "MAX_FAIL cap honored" "$([[ $(grep -c 'error TS' <<<"$out") -eq 1 ]] && echo ok)"

cd / && rm -rf "$WORK"
echo "passed=$PASS failed=$FAILS"
[[ $FAILS -eq 0 ]]
