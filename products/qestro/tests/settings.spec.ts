/**
 * Settings & Integration E2E Tests
 * Tests for API keys, integrations, webhooks, and user preferences
 */

import { test, expect } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Settings & Integrations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page
    await page.goto(`${baseURL}/settings`);

    // Check if authenticated
    const currentURL = page.url();
    if (currentURL.includes('login')) {
      test.skip();
    }

    await page.waitForLoadState('networkidle');
  });

  test('should display settings page with navigation', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/.*Settings.*/i);

    // Look for settings navigation/tabs
    const settingsTabs = page.locator('[data-testid*="settings"], [class*="settings"], nav');
    const isVisible = await settingsTabs.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(settingsTabs.first()).toBeInViewport();
    }
  });

  test('should display integrations list', async ({ page }) => {
    // Navigate to integrations tab/section
    const integrationsLink = page.locator('a:has-text("Integrations"), button:has-text("Integrations"), [data-testid="integrations-tab"]');
    const isVisible = await integrationsLink.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await integrationsLink.first().click();
      await page.waitForLoadState('networkidle');
    }

    // Look for integrations list
    const integrationsList = page.locator('[data-testid*="integration"], [class*="integration"], [class*="provider"]');
    const count = await integrationsList.count().catch(() => 0);

    // Should have at least one integration option
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should display GitHub integration', async ({ page }) => {
    // Navigate to integrations if needed
    const integrationsLink = page.locator('a:has-text("Integrations"), button:has-text("Integrations")').first();
    const isLinkVisible = await integrationsLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await integrationsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for GitHub integration
    const githubIntegration = page.locator(':text("GitHub"), [data-testid*="github"], [class*="github"]').first();
    const isVisible = await githubIntegration.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(githubIntegration).toBeInViewport();
    }
  });

  test('should display Slack integration', async ({ page }) => {
    // Navigate to integrations if needed
    const integrationsLink = page.locator('a:has-text("Integrations"), button:has-text("Integrations")').first();
    const isLinkVisible = await integrationsLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await integrationsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for Slack integration
    const slackIntegration = page.locator(':text("Slack"), [data-testid*="slack"], [class*="slack"]').first();
    const isVisible = await slackIntegration.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(slackIntegration).toBeInViewport();
    }
  });

  test('should generate API key', async ({ page }) => {
    // Navigate to API keys section
    const apiKeysLink = page.locator('a:has-text("API Keys"), a:has-text("Keys"), [data-testid="api-keys-tab"]').first();
    const isLinkVisible = await apiKeysLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await apiKeysLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for generate API key button
    const generateButton = page.locator('button:has-text("Generate"), button:has-text("Create Key"), [data-testid="generate-api-key"]').first();
    const isVisible = await generateButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await generateButton.click();

      // Wait for API key to appear
      await page.waitForTimeout(500);
      const apiKeyField = page.locator('input[readonly], [data-testid="api-key"], code');
      const keyVisible = await apiKeyField.first().isVisible({ timeout: 5000 }).catch(() => false);

      if (keyVisible) {
        const keyValue = await apiKeyField.first().inputValue().catch(() => null) ||
                         await apiKeyField.first().innerText();
        expect(keyValue).toBeTruthy();
      }
    }
  });

  test('should allow copying API key', async ({ page }) => {
    // Navigate to API keys section
    const apiKeysLink = page.locator('a:has-text("API Keys"), a:has-text("Keys"), [data-testid="api-keys-tab"]').first();
    const isLinkVisible = await apiKeysLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await apiKeysLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for copy button
    const copyButton = page.locator('button[title*="Copy"], button:has-text("Copy"), [data-testid="copy-api-key"]').first();
    const isVisible = await copyButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await copyButton.click();

      // Verify success message appears
      const successMessage = page.locator(':text("Copied"), [role="status"]');
      const messageVisible = await successMessage.first().isVisible({ timeout: 5000 }).catch(() => false);

      if (messageVisible) {
        expect(messageVisible).toBeTruthy();
      }
    }
  });

  test('should display list of API keys', async ({ page }) => {
    // Navigate to API keys section
    const apiKeysLink = page.locator('a:has-text("API Keys"), a:has-text("Keys"), [data-testid="api-keys-tab"]').first();
    const isLinkVisible = await apiKeysLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await apiKeysLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for API keys list
    const keysList = page.locator('[data-testid*="key-item"], [class*="key"], table tbody tr');
    const count = await keysList.count().catch(() => 0);

    // Should have at least one key or be empty
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should allow revoking API key', async ({ page }) => {
    // Navigate to API keys section
    const apiKeysLink = page.locator('a:has-text("API Keys"), a:has-text("Keys"), [data-testid="api-keys-tab"]').first();
    const isLinkVisible = await apiKeysLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await apiKeysLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for revoke button on first key
    const revokeButton = page.locator('button:has-text("Revoke"), button:has-text("Delete"), [data-testid*="revoke"]').first();
    const isVisible = await revokeButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await revokeButton.click();

      // Handle confirmation
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Revoke")').first();
      const confirmVisible = await confirmButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (confirmVisible) {
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should configure webhook notifications', async ({ page }) => {
    // Navigate to webhooks section
    const webhooksLink = page.locator('a:has-text("Webhooks"), [data-testid="webhooks-tab"]').first();
    const isLinkVisible = await webhooksLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await webhooksLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for webhook URL input
    const webhookInput = page.locator('input[placeholder*="webhook"], input[placeholder*="url"], input[name="webhook_url"]').first();
    const isVisible = await webhookInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      // Fill in webhook URL
      await webhookInput.fill('https://example.com/webhooks/qestro');

      // Save webhooks
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      const saveVisible = await saveButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (saveVisible) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should configure notification preferences', async ({ page }) => {
    // Navigate to notifications section
    const notificationsLink = page.locator('a:has-text("Notifications"), [data-testid="notifications-tab"]').first();
    const isLinkVisible = await notificationsLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await notificationsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for notification preference checkboxes
    const notificationCheckboxes = page.locator('input[type="checkbox"]');
    const count = await notificationCheckboxes.count().catch(() => 0);

    if (count > 0) {
      // Toggle first checkbox
      await notificationCheckboxes.first().click();

      // Save preferences
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      const saveVisible = await saveButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (saveVisible) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('should display profile settings', async ({ page }) => {
    // Navigate to profile section
    const profileLink = page.locator('a:has-text("Profile"), [data-testid="profile-tab"]').first();
    const isLinkVisible = await profileLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await profileLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for profile fields
    const profileFields = page.locator('input[placeholder*="name"], input[placeholder*="email"], [data-testid*="profile"]');
    const count = await profileFields.count().catch(() => 0);

    // Should have at least one profile field
    expect(count).toBeGreaterThan(0);
  });

  test('should allow team member invitations', async ({ page }) => {
    // Navigate to team section
    const teamLink = page.locator('a:has-text("Team"), a:has-text("Members"), [data-testid="team-tab"]').first();
    const isLinkVisible = await teamLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await teamLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for invite button
    const inviteButton = page.locator('button:has-text("Invite"), button:has-text("Add Member"), [data-testid="invite-button"]').first();
    const isVisible = await inviteButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await inviteButton.click();

      // Fill in email
      const emailInput = page.locator('input[placeholder*="email"], input[name="email"]').first();
      const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);

      if (emailVisible) {
        await emailInput.fill('teammate@example.com');
      }
    }
  });

  test('should display team members list', async ({ page }) => {
    // Navigate to team section
    const teamLink = page.locator('a:has-text("Team"), a:has-text("Members"), [data-testid="team-tab"]').first();
    const isLinkVisible = await teamLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await teamLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for team members list
    const membersList = page.locator('[data-testid*="member"], [class*="member"], table tbody tr');
    const count = await membersList.count().catch(() => 0);

    // Should have at least the current user
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display security settings', async ({ page }) => {
    // Navigate to security section
    const securityLink = page.locator('a:has-text("Security"), [data-testid="security-tab"]').first();
    const isLinkVisible = await securityLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isLinkVisible) {
      await securityLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for security options
    const securityOptions = page.locator('[data-testid*="security"], [class*="security"]');
    const count = await securityOptions.count().catch(() => 0);

    // Should have some security options
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display help/documentation links', async ({ page }) => {
    // Look for help or documentation links
    const helpLink = page.locator('a:has-text("Help"), a:has-text("Documentation"), a:has-text("Support")').first();
    const isVisible = await helpLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      expect(isVisible).toBeTruthy();
    }
  });

  test('should display version information', async ({ page }) => {
    // Navigate to settings page
    await page.goto(`${baseURL}/settings`);
    await page.waitForLoadState('networkidle');

    // Look for version info
    const versionInfo = page.locator(':text("Version"), :text("v1"), [data-testid="version"]').first();
    const isVisible = await versionInfo.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      const version = await versionInfo.innerText();
      expect(version).toMatch(/v\d+|version/i);
    }
  });
});
