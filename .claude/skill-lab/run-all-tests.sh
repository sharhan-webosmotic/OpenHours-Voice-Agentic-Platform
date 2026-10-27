#!/usr/bin/env bash
# =============================================================================
# skill-lab — Static Test Runner
# =============================================================================
# Usage:
#   bash run-all-tests.sh              — interactive: asks batch or step mode
#   bash run-all-tests.sh --batch      — force batch (no prompts, great for CI)
#   bash run-all-tests.sh --step       — force step mode (pause after each skill)
#   bash run-all-tests.sh --audit      — also show spec coverage from catalog.yaml
#   bash run-all-tests.sh --fix-list   — show /skill-improve commands at the end
#
# Output:
#   stdout                            — live results as each skill is tested
#   results/static-YYYY-MM-DD.md     — full markdown report (always written)
#   results/latest.md                 — copy of most recent report
#
# Cost: ZERO tokens — pure shell, no Claude API calls
# =============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/skills"
AGENTS_DIR="$PROJECT_ROOT/agents"
CATALOG="$SCRIPT_DIR/catalog.yaml"
RESULTS_DIR="$SCRIPT_DIR/results"
DATE=$(date +%Y-%m-%d_%H-%M)
REPORT="$RESULTS_DIR/static-$DATE.md"
LATEST="$RESULTS_DIR/latest.md"

mkdir -p "$RESULTS_DIR"

# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------
MODE=""           # batch | step  (set by flags or prompt)
SHOW_AUDIT=false
SHOW_FIX_LIST=false
SKIP_TO_SUMMARY=false

for arg in "$@"; do
  case "$arg" in
    --batch)    MODE="batch" ;;
    --step)     MODE="step" ;;
    --audit)    SHOW_AUDIT=true ;;
    --fix-list) SHOW_FIX_LIST=true ;;
  esac
done

# ---------------------------------------------------------------------------
# Colors (only when outputting to a terminal)
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
  TICK="${GREEN}✓${NC}"; CROSS="${RED}✗${NC}"; WARN_ICON="${YELLOW}⚠${NC}"
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; DIM=''; NC=''
  TICK='✓'; CROSS='✗'; WARN_ICON='⚠'
fi

# ---------------------------------------------------------------------------
# Counters + tracking
# ---------------------------------------------------------------------------
TOTAL=0; PASS=0; FAIL=0; WARN=0
declare -a FAILED_NAMES=()
declare -a WARNED_NAMES=()

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   skill-lab            ║${NC}"
echo -e "${BOLD}║   Static Test Runner                     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo -e "${DIM}  Project : $PROJECT_ROOT${NC}"
echo -e "${DIM}  Report  : $REPORT${NC}"
echo ""

# ---------------------------------------------------------------------------
# Mode selection — ask if not forced by flag and stdin is a TTY
# ---------------------------------------------------------------------------
if [ -z "$MODE" ]; then
  if [ -t 0 ]; then
    echo -e "${BOLD}Test mode:${NC}"
    echo -e "  ${CYAN}[1] Batch${NC} — test all skills at once, show summary at end ${DIM}(default)${NC}"
    echo -e "  ${CYAN}[2] Step${NC}  — pause after each skill, review one at a time"
    echo ""
    read -r -p "  Enter choice [1/2, default=1]: " mode_choice
    case "$mode_choice" in
      2) MODE="step" ;;
      *) MODE="batch" ;;
    esac
  else
    MODE="batch"   # non-interactive / CI fallback
  fi
fi

echo ""
if [ "$MODE" = "step" ]; then
  echo -e "${CYAN}Mode: Step-by-step${NC} — press ${BOLD}Enter${NC} to advance, ${BOLD}q${NC} to quit, ${BOLD}s${NC} to skip to summary"
else
  echo -e "${CYAN}Mode: Batch${NC} — running all checks now..."
fi
echo ""

# ---------------------------------------------------------------------------
# Report header
# ---------------------------------------------------------------------------
{
  echo "# ADF Static Test Report — $DATE"
  echo ""
  echo "Mode: $MODE"
  echo ""
  echo "| # | Name | Frontmatter | Fields | Model | Version | skill_id | Description | Location | No Inline | Result |"
  echo "|---|------|-------------|--------|-------|---------|----------|-------------|----------|-----------|--------|"
} > "$REPORT"

