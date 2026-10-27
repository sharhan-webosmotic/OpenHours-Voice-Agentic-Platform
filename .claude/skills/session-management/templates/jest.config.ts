import type { Config } from "jest";

/**
 * ADF canonical Jest config. Enforces the framework coverage floor (98% on
 * statements, branches, functions, lines) and routes ALL coverage output into
 * the gitignored AI_DOCS artifacts folder (never project root or /tmp).
 * Use for Next.js / CRA / Nest stacks. For Vite / React-SPA use vitest.config.ts.
 */
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node", // switch to "jsdom" for browser/UI projects
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.(test|spec).(ts|tsx|js|jsx)"],
  collectCoverage: true,
  coverageDirectory: "AI_DOCS/quality/test-artifacts/coverage",
  coverageReporters: ["json-summary", "json", "lcov", "text"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx,js,jsx}",
    "app/**/*.{ts,tsx,js,jsx}",
    "!**/*.d.ts",
    "!**/index.{ts,tsx}",
    "!**/*.config.*",
  ],
  coverageThreshold: {
    global: { statements: 98, branches: 98, functions: 98, lines: 98 },
  },
};

export default config;
