#!/usr/bin/env bash
# upgrade.sh — Post-pull migration helper
#
# Run after `git pull` inside `.claude/` to:
#   1. Detect previous framework version
#   2. Apply mechanical migrations (frontmatter retrofit, deprecated-skill reference scan)
#   3. Prompt for any manual steps (CLAUDE.md regeneration, etc.)
#
# Usage:
#   bash upgrade.sh            # interactive
#   bash upgrade.sh --auto     # non-interactive, for hook-driven runs (post-merge, SessionStart)
#   bash upgrade.sh --quiet    # alias for --auto
#
# Design notes:
#   - `set -u` is on, but `set -e` is intentionally OFF. Each step is guarded
#     individually so a non-zero exit from one step (e.g. grep finding nothing)
#     never kills a later step. Previous versions used `set -euo pipefail` and
#     aborted mid-migration on pipe failures; see UPGRADING.md changelog.

set -u

AUTO_MODE=0
for arg in "$@"; do
  case "$arg" in
    --auto|--quiet) AUTO_MODE=1 ;;
    -h|--help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
  esac
done

FRAMEWORK_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$FRAMEWORK_DIR/.." && pwd)"
VERSION_FILE="$FRAMEWORK_DIR/.adf-version"
PREV_VERSION_FILE="$FRAMEWORK_DIR/.adf-version.previous"

# A clone at ~/.claude is a user-level install, not a project install. Its parent
# is the home directory, so every project step below would treat all of $HOME as
# the project (five recursive scans, a .gitignore and a pre-commit hook written
# there), and the hooks sync would wire project-relative hook commands into the
# settings that every session on this machine loads. Stamp the marker and stop.
if [[ -n "${HOME:-}" && -d "$HOME/.claude" && "$FRAMEWORK_DIR" -ef "$HOME/.claude" ]]; then
  echo "[upgrade] This clone is the user-level ~/.claude: project migration steps do not apply."
  cp "$VERSION_FILE" "$PREV_VERSION_FILE" 2>/dev/null || true
  exit 0
fi

cd "$PROJECT_DIR"

CURRENT_VERSION="$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]')"
[[ -z "$CURRENT_VERSION" ]] && CURRENT_VERSION="unknown"

PREV_VERSION="$(cat "$PREV_VERSION_FILE" 2>/dev/null | tr -d '[:space:]')"
[[ -z "$PREV_VERSION" ]] && PREV_VERSION="pre-3.1.0"

echo ""
echo "========================================================"
echo "  App Development Framework - Upgrade Helper"
echo "========================================================"
echo "  Previous version: $PREV_VERSION"
echo "  Current version:  $CURRENT_VERSION"
echo "  Project root:     $PROJECT_DIR"
[[ $AUTO_MODE -eq 1 ]] && echo "  Mode:             auto (non-interactive)"
echo "========================================================"
echo ""

# ------------------------------------------------------------------------
# Python floor check (v4.1.0+): the framework standardizes on Python 3.12+.
# markitdown ingestion needs 3.10+; state/db.py expects a current interpreter.
# Keeps every machine that pulls the framework on a supported Python.
# ------------------------------------------------------------------------
py_floor_ok() {
  local c
  for c in python3.13 python3.12 python3 python; do
    if command -v "$c" >/dev/null 2>&1 \
       && "$c" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)" >/dev/null 2>&1; then
      echo "$c"; return 0
    fi
  done
  return 1
}
if PY_OK_CMD="$(py_floor_ok)"; then
  echo "  ✓ Python floor: $("$PY_OK_CMD" --version 2>&1) ($PY_OK_CMD)"
else
  cur="$(for c in python3 python; do command -v "$c" >/dev/null 2>&1 && { "$c" --version 2>&1; break; }; done)"
  echo "  ⚠ ACTION REQUIRED — Python 3.12+ is now required (found: ${cur:-none})." >&2
  echo "    markitdown ingestion (skills/markitdown) will not run until you upgrade." >&2
  if [[ $AUTO_MODE -eq 0 ]]; then
    printf "    Run setup.sh now to install/upgrade Python 3.12? [y/N] " >&2
    read -r _py_ans < /dev/tty 2>/dev/null || _py_ans="n"
    if [[ "$_py_ans" =~ ^[Yy]$ ]]; then
      bash "$FRAMEWORK_DIR/setup.sh" --yes || true
    fi
  else
    echo "    Run: bash \"$FRAMEWORK_DIR/setup.sh\"   (installs/upgrades to 3.12)" >&2
  fi
fi
echo ""

# ------------------------------------------------------------------------
# Always-on: settings.json auto-sync against template
# Runs on EVERY upgrade.sh call regardless of version change.
# Any key present in settings.template.json but absent from settings.json
# is automatically injected. Existing keys are never overwritten.
# ------------------------------------------------------------------------
_USER_SETTINGS="$FRAMEWORK_DIR/settings.json"
_TEMPLATE="$FRAMEWORK_DIR/settings.template.json"
_PATCH_SCRIPT="$FRAMEWORK_DIR/scripts/patch-settings.sh"

echo "[settings-sync] Syncing settings.json against template..."
if [[ -f "$_USER_SETTINGS" ]] && [[ -f "$_TEMPLATE" ]] && [[ -f "$_PATCH_SCRIPT" ]]; then
  bash "$_PATCH_SCRIPT" "$_USER_SETTINGS" "$_TEMPLATE" \
    || echo "  ⚠ patch-settings.sh failed — run manually: bash .claude/scripts/patch-settings.sh .claude/settings.json .claude/settings.template.json"
