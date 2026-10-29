import { expect, test, type Locator } from '@playwright/test';

/**
 * That a control's label is actually legible on its own background.
 *
 * WHY THIS EXISTS. The primary button rendered navy text on a blue fill, and the disabled
 * "Forgot password?" control rendered in the body colour so it looked active. Nothing in
 * the markup was wrong: `tokens.css` set its element defaults outside a CSS layer, and
 * unlayered rules beat every layered one whatever the specificity, so a zero-specificity
 * `:where(button) { color: inherit }` silently won against `.text-inverse`.
 *
 * NO OTHER SUITE COULD SEE IT. The component tests assert roles and text, which were
 * correct. jsdom does not compute cascaded colour. Only a real browser resolves the layer
 * order, so the guard belongs here.
 *
 * It asserts a contrast RATIO rather than an exact colour, so a palette change does not
 * fail it and a regression in the cascade does. 4.5:1 is the WCAG AA threshold for body
 * text, which this product is held to.
 */

const AA_NORMAL_TEXT = 4.5;

/** Relative luminance, per WCAG 2.1. */
const luminance = (rgb: readonly number[]): number => {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const parse = (colour: string): readonly number[] => {
  const parts = colour.match(/\d+(\.\d+)?/g);

  if (parts === null || parts.length < 3) {
    throw new Error(`could not read a colour from "${colour}"`);
  }

  return parts.slice(0, 3).map(Number);
};

const contrast = (foreground: string, background: string): number => {
  const a = luminance(parse(foreground));
  const b = luminance(parse(background));
  const [light, dark] = a > b ? [a, b] : [b, a];

  return (light + 0.05) / (dark + 0.05);
};

/** The element's own background, or the nearest ancestor that paints one. */
const paintedBackground = async (element: Locator): Promise<string> =>
  element.evaluate((node) => {
    let current: Element | null = node;

    while (current !== null) {
      const value = window.getComputedStyle(current).backgroundColor;
      const alpha = value.match(/[\d.]+\)$/);

      if (value !== 'transparent' && (alpha === null || Number.parseFloat(alpha[0]) > 0)) {
        return value;
      }
      current = current.parentElement;
    }

    return 'rgb(255, 255, 255)';
  });

test.describe('the sign-in screen is legible', () => {
  test('the primary button label meets AA against its own fill', async ({ page }) => {
    await page.goto('/sign-in');

    const button = page.getByRole('button', { name: 'Sign in' });
    await expect(button).toBeVisible();

    const colour = await button.evaluate((node) => window.getComputedStyle(node).color);
    const background = await paintedBackground(button);
    const ratio = contrast(colour, background);

    // The exact failure that prompted this test: navy on blue is about 3.4:1.
    expect(
      ratio,
      `"${colour}" on "${background}" is only ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  test('the disabled forgot-password control does not look like an active one', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    const forgot = page.getByRole('button', { name: 'Forgot password?' });
    await expect(forgot).toBeDisabled();

    const [forgotColour, headingColour] = await Promise.all([
      forgot.evaluate((node) => window.getComputedStyle(node).color),
      page
        .getByRole('heading', { level: 1 })
        .evaluate((node) => window.getComputedStyle(node).color),
    ]);

    /**
     * It must not render in the body colour. A disabled control that looks exactly like
     * live text is the state this screen was in, and it invites the click that does
     * nothing, which is how a user concludes the product is broken rather than that the
     * feature is not built.
     */
    expect(forgotColour).not.toBe(headingColour);
  });

  test('the brand panel is present on a wide window and gone on a narrow one', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const wide = await page.getByText('One calm place for every clinic day.').isVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await page.getByText('One calm place for every clinic day.').isVisible();

    /**
     * The prototype is desktop-only: it sets a 1180px minimum on `body`. Stacking the brand
     * panel above the form on a phone would push the form below the fold, which is the one
     * thing a sign-in screen must not do, so the panel is hidden instead and the wordmark
     * moves inline.
     */
    expect(wide).toBe(true);
    expect(narrow).toBe(false);
    // The form itself survives the narrow window.
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
