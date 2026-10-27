/**
 * Responsive sweep: the mechanical all-device battery for every screen in the
 * milestone, at widths 375 / 768 / 1024 / 1440 / 1920, plus a mobile
 * interaction lane at 375 with touch emulation.
 *
 * Copied into `tests/e2e/responsive-sweep.spec.ts` by the `e2e-testing`
 * skill and customized per project (the SCREENS list and the control hooks).
 * Runs under the scaffolded `playwright.config.ts`. After the run,
 * `responsive-report.mjs` merges the artifacts this spec writes into
 * `AI_DOCS/quality/mavs/geometry.<width>.json` (data) and
 * `AI_DOCS/quality/mavs/responsive.json` (verdict, parsed by mavs-gate.sh).
 *
 * What fails the run (functional severity): page horizontal overflow, an
 * element exceeding the viewport, a covered or zero-size control, a table
 * that scrolls the page, an overflowing image, a sub-44px touch target at
 * mobile widths. Aesthetic-grade findings (distortion, clipped text,
 * under-bar content) are recorded but do not fail here: they feed
 * `ui-review` and `principal-designer`.
 *
 * Every screenshot this spec captures is ALSO written into the visual dir
 * (`AI_DOCS/quality/visual/milestone-close/`), alongside the existing
 * artifact-dir copy. This is the full 5-width sweep half of the visual-QA
 * lane (PLAN-testing-matrix Part 2.2/2.3): `milestone-validation` reads this
 * directory, together with every per-task `AI_DOCS/quality/visual/<task-id>/`
 * bucket the `/build` Exercise gate wrote during the milestone, to judge the
 * full sweep against `AI_DOCS/design/design-standards-checklist.md` and
 * consolidate `AI_DOCS/quality/mavs/visual.json` at milestone close.
 */
import { test, expect, devices, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { collectResponsiveAudit, type ViewportAudit, type ResponsiveViolation } from './geometry-dump';

/** Width x height pairs for the sweep (heights are representative devices). */
const VIEWPORTS: ReadonlyArray<{ width: number; height: number }> = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

/**
 * Screens under sweep. Fill from AI_DOCS/quality/e2e-suite.md and the app's
 * route map: every screen the milestone delivered gets one row. Screens
 * behind auth rely on the reused storage state below (e2e-testing Pattern 3).
 */
const SCREENS: ReadonlyArray<{ name: string; route: string }> = [
  { name: 'dashboard', route: '/' },
  // TODO(per-project): one entry per delivered screen, e.g.
  // { name: 'orders-list', route: '/orders' },
  // { name: 'order-detail', route: '/orders/1' },
];

const ARTIFACT_DIR = path.join('AI_DOCS', 'quality', 'test-artifacts', 'responsive');

/** Tracked screenshot bucket for the visual-QA lane (see file header). */
const VISUAL_DIR = path.join('AI_DOCS', 'quality', 'visual', 'milestone-close');

/** Severities that fail the sweep (functional: a user cannot see or operate something). */
const FAILING: ReadonlyArray<ResponsiveViolation['severity']> = ['crit', 'high'];

/** Reused auth state per e2e-testing Pattern 3. Adjust the role file as needed. */
test.use({ storageState: 'tests/e2e/.auth/admin.json' });

/**
 * Runs the in-page audit on the current page state and persists the artifact
 * for `responsive-report.mjs`. Returns the failing-severity violations.
 */
async function auditAndPersist(page: Page, screen: string, width: number, phase: string): Promise<ResponsiveViolation[]> {
  const audit: ViewportAudit = await page.evaluate(collectResponsiveAudit);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const file = path.join(ARTIFACT_DIR, `${screen}.${width}.${phase}.json`);
  fs.writeFileSync(file, JSON.stringify({ screen, phase, ...audit }, null, 2));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, `${screen}.${width}.${phase}.png`), fullPage: true });
  fs.mkdirSync(VISUAL_DIR, { recursive: true });
  await page.screenshot({ path: path.join(VISUAL_DIR, `${screen}.${width}.${phase}.png`), fullPage: true });
  return audit.violations.filter((v) => FAILING.includes(v.severity));
}

/**
 * Drives the common shell + data-display controls so the audit sees them OPEN,
 * not just closed. Each block skips gracefully when the control is absent, so
 * one template serves every screen. Extend with per-project selectors.
 */
async function exerciseCommonControls(page: Page, screen: string, width: number): Promise<ResponsiveViolation[]> {
  const found: ResponsiveViolation[] = [];
  const tryOpen = async (locator: ReturnType<Page['locator']>, phase: string): Promise<void> => {
    if ((await locator.count()) === 0) return;
    const el = locator.first();
    if (!(await el.isVisible())) return;
    await el.click();
    await page.waitForTimeout(300);
    found.push(...(await auditAndPersist(page, screen, width, phase)));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  };

  // Sidebar / nav drawer (mobile hamburger or desktop collapse).
  await tryOpen(page.locator('[data-testid="nav-toggle"], [aria-label*="menu" i], button[aria-controls*="nav" i]'), 'nav-open');
  // Top-bar profile / notifications menus.
  await tryOpen(page.locator('[data-testid="profile-menu"], [aria-label*="account" i], [aria-label*="notification" i]'), 'topbar-menu');
  // Table sort: click the first sortable header.
  await tryOpen(page.locator('th[aria-sort], th:has(button)'), 'sorted');
  // Filters: open the filter control.
  await tryOpen(page.locator('[data-testid="filters"], button:has-text("Filter")'), 'filters-open');
  // Pagination: go to the next page.
  await tryOpen(page.locator('[aria-label*="next page" i], [data-testid="pagination-next"]'), 'paginated');
  // Row action menu: first row overflow/kebab menu.
  await tryOpen(page.locator('[data-testid="row-actions"], td button[aria-haspopup]'), 'row-actions');

  return found;
}

for (const screen of SCREENS) {
  for (const vp of VIEWPORTS) {
    test(`responsive: ${screen.name} at ${vp.width}px has no functional layout defect`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto(screen.route);
      await page.waitForLoadState('networkidle');
      const failing = await auditAndPersist(page, screen.name, vp.width, 'base');
      expect(failing, failing.map((v) => `${v.id} ${v.check} ${v.selector}: ${v.detail}`).join('\n')).toEqual([]);
    });
  }
}

/**
 * Mobile interaction lane: the shell and data-display controls are OPERATED at
 * 375 with real touch emulation, and every opened surface (drawer, menu,
 * filter panel, sorted table, next page) re-passes the mechanical audit.
 * A control that only works with a mouse, or opens a clipped surface, fails here.
 */
test.describe('mobile interaction lane (375, touch)', () => {
  // Device descriptor for touch/mobile emulation, viewport pinned to the
  // 375 sweep width so the lane matches the sweep's mobile band exactly.
  test.use({ ...devices['iPhone 12'], viewport: { width: 375, height: 812 } });

  for (const screen of SCREENS) {
    test(`mobile lane: ${screen.name} controls operate and render within viewport`, async ({ page }) => {
      await page.goto(screen.route);
      await page.waitForLoadState('networkidle');
      const failing = [
        ...(await auditAndPersist(page, screen.name, 375, 'mobile-base')),
        ...(await exerciseCommonControls(page, screen.name, 375)),
      ];
      expect(failing, failing.map((v) => `${v.id} ${v.check} ${v.selector}: ${v.detail}`).join('\n')).toEqual([]);
    });
  }
});
