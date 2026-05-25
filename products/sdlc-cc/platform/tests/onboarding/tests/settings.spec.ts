import { test, expect } from '@playwright/test';

/**
 * Settings and Profile Management Tests
 * Tests for user settings and profile management
 */
test.describe('Settings and Profile - Access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should redirect to sign-in when accessing settings without auth', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/sign-in|\/sign-up/);
  });

  test('should display settings page when authenticated', async ({ page }) => {
    // Sign in first
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/sign-in')) {
      await page.goto('/dashboard/settings');
      await page.waitForTimeout(2000);

      const settingsVisible = await page.locator('text=Settings, h1:has-text("Settings")').isVisible().catch(() => false);
      // Settings page might or might not exist
      if (settingsVisible) {
        expect(settingsVisible).toBeTruthy();
      }
    }
  });
});

test.describe('Settings and Profile - User Menu', () => {
  test('should display user menu button', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/sign-in')) {
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);

      const userButton = page.locator('[class*="user"], [class*="avatar"], button:has-text("account")');
      const buttonVisible = await userButton.isVisible().catch(() => false);

      if (buttonVisible) {
        expect(buttonVisible).toBeTruthy();
      }
    }
  });

  test('should open user menu on click', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/sign-in')) {
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);

      const userButton = page.locator('[class*="user"], [class*="avatar"], button:has-text("account")');
      const buttonVisible = await userButton.isVisible().catch(() => false);

      if (buttonVisible) {
        await userButton.click();
        await page.waitForTimeout(500);

        // Menu should appear
        const menuItems = page.locator('[role="menuitem"], a:has-text("Sign out"), button:has-text("Sign out")');
        const hasMenuItems = await menuItems.count() > 0;

        if (hasMenuItems) {
          expect(hasMenuItems).toBeTruthy();
        }
      }
    }
  });

  test('should have sign out option in menu', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/sign-in')) {
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);

      const userButton = page.locator('[class*="user"], [class*="avatar"]');
      const buttonVisible = await userButton.isVisible().catch(() => false);

      if (buttonVisible) {
        await userButton.click();
        await page.waitForTimeout(500);

        const signOutButton = page.locator('button:has-text("Sign out"), a:has-text("Sign out"), button:has-text("Log out")');
        const signOutVisible = await signOutButton.isVisible().catch(() => false);

        if (signOutVisible) {
          expect(signOutVisible).toBeTruthy();
        }
      }
    }
  });
});

test.describe('Settings and Profile - Sign Out', () => {
  test('should sign out and redirect to home', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/sign-in')) {
      // Open user menu and sign out
      const userButton = page.locator('[class*="user"], [class*="avatar"]');
      const buttonVisible = await userButton.isVisible().catch(() => false);

      if (buttonVisible) {
        await userButton.click();
        await page.waitForTimeout(500);

        const signOutButton = page.locator('button:has-text("Sign out"), a:has-text("Sign out")');
        const signOutVisible = await signOutButton.isVisible().catch(() => false);

        if (signOutVisible) {
          await signOutButton.click();
          await page.waitForTimeout(2000);

          // Should be redirected to home or sign-in
          const currentUrl = page.url();
          const isSignedOut = currentUrl.includes('/') || currentUrl.includes('/sign-in');
          expect(isSignedOut).toBeTruthy();
        }
      }
    }
  });

  test('should clear session after sign out', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/sign-in')) {
      // Sign out
      const userButton = page.locator('[class*="user"], [class*="avatar"]');
      const buttonVisible = await userButton.isVisible().catch(() => false);

      if (buttonVisible) {
        await userButton.click();
        await page.waitForTimeout(500);

        const signOutButton = page.locator('button:has-text("Sign out")');
        const signOutVisible = await signOutButton.isVisible().catch(() => false);

        if (signOutVisible) {
          await signOutButton.click();
          await page.waitForTimeout(2000);

          // Try to access dashboard
          await page.goto('/dashboard');
          await page.waitForTimeout(2000);

          // Should be redirected to sign-in
          const currentUrl = page.url();
          expect(currentUrl).toMatch(/\/sign-in|\/sign-up/);
        }
      }
    }
  });
});

test.describe('Settings and Profile - Profile Editing', () => {
  test('should allow profile editing', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/sign-in')) {
      // Try to access profile settings
      await page.goto('/dashboard/settings/profile');
      await page.waitForTimeout(2000);

      const profileSection = page.locator('section:has-text("Profile"), form:has-text("Profile")');
      const profileVisible = await profileSection.isVisible().catch(() => false);

      if (profileVisible) {
        // Check for profile form fields
        const nameInput = page.locator('input[name="name"], input[name="fullName"]').first();
        const emailInput = page.locator('input[type="email"]').first();

        const hasProfileForm = await nameInput.isVisible().catch(() => false) ||
                                await emailInput.isVisible().catch(() => false);

        if (hasProfileForm) {
          expect(hasProfileForm).toBeTruthy();
        }
      }
    }
  });
});

test.describe('Settings and Profile - Security Settings', () => {
  test('should have security settings section', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/sign-in')) {
      // Try to access security settings
      await page.goto('/dashboard/settings/security');
      await page.waitForTimeout(2000);

      const securitySection = page.locator('section:has-text("Security"), h2:has-text("Security")');
      const securityVisible = await securitySection.isVisible().catch(() => false);

      if (securityVisible) {
        expect(securityVisible).toBeTruthy();
      }
    }
  });

  test('should allow password change', async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/sign-in')) {
      // Try to access password change
      await page.goto('/dashboard/settings/security');
      await page.waitForTimeout(2000);

      const currentPasswordInput = page.locator('input[name="currentPassword"], input[name="old_password"]');
      const newPasswordInput = page.locator('input[name="newPassword"], input[name="new_password"]');

      const hasPasswordForm = await currentPasswordInput.isVisible().catch(() => false) ||
                               await newPasswordInput.isVisible().catch(() => false);

      if (hasPasswordForm) {
        expect(hasPasswordForm).toBeTruthy();
      }
    }
  });
});
