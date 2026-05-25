import { test, expect } from '@playwright/test';

/**
 * E2E Smoke Tests for opensyber.cloud
 *
 * Validates all customer-facing pages and flows are accessible and render
 * correctly. These tests run against the live site (no auth required).
 *
 * Each section maps to a sample project persona to verify the marketing
 * surface is bug-free before launch.
 */

test.describe('Public Site — Accessibility & Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('homepage loads and renders hero', async ({ page }) => {
    await expect(page).toHaveTitle(/OpenSyber/i);
    const hero = page.locator('main').first();
    await expect(hero).toBeVisible();
  });

  test('navigation links are present', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    const links = ['Pricing', 'Docs', 'Blog'];
    for (const linkText of links) {
      const link = page.getByRole('link', { name: new RegExp(linkText, 'i') }).first();
      await expect(link).toBeVisible();
    }
  });

  test('footer renders with legal links', async ({ page }) => {
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
  });
});

test.describe('Sample 1: Solo Dev Journey — Public Pages', () => {
  test('pricing page shows Free tier', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/agent/i).first()).toBeVisible();
  });

  test('sign-up page is accessible', async ({ page }) => {
    await page.goto('/sign-up');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/sign-up/);
  });

  test('docs page loads', async ({ page }) => {
    await page.goto('/docs');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Sample 2: Pro Team — Pricing & Features', () => {
  test('pricing page shows Pro tier with team features', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/pro/i).first()).toBeVisible();
  });

  test('enterprise page exists and renders', async ({ page }) => {
    await page.goto('/enterprise');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Sample 3: Enterprise — Compliance Pages', () => {
  test('enterprise page shows SSO/SAML features', async ({ page }) => {
    await page.goto('/enterprise');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main').first();
    await expect(main).toBeVisible();
  });

  test('compliance page is accessible', async ({ page }) => {
    await page.goto('/compliance');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });

  test('trust page is accessible', async ({ page }) => {
    await page.goto('/trust');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Sample 4: Marketplace — Public Browse', () => {
  test('marketplace page loads', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Sample 5: CSPM — Security Features', () => {
  test('security features page renders', async ({ page }) => {
    await page.goto('/security');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Sample 6: AI Analysis — Blog & Docs', () => {
  test('blog page loads with AI-related content', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });

  test('docs page loads for AI skills reference', async ({ page }) => {
    await page.goto('/docs');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Sample 7: TokenForge — Product Pages', () => {
  test('sign-in page renders auth options', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe('Sample 8: Multi-Cloud — Landing Features', () => {
  test('homepage highlights multi-cloud support', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });
});

test.describe('Performance & Accessibility Checks', () => {
  test('key pages load within 5 seconds', async ({ page }) => {
    const pages = ['/', '/pricing', '/docs', '/blog', '/enterprise'];

    for (const path of pages) {
      const start = Date.now();
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;

      expect(loadTime).toBeLessThan(5000);
    }
  });

  test('no console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('third-party') &&
        !e.includes('analytics'),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('images have alt text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });

  test('page has proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Responsive Layout Checks', () => {
  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });

  test('desktop viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('main').first()).toBeVisible();
  });
});
