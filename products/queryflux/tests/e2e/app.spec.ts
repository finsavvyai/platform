import { test, expect } from '@playwright/test';

test.describe('QueryFlux Client Application', () => {
    // Common setup
    test.beforeEach(async ({ page }) => {
        // Navigate to home, which should redirect to dashboard
        await page.goto('http://localhost:5198/', { waitUntil: 'networkidle' });
    });

    test('should load the dashboard by default', async ({ page }) => {
        // Check redirection
        expect(page.url()).toContain('/dashboard');

        // Check heading (scoped to main content to avoid sidebar logo)
        await expect(page.locator('main h1')).toContainText('Welcome to QueryFlux');

        // Check stats
        await expect(page.getByText('Total Connections')).toBeVisible();
        await expect(page.getByText('Saved Queries')).toBeVisible();

        // Screenshot
        await page.screenshot({ path: 'test-results/01-dashboard.png' });
    });

    test('should accept sidebar navigation', async ({ page }) => {
        // Navigate to Connections
        await page.click('text=Connections');
        await expect(page.locator('main h1')).toContainText('Database Connections');
        expect(page.url()).toContain('/connections');
        await page.screenshot({ path: 'test-results/02-connections.png' });

        // Navigate to Query Editor
        await page.click('text=Query Editor');
        // Check for toolbar buttons
        await expect(page.getByRole('button', { name: 'Execute' })).toBeVisible();
        expect(page.url()).toContain('/query');
        await page.screenshot({ path: 'test-results/03-query-editor.png' });

        // Navigate to Settings
        await page.click('text=Settings');
        await expect(page.locator('main h1')).toContainText('Settings');
        await expect(page.getByText('Appearance')).toBeVisible();
        expect(page.url()).toContain('/settings');
        await page.screenshot({ path: 'test-results/04-settings.png' });
    });

    test('should display sidebar correctly', async ({ page }) => {
        // Check sidebar elements
        await expect(page.getByText('QueryFlux v1.0.0')).toBeVisible();

        // Check sidebar logo explicitly
        await expect(page.locator('aside h1')).toContainText('QueryFlux');

        // Check links count
        const links = page.locator('aside nav a');
        await expect(links).toHaveCount(4);
    });
});
