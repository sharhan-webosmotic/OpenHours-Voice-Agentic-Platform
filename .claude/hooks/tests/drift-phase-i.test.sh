#!/usr/bin/env bash
# hooks/tests/drift-phase-i.test.sh: Proving test for Phase I of hooks/drift-detector.sh
# (control registry reconciliation).
#
# Control Verification rule (testing-rules Rule 33 family): a check counts as
# proven only when it is driven from OUTSIDE, through its real trigger, with a
# known-bad input, and observed to REPORT it, and then observed to stay SILENT
# on the good input. Phase I is advisory, so "report" means a finding line in
# AI_DOCS/quality/drift-report.md. This test does both directions:
#
#   1. SILENT: a fresh project whose registry is the shipped
#      templates/control-registry.md reports zero Phase I findings. The control
#      files have a brand-new mtime and an old commit date, which is what a
#      fresh clone looks like (git does not preserve mtimes).
#   2. SILENT: a registry in the shape older projects were seeded with (paths
#      without the .claude/ prefix, a parenthetical in the wiring cell, and a
#      second table under another heading) reports zero findings, with LF and
#      with CRLF line endings, and with an unrelated settings.json at the
#      project root. It used to report six on every project.
#   3. REPORTS: a control committed after its proof date is flagged as stale.
#   4. SILENT: moving the proof date to the day of that commit clears it.
#   5. REPORTS: an uncommitted edit to a control is flagged (mtime fallback).
#   6. REPORTS: a wiring file that no longer mentions the control is flagged.
#   7. REPORTS: a `never` row and a row whose wiring file is missing are
#      flagged, and nothing else is.
#
# Sandbox: a throwaway directory under the project root's AI_DOCS/.temp/ when
# one exists, else the system temp directory (the case when run in the framework
# repo itself). The project folder inside it has a space in its name. The
# detector is invoked the way the SessionStart hook invokes it: cwd at the
# sandbox project root, no arguments. Needs git, does not need jq. Cleans up on
# exit. Exits non-zero on any failed assertion.

set -u

TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$TEST_DIR/../drift-detector.sh"
FRAMEWORK_DIR="$(cd "$TEST_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$FRAMEWORK_DIR/.." && pwd)"
TEMPLATE="$FRAMEWORK_DIR/templates/control-registry.md"
SETTINGS_TEMPLATE="$FRAMEWORK_DIR/settings.template.json"

for f in "$HOOK" "$TEMPLATE" "$SETTINGS_TEMPLATE"; do
  if [[ ! -f "$f" ]]; then
    echo "FATAL: required file not found at $f" >&2
    exit 1
  fi
done
if ! command -v git >/dev/null 2>&1; then
  echo "FATAL: git is required (Phase I reads a control's last commit date from it)" >&2
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
SANDBOX=$(mktemp -d "$SANDBOX_BASE/drift-phase-i-test.XXXXXX" 2>/dev/null)
if [[ -z "${SANDBOX:-}" || ! -d "$SANDBOX" ]]; then
  echo "FATAL: could not create sandbox under $SANDBOX_BASE" >&2
  exit 1
fi
trap 'rm -rf "$SANDBOX"' EXIT

# The env must not point the detector at the real project or another AI_DOCS.
unset AI_DOCS PROJECT_DIR CLAUDE_PROJECT_DIR 2>/dev/null

PROJ="$SANDBOX/my proj"
REGISTRY="$PROJ/AI_DOCS/quality/control-registry.md"
REPORT="$PROJ/AI_DOCS/quality/drift-report.md"
mkdir -p "$PROJ/AI_DOCS/memory" "$PROJ/AI_DOCS/quality" "$PROJ/src" "$PROJ/.claude"

# A stand-in framework checkout: the real hooks and the real settings wiring,
# committed in its own git repository with an OLD commit date. The files on
# disk keep today's mtime, exactly like a fresh clone.
cp -r "$FRAMEWORK_DIR/hooks" "$PROJ/.claude/hooks"
cp "$SETTINGS_TEMPLATE" "$PROJ/.claude/settings.template.json"
cp "$SETTINGS_TEMPLATE" "$PROJ/.claude/settings.json"

