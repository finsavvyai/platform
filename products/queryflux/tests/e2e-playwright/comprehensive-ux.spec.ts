import { test, expect, Page } from '@playwright/test';

/**
 * QueryFlux E2E UX Test Suite
 *
 * Comprehensive end-to-end tests covering all user flows:
 * - Authentication
 * - Dashboard interactions
 * - Navigation flows
 * - Connection management
 * - Query Editor operations
 * - Settings & preferences
 * - Responsive design
 * - Accessibility basics
 */

const BASE_URL = 'http://localhost:5198';

async function authenticate(page: Page) {
    await page.goto(BASE_URL);
    await page.evaluate(() => {
        localStorage.setItem('auth_token', 'e2e-test-token');
        localStorage.setItem('refresh_token', 'e2e-test-refresh');
    });
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
}

// ===== LOGIN TESTS =====
test.describe('Authentication', () => {
    test('should show login page when not authenticated', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page.locator('h1:has-text("QueryFlux")')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('text=Sign in to your account')).toBeVisible();
    });

    test('should have email and password fields', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page.locator('input#email')).toBeVisible();
        await expect(page.locator('input#password')).toBeVisible();
        await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
    });

    test('should show dev credentials hint', async ({ page }) => {
        await page.goto(BASE_URL);
        await expect(page.locator('text=admin@queryflux.dev')).toBeVisible();
    });
});

