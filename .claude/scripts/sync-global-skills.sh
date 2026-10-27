#!/usr/bin/env bash
# scripts/sync-global-skills.sh — mirror framework skills into ~/.claude/skills
#
# Why: Claude Code loads skills from the global ~/.claude/skills directory.
# After a `git pull` updates skills/ in this repo (SKILL.md files, python
# scripts, templates), the global mirror must be refreshed or sessions keep
# triggering the OLD scripts. upgrade.sh runs this as its final step, and
# the post-merge git hook runs upgrade.sh --auto after every pull, so the
# mirror self-heals on pull with no manual step.
#
# Safety:
#   - Only skill directories that EXIST IN THIS REPO are touched. Any other
#     skills the user installed globally are left alone.
#   - Each synced skill is replaced wholesale (delete + copy) so deletions
#     and renames in the repo propagate (e.g. retired template files).
#   - No-ops silently when ~/.claude/skills does not exist (project-local
#     installs have no global mirror).
#   - Refuses to run when the destination resolves inside this repo (the
#     standard install where .claude/skills IS the framework checkout).

set -u

FRAMEWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$FRAMEWORK_DIR/skills"
DEST="${ADF_GLOBAL_SKILLS_DIR:-$HOME/.claude/skills}"
CATALOG_FILE="${CATALOG_FILE_OVERRIDE:-$FRAMEWORK_DIR/skill-lab/catalog.yaml}"

[[ -d "$SRC" ]] || exit 0

# ----------------------------------------------------------------------------
# ADF-only allowlist (mirrors skill-lab/retrofit-frontmatter.sh).
# Only mirror skills authored as part of this framework. Skills pulled in from
# outside (Anthropic document skills we have NOT adopted, plugin installs,
# hand-dropped third-party skills, e.g. find-skills) must NOT be mirrored into
# the global directory, where they would masquerade as framework skills.
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

# Guard: if the catalog allowlist is empty (catalog missing/unreadable), do NOT
# silently skip every skill. Fall back to the old behaviour of mirroring all,
# and warn loudly so the operator can fix the catalog.
ALLOWLIST_ACTIVE=1
if [[ -z "$ADF_SKILL_NAMES" ]]; then
  ALLOWLIST_ACTIVE=0
  echo "  ⚠ no ADF skill names loaded from $CATALOG_FILE - mirroring ALL skill directories (catalog allowlist unavailable)"
fi

if [[ ! -d "$DEST" ]]; then
  echo "  (no global mirror at $DEST - skipping skills sync)"
  exit 0
fi

# The mirror must never be this repo's own skills dir, or a folder inside it:
# the rm -rf below would delete the source. Resolve the destination physically
# (pwd -P follows a symlink or junction, a logical pwd keeps the link name), then
# walk up its parents comparing by directory IDENTITY (-ef: same device and
# inode). Comparing path strings is not enough: on Git Bash one directory has
# several spellings (/tmp/x and /c/Users/NAME~1/AppData/Local/Temp/x).
DEST_RESOLVED="$(cd "$DEST" && pwd -P)"
_probe="$DEST_RESOLVED"
while :; do
  if [[ "$_probe" -ef "$SRC" ]]; then
    echo "  (global mirror is this repo itself - nothing to sync)"
    exit 0
  fi
  _parent="$(dirname "$_probe")"
  [[ "$_parent" == "$_probe" ]] && break
  _probe="$_parent"
done