elif [[ ! -f "$_USER_SETTINGS" ]]; then
  echo "  (no settings.json found — run bash .claude/setup.sh to create one)"
else
  echo "  ⚠ patch-settings.sh not found at $FRAMEWORK_DIR/scripts/patch-settings.sh"
fi
echo ""

# ------------------------------------------------------------------------
# Always-on: Remote Control lock (security posture, v4.12.1)
# patch-settings.sh (above) ADDS disableRemoteControl from the template only
# when the key is absent, and never overwrites an existing value. This step
# goes further: it FORCES disableRemoteControl to true on every pull, flipping
# an existing `false` back to `true`, so a project cannot silently run with
# Remote Control (claude.ai/code, `claude remote-control`, --remote-control/--rc,
# auto-start, in-session toggle) enabled. A project that genuinely needs Remote
# Control sets `"disableRemoteControl": false` in .claude/settings.local.json
# (gitignored personal overrides), which Claude Code merges on top of
# settings.json and which this step never touches. A timestamped backup is
# written only when the value actually changes.
# ------------------------------------------------------------------------
echo "[remote-control-lock] Enforcing disableRemoteControl=true in settings.json..."
if [[ -f "$_USER_SETTINGS" ]]; then
  _RC_PY="${PY_OK_CMD:-$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)}"
  if [[ -n "$_RC_PY" ]]; then
    "$_RC_PY" - "$_USER_SETTINGS" <<'PYEOF' || echo "  ⚠ remote-control-lock failed: set \"disableRemoteControl\": true manually in .claude/settings.json"
import json, shutil, sys, time

path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as f:
        s = json.load(f)
except Exception as exc:
    print(f"  skipped (parse error: {exc})")
    sys.exit(0)

if s.get("disableRemoteControl") is True:
    print("  disableRemoteControl already true - OK")
    sys.exit(0)

backup = f"{path}.backup.{time.strftime('%Y%m%d-%H%M%S')}"
try:
    shutil.copy2(path, backup)
    s["disableRemoteControl"] = True
    with open(path, "w", encoding="utf-8") as f:
        json.dump(s, f, indent=2, ensure_ascii=False)
        f.write("\n")
except Exception as exc:
    print(f"  skipped (write error: {exc})")
    sys.exit(0)

# Plain ASCII only: Windows Python consoles often use cp1252 and a
# UnicodeEncodeError here would misreport the enforcement as failed.
print("  disableRemoteControl set to true (backup: " + backup + ")")
PYEOF
  else
    echo "  (python not found: set \"disableRemoteControl\": true manually in .claude/settings.json)"
  fi
else
  echo "  (no settings.json found: the template already carries disableRemoteControl=true for setup.sh)"
fi
echo ""

# ------------------------------------------------------------------------
# Always-on: hooks wiring sync (framework owns the "hooks" section)
# patch-settings.sh only ADDS missing keys — it never refreshes a changed
# hook command. Stale command strings have caused blocking PreToolUse
# errors (e.g. the v4.1.0 enforce-anchors jq wrapper). On every upgrade
# run, replace the whole "hooks" object in settings.json with the
# template's version. A timestamped backup is written when anything
# changes. Personal hooks belong in .claude/settings.local.json, which
# Claude Code merges on top and which this step never touches.
# ------------------------------------------------------------------------
echo "[hooks-sync] Syncing hooks wiring in settings.json from template..."
if [[ -f "$_USER_SETTINGS" ]] && [[ -f "$_TEMPLATE" ]]; then
  # Reuse the >=3.12 interpreter validated by py_floor_ok above; only fall back
  # to a bare resolution if the floor check did not find a capable interpreter.
  _PY_CMD="${PY_OK_CMD:-$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)}"
  if [[ -n "$_PY_CMD" ]]; then
    "$_PY_CMD" - "$_USER_SETTINGS" "$_TEMPLATE" <<'PYEOF' || echo "  ⚠ hooks-sync failed — refresh manually: bash .claude/setup.sh --update-settings"
import json, shutil, sys, time

user_path, tmpl_path = sys.argv[1], sys.argv[2]
try:
    with open(user_path, encoding="utf-8") as f:
        user = json.load(f)
    with open(tmpl_path, encoding="utf-8") as f:
        tmpl = json.load(f)
except Exception as exc:
    print(f"  skipped (parse error: {exc})")
    sys.exit(0)

if user.get("hooks") == tmpl.get("hooks"):
    print("  hooks wiring already current - OK")
    sys.exit(0)

backup = f"{user_path}.backup.{time.strftime('%Y%m%d-%H%M%S')}"
try:
    shutil.copy2(user_path, backup)
    user["hooks"] = tmpl.get("hooks", {})
    with open(user_path, "w", encoding="utf-8") as f:
        json.dump(user, f, indent=2, ensure_ascii=False)
        f.write("\n")
except Exception as exc:
    print(f"  skipped (write error: {exc})")
    sys.exit(0)

# Plain ASCII only: Windows Python consoles often use cp1252 and a
# UnicodeEncodeError here would misreport the sync as failed.
print("  hooks wiring updated from template (backup: " + backup + ")")
PYEOF
  else
    echo "  (python not found — skipping hooks sync; run bash .claude/setup.sh --update-settings)"
  fi
else
  echo "  (settings.json or template missing — skipping)"
fi
echo ""

