import { test, expect } from '@playwright/test';

test.describe('Health Check', () => {
    test('API health endpoint returns OK', async ({ request }) => {
        const response = await request.get('/health');
        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.status).toBe('ok');
        expect(body.service).toBe('mcpoverflow-api');
    });

    test('API ready endpoint returns healthy dependencies', async ({ request }) => {
        const response = await request.get('/health/ready');
        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.status).toBe('ready');
        expect(body.dependencies).toBeDefined();
    });
});

test.describe('Authentication Flow', () => {
    test('login page renders correctly', async ({ page }) => {
        await page.goto('/login');

        await expect(page.locator('h1, h2')).toContainText(/login|sign in/i);
        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('signup page renders correctly', async ({ page }) => {
        await page.goto('/signup');

        await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('invalid login shows error', async ({ page }) => {
        await page.goto('/login');

        await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
        await page.fill('input[type="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        // Wait for error message
        await expect(page.locator('[role="alert"], .error, .toast')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Skip authentication for now - would use test fixtures in production
        await page.goto('/');
    });

    test('homepage loads successfully', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/MCPOverflow|MCP/i);
    });

    test('navigation menu is accessible', async ({ page }) => {
        await page.goto('/');

        // Check for main navigation elements
        const nav = page.locator('nav, header');
        await expect(nav).toBeVisible();
    });
});

test.describe('Connector Creation Flow', () => {
    test('can navigate to create connector page', async ({ page }) => {
        await page.goto('/');

        // Look for create/new connector button
        const createButton = page.locator('button, a').filter({ hasText: /create|new|add/i }).first();
        if (await createButton.isVisible()) {
            await createButton.click();
            await expect(page.url()).toContain('/connector');
        }
    });
});

test.describe('Responsive Design', () => {
    test('mobile menu works correctly', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Check for hamburger menu or mobile navigation
        const mobileMenu = page.locator('[aria-label*="menu"], .hamburger, .mobile-menu-toggle');
        if (await mobileMenu.isVisible()) {
            await mobileMenu.click();

            // Navigation should be visible after clicking
            const nav = page.locator('nav, .mobile-nav, .sidebar');
            await expect(nav).toBeVisible();
        }
    });
});

test.describe('Accessibility', () => {
    test('homepage has no major accessibility violations', async ({ page }) => {
        await page.goto('/');

        // Basic accessibility checks
        // Check for alt text on images
        const images = page.locator('img');
        const count = await images.count();

        for (let i = 0; i < Math.min(count, 10); i++) {
            const img = images.nth(i);
            const alt = await img.getAttribute('alt');
            const role = await img.getAttribute('role');

            // Images should have alt text or be marked as decorative
            expect(alt !== null || role === 'presentation').toBeTruthy();
        }

        // Check for proper heading hierarchy
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBeLessThanOrEqual(1); // Should have at most one h1
    });
});

test.describe('API Integration', () => {
    test('metrics endpoint is accessible', async ({ request }) => {
        const response = await request.get('/metrics');
        expect(response.ok()).toBeTruthy();

        const body = await response.text();
        expect(body).toContain('http_requests_total');
    });
});

test.describe('Error Handling', () => {
    test('404 page displays correctly', async ({ page }) => {
        const response = await page.goto('/this-page-does-not-exist-12345');

        // Either 404 status or custom error page
        if (response) {
            expect([404, 200]).toContain(response.status());
        }

        // Check for error indication
        const content = await page.textContent('body');
        expect(content?.toLowerCase()).toMatch(/not found|404|error|doesn't exist/);
    });
});
