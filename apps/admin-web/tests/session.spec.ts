import { expect, test, type Page } from '@playwright/test';

/**
 * The admin console in a real browser.
 *
 * TWO THINGS ONLY THIS FILE CAN CHECK. First, the same cookie claim the dashboard's suite
 * makes: a reload destroys the in-memory access token, so staying signed in proves the
 * browser attached an httpOnly SameSite=Strict cookie from a second subdomain under the same
 * registrable domain. Second, and specific to this application, that a clinic account is
 * actually turned away here rather than signed in and left looking at refusals.
 *
 * THE CLINIC ACCOUNT IS THE INTERESTING CASE and it needs no admin credential at all, so
 * that test runs even when only `pnpm provision:clinic` has been used. A platform account
 * has to be created by hand today, because nothing provisions one: the admin console's own
 * "Internal users" page is a placeholder, and `prisma/seed.ts` is the only thing that writes
 * a SUPER_ADMIN. That gap is named in docs/features/sign-in.md.
 */

const CLINIC_EMAIL = process.env.E2E_EMAIL;
const CLINIC_PASSWORD = process.env.E2E_CLINIC_PASSWORD;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const API_HOST = process.env.E2E_API_HOST ?? 'api.openhours.localhost';

const REFRESH_COOKIE = 'openhours_refresh';

const signIn = async (page: Page, email: string, password: string) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
};

const refreshCookie = async (page: Page) => {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === REFRESH_COOKIE);
};

test.describe('a clinic account at the admin console', () => {
  test.skip(
    CLINIC_EMAIL === undefined || CLINIC_PASSWORD === undefined,
    'Set E2E_EMAIL and E2E_CLINIC_PASSWORD. See docs/features/sign-in.md.',
  );

  test('is refused with an explanation, and gets no session at all', async ({ page }) => {
    await signIn(page, CLINIC_EMAIL!, CLINIC_PASSWORD!);

    // Told where to go, rather than left to work it out.
    await expect(page.getByRole('alert')).toContainText('clinic dashboard');

    /**
     * THE PART THAT MATTERS MORE THAN THE MESSAGE. The refusal happens before a token is
     * issued, so no refresh cookie is set. Checking the audience in the front end alone
     * would leave a valid cookie behind for a session this application then rejects, and the
     * user would be half signed in: refused at the screen, and holding a credential that
     * works. ADR-0001 says this is user experience and defence in depth rather than the
     * boundary; the boundary is the permission matrix. This asserts the depth is real.
     */
    expect(await refreshCookie(page)).toBeUndefined();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  });
});

test.describe('a platform account', () => {
  test.skip(
    ADMIN_EMAIL === undefined || ADMIN_PASSWORD === undefined,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD. Nothing provisions a platform user yet: see docs/features/sign-in.md.',
  );

  test('signs in and keeps the session across a reload', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    // The one word of copy that distinguishes the two applications to a user.
    await expect(page.getByText('Admin')).toBeVisible();

    const cookie = await refreshCookie(page);
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.secure).toBe(true);
    expect(cookie!.sameSite).toBe('Strict');
    expect(cookie!.path).toBe('/api/v1/auth');
    expect(cookie!.domain).toContain(API_HOST);

    const refreshCall = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/refresh') && response.request().method() === 'POST',
    );

    await page.reload();

    // Same claim as the dashboard's, from a different subdomain. Both have to hold, because
    // SameSite is evaluated on the registrable domain and this is the second sibling.
    expect((await refreshCall).status()).toBe(200);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });

  test('keeps the access token out of every storage a script can read', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    const stored = await page.evaluate(() => ({
      local: Object.entries({ ...window.localStorage }),
      session: Object.entries({ ...window.sessionStorage }),
      cookies: document.cookie,
    }));

    // This console reaches every clinic on the platform, so a stolen token here is worth
    // more than one from a single dashboard.
    expect(stored.local).toEqual([]);
    expect(stored.session).toEqual([]);
    expect(stored.cookies).not.toContain(REFRESH_COOKIE);
  });

  test('signs out and does not come back on reload', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    expect(await refreshCookie(page)).toBeUndefined();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
