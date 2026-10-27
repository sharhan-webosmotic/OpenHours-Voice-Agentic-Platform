import { defineConfig } from "vitest/config";

/**
 * ADF canonical Vitest config. Enforces the framework coverage floor (98% on
 * statements, branches, functions, lines) and routes ALL coverage output into
 * the gitignored AI_DOCS artifacts folder (never project root or /tmp).
 * Use for Vite / React-SPA stacks. For Next.js / CRA / Nest use jest.config.ts.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node", // switch to "jsdom" for browser/UI projects
    include: [
      "src/**/*.{test,spec}.{ts,tsx,js,jsx}",
      "tests/unit/**/*.{test,spec}.{ts,tsx,js,jsx}",
      "tests/integration/**/*.{test,spec}.{ts,tsx,js,jsx}",
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "AI_DOCS/quality/test-artifacts/coverage",
      reporter: ["json-summary", "json", "lcov", "text"],
      include: ["src/**", "app/**"],
      exclude: ["**/*.{test,spec}.*", "tests/**", "**/*.d.ts", "**/index.{ts,tsx}", "**/*.config.*"],
      thresholds: {
        statements: 98,
        branches: 98,
        functions: 98,
        lines: 98,
      },
    },
  },
});
