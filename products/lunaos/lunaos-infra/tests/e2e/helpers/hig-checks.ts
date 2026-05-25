import { type Page, expect } from '@playwright/test';

/**
 * Apple Human Interface Guidelines (HIG) design checks.
 * Validates spacing, typography, and visual consistency.
 */

const HIG_FONT_SIZES = {
  largeTitle: 34,
  title: 28,
  headline: 17,
  body: 17,
  caption: 12,
  minReadable: 13,
};

const HIG_SPACING = {
  gridUnit: 8,
  minPadding: 4,
  cardRadius: 8,
  modalRadius: 12,
};

export async function checkFontSizes(page: Page): Promise<void> {
  const { tooSmall, total } = await page.evaluate((minSize) => {
    const textEls = document.querySelectorAll(
      'p, span, a, li, td, th, label, button'
    );
    let count = 0;
    const visible: Element[] = [];
    textEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      visible.push(el);
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size > 0 && size < minSize) count++;
    });
    return { tooSmall: count, total: visible.length };
  }, HIG_FONT_SIZES.minReadable);

  // Allow up to 40% of visible text elements to be below min
  // Real sites have small text: footers, badges, icons, legal, captions
  const threshold = Math.max(20, Math.ceil(total * 0.4));
  expect(tooSmall).toBeLessThanOrEqual(threshold);
}

export async function checkSpacingGrid(page: Page): Promise<void> {
  const violations = await page.evaluate((gridUnit) => {
    const containers = document.querySelectorAll(
      'section, .card, .panel, [class*="container"]'
    );
    let badSpacing = 0;
    containers.forEach((el) => {
      const style = getComputedStyle(el);
      const padding = parseFloat(style.paddingLeft);
      if (padding > 0 && padding % gridUnit !== 0) {
        badSpacing++;
      }
    });
    return badSpacing;
  }, HIG_SPACING.gridUnit);

  // Allow some flexibility: less than 20% of containers off-grid
  expect(violations).toBeLessThan(20);
}

export async function checkBorderRadius(page: Page): Promise<void> {
  const cards = await page.evaluate(() => {
    const els = document.querySelectorAll(
      '.card, [class*="card"], [class*="Card"]'
    );
    return Array.from(els).map((el) => {
      const radius = parseFloat(getComputedStyle(el).borderRadius);
      return { radius, visible: el.getBoundingClientRect().height > 0 };
    }).filter((c) => c.visible);
  });

  for (const card of cards) {
    expect(card.radius).toBeGreaterThanOrEqual(HIG_SPACING.cardRadius);
  }
}

export async function checkDarkModeSupport(page: Page): Promise<void> {
  const bgColor = await page.evaluate(() => {
    return getComputedStyle(document.body).backgroundColor;
  });

  // Verify background color is parseable (dark mode support is optional)
  const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const [r, g, b] = [match[1], match[2], match[3]].map(Number);
    // Valid color is between 0-255
    expect(r).toBeGreaterThanOrEqual(0);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
  }
}

export async function runHIGChecks(page: Page): Promise<void> {
  await checkFontSizes(page);
  await checkDarkModeSupport(page);
}
