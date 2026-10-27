#!/usr/bin/env bash
# hooks/gate-status-read.sh: read ONE gate's or lock's state out of gate-status.md.
#
# gate-status.md is free-form. /plan seeds a "| Gate | Status | Date | Notes |"
# table, and later skills append lines such as "Gate UX-1: PASS" or
# "SCHEMA LOCKED 2026-07-14". The gates used to grep the whole file, or a whole
# line, for a pass word. A row reading
#   | Gate 1 | FAILED | - | api-contract not LOCKED yet |
# therefore passed Gate 1 on the word LOCKED, and a sentence that only mentioned
# "SCHEMA LOCKED" armed the schema lock. This helper reads the gate's OWN record
# and the status position on it, so every caller shares one parser.
#
# Usage:
#   gate-status-read.sh passed <file> <gate-id-ERE> <pass-token> [<pass-token>...]
#   gate-status-read.sh passed-first <file> <gate-id-ERE> <pass-token> [<pass-token>...]
#       Compatible with the old whole-line grep, with a negative screen: a record
#       that grep accepted is still accepted unless the gate's own status is
#       negative, and a record it rejected is still rejected. One mention reads:
#         - a table row: the cell under a Status / Verdict / Result / State
#           header, else the first cell (other than the id cell) that starts
#           with a status word. A notes cell never overrides a readable status
#           cell. When no cell is readable (a bare tick), the whole row is
#           screened: a pass token and no negative marker is a pass.
#         - a line: the text from the id up to the next gate id. A status word
#           right after the id decides ("Gate 1: PASSED (2 items pending)" passes,
#           "Gate 1: PENDING (was PASSED)" does not). Otherwise that text is
#           screened: a pass token and no negative marker is a pass. When it says
#           nothing and the line names no other gate, the whole line is screened
#           ("2026-08-01 Gate 1 PASSED", "- [x] Gate 1: PASSED").
#       Negative markers: failed, fail, fails, failing, pending, rejected,
#       blocked, incomplete, todo, tbd, in progress, not started, a negation in
#       front of a pass word (not passed, not yet approved), a struck-through
#       pass word (~~PASSED~~) and an alternatives list (PASS/FAIL). The bare
#       words no, open and concerns are not negative. At the status position
#       only, regressed, unlocked, lifted, revoked, reopened, expired, stale,
#       awaiting, waiting, draft and deferred also read as negative.
#       Several mentions combine as follows. A dashboard row (the gate's own row
#       in a table with a Status-type header) decides when one exists: the first
#       such row wins. Otherwise `passed` passes when ANY mention passes (the old
#       whole-file read) and `passed-first` lets the FIRST mention decide (the old
#       `head -1` read of the ship gate).
#       The id ERE is matched case-insensitively (write it lower-case). Gate 1 is
#       never Gate 1.5, Gate 10 or Gate 11. A lettered sub-gate (Gate 1A, Gate 1C)
#       counts for Gate 1 only when the file never mentions a plain Gate 1, and
#       then every readable sub-gate record must pass.
#   gate-status-read.sh marker <file> "<MARKER TEXT>"
#       A lock marker (SCHEMA LOCKED, SHELL LOCKED, ...) is armed when a line or
#       a table cell records it and does not negate, defer, or lift it.
#   gate-status-read.sh contract-locked <file>
#       The api-contract.md lock. The shapes are listed at that mode below. A
#       dedicated "api-contract.md lock" row or line outranks every other record
#       wherever it sits: LIFTED opens, LOCKED arms.
#
# Exit codes: 0 (yes: passed or armed) or 1 (no, or nothing readable).
# Prints one word on stdout for tests and debugging. No `set -e`. No jq.
# awk runs under LC_ALL=C, so emoji (4-byte ones included) are plain bytes, and
# a trailing CR is dropped from every line, so a CRLF file reads the same.

set -uo pipefail

MODE="${1:-}"
FILE="${2:-}"
[[ -n "$MODE" && -n "$FILE" && -f "$FILE" ]] || { echo "none"; exit 1; }
shift 2

