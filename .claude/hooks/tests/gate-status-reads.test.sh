#!/usr/bin/env bash
# hooks/tests/gate-status-reads.test.sh: Proving test for every hook that reads a
# gate verdict or a lock out of AI_DOCS/memory/gate-status.md.
#
# Control Verification rule (testing-rules Rule 33 family): a control counts as
# proven only when it is driven from OUTSIDE, through its real trigger, with a
# known-bad input, and observed to BLOCK, and then observed to ALLOW the good
# input. gate-status.md is free-form, so each hook is driven with the shapes the
# skills really write AND with the shapes that used to fool a whole-line grep.
#
#   A. enforce-do-routing.sh, Gate 1: compatible with the old whole-line grep,
#      with a negative screen. Every free-form shape the old read accepted still
#      passes (checkboxes, emoji, a name between the id and the status, a date
#      or PHASE-GATE prefix, several gates on one line, notes that say "no open
#      concerns", sub-gates 1A/1B/1C, CRLF). Blocks when the gate's own status
#      is negative: PENDING, FAILED, a negated or struck pass word, PASS/FAIL,
#      a FAILED row whose note says LOCKED, only Gate 1.5 / Gate 10 passed, or
#      one lettered sub-gate still pending. Several mentions: any one passing
#      is enough (the old read), unless a dashboard row exists.
#   B. enforce-ship-gate.sh, Gate 5: the same read with the FIRST mention
#      deciding (the old head -1 read), a dashboard row outranking a changelog
#      row, and LOCKED not a pass.
#   C. design-gate.sh, Gate UX-1: the three documented spellings pass, a PENDING
#      row that contains the word PASS does not.
#   D. enforce-artifact-lock.sh: a RECORDED "SCHEMA LOCKED" arms the lock, a
#      sentence that mentions it does not, LIFTED does not.
#   E. enforce-component-reuse.sh (shell fidelity): the App-shell row's status
#      cell decides, LIFTED wins, a mention does not arm it.
#   F. enforce-api-contract-lock.sh: arms on the shapes the framework writes
#      ("Gate 1 records LOCKED", the dedicated row, the line forms). Does not arm
#      on PENDING, FAILED, LIFTED, another lock's row, or prose.
#   G. enforce-do-routing.sh, path classification and the recorded opt-out: a
#      root *.md is a doc when the path is absolute, a code file whose name
#      starts with README is not, a builder worktree path is routed like any app
#      code, a same-day "## Bypass" heading opens the gate until a
#      "## Resume framework" heading follows it, a heading inside a code fence
#      or saying DENIED does not, and a worktree's OWN AI_DOCS state counts.
#
# Sandbox: a throwaway directory under the project root's AI_DOCS/.temp/ when
# one exists, else the system temp directory. The sandbox project lives in a
# folder whose name contains a space on purpose, and file paths are sent
# absolute, the way Claude Code sends them. jq is not required. Cleans up on
# exit. Exits non-zero on any failed assertion.

set -u

TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$(cd "$TEST_DIR/.." && pwd)"
FRAMEWORK_DIR="$(cd "$TEST_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$FRAMEWORK_DIR/.." && pwd)"

for need in enforce-do-routing.sh enforce-ship-gate.sh design-gate.sh enforce-artifact-lock.sh enforce-component-reuse.sh enforce-api-contract-lock.sh; do
  if [[ ! -f "$HOOKS_DIR/$need" ]]; then
    echo "FATAL: hook not found at $HOOKS_DIR/$need" >&2
    exit 1
  fi
done

if [[ -d "$PROJECT_ROOT/AI_DOCS" ]]; then
  SANDBOX_BASE="$PROJECT_ROOT/AI_DOCS/.temp"
else
  SANDBOX_BASE="${TMPDIR:-/tmp}"
