#!/usr/bin/env bash
# mavs-gate-dotdot.test.sh - regression test for deep-security-audit lead
# mavs-gate.sh/branch-tree-dotdot-path-write-outside-tmpdir (run-1, 2026-10-22).
#
# A branch author can commit a tree whose AI_DOCS/quality/mavs/ holds an entry
# literally named `..`. git mktree accepts it, ls-tree lists it, and
# `git show <commit>:<path>` resolves it. Before the fix, mavs-gate.sh extracted
# that path into "$TMP_MAVS/../escaped.txt", i.e. outside its mktemp directory.
#
# Both directions: a crafted branch must write NOTHING outside the temp dir and
# must log the refusal, and a clean branch must still extract and be graded.
#
# No set -e by design, matching house hook rules.
set -uo pipefail

HOOK="$(cd "$(dirname "$0")/.." && pwd)/mavs-gate.sh"
[ -f "$HOOK" ] || { echo "FAIL: cannot locate mavs-gate.sh from $0"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "SKIP: git not available"; exit 0; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
PASS=0; FAIL=0
ok()  { echo "PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

REPO="$SANDBOX/repo"
git init -q -b develop "$REPO" 2>/dev/null || { git init -q "$REPO" && git -C "$REPO" checkout -q -b develop; }
cd "$REPO" || exit 1
git config user.email test@example.invalid
git config user.name test
git config core.autocrlf false
mkdir -p AI_DOCS/quality/mavs
printf '{"status":"PASS","failed":0}\n' > AI_DOCS/quality/mavs/ok.json
printf 'x\n' > app.txt
git add -A && git commit -qm base

# Crafted branch: AI_DOCS/quality/mavs/{ok.json, ../escaped.txt}
B_OK=$(git rev-parse HEAD:AI_DOCS/quality/mavs/ok.json)
B_ESC=$(printf 'ESCAPED\n' | git hash-object -w --stdin)
T_DD=$(printf '100644 blob %s\tescaped.txt\n' "$B_ESC" | git mktree)
T_MAVS=$(printf '100644 blob %s\tok.json\n040000 tree %s\t..\n' "$B_OK" "$T_DD" | git mktree 2>/dev/null)
if [ ${#T_MAVS} -ne 40 ]; then
  echo "SKIP: this git refuses a tree entry named '..' at mktree (git $(git --version)), nothing to regress"
  exit 0
fi
T_Q=$(printf '040000 tree %s\tmavs\n' "$T_MAVS" | git mktree)
T_A=$(printf '040000 tree %s\tquality\n' "$T_Q" | git mktree)
T_R=$(printf '040000 tree %s\tAI_DOCS\n100644 blob %s\tapp.txt\n' "$T_A" "$(git rev-parse HEAD:app.txt)" | git mktree)
git update-ref refs/heads/crafted "$(git commit-tree "$T_R" -p HEAD -m crafted)"
git branch clean HEAD

run_hook() { # $1 = branch, $2 = label
  mkdir -p "$SANDBOX/$2/tmp"
  printf '{"tool_input":{"command":"git merge %s"}}' "$1" \
    | TMPDIR="$SANDBOX/$2/tmp" bash "$HOOK" > "$SANDBOX/$2.out" 2>&1
  echo $? > "$SANDBOX/$2.rc"
}

run_hook crafted crafted
if [ -e "$SANDBOX/crafted/tmp/escaped.txt" ] || [ -e "$SANDBOX/crafted/escaped.txt" ]; then
  bad "crafted branch wrote escaped.txt outside the mktemp dir"
else
  ok "crafted branch wrote nothing outside the mktemp dir"
fi
grep -q "unsafe report path" "$SANDBOX/crafted.out" && ok "refusal is logged" || bad "no refusal logged for the '..' path"

run_hook clean clean
grep -q "grading clean" "$SANDBOX/clean.out" && ok "clean branch is still extracted and graded" || bad "clean branch was not graded (fix over-blocks)"

echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ]