# ------------------------------------------------------------------------
# Always-on: ensure AI_DOCS runtime entries exist in project .gitignore
# Runs on EVERY upgrade.sh call so any project that pulls the framework
# gets these entries without needing a fresh setup.sh run.
# ------------------------------------------------------------------------
_GITIGNORE="$PROJECT_DIR/.gitignore"
echo "[gitignore-sync] Ensuring AI_DOCS runtime entries in .gitignore..."
if [[ -f "$_GITIGNORE" ]]; then
  _AI_ENTRIES=(
    "AI_DOCS/.temp/"
    "AI_DOCS/memory/figma-snapshots/Screens/"
    "AI_DOCS/*.txt"
    "!AI_DOCS/review-mode.txt"
    "AI_DOCS/*.py"
    "AI_DOCS/design/samples/"
    "AI_DOCS/design/src/"
    "AI_DOCS/memory/.prompt-counter"
    "AI_DOCS/memory/compaction-snapshot.md"
    "AI_DOCS/memory/metrics.jsonl"
    "AI_DOCS/audit/agent-log.md"
    ".impeccable/config.local.json"
    ".impeccable/hook.ndjson"
  )
  _GI_ADDED=0
  for _entry in "${_AI_ENTRIES[@]}"; do
    if ! grep -qF "$_entry" "$_GITIGNORE" 2>/dev/null; then
      if [[ $_GI_ADDED -eq 0 ]]; then
        printf "\n# ─── AI_DOCS — Temp & Generated Files (added by upgrade.sh) ────\n" >> "$_GITIGNORE"
        _GI_ADDED=1
      fi
      printf "%s\n" "$_entry" >> "$_GITIGNORE"
      echo "  + $_entry"
    fi
  done
  [[ $_GI_ADDED -eq 0 ]] && echo "  AI_DOCS runtime entries already present — OK" || echo "  ✓ .gitignore updated"
else
  echo "  (No .gitignore found at project root — skipping; run setup.sh to create one)"
fi
echo ""

# ------------------------------------------------------------------------
# Always-on: MCP server sync (v4.8.0)
# Seed / top-up the project's .mcp.json with free (Enforced) MCP servers
# matched to the stack, per rules/mcp-rules.md. Free servers only — no
# credentials, no Gated servers, never overwrites an existing entry. Runs on
# EVERY upgrade so already-deployed projects get MCP acceleration on pull.
# ------------------------------------------------------------------------
_MCP_MIGRATE="$FRAMEWORK_DIR/scripts/migrate-mcp.sh"
if [[ -f "$_MCP_MIGRATE" ]]; then
  bash "$_MCP_MIGRATE" "$PROJECT_DIR" \
    || echo "  ⚠ migrate-mcp.sh reported an issue — run manually: bash .claude/scripts/migrate-mcp.sh"
else
  echo "[mcp-sync] (scripts/migrate-mcp.sh not found — skipping)"
fi
echo ""

# ------------------------------------------------------------------------
# Always-on: migrate the DB-schema artifact name (schema.md -> database-schema.md)
# Canonicalized 2026-06-29. Older projects hold architecture/schema.md from the
# old scaffold; skills now read database-schema.md, so rename it in place.
# Best-effort, idempotent, guarded, never aborts the upgrade.
# ------------------------------------------------------------------------
_ARCH_DIR="$PROJECT_DIR/AI_DOCS/architecture"
if [[ -f "$_ARCH_DIR/schema.md" && ! -f "$_ARCH_DIR/database-schema.md" ]]; then
  if [[ -d "$PROJECT_DIR/.git" ]] && git -C "$PROJECT_DIR" ls-files --error-unmatch "AI_DOCS/architecture/schema.md" >/dev/null 2>&1; then
    git -C "$PROJECT_DIR" mv "AI_DOCS/architecture/schema.md" "AI_DOCS/architecture/database-schema.md" 2>/dev/null \
      || mv "$_ARCH_DIR/schema.md" "$_ARCH_DIR/database-schema.md" 2>/dev/null || true
  else
    mv "$_ARCH_DIR/schema.md" "$_ARCH_DIR/database-schema.md" 2>/dev/null || true
  fi
  [[ -f "$_ARCH_DIR/database-schema.md" ]] && echo "[schema-migrate] Renamed AI_DOCS/architecture/schema.md -> database-schema.md"
fi

# ------------------------------------------------------------------------
# Shared steps: global skills mirror sync + settings hash stamp.
# Both run on EVERY upgrade.sh call, including the early exit just below when
# the version string is unchanged. A pull that changes skills or the settings
# template without bumping .adf-version must still refresh ~/.claude/skills and
# record the template hash. Otherwise sessions keep running the old skill
# scripts, and hooks/version-check.sh re-runs this script at the next session.
# ------------------------------------------------------------------------
sync_global_skills() {
  local sync_script="$FRAMEWORK_DIR/scripts/sync-global-skills.sh"
  if [[ -f "$sync_script" ]]; then
    bash "$sync_script" || echo "  WARN: skills sync reported issues - rerun: bash scripts/sync-global-skills.sh"
  else
    echo "  (scripts/sync-global-skills.sh not found - skipping)"
  fi
}

stamp_settings_hash() {
  local template_file="$FRAMEWORK_DIR/settings.template.json"
  local hash_file="$FRAMEWORK_DIR/.adf-settings.hash"
  [[ -f "$template_file" ]] || return 0
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$template_file" 2>/dev/null | awk '{print $1}' > "$hash_file" 2>/dev/null || true
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$template_file" 2>/dev/null | awk '{print $1}' > "$hash_file" 2>/dev/null || true
  elif command -v cksum >/dev/null 2>&1; then
    cksum "$template_file" 2>/dev/null | awk '{print $1"-"$2}' > "$hash_file" 2>/dev/null || true
  fi
}

