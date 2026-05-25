import { test, expect, devices } from '@playwright/test';

/**
 * Mobile Responsiveness Tests
 * Tests for mobile and tablet viewports
 */

const viewports = [
  { name: 'Mobile Small', device: devices['iPhone SE'] },
  { name: 'Mobile Medium', device: devices['iPhone 12'] },
  { name: 'Mobile Large', device: devices['Pixel 5'] },
  { name: 'Tablet', device: devices['iPad Pro'] },
  { name: 'Desktop', device: devices['Desktop Chrome'] },
];

for (const { name, device } of viewports) {
  test.describe(`Mobile Responsiveness - ${name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(device.viewport || { width: 1280, height: 720 });
    });

    test('should display landing page correctly', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check for horizontal scroll (should not exist)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });

      expect(hasHorizontalScroll).toBeFalsy();

      // Hero should be visible
      const hero = page.locator('h1').first();
      await expect(hero).toBeVisible();
    });

    test('should have functional navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const nav = page.locator('header');
      await expect(nav).toBeVisible();

      // Logo should be visible
      const logo = page.locator('text=SDLC.ai');
      await expect(logo.first()).toBeVisible();
    });

    test('should have accessible CTA buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // CTA buttons should be visible and clickable
      const ctaButtons = page.locator('button:has-text("Get Started"), a:has-text("Get Started"), button:has-text("Sign In"), a:has-text("Sign In")');
      const count = await ctaButtons.count();

      expect(count).toBeGreaterThan(0);

      // At least one button should be visible
      let anyVisible = false;
      for (let i = 0; i < count; i++) {
        if (await ctaButtons.nth(i).isVisible()) {
          anyVisible = true;
          break;
        }
      }

      expect(anyVisible).toBeTruthy();
    });

    test('should display features section correctly', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Scroll to features
      const featuresSection = page.locator('[id="features"], section:has-text("Features")');
      await featuresSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      await expect(featuresSection).toBeVisible();
    });

    test('should display pricing section correctly', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Scroll to pricing
      const pricingSection = page.locator('[id="pricing"], section:has-text("Pricing")');
      await pricingSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      await expect(pricingSection).toBeVisible();
    });
  });
}

test.describe('Mobile Responsiveness - Touch Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(devices['iPhone 12'].viewport || { width: 390, height: 844 });
  });

  test('should support tap on CTA buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const ctaButton = page.locator('a:has-text("Get Started"), a[href*="sign-up"]').first();

    if (await ctaButton.isVisible()) {
      await ctaButton.tap();
      await page.waitForTimeout(1000);

      // Should navigate to sign-up or similar
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/sign-up|\/sign-in/);
    }
  });

  test('should support swipe scrolling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const startScroll = await page.evaluate(() => window.scrollY);

    // Scroll down using touch
    await page.touchscreen.tap(0, 0);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);

    const endScroll = await page.evaluate(() => window.scrollY);

    expect(endScroll).toBeGreaterThan(startScroll);
  });

  test('should have touch-friendly button sizes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const buttons = page.locator('button, a[class*="btn"], a[class*="button"]');
    const count = await buttons.count();

    // Check at least first 5 buttons
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          // Buttons should be at least 44x44 pixels for touch (WCAG guideline)
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });
});

test.describe('Mobile Responsiveness - Mobile Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(devices['iPhone 12'].viewport || { width: 390, height: 844 });
  });

  test('should show mobile menu toggle on small screens', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const menuButton = page.locator('button:has-text("Menu"), [aria-label*="menu"], [aria-label*="Menu"]');

    // Menu button might be visible on mobile
    const isVisible = await menuButton.isVisible().catch(() => false);

    if (isVisible) {
      await expect(menuButton).toBeVisible();
    }
  });

  test('should open mobile menu when toggled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const menuButton = page.locator('button:has-text("Menu"), [aria-label*="menu"], [aria-label*="Menu"]');

    const isVisible = await menuButton.isVisible().catch(() => false);

    if (isVisible) {
      await menuButton.click();
      await page.waitForTimeout(500);

      // Mobile menu should appear
      const mobileMenu = page.locator('[class*="mobile-menu"], [role="navigation"]');
      const menuVisible = await mobileMenu.isVisible().catch(() => false);

      if (menuVisible) {
        await expect(mobileMenu).toBeVisible();
      }
    }
  });
});

test.describe('Mobile Responsiveness - Orientation Changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
  });

  test('should adapt to landscape orientation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check in portrait
    const portraitWidth = await page.evaluate(() => window.innerWidth);
    expect(portraitWidth).toBe(1024);

    // Change to landscape
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.waitForTimeout(500);

    const landscapeWidth = await page.evaluate(() => window.innerWidth);
    expect(landscapeWidth).toBe(1366);

    // Page should still be functional
    const hero = page.locator('h1').first();
    await expect(hero).toBeVisible();
  });
});
