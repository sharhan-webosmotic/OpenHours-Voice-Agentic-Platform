import { expect, test, type Page } from '@playwright/test';

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

const EMAIL = process.env.E2E_EMAIL;
/** The one-time password `pnpm provision:clinic` printed. Spent by the first test. */
const TEMPORARY_PASSWORD = process.env.E2E_TEMP_PASSWORD;
const API_HOST = process.env.E2E_API_HOST ?? 'api.clinicai.localhost';

/** Chosen here, not configured: it exists only between the first test and the last. */
const PASSWORD = 'e2e-replacement-password';

test.skip(
  EMAIL === undefined || TEMPORARY_PASSWORD === undefined,
  'Set E2E_EMAIL and E2E_TEMP_PASSWORD from `pnpm provision:clinic`. See docs/features/sign-in.md.',
);

// Ordered, because the first test spends the temporary password the rest depend on.
test.describe.configure({ mode: 'serial' });

const REFRESH_COOKIE = 'clinicai_refresh';

const refreshCookie = async (page: Page) => {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === REFRESH_COOKIE);
};

const signIn = async (page: Page, password = PASSWORD) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(EMAIL!);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
};

test.describe('the first sign-in with an administrator-issued password', () => {
  test('is gated until the password is replaced, and then works', async ({ page }) => {
    await signIn(page, TEMPORARY_PASSWORD);

    /**
     * Not the dashboard. The API refuses this user every route but the four that lead out of
     * the state, so anywhere else would be a wall of 403s rather than an instruction. This
     * is the whole first-login gate, end to end: a flag in the token, a problem type the
     * client branches on, and a screen.
     */
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

    await page.getByLabel('Temporary password').fill(TEMPORARY_PASSWORD!);
    // `exact`, because "New password" is also a substring of "Confirm new password" and
    // Playwright's strict mode refuses an ambiguous locator rather than picking one.
    await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm new password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();

    // The change revoked every session, so the cookie must be gone too: the user signs in
    // again, which is also the only proof the new password took effect.
    expect(await refreshCookie(page)).toBeUndefined();

    await signIn(page);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });

  test('refuses the temporary password once it has been replaced', async ({ page }) => {
    await signIn(page, TEMPORARY_PASSWORD);

    // One indistinguishable error for every credential failure, so the form cannot be used
    // to work out which passwords were once valid.
    await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');
  });
});

test.describe('the refresh cookie', () => {
  test('is set with every flag D-002 requires', async ({ page }) => {
    await signIn(page);
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
    await signIn(page);
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
    await signIn(page);
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
    await signIn(page);
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
    await signIn(page);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
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

    await page.getByLabel('Email address').fill(EMAIL!);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
  });
});
