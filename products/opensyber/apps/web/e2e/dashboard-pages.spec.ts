import { authTest as test, expect } from './fixtures/auth';

/**
 * Dashboard page tests — requires authenticated session.
 * Run auth-setup.spec.ts first to generate .auth/user.json.
 *
 * If auth state is missing, tests skip gracefully.
 */
test.describe('Dashboard Main', () => {
  test('loads with security overview', async ({ page }) => {
    await page.goto('/dashboard');
    // Should show dashboard, not sign-in redirect
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('sidebar navigation has all sections', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.locator('nav, aside, [class*="sidebar"]');
    const links = sidebar.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
  });

  test('stat cards render with numbers', async ({ page }) => {
    await page.goto('/dashboard');
    // Dashboard shows stat cards with security info
    const statCards = page.locator('[class*="card"], [class*="stat"]');
    await expect(statCards.first()).toBeVisible();
  });
});

test.describe('Dashboard — Agent Monitoring', () => {
  test('agents page loads', async ({ page }) => {
    await page.goto('/dashboard/agents');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('agent policies page loads', async ({ page }) => {
    await page.goto('/dashboard/agents/policies');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('agent violations page loads', async ({ page }) => {
    await page.goto('/dashboard/agents/violations');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('alert channels page loads', async ({ page }) => {
    await page.goto('/dashboard/agents/alert-channels');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});

test.describe('Dashboard — Cloud Security', () => {
  test('cloud accounts page loads with Connect Account button', async ({ page }) => {
    await page.goto('/dashboard/cloud');
    await expect(page.getByRole('heading')).toBeVisible();
    // Either accounts table or empty state with "Connect Account" CTA
    const connectBtn = page.getByRole('button', { name: /connect account/i }).or(
      page.getByText(/connect account|get started/i)
    );
    await expect(connectBtn.first()).toBeVisible();
  });

  test('CSPM findings page loads with severity filters', async ({ page }) => {
    await page.goto('/dashboard/cloud/findings');
    await expect(page.getByRole('heading')).toBeVisible();
    // Should have severity and status filter selects
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Dashboard — Security Suite', () => {
  test('security dashboard loads', async ({ page }) => {
    await page.goto('/dashboard/security');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('alerts page loads', async ({ page }) => {
    await page.goto('/dashboard/security/alerts');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('incidents page loads', async ({ page }) => {
    await page.goto('/dashboard/security/incidents');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('policies page loads', async ({ page }) => {
    await page.goto('/dashboard/security/policies');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('vulnerabilities page loads', async ({ page }) => {
    await page.goto('/dashboard/security/vulnerabilities');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});

test.describe('Dashboard — Compliance & Enterprise', () => {
  test('OASF compliance page loads', async ({ page }) => {
    await page.goto('/dashboard/oasf');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('SOC2 readiness page loads', async ({ page }) => {
    await page.goto('/dashboard/soc2');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('SLA monitor page loads', async ({ page }) => {
    await page.goto('/dashboard/sla');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('attack paths page loads', async ({ page }) => {
    await page.goto('/dashboard/attack-paths');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('assets page loads', async ({ page }) => {
    await page.goto('/dashboard/assets');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});

test.describe('Dashboard — Team & Settings', () => {
  test('team page loads', async ({ page }) => {
    await page.goto('/dashboard/team');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('skills page loads', async ({ page }) => {
    await page.goto('/dashboard/skills');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('achievements page loads', async ({ page }) => {
    await page.goto('/dashboard/achievements');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
