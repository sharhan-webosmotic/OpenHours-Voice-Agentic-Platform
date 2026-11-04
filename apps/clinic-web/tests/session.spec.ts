import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { readAccounts, type ReadyAccount } from './support/accounts.js';

/**
 * The claim D-002 makes, checked in a real browser.
 *
 * WHAT ONLY THIS FILE CAN PROVE. The refresh token is an httpOnly, Secure, SameSite=Strict
 * cookie scoped to `/api/v1/auth`, and the access token lives in a JavaScript closure that a
 * page reload destroys. So a reload has no credential in hand and must recover the session
 * from a cookie it cannot read, sent by a browser applying a same-site rule evaluated on the
 * registrable domain. Supertest sends no `Origin`, and jsdom has no shared cookie jar.
 * Neither of them is capable of being wrong about this, which is why neither of them counts.
 *
 * THE ACCOUNT COMES FROM `pnpm provision:clinic`, passed in by environment variable rather
 * than created here. Creating it would mean this test owning a database connection, and the
 * credential it would print is a real working one. The runbook in docs/features/sign-in.md
 * has the two commands.
 *
 * THE SUITE IS ORDERED, AND IT NEEDS A FRESH CLINIC EACH RUN. A provisioned account arrives
 * with `mustChangePassword` set, because that is the only way D-003 creates a real user, so
 * the first test here walks the first-login change and every later test signs in with the
 * password it chose. That makes the suite self-contained rather than needing an account
 * somebody prepared by hand, and it means the temporary password is spent once: re-running
 * without re-provisioning fails at the first test. `workers: 1` and `fullyParallel: false`
 * in the config are what make the ordering real rather than hopeful.
 */

const API_HOST = process.env.E2E_API_HOST ?? 'api.clinicai.localhost';
const REFRESH_COOKIE = 'clinicai_refresh';

/**
 * ONE ACCOUNT PER TEST, provisioned by `tests/global-setup.ts`.
 *
 * These used to come from `E2E_EMAIL` and `E2E_TEMP_PASSWORD`, so every test below signed
 * in as the same email. Eight sign-ins in one sixty-second window against a documented
 * per-email limit of five meant the suite threw a 429 at itself and failed partway through,
 * which is review finding I3. The limits are deliberately NOT raised: they are a control,
 * and this is the only layer that exercises them through a real browser. Each test taking
 * its own email removes the collision instead.
 */
const accounts = readAccounts(resolve(import.meta.dirname, '..'));

/** The account reserved for the first-login tests, still holding its temporary password. */
const firstLogin = accounts.firstLogin;

/**
 * The account for one specific test, by index.
 *
 * Indexed rather than popped from a shared queue so a test's account does not depend on
 * which tests ran before it, which is what makes these tests independent of each other
 * now that they no longer share a credential.
 */
const ready = (index: number): ReadyAccount => {
  const account = accounts.ready[index];

  if (account === undefined) {
    throw new Error(
      `no prepared account at index ${index}. Raise READY_ACCOUNTS in tests/global-setup.ts.`,
    );
  }

  return account;
};

const refreshCookie = async (page: Page) => {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === REFRESH_COOKIE);
};

const signInAs = async (page: Page, email: string, password: string) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
};

/**
 * Ordered, and the only describe that needs to be: the first test spends the temporary
 * password the second one then proves is dead. Every other test below owns its own account
 * and depends on nothing that ran before it.
 */
test.describe.configure({ mode: 'serial' });

test.describe('the first sign-in with an administrator-issued password', () => {
  /** Chosen here: it exists only between these two tests. */
  const CHOSEN = 'e2e-chosen-password';

  test('is gated until the password is replaced, and then works', async ({ page }) => {
    await signInAs(page, firstLogin.email, firstLogin.temporaryPassword);

    /**
     * Not the dashboard. The API refuses this user every route but the four that lead out of
     * the state, so anywhere else would be a wall of 403s rather than an instruction. This
     * is the whole first-login gate, end to end: a flag in the token, a problem type the
     * client branches on, and a screen.
     */
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

    await page.getByLabel('Temporary password').fill(firstLogin.temporaryPassword);
    // `exact`, because "New password" is also a substring of "Confirm new password" and
    // Playwright's strict mode refuses an ambiguous locator rather than picking one.
    await page.getByLabel('New password', { exact: true }).fill(CHOSEN);
    await page.getByLabel('Confirm new password').fill(CHOSEN);
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();

    // The change revoked every session, so the cookie must be gone too: the user signs in
    // again, which is also the only proof the new password took effect.
    expect(await refreshCookie(page)).toBeUndefined();

    await signInAs(page, firstLogin.email, CHOSEN);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });

  test('refuses the temporary password once it has been replaced', async ({ page }) => {
    await signInAs(page, firstLogin.email, firstLogin.temporaryPassword);

    // One indistinguishable error for every credential failure, so the form cannot be used
    // to work out which passwords were once valid.
    await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');
  });
});

