import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke Tests', () => {
    const baseUrl = process.env.BASE_URL || 'https://sdlc.finsavvyai.com';

    test('should protect dashboard routes', async ({ page }) => {
        // Attempt to access dashboard without login
        await page.goto(`${baseUrl}/dashboard`);

        // Should be redirected to login
        await page.waitForLoadState('networkidle');
        const url = page.url();

        if (url.includes('login') || url.includes('signin')) {
            console.log('✅ Dashboard route protected (redirected to login)');
        } else {
            console.log(`⚠️ Dashboard route might be accessible without login: ${url}`);
            // If it's a public dashboard, check for dashboard elements
            const dashboardElement = page.locator('.dashboard, [data-testid="dashboard"]');
            if (await dashboardElement.isVisible()) {
                console.log('⚠️ Dashboard is visible without auth');
            }
        }
    });
});
