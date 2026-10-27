#!/usr/bin/env bash
# hooks/tests/bash-gates.test.sh: Proving test for hooks/json-field.sh and for the
# Bash gates that read the tool command through it.
#
# Control Verification rule (testing-rules Rule 33 family): a control counts as
# proven only when it is driven from OUTSIDE, through its real trigger, with a
# known-bad input, and observed to BLOCK, and then observed to ALLOW the good
# input. Every gate below is driven in both directions with the JSON payload
# Claude Code sends on stdin.
#
#   A. json-field.sh: a command that contains quotes, newlines, and backslashes
#      comes back decoded and whole. The old fallback stopped at the first
#      escaped quote, so  cd "/path with space" && git reset --hard  reached every
#      gate as  cd /  and all of them failed open.
#   B. GIT-SAFETY: the command string is read OUT OF settings.template.json and
#      executed as shipped. Destructive forms block, also behind shell keywords
#      (if, while, !, case), wrappers (eval, nohup, timeout N, env -i), bash -c
#      or sh -c with either quote, a backtick, a redirection, a path-qualified
#      or backslash-escaped git, a quoted env assignment, and git global
#      options that take a separate argument. The safe forms of the same
#      subcommands allow, and a commit message, an echo, or a grep that only
#      mentions a destructive command is not blocked.
#   C. infra-cost-gate.sh: provisioning commands block without a same-day
#      approval, also behind a quoted path with a space. A harmless command
#      whose DESCRIPTION mentions a gated one is allowed.
#   D. enforce-ship-gate.sh: production deploy commands block without clearance,
#      including the yarn and pnpm shorthand, a production suffix (deploy:prod,
#      release:live, deploy-prod), and a backslash-continued command line.
#      Scripts that merely start with "deploy" or "release" are allowed.
#   E. enforce-single-aidocs.sh: a quoted nested AI_DOCS path blocks, a quoted
#      root AI_DOCS path with a space in it is allowed, and a builder worktree's
#      own root AI_DOCS is not a nested one.
#
# Sandbox: a throwaway directory under the project root's AI_DOCS/.temp/ when
# one exists, else the system temp directory. The sandbox project lives in a
# folder whose name contains a space on purpose. jq is not required. Cleans up
# on exit. Exits non-zero on any failed assertion.

set -u

TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$(cd "$TEST_DIR/.." && pwd)"
FRAMEWORK_DIR="$(cd "$TEST_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$FRAMEWORK_DIR/.." && pwd)"
TEMPLATE="$FRAMEWORK_DIR/settings.template.json"

for need in "$HOOKS_DIR/json-field.sh" "$HOOKS_DIR/infra-cost-gate.sh" "$HOOKS_DIR/enforce-ship-gate.sh" "$HOOKS_DIR/enforce-single-aidocs.sh" "$TEMPLATE"; do
  if [[ ! -f "$need" ]]; then
    echo "FATAL: not found: $need" >&2
    exit 1
  fi
done

if [[ -d "$PROJECT_ROOT/AI_DOCS" ]]; then
  SANDBOX_BASE="$PROJECT_ROOT/AI_DOCS/.temp"
else
  SANDBOX_BASE="${TMPDIR:-/tmp}"
fi
mkdir -p "$SANDBOX_BASE" 2>/dev/null
SANDBOX=$(mktemp -d "$SANDBOX_BASE/bash-gates-test.XXXXXX" 2>/dev/null)
if [[ -z "${SANDBOX:-}" || ! -d "$SANDBOX" ]]; then
  echo "FATAL: could not create sandbox under $SANDBOX_BASE" >&2
  exit 1
fi
trap 'rm -rf "$SANDBOX"' EXIT

# The env must not leak overrides or a project dir into the hooks.
unset ADF_INFRA_APPROVED ADF_SHIP_OVERRIDE ADF_ALLOW_NESTED_AIDOCS AI_DOCS CLAUDE_PROJECT_DIR 2>/dev/null

