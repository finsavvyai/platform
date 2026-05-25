import { test, expect } from '@playwright/test';

const pagesToSnapshot = [
    { path: '/', name: 'home' },
    { path: '/vs-cepien.html', name: 'vs-cepien' },
    { path: '/compare.html', name: 'compare' },
];

test.describe('Visual regression', () => {
    for (const { path, name } of pagesToSnapshot) {
        test(`${name} — hero matches baseline`, async ({ page }) => {
            await page.goto(path);
            await page.waitForLoadState('networkidle');
            await page.evaluate(() => {
                document.querySelectorAll('video, iframe, [data-animate="true"]').forEach((el) => {
                    (el as HTMLElement).style.visibility = 'hidden';
                });
            });
            await expect(page).toHaveScreenshot(`${name}-hero.png`, {
                fullPage: false,
                animations: 'disabled',
                mask: [page.locator('[data-testid*="live"], [data-counter]')],
            });
        });

        test(`${name} — full page matches baseline`, async ({ page }) => {
            await page.goto(path);
            await page.waitForLoadState('networkidle');
            await expect(page).toHaveScreenshot(`${name}-full.png`, {
                fullPage: true,
                animations: 'disabled',
                maxDiffPixelRatio: 0.03,
            });
        });
    }

    test('vs-cepien matrix table renders consistently', async ({ page }) => {
        await page.goto('/vs-cepien.html');
        await page.waitForLoadState('networkidle');
        const table = page.locator('table').first();
        await expect(table).toHaveScreenshot('vs-cepien-matrix.png', { animations: 'disabled' });
    });
});
