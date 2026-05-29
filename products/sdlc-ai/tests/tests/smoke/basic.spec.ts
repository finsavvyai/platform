import { test, expect } from '@playwright/test';

test.describe('SDLC Platform - Smoke Tests', () => {
    const baseUrl = process.env.BASE_URL || 'https://sdlc.finsavvyai.com';

    test('should be reachable via HTTP', async ({ page }) => {
        const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        expect(response?.status()).toBeLessThan(500);
        console.log(`✅ Platform is reachable (Status: ${response?.status()})`);
    });

    test('should have a valid page title', async ({ page }) => {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
        console.log(`✅  Page title: "${title}"`);
    });

    test('should not have critical console errors', async ({ page }) => {
        const consoleErrors: string[] = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        try {
            await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 });
            await page.waitForTimeout(2000);
        } catch (error) {
            // If page doesn't fully load, that's OK for this test
            console.log('⚠️ Page did not fully load, but checking console errors anyway');
        }

        const criticalErrors = consoleErrors.filter(err =>
            !err.includes('Cloudflare') &&
            !err.includes('challenge') &&
            (err.includes('TypeError') || err.includes('ReferenceError'))
        );

        expect(criticalErrors.length).toBe(0);
        console.log(`✅ No critical console errors found`);
    });
});