if [[ "$PREV_VERSION" == "$CURRENT_VERSION" ]]; then
  echo "[skills-sync] Global skills mirror sync..."
  sync_global_skills
  stamp_settings_hash
  echo ""
  echo "Settings synced. Already on $CURRENT_VERSION — no version migration needed."
  exit 0
fi

# ------------------------------------------------------------------------
# Self-heal: ensure core.hooksPath points to tracked hooks/git/ so future
# `git pull`s trigger post-merge automatically. Idempotent.
# ------------------------------------------------------------------------
if [[ -d "$FRAMEWORK_DIR/.git" ]]; then
  CURRENT_HOOKS_PATH="$(git -C "$FRAMEWORK_DIR" config --get core.hooksPath 2>/dev/null || true)"
  if [[ -z "$CURRENT_HOOKS_PATH" && -d "$FRAMEWORK_DIR/hooks/git" ]]; then
    git -C "$FRAMEWORK_DIR" config core.hooksPath hooks/git 2>/dev/null || true
    echo "  [self-heal] core.hooksPath -> hooks/git (post-merge auto-migration enabled)"
    echo ""
  fi
fi

# ------------------------------------------------------------------------
# Step 1 - Frontmatter retrofit for framework skills
# Also covers any project-level custom skills, since in the standard install
# `.claude/skills/` IS the framework skills directory.
# ------------------------------------------------------------------------
echo "[1/4] Frontmatter retrofit - adds license, author, compatibility to SKILL.md files"
echo ""
# The retrofit EDITS tracked SKILL.md files. Run from a hook (--auto, after every
# git pull and at session start) it dirtied the clone whenever a release shipped
# a skill without the stamped fields, and the next pull then aborted with "local
# changes would be overwritten". Hook-driven runs therefore skip it. Stamping is
# a maintainer step before a release: run this script without --auto, or set
# ADF_MAINTAINER=1 to keep the old stamp-on-pull behaviour on a maintainer machine.
if [[ ! -f "$FRAMEWORK_DIR/skill-lab/retrofit-frontmatter.sh" ]]; then
  echo "  (retrofit-frontmatter.sh not found - skipping)"
elif [[ $AUTO_MODE -eq 1 && "${ADF_MAINTAINER:-0}" != "1" ]]; then
  echo "  (skipped in auto mode: it edits tracked SKILL.md files and would block the next pull)"
  echo "  Maintainers stamp before a release: bash .claude/skill-lab/retrofit-frontmatter.sh --apply"
else
  bash "$FRAMEWORK_DIR/skill-lab/retrofit-frontmatter.sh" --apply 2>&1 | tail -5 || true
fi
echo ""

# ------------------------------------------------------------------------
# Step 2 - Scan for references to removed skills
# ------------------------------------------------------------------------
echo "[2/4] Scanning for references to deprecated skills..."
echo ""

REMOVED_SKILLS=("claude-md" "deployment" "design-system" "python-backend" "go-backend" "diagram-creator" "list-plugins" "import-conventions" "project-kickoff" "team-feature" "team-design" "team-release")
FOUND_REFS=0

# Scan scope: in a deployed install (framework dir IS .claude inside a project)
# scan the project, excluding .claude itself. In a dev checkout of the framework
# repo, scan ONLY the framework dir — sibling folders are unrelated collections.
SCAN_ROOT="$PROJECT_DIR"
if [[ "$(basename "$FRAMEWORK_DIR")" != ".claude" ]]; then
  SCAN_ROOT="$FRAMEWORK_DIR"
fi

# Files that reference old skill names BY DESIGN (rename history, alias maps,
# migration instructions). Flagging these is noise, not a finding.
INTENTIONAL_REFS='(UPGRADING\.md|upgrade\.sh|skill-deprecations\.md|SKILL-REFERENCE\.md|project-context/SKILL\.md|README\.md)$'

for skill in "${REMOVED_SKILLS[@]}"; do
  # Pattern notes: \b alone is wrong here — the hyphen is a word boundary, so
  # "/deployment\b" matches "/deployment-planning" (the REPLACEMENT), and
  # folder paths like "design-system/tokens.json" match "/design-system\b".
  # Require: a non-name char BEFORE the slash (else "cloud/deployment" prose
  # matches) and a next char that is neither a name char NOR "-" NOR "/".
  MATCHES="$(grep -rlnE "(^|[^a-zA-Z0-9_])/$skill([^a-zA-Z0-9_/-]|\$)" "$SCAN_ROOT" \
    --include="*.md" --include="*.json" --include="*.yaml" --include="*.sh" \
    --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir=".claude" \
    2>/dev/null | grep -vE "$INTENTIONAL_REFS" | head -5 || true)"
  if [[ -n "$MATCHES" ]]; then
    echo "  References to /$skill found in your project:"
    echo "$MATCHES" | sed 's/^/       /'
    FOUND_REFS=$((FOUND_REFS + 1))
  fi
done

if [[ $FOUND_REFS -eq 0 ]]; then
  echo "  No stale references found."
