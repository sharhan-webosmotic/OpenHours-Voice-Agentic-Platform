#!/usr/bin/env bash
# scripts/install-plugin.sh — ADF Plugin Installer (v4.0)
#
# Usage:
#   bash .claude/scripts/install-plugin.sh <plugin-path>
#
# Examples:
#   bash .claude/scripts/install-plugin.sh .claude/plugins/official/github-actions
#   bash .claude/scripts/install-plugin.sh /absolute/path/to/my-plugin
#
# What it does:
#   1. Reads plugin.yaml
#   2. Warns about missing required env vars
#   3. Copies skills/hooks/agents/rules into .claude/
#   4. Merges new hooks into settings.local.json (idempotent). Not settings.json:
#      every upgrade run resets that file's hooks object to the template, which
#      silently dropped plugin hooks at the next git pull.
#   5. Runs post_install script if specified
#   6. Records the install in AI_DOCS/memory/plugins.md

set -euo pipefail

# Python reads and writes UTF-8 whatever the platform default is. On Windows a
# piped stdout and open() default to the ANSI code page (cp1252), where printing
# a check mark raised UnicodeEncodeError and left the plugin half installed.
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8

# Resolve one working interpreter. python3 is missing on a stock python.org
# Windows install (or is the Store stub that only prints an error).
PY=""
for _c in python3.13 python3.12 python3 python; do
  if command -v "$_c" >/dev/null 2>&1 \
     && "$_c" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 6) else 1)" >/dev/null 2>&1; then
    PY="$_c"
    break
  fi
done
if [[ -z "$PY" ]]; then
  echo "Error: Python 3 is required to install a plugin (tried python3.13, python3.12, python3, python)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$CLAUDE_DIR/.." && pwd)"
SETTINGS_FILE="$CLAUDE_DIR/settings.local.json"
PLUGINS_RECORD="$PROJECT_ROOT/AI_DOCS/memory/plugins.md"

# ── Argument ──────────────────────────────────────────────────────────────────
PLUGIN_PATH="${1:-}"
if [[ -z "$PLUGIN_PATH" ]]; then
  echo "Usage: bash install-plugin.sh <plugin-path>" >&2
  exit 1
fi

