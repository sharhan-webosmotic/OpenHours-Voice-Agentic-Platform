#!/usr/bin/env bash
# hooks/mavs-gate.sh: machine-checked milestone gate (MAVS Wave 1).
#
# Replaces self-attestation with parsed test-runner reports. On the promotion
# merge of a milestone branch, this PreToolUse backstop reads every
# AI_DOCS/quality/mavs/*.json and BLOCKS the merge if any report is FAIL
# (failed>0), STALE (source_commit != current git HEAD, i.e. code changed since
# the report was produced), unreadable, or a REQUIRED validator's report is
# missing. SKIP and MISSING_TOOL are printed but do not block on their own.
#
# Required validators are listed one-per-line in AI_DOCS/quality/mavs/required.txt
# (written by milestone-validation). If that file is absent, nothing is required,
# but any PRESENT failing/stale report still blocks (safe during transition).
#
# This is the fix for systemic problem P1: the old milestone-e2e-gate grepped a
# "Verdict: PASS" string the agent wrote about its own work. Now the verdict is
# parsed from the runner result. See docs/mavs-report-schema.md.
#
# Escape: ADF_SKIP_MAVS=on AND a recorded "ADF_SKIP_MAVS" line in decision-log.md
# (the toggle alone is not enough). POC projects are exempt.
#
# Runs on: PreToolUse for Bash (git merge of a milestone branch).
# Exit codes: 0 (allow) or 2 (block). Nothing else. No `set -e`. No jq required.
# Fails open on any infra error (missing python, etc.) so it never breaks an
# unrelated tool call: Python 3.12+ is a hard framework prerequisite.

set -uo pipefail

AI_DOCS_DIR="${AI_DOCS:-AI_DOCS}"
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

# Extract the command (jq when present, json-field.sh sed fallback otherwise).
if command -v jq >/dev/null 2>&1; then
  CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
else
  CMD=$(printf '%s' "$INPUT" | bash "$SELF_DIR/json-field.sh" command 2>/dev/null)
fi
[[ -z "$CMD" ]] && exit 0

# Only an integration merge concerns us.
#
# FF-018: this was two loose greps over the WHOLE command string, one for
# `git merge` and one for the substring `milestone`. It failed in BOTH
# directions on 2026-07-20:
#   - EVADED: passing the message via a file (`git merge -F msg.txt`) keeps the
#     word "milestone" out of the command, so the gate never fired at all.
#   - FALSE-POSITIVED: an ordinary `git commit` whose heredoc BODY contained the
#     words "git merge" and "milestone" was blocked as a branch integration. The
#     matcher could not tell a command from the content that command carries.
#
# Two changes close both. First, match only the FIRST line: a real merge puts
# `git merge` at a command position on line 1, while heredoc bodies live on
# later lines. Second, decide "is this an integration" from git STATE (the
# branch being merged INTO), which cannot be reworded in a commit message.
FIRST_LINE=$(printf '%s' "$CMD" | head -1)
printf '%s' "$FIRST_LINE" | grep -Eq '(^|[;&|]|&&)[[:space:]]*(cd[[:space:]][^;&|]*&&[[:space:]]*)?([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*git[[:space:]]+merge([[:space:]]|$)' || exit 0

