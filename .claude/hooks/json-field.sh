#!/usr/bin/env bash
# hooks/json-field.sh — extract a string field from hook JSON on stdin.
#
# Usage:  some-hook-json | bash .claude/hooks/json-field.sh file_path
# Fields: file_path, command, tool_name, ... (tool_input.* checked first,
#         then top-level).
#
# Uses jq when available, a sed fallback otherwise (jq is often absent on
# Windows Git Bash). Both paths print the same text for the same payload.
#
# Free-text fields (command, prompt, message, description) are printed
# JSON-decoded: \" becomes ", \n becomes a real newline, backslashes survive.
# The fallback used to stop at the first escaped quote and turn every backslash
# into a slash, so a command such as  cd "/path with space" && git reset --hard
# reached the Bash gates as  cd /  and every one of them failed open.
#
# Every other field is treated as a path or an identifier: backslashes are
# normalized to forward slashes so Windows paths match the framework's path
# regexes.
# Never exits non-zero: hook plumbing must never break a tool call.

set -u

FIELD="${1:-}"
[[ -z "$FIELD" ]] && exit 0

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

VALUE=""
DECODED=0
if command -v jq >/dev/null 2>&1; then
  VALUE=$(printf '%s' "$INPUT" | jq -r ".tool_input.${FIELD} // .${FIELD} // empty" 2>/dev/null || echo "")
  [[ -n "$VALUE" ]] && DECODED=1
fi
if [[ -z "$VALUE" ]]; then
  # One linear pass over the payload. Every JSON string is scanned as a token
  # ("any char that is not a quote or a backslash, or a backslash followed by
  # any char"), so a key spelled inside another value (always escaped there)
  # is never mistaken for a real key. The value of the LAST real "<field>": key
  # whose value is a string is printed raw (still JSON-escaped). The old sed
  # regex with a leading .* backtracked over the whole payload and took tens of
  # seconds on a 300 KB command. POSIX awk only.
  VALUE=$(printf '%s' "$INPUT" | LC_ALL=C awk -v want="$FIELD" '
    { s = (NR == 1) ? $0 : s "\n" $0 }
    END {
      n = length(s); i = 1; key = ""; val = ""; found = 0
      while (i <= n) {
        c = substr(s, i, 1)
        if (c != "\"") { i++; continue }
        j = i + 1
        while (j <= n) {
          d = substr(s, j, 1)
          if (d == "\\") { j += 2; continue }
          if (d == "\"") break
          j++
        }
        tok = substr(s, i + 1, j - i - 1)
        k = j + 1
        while (k <= n && substr(s, k, 1) ~ /[ \t\r\n]/) k++
        if (substr(s, k, 1) == ":" && tok == want) {
          k++
          while (k <= n && substr(s, k, 1) ~ /[ \t\r\n]/) k++
          if (substr(s, k, 1) == "\"") {
            m = k + 1
            while (m <= n) {
              d = substr(s, m, 1)
              if (d == "\\") { m += 2; continue }
              if (d == "\"") break
              m++
            }
            if (m <= n) { val = substr(s, k + 1, m - k - 1); found = 1 }
          }
        }
        i = j + 1
      }
      if (found) printf "%s", val
    }' 2>/dev/null)
fi

[[ -z "$VALUE" ]] && exit 0

case "$FIELD" in
  command|prompt|message|description)
    if [[ "$DECODED" -eq 0 ]]; then
      # JSON-unescape in one linear awk pass: split on backslashes, then each
      # piece starts with the escaped character. An empty piece is an escaped
      # backslash, and the piece after it is plain text. \" \n \t \/ decode,
      # \r is dropped, any other escape (é, \b) is kept as written. No
      # gsub: its replacement-string escaping differs between awks, and it is
      # quadratic on a long value in some of them. The result is printed
      # straight to stdout, so a decoded trailing newline is kept, as before.
      printf '%s' "$VALUE" | LC_ALL=C awk '
        { s = (NR == 1) ? $0 : s "\n" $0 }
        END {
          n = split(s, p, "\\")
          printf "%s", p[1]
          k = 2
          while (k <= n) {
            q = p[k]
            if (q == "") {
              printf "%s", "\\"
              if (k + 1 <= n) printf "%s", p[k + 1]
              k += 2
              continue
            }
            c = substr(q, 1, 1)
            if (c == "n") c = "\n"
            else if (c == "t") c = "\t"
            else if (c == "r") c = ""
            else if (c != "\"" && c != "/") c = "\\" c
            printf "%s%s", c, substr(q, 2)
            k++
          }
        }'
    else
      printf '%s' "$VALUE"
    fi
    ;;
  *)
    printf '%s' "$VALUE" | tr '\\' '/' | sed 's#//*#/#g'
    ;;
esac
exit 0
