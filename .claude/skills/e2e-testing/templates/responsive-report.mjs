/**
 * Merges the responsive-sweep artifacts into the two MAVS outputs:
 *
 *  1. `AI_DOCS/quality/mavs/geometry.<width>.json` — the per-width geometry
 *     dump (DATA artifact, no `status` field, skipped by mavs-gate.sh) read
 *     by the `ui` + `fidelity` validators and the `principal-designer` agent.
 *  2. `AI_DOCS/quality/mavs/responsive.json` — the verdict report
 *     (mavs-report-schema), parsed by `hooks/mavs-gate.sh` at the promotion
 *     merge. `FAIL` when any screen-width cell has a crit/high (functional)
 *     finding. `MISSING_TOOL` when the sweep never ran (no artifacts).
 *
 * Run AFTER `npx playwright test responsive-sweep` (the `npm run test:e2e` /
 * `test:ci` orchestrator wires this): `node tests/e2e/responsive-report.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ARTIFACT_DIR = path.join('AI_DOCS', 'quality', 'test-artifacts', 'responsive');
const MAVS_DIR = path.join('AI_DOCS', 'quality', 'mavs');
const FAILING = new Set(['crit', 'high']);

/** Reads the current git HEAD for the source_commit stamp. */
function gitHead() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

/** Reads the active milestone id from the task ledger, best effort. */
function milestoneId() {
  try {
    const ledger = fs.readFileSync(path.join('AI_DOCS', 'memory', 'task-ledger.md'), 'utf8');
    const m = ledger.match(/\bM\d{2}\b/);
    return m ? m[0] : 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

fs.mkdirSync(MAVS_DIR, { recursive: true });

const artifactFiles = fs.existsSync(ARTIFACT_DIR)
  ? fs.readdirSync(ARTIFACT_DIR).filter((f) => f.endsWith('.json'))
  : [];

if (artifactFiles.length === 0) {
  fs.writeFileSync(
    path.join(MAVS_DIR, 'responsive.json'),
    JSON.stringify(
      {
        validator: 'responsive',
        milestone: milestoneId(),
        generated_at: new Date().toISOString(),
        source_commit: gitHead(),
        status: 'MISSING_TOOL',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        findings: [{ id: 'RSP-00', severity: 'high', detail: 'responsive sweep produced no artifacts (spec not run or Playwright absent)', location: ARTIFACT_DIR }],
      },
      null,
      2,
    ),
  );
  console.error('responsive-report: no artifacts found, wrote MISSING_TOOL');
  process.exit(0);
}

const byWidth = new Map();
const findings = [];
const cells = new Map();

for (const file of artifactFiles) {
  const a = JSON.parse(fs.readFileSync(path.join(ARTIFACT_DIR, file), 'utf8'));
  const cellKey = `${a.screen}@${a.width}`;
  if (!cells.has(cellKey)) cells.set(cellKey, false);

  if (!byWidth.has(a.width)) byWidth.set(a.width, { width: a.width, generated_at: new Date().toISOString(), screens: {} });
  byWidth.get(a.width).screens[`${a.screen}.${a.phase}`] = { url: a.url, nodes: a.nodes };

  for (const v of a.violations || []) {
    findings.push({
      id: v.id,
      severity: v.severity,
      detail: `${v.check}: ${v.detail}`,
      location: `${a.screen}@${a.width} (${a.phase}) ${v.selector}`,
    });
    if (FAILING.has(v.severity)) cells.set(cellKey, true);
  }
}

for (const [width, dump] of byWidth) {
  fs.writeFileSync(path.join(MAVS_DIR, `geometry.${width}.json`), JSON.stringify(dump, null, 2));
}

const total = cells.size;
const failed = [...cells.values()].filter(Boolean).length;
const report = {
  validator: 'responsive',
  milestone: milestoneId(),
  generated_at: new Date().toISOString(),
  source_commit: gitHead(),
  status: failed > 0 ? 'FAIL' : 'PASS',
  total,
  passed: total - failed,
  failed,
  skipped: 0,
  findings: findings.sort((a, b) => (FAILING.has(b.severity) ? 1 : 0) - (FAILING.has(a.severity) ? 1 : 0)),
};

fs.writeFileSync(path.join(MAVS_DIR, 'responsive.json'), JSON.stringify(report, null, 2));
console.log(`responsive-report: ${report.status} (${failed}/${total} screen-width cells with functional defects, ${findings.length} findings, geometry at ${byWidth.size} widths)`);
