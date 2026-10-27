#!/usr/bin/env bash
# scripts/agent-capacity.sh — recommend a safe parallel-agent concurrency cap.
#
# The framework fans subagents out in parallel (milestone-validation's MAVS suite,
# the team-* skills, PHASE-GATE directors). Without a cap an over-spawn can exhaust
# memory or process slots. This script reads the machine's cores + RAM and prints
# two caps the spawning skills honor:
#
#   LIGHT_CAP  — max concurrent READ-ONLY / analysis agents (code review, security
#                grep, doc reading, contract diff). Mostly API calls, light local
#                footprint, bounded by cores.
#   HEAVY_CAP  — max concurrent agents that run a BROWSER, test runner, throwaway DB,
#                or a build (webapp-testing/e2e/schema-validation/api-conformance).
#                Memory-bound: each can hold hundreds of MB to a couple of GB.
#
# Memory is usually the binding constraint, so HEAVY_CAP is sized off RAM. The caps
# scale per-machine (a 64 GB box gets more, a 8 GB box gets fewer), so this is safe
# to ship to every deployed project.
#
# Output (one line, shell-parseable):
#   CORES=16 RAM_GB=13 LIGHT_CAP=6 HEAVY_CAP=3
#
# House rules: set -uo pipefail (no set -e), best-effort detection, sane fallbacks.

set -uo pipefail

# ── Cores ─────────────────────────────────────────────────────────────────────
CORES=""
if command -v nproc >/dev/null 2>&1; then
  CORES=$(nproc 2>/dev/null)
elif command -v getconf >/dev/null 2>&1; then
  CORES=$(getconf _NPROCESSORS_ONLN 2>/dev/null)
fi
if ! [[ "$CORES" =~ ^[0-9]+$ ]] && command -v powershell >/dev/null 2>&1; then
  CORES=$(powershell -NoProfile -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum" 2>/dev/null | tr -d '[:space:]')
fi
[[ "$CORES" =~ ^[0-9]+$ ]] || CORES=4

# ── RAM (whole GB, floored) ───────────────────────────────────────────────────
RAM_GB=""
if [[ -r /proc/meminfo ]]; then
  _KB=$(awk '/^MemTotal:/{print $2; exit}' /proc/meminfo 2>/dev/null)
  [[ "$_KB" =~ ^[0-9]+$ ]] && RAM_GB=$(( _KB / 1048576 ))
fi
if ! [[ "$RAM_GB" =~ ^[0-9]+$ ]] && command -v sysctl >/dev/null 2>&1; then
  _BYTES=$(sysctl -n hw.memsize 2>/dev/null)
  [[ "$_BYTES" =~ ^[0-9]+$ ]] && RAM_GB=$(( _BYTES / 1073741824 ))
fi
if ! [[ "$RAM_GB" =~ ^[0-9]+$ ]] && command -v powershell >/dev/null 2>&1; then
  _BYTES=$(powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory" 2>/dev/null | tr -d '[:space:]')
  [[ "$_BYTES" =~ ^[0-9]+$ ]] && RAM_GB=$(( _BYTES / 1073741824 ))
fi
if ! [[ "$RAM_GB" =~ ^[0-9]+$ ]] && command -v wmic >/dev/null 2>&1; then
  _BYTES=$(wmic computersystem get TotalPhysicalMemory 2>/dev/null | grep -oE '[0-9]+' | head -1)
  [[ "$_BYTES" =~ ^[0-9]+$ ]] && RAM_GB=$(( _BYTES / 1073741824 ))
fi
# Conservative fallback if nothing detected.
[[ "$RAM_GB" =~ ^[0-9]+$ ]] && (( RAM_GB > 0 )) || RAM_GB=8

clamp() { local v=$1 lo=$2 hi=$3; (( v < lo )) && v=$lo; (( v > hi )) && v=$hi; echo "$v"; }

# LIGHT: cores-bound, but never more than RAM/2 concurrent processes, hard ceiling 12.
_L=$(( CORES - 2 )); (( _L < 1 )) && _L=1
_LM=$(( RAM_GB / 2 ))
(( _LM < _L )) && _L=$_LM
LIGHT_CAP=$(clamp "$_L" 2 12)

# HEAVY: memory-bound (~1 agent per 4 GB), also <= cores/4, ceiling 4, floor 1.
_H=$(( RAM_GB / 4 )); _HC=$(( CORES / 4 ))
(( _HC < _H )) && _H=$_HC
HEAVY_CAP=$(clamp "$_H" 1 4)

# Per-project / per-session overrides (the operator can pin caps explicitly).
[[ "${ADF_LIGHT_CAP:-}" =~ ^[0-9]+$ ]] && (( ADF_LIGHT_CAP >= 1 )) && LIGHT_CAP=$ADF_LIGHT_CAP
[[ "${ADF_HEAVY_CAP:-}" =~ ^[0-9]+$ ]] && (( ADF_HEAVY_CAP >= 1 )) && HEAVY_CAP=$ADF_HEAVY_CAP

echo "CORES=$CORES RAM_GB=$RAM_GB LIGHT_CAP=$LIGHT_CAP HEAVY_CAP=$HEAVY_CAP"
