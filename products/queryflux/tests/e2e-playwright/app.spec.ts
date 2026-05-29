import { test, expect } from '@playwright/test';

async function authenticate(page: import('@playwright/test').Page) {
    await page.goto('http://localhost:5198');
    await page.evaluate(() => {
        localStorage.setItem('auth_token', 'e2e-test-token');
        localStorage.setItem('refresh_token', 'e2e-test-refresh');
    });
    await page.goto('http://localhost:5198');
    await page.waitForLoadState('domcontentloaded');
}

test.describe('QueryFlux Client Application', () => {
    test.beforeEach(async ({ page }) => {
        await authenticate(page);
    });

    test('should load the application', async ({ page }) => {
        const title = await page.title();
        expect(title).toContain('QueryFlux');
    });

    test('should display the dashboard', async ({ page }) => {
        await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });
    });

    test('should navigate to connections page', async ({ page }) => {
        await page.click('text=Connections');
        await page.waitForURL(/connections/, { timeout: 5000 });
        expect(page.url()).toContain('/connections');
    });

    test('should navigate to query editor page', async ({ page }) => {
        await page.click('text=Query Editor');
        await page.waitForURL(/query/, { timeout: 5000 });
        expect(page.url()).toContain('/query');
    });

    test('should navigate to settings page', async ({ page }) => {
        await page.click('text=Settings');
        await page.waitForURL(/settings/, { timeout: 5000 });
        expect(page.url()).toContain('/settings');
    });

    test('should have sidebar navigation', async ({ page }) => {
        await expect(page.locator('nav a')).toHaveCount(4);
    });
});
