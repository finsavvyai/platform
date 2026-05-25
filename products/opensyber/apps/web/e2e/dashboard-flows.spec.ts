import { authTest as test, expect } from './fixtures/auth';

/**
 * Dashboard interactive flows — requires authenticated session.
 * Tests buttons, modals, forms, filters, and state changes.
 */
test.describe('Cloud Account Flow', () => {
  test('open Connect Account modal and close', async ({ page }) => {
    await page.goto('/dashboard/cloud');
    const connectBtn = page.getByRole('button', { name: /connect account/i }).or(
      page.getByText('Connect Account').first()
    );
    await connectBtn.click();

    // Modal should open
    const modal = page.locator('[class*="modal"], [role="dialog"], [class*="fixed"]');
    await expect(modal.first()).toBeVisible();

    // Close modal (X button or Escape)
    const closeBtn = page.getByRole('button', { name: /close|cancel/i }).or(
      page.locator('[class*="modal"] button').first()
    );
    const hasClose = await closeBtn.isVisible().catch(() => false);
    if (hasClose) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('CSPM Findings Filter Flow', () => {
  test('filter by severity and status', async ({ page }) => {
    await page.goto('/dashboard/cloud/findings');

    // Severity filter
    const sevSelect = page.locator('select').first();
    await sevSelect.selectOption('critical');
    await page.waitForTimeout(1000);

    // Status filter
    const statusSelect = page.locator('select').nth(1);
    await statusSelect.selectOption('open');
    await page.waitForTimeout(1000);

    // Reset filters
    await sevSelect.selectOption('');
    await statusSelect.selectOption('');
  });
});

test.describe('Security Alerts Flow', () => {
  test('alerts page shows list or empty state', async ({ page }) => {
    await page.goto('/dashboard/security/alerts');
    const alerts = page.locator('table, [class*="alert"], [class*="empty"]');
    await expect(alerts.first()).toBeVisible();
  });
});

test.describe('Attack Paths Flow', () => {
  test('shows session selector or empty state', async ({ page }) => {
    await page.goto('/dashboard/attack-paths');
    // Either session buttons or "No agent sessions" message
    const sessions = page.getByRole('button', { name: /.+/ });
    const emptyMsg = page.getByText(/no agent sessions/i);
    const hasSessions = (await sessions.count()) > 0;
    const hasEmpty = await emptyMsg.isVisible().catch(() => false);
    expect(hasSessions || hasEmpty).toBe(true);
  });
});

test.describe('Skills Management Flow', () => {
  test('installed skills page shows table or empty state', async ({ page }) => {
    await page.goto('/dashboard/skills');
    const table = page.locator('table');
    const empty = page.getByText(/no skills installed/i);
    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('Browse Marketplace button links correctly', async ({ page }) => {
    await page.goto('/dashboard/skills');
    const browseBtn = page.getByRole('link', { name: /browse marketplace|marketplace/i });
    await expect(browseBtn.first()).toBeVisible();
    const href = await browseBtn.first().getAttribute('href');
    expect(href).toMatch(/marketplace/);
  });
});

test.describe('Team Management Flow', () => {
  test('team page shows members or invite form', async ({ page }) => {
    await page.goto('/dashboard/team');
    const content = page.locator('table, [class*="member"], [class*="invite"], form');
    await expect(content.first()).toBeVisible();
  });
});

test.describe('Settings Flow', () => {
  test('settings page renders configuration options', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('notification settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings/notifications');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});

test.describe('Dashboard Navigation Flow', () => {
  test('navigate between dashboard sections via sidebar', async ({ page }) => {
    await page.goto('/dashboard');

    // Find sidebar links and navigate
    const sidebarLinks = page.locator('nav a[href^="/dashboard/"], aside a[href^="/dashboard/"]');
    const count = await sidebarLinks.count();

    if (count > 0) {
      // Click first sidebar link
      await sidebarLinks.first().click();
      await page.waitForTimeout(500);
      // Should have navigated to a dashboard sub-page
      expect(page.url()).toMatch(/\/dashboard\/.+/);
    }
  });
});