synced=0
failed=0
external=0
for dir in "$SRC"/*/; do
  [[ -d "$dir" ]] || continue
  name="$(basename "$dir")"
  # External-skill guard: never mirror a skill that is not an ADF skill.
  if [[ $ALLOWLIST_ACTIVE -eq 1 ]] && ! is_adf_skill "$name"; then
    echo "  EXTERNAL (skipped): $name"
    external=$((external+1))
    continue
  fi
  rm -rf "${DEST_RESOLVED:?}/$name" 2>/dev/null || true
  # Copy the CONTENTS ("$dir".) into the target directory. If rm could not fully
  # remove the old copy (a file in use on Windows), copying the directory itself
  # would nest it as <name>/<name>/ and still report success.
  if mkdir -p "$DEST_RESOLVED/$name" 2>/dev/null && cp -r "$dir". "$DEST_RESOLVED/$name/" 2>/dev/null; then
    synced=$((synced+1))
  else
    echo "  WARN: failed to sync skill '$name'"
    failed=$((failed+1))
  fi
done

# ----------------------------------------------------------------------------
# Retired skills: a skill the framework REMOVED never appears in $SRC, so the
# loop above never touches its old mirror copy, and sessions keep listing and
# invoking it. Move each retired ADF skill out of the mirror into a dated
# archive (reversible). Only a directory whose SKILL.md names WebOsmotic as the
# author is moved, so a user's own skill with the same name is left alone.
# Keep this list in step with docs/skill-deprecations.md.
# ----------------------------------------------------------------------------
RETIRED_SKILLS="claude-md deployment design-system python-backend go-backend security-audit developer-workflow webapp-testing find-skills frd-generation diagram-creator list-plugins import-conventions project-kickoff team-feature team-design team-release"
retired=0
ARCHIVE_DIR="$(dirname "$DEST_RESOLVED")/skills-archive-retired"
for name in $RETIRED_SKILLS; do
  old_dir="$DEST_RESOLVED/$name"
  [[ -f "$old_dir/SKILL.md" ]] || continue
  grep -q "WebOsmotic" "$old_dir/SKILL.md" 2>/dev/null || continue
  mkdir -p "$ARCHIVE_DIR" 2>/dev/null || continue
  rm -rf "${ARCHIVE_DIR:?}/$name" 2>/dev/null || true
  if mv "$old_dir" "$ARCHIVE_DIR/$name" 2>/dev/null; then
    echo "  - retired skill moved out of the mirror: $name (kept in $ARCHIVE_DIR)"
    retired=$((retired+1))
  else
    echo "  WARN: could not move retired skill '$name' out of $DEST_RESOLVED"
  fi
done

# ----------------------------------------------------------------------------
# Vendored upstreams (v4.29.0): mirrored skills resolve their vendored data by
# the relative path ../../../vendor/<name> (deep-security-audit's validators,
# the ui-ux-pro-max design data), which from the mirror is ~/.claude/vendor.
# Mirror each vendor/<name>/ that carries an UPSTREAM.md, replacing the old copy.
# ----------------------------------------------------------------------------
VENDOR_DEST="$(dirname "$DEST_RESOLVED")/vendor"
vendored=0
for vdir in "$FRAMEWORK_DIR"/vendor/*/; do
  [[ -f "$vdir/UPSTREAM.md" ]] || continue
  vname="$(basename "$vdir")"
  mkdir -p "$VENDOR_DEST" 2>/dev/null || break
  rm -rf "${VENDOR_DEST:?}/$vname" 2>/dev/null || true
  if cp -r "$vdir" "$VENDOR_DEST/$vname" 2>/dev/null; then
    vendored=$((vendored+1))
  else
    echo "  WARN: could not mirror vendor/$vname to $VENDOR_DEST"
  fi
done

echo "  ✓ $synced framework skills mirrored to $DEST_RESOLVED"
[[ $vendored -gt 0 ]] && echo "  ($vendored vendored upstreams mirrored to $VENDOR_DEST)"
[[ $retired -gt 0 ]] && echo "  ($retired retired skills moved to $ARCHIVE_DIR)"
[[ $external -gt 0 ]] && echo "  ($external external/non-ADF skill directories left untouched)"
[[ $failed -gt 0 ]] && echo "  ⚠ $failed skills failed to sync - rerun: bash scripts/sync-global-skills.sh"
exit 0
