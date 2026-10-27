#!/usr/bin/env bash
#
# progress-eta.sh: one-line progress and ETA for a long-running shell action,
# read from its log. Used by /do (Progress and ETA for long-running actions).
#
# Usage:
#   date +%s > "$LOG.start"; <long command> > "$LOG" 2>&1      # at launch
#   bash .claude/scripts/progress-eta.sh "$LOG" [--total N] [--steps N]
#
#   --total N   expected item count when the log does not state it (Jest suites)
#   --steps N   expected step count for a deploy-style log ("==> Step" headers)
#
# Recognized phases (latest phase in the log wins):
#   Playwright  "Running N tests", then one ✓/✘/- line per test
#   Jest        one "PASS <file>"/"FAIL <file>" line per suite, summary at the end
#   Vitest      "✓ <file>" / "× <file>" per file, "Test Files" summary at the end
#   Deploy      "==> <step>" section headers (self-host-deploy, deploy-office)
#
# Output, one line:
#   <phase>: <done>/<total> (<pct>%) passed=<p> failed=<f> elapsed=<m:ss> eta=<m:ss|unknown> [state]
# Exit 0 always; a missing log prints "not started".
set -uo pipefail

LOG="${1:-}"
shift || true
TOTAL_HINT=""
STEPS_HINT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --total) TOTAL_HINT="${2:-}"; shift 2 ;;
    --steps) STEPS_HINT="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

if [[ -z "$LOG" || ! -f "$LOG" ]]; then
  printf 'not started (no log at %s)\n' "${LOG:-<none>}"
  exit 0
fi

now=$(date +%s)
start=""
[[ -f "$LOG.start" ]] && start=$(tr -dc '0-9' < "$LOG.start")
[[ -z "$start" ]] && start=$(stat -c %Y "$LOG" 2>/dev/null || echo "$now")
elapsed=$(( now - start ))
(( elapsed < 1 )) && elapsed=1

fmt() { printf '%d:%02d' $(( $1 / 60 )) $(( $1 % 60 )); }

count() { grep -cE "$1" "$LOG" 2>/dev/null || true; }

state="running"
grep -qE '^EXIT [0-9]+' "$LOG" && state="finished ($(grep -oE '^EXIT [0-9]+' "$LOG" | tail -1))"

phase="unknown"
done_n=0; total=""; passed=0; failed=0

pw_line=$(grep -nE 'Running [0-9]+ tests' "$LOG" | tail -1 | cut -d: -f1)
jest_line=$(grep -nE '^(PASS|FAIL) ' "$LOG" | tail -1 | cut -d: -f1)
deploy_line=$(grep -nE '^==> ' "$LOG" | tail -1 | cut -d: -f1)
latest=0
for candidate in "${pw_line:-0}" "${jest_line:-0}" "${deploy_line:-0}"; do
  (( candidate > latest )) && latest=$candidate
done

if [[ -n "${pw_line}" && "$latest" == "$pw_line" ]] || { [[ -n "${pw_line}" ]] && (( ${pw_line:-0} >= ${jest_line:-0} )) && (( ${pw_line:-0} >= ${deploy_line:-0} )); }; then
  phase="playwright"
  total=$(sed -n "${pw_line}p" "$LOG" | grep -oE '[0-9]+' | head -1)
  segment=$(tail -n "+${pw_line}" "$LOG")
  passed=$(printf '%s\n' "$segment" | grep -cE '^\s+✓' || true)
  failed=$(printf '%s\n' "$segment" | grep -cE '^\s+✘' || true)
  skipped=$(printf '%s\n' "$segment" | grep -cE '^\s+-\s' || true)
  done_n=$(( passed + failed + skipped ))
elif [[ -n "${jest_line}" && "$latest" == "$jest_line" ]]; then
  phase="jest"
  passed=$(count '^PASS ')
  failed=$(count '^FAIL ')
  done_n=$(( passed + failed ))
  total="$TOTAL_HINT"
  summary=$(grep -E '^Test Suites:' "$LOG" | tail -1 | grep -oE '[0-9]+ total' | grep -oE '[0-9]+')
  [[ -n "$summary" ]] && total="$summary"
elif [[ -n "${deploy_line}" ]]; then
  phase="deploy"
  done_n=$(count '^==> ')
  failed=$(count '^  x  ')
  passed=$(count '^  ok  ')
  total="$STEPS_HINT"
  current=$(sed -n "${deploy_line}p" "$LOG" | sed -E 's/^==> //')
  phase="deploy [${current}]"
else
  vitest_files=$(count '^ (✓|×) ')
  if (( vitest_files > 0 )); then
    phase="vitest"
    passed=$(count '^ ✓ ')
    failed=$(count '^ × ')
    done_n=$vitest_files
    total="$TOTAL_HINT"
  fi
fi

eta="unknown"
pct="?"
if [[ "$total" =~ ^[0-9]+$ ]] && (( done_n > total )); then
  total=$done_n
fi
if [[ -n "$total" && "$total" =~ ^[0-9]+$ && "$total" -gt 0 ]]; then
  pct=$(( done_n * 100 / total ))
  if (( done_n > 0 && done_n < total )); then
    remaining=$(( (total - done_n) * elapsed / done_n ))
    eta=$(fmt "$remaining")
  elif (( done_n >= total )); then
    eta="0:00"
  fi
fi

printf '%s: %s/%s (%s%%) passed=%s failed=%s elapsed=%s eta=%s [%s]\n' \
  "$phase" "$done_n" "${total:-?}" "$pct" "$passed" "$failed" "$(fmt "$elapsed")" "$eta" "$state"
