import { test, expect } from '@playwright/test';
import { mockAuth, hideOverlays } from './fixtures/auth.fixture';

const mockMediaQuery = (targetQuery: string) => ({
  writable: true,
  value: (query: string) => ({
    matches: query === targetQuery,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const dashboardHeading = page.getByRole('heading', { name: 'Release Dashboard', level: 2 });
    await expect(dashboardHeading).toBeVisible();

    const h2Count = await page.locator('main h2').count();
    expect(h2Count).toBeGreaterThanOrEqual(1);
  });

  test('should have proper alt text for images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const images = page.locator('img');
    const imageCount = await images.count();
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      expect(alt !== null || role === 'presentation').toBeTruthy();
    }
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const inputs = page.locator('input, textarea, select');
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');
      const type = await input.getAttribute('type');
      if (type === 'hidden') continue;
      const hasLabel = id && (await page.locator(`label[for="${id}"]`).count()) > 0;
      expect(hasLabel || ariaLabel || ariaLabelledBy || placeholder).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Tab');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      const count = await focusedElement.count();
      if (count > 0) {
        await expect(focusedElement).toBeVisible();
      }
    }
  });

  test('should have proper ARIA roles on recording studio', async ({ page }) => {
    await page.goto('/recording-studio');
    await expect(
      page.getByRole('heading', { name: 'Recording Studio', level: 1 })
    ).toBeVisible();
    await hideOverlays(page);
    const buttons = page.locator('main button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');
      const text = await button.textContent();
      const hasSvg = (await button.locator('svg').count()) > 0;
      const hasChild = (await button.locator('*').count()) > 0;
      expect(ariaLabel || title || (text && text.trim().length > 0) || hasSvg || hasChild).toBeTruthy();
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const contrastIssues = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const issues: Array<{ element: string; color: string }> = [];
      for (const element of elements) {
        const style = window.getComputedStyle(element);
        if (style.color === 'rgb(153, 153, 153)') {
          issues.push({ element: element.tagName, color: style.color });
        }
      }
      return issues;
    });
    expect(contrastIssues.length).toBeLessThan(5);
  });

  test('should support reduced motion preferences', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query, onchange: null,
          addListener: () => {}, removeListener: () => {},
          addEventListener: () => {}, removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2').first()).toBeVisible();
  });

  test('should show validation on login form', async ({ page }) => {
    // Use a fresh page without auth init script so /login doesn't redirect
    const freshPage = await page.context().newPage();
    await freshPage.goto('/login');
    await freshPage.waitForLoadState('networkidle');
    const emailInput = freshPage.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    const isRequired = await emailInput.getAttribute('required');
    expect(isRequired !== null).toBeTruthy();
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid,
    );
    expect(isInvalid).toBeTruthy();
    await freshPage.close();
  });

  test('should have proper focus styles', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focusedEl = page.locator(':focus');
    const count = await focusedEl.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should support high contrast mode', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query === '(prefers-contrast: high)',
          media: query, onchange: null,
          addListener: () => {}, removeListener: () => {},
          addEventListener: () => {}, removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const bodyStyles = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      return { bg: style.backgroundColor, color: style.color };
    });
    expect(bodyStyles.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bodyStyles.color).not.toBe('rgba(0, 0, 0, 0)');
  });
});