fi
mkdir -p "$SANDBOX_BASE" 2>/dev/null
SANDBOX=$(mktemp -d "$SANDBOX_BASE/gate-status-test.XXXXXX" 2>/dev/null)
if [[ -z "${SANDBOX:-}" || ! -d "$SANDBOX" ]]; then
  echo "FATAL: could not create sandbox under $SANDBOX_BASE" >&2
  exit 1
fi
trap 'rm -rf "$SANDBOX"' EXIT

# The env must not leak overrides or an AI_DOCS override into the hooks.
unset ADF_BYPASS ADF_SHIP_OVERRIDE ADF_DESIGN_UNLOCK ADF_SCHEMA_UNLOCK ADF_AUTHZ_UNLOCK \
      ADF_CONTRACT_UNLOCK ADF_ALLOW_DUP_COMPONENT ADF_FLOW_GATE_BYPASS AI_DOCS CLAUDE_PROJECT_DIR 2>/dev/null

PROJ="$SANDBOX/my proj"
MEM="$PROJ/AI_DOCS/memory"
mkdir -p "$MEM" "$PROJ/AI_DOCS/milestones/M01-x" "$PROJ/AI_DOCS/design" "$PROJ/AI_DOCS/architecture" \
         "$PROJ/AI_DOCS/audit" "$PROJ/src/components/nav" "$PROJ/design-system" "$PROJ/docs"
PROJ_NATIVE="$(cd "$PROJ" && (pwd -W 2>/dev/null || pwd))"
GS="$MEM/gate-status.md"
# Local date: the hooks read decision-log.md dates by the local clock.
TODAY="$(date +%F)"
# Non-ASCII characters the skills write, produced at runtime so this file stays ASCII.
CHECK=$'\xe2\x9c\x85'
ARROW=$'\xe2\x86\x92'
EMDASH=$'\xe2\x80\x94'
GREEN=$'\xf0\x9f\x9f\xa2'
WHITE=$'\xe2\xac\x9c'
CR=$'\r'

cat > "$MEM/task-ledger.md" <<'EOF'
# Task ledger

| Milestone | Title | Status | Progress | Exit gate | Notes |
|---|---|---|---|---|---|
| M01-x | Setup | TODO | 0/1 | Gate-1 PENDING | |
EOF
set_task() {
  cat > "$PROJ/AI_DOCS/milestones/M01-x/tasks.md" <<EOF
# M01 Tasks

| ID | Title | Status | Acceptance | blockedBy | Verify | Notes |
|---|---|---|---|---|---|---|
| T-01 | Build the thing | $1 | works | | | |
EOF
}
: > "$MEM/decision-log.md"
echo "# contract" > "$PROJ/AI_DOCS/architecture/api-contract.md"
echo "# schema" > "$PROJ/AI_DOCS/architecture/database-schema.md"
echo "roles: {}" > "$PROJ/AI_DOCS/architecture/authz-matrix.yaml"

FAILS=0
assert_exit() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS: $desc (exit $actual)"
  else
    echo "FAIL: $desc (expected exit $expected, got $actual)"
    sed 's/^/      stderr| /' "$SANDBOX/err.log" 2>/dev/null | head -6
    FAILS=$((FAILS + 1))
  fi
}

