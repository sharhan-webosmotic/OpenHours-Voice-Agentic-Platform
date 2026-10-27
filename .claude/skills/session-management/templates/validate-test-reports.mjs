#!/usr/bin/env node
/**
 * ADF test-report validator.
 *
 * Validates the reports produced by a full-scope test run WITHOUT re-running
 * anything. Mirrors the semantics of `.claude/hooks/mavs-gate.sh` so a local
 * `npm run test:validate` gives the same verdict the merge gate will.
 *
 * Checks:
 *   1. Coverage: AI_DOCS/quality/test-artifacts/coverage/coverage-summary.json
 *      -> statements, branches, functions, lines each >= FLOOR (default 98).
 *   2. MAVS verdicts: every AI_DOCS/quality/mavs/*.json (excluding geometry.*)
 *      -> status === "PASS", failed === 0, and not STALE (source_commit === HEAD).
 *
 * Exit 0 = all pass. Exit 1 = one or more failures (printed as a table).
 * Node builtins only.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const FLOOR = Number(process.env.ADF_COVERAGE_FLOOR || 98);
const COVERAGE_SUMMARY = "AI_DOCS/quality/test-artifacts/coverage/coverage-summary.json";
const MAVS_DIR = "AI_DOCS/quality/mavs";

/** @returns {string|null} current HEAD sha, or null when not a git repo. */
function head() {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

/** @type {{name: string, ok: boolean, detail: string}[]} */
const rows = [];

// 1. Coverage
if (existsSync(COVERAGE_SUMMARY)) {
  const summary = JSON.parse(readFileSync(COVERAGE_SUMMARY, "utf8"));
  const total = summary.total || {};
  for (const metric of ["statements", "branches", "functions", "lines"]) {
    const pct = total[metric] ? Number(total[metric].pct) : 0;
    const ok = pct >= FLOOR;
    rows.push({ name: `coverage:${metric}`, ok, detail: `${pct.toFixed(2)}% (floor ${FLOOR}%)` });
  }
} else {
  rows.push({
    name: "coverage",
    ok: false,
    detail: `missing ${COVERAGE_SUMMARY} (run the coverage suite first)`,
  });
}

// 2. MAVS verdicts
const HEAD = head();
if (existsSync(MAVS_DIR)) {
  const files = readdirSync(MAVS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("geometry."))
    .sort();
  for (const f of files) {
    let report;
    try {
      report = JSON.parse(readFileSync(join(MAVS_DIR, f), "utf8"));
    } catch {
      rows.push({ name: `mavs:${f}`, ok: false, detail: "unreadable / invalid JSON" });
      continue;
    }
    if (typeof report.status === "undefined") continue; // not a verdict report
    const failed = Number(report.failed || 0);
    const stale = HEAD && report.source_commit && report.source_commit !== HEAD;
    if (report.status === "SKIP" || report.status === "MISSING_TOOL") {
      rows.push({ name: `mavs:${f}`, ok: true, detail: report.status });
      continue;
    }
    const ok = report.status === "PASS" && failed === 0 && !stale;
    let detail = `status=${report.status} failed=${failed}`;
    if (stale) detail += " STALE (source_commit != HEAD)";
    rows.push({ name: `mavs:${f}`, ok, detail });
  }
}

// Report
const width = Math.max(...rows.map((r) => r.name.length), 12);
console.log("\nADF test-report validation");
console.log("-".repeat(width + 40));
for (const r of rows) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`);
}
console.log("-".repeat(width + 40));

const failures = rows.filter((r) => !r.ok);
if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed. Reports are NOT valid.`);
  process.exit(1);
}
console.log("\nAll reports valid.");
process.exit(0);
