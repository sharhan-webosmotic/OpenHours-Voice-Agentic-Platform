#!/usr/bin/env bash
# Function-coverage gate for Go.
#
# `go tool cover -func` reports per-function statement coverage plus a total.
# This script enforces the framework's 98% floor on functions (testing-rules
# Rule 7a): at least 98% of functions must have coverage above 0% (every
# function is exercised), matching Jest's `functions` metric semantics. It also
# checks the `total:` statement coverage against the same floor.
#
# Generated code and mocks are excluded (*.pb.go, *_gen.go, mocks/).
#
# Usage:
#   go test -coverprofile=cover.out ./...
#   bash check_func_coverage.sh cover.out 98

set -u

PROFILE="${1:-cover.out}"
FLOOR="${2:-98}"

if [ ! -f "$PROFILE" ]; then
  echo "ERROR: coverage profile not found: $PROFILE. Run 'go test -coverprofile=$PROFILE ./...' first." >&2
  exit 2
fi

go tool cover -func="$PROFILE" | awk -v floor="$FLOOR" '
  /\.pb\.go:|_gen\.go:|\/mocks\// { next }
  /^total:/ {
    tpct = $NF; sub(/%$/, "", tpct); total_stmt = tpct + 0; next
  }
  {
    total++
    pct = $NF; sub(/%$/, "", pct)
    if (pct + 0 > 0) covered++
    else print "  uncalled: " $1 " " $2 > "/dev/stderr"
  }
  END {
    fpct = (total > 0) ? covered / total * 100 : 100
    printf "Function coverage: %d/%d = %.2f%% (floor %s%%)\n", covered, total, fpct, floor
    printf "Statement total:  %.2f%% (floor %s%%)\n", total_stmt, floor
    fail = 0
    if (fpct + 0 < floor + 0)       { print "FAIL: function coverage below floor";  fail = 1 }
    if (total_stmt + 0 < floor + 0) { print "FAIL: statement coverage below floor"; fail = 1 }
    if (fail) exit 1
    print "PASS"
  }
'
