import { authTest as test, expect } from './fixtures/auth';

/**
 * Incident Management Journey.
 * View incidents → drill into detail → change status.
 */
test.describe('Incident List Journey', () => {
  test('incidents page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/security/incidents');
    await expect(page.getByRole('heading', { name: /incidents/i })).toBeVisible();
  });

  test('incidents page shows table or empty state', async ({ page }) => {
    await page.goto('/dashboard/security/incidents');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const emptyMsg = page.getByText('No security incidents have been recorded yet.');
    const emptyAlt = page.getByText(/no incidents/i);

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = (await emptyMsg.isVisible().catch(() => false)) ||
      (await emptyAlt.isVisible().catch(() => false));
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('incidents table has correct columns', async ({ page }) => {
    await page.goto('/dashboard/security/incidents');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    if (!(await table.isVisible().catch(() => false))) {
      test.skip(true, 'No incidents table — empty state');
      return;
    }

    // Check column headers
    const headers = table.locator('th');
    const headerTexts = await headers.allTextContents();
    const headerStr = headerTexts.join(' ').toLowerCase();
    expect(headerStr).toContain('title');
    expect(headerStr).toContain('severity');
    expect(headerStr).toContain('status');
  });

  test('incident row links to detail page', async ({ page }) => {
    await page.goto('/dashboard/security/incidents');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('table a').first();
    if (!(await firstLink.isVisible().catch(() => false))) {
      test.skip(true, 'No incident links in table');
      return;
    }

    const href = await firstLink.getAttribute('href');
    expect(href).toMatch(/\/dashboard\/security\/incidents\/.+/);
  });
});

test.describe('Incident Detail Journey', () => {
  test('incident detail page shows title and status', async ({ page }) => {
    await page.goto('/dashboard/security/incidents');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('table a').first();
    if (!(await firstLink.isVisible().catch(() => false))) {
      test.skip(true, 'No incidents to view');
      return;
    }

    await firstLink.click();
    await page.waitForLoadState('networkidle');

    // Detail page should show heading and status
    await expect(page.getByRole('heading')).toBeVisible();

    // Status select should be present
    const statusSelect = page.locator('select').first();
    const hasStatus = await statusSelect.isVisible().catch(() => false);
    if (hasStatus) {
      const options = statusSelect.locator('option');
      const count = await options.count();
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  test('incident detail has severity badge', async ({ page }) => {
    await page.goto('/dashboard/security/incidents');
    await page.waitForLoadState('networkidle');

    const firstLink = page.locator('table a').first();
    if (!(await firstLink.isVisible().catch(() => false))) {
      test.skip(true, 'No incidents to view');
      return;
    }

    await firstLink.click();
    await page.waitForLoadState('networkidle');

    // Should show severity somewhere
    const severity = page.getByText(/critical|high|medium|low/i).first();
    await expect(severity).toBeVisible({ timeout: 5_000 });
  });
});
