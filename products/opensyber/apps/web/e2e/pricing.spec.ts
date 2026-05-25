import { test, expect } from '@playwright/test';

test.describe('Pricing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('page renders with breach-cost hero', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'COST OF A BREACH'
    );
  });

  test('stats bar shows breach data', async ({ page }) => {
    await expect(page.getByText('$4.88M')).toBeVisible();
    await expect(page.getByText('$7.2M')).toBeVisible();
    await expect(page.getByText('204 days')).toBeVisible();
    await expect(page.getByText('<12 hrs')).toBeVisible();
  });

  test('self-serve plan cards render', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /starter shield/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Professional' })).toBeVisible();
  });

  test('contact-sales plan cards render', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Enterprise', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mission Defender' })).toBeVisible();
  });

  test('plan prices are displayed', async ({ page }) => {
    await expect(page.getByText('$0').first()).toBeVisible();
    await expect(page.getByText('$299', { exact: true }).first()).toBeVisible();
  });

  test('Team plan has Most Popular badge', async ({ page }) => {
    await expect(page.getByText('Most Popular')).toBeVisible();
  });

  test('Free plan shows included skills', async ({ page }) => {
    await expect(page.getByText('Secret Scanner, Git Guardian, Dependency Auditor')).toBeVisible();
  });

  test('Contact Sales links to /enterprise', async ({ page }) => {
    const contactLink = page.getByRole('link', { name: 'Contact Sales' }).first();
    await expect(contactLink).toBeVisible();
    await contactLink.click();
    await expect(page).toHaveURL(/\/enterprise/);
  });

  test('MSSP section is visible', async ({ page }) => {
    await expect(page.getByText('MANAGED SERVICE PROVIDERS')).toBeVisible();
    await expect(page.getByText('40% wholesale discount')).toBeVisible();
  });

  test('bottom tagline is visible', async ({ page }) => {
    await expect(
      page.getByText('Start free forever. Upgrade anytime.')
    ).toBeVisible();
  });
});
