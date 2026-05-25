import { test, expect } from '@playwright/test';

test.describe('Documentation Pages', () => {
  test('/docs loads with overview heading', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /documentation/i
    );
    await expect(page.getByText(/what is opensyber/i)).toBeVisible();
  });

  test('/docs has navigation sidebar links', async ({ page }) => {
    await page.goto('/docs');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: 'Getting Started' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Security Features' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'API Reference' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'FAQ' })).toBeVisible();
  });

  test('/docs/getting-started is accessible', async ({ page }) => {
    await page.goto('/docs/getting-started');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Getting Started'
    );
    await expect(page.getByText('Create Your Account')).toBeVisible();
  });

  test('/docs/security is accessible', async ({ page }) => {
    await page.goto('/docs/security');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Security Features'
    );
    // Use heading role to avoid matching body text containing "Security Score"
    await expect(page.getByRole('heading', { name: 'Security Score' })).toBeVisible();
  });

  test('/docs/api is accessible', async ({ page }) => {
    await page.goto('/docs/api');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'API Reference'
    );
  });

  test('/docs/skills is accessible', async ({ page }) => {
    await page.goto('/docs/skills');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Skills Development'
    );
  });

  test('/docs/faq is accessible', async ({ page }) => {
    await page.goto('/docs/faq');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /faq|frequently asked/i
    );
  });
});
