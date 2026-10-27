#!/usr/bin/env bash
# scripts/migrate-mcp.sh — Seed / top-up a project's .mcp.json with free MCP servers.
#
# Governed by rules/mcp-rules.md. Adds ONLY Enforced (free, no-credential, local
# npx) servers matched to the project's stack. Never writes a credential, never a
# Gated server, never touches the user's own or modified entries. Idempotent: safe
# to run on every pull.
#
# Usage:
#   bash scripts/migrate-mcp.sh [PROJECT_DIR]
#     PROJECT_DIR defaults to the parent of this script's framework dir (the
#     deployed-install layout where the framework IS .claude/ inside a project).
#
# Opt-out (two sources, merged; one server name per line, # comments allowed):
#   ~/.adf/mcp-ignore     machine-wide — a server you never want in ANY project
#   <project>/.mcp-ignore project-level
#   Listed names are never auto-added, and a framework-written free entry that
#   exactly matches what this script writes is removed so it stays gone across
#   pulls. Your own / modified / gated entries are never removed.
#
# Design notes (per .claude/rules/adf-hook-safety-rules):
#   - set -u on, set -e OFF. Every step guarded; nothing aborts a later step.
#   - Requires node (same floor as patch-settings.sh). Degrades gracefully: if
#     node is absent and no .mcp.json exists, writes the free always-on servers
#     via a heredoc so the project still gets the speed-up.
#   - Verifies each package id against the npm registry before writing it, so a
#     wrong/renamed id is skipped + reported instead of failing later at npx time.
#     Checks run in PARALLEL (wall-clock = slowest single call) and verified ids
#     are cached at ~/.adf/mcp-verify-cache, so later projects on this machine do
#     zero network calls. Disable with MCP_VERIFY=0; offline writes unverified.
#   - Prints which Gated servers the stack implies, but never wires them.

set -u

FRAMEWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="${1:-$(cd "$FRAMEWORK_DIR/.." && pwd)}"
MCP_FILE="$PROJECT_DIR/.mcp.json"
PKG_JSON="$PROJECT_DIR/package.json"
COMPONENTS_JSON="$PROJECT_DIR/components.json"
IGNORE_FILE="$PROJECT_DIR/.mcp-ignore"

echo "[mcp-sync] Ensuring free MCP servers in .mcp.json (rules/mcp-rules.md)..."

if command -v node >/dev/null 2>&1; then
  node - "$MCP_FILE" "$PKG_JSON" "$COMPONENTS_JSON" "$IGNORE_FILE" <<'JSEOF'
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const pexec = promisify(exec);
const [mcpPath, pkgPath, componentsPath, ignorePath] = process.argv.slice(2);

