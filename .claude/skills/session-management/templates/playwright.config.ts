import { defineConfig, devices } from "@playwright/test";

/**
 * ADF canonical Playwright config. Routes the JUnit report (for the MAVS gate)
 * and the HTML report + traces into the gitignored AI_DOCS artifacts folder
 * (never project root or /tmp). Reuses per-role auth state from
 * tests/e2e/.auth/<role>.json (see e2e-testing SKILL). Headless in CI.
 *
 * webServer owns the dev-server lifecycle: Playwright starts it, polls the URL
 * until ready, reuses a healthy running instance locally, and tears down after.
 * Test runs never start, restart, or poll the server by hand (testing-rules 36).
 */
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "AI_DOCS/quality/test-artifacts/e2e/results",
  webServer: {
    command: process.env.ADF_WEB_SERVER_CMD || "npm run dev",
    url: process.env.BASE_URL || "http://localhost:3000",
    reuseExistingServer: !CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: [
    ["junit", { outputFile: "AI_DOCS/quality/test-artifacts/e2e/junit.xml" }],
    ["html", { outputFolder: "AI_DOCS/quality/test-artifacts/e2e/html", open: "never" }],
    ["list"],
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    headless: CI || process.env.ADF_HEADLESS === "on",
    channel: "chrome",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
