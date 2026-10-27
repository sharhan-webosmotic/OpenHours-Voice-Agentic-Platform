#!/usr/bin/env bash
# hooks/tests/enforce-flow-gate.test.sh: Proving test for hooks/enforce-flow-gate.sh.
#
# Control Verification rule (testing-rules Rule 33 family): a control counts as
# proven only when it is driven from OUTSIDE, through its real trigger, with a
# known-bad input, and observed to BLOCK, and then observed to ALLOW the good
# input. This test does both directions plus the audited regression cases:
#
#   1. BLOCKS: a DOING capsule task tagged flow:flow-test-a whose plan row is
#      pending exits 2, WITH a ledger milestone-summary DOING row present the
#      whole time (proves the ledger row no longer short-circuits the capsule scan).
#   2. BLOCKS: a flow NAMED "Approved vendor onboarding" with Status pending
#      exits 2 (proves the name cannot fool the Status-cell parse), reached via
#      a second DOING row (proves every DOING row is collected, not just the first).
#   3. ALLOWS: flipping the Status cell to approved exits 0.
#   4. ALLOWS: Status waived exits 0.
#   5. ALLOWS: a Notes cell saying "workflow: cleanup" with no real flow tag
#      exits 0 (proves the anchored tag regex).
#   6. BLOCKS: ADF_FLOW_GATE_BYPASS=on with no recorded decision-log line exits 2.
#   7. BLOCKS: a bypass line recorded with a STALE date exits 2 (same-day scoping).
#   8. ALLOWS: a bypass line naming ADF_FLOW_GATE_BYPASS with today's UTC date exits 0.
#   9. ALLOWS: ADF_BYPASS=on recorded the same same-day way exits 0.
#  10. ALLOWS: the same-day record with NO variable set exits 0. A variable
#      exported from a Bash call never reaches the hook, so the record has to be
#      sufficient on its own. Cases 6 and 9a still prove that the variable
#      WITHOUT a record blocks, so the record stays the requirement.
#  11. BLOCKS: a stale-dated record with no variable set exits 2.
#  12. ALLOWS then BLOCKS: the CLAUDE.md Section 1 "## Bypass" entry dated today
#      exits 0, and a later "## Resume framework" entry closes it again.
#  13. BLOCKS: the same pending flow edited through a builder worktree path
#      (.claude/worktrees/<name>/src/app.ts) exits 2. The path contains
#      "/.claude/", which used to exempt it.
#  14. BLOCKS and ALLOWS: src/READMEParser.ts is app code, README.md is a doc.
#  15. BLOCKS then ALLOWS: a same-day line that only mentions the variables does
#      not open the gate without the variable, and does with it.
#  16. BLOCKS: a ## Bypass heading inside a fenced code block, ## Bypass DENIED,
#      a later ## Bypass ended, and ## Resume framework after a heading that
#      names ADF_BYPASS.
#  17. ALLOWS then BLOCKS: a worktree's own AI_DOCS approving the flow allows an
#      edit inside that worktree, a worktree without its own state still blocks.
# "Today" is the LOCAL date throughout (cases 8 onward).
#
# Sandbox: a throwaway directory under the project root's AI_DOCS/.temp/ when
# one exists, else the system temp directory (the case when run in the framework
# repo itself). The hook is invoked exactly as the harness invokes it: cwd at
# the sandbox project root, tool JSON on stdin, relative app-code file path.
# Cleans up on exit. Exits non-zero on any failed assertion.

set -u

TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$TEST_DIR/../enforce-flow-gate.sh"
FRAMEWORK_DIR="$(cd "$TEST_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$FRAMEWORK_DIR/.." && pwd)"

if [[ ! -f "$HOOK" ]]; then
  echo "FATAL: hook not found at $HOOK" >&2
  exit 1
fi

# Sandbox base: AI_DOCS/.temp/ when the surrounding project has an AI_DOCS,
# system temp otherwise (this repo is the framework itself and has none).
if [[ -d "$PROJECT_ROOT/AI_DOCS" ]]; then
  SANDBOX_BASE="$PROJECT_ROOT/AI_DOCS/.temp"
else
  SANDBOX_BASE="${TMPDIR:-/tmp}"