json_escape() {
  local s="$1" bs='\' dq='"'
  s=${s//"$bs"/"$bs$bs"}
  s=${s//"$dq"/"$bs$dq"}
  printf '%s' "$s"
}
# Run an Edit|Write hook against an ABSOLUTE path under the project. $1 hook,
# $2 path relative to the project, $3 "win" to send it with backslashes.
run_edit() {
  local abs="$PROJ_NATIVE/$2"
  if [[ "${3:-}" == "win" ]]; then abs=${abs//\//\\}; fi
  ( cd "$PROJ" && printf '{"session_id":"t","hook_event_name":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"%s","content":"x"}}' \
      "$(json_escape "$abs")" | bash "$HOOKS_DIR/$1" >"$SANDBOX/out.log" 2>"$SANDBOX/err.log" )
  echo $?
}
run_bash() {
  ( cd "$PROJ" && printf '{"session_id":"t","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"%s","description":"run it"}}' \
      "$(json_escape "$2")" | bash "$HOOKS_DIR/$1" >"$SANDBOX/out.log" 2>"$SANDBOX/err.log" )
  echo $?
}
# gs LINE...: write gate-status.md with one line per argument.
gs() { printf '%s\n' "$@" > "$GS"; }
PLAN_HEAD='| Gate | Status | Date | Notes |'
PLAN_SEP='|---|---|---|---|'

# ── A. enforce-do-routing.sh reads Gate 1 ─────────────────────────────────────
echo "== A. enforce-do-routing.sh, Gate 1 (a DOING task exists, non-POC project)"
set_task DOING
a_pass() { local d="$1"; shift; gs "$@"; assert_exit "A pass: $d" 0 "$(run_edit enforce-do-routing.sh src/app.ts)"; }
a_block() { local d="$1"; shift; gs "$@"; assert_exit "A block: $d" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"; }
a_pass  "/plan table, Status PASSED" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | |"
a_pass  "/plan table, Status LOCKED (Gate 1 records LOCKED)" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | LOCKED | $TODAY | |"
a_pass  "row without a header, id spelled Gate-1" "| Gate-1 | Planning Completeness | PASSED | $TODAY |"
a_pass  "line form in lower case: gate 1: approved" "- gate 1: approved ($TODAY)"
a_pass  "Status cell with a leading emoji" "| Gate ID | Gate Name | Status | Approved By |" "|---|---|---|---|" "| Gate 1 | Planning | $CHECK Passed | PD |"
a_pass  "line form with a parenthetical name" "**Gate 1 (Planning Completeness)**: PASSED $TODAY"
a_pass  "line form with an arrow" "Gate 1 $ARROW PASS"
a_block "/plan table, Status PENDING" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PENDING | - | |"
a_block "FAILED row whose note contains the word LOCKED" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | FAILED | - | api-contract not LOCKED yet |"
a_block "PENDING (not APPROVED)" "| Gate 1 | Planning Completeness | PENDING (not APPROVED) |"
a_block "Gate 1: NOT PASSED" "Gate 1: NOT PASSED"
a_block "only Gate 1.5 and Gate 10 passed" "| Gate 1.5 | PASSED |" "| Gate 10 | PASSED |"
a_pass  "another gate's row whose note says Gate 1: PASSED (the old read accepted it)" "| Gate 2 | PASSED | after Gate 1: PASSED review |"
a_pass  "any passing mention is enough, as in the old read" "Gate 1: PASSED" "Gate 1: PENDING (regressed by CR-3)"
a_pass  "task-list checkbox" "- [x] Gate 1: PASSED"
a_pass  "leading tick emoji" "$CHECK Gate 1: PASSED"
a_pass  "leading 4-byte emoji" "$GREEN Gate 1: PASSED"
a_pass  "name between id and status, em dash" "Gate 1: Planning Completeness $EMDASH PASSED"
a_pass  "date prefix" "$TODAY Gate 1 PASSED"
a_pass  "PHASE-GATE prefix" "PHASE-GATE (Gate 1): APPROVED $TODAY"
a_pass  "Gate 1 is PASSED" "Gate 1 is PASSED"
a_pass  "several gates on one line" "Gate 0: PASSED, Gate 1: PASSED, Gate 2: PENDING"
a_pass  "Status cell with a qualifier" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | User APPROVED | $TODAY | |"
a_pass  "bare tick in Status, PASSED in Notes" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | $CHECK | $TODAY | PASSED |"
a_pass  "a notes cell that says pending never overrides the Status cell" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | 2 items pending in M2 |"
a_pass  "a later note line: no open concerns" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | |" "" "- Gate 1: no open concerns, approved by solutions-architect"
a_pass  "newest-first history" "- $TODAY: Gate 1 PASSED" "- 2026-07-20: Gate 1 FAILED (api contract missing)"
a_pass  "only lettered sub-gates, all passed" "| Gate ID | Gate Name | Status |" "|---|---|---|" "| Gate 1A | PRD Draft | $CHECK Passed |" "| Gate 1C | PRD Final Approval | $CHECK Passed |"
a_pass  "CRLF line endings" "$PLAN_HEAD$CR" "$PLAN_SEP$CR" "| Gate 1 | PASSED | $TODAY | |$CR"
a_block "a legend, not a verdict: Gate 1: PASS/FAIL" "Gate 1: PASS/FAIL"
a_block "struck-through pass word" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | ~~PASSED~~ FAILED | $TODAY | |"
a_block "Gate 1: PENDING (was PASSED before CR-4)" "Gate 1: PENDING (was PASSED before CR-4)"
a_block "one lettered sub-gate still pending" "| Gate ID | Gate Name | Status |" "|---|---|---|" "| Gate 1A | PRD Draft | $CHECK Passed |" "| Gate 1B | PRD Review | $WHITE Pending |"
rm -f "$GS"
assert_exit "A block: gate-status.md missing" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"

# ── B. enforce-ship-gate.sh reads Gate 5 ──────────────────────────────────────
echo "== B. enforce-ship-gate.sh, Gate 5 (audit verdict is PASS)"
printf '# Audit\n**Verdict:** PASS\n' > "$PROJ/AI_DOCS/audit/audit-report.md"
b_pass() { local d="$1"; shift; gs "$@"; assert_exit "B pass: $d" 0 "$(run_bash enforce-ship-gate.sh 'vercel --prod')"; }
b_block() { local d="$1"; shift; gs "$@"; assert_exit "B block: $d" 2 "$(run_bash enforce-ship-gate.sh 'vercel --prod')"; }
b_pass  "/plan table, Status PASSED" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 5 | PASSED | $TODAY | |"
b_pass  "Gate 5 (Production Sign-off) arrow PASS" "Gate 5 (Production Sign-off) $ARROW PASS"
b_pass  "Gate 5: APPROVED" "Gate 5: APPROVED"
b_block "PENDING row whose note says must be PASSED" "| Gate 5 | Scope Closure | PENDING | must be PASSED before /ship |"
b_block "NOT APPROVED" "| Gate 5 | Scope Closure | NOT APPROVED |"
b_block "Gate 5: FAILED" "Gate 5: FAILED"
b_block "LOCKED is not a pass for Gate 5" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 5 | LOCKED | $TODAY | |"
b_block "dashboard row Pending outranks a later changelog row PASSED" "| Gate ID | Gate Name | Status | Approved By | Date | Notes |" "|---|---|---|---|---|---|" "| Gate 5 | Production Sign-off | $WHITE Pending | - | - | - |" "" "| Date | Gate | Action | By |" "|---|---|---|---|" "| 2026-09-25 | Gate 5 | PASSED | AI |"
b_block "the first mention decides: PENDING, then an old PASSED in history" "Gate 5: PENDING" "" "## History" "- Gate 5 PASSED for v1.0 on 2026-06-01"
b_pass  "task-list checkbox" "- [x] Gate 5: PASSED"
rm -f "$PROJ/AI_DOCS/audit/audit-report.md"

# ── C. design-gate.sh reads Gate UX-1 ─────────────────────────────────────────
echo "== C. design-gate.sh, Gate UX-1 (ux-brief.md exists)"
echo "# ux" > "$PROJ/AI_DOCS/design/ux-brief.md"
c_pass() { local d="$1"; shift; gs "$@"; assert_exit "C pass: $d" 0 "$(run_edit design-gate.sh design-system/tokens.json)"; }
c_block() { local d="$1"; shift; gs "$@"; assert_exit "C block: $d" 2 "$(run_edit design-gate.sh design-system/tokens.json)"; }
c_pass  "Gate UX-1: PASS" "Gate UX-1: PASS"
c_pass  "UX-1 PASS" "UX-1 PASS"
c_pass  "G_UX1 = PASS" "G_UX1 = PASS"
c_pass  "table row, Status PASS" "$PLAN_HEAD" "$PLAN_SEP" "| Gate UX-1 | PASS | $TODAY | |"
c_pass  "leading tick emoji" "$CHECK Gate UX-1: PASS"
c_pass  "name between id and status" "Gate UX-1: UX Structure Validated $EMDASH PASS"
c_block "PENDING row that contains the word PASS" "| Gate UX-1 | PENDING | must PASS before any color/tokens |"
c_block "Gate UX-1: PENDING" "Gate UX-1: PENDING"
c_block "only Gate UX-0 passed" "Gate UX-0: PASS"
rm -f "$PROJ/AI_DOCS/design/ux-brief.md"

# ── D. enforce-artifact-lock.sh reads the lock markers ────────────────────────
echo "== D. enforce-artifact-lock.sh"
gs "SCHEMA LOCKED $TODAY"
assert_exit "D block: a recorded SCHEMA LOCKED line freezes database-schema.md" 2 "$(run_edit enforce-artifact-lock.sh AI_DOCS/architecture/database-schema.md)"
assert_exit "D allow: authz-matrix.yaml is not locked by the schema marker" 0 "$(run_edit enforce-artifact-lock.sh AI_DOCS/architecture/authz-matrix.yaml)"
gs "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | SCHEMA LOCKED, AUTHZ MATRIX LOCKED |"
assert_exit "D block: AUTHZ MATRIX LOCKED recorded in the Gate 1 notes cell" 2 "$(run_edit enforce-artifact-lock.sh AI_DOCS/architecture/authz-matrix.yaml)"
gs "Schema: will be marked SCHEMA LOCKED at Gate 1 (currently DRAFT)."
assert_exit "D allow: a sentence that only mentions SCHEMA LOCKED" 0 "$(run_edit enforce-artifact-lock.sh AI_DOCS/architecture/database-schema.md)"
gs "SCHEMA LOCKED, LIFTED $TODAY (CR-007)"
assert_exit "D allow: the marker line says LIFTED" 0 "$(run_edit enforce-artifact-lock.sh AI_DOCS/architecture/database-schema.md)"
gs "| App-shell lock | Track H | SHELL LOCKED ($TODAY) |"
assert_exit "D allow: another lock's row does not freeze the schema" 0 "$(run_edit enforce-artifact-lock.sh AI_DOCS/architecture/database-schema.md)"

# ── E. enforce-component-reuse.sh, shell fidelity ─────────────────────────────
echo "== E. enforce-component-reuse.sh (a NEW NavBar component)"
gs "| App-shell lock | Track H | SHELL LOCKED ($TODAY) |"
assert_exit "E block: App-shell row is LOCKED" 2 "$(run_edit enforce-component-reuse.sh src/components/nav/NavBar.tsx)"
gs "SHELL LOCKED $TODAY"
assert_exit "E block: the appended SHELL LOCKED line, no row" 2 "$(run_edit enforce-component-reuse.sh src/components/nav/NavBar.tsx)"
gs "| App-shell lock | Track H | LIFTED (CR-9, was SHELL LOCKED) |"
assert_exit "E allow: the App-shell row is LIFTED" 0 "$(run_edit enforce-component-reuse.sh src/components/nav/NavBar.tsx)"
gs 'App shell: not locked yet. /do Stage 0 will append "SHELL LOCKED" after the craft review.'
assert_exit "E allow: a sentence that only mentions SHELL LOCKED" 0 "$(run_edit enforce-component-reuse.sh src/components/nav/NavBar.tsx)"

# ── F. enforce-api-contract-lock.sh ───────────────────────────────────────────
echo "== F. enforce-api-contract-lock.sh"
f_block() { local d="$1"; shift; gs "$@"; assert_exit "F block: $d" 2 "$(run_edit enforce-api-contract-lock.sh AI_DOCS/architecture/api-contract.md)"; }
f_allow() { local d="$1"; shift; gs "$@"; assert_exit "F allow: $d" 0 "$(run_edit enforce-api-contract-lock.sh AI_DOCS/architecture/api-contract.md)"; }
f_block "/plan table, Gate 1 Status LOCKED" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | LOCKED | $TODAY | |"
f_block "Gate 1 PASSED with api-contract.md LOCKED in the notes" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | api-contract.md LOCKED |"
f_block "dedicated row, status in the third cell" "| api-contract.md lock | Gate 1 | LOCKED | $TODAY |"
f_block "dedicated row, status in the second cell" "| api-contract.md lock | LOCKED | $TODAY | unlock via /change-request |"
f_block "line form: api-contract.md: LOCKED" "- api-contract.md: LOCKED ($TODAY)"
f_block "line form: Gate 1: LOCKED" "Gate 1: LOCKED ($TODAY)"
f_allow "Gate 1 PASSED, nothing says LOCKED" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | |"
f_allow "Gate 1 PENDING, note says will be LOCKED" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PENDING | - | will be LOCKED at pass |"
f_allow "Gate 1 FAILED, note says not LOCKED yet" "| Gate 1 | FAILED | - | api-contract not LOCKED yet |"
f_allow "the dedicated row is LIFTED while Gate 1 still says LOCKED" "| Gate 1 | LOCKED | $TODAY |" "| api-contract.md lock | CR-007 | LIFTED |"
f_block "API Contract: LOCKED <date> (the tech-specification line)" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | |" "" "API Contract: LOCKED $TODAY"
f_allow "the LIFTED row on the first line, LOCKED records below it" "| api-contract.md lock | CR-008 | LIFTED |" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | api-contract.md LOCKED |" "" "API Contract: LOCKED $TODAY"
f_allow "the LIFTED row inside the gate table, a LOCKED line below it" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | |" "| api-contract.md lock | CR-009 | LIFTED |" "" "- api-contract.md: LOCKED ($TODAY)"
f_block "the dedicated row restored to LOCKED" "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | |" "| api-contract.md lock | CR-009 | LOCKED |"
f_allow "another lock's row only (D-022)" "| App-shell lock | Track H | SHELL LOCKED ($TODAY) |"
f_allow "a sentence about the lock" "api-contract.md is locked once Gate 1 records LOCKED."
rm -f "$GS"
assert_exit "F allow: gate-status.md missing" 0 "$(run_edit enforce-api-contract-lock.sh AI_DOCS/architecture/api-contract.md)"

# ── G. enforce-do-routing.sh: path classification and the recorded opt-out ────
echo "== G. enforce-do-routing.sh, path classification and recorded opt-out"
gs "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | |"
set_task TODO
assert_exit "G block: app code with no DOING task" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"
assert_exit "G block: the same path sent with backslashes" 2 "$(run_edit enforce-do-routing.sh src/app.ts win)"
assert_exit "G allow: root CLAUDE.md sent as an absolute path" 0 "$(run_edit enforce-do-routing.sh CLAUDE.md win)"
assert_exit "G allow: docs/README.md (doc basename in a subfolder)" 0 "$(run_edit enforce-do-routing.sh docs/README.md)"
assert_exit "G block: src/READMEParser.ts is code, not a doc" 2 "$(run_edit enforce-do-routing.sh src/READMEParser.ts)"
assert_exit "G block: docs/notes.md is not a ROOT doc" 2 "$(run_edit enforce-do-routing.sh docs/notes.md)"
assert_exit "G allow: a framework file under .claude/" 0 "$(run_edit enforce-do-routing.sh .claude/hooks/x.sh)"
assert_exit "G block: builder worktree app code with no DOING task" 2 "$(run_edit enforce-do-routing.sh .claude/worktrees/agent-a1/src/app.ts)"
assert_exit "G allow: memory file inside the builder worktree" 0 "$(run_edit enforce-do-routing.sh .claude/worktrees/agent-a1/AI_DOCS/memory/notes.md)"
set_task DOING
assert_exit "G allow: builder worktree app code, DOING task in the main checkout" 0 "$(run_edit enforce-do-routing.sh .claude/worktrees/agent-a1/src/app.ts)"
set_task TODO
printf '## Bypass %s 10:00\nUser said: skip the framework\n' "$TODAY" > "$MEM/decision-log.md"
assert_exit "G allow: a ## Bypass entry dated today, no env var" 0 "$(run_edit enforce-do-routing.sh src/app.ts)"
printf '## Resume framework %s\n' "$TODAY" >> "$MEM/decision-log.md"
assert_exit "G block: a later ## Resume framework entry closes it again" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"
printf '## Bypass 2000-01-01 10:00\nUser said: freestyle\n' > "$MEM/decision-log.md"
assert_exit "G block: a ## Bypass entry with an old date" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"
printf '## Bypass ADF_SHELL_UNLOCK %s: shell change\n' "$TODAY" > "$MEM/decision-log.md"
assert_exit "G block: another control's override record is not the framework opt-out" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"
FENCE='```'
printf 'Template:\n\n%s\n## Bypass %s 10:00\nUser said: <phrase>\n%s\n' "$FENCE" "$TODAY" "$FENCE" > "$MEM/decision-log.md"
assert_exit "G block: a ## Bypass template inside a fenced code block" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"
printf '## Bypass DENIED %s\nUser said no.\n' "$TODAY" > "$MEM/decision-log.md"
assert_exit "G block: ## Bypass DENIED dated today" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"
printf 'We discussed a Bypass on %s but the user declined.\n' "$TODAY" > "$MEM/decision-log.md"
assert_exit "G block: a prose line that mentions a Bypass" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"
printf '## Bypass %s 09:00\nUser said: freestyle\n\n## Bypass ended %s 11:00\n' "$TODAY" "$TODAY" > "$MEM/decision-log.md"
assert_exit "G block: a later ## Bypass ended heading closes it" 2 "$(run_edit enforce-do-routing.sh src/app.ts)"
printf '## Bypass %s 10:00%s\nUser said: skip the framework%s\n' "$TODAY" "$CR" "$CR" > "$MEM/decision-log.md"
assert_exit "G allow: a CRLF decision-log with a ## Bypass heading dated today" 0 "$(run_edit enforce-do-routing.sh src/app.ts)"
: > "$MEM/decision-log.md"
# A session that runs inside a worktree keeps its DOING row and Gate 1 in the
# worktree's own AI_DOCS while the main checkout is idle.
WT="$PROJ/.claude/worktrees/feature-x"
mkdir -p "$WT/AI_DOCS/memory" "$WT/AI_DOCS/milestones/M01-x" "$WT/src"
printf '%s\n' "$PLAN_HEAD" "$PLAN_SEP" "| Gate 1 | PASSED | $TODAY | |" > "$WT/AI_DOCS/memory/gate-status.md"
printf '| ID | Title | Status |\n|---|---|---|\n| T-09 | Feature X | DOING |\n' > "$WT/AI_DOCS/milestones/M01-x/tasks.md"
assert_exit "G allow: worktree app code, DOING and Gate 1 in the worktree's own AI_DOCS" 0 "$(run_edit enforce-do-routing.sh .claude/worktrees/feature-x/src/app.ts)"
printf '| ID | Title | Status |\n|---|---|---|\n| T-09 | Feature X | TODO |\n' > "$WT/AI_DOCS/milestones/M01-x/tasks.md"
assert_exit "G block: worktree app code, no DOING in the main checkout or the worktree" 2 "$(run_edit enforce-do-routing.sh .claude/worktrees/feature-x/src/app.ts)"

echo ""
if [[ $FAILS -eq 0 ]]; then
  echo "RESULT: ALL ASSERTIONS PASSED (both directions proven)"
  exit 0
else
  echo "RESULT: $FAILS ASSERTION(S) FAILED"
  exit 1
fi