IDRE=""
PASSSET=" "
PASSRE=""
MARKER=""
case "$MODE" in
  passed|passed-first)
    IDRE="${1:-}"
    [[ -n "$IDRE" ]] || { echo "none"; exit 1; }
    shift
    for tok in "$@"; do
      PASSSET="$PASSSET$(printf '%s' "$tok" | tr '[:upper:]' '[:lower:]') "
    done
    PASSRE=$(printf '%s' "$PASSSET" | sed 's/^ *//; s/ *$//; s/  */|/g')
    [[ -n "$PASSRE" ]] || { echo "none"; exit 1; }
    ;;
  marker)
    MARKER="${1:-}"
    [[ -n "$MARKER" ]] || { echo "none"; exit 1; }
    ;;
  contract-locked)
    IDRE='gate[ \t-]*1'
    PASSSET=" passed pass approved locked "
    PASSRE="passed|pass|approved|locked"
    ;;
  *)
    echo "none"; exit 1 ;;
esac

LC_ALL=C awk -v MODE="$MODE" -v IDRE="$IDRE" -v PASSSET="$PASSSET" -v PASSRE="$PASSRE" -v M="$MARKER" '
  # ---- helpers shared by the marker and contract-locked modes ----------------
  # Lower-case, drop emphasis, drop a leading emoji or bullet, trim the tail.
  function norm(s) {
    s = tolower(s)
    gsub(/[*_`~]/, "", s)
    sub(/^[^a-z]+/, "", s)
    sub(/[ \t]+$/, "", s)
    return s
  }
  function firstword(s,   w) { w = s; sub(/[^a-z].*$/, "", w); return w }
  function is_pass(s,   w) { w = firstword(s); return (w != "" && index(PASSSET, " " w " ") > 0) }
  # Does this text START with a status word, pass or not?
  function is_status(s,   w) {
    if (s == "") return 0
    w = firstword(s)
    if (w == "") return 0
    if (index(PASSSET, " " w " ") > 0) return 1
    if (index(VOCAB, " " w " ") > 0) return 1
    if (s ~ /^in[ -]progress/ || s ~ /^on hold/ || s ~ /^n\/a/) return 1
    if (w ~ /^un[a-z]+ed$/) return 1
    return 0
  }
  function verdict_of(s) { return (is_pass(s) ? "pass" : "nopass") }
  # Status carried by the text that follows the gate id on the same line or in
  # the same cell. Returns "" when that text does not start with a status word.
  function tail_status(t,   s, q) {
    sub(/^[ \t]*\([^)]*\)/, "", t)
    s = norm(t)
    if (is_status(s)) { RAWSTATUS = s; return verdict_of(s) }
    q = index(t, ":")
    if (q == 0) q = index(t, "=")
    if (q > 0) {
      s = norm(substr(t, q + 1))
      if (is_status(s)) { RAWSTATUS = s; return verdict_of(s) }
    }
    return ""
  }
  # Leftmost real occurrence of the gate id in low (already lower-case). Sets
  # IDPOS and IDLEN. Rejects "investigate 1", "Gate 10", "Gate 1.5", "Gate 1A".
  function findid(low,   off, p, l, nx, nx2, pv) {
    off = 0
    while (match(substr(low, off + 1), IDRE)) {
      p = off + RSTART; l = RLENGTH
      if (l < 1) return 0
      nx = substr(low, p + l, 1); nx2 = substr(low, p + l + 1, 1)
      pv = (p > 1) ? substr(low, p - 1, 1) : ""
      if (nx ~ /[0-9a-z]/ || (nx == "." && nx2 ~ /[0-9]/) || pv ~ /[0-9a-z_]/) { off = p; continue }
      IDPOS = p; IDLEN = l
      return 1
    }
    return 0
  }
  # Is the text before the id only list, heading, emphasis, or date decoration?
  function own_line(pre) {
    gsub(/[][ \t>#*_`~().:0-9TZ-]/, "", pre)
    return (pre == "")
  }
  # Verdict of the gate on this line: "pass", "nopass", or "" when the line is
  # not the gate own row or line. Leaves the status text in RAWSTATUS.
  function gate_verdict(line,   low, n, c, i, hs, idc, idp, idl, v, s) {
    RAWSTATUS = ""
    low = tolower(line)
    if (index(line, "|") > 0) {
      n = split(line, c, "|")
      hs = 0
      for (i = 1; i <= n; i++) if (norm(c[i]) == "status") hs = i
      if (hs > 0) { SCOL = hs; return "" }
      if (line ~ /^[ \t|:-]+$/) return ""
      idc = 0
      for (i = 1; i <= n; i++) if (findid(tolower(c[i]))) { idc = i; idp = IDPOS; idl = IDLEN; break }
      if (idc == 0) return ""
      if (SCOL > 0) {
        # The id sits in or after the Status column: a mention, not its own row.
        if (idc >= SCOL) return ""
        v = tail_status(substr(c[idc], idp + idl))
        if (v != "") return v
        s = norm(c[SCOL]); RAWSTATUS = s
        return verdict_of(s)
      }
      # No header seen. A status cell BEFORE the id means the row belongs to
      # another gate and only mentions this one.
      for (i = 1; i < idc; i++) if (is_status(norm(c[i]))) return ""
      v = tail_status(substr(c[idc], idp + idl))
      if (v != "") return v
      for (i = idc + 1; i <= n; i++) {
        s = norm(c[i])
        if (is_status(s)) { RAWSTATUS = s; return verdict_of(s) }
      }
      return ""
    }
    SCOL = 0
    if (!findid(low)) return ""
    if (!own_line(substr(line, 1, IDPOS - 1))) return ""
    return tail_status(substr(line, IDPOS + IDLEN))
  }
  function has_lift(s) { return (s ~ /lifted|unlock|not locked|not yet locked/) }

  # ---- the passed / passed-first reader ---------------------------------------
  # Like findid, but accepts only a lettered sub-gate: the id followed by ONE
  # letter and then a non-alphanumeric ("Gate 1A", "Gate 5C").
  function findsub(low,   off, p, l, nx, nx2, pv) {
    off = 0
    while (match(substr(low, off + 1), IDRE)) {
      p = off + RSTART; l = RLENGTH
      if (l < 1) return 0
      nx = substr(low, p + l, 1); nx2 = substr(low, p + l + 1, 1)
      pv = (p > 1) ? substr(low, p - 1, 1) : ""
      if (nx ~ /[a-z]/ && nx2 !~ /[0-9a-z]/ && pv !~ /[0-9a-z_]/) { IDPOS = p; IDLEN = l + 1; return 1 }
      off = p
    }
    return 0
  }
  function found(low) { return (SUBMODE ? findsub(low) : findid(low)) }
  # low with every real occurrence of this gate id blanked out.
  function blank_this(low,   out, h, k) {
    out = low
    while (found(out)) {
      h = ""; for (k = 0; k < IDLEN; k++) h = h "#"
      out = substr(out, 1, IDPOS - 1) h substr(out, IDPOS + IDLEN)
    }
    return out
  }
  # Lower-case text with decoration removed: checkboxes, struck text, inline
  # HTML, :emoji: codes, emoji and dashes (non-ASCII bytes), emphasis marks.
  function plain(s) {
    s = tolower(s)
    gsub(/\t/, " ", s)
    gsub(/~~[^~]*~~/, " ", s)
    gsub(/\[[ x]\]/, " ", s)
    gsub(/<[^>]*>/, " ", s)
    gsub(/:[a-z0-9+-]*_[a-z0-9_+-]*:/, " ", s)
    gsub(/[^ -~]/, " ", s)
    gsub(/[*_`~]/, "", s)
    return s
  }
  function struck(raw) { return (tolower(raw) ~ ("~~[^~]*(" PASSRE ")[^~]*~~")) }
  function has_pass(s,   t, n, w, i) {
    t = s; gsub(/[^a-z]+/, " ", t); n = split(t, w, " ")
    for (i = 1; i <= n; i++) if (index(PASSSET, " " w[i] " ") > 0) return 1
    return 0
  }
  # A negative marker anywhere in plain text s.
  function has_neg(s,   t, n, w, i, a, b) {
    if (s ~ /(^|[^a-z])(failed|fail|fails|failing|pending|rejected|blocked|incomplete|todo|tbd)([^a-z]|$)/) return 1
    if (s ~ /(^|[^a-z])(in[ -]progress|not[ -]started)([^a-z]|$)/) return 1
    if (s ~ ("(^|[^a-z])(not|never)( +(yet|been|be|fully))* +(" PASSRE ")([^a-z]|$)")) return 1
    # An alternatives list: a pass word joined by "/" to a word that is not one.
    t = s; gsub(/[^a-z\/ ]+/, " # ", t); gsub(/\//, " / ", t); n = split(t, w, " ")
    for (i = 2; i < n; i++) if (w[i] == "/") {
      a = (index(PASSSET, " " w[i-1] " ") > 0); b = (index(PASSSET, " " w[i+1] " ") > 0)
      if (a != b && w[i-1] ~ /^[a-z]+$/ && w[i+1] ~ /^[a-z]+$/) return 1
    }
    return 0
  }
  # The status word at the START of plain text s: "pass", "neg" or "".
  function at_start(s,   t, w, rest) {
    t = s; sub(/^[^a-z]+/, "", t)
    if (sub(/^(status|verdict|result|state)[^a-z]+/, "", t)) sub(/^[^a-z]+/, "", t)
    if (t ~ ("^(not|never)( +(yet|been|be|fully))* +(" PASSRE ")([^a-z]|$)")) return "neg"
    if (t ~ /^(in[ -]progress|not[ -]started|on[ -]hold|n\/a)([^a-z]|$)/) return "neg"
    w = t; sub(/[^a-z].*$/, "", w)
    if (w == "") return ""
    rest = substr(t, length(w) + 1)
    # pass/fail, passed-pending: a compound, not a clean status word.
    if (rest ~ /^ *[\/|] *[a-z]/ || rest ~ /^-[a-z]/) return ""
    if (index(PASSSET, " " w " ") > 0) return "pass"
    if (index(NEGSET, " " w " ") > 0) return "neg"
    return ""
  }
  # Verdict of one piece of text: "pass", "neg" or "" (silent). A status word at
  # the start of posraw decides first, then raw is screened as a whole.
  function text_verdict(raw, posraw,   s, v) {
    if (struck(raw)) return "neg"
    if (posraw != "") { v = at_start(plain(posraw)); if (v != "") return v }
    s = plain(raw)
    if (has_neg(s)) return "neg"
    if (has_pass(s)) return "pass"
    return ""
  }
  # One line (no pipes), or one cell read as a line. "x" when the gate is not
  # mentioned, else "pass", "neg" or "" (mentioned, nothing readable).
  function line_read(line,   low, rest, seg, v) {
    low = tolower(line)
    if (!found(low)) return "x"
    rest = substr(line, IDPOS + IDLEN)
    if (match(tolower(rest), ANYID)) rest = substr(rest, 1, RSTART - 1)
    seg = rest; sub(/^[ \t]*\([^)]*\)/, "", seg)
    if (seg == "") seg = " "
    v = text_verdict(rest, seg)
    if (v != "") return v
    if (match(blank_this(low), ANYID)) return ""
    return text_verdict(line, "")
  }
  # One table row. Sets DASH when this is the gate own row under a Status-type
  # header. Returns like line_read.
  function row_read(line,   n, c, i, low, idc, anyc, rest, seg, v, t) {
    n = split(line, c, "|")
    low = tolower(line)
    if (!match(low, ANYID)) {
      # A header row names no gate. Remember the Status-type column.
      for (i = 1; i <= n; i++) {
        t = plain(c[i]); gsub(/^ +| +$/, "", t)
        if (t ~ /^(status|verdict|result|state)$/) { SCOL = i; break }
      }
      return "x"
    }
    idc = 0
    for (i = 1; i <= n; i++) if (found(tolower(c[i]))) { idc = i; break }
    if (idc == 0) return "x"
    anyc = 0
    for (i = 1; i <= n; i++) if (match(tolower(c[i]), ANYID)) { anyc = i; break }
    # The row belongs to another gate and only mentions this one in a cell.
    if (anyc < idc) return line_read(c[idc])
    DASH = (SCOL > 0 && SCOL != idc) ? 1 : 0
    # 1. The id cell own tail: "| Gate 1: PASSED | 2026-08-01 |".
    found(tolower(c[idc]))
    rest = substr(c[idc], IDPOS + IDLEN)
    if (match(tolower(rest), ANYID)) rest = substr(rest, 1, RSTART - 1)
    seg = rest; sub(/^[ \t]*\([^)]*\)/, "", seg)
    v = at_start(plain(seg))
    if (v != "") return v
    # 2. The status cell.
    if (SCOL > 0 && SCOL != idc) {
      if (SCOL <= n) { v = text_verdict(c[SCOL], c[SCOL]); if (v != "") return v }
    } else {
      for (i = 1; i <= n; i++) {
        if (i == idc) continue
        if (at_start(plain(c[i])) != "") return text_verdict(c[i], c[i])
      }
    }
    # 3. Nothing readable: screen the whole row.
    t = line; gsub(/\|/, " ", t)
    return text_verdict(t, "")
  }

  BEGIN {
    VOCAB = " not no never pending fail failed blocked rejected reject concerns waived skipped todo open draft lifted locked regressed stale tbd na none incomplete partial conditional "
    NEGSET = " failed fail fails failing pending rejected reject blocked incomplete todo tbd regressed unlocked lifted revoked reopened expired stale awaiting waiting draft deferred "
    ANYID = "gate[ \t-]*(ux[ \t-]*)?[0-9]+|(^|[^a-z0-9_])ux[ \t-]*[0-9]+|g_ux[0-9]+"
    SCOL = 0; verdict = ""; armed = 0; own = ""; viagate = ""; ded = ""
    SUBMODE = 0; DASH = 0
    plainseen = 0; dashseen = 0; dashv = ""; anypass = 0; firstv = ""; subpass = 0; subneg = 0
  }

  { sub(/\r$/, "") }

  MODE == "passed" || MODE == "passed-first" {
    if (index($0, "|") == 0) SCOL = 0
    SUBMODE = 0; DASH = 0
    v = (index($0, "|") > 0) ? row_read($0) : line_read($0)
    if (v != "x") {
      plainseen = 1
      if (DASH && !dashseen) { dashseen = 1; dashv = v }
      if (v == "pass") anypass = 1
      if (firstv == "") firstv = (v == "pass") ? "pass" : "nopass"
    }
    SUBMODE = 1; DASH = 0
    v = (index($0, "|") > 0) ? row_read($0) : line_read($0)
    if (v == "pass") subpass = 1
    else if (v == "neg") subneg = 1
    next
  }

  MODE == "marker" {
    p = index($0, M)
    if (p == 0) next
    if (substr($0, p + length(M), 1) ~ /[A-Za-z]/) next
    if (has_lift(tolower($0))) next
    # Only the text of the same cell, or of the same line when there is no
    # table, can negate or defer the marker.
    pre = tolower(substr($0, 1, p - 1))
    q = 0
    for (i = length(pre); i >= 1; i--) if (substr(pre, i, 1) == "|") { q = i; break }
    cellpre = substr(pre, q + 1)
    if (cellpre ~ /(^|[^a-z])(not|no|never|isn.t|aren.t|wasn.t|won.t|until|before|will|would|should|shall|once|when|after|if|pending|awaiting|todo|tbd|to be|must be|without|missing|unless)([^a-z]|$)/) next
    # A row whose own status cell is a plain non-pass word does not arm a lock.
    if (index($0, "|") > 0) {
      n = split($0, c, "|"); bad = 0
      for (i = 1; i <= n; i++) if (norm(c[i]) ~ /^(pending|failed|fail|blocked|draft|todo|tbd|open)$/) bad = 1
      if (bad) next
    }
    armed = 1
    next
  }

  # contract-locked. The framework records the api-contract.md lock two ways:
  #   1. The contract names itself. A table row whose cell starts with
  #      "api-contract.md" (optionally "api-contract.md lock") and whose first
  #      later cell that talks about locking says LOCKED. Or a cell, list item,
  #      or line that reads "api-contract.md: LOCKED" or "api-contract.md LOCKED",
  #      and the "API Contract: LOCKED <date>" line tech-specification writes.
  #      LIFTED, UNLOCKED, and "not locked" in that position always mean open.
  #   2. "Gate 1 records LOCKED" (CLAUDE.md Section 7, memory-protocol, /plan):
  #      the Gate 1 own row or line whose status says LOCKED, or a passed Gate 1
  #      row that carries a bare LOCKED cell.
  # A record of kind 1 outranks kind 2, and the DEDICATED record (a row or line
  # named "api-contract.md lock", the one /change-request lifts and restores)
  # outranks every other record wherever it sits in the file. Among dedicated
  # records a LIFTED one wins, so the lift works in any position.
  MODE == "contract-locked" {
    line = $0; low = tolower(line)
    if (low ~ /api[ -]contract/) {
      n = split(line, seg, /[|,;]/)
      for (i = 1; i <= n; i++) {
        sn = norm(seg[i])
        if (sn !~ /^api[ -]contract(\.md)?( lock)?([^a-z]|$)/) continue
        isded = (sn ~ /^api[ -]contract(\.md)? lock([^a-z]|$)/)
        rest = sn
        sub(/^api[ -]contract(\.md)?/, "", rest)
        if (rest ~ /^ lock([^a-z]|$)/) sub(/^ lock/, "", rest)
        rest = norm(rest)
        this = ""
        if (rest != "") {
          # The word must be the upper-case token in the original text, so the
          # sentence "api-contract.md is locked once ..." never arms the lock.
          orig = seg[i]
          match(tolower(orig), /api[ -]contract(\.md)?/)
          orig = substr(orig, RSTART + RLENGTH)
          if (tolower(orig) ~ /^ lock([^a-z]|$)/) orig = substr(orig, 6)
          sub(/^[^A-Za-z]+/, "", orig)
          if (has_lift(rest)) this = "open"
          else if (orig ~ /^LOCKED([^A-Za-z]|$)/) this = "armed"
        } else if (index(line, "|") > 0) {
          # Name-only cell: the first later cell that talks about locking decides.
          for (j = i + 1; j <= n; j++) {
            cj = norm(seg[j])
            if (cj ~ /(^|[^a-z])(locked|lifted|unlocked)([^a-z]|$)/ || cj ~ /not locked/) {
              this = (has_lift(cj) ? "open" : "armed")
              break
            }
          }
        }
        if (this != "") {
          own = this
          if (isded && ded != "open") ded = this
        }
        break
      }
    }
    v = gate_verdict(line)
    if (v != "") {
      rs = RAWSTATUS
      if (has_lift(rs)) viagate = "open"
      else if (rs ~ /(^|[^a-z])locked([^a-z]|$)/ && rs !~ /(shell|schema|matrix) locked/) viagate = "armed"
      else if (v == "pass" && index(line, "|") > 0) {
        n2 = split(line, c2, "|"); bare = 0
        for (k = 1; k <= n2; k++) {
          t2 = c2[k]; sub(/^[^A-Za-z]+/, "", t2)
          if (t2 ~ /^LOCKED([^A-Za-z]|$)/) bare = 1
        }
        viagate = (bare ? "armed" : "open")
      }
      else viagate = "open"
    }
    next
  }

  END {
    if (MODE == "passed" || MODE == "passed-first") {
      r = 0
      if (plainseen) {
        if (dashseen) r = (dashv == "pass")
        else if (MODE == "passed-first") r = (firstv == "pass")
        else r = anypass
      } else if (subpass || subneg) r = (subpass && !subneg)
      print (r ? "pass" : ((plainseen || subpass || subneg) ? "nopass" : "none"))
      exit (r ? 0 : 1)
    }
    if (MODE == "marker") { print (armed ? "armed" : "open"); exit (armed ? 0 : 1) }
    if (ded != "") own = ded
    if (own == "") own = viagate
    print (own == "" ? "none" : own)
    exit (own == "armed" ? 0 : 1)
  }
' "$FILE" 2>/dev/null
exit $?
