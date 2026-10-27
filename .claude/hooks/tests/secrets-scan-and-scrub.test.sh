#!/usr/bin/env bash
# hooks/tests/secrets-scan-and-scrub.test.sh: Proving test for hooks/scrub.sh and
# hooks/pre-commit-scan.sh.
#
# Control Verification rule (testing-rules Rule 33 family): a control counts as
# proven only when it is driven from OUTSIDE, through its real trigger, with a
# known-bad input, and observed to act, and then observed to leave the good
# input alone. This test does both directions for both controls.
#
# scrub.sh (redaction at the telemetry and memory boundary):
#
#   1. REDACTS: a bare password assignment.
#   2. REDACTS: a quoted password whose value contains spaces.
#   3. REDACTS: a JSON password member, and the line keeps its closing quote
#      (a scrubbed metrics.jsonl line must stay valid JSON).
#   4. REDACTS: a Stripe live secret key.
#   5. REDACTS: a GitHub fine-grained personal access token.
#   6. REDACTS: an AWS secret access key assignment.
#   7. REDACTS: a classic GitHub token (covered before this test existed).
#   8. PASSES THROUGH: prose that only mentions the word, and an empty JSON member.
#   9. REDACTS through the real write path: a secret handed to log-event.sh
#      never reaches AI_DOCS/memory/metrics.jsonl.
#
# pre-commit-scan.sh (git pre-commit scanner over staged files):
#
#  10. BLOCKS: a PEM private key header. The pattern starts with a dash, and
#      grep used to read it as an option, so private keys were never detected.
#  11. BLOCKS: an AWS session key, a GitHub server token, an amqp URL with
#      credentials, a Stripe live key, a fine-grained GitHub token, and an AWS
#      secret access key assignment.
#  12. BLOCKS: an AWS access key (covered before this test existed).
#  13. ALLOWS: ordinary code with a typed password field and a password string.
#      The password rule is scrubber-only on purpose.
#  14. ALLOWS: dashes that are not a PEM header, and an amqp URL without credentials.
#  15. BLOCKS then ALLOWS through the real trigger: with the scanner installed
#      as .git/hooks/pre-commit, `git commit` refuses a staged private key and
#      accepts a clean file.
#
# Every secret-shaped value is assembled at run time from harmless pieces, so
# this file never contains a string that matches a secret pattern.
#
# Sandbox: a throwaway directory under the project root's AI_DOCS/.temp/ when
# one exists, else the system temp directory (the case when run in the framework
# repo itself). The project folder inside it has a space in its name. Needs git,
# does not need jq. Cleans up on exit. Exits non-zero on any failed assertion.

set -u

TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRUB="$TEST_DIR/../scrub.sh"
SCAN="$TEST_DIR/../pre-commit-scan.sh"
LOG_EVENT="$TEST_DIR/../log-event.sh"
FRAMEWORK_DIR="$(cd "$TEST_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$FRAMEWORK_DIR/.." && pwd)"

for f in "$SCRUB" "$SCAN" "$LOG_EVENT"; do
  if [[ ! -f "$f" ]]; then
    echo "FATAL: hook not found at $f" >&2
    exit 1
  fi
done
if ! command -v git >/dev/null 2>&1; then
  echo "FATAL: git is required (pre-commit-scan.sh reads the staged file list from it)" >&2
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
SANDBOX=$(mktemp -d "$SANDBOX_BASE/secrets-test.XXXXXX" 2>/dev/null)
if [[ -z "${SANDBOX:-}" || ! -d "$SANDBOX" ]]; then
  echo "FATAL: could not create sandbox under $SANDBOX_BASE" >&2
  exit 1
fi
trap 'rm -rf "$SANDBOX"' EXIT

# The env must not leak an AI_DOCS override into the hooks.
unset AI_DOCS 2>/dev/null

PROJ="$SANDBOX/my proj"
mkdir -p "$PROJ/src"

# The sandbox project is its own git repository. Refuse to continue without
# one: every git command below must act on this repository and no other.
git -C "$PROJ" init -q >/dev/null 2>&1
if [[ ! -d "$PROJ/.git" ]]; then
  echo "FATAL: could not create a git repository in the sandbox" >&2
  exit 1
fi

# rep CHAR N: print CHAR repeated N times.
rep() { printf "%${2}s" '' | tr ' ' "$1"; }

# Fake secrets, assembled from pieces. None of these is a real credential.
D5=$(rep - 5)
PW_KEY="pass""word"
PW_VAL="hunter2""secret"
PW_PHRASE="correct horse ""battery staple"
STRIPE_KEY="sk_li""ve_$(rep a 24)"
GH_FINE="github_p""at_$(rep A 22)_$(rep b 59)"
GH_SERVER="gh""s_$(rep c 36)"
GH_CLASSIC="gh""p_$(rep d 36)"
AWS_SESSION="AS""IA$(rep B 16)"
AWS_ACCESS="AK""IA$(rep C 16)"
AWS_SECRET_NAME="aws_secret_access""_key"
AWS_SECRET_VAL=$(rep Z 40)
PEM_HEADER="${D5}BEGIN RSA PRIV""ATE KEY${D5}"
AMQP_URL="am""qp://guest:${PW_VAL}@rabbit.internal:5672/vhost"