# ---------------------------------------------------------------------------
# check_file()
#   $1 = absolute file path
#   $2 = display name
#   $3 = path pattern (regex, for location check)
# ---------------------------------------------------------------------------
check_file() {
  local filepath="$1"
  local name="$2"
  local path_pattern="$3"

  TOTAL=$((TOTAL + 1))

  # Per-check results and detail messages
  local c1="PASS" c2="PASS" c3="PASS" c4="PASS" c5="PASS" c6="PASS" c7="PASS" c8="PASS"
  local d1="" d2="" d3="" d4="" d5="" d6="" d7="" d8=""
  local fail_reasons=()
  local warn_reasons=()

  # ---- Check 1: YAML frontmatter ---------------------------------------
  local first_line
  first_line=$(head -1 "$filepath" 2>/dev/null | tr -d '\r' || echo "")
  if [[ "$first_line" != "---" ]]; then
    c1="FAIL"; d1="file must start with ---"
    fail_reasons+=("Frontmatter: $d1")
  else
    local close_count
    close_count=$(grep -c "^---" "$filepath" 2>/dev/null | tr -d '\r\n')
    close_count=${close_count:-0}
    if [ "$close_count" -lt 2 ]; then
      c1="WARN"; d1="no closing --- found"; warn_reasons+=("Frontmatter: $d1")
    else
      d1="present"
    fi
  fi

  # ---- Check 2: Required fields ----------------------------------------
  # Hard requirements (Claude Code contract): name + description.
  # Tool restriction is OPTIONAL: skills use `allowed-tools:`, agents use
  # `tools:` — accept either, warn (never fail) when absent.
  local missing_fields=()
  grep -q "^name:"        "$filepath" 2>/dev/null || missing_fields+=("name")
  grep -q "^description:" "$filepath" 2>/dev/null || missing_fields+=("description")
  if [ ${#missing_fields[@]} -gt 0 ]; then
    c2="FAIL"; d2="missing: ${missing_fields[*]}"
    fail_reasons+=("Required fields: $d2")
  elif grep -qE "^(tools|allowed-tools):" "$filepath" 2>/dev/null; then
    d2="name ✓  description ✓  tools ✓"
  else
    c2="WARN"; d2="name ✓  description ✓  no tools/allowed-tools (unrestricted)"
    warn_reasons+=("Tools: no tools/allowed-tools field (skill runs unrestricted)")
  fi

  # ---- Check 3: Model tier ---------------------------------------------
  # POLICY 2026-10-21 (v4.28.0 cost policy): an AGENT may carry model: haiku or
  # model: sonnet. Any other agent model, any preferred_model:, and any model:
  # on a SKILL.md is flagged (skills never carry model: it rebuilds the main
  # conversation's prompt cache).
  local model_val
  model_val=$(grep -m1 -E "^model:" "$filepath" 2>/dev/null | sed 's/^model: *//' | tr -d '"' | xargs)
  if grep -qE "^preferred_model:" "$filepath" 2>/dev/null; then
    c3="WARN"
    d3="preferred_model field present (stale policy)"
    warn_reasons+=("Model: $d3")
  elif [ -n "$model_val" ]; then
    if [[ "$filepath" == */SKILL.md ]]; then
      c3="WARN"
      d3="model: $model_val on a skill (skills never carry model: it rebuilds the main conversation's prompt cache)"
      warn_reasons+=("Model: $d3")
    elif [ "$model_val" = "haiku" ] || [ "$model_val" = "sonnet" ]; then
      d3="$model_val (compliant agent model)"
    else
      c3="WARN"
      d3="model: $model_val (agents may only use haiku or sonnet)"
      warn_reasons+=("Model: $d3")
    fi
  else
    d3="none (compliant, inherits session model)"
  fi

  # ---- Check 4: Version ------------------------------------------------
  if ! grep -q "^version:" "$filepath" 2>/dev/null; then
    c4="WARN"; d4="no version: field"; warn_reasons+=("Version: missing")
  else
    local ver_val
    ver_val=$(grep "^version:" "$filepath" | head -1 | sed 's/^version: *//' | tr -d '"' | xargs)
    if echo "$ver_val" | grep -qE "^[0-9]+\.[0-9]+\.[0-9]+$"; then
      d4="$ver_val"
    else
      c4="WARN"; d4="$ver_val (not semver)"; warn_reasons+=("Version: $d4")
    fi
  fi

  # ---- Check 5: skill_id -----------------------------------------------
  if ! grep -q "^skill_id:" "$filepath" 2>/dev/null; then
    c5="WARN"; d5="no skill_id: field"; warn_reasons+=("skill_id: missing")
  else
    local id_val
    id_val=$(grep "^skill_id:" "$filepath" | head -1 | sed 's/^skill_id: *//' | tr -d '"' | xargs)
    d5="$id_val"
  fi

  # ---- Check 6: Description quality -----------------------------------
  if grep -q "^description:" "$filepath" 2>/dev/null; then
    local desc_raw
    desc_raw=$(grep "^description:" "$filepath" | head -1 | sed 's/^description: *//' | tr -d '"')
    local desc_len=${#desc_raw}
    if [ "$desc_len" -lt 20 ]; then
      c6="FAIL"; d6="${desc_len} chars (need >20)"
      fail_reasons+=("Description: $d6")
    elif echo "$desc_raw" | grep -qiE "\btodo\b|\btbd\b|(^|[^a-z-])placeholder|\[fill in\]|fill in here|your description here|your description goes"; then
      c6="FAIL"; d6="looks like placeholder text"
      fail_reasons+=("Description: $d6")
    else
      d6="${desc_len} chars"
    fi
  else
    c6="FAIL"; d6="no description field"
    fail_reasons+=("Description: $d6")
  fi

  # ---- Check 7: File location ------------------------------------------
  if echo "$filepath" | grep -qiE "$path_pattern"; then
    d7="correct"
  else
    c7="FAIL"; d7="wrong location"
    fail_reasons+=("Location: expected $path_pattern")
  fi

  # ---- Check 8: No large inline gate prompt blocks ---------------------
  local gate_hits
  gate_hits=$(grep -cE "APPROVE|CONCERNS|REJECT" "$filepath" 2>/dev/null | tr -d '\r\n')
  gate_hits=${gate_hits:-0}
  if [ "$gate_hits" -gt 15 ]; then
    local section_count
    section_count=$(grep -cE "^##.*(Gate Prompt|Evaluation Criteria|Gate Condition)" "$filepath" 2>/dev/null | tr -d '\r\n')
    section_count=${section_count:-0}
    if [ "$section_count" -gt 2 ]; then
      c8="WARN"; d8="${gate_hits} verdict refs + ${section_count} gate sections (possible inline prompt)"; warn_reasons+=("Inline gate: $d8")
    else
      d8="${gate_hits} verdict refs (acceptable — reference only)"
    fi
  else
    d8="clean"
  fi

  # ---- Overall result --------------------------------------------------
  local result="COMPLIANT"
  local has_fail=false; local has_warn=false

  for r in "$c1" "$c2" "$c3" "$c4" "$c6" "$c7"; do
    [[ "$r" == "FAIL" ]] && has_fail=true
  done
  for r in "$c1" "$c3" "$c4" "$c5" "$c8"; do
    [[ "$r" == "WARN" ]] && has_warn=true
  done

  if $has_fail; then
    result="FAIL"; FAIL=$((FAIL + 1)); FAILED_NAMES+=("$name")
  elif $has_warn; then
    result="WARN"; WARN=$((WARN + 1)); WARNED_NAMES+=("$name")
  else
    PASS=$((PASS + 1))
  fi

  # ---- Write to markdown report ----------------------------------------
  echo "| $TOTAL | $name | $c1 | $c2 | $c3 | $c4 | $c5 | $c6 | $c7 | $c8 | **$result** |" >> "$REPORT"

  # ---- Display to stdout -----------------------------------------------
  if $SKIP_TO_SUMMARY; then
    return
  fi

  if [ "$MODE" = "step" ]; then
    # Detailed box per skill
    local icon
    case "$result" in
      COMPLIANT) icon="${GREEN}✓ COMPLIANT${NC}" ;;
      WARN)      icon="${YELLOW}⚠ WARN${NC}" ;;
      FAIL)      icon="${RED}✗ FAIL${NC}" ;;
    esac

    echo -e "${DIM}────────────────────────────────────────────────${NC}"
    echo -e "  ${BOLD}${name}${NC}  ${DIM}[${TOTAL}]${NC}"
    echo -e "${DIM}────────────────────────────────────────────────${NC}"

    _check_line() {
      local status="$1" label="$2" detail="$3"
      case "$status" in
        PASS) echo -e "  ${TICK} $label${DIM}: $detail${NC}" ;;
        WARN) echo -e "  ${WARN_ICON} $label${DIM}: $detail${NC}" ;;
        FAIL) echo -e "  ${CROSS} $label${DIM}: $detail${NC}" ;;
      esac
    }

    _check_line "$c1" "Frontmatter " "$d1"
    _check_line "$c2" "Fields      " "$d2"
    _check_line "$c3" "Model       " "$d3"
    _check_line "$c4" "Version     " "$d4"
    _check_line "$c5" "skill_id    " "$d5"
    _check_line "$c6" "Description " "$d6"
    _check_line "$c7" "Location    " "$d7"
    _check_line "$c8" "No inline   " "$d8"

    echo ""
    echo -e "  Result: $icon"

    if [ ${#fail_reasons[@]} -gt 0 ]; then
      echo ""
      echo -e "  ${RED}Issues to fix:${NC}"
      for r in "${fail_reasons[@]}"; do
        echo -e "    ${RED}→${NC} $r"
      done
    fi

    echo ""
    # Only prompt if stdin is a TTY
    if [ -t 0 ]; then
      read -r -p "  Press Enter to continue, 'q' to quit, 's' to skip to summary... " step_input
      case "$step_input" in
        q|Q) echo ""; echo -e "${YELLOW}Aborted by user.${NC}"; print_final_results; exit 0 ;;
        s|S) SKIP_TO_SUMMARY=true ;;
      esac
    fi

  else
    # Compact batch line
    case "$result" in
      COMPLIANT) echo -e "  ${GREEN}[OK]${NC}   $name" ;;
      WARN)      echo -e "  ${YELLOW}[WARN]${NC} $name${DIM} — $(IFS='; '; echo "${warn_reasons[*]:-minor warnings}")${NC}" ;;
      FAIL)      echo -e "  ${RED}[FAIL]${NC} $name${DIM} — $(IFS='; '; echo "${fail_reasons[*]}")${NC}" ;;
    esac
  fi
}

