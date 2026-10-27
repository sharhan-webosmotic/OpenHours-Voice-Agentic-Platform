#!/usr/bin/env bash
# Smoke tests for scripts/design-lookup.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
L="$HERE/../design-lookup.sh"
pass=0; fail=0
ok() { pass=$((pass+1)); echo "PASS: $1"; }
ko() { fail=$((fail+1)); echo "FAIL: $1"; }

out="$(bash "$L" "saas" --domain color 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && echo "$out" | grep -qi "Primary"; } && ok "palette query" || ko "palette query"

out="$(bash "$L" "elegant" --domain typography 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && echo "$out" | grep -qi "Heading Font"; } && ok "font query" || ko "font query"

out="$(bash "$L" "navigation" --stack flutter 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && echo "$out" | grep -qi "flutter"; } && ok "flutter stack query" || ko "flutter stack query"

out="$(bash "$L" "conversion" --domain landing 2>&1)"; rc=$?
{ [ $rc -eq 0 ] && echo "$out" | grep -qi "Section Order"; } && ok "landing query" || ko "landing query"

out="$(bash "$L" "fintech" --design-system --persist 2>&1)"; rc=$?
{ [ $rc -ne 0 ] && echo "$out" | grep -qi "refused"; } && ok "--persist refused" || ko "--persist refused"

out="$(bash "$L" "fintech" --design-system --pers 2>&1)"; rc=$?
[ $rc -ne 0 ] && ok "abbreviated --pers refused" || ko "abbreviated --pers refused"

bash "$L" "x" --domain nonsense >/dev/null 2>&1; rc=$?
[ $rc -ne 0 ] && ok "exit code preserved on bad domain" || ko "exit code preserved"

if grep -nE "urllib\.request|import requests|import http|import socket|import subprocess|os\.system" "$HERE"/../../vendor/ui-ux-pro-max/scripts/*.py >/dev/null; then ko "no network/exec in vendored scripts"; else ok "no network/exec in vendored scripts"; fi

echo "passed=$pass failed=$fail"
[ $fail -eq 0 ]
