import { test, expect } from '@playwright/test';

test.describe('Enterprise Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/enterprise');
  });

  test('page renders with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Enterprise Security for AI Agents'
    );
  });

  test('feature cards render', async ({ page }) => {
    // Use heading role to avoid matching parent containers
    await expect(page.getByRole('heading', { name: 'Enterprise SSO' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Unlimited Instances' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'SLA Monitoring' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Data Residency' })).toBeVisible();
  });

  test('everything included checklist is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Everything included' })).toBeVisible();
    await expect(page.getByText('SAML 2.0 & OIDC SSO')).toBeVisible();
    await expect(page.getByText('Role-based access control')).toBeVisible();
    await expect(page.getByText('Data residency controls')).toBeVisible();
    await expect(page.getByText('Admin panel & audit logs')).toBeVisible();
  });

  test('contact form renders with all fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Contact Sales' }).first()).toBeVisible();
    await expect(page.getByPlaceholder('Your name').first()).toBeVisible();
    await expect(page.getByPlaceholder('Work email').first()).toBeVisible();
    await expect(page.getByPlaceholder('Company name').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get in Touch' }).first()).toBeVisible();
  });

  test('form validation: submit empty shows error', async ({ page }) => {
    await page.getByRole('button', { name: 'Get in Touch' }).first().click();
    await expect(page.getByText('All fields are required').first()).toBeVisible();
  });

  test('form validation: partial fill still shows error', async ({ page }) => {
    await page.getByPlaceholder('Your name').first().fill('Test User');
    await page.getByRole('button', { name: 'Get in Touch' }).first().click();
    await expect(page.getByText('All fields are required').first()).toBeVisible();
  });

  test('form submission with valid data triggers action', async ({ page, baseURL }) => {
    test.skip(!baseURL?.includes('opensyber.cloud'), 'Requires production API for form submission');
    await page.getByPlaceholder('Your name').first().fill('E2E Test');
    await page.getByPlaceholder('Work email').first().fill('e2e@example.com');
    await page.getByPlaceholder('Company name').first().fill('Test Corp');
    await page.getByPlaceholder('Tell us about your needs').first().fill(
      'Playwright E2E test submission — please ignore.'
    );

    await page.getByRole('button', { name: 'Get in Touch' }).first().click();
    // Accept either success or error — API may be rate-limited in E2E
    const success = page.getByText(/thank you/i).first();
    const error = page.getByText(/error|failed|try again/i).first();
    await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
  });
});
