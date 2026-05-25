import { authTest as test, expect } from './fixtures/auth';

/**
 * Cloud Account & CSPM Journey.
 * Connect cloud → view findings → filter → reset.
 */
test.describe('Cloud Account Journey', () => {
  test('cloud page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/cloud');
    await expect(
      page.getByRole('heading', { name: /cloud security/i })
    ).toBeVisible();
  });

  test('connect account button is visible', async ({ page }) => {
    await page.goto('/dashboard/cloud');
    await page.waitForLoadState('networkidle');

    const connectBtn = page.getByRole('button', { name: /connect account/i }).or(
      page.getByRole('button', { name: /get started/i })
    );
    await expect(connectBtn.first()).toBeVisible();
  });

  test('connect account modal opens with provider select', async ({ page }) => {
    await page.goto('/dashboard/cloud');
    await page.waitForLoadState('networkidle');

    const connectBtn = page.getByRole('button', { name: /connect account/i }).or(
      page.getByRole('button', { name: /get started/i })
    );
    await connectBtn.first().click();

    // Modal should show
    const modalTitle = page.getByText('Connect Cloud Account');
    await expect(modalTitle).toBeVisible({ timeout: 5_000 });

    // Provider select with AWS/GCP/Azure options
    const providerSelect = page.locator('select').first();
    await expect(providerSelect).toBeVisible();

    const options = providerSelect.locator('option');
    const optionTexts = await options.allTextContents();
    const combined = optionTexts.join(' ');
    expect(combined).toContain('AWS');
  });

  test('connect modal shows AWS fields when AWS selected', async ({ page }) => {
    await page.goto('/dashboard/cloud');
    await page.waitForLoadState('networkidle');

    const connectBtn = page.getByRole('button', { name: /connect account/i }).or(
      page.getByRole('button', { name: /get started/i })
    );
    await connectBtn.first().click();
    await expect(page.getByText('Connect Cloud Account')).toBeVisible({ timeout: 5_000 });

    // Select AWS
    const providerSelect = page.locator('select').first();
    await providerSelect.selectOption({ label: 'AWS' });

    // AWS-specific fields
    const arnInput = page.getByPlaceholder(/arn:aws/);
    await expect(arnInput).toBeVisible({ timeout: 3_000 });
  });

  test('connect modal closes on Cancel', async ({ page }) => {
    await page.goto('/dashboard/cloud');
    await page.waitForLoadState('networkidle');

    const connectBtn = page.getByRole('button', { name: /connect account/i }).or(
      page.getByRole('button', { name: /get started/i })
    );
    await connectBtn.first().click();
    await expect(page.getByText('Connect Cloud Account')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Connect Cloud Account')).not.toBeVisible();
  });

  test('connect modal validates empty account name', async ({ page }) => {
    await page.goto('/dashboard/cloud');
    await page.waitForLoadState('networkidle');

    const connectBtn = page.getByRole('button', { name: /connect account/i }).or(
      page.getByRole('button', { name: /get started/i })
    );
    await connectBtn.first().click();
    await expect(page.getByText('Connect Cloud Account')).toBeVisible({ timeout: 5_000 });

    // Submit without filling name
    const submitBtn = page.getByRole('button', { name: /^Connect$/ });
    await submitBtn.click();

    const error = page.getByText(/account name is required|required/i);
    await expect(error).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('CSPM Findings Journey', () => {
  test('findings page loads with severity filters', async ({ page }) => {
    await page.goto('/dashboard/cloud/findings');
    await expect(page.getByRole('heading')).toBeVisible();

    // Should have at least 2 select elements (severity + status)
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('filter findings by severity', async ({ page }) => {
    await page.goto('/dashboard/cloud/findings');
    await page.waitForLoadState('networkidle');

    const sevSelect = page.locator('select').first();
    await sevSelect.selectOption('critical');
    await page.waitForLoadState('networkidle');

    // Reset
    await sevSelect.selectOption('');
  });

  test('filter findings by status', async ({ page }) => {
    await page.goto('/dashboard/cloud/findings');
    await page.waitForLoadState('networkidle');

    const statusSelect = page.locator('select').nth(1);
    await statusSelect.selectOption('open');
    await page.waitForLoadState('networkidle');

    // Reset
    await statusSelect.selectOption('');
  });

  test('combine severity and status filters', async ({ page }) => {
    await page.goto('/dashboard/cloud/findings');
    await page.waitForLoadState('networkidle');

    const sevSelect = page.locator('select').first();
    const statusSelect = page.locator('select').nth(1);

    await sevSelect.selectOption('critical');
    await statusSelect.selectOption('open');
    await page.waitForLoadState('networkidle');

    // Reset both
    await sevSelect.selectOption('');
    await statusSelect.selectOption('');
  });
});
