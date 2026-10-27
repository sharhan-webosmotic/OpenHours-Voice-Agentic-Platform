#!/usr/bin/env bash
# scripts/sync-vendor.sh: review and (only on --apply) bump a vendored upstream.
#
# Usage:
#   bash .claude/scripts/sync-vendor.sh <name>                 # fetch upstream HEAD, write the FULL diff to a kept file, change nothing
#   bash .claude/scripts/sync-vendor.sh <name> --apply <sha>   # apply exactly the reviewed commit <sha>, run post-apply checks, move the pin
#   bash .claude/scripts/sync-vendor.sh --list            # list vendored upstreams and their pins
#
# Each vendor/<name>/ carries sync-spec.sh defining:
#   REPO=<git url>
#   vendor_copy <clone_dir> <vendor_dir>   copies the vetted subset into the vendor dir
#   post_apply  <vendor_dir>               optional: regenerate overlays, run tests (non-zero = fail)
# and an UPSTREAM.md whose "Pinned commit" row holds the 40-char commit.
#
# Why never automatic: vendored skills and data are prompt text the framework
# trusts. Pulling them unreviewed is a supply-chain risk, so a human reads the
# diff before the pin moves. No set -e (bounded, reportable failures).
set -u

FRAMEWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_ROOT="$FRAMEWORK_DIR/vendor"

if [[ "${1:-}" == "--list" ]]; then
  for d in "$VENDOR_ROOT"/*/; do
    [[ -f "$d/UPSTREAM.md" ]] || continue
    pin="$(grep -m1 -oE '[0-9a-f]{40}' "$d/UPSTREAM.md")"
    echo "$(basename "$d")  ${pin:0:7}"
  done
  exit 0
fi

NAME="${1:-}"
APPLY="no"; APPLY_SHA=""
if [[ "${2:-}" == "--apply" ]]; then
  APPLY="yes"; APPLY_SHA="${3:-}"
  if ! [[ "$APPLY_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "usage: sync-vendor.sh <name> --apply <40-char sha printed by the review run>" >&2
    exit 2
  fi
fi
VDIR="$VENDOR_ROOT/$NAME"
if [[ -z "$NAME" || ! -f "$VDIR/sync-spec.sh" || ! -f "$VDIR/UPSTREAM.md" ]]; then
  echo "usage: sync-vendor.sh <name> [--apply <sha>] | --list   (vendor/<name>/sync-spec.sh and UPSTREAM.md required)" >&2
  exit 2
fi
# shellcheck source=/dev/null
source "$VDIR/sync-spec.sh"

OLD_PIN="$(grep -m1 -oE '[0-9a-f]{40}' "$VDIR/UPSTREAM.md")"
WORK="$(mktemp -d 2>/dev/null || echo "$FRAMEWORK_DIR/../AI_DOCS/.temp/sync-vendor-$$")"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

echo "[sync-vendor] $NAME: fetching $REPO"
if ! git clone --quiet --depth 1 "$REPO" "$WORK/clone" 2>/dev/null; then
  echo "[sync-vendor] clone failed (network?). Nothing changed." >&2
  exit 1
fi
NEW_PIN="$(git -C "$WORK/clone" rev-parse HEAD)"
NEW_DATE="$(git -C "$WORK/clone" log -1 --format=%cs)"
echo "[sync-vendor] pinned ${OLD_PIN:0:7}, upstream HEAD ${NEW_PIN:0:7} ($NEW_DATE)"
# --apply binds to the commit the operator reviewed. If upstream moved since,
# refuse: the new HEAD has not been read by anyone.
if [[ "$APPLY" == "yes" && "$NEW_PIN" != "$APPLY_SHA" ]]; then
  echo "[sync-vendor] upstream HEAD is ${NEW_PIN:0:7}, not the reviewed ${APPLY_SHA:0:7}. Nothing changed. Re-run the review." >&2
  exit 1
fi
if [[ "$OLD_PIN" == "$NEW_PIN" ]]; then
  echo "[sync-vendor] up to date."
  exit 0
fi

mkdir -p "$WORK/candidate"
vendor_copy "$WORK/clone" "$WORK/candidate"
# Symlinks or special files in a vendored tree could point anywhere once copied.
if [[ -n "$(find "$WORK/candidate" ! -type f ! -type d 2>/dev/null | head -1)" ]]; then
  echo "[sync-vendor] upstream candidate contains symlinks or special files. Refusing:" >&2
  find "$WORK/candidate" ! -type f ! -type d >&2
  exit 1
fi

# The review artifact is the FULL content diff, kept outside the temp dir so
# the operator can actually read it (a --stat summary shows names, not code).
# In a project, AI_DOCS/.temp is the gitignored scratch area. In the framework
# repo itself there is no AI_DOCS, and creating one beside .claude/ would move
# the hook test sandboxes under an /AI_DOCS/ path the guards exempt, so use the
# gitignored skill-lab results folder there instead.
if [[ -d "$FRAMEWORK_DIR/../AI_DOCS" ]]; then
  REVIEW_DIR="$FRAMEWORK_DIR/../AI_DOCS/.temp/sync-vendor"
else
  REVIEW_DIR="$FRAMEWORK_DIR/skill-lab/results/sync-vendor"
fi
mkdir -p "$REVIEW_DIR" 2>/dev/null || REVIEW_DIR="$WORK"
REVIEW_FILE="$REVIEW_DIR/$NAME-${NEW_PIN:0:12}.diff"
: > "$REVIEW_FILE"
for sub in "$WORK/candidate"/*; do
  name="$(basename "$sub")"
  echo "---- diff: $name ----"
  git --no-pager diff --no-index --stat "$VDIR/$name" "$sub" 2>/dev/null || true
  git --no-pager diff --no-index "$VDIR/$name" "$sub" >> "$REVIEW_FILE" 2>/dev/null || true
done

if [[ "$APPLY" != "yes" ]]; then
  echo "[sync-vendor] full content diff: $REVIEW_FILE"
  echo "[sync-vendor] read it, executable files first. post_apply will RUN upstream code from this commit."
  echo "[sync-vendor] to apply exactly this commit: bash .claude/scripts/sync-vendor.sh $NAME --apply $NEW_PIN"
  exit 0
fi

for sub in "$WORK/candidate"/*; do
  name="$(basename "$sub")"
  rm -rf "${VDIR:?}/$name"
  cp -r "$sub" "$VDIR/$name"
done
if declare -F post_apply >/dev/null; then
  if ! post_apply "$VDIR"; then
    echo "[sync-vendor] post-apply checks FAILED. The new files are in place but the pin was not moved: fix or revert with git checkout -- vendor/$NAME" >&2
    exit 1
  fi
fi
sed "s/$OLD_PIN/$NEW_PIN/" "$VDIR/UPSTREAM.md" > "$WORK/UPSTREAM.md" && cp "$WORK/UPSTREAM.md" "$VDIR/UPSTREAM.md"
echo "[sync-vendor] pin moved to ${NEW_PIN:0:7}. Update the date in UPSTREAM.md, re-read the upstream workflow files and bump the consuming skill."
exit 0
