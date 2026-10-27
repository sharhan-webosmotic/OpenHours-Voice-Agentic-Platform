#!/usr/bin/env bash
# =============================================================================
# skill-lab — Auto-Trigger Test Runner
# =============================================================================
# Tests whether each skill's frontmatter `description:` is distinctive enough
# that natural-language user prompts reliably route to the correct skill.
#
# For each skill, 20 prompts from its .trigger.yaml are classified by a
# subagent that sees ONLY frontmatter (name + description) of all skills —
# mirroring how Claude actually routes. Pass threshold: >=18/20 correct.
#
# Usage:
#   bash run-trigger-tests.sh --skill NAME     — test one skill
#   bash run-trigger-tests.sh --all            — test every skill with a .trigger.yaml
#   bash run-trigger-tests.sh --resume         — continue an interrupted --all run
#   bash run-trigger-tests.sh --from NAME      — start --all from a specific skill
#   bash run-trigger-tests.sh --step           — pause after each skill
#   bash run-trigger-tests.sh --dry-run        — show what would run, no API calls
#
# Dependencies: python + PyYAML (via yaml_helper.py), claude CLI.
# Override the classifier for testing: ADF_TRIGGER_CLASSIFIER=./mock.sh
#
# Output:
#   results/trigger-YYYY-MM-DD.md       — per-skill score table
#   results/trigger-progress.json       — resume state (updated after each skill)
#   results/trigger-catalog-cache.txt   — frontmatter excerpts (regenerated if stale)
#   catalog.yaml                        — updated in-place (trigger_* fields per skill)
# =============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/skills"
CATALOG="$SCRIPT_DIR/catalog.yaml"
SPEC_ROOT="$SCRIPT_DIR/skills"
# ADF_RESULTS_DIR lets parallel runs use isolated dirs (avoids catalog-cache / progress races).
RESULTS_DIR="${ADF_RESULTS_DIR:-$SCRIPT_DIR/results}"
# ADF_SKIP_PERSIST=1 disables catalog.yaml + meta writes, so concurrent runners don't corrupt it.
SKIP_PERSIST="${ADF_SKIP_PERSIST:-0}"
HELPER="$SCRIPT_DIR/yaml_helper.py"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPORT="$RESULTS_DIR/trigger-$DATE.md"
PROGRESS="$RESULTS_DIR/trigger-progress.json"
CATALOG_CACHE="$RESULTS_DIR/trigger-catalog-cache.txt"

mkdir -p "$RESULTS_DIR"

# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------
TARGET_SKILL=""
RUN_ALL=false
RESUME=false
FROM_SKILL=""
STEP=false
DRY_RUN=false

while [ $# -gt 0 ]; do
  case "$1" in
    --skill)   TARGET_SKILL="$2"; shift 2 ;;
    --all)     RUN_ALL=true; shift ;;
    --resume)  RESUME=true; RUN_ALL=true; shift ;;
    --from)    FROM_SKILL="$2"; RUN_ALL=true; shift 2 ;;
    --step)    STEP=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) sed -n '2,32p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *)         echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$TARGET_SKILL" ] && ! $RUN_ALL; then
  echo "Specify --skill NAME or --all. See --help." >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; DIM=''; NC=''
fi

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------
PY="${PYTHON:-python}"
if ! command -v "$PY" >/dev/null 2>&1; then
  PY=python3
  if ! command -v "$PY" >/dev/null 2>&1; then
    echo -e "${RED}ERROR:${NC} python not found (need 3.7+)." >&2
    exit 3
  fi
fi

if [ ! -f "$HELPER" ]; then
  echo -e "${RED}ERROR:${NC} helper script not found: $HELPER" >&2
  exit 3
fi

# Verify PyYAML
if ! "$PY" -c "import yaml" 2>/dev/null; then
  echo -e "${RED}ERROR:${NC} PyYAML missing. Install: $PY -m pip install pyyaml" >&2
  exit 3
fi

CLASSIFIER="${ADF_TRIGGER_CLASSIFIER:-}"
if [ -z "$CLASSIFIER" ]; then
  if command -v claude >/dev/null 2>&1; then
    CLASSIFIER="claude"
  elif ! $DRY_RUN; then
    echo -e "${RED}ERROR:${NC} claude CLI not found and ADF_TRIGGER_CLASSIFIER not set." >&2
    echo "       Install claude CLI, set ADF_TRIGGER_CLASSIFIER=/path/to/mock.sh, or use --dry-run." >&2
    exit 3
  fi