fi
mkdir -p "$SANDBOX_BASE" 2>/dev/null
SANDBOX=$(mktemp -d "$SANDBOX_BASE/flow-gate-test.XXXXXX" 2>/dev/null)
if [[ -z "${SANDBOX:-}" || ! -d "$SANDBOX" ]]; then
  echo "FATAL: could not create sandbox under $SANDBOX_BASE" >&2
  exit 1
fi
trap 'rm -rf "$SANDBOX"' EXIT

# The env must not leak bypasses or an AI_DOCS override into the hook.
unset ADF_FLOW_GATE_BYPASS ADF_BYPASS AI_DOCS 2>/dev/null

PROJ="$SANDBOX/proj"
mkdir -p "$PROJ/AI_DOCS/memory" "$PROJ/AI_DOCS/design" "$PROJ/AI_DOCS/milestones/M01-x" "$PROJ/src"

# Simulated PreToolUse stdin for an app-code Edit (same shape enforce-do-routing.sh
# parses: .tool_input.file_path). Relative path, cwd is the sandbox project root.
EDIT_JSON='{"tool_name":"Edit","tool_input":{"file_path":"src/app.ts","old_string":"a","new_string":"b"}}'

# The ledger milestone-summary DOING row (never carries a flow tag). Present in
# every case: the audited defect was this row short-circuiting the capsule scan.
cat > "$PROJ/AI_DOCS/memory/task-ledger.md" <<'EOF'
# Task Ledger

| Milestone | Title | Status | % done | Exit gate |
|---|---|---|---|---|
| M01 | Core checkout | DOING | 40% | PENDING |
EOF

: > "$PROJ/AI_DOCS/memory/decision-log.md"

write_tasks_flow_a() {
  cat > "$PROJ/AI_DOCS/milestones/M01-x/tasks.md" <<'EOF'
# M01 Tasks

| ID | Title | Acceptance | Status | blockedBy | Verify | Notes |
|---|---|---|---|---|---|---|
| T-01 | Build checkout screen | renders | DOING | | | flow:flow-test-a |
EOF
}

# Two DOING rows: the first has no tag, the tag lives on the SECOND row. Proves
# collection does not stop at the first DOING row found.
write_tasks_flow_vendor() {
  cat > "$PROJ/AI_DOCS/milestones/M01-x/tasks.md" <<'EOF'
# M01 Tasks

| ID | Title | Acceptance | Status | blockedBy | Verify | Notes |
|---|---|---|---|---|---|---|
| T-01 | Scaffold module | compiles | DOING | | | |
| T-02 | Vendor onboarding wizard | submits | DOING | | | flow:flow-vendor |
EOF
}

# The workflow: false-positive case: DOING row, no real flow tag.
write_tasks_workflow_only() {
  cat > "$PROJ/AI_DOCS/milestones/M01-x/tasks.md" <<'EOF'
# M01 Tasks

| ID | Title | Acceptance | Status | blockedBy | Verify | Notes |
|---|---|---|---|---|---|---|
| T-01 | Tidy the repo | clean | DOING | | | workflow: cleanup |
EOF
}

# Plan writer: $1 is the Status cell for flow-test-a. The second flow is NAMED
# "Approved vendor onboarding" while its Status stays pending: the word in the
# name must never satisfy the gate.
write_plan() {
  cat > "$PROJ/AI_DOCS/design/flow-validation-plan.md" <<EOF
# Flow Validation Plan

| Flow ID | Flow name | Tier | Priority | Status | Chosen variant | Date |
|---|---|---|---|---|---|---|
| flow-test-a | Checkout journey | F | P1 | $1 | | |
| flow-vendor | Approved vendor onboarding | F | P2 | pending | | |
EOF
}

run_hook() {
  ( cd "$PROJ" && printf '%s' "$EDIT_JSON" | bash "$HOOK" >"$SANDBOX/out.log" 2>"$SANDBOX/err.log" )
  echo $?
}

# Same trigger with another target path ($1, relative to the sandbox project).
run_hook_path() {
  ( cd "$PROJ" && printf '{"tool_name":"Edit","tool_input":{"file_path":"%s","old_string":"a","new_string":"b"}}' "$1" \
      | bash "$HOOK" >"$SANDBOX/out.log" 2>"$SANDBOX/err.log" )
  echo $?
}

