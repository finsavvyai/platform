import { test, expect } from '@playwright/test';

test.describe('Marketing site', () => {
    test('home page renders hero', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/LunaOS/i);
        const cta = page.getByRole('link', { name: /get started|try|sign up/i }).first();
        await expect(cta).toBeVisible({ timeout: 10_000 });
    });

    test('compare page loads', async ({ page }) => {
        await page.goto('/compare.html');
        await expect(page.locator('h1').first()).toBeVisible();
    });

    test('vs-cepien page has feature matrix and price delta', async ({ page }) => {
        await page.goto('/vs-cepien.html');
        await expect(page).toHaveTitle(/LunaOS vs Cepien/i);
        await expect(page.getByText(/22× cheaper/i)).toBeVisible();
        await expect(page.getByText(/Feature matrix/i)).toBeVisible();
        await expect(page.getByText(/MCP/i).first()).toBeVisible();
    });

    test('vs-cepien has migration CTA linking to get-started', async ({ page }) => {
        await page.goto('/vs-cepien.html');
        const cta = page.getByRole('link', { name: /Try LunaOS Pro/i });
        await expect(cta).toHaveAttribute('href', /get-started/);
    });

    test('no console errors on vs-cepien page', async ({ page }) => {
        const errs: string[] = [];
        page.on('pageerror', (e) => errs.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errs.push(m.text());
        });
        await page.goto('/vs-cepien.html');
        await page.waitForLoadState('networkidle');
        const fatal = errs.filter((e) => !/ResizeObserver|favicon/i.test(e));
        expect(fatal, fatal.join(' | ')).toHaveLength(0);
    });

    test('og and canonical tags present for SEO', async ({ page }) => {
        await page.goto('/vs-cepien.html');
        const ogTitle = page.locator('meta[property="og:title"]');
        const canonical = page.locator('link[rel="canonical"]');
        await expect(ogTitle).toHaveAttribute('content', /.+/);
        await expect(canonical).toHaveAttribute('href', /vs-cepien/);
    });
});
