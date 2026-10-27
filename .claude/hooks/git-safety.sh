#!/usr/bin/env bash
# hooks/git-safety.sh: block destructive git commands until the user confirms.
#
# Destructive means it can discard local work: git reset, git rebase (except
# --abort/--continue/--skip/--quit), git restore (except --staged alone),
# git clean with -f/--force, and git checkout that overwrites files
# (`checkout -- <path>`, `checkout .`, `checkout -f`, `checkout HEAD <path>`).
#
# v2: this used to be a one-line grep inside settings.template.json, then a long
# anchored regex there. The grep missed `git -C dir reset --hard` and
# `git checkout .`. The regex missed plain `git reset --hard` and every wrapped
# form. A readable script with its own test is the fix.
#
# How it reads the command:
#   1. Quoted strings collapse into one word (their spaces become an
#      unprintable byte), so `git commit -m "undo the git reset --hard"` and
#      `grep -r "git reset" .` are not mistaken for a reset.
#   2. The body of `bash -c '...'`, `eval "..."`, and of backticks or `$(...)`
#      inside double quotes is checked as a command of its own, because those
#      strings run.
#   3. The match is not anchored to command position: `git` counts wherever it
#      stands as a word, so wrappers (timeout, nohup, env, sudo, if, !, a
#      redirection, an assignment) cannot hide it. The price is that an
#      UNQUOTED mention such as `echo git reset --hard` blocks too. A false
#      block only asks the user, a miss loses their work.
#
# Runs on: PreToolUse for Bash. Exit codes: 0 (allow) or 2 (block). No jq.

set -uo pipefail

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0
CMD=$(printf '%s' "$INPUT" | bash "$(dirname "$0")/json-field.sh" command 2>/dev/null)
[[ -z "$CMD" ]] && exit 0

# Words of each command line, one command per output line (the main command
# first, then every nested script body, twice over for one level of nesting).
expand_cmd() {
  LC_ALL=C awk -v SP="$(printf '\001')" '
  function emit_subshells(s,   t) {
    t = s
    while (match(t, /`[^`]*`/)) { extra[++ne] = substr(t, RSTART + 1, RLENGTH - 2); t = substr(t, RSTART + RLENGTH) }
    t = s
    while (match(t, /\$\([^)]*\)/)) {
      body = substr(t, RSTART + 2, RLENGTH - 3)
      # A heredoc fed to cat is text (a commit message), not commands.
      if (body !~ /^[ 	]*cat[ 	]*<</) extra[++ne] = body
      t = substr(t, RSTART + RLENGTH)
    }
  }
  {
    line = $0; out = ""; q = ""; qbuf = ""; ne = 0
    n = length(line)
    for (i = 1; i <= n; i++) {
      ch = substr(line, i, 1)
      if (q == "") {
        if (ch == "\\" && i < n) { out = out substr(line, i + 1, 1); i++; continue }
        if (ch == "\"" || ch == "\047") { q = ch; qbuf = ""; continue }
        if (ch == "`") { out = out " ; "; continue }
        out = out ch
        continue
      }
      if (q == "\"" && ch == "\\" && i < n) { qbuf = qbuf substr(line, i + 1, 1); i++; continue }
      if (ch == q) {
        prev = out; sub(/[ \t]+$/, "", prev); sub(/.*[ \t;&|(]/, "", prev)
        if (prev == "eval" || prev ~ /^-[A-Za-z]*c$/) extra[++ne] = qbuf
        if (q == "\"") emit_subshells(qbuf)
        gsub(/[ \t]/, SP, qbuf)
        out = out qbuf; q = ""
        continue
      }
      qbuf = qbuf ch
    }
    if (q != "") { gsub(/[ \t]/, SP, qbuf); out = out qbuf }
    print out
    for (k = 1; k <= ne; k++) print extra[k]
  }'
}

LINES=$(printf '%s' "$CMD" | tr '\n\r' '  ' | expand_cmd | expand_cmd)

# git as a word (also /usr/bin/git, \git, "git", git.exe), then git's global
# options, then the subcommand.
G='(^|[^A-Za-z0-9_.-])git(\.exe)?([[:space:]]+(-c[[:space:]]+[^[:space:]]+|-C[[:space:]]+[^[:space:]]+|--(git-dir|work-tree|namespace|exec-path|config-env)([=[:space:]][^[:space:]]+)?|--[a-z-]+(=[^[:space:]]+)?|-[pP]))*[[:space:]]+'
E='([[:space:];&|)]|$)'
D="${G}(reset${E}|rebase${E}|restore${E}|clean[[:space:]]+([^;&|]*[[:space:]])?(-[A-Za-z]*f[A-Za-z]*|--force)${E}|checkout[[:space:]]+([^;&|]*[[:space:]])?(--[[:space:]]+[^[:space:];&|]|\.${E}|\./|-f${E}|--force${E}|(HEAD|@)([~^][0-9]*)*[[:space:]]+[^-[:space:];&|]))"
# Recovery and unstaging forms are safe. restore --staged stays safe only
# without --worktree/-W, which is checked separately.
SAFE=$(printf '%s\n' "$LINES" | sed -E "s/(rebase[[:space:]]+--(abort|continue|skip|quit|edit-todo|show-current-patch)|restore[[:space:]]+(--staged|-S))([[:space:];&|)]|\$)/ADFSAFE\4/g")

if printf '%s\n' "$SAFE" | grep -qE "$D" \
   || printf '%s\n' "$LINES" | grep -qE "${G}restore[[:space:]]+([^;&|]*[[:space:]])?(--worktree|-W)${E}"; then
  {
    echo ""
    echo "========================================"
    echo "  GIT SAFETY BLOCK"
    echo "========================================"
    echo "  Destructive git command detected:"
    echo "  $CMD"
    echo ""
    echo "  This command is IRREVERSIBLE and may"
    echo "  permanently discard local changes."
    echo ""
    echo "  ACTION REQUIRED: Ask the user for"
    echo "  explicit confirmation before running."
    echo "  Type the command yourself if approved."
    echo "========================================"
  } >&2
  exit 2
fi
exit 0