PROJ="$SANDBOX/my proj"
mkdir -p "$PROJ/.claude/hooks" "$PROJ/AI_DOCS/memory" "$PROJ/AI_DOCS/audit" "$PROJ/src"
cp "$HOOKS_DIR"/*.sh "$PROJ/.claude/hooks/" 2>/dev/null
# The form of the project path a tool call carries (C:/... on Git Bash).
PROJ_NATIVE="$(cd "$PROJ" && (pwd -W 2>/dev/null || pwd))"
TODAY="$(date -u +%Y-%m-%d)"

FAILS=0
assert_exit() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS: $desc (exit $actual)"
  else
    echo "FAIL: $desc (expected exit $expected, got $actual)"
    sed 's/^/      stderr| /' "$SANDBOX/err.log" 2>/dev/null | head -8
    FAILS=$((FAILS + 1))
  fi
}
assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS: $desc"
  else
    echo "FAIL: $desc"
    echo "      expected| $expected"
    echo "      actual  | $actual"
    FAILS=$((FAILS + 1))
  fi
}

# JSON string escaping and unescaping, done here so the test never depends on
# the code it is testing (and never needs jq, node, or python).
json_escape() {
  local s="$1" bs='\' dq='"'
  s=${s//"$bs"/"$bs$bs"}
  s=${s//"$dq"/"$bs$dq"}
  s=${s//$'\n'/"${bs}n"}
  s=${s//$'\t'/"${bs}t"}
  printf '%s' "$s"
}
json_unescape() {
  local s="$1" bs='\' dq='"' keep=$'\001'
  s=${s//"$bs$bs"/$keep}
  s=${s//"$bs$dq"/$dq}
  s=${s//"${bs}n"/$'\n'}
  s=${s//"${bs}t"/$'\t'}
  s=${s//"$keep"/"$bs"}
  printf '%s' "$s"
}
# PreToolUse payload for a Bash tool call: $1 command, $2 description.
bash_payload() {
  printf '{"session_id":"t","cwd":"%s","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"%s","description":"%s"}}' \
    "$(json_escape "$PROJ_NATIVE")" "$(json_escape "$1")" "$(json_escape "${2:-run it}")"
}
field() { bash "$HOOKS_DIR/json-field.sh" "$1"; }

# ── A. json-field.sh ──────────────────────────────────────────────────────────
echo "== A. json-field.sh"
CMD_Q="cd \"$PROJ_NATIVE\" && git reset --hard HEAD~1"
assert_eq "A1: a command with a quoted path comes back whole" "$CMD_Q" "$(bash_payload "$CMD_Q" | field command)"
CMD_NL=$'git commit -F - <<EOF\nfix: one\n\tindented\nEOF'
assert_eq "A2: escaped newlines and tabs are decoded" "$CMD_NL" "$(bash_payload "$CMD_NL" | field command)"
CMD_BS='grep -n "a\.b" src/x.ts'
assert_eq "A3: a backslash inside the command survives" "$CMD_BS" "$(bash_payload "$CMD_BS" | field command)"
assert_eq "A4: a Windows file_path is slash-normalized" "D:/My Proj/src/a.ts" \
  "$(printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"D:\\My Proj\\src\\a.ts","content":"{\"file_path\":\"evil\"}"}}' | field file_path)"
assert_eq "A5: a prompt keeps the text after its first quote" 'rename the "Save" button to "Submit"' \
  "$(printf '%s' '{"hook_event_name":"UserPromptSubmit","prompt":"rename the \"Save\" button to \"Submit\""}' | field prompt)"
assert_eq "A6: a top-level identifier field is read" "builder" \
  "$(printf '%s' '{"hook_event_name":"SubagentStop","agent_type":"builder"}' | field agent_type)"
assert_eq "A7: a missing field prints nothing" "" "$(printf '%s' '{"tool_name":"Bash"}' | field command)"
# A8: a long command (about 200 KB) is extracted whole and fast. The old regex
# backtracked over the whole payload and took tens of seconds.
BIG_LINE='line with "quotes" and \ a backslash and $VAR'
BIG_BODY=""
for _i in $(seq 1 64); do BIG_BODY+="$BIG_LINE"$'\n'; done
for _i in 1 2 3 4 5 6; do BIG_BODY+="$BIG_BODY"; done
CMD_BIG="cat > notes.txt <<'EOF'"$'\n'"$BIG_BODY"'EOF'$'\n''git reset --hard'
bash_payload "$CMD_BIG" > "$SANDBOX/big.json"
START_S=$SECONDS
OUT_BIG=$(field command < "$SANDBOX/big.json")
ELAPSED_S=$((SECONDS - START_S))
assert_eq "A8: a ~200 KB command comes back whole" "${#CMD_BIG}" "${#OUT_BIG}"
if (( ELAPSED_S <= 3 )); then echo "PASS: A8: extracted in ${ELAPSED_S}s"; else echo "FAIL: A8: extraction took ${ELAPSED_S}s"; FAILS=$((FAILS + 1)); fi

# ── B. GIT-SAFETY, the shipped command string ─────────────────────────────────
echo "== B. GIT-SAFETY (command string read from settings.template.json)"
GS_LINE=$(grep -m1 'hooks/git-safety.sh' "$TEMPLATE")
GS_LIT=${GS_LINE#*\"command\": \"}
GS_LIT=${GS_LIT%\"*}
GS_CMD=$(json_unescape "$GS_LIT")
if [[ -z "$GS_CMD" || "$GS_CMD" != bash* ]]; then
  echo "FATAL: could not read the GIT-SAFETY command out of $TEMPLATE" >&2
  exit 1
fi
run_git_safety() {
  ( cd "${2:-$PROJ}" && bash_payload "$1" "${3:-run it}" | bash -c "$GS_CMD" >"$SANDBOX/out.log" 2>"$SANDBOX/err.log" )
  echo $?
}
gs_block() { assert_exit "B block: $1" 2 "$(run_git_safety "$1")"; }
gs_allow() { assert_exit "B allow: $1" 0 "$(run_git_safety "$1")"; }

gs_block 'git reset --hard'
gs_block 'git -C packages/api reset --hard'
gs_block "git -C \"$PROJ_NATIVE\" reset --hard"
gs_block 'git clean -fd'
gs_block 'git clean -xdf'
gs_block 'git checkout .'
gs_block 'git checkout -- src/app.ts'
gs_block 'git restore src/app.ts'
gs_block 'git restore .'
gs_block 'git rebase main'
gs_block 'git rebase -i HEAD~3'
gs_block "cd \"$PROJ_NATIVE\" && git reset --hard HEAD~1"
gs_block 'git status; git clean -fd'
gs_block 'git commit -m "wip" && git clean -fdx'
gs_block $'git add -A\ngit restore --staged --worktree src/app.ts'
# Shell grammar in front of git: keywords, wrappers, sub-shells, redirections.
gs_block "bash -c 'git reset --hard'"
gs_block "sh -c 'git reset --hard HEAD~3'"
gs_block 'bash -c "git reset --hard"'
gs_block "eval 'git reset --hard'"
gs_block 'eval git reset --hard'
gs_block 'if git reset --hard; then echo ok; fi'
gs_block 'while git reset --hard; do break; done'
gs_block '! git reset --hard'
gs_block 'case x in x) git reset --hard;; esac'
gs_block 'timeout 10 git reset --hard'
gs_block 'nohup git reset --hard'
gs_block 'env -i git reset --hard'
gs_block '>/dev/null git reset --hard'
gs_block '/usr/bin/git reset --hard'
gs_block '\git reset --hard'
gs_block 'echo `git reset --hard`'
gs_block 'echo $(git reset --hard)'
gs_block "FOO='a b' git reset --hard"
gs_block 'FOO="a b" git reset --hard'
gs_block 'git --git-dir .git reset --hard'
gs_block 'git --git-dir=.git --work-tree=. reset --hard'
gs_block "git -C '$PROJ_NATIVE' reset --hard"
gs_block "git -c 'user.name=a b' reset --hard"
gs_block $'git \\\nreset --hard'
gs_block 'git checkout HEAD src/app.ts'

gs_allow 'git rebase --abort'
gs_allow 'git rebase --continue'
gs_allow 'git restore --staged src/app.ts'
gs_allow 'cd app && git restore --staged src/app.ts'
gs_allow 'git checkout main'
gs_allow 'git checkout -b fix/login'
gs_allow 'git clean -n'
gs_allow 'git commit -m "undo the git reset --hard"'
gs_allow 'git log --oneline -5'
gs_allow 'echo "git reset --hard"'
gs_allow "echo 'git reset --hard'"
gs_allow 'grep -r "git reset" .'
gs_allow 'git log --grep="reset --hard"'
gs_allow 'git commit -m "fix: avoid git clean -fd"'
gs_allow 'git stash'
gs_allow 'git checkout -B main origin/main'
gs_allow 'git restore --staged .'
gs_allow 'git ls-files | xargs grep -l restore'
assert_exit "B allow: a harmless command whose description mentions git reset --hard" 0 \
  "$(run_git_safety 'git status' "$PROJ" 'check state before any git reset --hard')"

# The command must also work when the session cwd has moved into a subfolder
# and CLAUDE_PROJECT_DIR points at the project (native form, then POSIX form).
export CLAUDE_PROJECT_DIR="$PROJ_NATIVE"
assert_exit "B block: run from <proj>/src with CLAUDE_PROJECT_DIR set (native path)" 2 "$(run_git_safety 'git reset --hard' "$PROJ/src")"
export CLAUDE_PROJECT_DIR="$PROJ"
assert_exit "B block: run from <proj>/src with CLAUDE_PROJECT_DIR set (POSIX path)" 2 "$(run_git_safety 'git reset --hard' "$PROJ/src")"
assert_exit "B allow: run from <proj>/src with CLAUDE_PROJECT_DIR set" 0 "$(run_git_safety 'git status' "$PROJ/src")"
unset CLAUDE_PROJECT_DIR

# ── C. infra-cost-gate.sh ─────────────────────────────────────────────────────
echo "== C. infra-cost-gate.sh"
run_hook() {
  ( cd "$PROJ" && bash_payload "$2" "${3:-run it}" | bash "$HOOKS_DIR/$1" >"$SANDBOX/out.log" 2>"$SANDBOX/err.log" )
  echo $?
}
rm -f "$PROJ/AI_DOCS/memory/infra-cost-approvals.md"
assert_exit "C block: terraform apply with no approval" 2 "$(run_hook infra-cost-gate.sh 'terraform apply -auto-approve')"
assert_exit "C block: terraform -chdir=\"<path with space>\" apply" 2 \
  "$(run_hook infra-cost-gate.sh "terraform -chdir=\"$PROJ_NATIVE/infrastructure/dev\" apply -auto-approve")"
assert_exit "C block: cd \"<path with space>\" && terraform apply" 2 \
  "$(run_hook infra-cost-gate.sh "cd \"$PROJ_NATIVE/infrastructure/dev\" && terraform apply")"
assert_exit "C block: aws ec2 run-instances" 2 "$(run_hook infra-cost-gate.sh 'aws ec2 run-instances --image-id ami-1')"
assert_exit "C allow: terraform plan described with the words terraform apply" 0 \
  "$(run_hook infra-cost-gate.sh 'terraform plan -out=tf.plan' 'Show the plan before we run terraform apply')"
assert_exit "C allow: cat README described with the words cdk deploy" 0 \
  "$(run_hook infra-cost-gate.sh 'cat infrastructure/README.md' 'Read the docs on cdk deploy and pulumi up')"
printf '# Infra Cost Approvals\n[%s] dev base stack, DECLINED by user\n' "$TODAY" > "$PROJ/AI_DOCS/memory/infra-cost-approvals.md"
assert_exit "C block: a same-day DECLINED entry does not clear the gate" 2 "$(run_hook infra-cost-gate.sh 'terraform apply')"
printf '# Infra Cost Approvals\n[%s] dev base stack, APPROVED by user, Est. $35/month\n' "$TODAY" > "$PROJ/AI_DOCS/memory/infra-cost-approvals.md"
assert_exit "C allow: a same-day APPROVED entry clears the gate" 0 "$(run_hook infra-cost-gate.sh 'terraform apply -auto-approve')"
rm -f "$PROJ/AI_DOCS/memory/infra-cost-approvals.md"

# ── D. enforce-ship-gate.sh ───────────────────────────────────────────────────
echo "== D. enforce-ship-gate.sh"
rm -f "$PROJ/AI_DOCS/audit/audit-report.md" "$PROJ/AI_DOCS/memory/gate-status.md"
assert_exit "D block: vercel --prod with no clearance" 2 "$(run_hook enforce-ship-gate.sh 'vercel --prod')"
assert_exit "D block: npm run deploy" 2 "$(run_hook enforce-ship-gate.sh 'npm run deploy')"
assert_exit "D block: yarn deploy (yarn needs no run)" 2 "$(run_hook enforce-ship-gate.sh 'yarn deploy')"
assert_exit "D block: pnpm release" 2 "$(run_hook enforce-ship-gate.sh 'pnpm release')"
assert_exit "D block: cd \"<path with space>\" && npm run ship" 2 "$(run_hook enforce-ship-gate.sh "cd \"$PROJ_NATIVE\" && npm run ship")"
assert_exit "D block: npm run deploy:prod (production suffix)" 2 "$(run_hook enforce-ship-gate.sh 'npm run deploy:prod')"
assert_exit "D block: pnpm run release:production" 2 "$(run_hook enforce-ship-gate.sh 'pnpm run release:production')"
assert_exit "D block: yarn deploy:live" 2 "$(run_hook enforce-ship-gate.sh 'yarn deploy:live')"
assert_exit "D block: npm run deploy-prod" 2 "$(run_hook enforce-ship-gate.sh 'npm run deploy-prod')"
assert_exit "D block: netlify deploy, backslash-newline, --prod" 2 "$(run_hook enforce-ship-gate.sh $'netlify deploy \\\n  --prod')"
assert_exit "D allow: npm run deploy:staging is another script" 0 "$(run_hook enforce-ship-gate.sh 'npm run deploy:staging')"
assert_exit "D allow: npm run release-notes is another script" 0 "$(run_hook enforce-ship-gate.sh 'npm run release-notes')"
assert_exit "D allow: pnpm deploy is a pnpm builtin, not the deploy script" 0 "$(run_hook enforce-ship-gate.sh 'pnpm deploy --filter api out')"
assert_exit "D allow: npm run build described with the words npm run deploy" 0 \
  "$(run_hook enforce-ship-gate.sh 'npm run build' 'Build so we can npm run deploy later')"
assert_exit "D allow: git log described with the words vercel --prod" 0 \
  "$(run_hook enforce-ship-gate.sh 'git log --oneline -5' 'Check what the last vercel --prod deploy shipped')"
printf '# Audit\n**Verdict:** PASS\n' > "$PROJ/AI_DOCS/audit/audit-report.md"
printf '| Gate | Status | Date | Notes |\n|---|---|---|---|\n| Gate 5 | PASSED | %s | |\n' "$TODAY" > "$PROJ/AI_DOCS/memory/gate-status.md"
assert_exit "D allow: vercel --prod with audit PASS and Gate 5 PASSED" 0 "$(run_hook enforce-ship-gate.sh 'vercel --prod')"
rm -f "$PROJ/AI_DOCS/audit/audit-report.md" "$PROJ/AI_DOCS/memory/gate-status.md"

# ── E. enforce-single-aidocs.sh ───────────────────────────────────────────────
echo "== E. enforce-single-aidocs.sh"
assert_exit "E block: mkdir -p src/AI_DOCS/memory" 2 "$(run_hook enforce-single-aidocs.sh 'mkdir -p src/AI_DOCS/memory')"
assert_exit "E block: mkdir -p \"src/AI_DOCS/memory\" (quoted)" 2 "$(run_hook enforce-single-aidocs.sh 'mkdir -p "src/AI_DOCS/memory"')"
assert_exit "E block: mkdir -p \"<proj with space>/packages/api/AI_DOCS\"" 2 \
  "$(run_hook enforce-single-aidocs.sh "mkdir -p \"$PROJ_NATIVE/packages/api/AI_DOCS\"")"
assert_exit "E allow: mkdir -p \"<proj with space>/AI_DOCS/memory\" (the root one)" 0 \
  "$(run_hook enforce-single-aidocs.sh "mkdir -p \"$PROJ_NATIVE/AI_DOCS/memory\"")"
assert_exit "E allow: mkdir -p AI_DOCS/quality" 0 "$(run_hook enforce-single-aidocs.sh 'mkdir -p AI_DOCS/quality')"
# A builder worktree is a checkout of its own: its root AI_DOCS is not nested.
mkdir -p "$PROJ/.git" "$PROJ/.claude/worktrees/agent-a1/src"
run_write() {
  ( cd "$PROJ" && printf '{"session_id":"t","hook_event_name":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"%s","content":"x"}}' \
      "$(json_escape "$PROJ_NATIVE/$2")" | bash "$HOOKS_DIR/$1" >"$SANDBOX/out.log" 2>"$SANDBOX/err.log" )
  echo $?
}
assert_exit "E allow: a new file in a worktree's own root AI_DOCS" 0 \
  "$(run_write enforce-single-aidocs.sh .claude/worktrees/agent-a1/AI_DOCS/milestones/M01-x/notes.md)"
assert_exit "E block: a nested AI_DOCS inside the worktree's app code" 2 \
  "$(run_write enforce-single-aidocs.sh .claude/worktrees/agent-a1/src/AI_DOCS/notes.md)"
assert_exit "E block: a nested AI_DOCS in the main checkout's app code" 2 \
  "$(run_write enforce-single-aidocs.sh src/AI_DOCS/notes.md)"

echo ""
if [[ $FAILS -eq 0 ]]; then
  echo "RESULT: ALL ASSERTIONS PASSED (both directions proven)"
  exit 0
else
  echo "RESULT: $FAILS ASSERTION(S) FAILED"
  exit 1
fi