# Resolve relative paths
if [[ "$PLUGIN_PATH" != /* ]]; then
  PLUGIN_PATH="$(cd "$PROJECT_ROOT" && cd "$PLUGIN_PATH" 2>/dev/null && pwd)" || {
    echo "Error: plugin path not found: $1" >&2
    exit 1
  }
fi

MANIFEST="$PLUGIN_PATH/plugin.yaml"
if [[ ! -f "$MANIFEST" ]]; then
  echo "Error: no plugin.yaml found at $PLUGIN_PATH" >&2
  exit 1
fi

# ── Parse manifest (Python — avoids yq/jq dependency) ────────────────────────
PARSE_RESULT=$("$PY" - "$MANIFEST" <<'PYEOF'
import sys, json
try:
    import yaml
    with open(sys.argv[1]) as f:
        data = yaml.safe_load(f)
except ImportError:
    # Fallback: minimal YAML parser for simple flat/list fields
    data = {}
    with open(sys.argv[1]) as f:
        lines = f.readlines()
    in_provides = in_requires = in_list = False
    current_key = None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('#') or not stripped:
            continue
        if ':' in stripped and not stripped.startswith('-'):
            key, _, val = stripped.partition(':')
            key = key.strip()
            val = val.strip()
            if key in ('provides', 'requires', 'install'):
                in_provides = (key == 'provides')
                in_requires = (key == 'requires')
                current_key = key
                data.setdefault(key, {})
                in_list = False
            elif in_provides or in_requires:
                sub = val if val and val != '[]' else []
                if val == '[]':
                    sub = []
                elif val:
                    sub = [x.strip() for x in val.strip('[]').split(',') if x.strip()]
                else:
                    sub = []
                    current_key = key
                    in_list = True
                data[('provides' if in_provides else 'requires')][key] = sub
            elif key == 'post_install' and current_key == 'install':
                data.setdefault('install', {})['post_install'] = val if val != 'null' else None
            else:
                data[key] = val
                in_provides = in_requires = False
                in_list = False
        elif stripped.startswith('-') and in_list:
            item = stripped.lstrip('- ').strip()
            parent = 'provides' if in_provides else ('requires' if in_requires else None)
            if parent and current_key:
                data[parent].setdefault(current_key, []).append(item)

print(json.dumps(data))
PYEOF
)

PLUGIN_NAME=$(echo "$PARSE_RESULT" | "$PY" -c"import sys,json; d=json.load(sys.stdin); print(d.get('name','unknown'))")
PLUGIN_VERSION=$(echo "$PARSE_RESULT" | "$PY" -c"import sys,json; d=json.load(sys.stdin); print(d.get('version','0.0.0'))")
PLUGIN_DESC=$(echo "$PARSE_RESULT" | "$PY" -c"import sys,json; d=json.load(sys.stdin); print(d.get('description',''))")
SKILLS_LIST=$(echo "$PARSE_RESULT" | "$PY" -c"import sys,json; d=json.load(sys.stdin); print(','.join(d.get('provides',{}).get('skills',[])))")
HOOKS_LIST=$(echo "$PARSE_RESULT" | "$PY" -c"import sys,json; d=json.load(sys.stdin); print(','.join(d.get('provides',{}).get('hooks',[])))")
AGENTS_LIST=$(echo "$PARSE_RESULT" | "$PY" -c"import sys,json; d=json.load(sys.stdin); print(','.join(d.get('provides',{}).get('agents',[])))")
RULES_LIST=$(echo "$PARSE_RESULT" | "$PY" -c"import sys,json; d=json.load(sys.stdin); print(','.join(d.get('provides',{}).get('rules',[])))")
ENV_REQS=$(echo "$PARSE_RESULT" | "$PY" -c"import sys,json; d=json.load(sys.stdin); print(','.join(d.get('requires',{}).get('env',[])))")
POST_INSTALL=$(echo "$PARSE_RESULT" | "$PY" -c"import sys,json; d=json.load(sys.stdin); print(d.get('install',{}).get('post_install') or '')")

echo ""
echo "Installing plugin: $PLUGIN_NAME v$PLUGIN_VERSION"
echo "  $PLUGIN_DESC"
echo ""

# ── Warn on missing env vars ──────────────────────────────────────────────────
if [[ -n "$ENV_REQS" ]]; then
  IFS=',' read -ra ENVS <<< "$ENV_REQS"
  for env_var in "${ENVS[@]}"; do
    if [[ -z "${!env_var:-}" ]]; then
      echo "  ⚠ Missing env var: $env_var (plugin may not work correctly)"
    else
      echo "  ✓ $env_var is set"
    fi
  done
fi

INSTALLED_SKILLS=""
INSTALLED_HOOKS=""
INSTALLED_AGENTS=""
INSTALLED_RULES=""

# ── Copy skills ───────────────────────────────────────────────────────────────
if [[ -n "$SKILLS_LIST" ]]; then
  IFS=',' read -ra SKILLS <<< "$SKILLS_LIST"
  for skill in "${SKILLS[@]}"; do
    [[ -z "$skill" ]] && continue
    SRC="$PLUGIN_PATH/skills/$skill"
    DST="$CLAUDE_DIR/skills/$skill"
    if [[ -d "$SRC" ]]; then
      cp -r "$SRC" "$DST"
      echo "  ✓ skill: $skill"
      INSTALLED_SKILLS="$INSTALLED_SKILLS $skill"
    else
      echo "  ⚠ skill dir not found: $SRC"
    fi
  done
fi

# ── Copy hooks ────────────────────────────────────────────────────────────────
if [[ -n "$HOOKS_LIST" ]]; then
  IFS=',' read -ra HOOKS <<< "$HOOKS_LIST"
  for hook in "${HOOKS[@]}"; do
    [[ -z "$hook" ]] && continue
    SRC="$PLUGIN_PATH/hooks/$hook"
    DST="$CLAUDE_DIR/hooks/$hook"
    if [[ -f "$SRC" ]]; then
      cp "$SRC" "$DST"
      chmod +x "$DST"
      echo "  ✓ hook: $hook"
      INSTALLED_HOOKS="$INSTALLED_HOOKS $hook"
    else
      echo "  ⚠ hook file not found: $SRC"
    fi
  done
fi

# ── Copy agents ───────────────────────────────────────────────────────────────
if [[ -n "$AGENTS_LIST" ]]; then
  IFS=',' read -ra AGENTS <<< "$AGENTS_LIST"
  for agent in "${AGENTS[@]}"; do
    [[ -z "$agent" ]] && continue
    SRC="$PLUGIN_PATH/agents/$agent"
    DST="$CLAUDE_DIR/agents/$agent"
    if [[ -f "$SRC" ]]; then
      cp "$SRC" "$DST"
      echo "  ✓ agent: $agent"
      INSTALLED_AGENTS="$INSTALLED_AGENTS $agent"
    else
      echo "  ⚠ agent file not found: $SRC"
    fi
  done
fi

# ── Copy rules ────────────────────────────────────────────────────────────────
if [[ -n "$RULES_LIST" ]]; then
  IFS=',' read -ra RULES <<< "$RULES_LIST"
  for rule in "${RULES[@]}"; do
    [[ -z "$rule" ]] && continue
    SRC="$PLUGIN_PATH/rules/$rule"
    DST="$CLAUDE_DIR/rules/$rule"
    if [[ -f "$SRC" ]]; then
      cp "$SRC" "$DST"
      echo "  ✓ rule: $rule"
      INSTALLED_RULES="$INSTALLED_RULES $rule"
    else
      echo "  ⚠ rule file not found: $SRC"
    fi
  done
fi

# ── Merge hooks into settings.local.json ─────────────────────────────────────
# Claude Code merges hook entries across settings files, and upgrade.sh never
# touches settings.local.json, so a plugin hook registered here survives upgrades.
if [[ -n "$INSTALLED_HOOKS" ]]; then
  [[ -f "$SETTINGS_FILE" ]] || printf '{}
' > "$SETTINGS_FILE"
  echo "  Merging hook registrations into settings.local.json..."
  "$PY" - "$SETTINGS_FILE" "$PLUGIN_PATH" $INSTALLED_HOOKS <<'PYEOF'
import sys, json, os

settings_path = sys.argv[1]
plugin_path = sys.argv[2]
hooks = sys.argv[3:]

with open(settings_path) as f:
    settings = json.load(f)

hooks_config = settings.setdefault('hooks', {})
post = hooks_config.setdefault('PostToolUse', [])

for hook in hooks:
    cmd = f"bash .claude/hooks/{hook} 2>/dev/null || true"
    already = any(
        any(h.get('command') == cmd for h in entry.get('hooks', []))
        for entry in post
    )
    if not already:
        post.append({
            "//": f"PLUGIN ({os.path.basename(plugin_path)}): {hook}",
            "hooks": [{"type": "command", "command": cmd}]
        })
        print(f"  ✓ registered hook: {hook}")
    else:
        print(f"  - hook already registered: {hook}")

with open(settings_path, 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')
PYEOF
fi

# ── Run post_install ──────────────────────────────────────────────────────────
if [[ -n "$POST_INSTALL" ]]; then
  FULL_POST="$PLUGIN_PATH/$POST_INSTALL"
  if [[ -f "$FULL_POST" ]]; then
    echo "  Running post_install: $POST_INSTALL"
    bash "$FULL_POST" "$CLAUDE_DIR" "$PROJECT_ROOT"
  fi
fi

# ── Record install ────────────────────────────────────────────────────────────
TS=$(date -u +"%Y-%m-%d")
mkdir -p "$(dirname "$PLUGINS_RECORD")"
if [[ ! -f "$PLUGINS_RECORD" ]]; then
  printf '# Installed Plugins\n\n| Plugin | Version | Date | Skills | Hooks |\n|---|---|---|---|---|\n' > "$PLUGINS_RECORD"
fi

SKILLS_COL="${INSTALLED_SKILLS:-—}"
HOOKS_COL="${INSTALLED_HOOKS:-—}"
printf '| %s | %s | %s | %s | %s |\n' \
  "$PLUGIN_NAME" "$PLUGIN_VERSION" "$TS" "$SKILLS_COL" "$HOOKS_COL" \
  >> "$PLUGINS_RECORD"

echo ""
echo "Plugin '$PLUGIN_NAME' installed successfully."
echo "Skills:$([ -n "$INSTALLED_SKILLS" ] && echo "$INSTALLED_SKILLS" || echo " none")"
echo "Hooks:$([ -n "$INSTALLED_HOOKS" ] && echo "$INSTALLED_HOOKS" || echo " none")"
echo ""
