#!/usr/bin/env bash
# skill-lab/retrofit-frontmatter.sh
# Adds framework-standard metadata to all SKILL.md files missing it.
#
# Fields added (if absent):
#   license: Proprietary
#   compatibility: "Claude Code 1.x"
#   metadata.author: WebOsmotic Private Limited
#
# Does NOT overwrite existing values.
# Does NOT add allowed-tools (requires per-skill judgment from docs/allowed-tools-matrix.md).
#
# Usage:
#   ./skill-lab/retrofit-frontmatter.sh --dry-run      # default: show what would change
#   ./skill-lab/retrofit-frontmatter.sh --apply        # actually write changes
#   ./skill-lab/retrofit-frontmatter.sh --skill <name> # scope to one skill

set -euo pipefail

DRY_RUN=1
SCOPE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) DRY_RUN=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --skill) SCOPE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="${SKILLS_DIR_OVERRIDE:-$REPO_ROOT/skills}"
CATALOG_FILE="${CATALOG_FILE_OVERRIDE:-$REPO_ROOT/skill-lab/catalog.yaml}"

# ----------------------------------------------------------------------------
# ADF-only allowlist.
# Only skills authored as part of this framework get the proprietary
# frontmatter. Skills pulled in from outside (Anthropic document skills that
# we have NOT adopted, plugin installs, hand-dropped third-party skills, e.g.
# find-skills) must keep their original frontmatter untouched.
#
# The single source of truth for "is this an ADF skill" is the skill registry
# in skill-lab/catalog.yaml. A skill is ADF-authored if and only if its name
# appears as a `name:` entry under the `skills:` list (two-space indent;
# agent entries use a `- name:` list item and are not matched).
# ----------------------------------------------------------------------------
# The allowlist is a newline-separated string, not an associative array:
# `declare -A` needs bash 4, and stock macOS ships bash 3.2, where this script
# died before doing any work.
ADF_SKILL_NAMES=""
if [[ -f "$CATALOG_FILE" ]]; then
  ADF_SKILL_NAMES="$(grep -E '^  name:[[:space:]]' "$CATALOG_FILE" | sed -E 's/^  name:[[:space:]]*//; s/[[:space:]]+$//')"
fi
is_adf_skill() { printf '%s\n' "$ADF_SKILL_NAMES" | grep -qxF -- "$1"; }

if [[ -z "$ADF_SKILL_NAMES" ]]; then
  echo "ERROR: no ADF skill names loaded from $CATALOG_FILE." >&2
  echo "       Refusing to run: without the catalog allowlist this script" >&2
  echo "       cannot tell ADF skills from externally-installed ones and" >&2
  echo "       would stamp proprietary metadata onto third-party skills." >&2
  exit 1
fi

CHANGED=0
SKIPPED=0
EXTERNAL=0
TOTAL=0

