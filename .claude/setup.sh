#!/usr/bin/env bash
# =============================================================================
# claude-skills — setup.sh
#
# Run this ONCE after cloning the repo as .claude/:
#   git clone https://github.com/bhavesh-webosmotic/claude-skills .claude
#   bash .claude/setup.sh
#
# What it does:
#   1. Creates settings.json from template (skips if already exists)
#   2. Scaffolds AI_DOCS/ directories
#   3. Copies CLAUDE.md template to project root (skips if already exists)
#   4. Creates .gitignore with .claude/ excluded
#
# To update the framework later:
#   cd .claude && git pull
# =============================================================================

set -e

# ── CLI flags ────────────────────────────────────────────────────────────────
SKIP_NOTIFICATIONS=0
UPDATE_SETTINGS=0
AUTO_YES=0
for arg in "$@"; do
  case "$arg" in
    --no-notifications) SKIP_NOTIFICATIONS=1 ;;
    --update-settings)  UPDATE_SETTINGS=1 ;;
    --yes|-y)           AUTO_YES=1 ;;
    --help|-h)
      cat <<'HELP'
claude-skills setup.sh
Usage: bash setup.sh [flags]

Flags:
  --no-notifications   Skip desktop-notification package install (Windows/Linux)
  --update-settings    Back up existing settings.json and regenerate from template.
                       Use after pulling a framework upgrade that adds hook events.
                       The backup is saved as settings.json.backup.YYYYMMDD-HHMMSS.
  -y, --yes            Auto-confirm dependency install prompts (non-interactive / CI).
  -h, --help           Show this help
HELP
      exit 0
      ;;
  esac
done

# ── Dependency preflight ─────────────────────────────────────────────────────
# Detect OS once for package-manager routing.
UNAME_OUT="$(uname -s 2>/dev/null || echo unknown)"
case "$UNAME_OUT" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT) OS_KIND=windows ;;
  Darwin)                          OS_KIND=macos ;;
  Linux)                           OS_KIND=linux ;;
  *)                               OS_KIND=unknown ;;
esac

# prompt_install <display-name> <winget-id> <brew-pkg> <apt-pkg> <dnf-pkg>
# Returns 0 if user accepted AND install succeeded; 1 otherwise.
prompt_install() {
  local name="$1" winget_id="$2" brew_pkg="$3" apt_pkg="$4" dnf_pkg="$5"
  local cmd="" mgr=""

  case "$OS_KIND" in
    windows)
      if command -v winget >/dev/null 2>&1 && [[ -n "$winget_id" ]]; then
        mgr=winget
        cmd="winget install --id $winget_id -e --accept-source-agreements --accept-package-agreements"
      fi
      ;;
    macos)
      if command -v brew >/dev/null 2>&1 && [[ -n "$brew_pkg" ]]; then
        mgr=brew
        cmd="brew install $brew_pkg"
      fi
      ;;
    linux)
      if command -v apt-get >/dev/null 2>&1 && [[ -n "$apt_pkg" ]]; then
        mgr=apt
        cmd="sudo apt-get update && sudo apt-get install -y $apt_pkg"
      elif command -v dnf >/dev/null 2>&1 && [[ -n "$dnf_pkg" ]]; then
        mgr=dnf
        cmd="sudo dnf install -y $dnf_pkg"
      fi
      ;;
  esac

  if [[ -z "$cmd" ]]; then
    echo "  ✗ $name: no auto-installer available for OS '$OS_KIND'. Install $name manually and re-run." >&2
    return 1
  fi

  echo "  → $name not found. Suggested install via $mgr:"
  echo "      $cmd"

  local ans="n"
  if [[ "$AUTO_YES" = "1" ]]; then
    ans="y"
    echo "    (--yes flag set — installing without prompt)"
  else
    # Read from controlling tty so it works even when stdin is piped.
    if [[ -r /dev/tty ]]; then
      printf "    Run this now? [y/N] "
      read -r ans </dev/tty || ans="n"
    else
      echo "    No interactive tty; skipping. Re-run with --yes to auto-install." >&2
      return 1
    fi
  fi

  case "$ans" in
    y|Y|yes|YES)
      if eval "$cmd"; then
        return 0
      else
        echo "  ✗ install command failed for $name. See output above." >&2
        return 1
      fi
      ;;
    *)
      echo "    skipped." >&2
      return 1
      ;;
  esac
}