else
  echo ""
  echo "  Migration needed - replace the old skill names (remove any lines naming them"
  echo "  in your CLAUDE.md / AI_DOCS/memory/active-skills.md; they resolve via the alias table):"
  echo "    /claude-md       -> /project-context"
  echo "    /deployment      -> /deployment-planning or /deployment-execution"
  echo "    /design-system   -> /design-discovery, /design-tokens, or /design-screens"
  echo "    /python-backend  -> /build (via /do) + fastapi-specialist agent"
  echo "    /go-backend      -> /build (via /do) + go-specialist agent"
  echo "    /diagram-creator -> diagram-design plugin (/diagram-design:export-diagram for PNG)"
  echo "    /list-plugins       -> /install-plugin list"
  echo "    /import-conventions -> /share-decision import"
  echo "    /project-kickoff    -> /session-management (Triage Routing section)"
  echo "    /team-feature       -> /do (Phase 1 lead dispatch)"
  echo "    /team-design        -> /do (Phase 1 lead dispatch)"
  echo "    /team-release       -> /do (Phase 3 plus gate-enforcement Gate 5)"
fi
echo ""

# ------------------------------------------------------------------------
# Retired skill directories left behind (v4.32.0). In a git-managed install
# the pull removes them, but a hand-copied .claude/ keeps the directory, and
# Claude Code lists any skills/<name>/SKILL.md it finds. Move each retired
# WebOsmotic-authored directory out of skills/ into the project's gitignored
# scratch area (reversible), the same move sync-global-skills.sh makes for
# the user-level mirror. A user's own skill with the same name is left alone.
# ------------------------------------------------------------------------
if [[ "$(basename "$FRAMEWORK_DIR")" == ".claude" ]]; then
  _RETIRED_ARCHIVE="$PROJECT_DIR/AI_DOCS/.temp/retired-skills"
  for skill in "${REMOVED_SKILLS[@]}"; do
    _old_dir="$FRAMEWORK_DIR/skills/$skill"
    [[ -f "$_old_dir/SKILL.md" ]] || continue
    grep -q "WebOsmotic" "$_old_dir/SKILL.md" 2>/dev/null || continue
    mkdir -p "$_RETIRED_ARCHIVE" 2>/dev/null || continue
    rm -rf "${_RETIRED_ARCHIVE:?}/$skill" 2>/dev/null || true
    if mv "$_old_dir" "$_RETIRED_ARCHIVE/$skill" 2>/dev/null; then
      echo "  - retired skill left in skills/ moved to AI_DOCS/.temp/retired-skills/$skill"
    else
      echo "  WARN: could not move retired skill directory skills/$skill (remove it by hand)"
    fi
  done
fi

# ------------------------------------------------------------------------
# Renamed or merged rule files (v4.32.0). A project note that names the old
# path dangles after the pull. Report it with the replacement, same scan
# scope and exclusions as the retired-skill scan above.
# ------------------------------------------------------------------------
RENAMED_RULES=("rules/code-rules.md=>rules/development-rules.md" "rules/compliance/secrets.md=>rules/secrets-patterns.md")
_RULE_REFS=0
for pair in "${RENAMED_RULES[@]}"; do
  _old="${pair%%=>*}"; _new="${pair##*=>}"
  _hits="$(grep -rlF "$_old" "$SCAN_ROOT" \
    --include="*.md" --include="*.json" --include="*.yaml" --include="*.sh" \
    --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir=".claude" \
    2>/dev/null | grep -vE "$INTENTIONAL_REFS" | head -5 || true)"
  if [[ -n "$_hits" ]]; then
    echo "  References to $_old found in your project (it is now $_new):"
    echo "$_hits" | sed 's/^/       /'
    _RULE_REFS=$((_RULE_REFS + 1))
  fi
done
[[ $_RULE_REFS -gt 0 ]] && echo "  Update those paths by hand. The rule content moved, nothing was dropped."
echo ""

# ------------------------------------------------------------------------
# Always-on (v4.28.0): strip token-heavy @-imports from the project CLAUDE.md
# Older /project-context output @-imported rule files and whole AI_DOCS
# files (api-contract, component-registry, design-dna), which loaded into
# every session and subagent. Replaced with on-demand pointers, with a backup.
# ------------------------------------------------------------------------
echo "[claude-imports] Checking the project CLAUDE.md for @-imports..."
if [[ -f "$PROJECT_DIR/CLAUDE.md" ]] && [[ -f "$FRAMEWORK_DIR/scripts/strip-claude-imports.sh" ]]; then
  bash "$FRAMEWORK_DIR/scripts/strip-claude-imports.sh" "$PROJECT_DIR/CLAUDE.md" || true
else
  echo "  (no project CLAUDE.md, skipping)"
fi
echo ""

# ------------------------------------------------------------------------
# Step 3 - CLAUDE.md staleness check (marker-based, no more false positives)
# ------------------------------------------------------------------------
echo "[3/4] CLAUDE.md staleness check..."
echo ""

CLAUDE_MD="$PROJECT_DIR/CLAUDE.md"
NEEDS_REGEN=0

