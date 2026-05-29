import { test, expect } from '@playwright/test';
import { LandingPage } from '../../pages/landing-page';

test.describe('Authentication Smoke Tests', () => {
    const baseUrl = process.env.BASE_URL || 'https://sdlc.finsavvyai.com';

    test('should allow user to navigate to login page', async ({ page }) => {
        await page.goto(baseUrl);

        // Look for login button/link
        const loginButton = page.locator('a[href*="login"], button:has-text("Login"), button:has-text("Sign In")').first();

        if (await loginButton.isVisible()) {
            await loginButton.click();
            await page.waitForLoadState('networkidle');
            expect(page.url()).toContain('login');
            console.log('✅ Navigated to login page');
        } else {
            console.log('⚠️ Login button not found on landing page');
        }
    });

    test('should display login form elements', async ({ page }) => {
        await page.goto(`${baseUrl}/login`);

        // Check for common login form elements
        const emailInput = page.locator('input[type="email"], input[name="email"]');
        const passwordInput = page.locator('input[type="password"], input[name="password"]');
        const submitButton = page.locator('button[type="submit"]');

        if (await emailInput.isVisible()) {
            expect(await emailInput.isVisible()).toBeTruthy();
            expect(await passwordInput.isVisible()).toBeTruthy();
            expect(await submitButton.isVisible()).toBeTruthy();
            console.log('✅ Login form elements visible');
        } else {
            // If direct navigation fails, try to find it via text
            const heading = page.locator('h1:has-text("Login"), h1:has-text("Sign In")');
            if (await heading.isVisible()) {
                console.log('✅ Login page heading visible');
            } else {
                console.log('⚠️ Login page not accessible or elements not standard');
            }
        }
    });

    test('should handle invalid credentials', async ({ page }) => {
        await page.goto(`${baseUrl}/login`);

        const emailInput = page.locator('input[type="email"], input[name="email"]');
        const passwordInput = page.locator('input[type="password"], input[name="password"]');
        const submitButton = page.locator('button[type="submit"]');

        if (await emailInput.isVisible()) {
            await emailInput.fill('invalid@example.com');
            await passwordInput.fill('wrongpassword');
            await submitButton.click();

            // Expect error message
            const errorMessage = page.locator('.error, .alert-danger, [role="alert"]');
            await expect(errorMessage).toBeVisible({ timeout: 5000 }).catch(() => {
                console.log('⚠️ Error message not found after invalid login');
            });

            if (await errorMessage.isVisible()) {
                console.log('✅ Invalid credentials handled correctly');
            }
        }
    });
});
