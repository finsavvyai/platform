import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 * Tests for visual consistency across pages
 *
 * To update screenshots: npx playwright test --visual-regression --update-snapshots
 */

test.describe.configure({ mode: 'serial' }); // Run serially to avoid conflicts

test.describe('Visual Regression - Landing Page', () => {
  test('should match landing page screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for hero animation to complete
    await page.waitForTimeout(1000);

    // Full page screenshot
    await expect(page).toHaveScreenshot('landing-page-full.png', {
      fullPage: true,
      animations: 'allowed',
    });
  });

  test('should match hero section screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const heroSection = page.locator('section').first();
    await heroSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await expect(heroSection).toHaveScreenshot('hero-section.png', {
      animations: 'allowed',
    });
  });

  test('should match header screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.locator('header');
    await expect(header).toHaveScreenshot('header.png', {
      animations: 'allowed',
    });
  });

  test('should match features section screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const featuresSection = page.locator('[id="features"], section:has-text("Features")');
    await featuresSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await expect(featuresSection).toHaveScreenshot('features-section.png', {
      animations: 'allowed',
    });
  });

  test('should match pricing section screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const pricingSection = page.locator('[id="pricing"], section:has-text("Pricing")');
    await pricingSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await expect(pricingSection).toHaveScreenshot('pricing-section.png', {
      animations: 'allowed',
    });
  });

  test('should match footer screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await expect(footer).toHaveScreenshot('footer.png', {
      animations: 'allowed',
    });
  });
});

test.describe('Visual Regression - Sign Up Page', () => {
  test('should match sign-up page screenshot', async ({ page }) => {
    await page.goto('/sign-up');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('sign-up-page.png', {
      fullPage: true,
      animations: 'allowed',
    });
  });

  test('should match sign-up form screenshot', async ({ page }) => {
    await page.goto('/sign-up');
    await page.waitForLoadState('networkidle');

    const form = page.locator('form, [class*="SignUp"], [class*="sign-up"]');
    await expect(form).toHaveScreenshot('sign-up-form.png', {
      animations: 'allowed',
    });
  });
});

test.describe('Visual Regression - Sign In Page', () => {
  test('should match sign-in page screenshot', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('sign-in-page.png', {
      fullPage: true,
      animations: 'allowed',
    });
  });

  test('should match sign-in form screenshot', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    const form = page.locator('form, [class*="SignIn"], [class*="sign-in"]');
    await expect(form).toHaveScreenshot('sign-in-form.png', {
      animations: 'allowed',
    });
  });
});

test.describe('Visual Regression - Dashboard Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should match dashboard screenshot when authenticated', async ({ page }) => {
    // Sign in first
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Navigate to dashboard if auth successful
    if (!page.url().includes('/sign-in')) {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('dashboard-page.png', {
        fullPage: true,
        animations: 'allowed',
      });
    }
  });
});

test.describe('Visual Regression - Getting Started Page', () => {
  test('should match getting started page screenshot', async ({ page }) => {
    await page.goto('/getting-started');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('getting-started-page.png', {
      fullPage: true,
      animations: 'allowed',
    });
  });

  test('should match code example screenshots', async ({ page }) => {
    await page.goto('/getting-started');
    await page.waitForLoadState('networkidle');

    const codeBlocks = page.locator('pre, [class*="code"]').all();

    for (let i = 0; i < Math.min(await codeBlocks.length, 3); i++) {
      const block = await codeBlocks[i];
      await block.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      await expect(block).toHaveScreenshot(`code-example-${i}.png`, {
        animations: 'allowed',
      });
    }
  });
});
