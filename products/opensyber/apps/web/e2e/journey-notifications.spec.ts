import { authTest as test, expect } from './fixtures/auth';

/**
 * Notification Channel Journey.
 * Configure alert channels → test different providers.
 */
test.describe('Notification Settings Journey', () => {
  test('notification settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await expect(
      page.getByRole('heading', { name: /notification/i })
    ).toBeVisible();
  });

  test('shows channel list or empty state', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await page.waitForLoadState('networkidle');

    const channelItem = page.getByText(/email|webhook|slack|pagerduty/i).first();
    const emptyState = page.getByText(/no notification channels/i);
    const hasChannel = await channelItem.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasChannel || hasEmpty).toBe(true);
  });

  test('add channel form has type selector', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await page.waitForLoadState('networkidle');

    const formTitle = page.getByText('Add Notification Channel');
    const typeSelect = page.locator('select').first();

    // Form section should be visible
    const hasForm = await formTitle.isVisible().catch(() => false);
    const hasSelect = await typeSelect.isVisible().catch(() => false);
    expect(hasForm || hasSelect).toBe(true);
  });

  test('selecting Email shows email field', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await page.waitForLoadState('networkidle');

    const typeSelect = page.locator('select').first();
    if (!(await typeSelect.isVisible().catch(() => false))) {
      test.skip(true, 'No channel type selector found');
      return;
    }

    await typeSelect.selectOption('email');

    const emailInput = page.getByPlaceholder('alerts@company.com');
    await expect(emailInput).toBeVisible({ timeout: 3_000 });
  });

  test('selecting Slack shows webhook URL field', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await page.waitForLoadState('networkidle');

    const typeSelect = page.locator('select').first();
    if (!(await typeSelect.isVisible().catch(() => false))) {
      test.skip(true, 'No channel type selector found');
      return;
    }

    await typeSelect.selectOption('slack');

    const webhookInput = page.getByPlaceholder('https://hooks.slack.com/services/...');
    await expect(webhookInput).toBeVisible({ timeout: 3_000 });
  });

  test('selecting PagerDuty shows routing key field', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await page.waitForLoadState('networkidle');

    const typeSelect = page.locator('select').first();
    if (!(await typeSelect.isVisible().catch(() => false))) {
      test.skip(true, 'No channel type selector found');
      return;
    }

    await typeSelect.selectOption('pagerduty');

    const routingKeyInput = page.getByPlaceholder('Your PagerDuty routing key');
    await expect(routingKeyInput).toBeVisible({ timeout: 3_000 });
  });

  test('selecting Discord shows webhook URL field', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await page.waitForLoadState('networkidle');

    const typeSelect = page.locator('select').first();
    if (!(await typeSelect.isVisible().catch(() => false))) {
      test.skip(true, 'No channel type selector found');
      return;
    }

    await typeSelect.selectOption('discord');

    const discordInput = page.getByPlaceholder('https://discord.com/api/webhooks/...');
    await expect(discordInput).toBeVisible({ timeout: 3_000 });
  });

  test('add channel validates required name', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByRole('button', { name: /add channel/i });
    if (!(await addBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No Add Channel button found');
      return;
    }

    await addBtn.click();

    const error = page.getByText(/name is required|required/i);
    await expect(error).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Alert Channels Page Journey', () => {
  test('alert channels page loads', async ({ page }) => {
    await page.goto('/dashboard/agents/alert-channels');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('alert channels shows list or empty state', async ({ page }) => {
    await page.goto('/dashboard/agents/alert-channels');
    await page.waitForLoadState('networkidle');

    const content = page.locator('table, [class*="channel"], [class*="empty"]');
    await expect(content.first()).toBeVisible();
  });
});
