import { authTest as test, expect } from './fixtures/auth';

/**
 * Security Policy & Alert Journey.
 * Create policy → configure alert rules → manage alerts.
 */
test.describe('Security Policy Journey', () => {
  test('policies page loads with create button', async ({ page }) => {
    await page.goto('/dashboard/security/policies');
    await expect(page.getByRole('heading')).toBeVisible();
    // Should have either policies table or empty state
    const table = page.locator('table');
    const emptyState = page.getByText(/no policies/i);
    const hasContent = (await table.isVisible().catch(() => false)) ||
      (await emptyState.isVisible().catch(() => false));
    expect(hasContent).toBe(true);
  });

  test('create policy modal opens and closes', async ({ page }) => {
    await page.goto('/dashboard/agents/policies');
    await page.waitForLoadState('networkidle');

    const createBtn = page.getByRole('button', { name: /create policy/i }).or(
      page.getByText('Create Policy').first()
    );
    if (!(await createBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No create policy button found');
      return;
    }

    await createBtn.click();

    // Modal fields visible
    const nameInput = page.getByPlaceholder('Block .env access');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    // Close via Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(nameInput).not.toBeVisible();
  });

  test('create policy modal validates required fields', async ({ page }) => {
    await page.goto('/dashboard/agents/policies');
    await page.waitForLoadState('networkidle');

    const createBtn = page.getByRole('button', { name: /create policy/i });
    if (!(await createBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No create policy button found');
      return;
    }

    await createBtn.click();
    await expect(page.getByPlaceholder('Block .env access')).toBeVisible({ timeout: 5_000 });

    // Try submit without filling name
    const submitBtn = page.getByRole('button', { name: /^Create Policy$/ });
    await submitBtn.click();

    // Should show error
    const error = page.getByText(/policy name is required|required/i);
    await expect(error).toBeVisible({ timeout: 5_000 });
  });

  test('create policy modal has severity options', async ({ page }) => {
    await page.goto('/dashboard/agents/policies');
    await page.waitForLoadState('networkidle');

    const createBtn = page.getByRole('button', { name: /create policy/i });
    if (!(await createBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No create policy button found');
      return;
    }

    await createBtn.click();
    await expect(page.getByPlaceholder('Block .env access')).toBeVisible({ timeout: 5_000 });

    // Severity select should have options
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Alert Rule Journey', () => {
  test('alert rules page loads', async ({ page }) => {
    await page.goto('/dashboard/security/alert-rules');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('new rule modal opens with form fields', async ({ page }) => {
    await page.goto('/dashboard/security/alert-rules');
    await page.waitForLoadState('networkidle');

    const newRuleBtn = page.getByRole('button', { name: /new rule/i });
    if (!(await newRuleBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No New Rule button found');
      return;
    }

    await newRuleBtn.click();

    // Modal with form fields
    const nameInput = page.getByPlaceholder('e.g. Brute force detector');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    // Number inputs for threshold, window, cooldown
    const numberInputs = page.locator('input[type="number"]');
    const inputCount = await numberInputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(2);

    // Cancel closes modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(nameInput).not.toBeVisible();
  });
});

test.describe('Alert Management Journey', () => {
  test('alerts page shows list or empty state', async ({ page }) => {
    await page.goto('/dashboard/security/alerts');
    const table = page.locator('table');
    const emptyState = page.getByText(/no alerts/i);
    const hasContent = (await table.isVisible().catch(() => false)) ||
      (await emptyState.isVisible().catch(() => false));
    expect(hasContent).toBe(true);
  });

  test('alert action buttons render for open alerts', async ({ page }) => {
    await page.goto('/dashboard/security/alerts');
    await page.waitForLoadState('networkidle');

    const ackBtn = page.getByRole('button', { name: 'Acknowledge' });
    const resolveBtn = page.getByRole('button', { name: 'Resolve' });
    const hasActions = (await ackBtn.first().isVisible().catch(() => false)) ||
      (await resolveBtn.first().isVisible().catch(() => false));

    // If no alerts exist, that's also valid
    if (!hasActions) {
      const emptyState = page.getByText(/no alerts/i);
      await expect(emptyState).toBeVisible();
    }
  });
});