for skill_dir in "$SKILLS_DIR"/*/; do
  SKILL_NAME=$(basename "$skill_dir")

  # Skip non-skill files
  [[ ! -f "$skill_dir/SKILL.md" ]] && continue

  # Scope filter
  if [[ -n "$SCOPE" && "$SKILL_NAME" != "$SCOPE" ]]; then
    continue
  fi

  # External-skill guard: never stamp a skill that is not an ADF skill.
  if ! is_adf_skill "$SKILL_NAME"; then
    EXTERNAL=$((EXTERNAL + 1))
    echo "EXTERNAL (skipped, not an ADF skill): $SKILL_NAME"
    continue
  fi

  TOTAL=$((TOTAL + 1))
  SKILL_FILE="$skill_dir/SKILL.md"

  # Check what's already present
  HAS_LICENSE=0
  HAS_COMPAT=0
  HAS_AUTHOR=0

  # Extract frontmatter block
  FM=$(awk '/^---/{c++; next} c==1{print} c>=2{exit}' "$SKILL_FILE")

  echo "$FM" | grep -qE '^license[[:space:]]*:' && HAS_LICENSE=1
  echo "$FM" | grep -qE '^compatibility[[:space:]]*:' && HAS_COMPAT=1
  echo "$FM" | grep -qE '^[[:space:]]*author[[:space:]]*:' && HAS_AUTHOR=1

  if [[ $HAS_LICENSE -eq 1 && $HAS_COMPAT -eq 1 && $HAS_AUTHOR -eq 1 ]]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Build the additions
  ADDITIONS=""
  [[ $HAS_LICENSE -eq 0 ]] && ADDITIONS="${ADDITIONS}license: Proprietary"$'\n'
  [[ $HAS_COMPAT -eq 0 ]] && ADDITIONS="${ADDITIONS}compatibility: \"Claude Code 1.x\""$'\n'

  if [[ $HAS_AUTHOR -eq 0 ]]; then
    # Check if metadata: block exists
    if echo "$FM" | grep -qE '^metadata[[:space:]]*:'; then
      # metadata exists but no author — we'll add author under it. Use a post-process sed.
      AUTHOR_INSERT=1
    else
      # metadata block doesn't exist at all
      ADDITIONS="${ADDITIONS}metadata:"$'\n'"  author: WebOsmotic Private Limited"$'\n'
      AUTHOR_INSERT=0
    fi
  else
    AUTHOR_INSERT=0
  fi

  CHANGED=$((CHANGED + 1))

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "WOULD CHANGE: $SKILL_NAME"
    [[ -n "$ADDITIONS" ]] && echo "  Add before closing ---:"
    echo "$ADDITIONS" | sed 's/^/    /'
    [[ $AUTHOR_INSERT -eq 1 ]] && echo "  Insert 'author: WebOsmotic Private Limited' under metadata:"
    echo "  Bump patch version (skill-versioning-rules: every edit bumps semver)"
    continue
  fi

  # APPLY: Use awk to insert before the closing --- of frontmatter
  TMP_FILE=$(mktemp)

  if [[ $AUTHOR_INSERT -eq 1 ]]; then
    # Add author under existing metadata: block + any other fields before closing ---
    # Any stamping is a SKILL.md edit, so the same pass bumps the patch version,
    # per rules/skill-versioning-rules.md (every edit bumps semver in the same edit).
    awk -v additions="$ADDITIONS" '
      BEGIN { state=0 }                             # 0=before-fm, 1=in-fm, 2=after-fm
      state==0 && /^---/ { print; state=1; next }
      state==1 && /^version:[[:space:]]*[0-9]+\.[0-9]+\.[0-9]+[[:space:]]*$/ {
        split($2, v, "."); printf "version: %s.%s.%d\n", v[1], v[2], v[3]+1; next
      }
      state==1 && /^metadata[[:space:]]*:/ { print; in_meta=1; next }
      state==1 && in_meta && /^[^[:space:]-]/ {
        print "  author: WebOsmotic Private Limited"
        in_meta=0
      }
      state==1 && /^---/ {
        if (in_meta) { print "  author: WebOsmotic Private Limited"; in_meta=0 }
        if (additions != "") printf "%s", additions
        print
        state=2
        next
      }
      { print }
    ' "$SKILL_FILE" > "$TMP_FILE"
  else
    # Insert block before closing --- (patch version bumped in the same pass,
    # per rules/skill-versioning-rules.md)
    awk -v additions="$ADDITIONS" '
      BEGIN { state=0 }
      state==0 && /^---/ { print; state=1; next }
      state==1 && /^version:[[:space:]]*[0-9]+\.[0-9]+\.[0-9]+[[:space:]]*$/ {
        split($2, v, "."); printf "version: %s.%s.%d\n", v[1], v[2], v[3]+1; next
      }
      state==1 && /^---/ {
        if (additions != "") printf "%s", additions
        print
        state=2
        next
      }
      { print }
    ' "$SKILL_FILE" > "$TMP_FILE"
  fi

  mv "$TMP_FILE" "$SKILL_FILE"
  echo "CHANGED: $SKILL_NAME"
done

echo ""
echo "Summary: adf=$TOTAL changed=$CHANGED skipped=$SKIPPED external=$EXTERNAL"
echo "(external = non-ADF skills left untouched; allowlist from $(basename "$CATALOG_FILE"))"
[[ $DRY_RUN -eq 1 ]] && echo "(dry-run, pass --apply to write changes)"