FAILS=0
assert_exit() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS: $desc (exit $actual)"
  else
    echo "FAIL: $desc (expected exit $expected, got $actual)"
    sed 's/^/      stderr| /' "$SANDBOX/err.log" 2>/dev/null | head -20
    FAILS=$((FAILS + 1))
  fi
}

assert_stderr_has() {
  local desc="$1" needle="$2"
  if grep -q -- "$needle" "$SANDBOX/err.log" 2>/dev/null; then
    echo "PASS: $desc (stderr names $needle)"
  else
    echo "FAIL: $desc (stderr does not mention $needle)"
    FAILS=$((FAILS + 1))
  fi
}

echo "== enforce-flow-gate.sh proving test =="
echo "Sandbox: $SANDBOX"
echo ""

# Case 1: pending flow blocks, despite the ledger DOING summary row.
write_tasks_flow_a
write_plan "pending"
RC=$(run_hook)
assert_exit "case 1: pending flow-test-a blocks (ledger DOING row present)" 2 "$RC"
assert_stderr_has "case 1: block message names the flow" "flow-test-a"

# Case 2: a flow NAMED "Approved ..." with Status pending still blocks, and the
# tag is found on the second DOING row.
write_tasks_flow_vendor
write_plan "pending"
RC=$(run_hook)
assert_exit "case 2: 'Approved vendor onboarding' name with pending Status blocks" 2 "$RC"
assert_stderr_has "case 2: block message names flow-vendor" "flow-vendor"

# Case 3: approved Status allows.
write_tasks_flow_a
write_plan "approved"
RC=$(run_hook)
assert_exit "case 3: approved Status allows" 0 "$RC"

# Case 4: waived Status allows.
write_plan "waived"
RC=$(run_hook)
assert_exit "case 4: waived Status allows" 0 "$RC"

# Case 5: "workflow: cleanup" in Notes is not a flow tag.
write_tasks_workflow_only
write_plan "pending"
RC=$(run_hook)
assert_exit "case 5: workflow: cleanup notes carry no flow tag, allows" 0 "$RC"

# Case 6: bypass env alone, nothing recorded, still blocks.
write_tasks_flow_a
write_plan "pending"
export ADF_FLOW_GATE_BYPASS=on
RC=$(run_hook)
assert_exit "case 6: ADF_FLOW_GATE_BYPASS=on with no recorded line blocks" 2 "$RC"

# Case 7: a recorded bypass line with a stale date still blocks.
echo "## Bypass ADF_FLOW_GATE_BYPASS 2020-01-01: old override" >> "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 7: stale-dated bypass line blocks (same-day scoping)" 2 "$RC"

# Case 8: a same-day recorded bypass line allows. "Today" is the LOCAL date:
# people and Claude write local dates into decision-log.md.
TODAY=$(date +%F)
echo "## Bypass ADF_FLOW_GATE_BYPASS $TODAY: user approved override" >> "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 8: same-day recorded ADF_FLOW_GATE_BYPASS allows" 0 "$RC"
unset ADF_FLOW_GATE_BYPASS

# Case 9: the full framework opt-out ADF_BYPASS honored the same recorded way.
# The log is emptied first: the case 8 line is a valid same-day record, and a
# record is now sufficient on its own, so "no recorded line" has to mean none.
: > "$PROJ/AI_DOCS/memory/decision-log.md"
export ADF_BYPASS=on
RC=$(run_hook)
assert_exit "case 9a: ADF_BYPASS=on with no recorded line blocks" 2 "$RC"
echo "## Bypass ADF_BYPASS $TODAY: skip the framework" >> "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 9b: same-day recorded ADF_BYPASS allows" 0 "$RC"
unset ADF_BYPASS

# Case 10: the same-day record alone, no variable set, allows.
: > "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 10a: no variable and no record blocks" 2 "$RC"
echo "## Bypass ADF_FLOW_GATE_BYPASS $TODAY: user approved override" >> "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 10b: same-day ADF_FLOW_GATE_BYPASS record with no variable allows" 0 "$RC"

# Case 11: a stale-dated record with no variable set still blocks.
echo "## Bypass ADF_FLOW_GATE_BYPASS 2020-01-01: old override" > "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 11: stale-dated record with no variable blocks" 2 "$RC"

