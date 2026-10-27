#!/usr/bin/env bash
# scripts/patch-settings.sh — Sync settings.json against settings.template.json
#
# Usage: bash patch-settings.sh <settings.json> <settings.template.json>
#
# Rules:
#   - hooks: the framework owns the "hooks" object. It is made EQUAL to the
#     template's, and a timestamped settings.json.backup.* is written when that
#     changes anything. An additive merge cannot do this job: it keeps the old
#     copy of every hook command whose text changed, so a corrected command ran
#     next to its faulty predecessor (two GIT-SAFETY checks, Prettier and ESLint
#     wired twice, the old Stop cleanup still firing). Personal hooks belong in
#     .claude/settings.local.json, which Claude Code merges on top and which this
#     script never touches.
#   - permissions: allow/ask/deny arrays are merged by appending missing entries.
#   - enabledPlugins / extraKnownMarketplaces: entries missing from settings.json
#     are added by name. An entry the project already has (enabled, disabled, or
#     pinned to another source) is left exactly as it is.
#   - Other top-level keys in the template that are absent from settings.json are
#     added. Existing keys and values outside "hooks" are NEVER overwritten.
#   - Comment keys (//, //note, //version) are skipped.
#
# Requires: node (v14+). No Python, no jq.

set -u

SETTINGS="$1"
TEMPLATE="$2"

if [[ ! -f "$SETTINGS" ]]; then
  echo "  skip: $SETTINGS not found" >&2
  exit 0
fi
if [[ ! -f "$TEMPLATE" ]]; then
  echo "  skip: $TEMPLATE not found" >&2
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "  error: node is required for patch-settings.sh — install Node.js and retry" >&2
  exit 1
fi

node - "$SETTINGS" "$TEMPLATE" <<'JSEOF'
const fs = require('fs');

const settingsPath = process.argv[2];
const templatePath = process.argv[3];

let settings, template, originalText;
try {
  originalText = fs.readFileSync(settingsPath, 'utf8');
  settings = JSON.parse(originalText);
}
catch (e) { console.error('  error: cannot parse ' + settingsPath + ': ' + e.message); process.exit(1); }
try { template = JSON.parse(fs.readFileSync(templatePath, 'utf8')); }
catch (e) { console.error('  error: cannot parse ' + templatePath + ': ' + e.message); process.exit(1); }

// Skip every comment-convention key (any key starting with //): //, //note,
// //version, //mcp, and any future doc key. Keeps template-only comments out of
// the user's settings.json.
const isComment = (key) => key.startsWith('//');
let changed = false;
let hooksReplaced = false;

for (const [key, tmplVal] of Object.entries(template)) {
  if (isComment(key)) continue;

  // ── hooks: framework-owned, always equal to the template ─────────────────
  if (key === 'hooks') {
    if (JSON.stringify(settings.hooks) === JSON.stringify(tmplVal)) {
      console.log('  ok: hooks');
    } else {
      hooksReplaced = settings.hooks !== undefined;
      settings.hooks = JSON.parse(JSON.stringify(tmplVal));
      changed = true;
      console.log('  + hooks: set to the template wiring (' + Object.keys(tmplVal).length + ' events)');
    }
    continue;
  }

  // ── permissions: merge allow / ask / deny arrays ─────────────────────────
  if (key === 'permissions') {
    if (!settings.permissions) { settings.permissions = {}; changed = true; }
    const sp = settings.permissions;
    const tp = tmplVal;

    for (const sub of ['allow', 'ask', 'deny']) {
      const tmplEntries = tp[sub] || [];
      if (tmplEntries.length === 0) continue;
      if (!sp[sub]) sp[sub] = [];
      const existing = new Set(sp[sub]);
      const added = tmplEntries.filter(e => !existing.has(e));
      if (added.length > 0) {
        sp[sub].push(...added);
        console.log('  + permissions.' + sub + ': added ' + added.length + ' entries from template');
        changed = true;
      } else {
        console.log('  ok: permissions.' + sub);
      }
    }

    // defaultMode: only add if absent
    if (!('defaultMode' in sp) && 'defaultMode' in tp) {
      sp.defaultMode = tp.defaultMode;
      console.log('  + permissions.defaultMode added: ' + tp.defaultMode);
      changed = true;
    }
    continue;
  }

  // ── plugin keys: add missing entries, never overwrite a project's choice ─
  if (key === 'enabledPlugins' || key === 'extraKnownMarketplaces') {
    if (!settings[key] || typeof settings[key] !== 'object') { settings[key] = {}; }
    const added = Object.keys(tmplVal).filter(k => !(k in settings[key]));
    for (const k of added) settings[key][k] = JSON.parse(JSON.stringify(tmplVal[k]));
    if (added.length > 0) {
      console.log('  + ' + key + ': added ' + added.join(', '));
      changed = true;
    } else {
      console.log('  ok: ' + key);
    }
    continue;
  }
  // ── all other top-level keys ─────────────────────────────────────────────
  if (!(key in settings)) {
    settings[key] = tmplVal;
    const preview = JSON.stringify(tmplVal);
    console.log('  + ' + key + ' added: ' + preview.slice(0, 60) + (preview.length > 60 ? '...' : ''));
    changed = true;
  } else {
    console.log('  ok: ' + key);
  }
}

if (changed) {
  if (hooksReplaced) {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const stamp = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
    const backup = settingsPath + '.backup.' + stamp;
    fs.writeFileSync(backup, originalText, 'utf8');
    console.log('  backup of the previous settings.json: ' + backup);
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  console.log('  [patch-settings] settings.json updated.');
} else {
  console.log('  [patch-settings] settings.json already up to date.');
}
JSEOF