# ensure_dep <binary> <required|optional> <display-name> <winget> <brew> <apt> <dnf>
ensure_dep() {
  local binary="$1" mode="$2" name="$3"
  if command -v "$binary" >/dev/null 2>&1; then
    return 0
  fi
  prompt_install "$name" "$4" "$5" "$6" "$7" || true
  if command -v "$binary" >/dev/null 2>&1; then
    return 0
  fi
  if [[ "$mode" = "required" ]]; then
    echo "ERROR: $name ($binary) is required but not installed. Aborting." >&2
    exit 1
  else
    echo "  ⚠ $name not installed — continuing (some features may degrade)" >&2
    return 1
  fi
}

# Python 3.12+ is hard-required (markitdown ingestion needs 3.10+; we standardize
# on 3.12 as the floor so every machine that pulls the framework stays current).
PY_MIN_MAJOR=3
PY_MIN_MINOR=12

# True (exit 0) when the given interpreter is >= the required floor.
py_ge_min() {
  "$1" -c "import sys; raise SystemExit(0 if sys.version_info >= ($PY_MIN_MAJOR, $PY_MIN_MINOR) else 1)" >/dev/null 2>&1
}

# Pick the first single-token interpreter that meets the floor (newest name first).
# Single-token only — downstream invocations quote "$PYTHON_CMD".
resolve_python() {
  local c
  for c in python3.13 python3.12 python3 python; do
    if command -v "$c" >/dev/null 2>&1 && py_ge_min "$c"; then
      PYTHON_CMD="$c"
      return 0
    fi
  done
  return 1
}

if ! resolve_python; then
  # The trailing "true" matters: with no interpreter on PATH the loop ends on a
  # failed "command -v", and under set -e that status would end setup.sh right
  # here, silently, before the install offer below.
  found="$(for c in python3 python; do command -v "$c" >/dev/null 2>&1 && { "$c" --version 2>&1; break; }; done; true)"
  echo "  → Python ${PY_MIN_MAJOR}.${PY_MIN_MINOR}+ required (found: ${found:-none}). Installing/upgrading to Python 3.12…" >&2
  prompt_install "Python 3.12" "Python.Python.3.12" "python@3.12" \
    "python3.12 python3.12-venv python3-pip" "python3.12" || true
  if ! resolve_python; then
    echo "ERROR: Python ${PY_MIN_MAJOR}.${PY_MIN_MINOR}+ is required but was not found after install." >&2
    echo "  Install it manually, then re-run (open a NEW shell so PATH refreshes):" >&2
    echo "    Windows: winget install Python.Python.3.12   (or https://python.org/downloads/)" >&2
    echo "    macOS:   brew install python@3.12" >&2
    echo "    Linux:   sudo apt-get install -y python3.12 python3.12-venv" >&2
    exit 1
  fi
fi
export PYTHON_CMD
echo "  ✓ Python: $("$PYTHON_CMD" --version 2>&1) ($PYTHON_CMD)"