FAILS=0

scrub() {
  printf '%s\n' "$1" | bash "$SCRUB" 2>"$SANDBOX/err.log"
}

# The secret must be gone and a redaction marker must be in its place.
assert_redacted() {
  local desc="$1" secret="$2" out="$3"
  if [[ "$out" != *"$secret"* && "$out" == *"[REDACTED"* ]]; then
    echo "PASS: $desc (secret removed, marker present)"
  else
    echo "FAIL: $desc (secret still present or no redaction marker)"
    sed 's/^/      stderr| /' "$SANDBOX/err.log" 2>/dev/null | head -5
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

assert_exit() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS: $desc (exit $actual)"
  else
    echo "FAIL: $desc (expected exit $expected, got $actual)"
    sed 's/^/      output| /' "$SANDBOX/out.log" 2>/dev/null | head -5
    FAILS=$((FAILS + 1))
  fi
}

assert_out_has() {
  local desc="$1" needle="$2"
  if grep -qF -- "$needle" "$SANDBOX/out.log" 2>/dev/null; then
    echo "PASS: $desc (output names $needle)"
  else
    echo "FAIL: $desc (output does not mention $needle)"
    FAILS=$((FAILS + 1))
  fi
}

echo "== scrub.sh and pre-commit-scan.sh proving test =="
echo "Sandbox: $SANDBOX"
echo ""
echo "-- scrub.sh --"

# Case 1: bare assignment, as pasted from a .env file.
OUT=$(scrub "the db ${PW_KEY}=${PW_VAL} and more")
assert_redacted "case 1: bare password assignment is redacted" "$PW_VAL" "$OUT"

# Case 2: quoted value with spaces.
OUT=$(scrub "${PW_KEY}: \"${PW_PHRASE}\"")
assert_redacted "case 2: quoted password with spaces is redacted" "$PW_PHRASE" "$OUT"

# Case 3: a JSON member. Only the value changes, so the line still parses.
OUT=$(scrub "{\"${PW_KEY}\":\"${PW_VAL}\",\"n\":1}")
assert_eq "case 3: JSON password member is redacted and keeps its quotes" \
  "{\"${PW_KEY}\":\"[REDACTED_PASSWORD]\",\"n\":1}" "$OUT"

# Case 4: Stripe live secret key.
OUT=$(scrub "stripe ${STRIPE_KEY} end")
assert_redacted "case 4: Stripe live key is redacted" "$STRIPE_KEY" "$OUT"

# Case 5: GitHub fine-grained personal access token.
OUT=$(scrub "token ${GH_FINE} end")
assert_redacted "case 5: GitHub fine-grained token is redacted" "$GH_FINE" "$OUT"

# Case 6: AWS secret access key assignment.
OUT=$(scrub "${AWS_SECRET_NAME}=${AWS_SECRET_VAL}")
assert_redacted "case 6: AWS secret access key assignment is redacted" "$AWS_SECRET_VAL" "$OUT"

# Case 7: a pattern the scrubber already carried.
OUT=$(scrub "token ${GH_CLASSIC} end")
assert_redacted "case 7: classic GitHub token is still redacted" "$GH_CLASSIC" "$OUT"

# Case 8: clean input passes through byte for byte.
CLEAN="Reset the ${PW_KEY} flow. The ${PW_KEY} policy needs 12 chars. Nothing secret: 42."
OUT=$(scrub "$CLEAN")
assert_eq "case 8a: prose that only mentions the word is unchanged" "$CLEAN" "$OUT"
CLEAN_JSON="{\"event\":\"x\",\"${PW_KEY}\":\"\",\"n\":1}"
OUT=$(scrub "$CLEAN_JSON")
assert_eq "case 8b: an empty JSON password member is unchanged" "$CLEAN_JSON" "$OUT"

# Case 9: the real write path. log-event.sh pipes every event through scrub.sh.
( cd "$PROJ" && bash "$LOG_EVENT" "\"event\":\"test.probe\",\"note\":\"${PW_KEY}=${PW_VAL} ${STRIPE_KEY}\"" >/dev/null 2>"$SANDBOX/err.log" )
METRICS="$PROJ/AI_DOCS/memory/metrics.jsonl"
if [[ -f "$METRICS" ]]; then
  assert_redacted "case 9: secrets handed to log-event.sh never reach metrics.jsonl" "$PW_VAL" "$(cat "$METRICS")"
  assert_redacted "case 9: the Stripe key in the same event is redacted too" "$STRIPE_KEY" "$(cat "$METRICS")"
else
  echo "FAIL: case 9: log-event.sh wrote no metrics.jsonl"
  FAILS=$((FAILS + 2))
fi
rm -rf "$PROJ/AI_DOCS"

echo ""
echo "-- pre-commit-scan.sh --"