fgit() {
  git -C "$PROJ/.claude" -c user.name=adf-test -c user.email=adf-test@example.invalid \
    -c commit.gpgsign=false -c core.autocrlf=false -c core.hooksPath=.git/no-hooks "$@" >/dev/null 2>&1
}
# commit_all DATE MESSAGE: commit everything in the stand-in checkout at DATE.
commit_all() {
  fgit add -A
  GIT_AUTHOR_DATE="$1T12:00:00" GIT_COMMITTER_DATE="$1T12:00:00" fgit commit -q -m "$2"
}

fgit init -q
# Refuse to continue without the sandbox repository: every git command in this
# test, and every one the detector runs, must act on it and no other.
if [[ ! -d "$PROJ/.claude/.git" ]]; then
  echo "FATAL: could not create a git repository in the sandbox" >&2
  exit 1
fi
commit_all "2020-01-01" "framework as cloned"
if ! git -C "$PROJ/.claude" rev-parse -q --verify HEAD >/dev/null 2>&1; then
  echo "FATAL: could not commit the stand-in framework checkout" >&2
  exit 1
fi

# A registry in the shape projects were seeded with before the .claude/ prefix:
# bare framework paths, a parenthetical after the wiring file, and a second
# table that is NOT a list of controls. $1 is the flow-gate proof date.
write_old_shape_registry() {
  cat > "$REGISTRY" <<EOF
# Control Registry

## Registry

| Control | Trigger | Wiring file | Control file | Last proven |
|---|---|---|---|---|
| <name> | <the event that fires it> | <the SOURCE file that installs it> | <the file that implements it> | <YYYY-MM-DD, or \`never\`> |
| flow-gate | PreToolUse Edit on app code | settings.json (from settings.template.json) | hooks/enforce-flow-gate.sh | $1 (hooks/tests/enforce-flow-gate.test.sh, both directions) |
| mavs-gate | PreToolUse Bash on a git merge | settings.json (from settings.template.json) | hooks/mavs-gate.sh | 2026-08-21 (hooks/tests/mavs-gate-advisory.test.sh, both directions) |

## What Phase I checks

| Check | What it catches |
|---|---|
| The wiring file exists and mentions the control file | A replaced wiring. |
| The proof date is not older than the control file's mtime | A control changed after its proof. |
| The proof date is not \`never\` | A control nobody watched refuse anything. |
EOF
}

# Run the detector as SessionStart does. The 24h stamp is cleared first.
run_scan() {
  rm -f "$PROJ/AI_DOCS/memory/.drift-last-run" "$REPORT"
  ( cd "$PROJ" && bash "$HOOK" >"$SANDBOX/out.log" 2>"$SANDBOX/err.log" )
}

# The Phase I finding lines of the last report.
phase_i() {
  awk '/^## I\) /{f=1; next} /^## |^---/{f=0} f && /^- \[ \]/' "$REPORT" 2>/dev/null
}

FAILS=0
assert_count() {
  local desc="$1" expected="$2" actual
  actual=$(phase_i | grep -c . || true)
  if [[ ! -f "$REPORT" ]]; then
    echo "FAIL: $desc (the detector wrote no report)"
    sed 's/^/      stderr| /' "$SANDBOX/err.log" 2>/dev/null | head -5
    FAILS=$((FAILS + 1))
  elif [[ "$actual" == "$expected" ]]; then
    echo "PASS: $desc ($actual Phase I finding(s))"
  else
    echo "FAIL: $desc (expected $expected Phase I finding(s), got $actual)"
    phase_i | cut -c1-150 | sed 's/^/      finding| /'
    FAILS=$((FAILS + 1))
  fi
}

# A finding line must mention both needles (the control and what is wrong).
assert_finding() {
  local desc="$1" control="$2" needle="$3"
  if phase_i | grep -F -- "\`$control\`" | grep -qF -- "$needle"; then
    echo "PASS: $desc (finding names $control: $needle)"
  else
    echo "FAIL: $desc (no finding for $control mentioning: $needle)"
    FAILS=$((FAILS + 1))
  fi
}

echo "== drift-detector.sh Phase I proving test =="
echo "Sandbox: $SANDBOX"
echo ""

# Case 1: fresh project, registry copied from the shipped template (setup.sh
# and upgrade.sh do exactly this copy).
cp "$TEMPLATE" "$REGISTRY"
run_scan
assert_count "case 1: fresh project seeded from the shipped template is silent" 0

# Case 2: the registry shape already-installed projects carry.
write_old_shape_registry "2026-08-21"
run_scan
assert_count "case 2a: old-shape registry (bare paths, parenthetical, second table) is silent" 0

# The same registry with CRLF line endings, as a Windows checkout can leave it.
awk '{printf "%s\r\n", $0}' "$REGISTRY" > "$SANDBOX/registry.crlf"
cp "$SANDBOX/registry.crlf" "$REGISTRY"
run_scan
assert_count "case 2b: the same registry with CRLF line endings is silent" 0

# A project file that happens to share the bare wiring name must not hide the
# framework's own settings.json.
printf '{ "theme": "dark" }\n' > "$PROJ/settings.json"
run_scan
assert_count "case 2c: a project-root settings.json does not hide .claude/settings.json" 0
rm -f "$PROJ/settings.json"

# Case 3: the control changes in a commit dated after its proof.
printf '\n# changed after the proof\n' >> "$PROJ/.claude/hooks/enforce-flow-gate.sh"
commit_all "2026-09-15" "edit the flow gate"
run_scan
assert_count "case 3: a control committed after its proof date is reported" 1
assert_finding "case 3: the stale finding names the control" "flow-gate" "has been modified since"

# Case 4: re-proving on the day of the change clears the finding.
write_old_shape_registry "2026-09-15"
run_scan
assert_count "case 4: a proof dated the day of the last change is silent" 0

# Case 5: a local, uncommitted edit. Git has no date for it, so the mtime
# (now) is the answer, and now is after the proof.
printf '\n# local edit, never committed\n' >> "$PROJ/.claude/hooks/mavs-gate.sh"
run_scan
assert_count "case 5: an uncommitted edit to a control is reported" 1
assert_finding "case 5: the stale finding names the edited control" "mavs-gate" "has been modified since"
fgit checkout -q -- hooks/mavs-gate.sh

# Case 6: the wiring file stops mentioning the control (the D-088 shape).
sed 's/mavs-gate\.sh/mavs-gate-gone.sh/g' "$PROJ/.claude/settings.json" > "$SANDBOX/settings.tmp"
cp "$SANDBOX/settings.tmp" "$PROJ/.claude/settings.json"
run_scan
assert_count "case 6: a wiring file that lost the control is reported" 1
assert_finding "case 6: the finding names the unwired control" "mavs-gate" "contains no reference"
cp "$SETTINGS_TEMPLATE" "$PROJ/.claude/settings.json"

# Case 7: a never-proven row and a row whose wiring file does not exist.
write_old_shape_registry "2026-09-15"
awk '{print} /^\| mavs-gate /{
  print "| ship-gate | PreToolUse Bash on a deploy | settings.json | hooks/enforce-ship-gate.sh | never |"
  print "| ci-lint | CI lint step | .github/workflows/ci.yml | scripts/lint.sh | 2026-09-01 |"
}' "$REGISTRY" > "$SANDBOX/registry.tmp"
cp "$SANDBOX/registry.tmp" "$REGISTRY"
run_scan
assert_count "case 7: exactly the never row and the missing-wiring row are reported" 2
assert_finding "case 7: the never-proven control is named" "ship-gate" "never been proven"
assert_finding "case 7: the control with a missing wiring file is named" "ci-lint" "does not exist"

echo ""
if [[ $FAILS -eq 0 ]]; then
  echo "RESULT: ALL ASSERTIONS PASSED (both directions proven)"
  exit 0
else
  echo "RESULT: $FAILS ASSERTION(S) FAILED"
  exit 1
fi
