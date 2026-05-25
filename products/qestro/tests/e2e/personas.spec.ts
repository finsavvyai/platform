import { test, expect } from '@playwright/test';
import { defaultMockUser, hideOverlays, mockAuth } from './fixtures/auth.fixture';

const releasedNav = [
  'Dashboard',
  'Test Cases',
  'Test Runs',
  'Recording Studio',
  'Settings',
  'Billing',
] as const;

for (const role of ['admin', 'manager', 'tester', 'user'] as const) {
  test(`persona ${role} should render the current released shell`, async ({ page }) => {
    await mockAuth(page, {
      ...defaultMockUser,
      id: `persona-${role}`,
      email: `${role}@questro.test`,
      name: `${role[0].toUpperCase()}${role.slice(1)} User`,
      role,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await hideOverlays(page);

    await expect(page.getByRole('heading', { name: 'Release Dashboard', level: 2 })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const raw = localStorage.getItem('qestro-auth');
      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw)?.state?.user?.role ?? null;
      } catch {
        return null;
      }
    })).toBe(role);

    for (const label of releasedNav) {
      await expect(page.getByRole('link', { name: label }).first()).toBeVisible();
    }
  });
}