// Free (Enforced) server definitions — no env, no credentials.
const FREE = {
  'sequential-thinking': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
  'context7':            { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
  'playwright':          { command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
  'next-devtools':       { command: 'npx', args: ['-y', 'next-devtools-mcp'] },
  'mui':                 { command: 'npx', args: ['-y', '@mui/mcp'] },
  'shadcn':              { command: 'npx', args: ['-y', 'shadcn@latest', 'mcp'] },
  'prisma':              { command: 'npx', args: ['-y', 'prisma', 'mcp'] },
};

let deps = {};
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
} catch (e) { /* no/!parseable package.json — non-node project, trio still applies */ }
const has = (d) => Object.prototype.hasOwnProperty.call(deps, d);
const hasComponentsJson = fs.existsSync(componentsPath);

// Which free servers does this stack get?
const want = new Set(['sequential-thinking', 'context7']); // always-on (fetch excluded: native WebFetch covers it)
const frontend = ['next', 'react', 'react-dom', 'vue', 'svelte', '@angular/core', 'solid-js', 'preact'].some(has);
if (frontend) want.add('playwright');
if (has('next')) want.add('next-devtools');
if (has('@mui/material')) want.add('mui');
if (hasComponentsJson) want.add('shadcn');
if (has('prisma') || has('@prisma/client')) want.add('prisma');

// Opt-out list: project-root .mcp-ignore, one server name per line, # comments.
// A name listed here is never auto-added, AND a framework-written free entry that
// exactly matches FREE[name] is removed so it stays gone across pulls. The user's
// own / modified / gated entries are never touched.
// Opt-out merges two sources (both optional, # comments allowed):
//   ~/.adf/mcp-ignore   — machine-wide: a server you never want in any project
//   <project>/.mcp-ignore — project-level
const ignore = new Set();
function loadIgnore(p) {
  try {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const name = line.replace(/#.*/, '').trim();
      if (name) ignore.add(name);
    }
  } catch (e) { /* file absent — nothing to add */ }
}
loadIgnore(path.join(os.homedir(), '.adf', 'mcp-ignore')); // machine-wide
loadIgnore(ignorePath);                                    // project-level

// Load existing .mcp.json without clobbering. Parse error => do not touch.
let cfg = { mcpServers: {} };
let existed = false;
if (fs.existsSync(mcpPath)) {
  existed = true;
  try {
    cfg = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    if (!cfg.mcpServers || typeof cfg.mcpServers !== 'object') cfg.mcpServers = {};
  } catch (e) {
    console.log('  ! .mcp.json present but unparseable — leaving it untouched (' + e.message + ')');
    process.exit(0);
  }
}

const pkgSpec = (def) => (def.args || []).find(a => a && !a.startsWith('-')) || '';

// ── Registry verification (parallel + machine cache) ──────────────────────
// Confirm each npm package resolves before writing it, so a renamed/typo'd id
// never lands in .mcp.json to fail later at `npx` time.
//   ok       -> registry confirms the package        => write (verified)
//   notfound -> registry reachable, returns 404       => SKIP + report
//   unknown  -> npm absent / offline / timeout        => write (unverified, never blocks)
// Checks run concurrently (wall-clock = slowest single call). Verified ids are
// cached at ~/.adf/mcp-verify-cache so later projects on this machine do zero
// network calls. Disable entirely with MCP_VERIFY=0.
(async () => {
  const VERIFY = process.env.MCP_VERIFY !== '0';
  const cacheDir = path.join(os.homedir(), '.adf');
  const cachePath = path.join(cacheDir, 'mcp-verify-cache');
  let cache = new Set();
  try { cache = new Set(fs.readFileSync(cachePath, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)); } catch (e) {}

  let npmOk = false;
  if (VERIFY) { try { await pexec('npm --version', { timeout: 10000 }); npmOk = true; } catch (e) {} }

  // Remove framework-written free entries the user has chosen to ignore.
  const removed = [];
  for (const name of Object.keys(cfg.mcpServers)) {
    if (ignore.has(name) && FREE[name] && JSON.stringify(cfg.mcpServers[name]) === JSON.stringify(FREE[name])) {
      delete cfg.mcpServers[name];
      removed.push(name);
    }
  }

  // Candidates to add: wanted, not already present, not ignored.
  const ignored = [], candidates = [];
  for (const name of want) {
    if (name in cfg.mcpServers) continue;
    if (ignore.has(name)) { if (!removed.includes(name)) ignored.push(name); continue; }
    candidates.push(name);
  }

  // Resolve verification status for each candidate, network calls in parallel.
  const status = {};
  const toCheck = [];
  for (const name of candidates) {
    const spec = pkgSpec(FREE[name]);
    if (!VERIFY || !npmOk || !spec) { status[name] = 'unknown'; continue; }
    if (cache.has(spec)) { status[name] = 'ok'; continue; }
    toCheck.push(name);
  }
  const newlyOk = [];
  await Promise.all(toCheck.map(async (name) => {
    const spec = pkgSpec(FREE[name]);
    try {
      await pexec('npm view ' + JSON.stringify(spec) + ' version', { timeout: 15000 });
      status[name] = 'ok'; newlyOk.push(spec);
    } catch (e) {
      if (e && (e.killed || e.signal === 'SIGTERM')) { status[name] = 'unknown'; return; } // timed out
      const msg = ((e && e.stderr ? e.stderr.toString() : '') + (e && e.message ? e.message : ''));
      status[name] = /E404|404 Not Found|is not in the npm registry/i.test(msg) ? 'notfound' : 'unknown';
    }
  }));
  if (newlyOk.length) {
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) {}
    try { fs.writeFileSync(cachePath, [...new Set([...cache, ...newlyOk])].join('\n') + '\n', 'utf8'); } catch (e) {}
  }

  // Apply.
  const added = [], unverified = [], unresolved = [];
  for (const name of candidates) {
    const v = status[name] || 'unknown';
    if (v === 'notfound') { unresolved.push(name); continue; }
    cfg.mcpServers[name] = FREE[name];
    added.push(name);
    if (v === 'unknown') unverified.push(name);
  }

  if (added.length || removed.length) {
    fs.writeFileSync(mcpPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    if (added.length) console.log('  ' + (existed ? '+ topped up' : '+ created') + ' .mcp.json — added: ' + added.join(', '));
    if (removed.length) console.log('  - removed (listed in .mcp-ignore): ' + removed.join(', '));
  } else {
    console.log('  .mcp.json free servers already current — OK');
  }
  if (ignored.length) console.log('  · skipped (.mcp-ignore): ' + ignored.join(', '));
  if (unresolved.length) console.log('  ! SKIPPED — package id not found on npm (verify the correct name, then run mcp-connector): ' + unresolved.join(', '));
  if (unverified.length && VERIFY) console.log('  ~ added WITHOUT registry verification (' + (!npmOk ? 'npm unavailable/offline' : 'registry check inconclusive') + '): ' + unverified.join(', '));

  // Inform (do NOT wire) about Gated servers the stack implies.
  const gated = [];
  if (has('@supabase/supabase-js')) gated.push('supabase');
  if (has('pg') || has('postgres')) gated.push('postgres');
  if (has('mongodb') || has('mongoose')) gated.push('mongodb');
  if (has('stripe')) gated.push('stripe');
  if (has('@sentry/node') || has('@sentry/nextjs') || has('@sentry/react')) gated.push('sentry');
  if (gated.length) {
    console.log('  i gated servers implied (need approval + ${ENV_VAR}, not auto-wired): ' + gated.join(', '));
    console.log('    run mcp-connector (or /do) to wire them with credentials.');
  }
})();
JSEOF
else
  # node absent: write the free always-on servers only if no .mcp.json exists yet.
  if [[ ! -f "$MCP_FILE" ]]; then
    cat > "$MCP_FILE" <<'JSON'
{
  "mcpServers": {
    "sequential-thinking": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"] },
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }
  }
}
JSON
    echo "  + created .mcp.json with free always-on servers (node not found — stack-specific servers skipped; run mcp-connector later)"
  else
    echo "  (node not found and .mcp.json exists — skipping; run mcp-connector to refresh)"
  fi
fi
echo ""
