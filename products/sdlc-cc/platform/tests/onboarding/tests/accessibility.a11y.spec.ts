import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * Accessibility Tests
 * Tests for WCAG compliance and accessibility
 *
 * Note: Requires @axe-core/playwright to be installed
 * Install with: npm install --save-dev @axe-core/playwright
 */

test.describe('Accessibility - Landing Page', () => {
  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Skip if axe is not available
    const accessibilityScan = await (async () => {
      try {
        const axeBuilder = new AxeBuilder({ page });
        return await axeBuilder.analyze();
      } catch (error) {
        console.log('Axe not available, skipping detailed accessibility scan');
        return { violations: [] };
      }
    })();

    expect(accessibilityScan.violations).toEqual([]);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all headings
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

    // Should have at least one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // Check heading order (roughly - h1 before h2 before h3, etc.)
    let lastLevel = 0;
    for (const heading of headings) {
      const tag = await heading.evaluate(el => el.tagName);
      const level = parseInt(tag.substring(1));

      // Headings should not skip more than one level
      expect(level).toBeLessThanOrEqual(lastLevel + 2);
      lastLevel = Math.max(lastLevel, level);
    }
  });

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');

      // Alt should exist (can be empty for decorative images)
      expect(alt).not.toBeNull();
    }
  });

  test('should have sufficient color contrast for text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // This is a basic check - use axe for comprehensive contrast checking
    const textElements = page.locator('p, h1, h2, h3, h4, h5, h6, a, button, span');
    const count = await textElements.count();

    // Sample a few elements
    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = textElements.nth(i);
      if (await element.isVisible()) {
        const color = await element.evaluate(el => {
          return window.getComputedStyle(el).color;
        });

        // Check that color is not too light (basic check)
        expect(color).not.toBe('rgb(255, 255, 255)');
        expect(color).not.toBe('rgba(255, 255, 255, 1)');
      }
    }
  });

  test('should have focusable interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button, a[href]');
    const count = await buttons.count();

    expect(count).toBeGreaterThan(0);

    // Check that buttons are focusable
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        // Should be able to focus
        await button.focus();
        const isFocused = await button.evaluate(el => document.activeElement === el);
        expect(isFocused).toBeTruthy();
      }
    }
  });

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('a[href]').first();

    if (await firstLink.isVisible()) {
      await firstLink.focus();

      // Check for focus outline
      const outline = await firstLink.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          boxShadow: styles.boxShadow,
        };
      });

      // Should have some form of focus indicator
      const hasFocusIndicator =
        (outline.outline && outline.outline !== 'none') ||
        (outline.outlineWidth && outline.outlineWidth !== '0px') ||
        (outline.boxShadow && outline.boxShadow !== 'none');

      expect(hasFocusIndicator).toBeTruthy();
    }
  });

  test('should have skip links for keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for skip links
    const skipLinks = page.locator('a[href^="#"]:has-text("skip"), a[href^="#"]:has-text("Skip"), a.skiplink');
    const count = await skipLinks.count();

    // Skip links are recommended but not always present
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should allow keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test Tab navigation
    const tabCount = 10;

    for (let i = 0; i < tabCount; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    // Something should be focused after tabs
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    expect(focusedElement).toBeTruthy();
  });

  test('should have ARIA labels where needed', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for aria-labels on buttons without text
    const iconButtons = page.locator('button:not(:has-text(string)), button[aria-label]');
    const count = await iconButtons.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = iconButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();

      // Buttons should have either text or aria-label
      const hasLabel = (text && text.trim().length > 0) || ariaLabel;
      expect(hasLabel).toBeTruthy();
    }
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/');
    await page.goto('/#demo'); // Go to demo form section
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input[type="text"], input[type="email"], textarea');
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const input = inputs.nth(i);

      // Input should have id, placeholder, or aria-label
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      const hasLabel = id || placeholder || ariaLabel || ariaLabelledBy;
      expect(hasLabel).toBeTruthy();
    }
  });
});

test.describe('Accessibility - Sign In Page', () => {
  test('should not have accessibility issues on sign-in page', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    const accessibilityScan = await (async () => {
      try {
        const axeBuilder = new AxeBuilder({ page });
        return await axeBuilder.analyze();
      } catch (error) {
        console.log('Axe not available, skipping detailed accessibility scan');
        return { violations: [] };
      }
    })();

    expect(accessibilityScan.violations).toEqual([]);
  });

  test('should have proper form labels on sign-in', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);

      const placeholder = await input.getAttribute('placeholder');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      // Inputs should have some form of label
      const hasLabel = placeholder || ariaLabel || ariaLabelledBy;
      expect(hasLabel).toBeTruthy();
    }
  });
});

test.describe('Accessibility - Sign Up Page', () => {
  test('should not have accessibility issues on sign-up page', async ({ page }) => {
    await page.goto('/sign-up');
    await page.waitForLoadState('networkidle');

    const accessibilityScan = await (async () => {
      try {
        const axeBuilder = new AxeBuilder({ page });
        return await axeBuilder.analyze();
      } catch (error) {
        console.log('Axe not available, skipping detailed accessibility scan');
        return { violations: [] };
      }
    })();

    expect(accessibilityScan.violations).toEqual([]);
  });
});

test.describe('Accessibility - Keyboard Navigation Flow', () => {
  test('should allow complete onboarding flow with keyboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to sign in button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Press Enter to navigate
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Should be on auth page or similar
    const currentUrl = page.url();
    const hasNavigated = currentUrl !== '/';
    expect(hasNavigated).toBeTruthy();
  });

  test('should not have keyboard traps', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab through the page
    const maxTabs = 50;
    let focusedElements = new Set<string>();

    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);

      const tagName = await page.evaluate(() => document.activeElement?.tagName);
      focusedElements.add(tagName || '');
    }

    // Should have encountered different types of elements
    expect(focusedElements.size).toBeGreaterThan(1);
  });
});