test.describe('the refresh cookie', () => {
  test('is set with every flag D-002 requires', async ({ page }) => {
    const account = ready(0);
    await signInAs(page, account.email, account.password);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    const cookie = await refreshCookie(page);

    expect(cookie, 'no refresh cookie was set at all').toBeDefined();
    // httpOnly: a script cannot read it, so an XSS cannot steal a long-lived credential.
    expect(cookie!.httpOnly).toBe(true);
    // Secure: set over plain HTTP only because browsers treat *.localhost as trustworthy.
    // If this is false, COOKIE_SECURE was turned off, which defeats the whole test.
    expect(cookie!.secure).toBe(true);
    // Strict, not Lax. Lax relaxes top-level navigation, which this cookie never uses.
    expect(cookie!.sameSite).toBe('Strict');
    // Scoped to the auth routes, so it is not attached to every API call.
    expect(cookie!.path).toBe('/api/v1/auth');
    expect(cookie!.domain).toContain(API_HOST);
  });

  test('is what restores the session after a reload destroys the access token', async ({
    page,
  }) => {
    const account = ready(1);
    await signInAs(page, account.email, account.password);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    /**
     * THE CENTRAL ASSERTION OF THIS FEATURE. A reload destroys the closure holding the
     * access token, so the application starts with no credential it can read. If it is still
     * signed in afterwards, the browser attached the refresh cookie to the boot refresh, and
     * the SameSite arrangement works. If it is not, the user is thrown out on every reload
     * and D-002 is wrong.
     */
    const refreshCall = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/refresh') && response.request().method() === 'POST',
    );

    await page.reload();

    const response = await refreshCall;
    expect(response.status(), 'the refresh was refused, so the cookie was not sent').toBe(200);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
  });

  test('carries the custom header, without which the API refuses the refresh', async ({ page }) => {
    const account = ready(2);
    await signInAs(page, account.email, account.password);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    const refreshCall = page.waitForRequest(
      (request) => request.url().includes('/api/v1/auth/refresh') && request.method() === 'POST',
    );

    await page.reload();

    const request = await refreshCall;
    /**
     * `allHeaders()`, not `headers()`. `headers()` returns only what the page set; `Origin`
     * is added by the browser's own network stack and is absent from it, which made this
     * assertion fail against a request that did carry the header.
     */
    const headers = await request.allHeaders();

    // ADR-0001: a cross-site HTML form cannot set a custom header, and a cross-site fetch
    // that does triggers a preflight the API's origin allow-list refuses. The client sends
    // it so no feature has to remember to.
    expect(headers['x-clinicai-csrf']).toBeDefined();
    // The browser's own statement of where the request came from, which is the layer that
    // catches a sibling subdomain SameSite=Strict would have let through.
    expect(headers['origin']).toContain('app.clinicai.localhost');
  });
});

test.describe('the access token', () => {
  test('is in no storage a script can read', async ({ page }) => {
    const account = ready(3);
    await signInAs(page, account.email, account.password);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    const stored = await page.evaluate(() => ({
      local: Object.entries({ ...window.localStorage }),
      session: Object.entries({ ...window.sessionStorage }),
      // A script-readable cookie would show up here. The refresh cookie is httpOnly, so it
      // must not.
      cookies: document.cookie,
    }));

    /**
     * D-002, checked where it matters rather than by reading the client. This product holds
     * patient health data: a token in `localStorage` leaves with the first cross-site
     * scripting bug, and this is the assertion that would catch somebody "fixing" the reload
     * behaviour by persisting it.
     */
    expect(stored.local).toEqual([]);
    expect(stored.session).toEqual([]);
    expect(stored.cookies).not.toContain(REFRESH_COOKIE);
  });
});

test.describe('signing out', () => {
  test('removes the cookie, and a reload does not bring the session back', async ({ page }) => {
    const account = ready(4);
    await signInAs(page, account.email, account.password);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    // Sign-out lives in the account menu since the shell was rebuilt to the dashboard
    // reference (ebb0530), where it is labelled "Logout".
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    expect(await refreshCookie(page)).toBeUndefined();

    // The real test of a sign-out: the server revoked the family, so even a cookie that
    // somehow survived would buy nothing.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  });
});

test.describe('a deep link while signed out', () => {
  test('is remembered and returned to after signing in', async ({ page }) => {
    await page.goto('/patients');

    // The guard sends them to sign-in carrying where they were going, in router state rather
    // than a ?next= parameter: a query parameter is editable, lands in logs and history, and
    // in this product a path can carry a patient id.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('next')).toBeNull();

    const account = ready(5);
    await page.getByLabel('Email address').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Exact, because the patients page also has a "Registered patients" heading.
    await expect(page.getByRole('heading', { name: 'Patients', exact: true })).toBeVisible();
  });
});
