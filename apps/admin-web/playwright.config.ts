import { defineConfig, devices } from '@playwright/test';

/**
 * The browser tests, and the only thing in this repository that can prove the session works.
 *
 * WHY THEY EXIST SEPARATELY FROM `pnpm check`. Everything else runs without a browser. The
 * API suite uses supertest, which sends no `Origin` header, so `SameSite` is never evaluated
 * by anything. The component suite runs in jsdom, which has no cookie jar shared with a
 * server. Both can pass completely while the cookie arrangement is broken, because neither
 * one is a browser. D-002's whole claim, that a refresh token in an httpOnly SameSite=Strict
 * cookie is attached to a same-site fetch from the dashboard, is only checkable here.
 *
 * NOT IN THE GATE, because they need a running API, a PostgreSQL database and two named
 * hosts. A gate leg that cannot run on a clean checkout is a gate leg that gets skipped, and
 * a skipped leg is the lying-gate problem this feature already removed once. Run them
 * deliberately: `pnpm e2e`.
 *
 * THE HOSTS MATTER AND ARE NOT INTERCHANGEABLE WITH `localhost`. SameSite is evaluated on the
 * registrable domain, so the console and the API have to be siblings under one.
 * `app.openhours.localhost` and `api.openhours.localhost` are; `localhost:5173` and
 * `localhost:3000` are the same host and would make the test prove nothing about the
 * arrangement that ships. Add both to /etc/hosts. See docs/features/sign-in.md.
 *
 * `COOKIE_SECURE` MUST STAY TRUE. Browsers treat `*.localhost` as a trustworthy origin, so a
 * `Secure` cookie does set over plain HTTP there. Turning it off to make the test pass would
 * disable the single setting the test exists to exercise.
 */

const CONSOLE_URL = 'http://admin.openhours.localhost:5174';

export default defineConfig({
  testDir: './tests',
  // One worker: the tests share one provisioned account, and signing out in one would end
  // the session another is using.
  workers: 1,
  fullyParallel: false,
  // Fail rather than retry. A session test that passes on the second attempt is a session
  // test that found a real race and hid it.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: CONSOLE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Only the console. The API is started separately, because it needs a database and
    // migrations, and a test runner that silently starts infrastructure hides what it
    // depends on.
    command: 'pnpm dev',
    url: CONSOLE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
