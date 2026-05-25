import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure no auth tokens are present so we land on the login page
    await page.addInitScript(() => {
      localStorage.removeItem('pushci_token');
      localStorage.removeItem('pushci_user');
    });
  });

  test('renders with all provider buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'PushCI' })).toBeVisible();
    // Source control providers
    await expect(page.getByRole('button', { name: /GitHub/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /GitLab/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bitbucket/ })).toBeVisible();
    // Social / identity providers
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Microsoft/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /LinkedIn/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Facebook/ })).toBeVisible();
  });

  test('clicking GitHub redirects to github.com/login/oauth', async ({ page }) => {
    // Mock the provider config endpoint so the button is enabled
    await page.route('**/api/auth/github/config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ clientId: 'test-client-id' }),
      }),
    );

    await page.goto('/');
    // Wait for GitHub button to be enabled
    const githubBtn = page.getByRole('button', { name: /GitHub/ });
    await expect(githubBtn).toBeVisible();

    // Listen for navigation before clicking
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('github.com/login/oauth')),
      githubBtn.click(),
    ]);

    expect(request.url()).toContain('github.com/login/oauth/authorize');
    expect(request.url()).toContain('client_id=');
  });

  test('displays error message when OAuth state is invalid', async ({ page }) => {
    // Simulate returning from OAuth with an invalid state
    await page.goto('/?code=fake-code&state=invalid-state');
    await expect(page.getByText(/Invalid OAuth state/i)).toBeVisible();
  });

  test('"Source control" and "or continue with" sections are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Source control')).toBeVisible();
    await expect(page.getByText('or continue with')).toBeVisible();
  });
});