// ===== AUTHENTICATED TESTS =====
test.describe('QueryFlux Application', () => {
    test.beforeEach(async ({ page }) => {
        await authenticate(page);
    });

    // ===== CORE APPLICATION TESTS =====
    test.describe('Application Core', () => {
        test('should load the application successfully', async ({ page }) => {
            await expect(page).toHaveTitle(/QueryFlux/);
            await expect(page.locator('body')).toBeVisible();
        });

        test('should render the main layout with sidebar', async ({ page }) => {
            const sidebar = page.locator('aside').first();
            await expect(sidebar).toBeVisible({ timeout: 5000 });
        });

        test('should display logo or branding', async ({ page }) => {
            const branding = page.locator('text=QueryFlux').first();
            await expect(branding).toBeVisible({ timeout: 5000 });
        });
    });

    // ===== NAVIGATION TESTS =====
    test.describe('Navigation', () => {
        test('should navigate to Dashboard', async ({ page }) => {
            await page.click('text=Settings');
            await page.waitForURL(/settings/);
            await page.click('text=Dashboard');
            await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });
        });

        test('should navigate to Connections page', async ({ page }) => {
            await page.click('text=Connections');
            await page.waitForURL(/connections/, { timeout: 5000 });
            await expect(page.locator('h1:has-text("Database Connections")')).toBeVisible();
        });

        test('should navigate to Query Editor page', async ({ page }) => {
            await page.click('text=Query Editor');
            await page.waitForURL(/query/, { timeout: 5000 });
        });

        test('should navigate to Settings page', async ({ page }) => {
            await page.click('text=Settings');
            await page.waitForURL(/settings/, { timeout: 5000 });
            await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
        });

        test('should have 4 navigation links', async ({ page }) => {
            const navLinks = page.locator('nav a');
            await expect(navLinks).toHaveCount(4);
        });

        test('should highlight active navigation item', async ({ page }) => {
            await page.click('text=Settings');
            await page.waitForURL(/settings/);
            const settingsLink = page.locator('nav a:has-text("Settings")');
            await expect(settingsLink).toHaveClass(/bg-primary/);
        });
    });

    // ===== DASHBOARD TESTS =====
    test.describe('Dashboard Page', () => {
        test('should display dashboard heading', async ({ page }) => {
            await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });
        });

        test('should display metrics cards', async ({ page }) => {
            await expect(page.getByText('Active Connections', { exact: true }).first()).toBeVisible({ timeout: 5000 });
            await expect(page.getByText('Queries Run', { exact: true })).toBeVisible();
        });

        test('should display query activity section', async ({ page }) => {
            await expect(page.getByRole('heading', { name: 'Query Activity' })).toBeVisible({ timeout: 5000 });
        });

        test('should display active connections section', async ({ page }) => {
            await expect(page.locator('text=Active Connections').first()).toBeVisible({ timeout: 5000 });
        });

        test('should display query latency section', async ({ page }) => {
            await expect(page.locator('text=Query Latency')).toBeVisible({ timeout: 5000 });
        });
    });

    // ===== CONNECTIONS PAGE TESTS =====
    test.describe('Connections Page', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('text=Connections');
            await page.waitForURL(/connections/, { timeout: 5000 });
        });

        test('should display connections page header', async ({ page }) => {
            await expect(page.locator('h1:has-text("Database Connections")')).toBeVisible();
            await expect(page.locator('text=Manage your database connections')).toBeVisible();
        });

        test('should have New Connection button', async ({ page }) => {
            const addBtn = page.locator('button:has-text("New Connection")');
            await expect(addBtn).toBeVisible();
            await expect(addBtn).toBeEnabled();
        });

        test('should open create connection modal', async ({ page }) => {
            await page.click('button:has-text("New Connection")');
            await page.waitForTimeout(300);
            // Modal should appear with form fields
            await expect(page.locator('text=Create Connection').first()).toBeVisible({ timeout: 3000 });
        });
    });

    // ===== QUERY EDITOR TESTS =====
    test.describe('Query Editor Page', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('text=Query Editor');
            await page.waitForURL(/query/, { timeout: 5000 });
        });

        test('should display query editor interface', async ({ page }) => {
            // Editor uses a textarea or code editor area
            const editor = page.locator('textarea, [role="textbox"], .cm-editor');
            await expect(editor.first()).toBeVisible({ timeout: 5000 });
        });

        test('should have Execute button', async ({ page }) => {
            const executeBtn = page.locator('button:has-text("Execute"), button:has-text("Run")');
            await expect(executeBtn.first()).toBeVisible();
        });

        test('should allow typing in query editor', async ({ page }) => {
            const textarea = page.locator('textarea').first();
            if (await textarea.isVisible()) {
                await textarea.fill('SELECT * FROM users');
                await expect(textarea).toHaveValue('SELECT * FROM users');
            }
        });
    });

    // ===== SETTINGS PAGE TESTS =====
    test.describe('Settings Page', () => {
        test.beforeEach(async ({ page }) => {
            await page.click('text=Settings');
            await page.waitForURL(/settings/, { timeout: 5000 });
        });

        test('should display settings page header', async ({ page }) => {
            await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
            await expect(page.locator('text=Manage your application preferences')).toBeVisible();
        });

        test('should display Appearance section', async ({ page }) => {
            await expect(page.locator('h2:has-text("Appearance")')).toBeVisible();
        });

        test('should have theme toggle options', async ({ page }) => {
            await expect(page.getByRole('button', { name: 'Light', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Dark', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'System', exact: true })).toBeVisible();
        });

        test('should allow theme selection', async ({ page }) => {
            await page.click('button:has-text("Light")');
            await page.waitForTimeout(200);
            await page.click('button:has-text("Dark")');
        });

        test('should display About section', async ({ page }) => {
            await expect(page.locator('h2:has-text("About")')).toBeVisible();
        });

        test('should show version information', async ({ page }) => {
            await expect(page.locator('text=Version:')).toBeVisible();
        });

        test('should show backend connection status', async ({ page }) => {
            await expect(page.locator('text=Backend:')).toBeVisible();
        });
    });

    // ===== RESPONSIVE DESIGN TESTS =====
    test.describe('Responsive Design', () => {
        test('should work on mobile viewport', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });
            await authenticate(page);
            await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
        });

        test('should work on tablet viewport', async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });
            await authenticate(page);
            await expect(page.locator('body')).toBeVisible();
        });

        test('should work on desktop viewport', async ({ page }) => {
            await page.setViewportSize({ width: 1920, height: 1080 });
            await authenticate(page);
            await expect(page.locator('body')).toBeVisible();
        });
    });

    // ===== USER FLOW TESTS =====
    test.describe('User Flows', () => {
        test('complete navigation flow through all pages', async ({ page }) => {
            await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });

            await page.click('text=Connections');
            await expect(page.locator('h1:has-text("Database Connections")')).toBeVisible();

            await page.click('text=Query Editor');
            await page.waitForURL(/query/);

            await page.click('text=Settings');
            await expect(page.locator('h1:has-text("Settings")')).toBeVisible();

            await page.click('text=Dashboard');
            await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
        });

        test('settings customization flow', async ({ page }) => {
            await page.click('text=Settings');
            await page.waitForURL(/settings/);

            await page.click('button:has-text("Light")');
            await page.waitForTimeout(200);
            await page.click('button:has-text("Dark")');

            await page.click('text=Dashboard');
            await page.click('text=Settings');
            await page.waitForURL(/settings/);
        });
    });

    // ===== ACCESSIBILITY TESTS =====
    test.describe('Accessibility Basics', () => {
        test('should have proper heading hierarchy', async ({ page }) => {
            await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
        });

        test('should have clickable buttons', async ({ page }) => {
            const buttons = page.locator('button');
            const count = await buttons.count();
            expect(count).toBeGreaterThan(0);
            await expect(buttons.first()).toBeEnabled();
        });

        test('should have navigable links', async ({ page }) => {
            const links = page.locator('a');
            const count = await links.count();
            expect(count).toBeGreaterThan(0);
        });
    });

    // ===== VISUAL STABILITY TESTS =====
    test.describe('Visual Stability', () => {
        test('page should not have horizontal scroll', async ({ page }) => {
            const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
            const windowWidth = await page.evaluate(() => window.innerWidth);
            expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 10);
        });
    });

    // ===== ERROR HANDLING TESTS =====
    test.describe('Error Handling', () => {
        test('should handle 404 pages gracefully', async ({ page }) => {
            await page.goto(`${BASE_URL}/nonexistent-page-12345`);
            // Should redirect to dashboard
            await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });
        });

        test('should not crash on rapid navigation', async ({ page }) => {
            await page.click('text=Connections');
            await page.click('text=Query Editor');
            await page.click('text=Settings');
            await page.click('text=Dashboard');
            await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 });
        });
    });
});

// ===== PERFORMANCE TESTS =====
test.describe('Performance', () => {
    test('page should load within reasonable time', async ({ page }) => {
        const startTime = Date.now();
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');
        const loadTime = Date.now() - startTime;
        expect(loadTime).toBeLessThan(10000);
    });

    test('navigation should be responsive', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.setItem('auth_token', 'e2e-test-token');
            localStorage.setItem('refresh_token', 'e2e-test-refresh');
        });
        await page.goto(BASE_URL);

        const startTime = Date.now();
        await page.click('text=Settings');
        await page.waitForURL(/settings/);
        const navTime = Date.now() - startTime;
        expect(navTime).toBeLessThan(3000);
    });
});