if [[ -f "$CLAUDE_MD" ]]; then
  # Single source of truth: look for a hidden marker comment.
  # Any CLAUDE.md generated by /project-context in v3.1+ carries
  #   <!-- adf-version: 3.1.0 -->
  # (or later). Absence of the marker OR an older version number
  # means regeneration is recommended.
  MARKER_LINE="$(grep -E '<!-- adf-version: [0-9]+\.[0-9]+\.[0-9]+ -->' "$CLAUDE_MD" 2>/dev/null | head -1 || true)"
  if [[ -z "$MARKER_LINE" ]]; then
    NEEDS_REGEN=1
    echo "  Your CLAUDE.md has no adf-version marker - likely generated by v3.0 or older."
  else
    CLAUDE_MD_VERSION="$(echo "$MARKER_LINE" | sed -E 's/.*adf-version: ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
    # Compare major.minor only; patch drift is not a regen trigger.
    CUR_MM="$(echo "$CURRENT_VERSION" | cut -d. -f1,2)"
    CMD_MM="$(echo "$CLAUDE_MD_VERSION" | cut -d. -f1,2)"
    if [[ "$CMD_MM" != "$CUR_MM" ]]; then
      NEEDS_REGEN=1
      echo "  Your CLAUDE.md is on v$CLAUDE_MD_VERSION; framework is on v$CURRENT_VERSION."
    else
      echo "  CLAUDE.md is current (adf-version marker: $CLAUDE_MD_VERSION)."
    fi
  fi

  if [[ $NEEDS_REGEN -eq 1 ]]; then
    echo ""
    echo "  Action: open Claude Code in this project and run:"
    echo "    /project-context"
    echo ""
    echo "  This regenerates CLAUDE.md from your current AI_DOCS/memory/ state"
    echo "  with the latest gates and skill references."
  fi
else
  echo "  (No CLAUDE.md found - run /session-management if this is a new project.)"
fi
echo ""

# ------------------------------------------------------------------------
# Step 4 - settings.json drift check (v3.2+ hooks awareness)
# settings.json is gitignored (user's personal copy). On version jumps it can
# fall behind settings.template.json and miss new hook events. We detect
# missing event keys and instruct the user to reconcile.
# ------------------------------------------------------------------------
echo "[4/6] settings.json freshness check..."
echo ""

USER_SETTINGS="$FRAMEWORK_DIR/settings.json"
TEMPLATE_SETTINGS="$FRAMEWORK_DIR/settings.template.json"
MISSING_EVENTS=()

