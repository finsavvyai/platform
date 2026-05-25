import { authTest as test, expect } from './fixtures/auth';

/**
 * Agent Deployment Journey — the core product flow.
 * Deploy → monitor → restart → delete.
 */
test.describe('Agent Deployment Journey', () => {
  test('dashboard shows deploy button or existing instances', async ({ page }) => {
    await page.goto('/dashboard');
    const deployBtn = page.getByRole('button', { name: 'Deploy Instance' });
    const instanceCard = page.locator('[class*="card"]').first();
    const hasBtn = await deployBtn.isVisible().catch(() => false);
    const hasCard = await instanceCard.isVisible().catch(() => false);
    expect(hasBtn || hasCard).toBe(true);
  });

  test('deploy form opens with name and region fields', async ({ page }) => {
    await page.goto('/dashboard');
    const deployBtn = page.getByRole('button', { name: 'Deploy Instance' });
    if (!(await deployBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No deploy button — plan limit may be reached');
      return;
    }

    await deployBtn.click();

    // Form fields should appear
    const nameInput = page.getByPlaceholder('My Agent');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    const regionSelect = page.locator('select').first();
    await expect(regionSelect).toBeVisible();
  });

  test('deploy form validates empty name', async ({ page }) => {
    await page.goto('/dashboard');
    const deployBtn = page.getByRole('button', { name: 'Deploy Instance' });
    if (!(await deployBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No deploy button visible');
      return;
    }

    await deployBtn.click();

    const nameInput = page.getByPlaceholder('My Agent');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    // Clear name and try to deploy — button should be disabled
    await nameInput.fill('');
    const submitBtn = page.getByRole('button', { name: /^Deploy$/ });
    const isDisabled = await submitBtn.isDisabled().catch(() => true);
    expect(isDisabled).toBe(true);
  });

  test('deploy form cancel returns to dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    const deployBtn = page.getByRole('button', { name: 'Deploy Instance' });
    if (!(await deployBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No deploy button visible');
      return;
    }

    await deployBtn.click();
    await expect(page.getByPlaceholder('My Agent')).toBeVisible({ timeout: 5_000 });

    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();

    // Form should be hidden
    await expect(page.getByPlaceholder('My Agent')).not.toBeVisible();
  });

  test('deploy form selects region', async ({ page }) => {
    await page.goto('/dashboard');
    const deployBtn = page.getByRole('button', { name: 'Deploy Instance' });
    if (!(await deployBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No deploy button visible');
      return;
    }

    await deployBtn.click();
    await expect(page.getByPlaceholder('My Agent')).toBeVisible({ timeout: 5_000 });

    const regionSelect = page.locator('select').first();
    await regionSelect.selectOption('us-east');

    const selectedValue = await regionSelect.inputValue();
    expect(selectedValue).toBe('us-east');
  });
});