fi

# Convenience alias for helper calls
yh() { "$PY" "$HELPER" "$@"; }

# ---------------------------------------------------------------------------
# Build frontmatter cache if stale
# ---------------------------------------------------------------------------
build_catalog_cache() {
  local newest_skill=0
  local cache_mtime=0

  if [ -f "$CATALOG_CACHE" ]; then
    cache_mtime=$(stat -c %Y "$CATALOG_CACHE" 2>/dev/null || stat -f %m "$CATALOG_CACHE" 2>/dev/null || echo 0)
  fi

  while IFS= read -r -d '' skill_file; do
    local mtime
    mtime=$(stat -c %Y "$skill_file" 2>/dev/null || stat -f %m "$skill_file" 2>/dev/null || echo 0)
    [ "$mtime" -gt "$newest_skill" ] && newest_skill=$mtime
  done < <(find "$SKILLS_DIR" -maxdepth 2 -iname "SKILL.md" -print0 2>/dev/null)

  if [ "$cache_mtime" -lt "$newest_skill" ] || [ ! -f "$CATALOG_CACHE" ]; then
    echo -e "${DIM}Rebuilding catalog cache...${NC}" >&2
    : > "$CATALOG_CACHE"
    while IFS= read -r -d '' skill_file; do
      local name desc
      name=$(awk '/^name:/ {sub(/^name: */, ""); gsub(/"/, ""); print; exit}' "$skill_file")
      # description may be single-line or start a block scalar
      desc=$(awk '
        /^description:/ {
          sub(/^description: */, "")
          gsub(/^\|[+-]?[0-9]*$/, "")
          gsub(/^>[+-]?[0-9]*$/, "")
          if (length($0) > 0) { gsub(/"/, ""); print; exit }
          in_desc=1
          next
        }
        in_desc {
          if (/^[a-zA-Z_]+:/ || /^---/) exit
          gsub(/^[[:space:]]+/, "")
          gsub(/"/, "")
          printf "%s ", $0
        }
      ' "$skill_file" | tr -s ' ' | sed 's/^ //; s/ $//')
      [ -n "$name" ] && [ -n "$desc" ] && echo "- ${name}: \"${desc}\"" >> "$CATALOG_CACHE"
    done < <(find "$SKILLS_DIR" -maxdepth 2 -iname "SKILL.md" -print0 2>/dev/null | sort -z)
  fi

  local count
  count=$(wc -l < "$CATALOG_CACHE" | tr -d ' ')
  echo -e "${DIM}Catalog cache: $count skills${NC}" >&2
}

# ---------------------------------------------------------------------------
# Classify a single prompt. Returns "SKILL: <name>" or "SKILL: none".
# ---------------------------------------------------------------------------
classify_prompt() {
  local prompt_text="$1"
  local sys_prompt
  sys_prompt=$(cat <<EOF
You are a skill router for the ADF framework. Below are all available skills as (name, description) pairs. Decide which ONE skill would fire for the given user prompt based on the descriptions alone. If none fit, return "none". Respond with exactly ONE line in this format: "SKILL: <name>" or "SKILL: none". No explanation, no prose.

Skills:
$(cat "$CATALOG_CACHE")
EOF
)

  if $DRY_RUN; then
    echo "SKILL: dry-run"
    return
  fi

  if [ "$CLASSIFIER" = "claude" ]; then
    # Critical flags:
    #   --disable-slash-commands   prevents skills from auto-firing on the test prompt itself
    #   --system-prompt            short router contract only (see below)
    #   --tools ""                 no tool use — pure text response
    #   --no-session-persistence   do not pollute session history
    # The full catalog + instructions go via STDIN, not --system-prompt:
    # the catalog excerpt is ~40KB and Windows caps a process command line at
    # ~32,767 chars, so passing it as an argv element makes every spawn fail
    # (which the old code silently mapped to "SKILL: error", scoring 0).
    # Note: --bare would give a cleaner harness but breaks the default auth
    # (it requires ANTHROPIC_API_KEY or apiKeyHelper). Omitted for portability.
    local response
    # The --model pin below is an operational pin for this routing simulator only,
    # not an agent model tag: agent model selection is governed by the inheritance
    # policy, this pin just keeps classifier scoring comparable across runs.
    response=$(printf '%s\n\nUser prompt to route:\n%s\n' "$sys_prompt" "$prompt_text" | claude -p \
      --model claude-sonnet-4-6 \
      --disable-slash-commands \
      --tools "" \
      --no-session-persistence \
      --system-prompt "You are a skill router. Follow the routing instructions in the message. Respond with exactly one line: SKILL: <name> or SKILL: none." \
      2>/dev/null || echo "SKILL: error")
    echo "$response" | grep -oE '^SKILL: [a-zA-Z0-9_-]+' | head -1 || echo "SKILL: none"
  else
    printf '%s\n---\n%s\n' "$sys_prompt" "$prompt_text" | "$CLASSIFIER"
  fi
}

# ---------------------------------------------------------------------------
# Find a skill's .trigger.yaml spec file
# ---------------------------------------------------------------------------
find_trigger_spec() {
  local skill_name="$1"
  local category
  category=$(yh get-category "$skill_name" "$CATALOG")
  if [ -z "$category" ]; then
    return 1
  fi
  local spec_path="$SPEC_ROOT/$category/${skill_name}.trigger.yaml"
  if [ -f "$spec_path" ]; then
    echo "$spec_path"
    return 0
  fi
  return 1
}

# ---------------------------------------------------------------------------
# Test one skill. Returns: 0 = pass, 1 = fail, 2 = skipped.
# ---------------------------------------------------------------------------
test_skill() {
  local skill_name="$1"
  local spec_file
  if ! spec_file=$(find_trigger_spec "$skill_name"); then
    echo -e "  ${YELLOW}[SKIP]${NC} $skill_name ${DIM}— no .trigger.yaml${NC}"
    return 2
  fi

  local n_prompts
  n_prompts=$(yh prompts-count "$spec_file")
  if [ "$n_prompts" != "20" ]; then
    echo -e "  ${YELLOW}[WARN]${NC} $skill_name ${DIM}— expected 20 prompts, found $n_prompts${NC}"
  fi

  echo -e "${DIM}────────────────────────────────────────────────${NC}"
  echo -e "  ${BOLD}${skill_name}${NC} ${DIM}($spec_file)${NC}"

  # Dry-run: list what would be sent, score NOTHING. A scored dry-run is a
  # lie — the old behavior wrote "4/20 FAIL" report rows from fake responses.
  if $DRY_RUN; then
    local di did dbucket dtext
    for di in $(seq 0 $((n_prompts - 1))); do
      did=$(yh read-prompt "$spec_file" "$di" id)
      dbucket=$(yh read-prompt "$spec_file" "$di" bucket)
      dtext=$(yh read-prompt "$spec_file" "$di" text)
      echo -e "    ${DIM}would classify $did [$dbucket]: ${dtext:0:70}${NC}"
    done
    echo -e "  ${YELLOW}DRY-RUN${NC}: $n_prompts prompts, no API calls — nothing scored, reported, or persisted."
    return 2
  fi

  local correct=0
  local errors=0
  declare -a miss_rows=()

  for i in $(seq 0 $((n_prompts - 1))); do
    local id text expected_trigger bucket
    id=$(yh read-prompt "$spec_file" "$i" id)
    text=$(yh read-prompt "$spec_file" "$i" text)
    expected_trigger=$(yh read-prompt "$spec_file" "$i" expected_trigger)
    bucket=$(yh read-prompt "$spec_file" "$i" bucket)

    local returned
    returned=$(classify_prompt "$text" | sed 's/^SKILL: //')

    # A failed classifier CALL is test-infrastructure failure, never a datum.
    # The old code counted "error" as a correct negative (error != skill_name),
    # so a fully broken classifier scored 4/20 and looked like a content bug.
    if [ "$returned" = "error" ]; then
      errors=$((errors + 1))
      echo -e "    ${YELLOW}⚠${NC} $id ${DIM}[$bucket]${NC} -> CLASSIFIER ERROR ${DIM}(call failed — not scored)${NC}"
      miss_rows+=("$id|$bucket|$text|CLASSIFIER-ERROR")
      if [ "$errors" -ge 3 ]; then
        echo -e "  ${RED}ABORTED${NC}: $errors classifier calls failed — infrastructure problem, not a description problem."
        echo -e "  ${DIM}Check: claude CLI on PATH + authenticated. No score recorded for $skill_name.${NC}"
        {
          echo ""
          echo "### $skill_name — ABORTED after $errors classifier errors — no score recorded"
        } >> "$REPORT"
        return 3
      fi
      continue
    fi

    local outcome="incorrect"
    if [ "$expected_trigger" = "true" ] && [ "$returned" = "$skill_name" ]; then
      outcome="correct"
    elif [ "$expected_trigger" = "false" ] && [ "$returned" != "$skill_name" ]; then
      outcome="correct"
    fi

    if [ "$outcome" = "correct" ]; then
      correct=$((correct + 1))
      echo -e "    ${GREEN}✓${NC} $id ${DIM}[$bucket]${NC} -> $returned"
    else
      local expected_str
      if [ "$expected_trigger" = "true" ]; then
        expected_str="$skill_name"
      else
        expected_str="not $skill_name"
      fi
      echo -e "    ${RED}✗${NC} $id ${DIM}[$bucket]${NC} -> $returned ${DIM}(expected: $expected_str)${NC}"
      miss_rows+=("$id|$bucket|$text|$returned")
    fi
  done

  # 1-2 errored calls (below the abort threshold) still invalidate the run:
  # a score over a partial prompt set is not comparable to 18/20.
  if [ "$errors" -gt 0 ]; then
    echo -e "  ${RED}INVALID RUN${NC}: $errors of $n_prompts classifier calls failed — no score recorded."
    {
      echo ""
      echo "### $skill_name — INVALID ($errors classifier errors) — no score recorded"
    } >> "$REPORT"
    return 3
  fi

  local score=$correct
  local verdict="failing"
  local icon="${RED}✗ FAIL${NC}"
  if [ "$score" -ge 18 ]; then
    verdict="passing"
    icon="${GREEN}✓ PASS${NC}"
  fi

  echo -e "  Score: ${BOLD}$score/20${NC}  Result: $icon"

  # Write report row
  {
    echo ""
    echo "### $skill_name — $score/20 $([ "$verdict" = "passing" ] && echo "PASS" || echo "FAIL")"
    if [ ${#miss_rows[@]} -gt 0 ]; then
      echo ""
      echo "Misses:"
      echo ""
      echo "| id | bucket | prompt | classifier returned |"
      echo "|----|--------|--------|---------------------|"
      for m in "${miss_rows[@]}"; do
        IFS='|' read -r mid mbucket mtext mret <<< "$m"
        # Escape pipe chars in prompt text (they'd break the table)
        mtext_esc=$(echo "$mtext" | sed 's/|/\\|/g')
        echo "| $mid | $mbucket | ${mtext_esc:0:80} | $mret |"
      done
    fi
  } >> "$REPORT"

  # Update catalog + progress in place (never reached on dry-run or errored
  # runs — both return earlier, so no bogus score can poison the catalog)
  if [ "$SKIP_PERSIST" != "1" ]; then
    yh update-trigger "$CATALOG" "$skill_name" "$score" "$verdict" "$DATE"
  fi
  yh progress-append "$PROGRESS" "$skill_name" "$score" "$verdict" "$DATE"

  [ "$score" -ge 18 ] && return 0 || return 1
}

# ---------------------------------------------------------------------------
# Progress init
# ---------------------------------------------------------------------------
init_progress() {
  if [ ! -f "$PROGRESS" ] || ! $RESUME; then
    yh progress-init "$PROGRESS" "$TIMESTAMP" "$DATE"
  fi
}

already_done_today() {
  local skill="$1"
  local result
  result=$(yh progress-has "$PROGRESS" "$skill" "$DATE")
  [ "$result" = "yes" ]
}

# ---------------------------------------------------------------------------
# Report init
# ---------------------------------------------------------------------------
init_report() {
  if [ ! -f "$REPORT" ] || ! $RESUME; then
    cat > "$REPORT" <<EOF
# ADF Auto-Trigger Test Report — $DATE

Run started: $TIMESTAMP
Classifier:  $CLASSIFIER
Catalog:     $(wc -l < "$CATALOG_CACHE" 2>/dev/null | tr -d ' ' || echo "?") skills in frontmatter cache

Pass threshold: >=18/20 prompts correctly classified.

EOF
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
build_catalog_cache
init_report
init_progress

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   ADF — Auto-Trigger Test Runner            ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
echo ""

TOTAL=0; PASS=0; FAIL=0; SKIP=0; ERRORED=0
declare -a PASSED=()
declare -a FAILED_LIST=()
declare -a SKIPPED=()
declare -a ERRORED_LIST=()

run_one() {
  local name="$1"
  TOTAL=$((TOTAL + 1))
  local rc=0
  test_skill "$name" || rc=$?
  case $rc in
    0) PASS=$((PASS + 1)); PASSED+=("$name") ;;
    2) SKIP=$((SKIP + 1)); SKIPPED+=("$name"); TOTAL=$((TOTAL - 1)) ;;
    3) ERRORED=$((ERRORED + 1)); ERRORED_LIST+=("$name"); TOTAL=$((TOTAL - 1)) ;;
    *) FAIL=$((FAIL + 1)); FAILED_LIST+=("$name") ;;
  esac
}

if [ -n "$TARGET_SKILL" ]; then
  run_one "$TARGET_SKILL"
else
  started=true
  [ -n "$FROM_SKILL" ] && started=false

  while IFS= read -r skill_name; do
    [ -z "$skill_name" ] && continue

    if ! $started; then
      [ "$skill_name" = "$FROM_SKILL" ] && started=true || continue
    fi

    if $RESUME && already_done_today "$skill_name"; then
      echo -e "  ${DIM}[SKIP-DONE]${NC} $skill_name"
      continue
    fi

    run_one "$skill_name"

    if $STEP && [ -t 0 ]; then
      echo ""
      read -r -p "  Press Enter to continue, 'q' to quit... " step_input
      case "$step_input" in q|Q) break ;; esac
    fi
  done < <(yh list-skills "$CATALOG")
fi

# ---------------------------------------------------------------------------
# Final dashboard
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║             TRIGGER TEST RESULTS            ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
echo -e "  Tested  : ${BOLD}$TOTAL${NC}"
echo -e "  ${GREEN}Passing${NC} : $PASS"
echo -e "  ${RED}Failing${NC} : $FAIL"
echo -e "  ${YELLOW}Skipped${NC} : $SKIP $($DRY_RUN && echo '(dry-run)' || echo '(no .trigger.yaml)')"
if [ "$ERRORED" -gt 0 ]; then
  echo -e "  ${RED}Errored${NC} : $ERRORED (classifier failure — fix the claude CLI/auth and re-run; this is NOT a description problem)"
  for n in "${ERRORED_LIST[@]}"; do echo -e "    • $n ${DIM}(no score recorded)${NC}"; done
fi

if [ ${#FAILED_LIST[@]} -gt 0 ]; then
  echo ""
  echo -e "  ${RED}Failed skills:${NC}"
  for n in "${FAILED_LIST[@]}"; do echo -e "    • $n"; done
  echo ""
  echo -e "  ${BOLD}Fix with:${NC}"
  for n in "${FAILED_LIST[@]}"; do
    echo -e "    ${CYAN}/skill-improve $n${NC}"
  done
fi

# Update meta counters (skip if ADF_SKIP_PERSIST=1 — parallel runs should leave catalog alone)
if ! $DRY_RUN && [ "$SKIP_PERSIST" != "1" ] && [ "$TOTAL" -gt 0 ]; then
  trigger_passing=$(yh count-status passing "$CATALOG")
  trigger_failing=$(yh count-status failing "$CATALOG")
  yh update-meta "$CATALOG" trigger_passing "$trigger_passing"
  yh update-meta "$CATALOG" trigger_failing "$trigger_failing"
  yh update-meta "$CATALOG" last_updated "$DATE"
fi

echo ""
echo -e "  Report   : ${DIM}$REPORT${NC}"
echo -e "  Progress : ${DIM}$PROGRESS${NC}"
echo ""

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
