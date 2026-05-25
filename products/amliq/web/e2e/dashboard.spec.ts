import { test, expect } from './fixtures';
import { mockDashboard } from './mocks';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Set up auth + mocks before each test
    await page.addInitScript(() => {
      localStorage.setItem('amliq_token', 'fake.jwt.token');
    });
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          data: { id: '1', email: 'a@b.com', role: 'admin', tenant_id: 'tnt_abc' },
        }),
      }),
    );
    await mockDashboard(page);
  });

  test('shows page title and stat cards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), a/ })).toBeVisible();
    await expect(page.getByText('Total Alerts')).toBeVisible();
    await expect(page.getByText('42')).toBeVisible();
  });

  test('shows compliance overview section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Compliance Overview')).toBeVisible();
    await expect(page.getByText('Open Cases')).toBeVisible();
  });

  test('shows top entities', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Entity A')).toBeVisible();
  });

  test('sidebar is present with navigation', async ({ page, viewport }) => {
    // Nav labels are hidden on mobile (hidden sm:inline)
    test.skip(viewport !== null && viewport.width < 640, 'Nav labels hidden on mobile');
    await page.goto('/dashboard');
    await expect(page.getByText('AMLIQ')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cases' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'PEP Screening' })).toBeVisible();
  });
});