# stage_only FILE CONTENT: make FILE the only staged file in the sandbox repo.
stage_only() {
  (
    cd "$PROJ" || exit 1
    git rm -r -q --cached . >/dev/null 2>&1
    rm -rf src
    mkdir -p src
    printf '%s\n' "$2" > "$1"
    git add -A . >/dev/null 2>&1
  )
}

# The scanner is invoked the way the installed pre-commit wrapper invokes it:
# cwd at the repository root, no stdin, the exit code is the verdict.
run_scan() {
  ( cd "$PROJ" && bash "$SCAN" >"$SANDBOX/out.log" 2>&1 )
  echo $?
}

# Case 10: PEM private key header, in a file whose name has a space.
stage_only "src/deploy key.pem" "$PEM_HEADER"
RC=$(run_scan)
assert_exit "case 10: PEM private key header blocks" 1 "$RC"
assert_out_has "case 10: block message names the file" "src/deploy key.pem"

# Case 11: the other shapes the catalogue lists.
stage_only "src/config.env" "AWS_KEY=${AWS_SESSION}"
RC=$(run_scan)
assert_exit "case 11a: AWS session key blocks" 1 "$RC"

stage_only "src/config.env" "GH_TOKEN=${GH_SERVER}"
RC=$(run_scan)
assert_exit "case 11b: GitHub server token blocks" 1 "$RC"

stage_only "src/config.env" "BROKER_URL=${AMQP_URL}"
RC=$(run_scan)
assert_exit "case 11c: amqp URL with credentials blocks" 1 "$RC"

stage_only "src/config.env" "STRIPE=${STRIPE_KEY}"
RC=$(run_scan)
assert_exit "case 11d: Stripe live key blocks" 1 "$RC"

stage_only "src/config.env" "GH_TOKEN=${GH_FINE}"
RC=$(run_scan)
assert_exit "case 11e: GitHub fine-grained token blocks" 1 "$RC"

stage_only "src/config.env" "${AWS_SECRET_NAME} = \"${AWS_SECRET_VAL}\""
RC=$(run_scan)
assert_exit "case 11f: AWS secret access key assignment blocks" 1 "$RC"

# Case 12: a pattern the scanner already carried.
stage_only "src/config.env" "AWS_KEY=${AWS_ACCESS}"
RC=$(run_scan)
assert_exit "case 12: AWS access key still blocks" 1 "$RC"

# Case 13: ordinary code. The password rule must stay out of the scanner.
stage_only "src/login.ts" "interface Login { ${PW_KEY}: string; }
const ${PW_KEY} = \"${PW_PHRASE}\";"
RC=$(run_scan)
assert_exit "case 13: a typed password field and a password string allow" 0 "$RC"

# Case 14: near misses.
stage_only "src/notes.md" "${D5} BEGIN NOTES ${D5} and --flag -x
broker at am""qp://rabbit.internal:5672/vhost
${AWS_SECRET_NAME} = \${AWS_SECRET_FROM_ENV}"
RC=$(run_scan)
assert_exit "case 14: dashes, a credential-free amqp URL and an env reference allow" 0 "$RC"

# Case 15: the real trigger. Install the scanner as the repository's pre-commit
# hook and let git decide. core.hooksPath is pinned so a global setting on the
# machine running this test cannot bypass the hook.
cat > "$PROJ/.git/hooks/pre-commit" <<EOF
#!/usr/bin/env bash
bash "$SCAN" || exit 1
EOF
chmod +x "$PROJ/.git/hooks/pre-commit" 2>/dev/null
commit() {
  ( cd "$PROJ" && git -c user.name=adf-test -c user.email=adf-test@example.invalid \
      -c commit.gpgsign=false -c core.hooksPath=.git/hooks \
      commit -q -m "$1" >"$SANDBOX/out.log" 2>&1 )
  echo $?
}

stage_only "src/deploy key.pem" "$PEM_HEADER"
RC=$(commit "must be refused")
if [[ "$RC" != "0" ]] && ! git -C "$PROJ" rev-parse -q --verify HEAD >/dev/null 2>&1; then
  echo "PASS: case 15a: git commit of a staged private key is refused (exit $RC, no commit created)"
else
  echo "FAIL: case 15a: git commit of a staged private key went through (exit $RC)"
  FAILS=$((FAILS + 1))
fi

stage_only "src/app.ts" "export const answer = 42;"
RC=$(commit "clean commit")
if [[ "$RC" == "0" ]] && git -C "$PROJ" rev-parse -q --verify HEAD >/dev/null 2>&1; then
  echo "PASS: case 15b: git commit of a clean file is accepted (exit 0, commit created)"
else
  echo "FAIL: case 15b: git commit of a clean file was refused (exit $RC)"
  sed 's/^/      output| /' "$SANDBOX/out.log" 2>/dev/null | head -5
  FAILS=$((FAILS + 1))
fi

echo ""
if [[ $FAILS -eq 0 ]]; then
  echo "RESULT: ALL ASSERTIONS PASSED (both directions proven)"
  exit 0
else
  echo "RESULT: $FAILS ASSERTION(S) FAILED"
  exit 1
fi