# Verify FTS5 is available (needed by state/db.py). The import sits inside the
# try so a Python built without sqlite3 prints "missing" and gets the warning
# below, instead of exiting non-zero and ending setup.sh under set -e.
FTS5_OK=$("$PYTHON_CMD" -c "
try:
    import sqlite3
    sqlite3.connect(':memory:').execute('CREATE VIRTUAL TABLE t USING fts5(x)')
    print('ok')
except Exception:
    print('missing')
" 2>/dev/null)
if [[ "$FTS5_OK" != "ok" ]]; then
  echo "WARNING: SQLite FTS5 not available in this Python build." >&2
  echo "  /history-query will not work until FTS5 is enabled." >&2
  if [[ "$OS_KIND" = "windows" ]]; then
    echo "  Fix: reinstall Python from https://python.org/downloads/ (the official build ships with FTS5)." >&2
  fi
  echo "  See UPGRADING.md for full instructions." >&2
fi

# Optional dependencies — prompt to install but never block.
ensure_dep node optional "Node.js (used by scripts/patch-settings.sh for settings template sync)" \
  "OpenJS.NodeJS.LTS" "node" "nodejs npm" "nodejs npm" || true
ensure_dep jq optional "jq (used by hooks for JSON parsing)" \
  "jqlang.jq" "jq" "jq" "jq" || true
ensure_dep git optional "Git" \
  "Git.Git" "git" "git" "git" || true

echo "  ✓ dependency preflight passed (python: $PYTHON_CMD, os: $OS_KIND)"

# markitdown — universal file->markdown ingestion (skills/markitdown + pdf/docx/xlsx/pptx
# read paths). Always upgrade to the latest release. Non-blocking: a failure here only
# degrades the ingest path, it does not abort setup.
echo "  → installing/upgrading markitdown[all] (universal file ingestion)…"
if "$PYTHON_CMD" -m pip install --upgrade "markitdown[all]" >/dev/null 2>&1; then
  echo "  ✓ markitdown[all] installed/upgraded to latest"
else
  echo "  ⚠ markitdown[all] install failed — run '$PYTHON_CMD -m pip install --upgrade \"markitdown[all]\"' manually" >&2
fi

CLAUDE_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$CLAUDE_DIR/.." && pwd)"
ADF_VERSION="$(cat "$CLAUDE_DIR/.adf-version" 2>/dev/null | tr -d '[:space:]')"
[[ -n "$ADF_VERSION" ]] || ADF_VERSION="unknown"

# setup.sh scaffolds a PROJECT: the parent folder of .claude/. A clone at
# ~/.claude is a user-level install whose parent is the home directory, so stop
# before AI_DOCS/, CLAUDE.md and .gitignore are written into $HOME.
if [[ -n "${HOME:-}" && -d "$HOME/.claude" && "$CLAUDE_DIR" -ef "$HOME/.claude" ]]; then
  echo ""
  echo "  This clone is the user-level ~/.claude, not a project install."
  echo "  There is no project to scaffold here. To use the framework in a project:"
  echo "    cd <project> && git clone <this repo> .claude && bash .claude/setup.sh"
  exit 0
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   claude-skills — Project Setup          ║"
echo "╚══════════════════════════════════════════╝"
echo "  Framework : v$ADF_VERSION"
echo "  Project   : $PROJECT_ROOT"
echo ""

# ── settings.json ────────────────────────────────────────────────────────────
if [[ ! -f "$CLAUDE_DIR/settings.json" ]]; then
  cp "$CLAUDE_DIR/settings.template.json" "$CLAUDE_DIR/settings.json"
  echo "  ✓ .claude/settings.json (created from template — customize permissions)"
elif [[ "$UPDATE_SETTINGS" = "1" ]]; then
  BACKUP_STAMP=$(date +%Y%m%d-%H%M%S)
  BACKUP_PATH="$CLAUDE_DIR/settings.json.backup.$BACKUP_STAMP"
  cp "$CLAUDE_DIR/settings.json" "$BACKUP_PATH"
  cp "$CLAUDE_DIR/settings.template.json" "$CLAUDE_DIR/settings.json"
  echo "  ✓ .claude/settings.json regenerated from v$ADF_VERSION template"
  echo "    backup: $BACKUP_PATH"
  echo "    reinstate any custom permissions from the backup manually"
  # If the user had a pending-migration notice, clear it — they've acted.
  rm -f "$PROJECT_ROOT/AI_DOCS/memory/pending-migration.md" 2>/dev/null || true
else
  echo "  ✓ .claude/settings.json (already exists — kept; re-run with --update-settings to refresh from template)"
fi

# ── Sync settings.json against template (auto-add any missing keys) ───────────
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
PATCH_SCRIPT="$CLAUDE_DIR/scripts/patch-settings.sh"
if [[ -f "$SETTINGS_FILE" ]] && [[ -f "$PATCH_SCRIPT" ]]; then
  echo "  [settings-sync] Syncing settings.json against template..."
  bash "$PATCH_SCRIPT" "$SETTINGS_FILE" "$CLAUDE_DIR/settings.template.json" \
    || echo "  ⚠ patch-settings.sh failed — run manually: bash .claude/scripts/patch-settings.sh .claude/settings.json .claude/settings.template.json"
fi

# ── git core.hooksPath ────────────────────────────────────────────────────────
# Point the .claude/ repo's git hooks at the tracked hooks/git/ directory so
# `git pull` inside .claude/ automatically triggers upgrade.sh via post-merge.
# This only configures the .claude/ clone — the user's project repo is unaffected.
if [[ -d "$CLAUDE_DIR/.git" && -d "$CLAUDE_DIR/hooks/git" ]]; then
  CURRENT_HOOKS_PATH="$(git -C "$CLAUDE_DIR" config --get core.hooksPath 2>/dev/null || true)"
  if [[ -z "$CURRENT_HOOKS_PATH" ]]; then
    git -C "$CLAUDE_DIR" config core.hooksPath hooks/git
    echo "  ✓ git hooks (core.hooksPath → hooks/git — auto-migration on git pull enabled)"
  else
    echo "  ✓ git hooks (core.hooksPath already set: $CURRENT_HOOKS_PATH — left alone)"
  fi
fi

# ── Migrate AI_DOCS/plans/ → AI_DOCS/planning/ (planning/ is canonical) ───────
# Runs BEFORE the scaffold loop so a legacy plans/ is renamed while planning/
# does not exist yet. The loop below then scaffolds planning/, never plans/.
if [[ -d "$PROJECT_ROOT/AI_DOCS/plans" ]] && [[ ! -d "$PROJECT_ROOT/AI_DOCS/planning" ]]; then
  mv "$PROJECT_ROOT/AI_DOCS/plans" "$PROJECT_ROOT/AI_DOCS/planning"
  echo "  ✓ AI_DOCS/plans/ migrated to AI_DOCS/planning/"
elif [[ -d "$PROJECT_ROOT/AI_DOCS/plans" ]]; then
  # An EMPTY plans/ next to planning/ is a leftover of older setup.sh runs, which
  # recreated it on every re-run. rmdir only succeeds on an empty directory.
  if rmdir "$PROJECT_ROOT/AI_DOCS/plans" 2>/dev/null; then
    echo "  ✓ AI_DOCS/plans/ (empty leftover) removed, AI_DOCS/planning/ is canonical"
  else
    echo "  ⚠ AI_DOCS/plans/ exists alongside AI_DOCS/planning/: move contents into planning/ and delete plans/ manually"
  fi
fi

# ── AI_DOCS scaffold ─────────────────────────────────────────────────────────
for dir in memory planning architecture design milestones brainstorm audit quality requirements ingested .temp .temp/logs; do
  mkdir -p "$PROJECT_ROOT/AI_DOCS/$dir"
done
echo "  ✓ AI_DOCS/ scaffold created"

# ── review-mode.txt (gate strictness: full / lean / solo) ────────────────────
# Scaffolded with the documented default. gate-enforcement falls back to "full"
# when the file is missing, so a fresh project must not start without it.
if [[ ! -f "$PROJECT_ROOT/AI_DOCS/review-mode.txt" ]]; then
  printf 'lean\n' > "$PROJECT_ROOT/AI_DOCS/review-mode.txt"
  echo "  ✓ AI_DOCS/review-mode.txt (lean, the default gate strictness)"
fi

# ── Control registry seed (PLAN-v4.20 C-5) ───────────────────────────────────
# One row per enforcing control, reconciled by drift-detector.sh Phase I.
# Copy only when absent: the project's registry accumulates its own proof dates.
if [[ ! -f "$PROJECT_ROOT/AI_DOCS/quality/control-registry.md" ]] && [[ -f "$CLAUDE_DIR/templates/control-registry.md" ]]; then
  cp "$CLAUDE_DIR/templates/control-registry.md" "$PROJECT_ROOT/AI_DOCS/quality/control-registry.md"
  echo "  ✓ AI_DOCS/quality/control-registry.md seeded (from templates/control-registry.md)"
fi

# ── Legacy root requirement.md warning (skills perform the move, not setup) ──
if [[ -f "$PROJECT_ROOT/requirement.md" ]]; then
  echo "  ⚠ root requirement.md found — deprecated location; /do will relocate it to AI_DOCS/requirements/ and log the move"
fi

# ── session-state.md starter ─────────────────────────────────────────────────
if [[ ! -f "$PROJECT_ROOT/AI_DOCS/memory/session-state.md" ]]; then
  cat > "$PROJECT_ROOT/AI_DOCS/memory/session-state.md" << EOF
# Session State

**Framework**: claude-skills v$ADF_VERSION
**Phase**: Not started
**Last updated**: $(date +%Y-%m-%d)

## Active Task
None — run /session-management to initialize.

## Gate Status
All gates: PENDING

## Next Action
Run /brainstorm (explore idea first) or /session-management (start project setup).
EOF
  echo "  ✓ AI_DOCS/memory/session-state.md"
fi

# ── CLAUDE.md ────────────────────────────────────────────────────────────────
if [[ ! -f "$PROJECT_ROOT/CLAUDE.md" ]]; then
  # Stamp the shipped framework version into the copy: the adf-version marker
  # (read by upgrade.sh step 3) and the "Version:" line. A fresh project
  # CLAUDE.md is then never reported stale because the template's numbers lag.
  if ! { [[ "$ADF_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && sed -E \
           -e "s/(<!-- adf-version: )[0-9]+\.[0-9]+\.[0-9]+( -->)/\1${ADF_VERSION}\2/" \
           -e "1,5s/^(> Version: )[0-9]+\.[0-9]+\.[0-9]+/\1${ADF_VERSION}/" \
           "$CLAUDE_DIR/CLAUDE.template.md" > "$PROJECT_ROOT/CLAUDE.md"; }; then
    cp "$CLAUDE_DIR/CLAUDE.template.md" "$PROJECT_ROOT/CLAUDE.md"
  fi
  echo "  ✓ CLAUDE.md (update with your project name and details)"
else
  echo "  ✓ CLAUDE.md (already exists — kept)"
fi

# ── .gitignore ───────────────────────────────────────────────────────────────
if [[ ! -f "$PROJECT_ROOT/.gitignore" ]]; then
  cat > "$PROJECT_ROOT/.gitignore" << 'GITIGNORE'
# claude-skills framework — managed via git pull, not committed to project
.claude/

# Dependencies
node_modules/
.venv/
__pycache__/
*.pyc

# Build output
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db

# ─── AI_DOCS — Temp & Generated Files ───────────────────────
AI_DOCS/.temp/
AI_DOCS/memory/figma-snapshots/Screens/
AI_DOCS/*.txt
!AI_DOCS/review-mode.txt
AI_DOCS/*.py
AI_DOCS/design/samples/
AI_DOCS/design/src/

# ─── AI_DOCS — Auto-written runtime files (never commit) ────
AI_DOCS/memory/.prompt-counter
AI_DOCS/memory/compaction-snapshot.md
AI_DOCS/memory/metrics.jsonl
AI_DOCS/audit/agent-log.md

# ─── Impeccable (vendored design toolkit): local runtime files ───
.impeccable/config.local.json
.impeccable/hook.ndjson
GITIGNORE
  echo "  ✓ .gitignore (.claude/ excluded from project git)"
else
  # Append .claude/ entry if missing
  if ! grep -q "^\.claude/$" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
    printf "\n# claude-skills framework — managed via git pull\n.claude/\n" >> "$PROJECT_ROOT/.gitignore"
    echo "  ✓ .gitignore (.claude/ entry added)"
  else
    echo "  ✓ .gitignore (already has .claude/ entry)"
  fi
  # Ensure AI_DOCS runtime entries are present
  _ai_entries=(
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
  _added=0
  for _entry in "${_ai_entries[@]}"; do
    if ! grep -qF "$_entry" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
      if [[ $_added -eq 0 ]]; then
        printf "\n# ─── AI_DOCS — Temp & Generated Files ───────────────────────\n" >> "$PROJECT_ROOT/.gitignore"
        _added=1
      fi
      printf "%s\n" "$_entry" >> "$PROJECT_ROOT/.gitignore"
    fi
  done
  [[ $_added -gt 0 ]] && echo "  ✓ .gitignore (AI_DOCS runtime entries added)" || echo "  ✓ .gitignore (AI_DOCS entries already present)"
fi

# ── Cron (v4.0) ──────────────────────────────────────────────────────────────
if [[ ! -f "$CLAUDE_DIR/cron/jobs.json" ]] && [[ -f "$CLAUDE_DIR/cron/jobs.json.template" ]]; then
  cp "$CLAUDE_DIR/cron/jobs.json.template" "$CLAUDE_DIR/cron/jobs.json"
  echo "  ✓ cron/jobs.json (initialized from template — 3 built-in jobs, all disabled)"
elif [[ -f "$CLAUDE_DIR/cron/jobs.json" ]]; then
  echo "  ✓ cron/jobs.json (already exists — kept; use /schedule to manage)"
fi

# ── Plugins (v4.0) ───────────────────────────────────────────────────────────
mkdir -p "$CLAUDE_DIR/plugins/official"
mkdir -p "$CLAUDE_DIR/plugins/user"
[[ -f "$CLAUDE_DIR/plugins/user/.gitkeep" ]] || touch "$CLAUDE_DIR/plugins/user/.gitkeep"
echo "  ✓ plugins/ directories ready"

# ── ADF home directory (v4.0) ────────────────────────────────────────────────
ADF_HOME="$HOME/.adf"
mkdir -p "$ADF_HOME/shared"
mkdir -p "$ADF_HOME/projects"
if [[ ! -f "$ADF_HOME/shared/decisions.md" ]]; then
  printf '# Shared Decisions\n\n<!-- Decisions tagged [SHARED] in any ADF project sync here automatically -->\n<!-- Use /share-decision to promote a decision, /share-decision import to pull into a new project -->\n' \
    > "$ADF_HOME/shared/decisions.md"
fi
if [[ ! -f "$ADF_HOME/shared/conventions.md" ]] && [[ -f "$CLAUDE_DIR/templates/shared-conventions.md" ]]; then
  cp "$CLAUDE_DIR/templates/shared-conventions.md" "$ADF_HOME/shared/conventions.md"
fi
echo "  ✓ ~/.adf/ home directory ready (shared decisions, conventions, project registry)"

# ── SQLite state (v4.0) ───────────────────────────────────────────────────────
PROJECT_ID_FILE="$PROJECT_ROOT/.claude-project-id"
# Create the stable project id here when it is missing or empty. No skill
# creates it, and without it every project shares ~/.adf/projects/default.
PROJECT_ID=""
if [[ -f "$PROJECT_ID_FILE" ]]; then
  PROJECT_ID=$(cat "$PROJECT_ID_FILE" | tr -d '[:space:]')
fi
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID=$("$PYTHON_CMD" -c "import uuid; print(uuid.uuid4())" 2>/dev/null | tr -d '[:space:]')
  if [[ -n "$PROJECT_ID" ]]; then
    printf '%s\n' "$PROJECT_ID" > "$PROJECT_ID_FILE"
    echo "  ✓ .claude-project-id created ($PROJECT_ID)"
  fi
fi
if [[ -n "$PROJECT_ID" ]]; then
  STATE_DIR="$ADF_HOME/projects/$PROJECT_ID"
  mkdir -p "$STATE_DIR"
  # db.py resolves .claude-project-id relative to the current directory, so it
  # runs from the project root. Run from anywhere else it would initialize
  # ~/.adf/projects/default instead. db.py prints the real database path.
  if ( cd "$PROJECT_ROOT" && "$PYTHON_CMD" "$CLAUDE_DIR/state/db.py" init ); then
    echo "  ✓ SQLite state database initialized for project $PROJECT_ID (path printed above)"
  else
    echo "  ⚠ SQLite state init failed: see the error above, then re-run setup.sh." >&2
  fi
else
  echo "  ⚠ SQLite state: skipped (could not create .claude-project-id, check that $PYTHON_CMD runs)" >&2
fi

# ── Desktop notifications (v3.8) ─────────────────────────────────────────────
if [[ "$SKIP_NOTIFICATIONS" = "1" ]]; then
  echo "  - desktop notifications: skipped (--no-notifications)"
else
  UNAME_OUT="$(uname -s 2>/dev/null || echo unknown)"
  case "$UNAME_OUT" in
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      # Windows — install BurntToast (preferred toast library) if missing.
      if command -v powershell.exe >/dev/null 2>&1; then
        PS=powershell.exe
      elif command -v pwsh >/dev/null 2>&1; then
        PS=pwsh
      else
        PS=""
      fi

      if [[ -n "$PS" ]]; then
        HAS_BT=$("$PS" -NoProfile -Command 'if (Get-Module -ListAvailable -Name BurntToast) { "yes" } else { "no" }' 2>/dev/null | tr -d '[:space:]\r')
        if [[ "$HAS_BT" = "yes" ]]; then
          echo "  ✓ desktop notifications: BurntToast already installed"
        else
          echo "  - desktop notifications: installing BurntToast (PowerShell module) …"
          INSTALL_OUT=$("$PS" -NoProfile -Command '
            try {
              if ((Get-PSRepository -Name PSGallery -ErrorAction SilentlyContinue).InstallationPolicy -ne "Trusted") {
                Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
              }
              Install-Module -Name BurntToast -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
              Write-Output "OK"
            } catch {
              Write-Output ("FAIL:" + $_.Exception.Message)
            }
          ' 2>&1 | tr -d '\r')

          if echo "$INSTALL_OUT" | grep -q "^OK"; then
            echo "  ✓ desktop notifications: BurntToast installed (raw Win.UI fallback also wired)"
          else
            echo "  ⚠ desktop notifications: BurntToast install did not succeed"
            echo "    Notifications will use the raw Windows.UI.Notifications fallback."
            echo "    To retry manually: Install-Module BurntToast -Scope CurrentUser -Force"
          fi
        fi
      else
        echo "  ⚠ desktop notifications: PowerShell not found — skipping BurntToast install"
      fi
      ;;
    Darwin)
      echo "  ✓ desktop notifications: macOS uses built-in osascript (no install needed)"
      if command -v brew >/dev/null 2>&1 && ! command -v terminal-notifier >/dev/null 2>&1; then
        echo "    Optional: \`brew install terminal-notifier\` for better reliability"
      fi
      ;;
    Linux)
      if command -v notify-send >/dev/null 2>&1; then
        echo "  ✓ desktop notifications: notify-send already installed"
      else
        echo "  ⚠ desktop notifications: notify-send not found"
        if command -v apt >/dev/null 2>&1; then
          echo "    Install with: sudo apt install libnotify-bin"
        elif command -v dnf >/dev/null 2>&1; then
          echo "    Install with: sudo dnf install libnotify"
        elif command -v pacman >/dev/null 2>&1; then
          echo "    Install with: sudo pacman -S libnotify"
        else
          echo "    Install libnotify / libnotify-bin via your package manager"
        fi
      fi
      ;;
    *)
      echo "  - desktop notifications: unrecognized OS ($UNAME_OUT) — notify.sh will no-op"
      ;;
  esac
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Setup Complete!                        ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Next steps:"
echo "    1. Edit CLAUDE.md — add your project name and description"
echo "    2. Open this folder in Claude Code"
echo "    3. Run /brainstorm  — explore the idea before building"
echo "       OR  /session-management  — start project setup directly"
echo ""
echo "  To update the framework later:"
echo "    cd .claude && git pull"
echo ""