if [[ -f "$USER_SETTINGS" ]] && [[ -f "$TEMPLATE_SETTINGS" ]]; then
  # Expect these hook event keys in any v3.2+ settings.json.
  REQUIRED_EVENTS=("PreToolUse" "PostToolUse" "PreCompact" "UserPromptSubmit" "Notification" "SessionStart" "Stop" "SubagentStart" "SubagentStop")
  for ev in "${REQUIRED_EVENTS[@]}"; do
    if ! grep -q "\"$ev\"" "$USER_SETTINGS" 2>/dev/null; then
      MISSING_EVENTS+=("$ev")
    fi
  done

  if [[ ${#MISSING_EVENTS[@]} -gt 0 ]]; then
    echo "  ACTION REQUIRED - your settings.json is missing hook events:"
    for ev in "${MISSING_EVENTS[@]}"; do
      echo "       - $ev"
    done
    echo ""
    echo "  These events were added in recent versions and won't fire without wiring."
    echo "  Fastest fix: back up your settings.json and regenerate from template."
    echo ""
    echo "    bash .claude/setup.sh --update-settings"
    echo ""
    echo "  --update-settings creates settings.json.backup.YYYYMMDD-HHMMSS before"
    echo "  overwriting. Reinstate any custom permissions from the backup manually."
  else
    echo "  settings.json has all expected hook events - OK"
  fi

  # Check for required permission rules (v4.0.1+)
  MISSING_PERMS=()
  grep -qF '"Read(./AI_DOCS/**)"' "$USER_SETTINGS" 2>/dev/null || MISSING_PERMS+=('allow: "Read(./AI_DOCS/**)"')
  grep -qF '"Read(./.env)"'       "$USER_SETTINGS" 2>/dev/null || MISSING_PERMS+=('deny: "Read(./.env)"')
  grep -qF '"Read(./.env.*)"'     "$USER_SETTINGS" 2>/dev/null || MISSING_PERMS+=('deny: "Read(./.env.*)"')

  if [[ ${#MISSING_PERMS[@]} -gt 0 ]]; then
    echo ""
    echo "  ACTION REQUIRED - your settings.json is missing permission rules (v4.0.1+):"
    for p in "${MISSING_PERMS[@]}"; do
      echo "       - $p"
    done
    echo ""
    echo "  These rules explicitly allow AI_DOCS reads and block .env file access."
    echo "  Run: bash .claude/setup.sh --update-settings"
    # Merge into MISSING_EVENTS so the auto-mode pending-migration notice captures them.
    MISSING_EVENTS+=("${MISSING_PERMS[@]}")
  else
    echo "  settings.json permission rules — AI_DOCS read allowed, .env denied - OK"
  fi

else
  echo "  (No settings.json found. Run bash .claude/setup.sh to create it from template.)"
fi
echo ""

# ------------------------------------------------------------------------
# Step 5 - Pre-commit hook install (secrets scanner, auto-installed)
# ------------------------------------------------------------------------
echo "[5/6] Pre-commit secrets scanner..."
echo ""

PRE_COMMIT_HOOK="$PROJECT_DIR/.git/hooks/pre-commit"
SCAN_SCRIPT="$FRAMEWORK_DIR/hooks/pre-commit-scan.sh"

# Auto-install the secrets scanner as a thin wrapper that execs the tracked
# script, so updates propagate on pull without reinstalling. Idempotent (grep
# guard), never clobbers a user's own pre-commit hook, best-effort (never aborts).
#
# The wrapper looks for the scanner in the current worktree first, then in the
# MAIN worktree. .claude/ is gitignored, so a linked worktree (git worktree add,
# the builder agent's isolation) has no .claude/ of its own, and the older
# one-line wrapper failed there with "No such file or directory" and blocked
# every commit. When no scanner can be found at all (framework removed) the
# wrapper allows the commit instead of blocking it.
write_precommit_wrapper() {
  {
    printf '%s\n' '#!/usr/bin/env bash'
    printf '%s\n' '# ADF secrets scanner (auto-installed by upgrade.sh). Execs the tracked'
    printf '%s\n' '# scanner so updates propagate on pull. Delete this file to disable.'
    printf '%s\n' '# Looks in this worktree first, then in the main worktree (a linked worktree'
    printf '%s\n' '# has no .claude/ because it is gitignored). No scanner found: allow the commit.'
    printf '%s\n' 'f="$(git rev-parse --show-toplevel)/.claude/hooks/pre-commit-scan.sh"'
    printf '%s\n' '[ -f "$f" ] || f="$(cd "$(git rev-parse --git-common-dir)/.." 2>/dev/null && pwd)/.claude/hooks/pre-commit-scan.sh"'
    printf '%s\n' '[ -f "$f" ] || exit 0'
    printf '%s\n' 'exec bash "$f" "$@"'
  } > "$PRE_COMMIT_HOOK" 2>/dev/null && chmod +x "$PRE_COMMIT_HOOK" 2>/dev/null
}

if [[ -d "$PROJECT_DIR/.git" ]]; then
  _HOOKS_PATH="$(git -C "$PROJECT_DIR" config --get core.hooksPath 2>/dev/null || true)"
  if [[ ! -f "$SCAN_SCRIPT" ]]; then
    echo "  (scanner script missing at $SCAN_SCRIPT - skipping)"
  elif [[ -n "$_HOOKS_PATH" ]]; then
    echo "  ⚠ This repo sets core.hooksPath=$_HOOKS_PATH; .git/hooks/pre-commit is bypassed."
    echo "    Add the scanner to your hook manager:  bash .claude/hooks/pre-commit-scan.sh || exit 1"
  elif [[ -f "$PRE_COMMIT_HOOK" ]] && grep -q "auto-installed by upgrade.sh" "$PRE_COMMIT_HOOK" 2>/dev/null \
       && ! grep -q -e "--git-common-dir" "$PRE_COMMIT_HOOK" 2>/dev/null; then
    # An older auto-installed wrapper (no main-worktree fallback): rewrite it.
    # A hook the user wrote or edited by hand lacks the marker and is left alone.
    if write_precommit_wrapper; then
      echo "  ✓ Pre-commit secrets scanner wrapper refreshed (now works in linked git worktrees)"
    else
      echo "  ⚠ Could not rewrite .git/hooks/pre-commit - delete it and re-run: bash .claude/upgrade.sh"
    fi
  elif [[ -f "$PRE_COMMIT_HOOK" ]] && grep -q "pre-commit-scan.sh" "$PRE_COMMIT_HOOK" 2>/dev/null; then
    echo "  ✓ Pre-commit secrets scanner already installed - OK"
  elif [[ -f "$PRE_COMMIT_HOOK" ]]; then
    echo "  ⚠ A different .git/hooks/pre-commit exists - not overwriting."
    echo "    Add the scanner by appending:  bash .claude/hooks/pre-commit-scan.sh || exit 1"
  else
    mkdir -p "$PROJECT_DIR/.git/hooks" 2>/dev/null || true
    if write_precommit_wrapper; then
      echo "  ✓ Installed pre-commit secrets scanner (.git/hooks/pre-commit -> .claude/hooks/pre-commit-scan.sh)"
    else
      echo "  ⚠ Could not write .git/hooks/pre-commit - install manually (see docs/secrets-policy.md):"
      echo "    cp \"$SCAN_SCRIPT\" \"$PRE_COMMIT_HOOK\" && chmod +x \"$PRE_COMMIT_HOOK\""
    fi
  fi
else
  echo "  (Not a git repo - skipping hook install.)"
fi
echo ""

# ------------------------------------------------------------------------
# Step 6 — AI_DOCS directory structure: plans/ → planning/ + quality/ scaffold
# ------------------------------------------------------------------------
echo "[6/6] AI_DOCS directory structure check..."
echo ""

PLANNING_DIR="$PROJECT_DIR/AI_DOCS/planning"
PLANS_DIR="$PROJECT_DIR/AI_DOCS/plans"
QUALITY_DIR="$PROJECT_DIR/AI_DOCS/quality"

if [[ -d "$PROJECT_DIR/AI_DOCS" ]]; then
  # Scaffold quality/ if missing (drift-detector.sh writes drift-report.md here)
  if [[ ! -d "$QUALITY_DIR" ]]; then
    mkdir -p "$QUALITY_DIR" 2>/dev/null || true
    echo "  ✓ AI_DOCS/quality/ created (drift-detector output directory)"
  else
    echo "  AI_DOCS/quality/ already exists — OK"
  fi

  # Seed control-registry.md when missing (v4.20.1, PLAN-v4.20 C-5).
  # drift-detector.sh Phase I reconciles this ledger on every 24h scan and
  # silently skips when it is absent, so existing projects need the seed too.
  if [[ -f "$QUALITY_DIR/control-registry.md" ]]; then
    echo "  AI_DOCS/quality/control-registry.md already exists (kept)"
  elif [[ -f "$FRAMEWORK_DIR/templates/control-registry.md" ]]; then
    cp "$FRAMEWORK_DIR/templates/control-registry.md" "$QUALITY_DIR/control-registry.md" 2>/dev/null || true
    echo "  ✓ AI_DOCS/quality/control-registry.md seeded (drift-detector Phase I control ledger)"
  fi

  # Stable project id + state database for projects installed before setup.sh
  # created them. Without the id every such project shares
  # ~/.adf/projects/default/state.db, so /history-query mixes projects. db.py
  # resolves the id relative to the current directory, hence the subshell cd.
  if [[ ! -s "$PROJECT_DIR/.claude-project-id" ]] && [[ -n "${PY_OK_CMD:-}" ]]; then
    _NEW_PROJECT_ID="$("$PY_OK_CMD" -c "import uuid; print(uuid.uuid4())" 2>/dev/null | tr -d '[:space:]')"
    if [[ -n "$_NEW_PROJECT_ID" ]] && printf '%s\n' "$_NEW_PROJECT_ID" > "$PROJECT_DIR/.claude-project-id" 2>/dev/null; then
      ( cd "$PROJECT_DIR" && "$PY_OK_CMD" "$FRAMEWORK_DIR/state/db.py" init >/dev/null 2>&1 ) || true
      echo "  ✓ .claude-project-id created and state database initialised ($_NEW_PROJECT_ID)"
    fi
  fi

  # Migrate plans/ → planning/ (planning/ is the canonical path)
  if [[ -d "$PLANS_DIR" ]] && [[ ! -d "$PLANNING_DIR" ]]; then
    if [[ $AUTO_MODE -eq 1 ]]; then
      mv "$PLANS_DIR" "$PLANNING_DIR" 2>/dev/null || true
      echo "  ✓ AI_DOCS/plans/ auto-migrated to AI_DOCS/planning/"
    else
      echo "  ACTION RECOMMENDED — AI_DOCS/plans/ should be renamed to AI_DOCS/planning/"
      echo "  AI_DOCS/planning/ is the canonical path. Run:"
      echo "    mv AI_DOCS/plans AI_DOCS/planning"
      echo ""
    fi
  elif [[ -d "$PLANS_DIR" ]] && [[ -d "$PLANNING_DIR" ]]; then
    echo "  ⚠ Both AI_DOCS/plans/ and AI_DOCS/planning/ exist — move contents into planning/ and delete plans/ manually"
  else
    echo "  AI_DOCS/planning/ is the canonical path — OK"
  fi
else
  echo "  (No AI_DOCS/ directory found — skipping)"
fi
echo ""

# ------------------------------------------------------------------------
# Step 7 - Global skills mirror sync (~/.claude/skills)
# After a pull, the global skills mirror (what Claude Code actually loads)
# must pick up the new SKILL.md files, python scripts, and templates.
# ------------------------------------------------------------------------
echo "[7/7] Global skills mirror sync..."
echo ""

sync_global_skills
echo ""

# ------------------------------------------------------------------------
# Finalize - update .adf-version.previous + .adf-settings.hash markers
# (best effort). The hash marker lets hooks/version-check.sh detect hook-wiring
# drift independent of the version string, so a new hook propagates even on a
# fast-forward pull that did not bump .adf-version.
# ------------------------------------------------------------------------
if [[ -f "$VERSION_FILE" ]]; then
  cp "$VERSION_FILE" "$PREV_VERSION_FILE" 2>/dev/null || true
fi
stamp_settings_hash

echo "========================================================"
echo "  Upgrade complete - now on $CURRENT_VERSION"
echo "========================================================"
echo ""

if [[ $AUTO_MODE -eq 0 ]]; then
  echo "  Next steps (recommended, in order):"
  [[ ${#MISSING_EVENTS[@]} -gt 0 ]] && echo "    1. Reconcile settings.json:   bash .claude/setup.sh --update-settings"
  [[ $NEEDS_REGEN -eq 1 ]]          && echo "    2. Refresh CLAUDE.md in Claude Code: /project-context"
  [[ $FOUND_REFS -gt 0 ]]           && echo "    3. Fix stale references to removed skills (incl. /python-backend, /go-backend) listed above"
  echo "    4. Review UPGRADING.md 'After you pull' section for version-specific steps"
  echo ""
fi

# In auto mode, also surface missing events as a visible notice so the user
# sees it next session even if they weren't watching the post-merge output.
if [[ $AUTO_MODE -eq 1 ]] && [[ ${#MISSING_EVENTS[@]} -gt 0 ]]; then
  MIG_NOTICE="$PROJECT_DIR/AI_DOCS/memory/pending-migration.md"
  mkdir -p "$(dirname "$MIG_NOTICE")" 2>/dev/null || true
  cat > "$MIG_NOTICE" <<EOF
# Pending Framework Migration: v$PREV_VERSION -> v$CURRENT_VERSION

**Detected**: $(date '+%Y-%m-%d %H:%M:%S')
**Status**:   PENDING - awaiting user confirmation

## settings.json is missing hook events

Your local \`.claude/settings.json\` does not have these events that v$CURRENT_VERSION ships:

$(printf -- '- %s\n' "${MISSING_EVENTS[@]}")

None of the associated hooks will fire until you reconcile.

## Action

\`\`\`
bash .claude/setup.sh --update-settings
\`\`\`

This backs up your current \`settings.json\` to \`settings.json.backup.<timestamp>\` and
regenerates from the v$CURRENT_VERSION template. Reinstate any custom permissions from
the backup manually.

Delete this file when done.
EOF
fi