# State, not argv: only merges INTO an integration branch are gated. A merge on
# a feature branch is the developer's own business.
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
case "$CURRENT_BRANCH" in
  develop | main | master | staging | release | release/*) ;;
  *) exit 0 ;;
esac

# Fast-forwarding the SAME branch from its own remote (`git merge origin/develop`
# while on develop) is a pull, not an integration. Never gate that.
if printf '%s' "$FIRST_LINE" | grep -Eq "git[[:space:]]+merge[[:space:]]+(--ff-only[[:space:]]+)?(origin|upstream)/${CURRENT_BRANCH}([[:space:]]|$)"; then
  exit 0
fi

# Locate AI_DOCS by walking up from the current working directory (cwd-safe).
BASE=""
DIR="$PWD"; HOPS=0
while [[ -n "$DIR" && "$DIR" != "/" && $HOPS -lt 12 ]]; do
  if [[ -d "$DIR/$AI_DOCS_DIR" ]]; then BASE="$DIR/$AI_DOCS_DIR"; break; fi
  PARENT="${DIR%/*}"; [[ "$PARENT" == "$DIR" ]] && break; DIR="$PARENT"; HOPS=$((HOPS + 1))
done
[[ -n "$BASE" ]] || exit 0

# POC projects are exempt.
if [[ -f "$BASE/memory/stack.md" ]] && grep -qi 'planning_depth:[[:space:]]*poc' "$BASE/memory/stack.md" 2>/dev/null; then
  exit 0
fi

# Verified escape: env toggle AND a recorded override in decision-log.md.
if [[ "${ADF_SKIP_MAVS:-off}" == "on" ]]; then
  if grep -qi "ADF_SKIP_MAVS" "$BASE/memory/decision-log.md" 2>/dev/null; then
    exit 0
  fi
  cat <<EOF >&2

========================================
  ADF MAVS GATE: override not recorded
========================================
ADF_SKIP_MAVS=on is set but decision-log.md has no matching entry.
Record the override first (append a "## Bypass — ADF_SKIP_MAVS" line with the
reason to AI_DOCS/memory/decision-log.md), then retry.
From hooks/mavs-gate.sh.
========================================
EOF
  exit 2
fi

MAVS_DIR="$BASE/quality/mavs"

# Resolve a Python 3.12+ interpreter (the report parser). Fail open if none.
PY=""
for c in python3.13 python3.12 python3 python; do
  if command -v "$c" >/dev/null 2>&1 \
     && "$c" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)" >/dev/null 2>&1; then
    PY="$c"; break
  fi
done
if [[ -z "$PY" ]]; then
  echo "[mavs-gate] WARNING: no Python 3.12+ found to parse MAVS reports; allowing the merge (fail-open). Install Python 3.12 (bash .claude/setup.sh)." >&2
  exit 0
fi

HEAD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

# Which commit must the reports be stamped at, and WHOSE reports do we read?
#
# Both were wrong at a promotion merge, and the check was unsatisfiable because
# of it (M03 recorded the symptom as "circular at the promotion step"; M05 hit
# it again). Standing on `main` about to merge `develop`:
#   - HEAD is main's tip, which the incoming reports were never run against, and
#   - the working tree still holds MAIN's old reports, so the gate was grading
#     the previous milestone's files against the wrong commit.
# It therefore reported 12x STALE no matter how clean the incoming branch was.
#
# The meaningful question is: "does the branch I am about to merge carry clean
# reports stamped at ITS OWN tip?" So resolve BOTH the reports and the expected
# commit from the merge SOURCE whenever one can be determined.
#
# Fail-safe: any failure to resolve the source falls back to the previous
# behaviour (working tree + HEAD). It never falls back to allowing the merge.
SCAN_DIR="$MAVS_DIR"
EXPECT_COMMIT="$HEAD_COMMIT"
TMP_MAVS=""

MERGE_FROM=""
# Quoted text (a -m "message") is dropped first. json-field.sh now hands over
# the decoded command, so a message word that happens to name a branch must not
# be taken for the merge source.
for tok in $(printf '%s' "$FIRST_LINE" | sed -E -e 's/.*git[[:space:]]+merge[[:space:]]+//' -e "s/\"[^\"]*\"//g" -e "s/'[^']*'//g" 2>/dev/null); do
  case "$tok" in -*) continue ;; esac
  if git rev-parse --verify --quiet "${tok}^{commit}" >/dev/null 2>&1; then
    MERGE_FROM="$tok"; break
  fi
done

if [[ -n "$MERGE_FROM" ]]; then
  SRC_COMMIT=$(git rev-parse "${MERGE_FROM}^{commit}" 2>/dev/null || echo "")
  # Repo-relative path of the MAVS dir, derived via git rather than by stripping
  # REPO_ROOT off MAVS_DIR as a string. On Git-Bash for Windows those two are in
  # DIFFERENT formats (`git rev-parse --show-toplevel` yields `D:/repo` while the
  # cwd walk yields `/d/repo`), so the strip silently no-ops, the extracted files
  # land one directory tree too deep, and the parser then globs an EMPTY dir:
  # no reports AND no required.txt, which means nothing is required and the gate
  # FAILS OPEN. That is the worst possible failure for a gate, it was caught only
  # by testing the direction that must BLOCK, and it is why `--show-prefix` (which
  # is always repo-relative and format-neutral) is used here instead.
  PREFIX=$(git -C "$DIR" rev-parse --show-prefix 2>/dev/null || echo "")
  if [[ -n "$SRC_COMMIT" ]]; then
    MAVS_REL="${PREFIX}${AI_DOCS_DIR}/quality/mavs"
    FILES=$(git ls-tree -r --name-only "$SRC_COMMIT" -- "$MAVS_REL" 2>/dev/null || echo "")
    if [[ -n "$FILES" ]]; then
      TMP_MAVS=$(mktemp -d 2>/dev/null || echo "")
      if [[ -n "$TMP_MAVS" ]]; then
        OK=1
        while IFS= read -r p; do
          [[ -z "$p" ]] && continue
          # Tree entry names come from the merge source, which a branch author
          # controls. A crafted tree can hold an entry named `..`, and git's
          # default fetch accepts it (fsck reports hasDotdot only as a warning),
          # so confine every write to the temp dir: reject absolute paths and
          # any `.` or `..` component before mkdir. A rejected extraction falls
          # back to the working tree like any other broken extraction.
          rel="${p#"$MAVS_REL"/}"
          if [[ "$rel" == "$p" || "$rel" == /* || "/$rel/" == *"/../"* || "/$rel/" == *"/./"* ]]; then
            echo "[mavs-gate] unsafe report path in ${MERGE_FROM}: refusing to extract '$p'" >&2
            OK=0
            break
          fi
          out="$TMP_MAVS/$rel"
          mkdir -p "$(dirname "$out")" 2>/dev/null
          git show "$SRC_COMMIT:$p" > "$out" 2>/dev/null || OK=0
        done <<< "$FILES"
        # Belt and braces: an extraction that produced no top-level *.json is a
        # broken extraction, not a clean milestone. Without this, an empty dir
        # reads as "no reports and nothing required" and the gate ALLOWS. Never
        # trust the extraction to have worked, verify it did.
        if [[ "$OK" == "1" ]] && ! ls "$TMP_MAVS"/*.json >/dev/null 2>&1; then
          echo "[mavs-gate] extraction produced no reports at the top level of the temp dir; falling back to the working tree" >&2
          OK=0
        fi
        if [[ "$OK" == "1" ]]; then
          SCAN_DIR="$TMP_MAVS"
          # Not the branch TIP: committing the reports themselves moves the tip,
          # so a tip comparison is the same chicken-and-egg one step along. The
          # question a stamp answers is "was this report produced against the
          # CODE being merged", so compare against the most recent commit on the
          # source ref that touched anything outside AI_DOCS/. Documentation
          # commits (the reports, the retrospective, the ledger) then correctly
          # do not invalidate a report.
          CODE_COMMIT=$(git rev-list -1 "$SRC_COMMIT" -- . ":(exclude)$AI_DOCS_DIR" 2>/dev/null || echo "")
          EXPECT_COMMIT="${CODE_COMMIT:-$SRC_COMMIT}"
          echo "[mavs-gate] grading ${MERGE_FROM}: reports from ${SRC_COMMIT:0:8}, expected stamp ${EXPECT_COMMIT:0:8} (last non-AI_DOCS commit)" >&2
        else
          rm -rf "$TMP_MAVS" 2>/dev/null; TMP_MAVS=""
        fi
      fi
    fi
  fi
fi

"$PY" - "$SCAN_DIR" "$EXPECT_COMMIT" <<'PYEOF'
import sys, os, json, glob

mavs_dir, head = sys.argv[1], sys.argv[2]

required = set()
req_file = os.path.join(mavs_dir, "required.txt")
if os.path.isfile(req_file):
    try:
        with open(req_file, encoding="utf-8") as f:
            for line in f:
                n = line.strip()
                if n and not n.startswith("#"):
                    required.add(n)
    except Exception:
        pass

reports = {}
block = []
warn = []

for p in sorted(glob.glob(os.path.join(mavs_dir, "*.json"))):
    bn = os.path.basename(p)
    # geometry.<width>.json is a DATA artifact (the rendered-geometry dump used by
    # the ui/fidelity validators and principal-designer), NOT a verdict report.
    # Skip it so it is never read as a pass/fail.
    if bn.startswith("geometry."):
        continue
    name = os.path.splitext(bn)[0]
    try:
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
    except Exception as e:
        block.append("%s: unreadable report (%s)" % (name, e))
        reports[name] = None
        continue
    # A verdict report carries a "status" field. Anything else (a stray data
    # artifact dropped into the mavs dir) is ignored, not misread as a report.
    if not isinstance(d, dict) or "status" not in d:
        continue
    reports[name] = d
    status = str(d.get("status", "")).upper()
    try:
        failed = int(d.get("failed", 0) or 0)
    except Exception:
        failed = 0
    sc = str(d.get("source_commit", "") or "")
    if status == "ADVISORY":
        # An ADVISORY report (ui-review aesthetics, the slop pilot lane) carries
        # no gate weight at all: not its failure counts, not its staleness.
        # Blocking on failed>0 here would contradict the documented doctrine
        # that ADVISORY never blocks (docs/mavs-report-schema.md).
        if failed > 0:
            warn.append("%s: ADVISORY with %d findings, not blocking" % (name, failed))
        elif head and sc and sc != head:
            warn.append("%s: ADVISORY report is stale (report commit %s != HEAD %s), not blocking"
                        % (name, sc[:8], head[:8]))
    elif status == "FAIL" or failed > 0:
        block.append("%s: status=%s failed=%d" % (name, status or "FAIL", failed))
    elif head and sc and sc != head:
        block.append("%s: STALE (report commit %s != HEAD %s) - code changed since this report"
                     % (name, sc[:8], head[:8]))
    elif status in ("SKIP", "MISSING_TOOL"):
        warn.append("%s: %s" % (name, status))

for r in sorted(required):
    if r not in reports:
        block.append("%s: REQUIRED validator report missing (AI_DOCS/quality/mavs/%s.json)" % (r, r))

for w in warn:
    sys.stderr.write("  [mavs] %s\n" % w)

if block:
    sys.stderr.write("\n")
    sys.stderr.write("========================================\n")
    sys.stderr.write("  ADF MAVS MILESTONE GATE\n")
    sys.stderr.write("========================================\n")
    sys.stderr.write("Refusing to merge this milestone branch: the machine-checked validation reports are not clean.\n\n")
    for b in block:
        sys.stderr.write("  BLOCK  %s\n" % b)
    sys.stderr.write("\nFix the failing validators and re-run /milestone-validation so the reports in\n")
    sys.stderr.write("AI_DOCS/quality/mavs/ are regenerated against the current commit, then retry the merge.\n")
    sys.stderr.write("POC projects and recorded overrides: export ADF_SKIP_MAVS=on (and log it in decision-log.md).\n")
    sys.stderr.write("From hooks/mavs-gate.sh.\n")
    sys.stderr.write("========================================\n")
    sys.exit(2)

sys.exit(0)
PYEOF
RC=$?
[[ -n "$TMP_MAVS" ]] && rm -rf "$TMP_MAVS" 2>/dev/null
[[ "$RC" -eq 2 ]] && exit 2
exit 0
