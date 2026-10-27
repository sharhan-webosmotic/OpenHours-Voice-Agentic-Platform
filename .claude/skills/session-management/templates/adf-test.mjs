#!/usr/bin/env node
/**
 * ADF full-scope test orchestrator.
 *
 * Runs the WHOLE project's test scope in one command and validates the report:
 *   1. JS/TS unit + integration with coverage (the `test` npm script).
 *   2. Python (pytest + check_func_coverage.py) when pyproject.toml is present.
 *   3. Go (go test -coverprofile + check_func_coverage.sh) when go.mod is present.
 *   4. Playwright E2E when a playwright config or tests/e2e exists.
 * Every raw artifact is written under AI_DOCS/quality/test-artifacts/ (gitignored).
 * Each runner's real result is normalized into AI_DOCS/quality/mavs/<v>.json
 * (never hand-written PASS), stamped source_commit = git rev-parse HEAD.
 * Finally the validator runs and its exit code is propagated.
 *
 * Usage: node scripts/adf-test.mjs [--ci]
 * `--ci` sets CI=1 (headless Playwright, strict). Node builtins only.
 */
import { spawnSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CI = process.argv.includes("--ci");
if (CI) process.env.CI = "1";

const ART = "AI_DOCS/quality/test-artifacts";
const MAVS = "AI_DOCS/quality/mavs";
for (const d of [ART, join(ART, "coverage"), join(ART, "e2e"), join(ART, "go"), MAVS]) {
  mkdirSync(d, { recursive: true });
}

function head() {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}
const HEAD = head();

/** Run a command, stream its output, return its exit code (127 when the tool is absent). */
function run(cmd) {
  console.log(`\n$ ${cmd}`);
  const r = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (r.error) return 127;
  return r.status == null ? 1 : r.status;
}

function writeReport(validator, status, failed, findings = []) {
  const report = {
    validator,
    generated_at: new Date().toISOString(),
    source_commit: HEAD,
    status,
    total: 1,
    passed: status === "PASS" ? 1 : 0,
    failed,
    skipped: status === "SKIP" ? 1 : 0,
    findings,
  };
  writeFileSync(join(MAVS, `${validator}.json`), JSON.stringify(report, null, 2));
  console.log(`  -> ${MAVS}/${validator}.json: ${status}`);
}

let overall = 0;

// 1. JS/TS unit + integration + coverage (the canonical `test` script)
{
  const code = run("npm run test --silent");
  if (code !== 0) overall = 1;
  const findings = [];
  const sumPath = join(ART, "coverage", "coverage-summary.json");
  if (existsSync(sumPath)) {
    try {
      const t = JSON.parse(readFileSync(sumPath, "utf8")).total || {};
      for (const m of ["statements", "branches", "functions", "lines"]) {
        if (t[m]) findings.push(`${m}: ${t[m].pct}%`);
      }
    } catch { /* coverage summary unreadable, leave findings empty */ }
  }
  writeReport("qa", code === 0 ? "PASS" : "FAIL", code === 0 ? 0 : 1, findings);
}

// 2. Python (optional)
if (existsSync("pyproject.toml")) {
  const c1 = run("pytest");
  const c2 = run(`python scripts/check_func_coverage.py --coverage ${join(ART, "coverage", "coverage.json")} --fail-under ${process.env.ADF_COVERAGE_FLOOR || 98} --include app --include src`);
  const ok = c1 === 0 && c2 === 0;
  if (!ok) overall = 1;
  writeReport("py-test", ok ? "PASS" : "FAIL", ok ? 0 : 1);
}

// 3. Go (optional)
if (existsSync("go.mod")) {
  const c1 = run(`go test -coverprofile=${join(ART, "go", "cover.out")} ./...`);
  const c2 = run(`bash scripts/check_func_coverage.sh ${join(ART, "go", "cover.out")} ${process.env.ADF_COVERAGE_FLOOR || 98}`);
  const ok = c1 === 0 && c2 === 0;
  if (!ok) overall = 1;
  writeReport("go-test", ok ? "PASS" : "FAIL", ok ? 0 : 1);
}

// 4. Playwright E2E (optional)
const hasPw =
  existsSync("playwright.config.ts") || existsSync("playwright.config.js") || existsSync("tests/e2e");
if (hasPw) {
  const code = run("npx playwright test");
  let failed = code === 0 ? 0 : 1;
  const junit = join(ART, "e2e", "junit.xml");
  if (existsSync(junit)) {
    const xml = readFileSync(junit, "utf8");
    const m = xml.match(/failures="(\d+)"[^>]*errors="(\d+)"/) || xml.match(/errors="(\d+)"[^>]*failures="(\d+)"/);
    if (m) failed = Number(m[1]) + Number(m[2]);
  }
  if (code !== 0 || failed > 0) overall = 1;
  writeReport("e2e", code === 0 && failed === 0 ? "PASS" : "FAIL", failed);
} else {
  writeReport("e2e", "SKIP", 0, ["no playwright config or tests/e2e directory"]);
}

// 5. Validate the reports (same semantics as the merge gate)
console.log("\n=== validating reports ===");
const vcode = run("node scripts/validate-test-reports.mjs");
if (vcode !== 0) overall = 1;

process.exit(overall);