# ---------------------------------------------------------------------------
# print_final_results — always shown at end
# ---------------------------------------------------------------------------
print_final_results() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║           ADF TEST RESULTS               ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo -e "  Total tested : ${BOLD}$TOTAL${NC}"
  echo -e "  ${GREEN}✓ Compliant${NC}  : $PASS"
  echo -e "  ${YELLOW}⚠ Warnings${NC}   : $WARN"
  echo -e "  ${RED}✗ Failures${NC}   : $FAIL"

  if [ ${#WARNED_NAMES[@]} -gt 0 ]; then
    echo ""
    echo -e "  ${YELLOW}Warnings:${NC}"
    for n in "${WARNED_NAMES[@]}"; do echo -e "    • $n"; done
  fi

  if [ ${#FAILED_NAMES[@]} -gt 0 ]; then
    echo ""
    echo -e "  ${RED}Failures:${NC}"
    for n in "${FAILED_NAMES[@]}"; do echo -e "    • $n"; done
    echo ""
    echo -e "  ${BOLD}Fix with:${NC}"
    for n in "${FAILED_NAMES[@]}"; do
      echo -e "    ${CYAN}/skill-improve $n${NC}"
    done
  fi

  if $SHOW_AUDIT && [ -f "$CATALOG" ]; then
    echo ""
    echo -e "  ${BOLD}Spec Coverage (catalog.yaml):${NC}"
    local total_entries written_count pending_count
    total_entries=$(grep -c "spec_status:" "$CATALOG" 2>/dev/null || echo 0)
    written_count=$(grep -c "spec_status: written" "$CATALOG" 2>/dev/null || echo 0)
    pending_count=$(grep -c "spec_status: pending" "$CATALOG" 2>/dev/null || echo 0)
    echo -e "    Total  : $total_entries"
    echo -e "    ${GREEN}Written${NC}: $written_count"
    echo -e "    ${YELLOW}Pending${NC}: $pending_count"
  fi

  echo ""
  echo -e "  Report : ${DIM}$REPORT${NC}"
  echo -e "  Latest : ${DIM}$LATEST${NC}"

  if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo -e "  ${RED}${BOLD}Result: FAIL${NC} — $FAIL skill(s) need fixing"
  elif [ "$WARN" -gt 0 ]; then
    echo ""
    echo -e "  ${YELLOW}${BOLD}Result: WARN${NC} — all pass but $WARN have minor issues"
  else
    echo ""
    echo -e "  ${GREEN}${BOLD}Result: ALL PASS${NC} — framework is fully compliant"
  fi
  echo ""

  # Append summary to report
  {
    echo ""
    echo "## Final Results"
    echo "- Total: $TOTAL"
    echo "- Compliant: $PASS"
    echo "- Warnings: $WARN"
    echo "- Failures: $FAIL"
    if [ ${#FAILED_NAMES[@]} -gt 0 ]; then
      echo ""
      echo "### Failing"
      for n in "${FAILED_NAMES[@]}"; do echo "- $n"; done
      echo ""
      echo "### Fix Commands"
      echo '```'
      for n in "${FAILED_NAMES[@]}"; do echo "/skill-improve $n"; done
      echo '```'
    fi
  } >> "$REPORT"
}

# ---------------------------------------------------------------------------
# Run — skills first, then agents
# ---------------------------------------------------------------------------
if [ "$MODE" = "batch" ]; then
  echo -e "${BLUE}Skills:${NC}"
fi

while IFS= read -r -d '' skill_file; do
  skill_name=$(basename "$(dirname "$skill_file")")
  # External-skill guard: a directory under skills/ that is NOT registered in
  # catalog.yaml is vendored/external (same rule as retrofit-frontmatter.sh).
  # External skills are never graded against ADF frontmatter standards.
  if ! grep -E "^  name: ${skill_name}[[:space:]]*$" "$CATALOG" >/dev/null 2>&1; then
    echo -e "  ${DIM}[EXT]  $skill_name — not in catalog.yaml (external), skipped${NC}"
    continue
  fi
  check_file "$skill_file" "$skill_name" "skills/[^/]+/skill\.md"
done < <(find "$SKILLS_DIR" -maxdepth 2 -iname "skill.md" -print0 2>/dev/null | sort -z)

if [ "$MODE" = "step" ] && ! $SKIP_TO_SUMMARY; then
  echo -e "${DIM}────────────────────────────────────────────────${NC}"
  echo -e "  ${BLUE}All skills done. Moving to agents...${NC}"
  echo -e "${DIM}────────────────────────────────────────────────${NC}"
  if [ -t 0 ]; then
    read -r -p "  Press Enter to continue or 'q' to quit... " step_input
    case "$step_input" in q|Q) print_final_results; exit 0 ;; esac
  fi
  echo ""
elif [ "$MODE" = "batch" ]; then
  echo ""
  echo -e "${BLUE}Agents:${NC}"
fi

while IFS= read -r -d '' agent_file; do
  agent_name=$(basename "$agent_file" .md)
  check_file "$agent_file" "$agent_name" "agents/[^/]+\.md"
done < <(find "$AGENTS_DIR" -maxdepth 1 -name "*.md" -print0 2>/dev/null | sort -z)

# ---------------------------------------------------------------------------
# Copy report + print final results
# ---------------------------------------------------------------------------
cp "$REPORT" "$LATEST"
print_final_results

# Exit 1 if any failures
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