# Case 12: the CLAUDE.md Section 1 opt-out entry, then the resume entry.
printf '## Bypass %s 10:00\nUser said: skip the framework\n' "$TODAY" > "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 12a: Section 1 ## Bypass entry dated today allows" 0 "$RC"
printf '## Resume framework %s\n' "$TODAY" >> "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 12b: a later ## Resume framework entry blocks again" 2 "$RC"
: > "$PROJ/AI_DOCS/memory/decision-log.md"

# Case 13: a builder worktree path is app code too.
RC=$(run_hook_path ".claude/worktrees/agent-a1/src/app.ts")
assert_exit "case 13: pending flow blocks an edit inside .claude/worktrees/<name>/" 2 "$RC"
assert_stderr_has "case 13: block message names the flow" "flow-test-a"

# Case 14: doc allowlist by basename.
RC=$(run_hook_path "src/READMEParser.ts")
assert_exit "case 14a: src/READMEParser.ts is app code, blocks" 2 "$RC"
RC=$(run_hook_path "README.md")
assert_exit "case 14b: README.md is a doc, allows" 0 "$RC"

# Case 15: a same-day line that only MENTIONS the variable is not the recorded
# heading. Without the variable it blocks. With the variable in the hook
# environment it allows (env plus a same-day recorded line, the old rule).
echo "- $TODAY: agreed NOT to use ADF_FLOW_GATE_BYPASS or ADF_BYPASS on this project" > "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 15a: a same-day prose mention of the variables, no variable, blocks" 2 "$RC"
export ADF_FLOW_GATE_BYPASS=on
echo "Override: ADF_FLOW_GATE_BYPASS used on $TODAY for the checkout demo" > "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 15b: variable set plus a same-day line naming it allows" 0 "$RC"
unset ADF_FLOW_GATE_BYPASS

# Case 16: headings that do not open the gate.
printf '```\n## Bypass ADF_FLOW_GATE_BYPASS %s: <reason>\n```\n' "$TODAY" > "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 16a: a ## Bypass template inside a fenced code block blocks" 2 "$RC"
echo "## Bypass DENIED ADF_FLOW_GATE_BYPASS $TODAY: operator said no" > "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 16b: ## Bypass DENIED dated today blocks" 2 "$RC"
printf '## Bypass %s 09:00\nUser said: freestyle\n\n## Bypass ended %s 11:00\n' "$TODAY" "$TODAY" > "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 16c: a later ## Bypass ended heading closes it" 2 "$RC"
printf '## Bypass ADF_BYPASS %s 09:00\nUser said: freestyle\n\n## Resume framework %s 11:00\n' "$TODAY" "$TODAY" > "$PROJ/AI_DOCS/memory/decision-log.md"
RC=$(run_hook)
assert_exit "case 16d: ## Resume framework closes a heading that names ADF_BYPASS" 2 "$RC"
: > "$PROJ/AI_DOCS/memory/decision-log.md"

# Case 17: a worktree's OWN state satisfies the gate (a session that runs inside
# the worktree keeps its plan there), while the main checkout's plan is pending.
WT="$PROJ/.claude/worktrees/agent-b2"
mkdir -p "$WT/AI_DOCS/design" "$WT/AI_DOCS/milestones/M01-x" "$WT/AI_DOCS/memory" "$WT/src"
cp "$PROJ/AI_DOCS/milestones/M01-x/tasks.md" "$WT/AI_DOCS/milestones/M01-x/tasks.md"
sed 's/| flow-test-a | Checkout journey | F | P1 | pending |/| flow-test-a | Checkout journey | F | P1 | approved |/' \
  "$PROJ/AI_DOCS/design/flow-validation-plan.md" > "$WT/AI_DOCS/design/flow-validation-plan.md"
RC=$(run_hook_path ".claude/worktrees/agent-b2/src/app.ts")
assert_exit "case 17a: the worktree's own plan approves the flow, allows" 0 "$RC"
RC=$(run_hook_path ".claude/worktrees/agent-a1/src/app.ts")
assert_exit "case 17b: a worktree with no state of its own still blocks" 2 "$RC"

echo ""
if [[ $FAILS -eq 0 ]]; then
  echo "RESULT: ALL ASSERTIONS PASSED (both directions proven)"
  exit 0
else
  echo "RESULT: $FAILS ASSERTION(S) FAILED"
  exit 1
fi
