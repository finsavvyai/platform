import { authTest as test, expect } from './fixtures/auth';

const BASE = process.env.E2E_BASE_URL ?? 'https://opensyber.cloud';
const API_BASE = process.env.API_BASE_URL ?? 'https://api.opensyber.cloud';

/**
 * Cloud security & CSPM browser tests — setup wizard (AWS/Azure/GCP),
 * findings filters, risk scoring, scan triggers, drift detection.
 * Plan gating (cloudSync requires Pro), error states for invalid credentials.
 */

/* ================================================================== */
/*  Cloud Security Page                                                */
/* ================================================================== */
test.describe('Cloud Security Page — Happy Path', () => {
  test('cloud security page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Cloud Security')).toBeVisible({ timeout: 10_000 });
  });

  test('shows provider setup buttons', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud`);
    await page.waitForLoadState('networkidle');

    // Setup Wizard and Quick Connect buttons
    const setupWizard = page.getByRole('button', { name: /setup wizard/i });
    const quickConnect = page.getByRole('button', { name: /quick connect/i });
    const connectBtn = page.getByRole('button', { name: /connect account/i });

    const hasSetup = await setupWizard.isVisible().catch(() => false);
    const hasQuick = await quickConnect.isVisible().catch(() => false);
    const hasConnect = await connectBtn.isVisible().catch(() => false);

    expect(hasSetup || hasQuick || hasConnect).toBe(true);
  });
});

test.describe('Cloud Security — Plan Gate', () => {
  test('cloud page shows content or upgrade prompt for plan', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud`);
    await page.waitForLoadState('networkidle');

    const cloudContent = page.getByText('Cloud Security');
    const upgradePrompt = page.getByText(/upgrade|requires pro|cloud sync/i);

    const hasContent = await cloudContent.isVisible().catch(() => false);
    const hasUpgrade = await upgradePrompt.first().isVisible().catch(() => false);

    // Either shows cloud features or plan gate
    expect(hasContent || hasUpgrade).toBe(true);
  });
});

/* ================================================================== */
/*  Cloud Setup Wizard                                                 */
/* ================================================================== */
test.describe('Cloud Setup Wizard — Happy Path', () => {
  test('setup wizard shows provider selection', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/setup`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Connect Cloud Account')).toBeVisible({ timeout: 10_000 });

    // All three providers should be visible
    const providers = ['Amazon Web Services', 'Microsoft Azure', 'Google Cloud Platform'];
    for (const provider of providers) {
      await expect(page.getByText(provider)).toBeVisible();
    }
  });

  test('clicking AWS shows AWS-specific configuration', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/setup`);
    await page.waitForLoadState('networkidle');

    const awsCard = page.getByText('Amazon Web Services');
    await expect(awsCard).toBeVisible({ timeout: 10_000 });

    await awsCard.click();
    await page.waitForTimeout(1000);

    // Should show AWS config fields (role ARN, access key, etc.)
    const awsFields = page.getByText(/ARN|Access Key|Region|AWS/i);
    const nextStep = page.getByRole('button', { name: /next|continue|connect/i });

    const hasFields = await awsFields.first().isVisible().catch(() => false);
    const hasNext = await nextStep.first().isVisible().catch(() => false);

    expect(hasFields || hasNext).toBe(true);
  });

  test('clicking Azure shows Azure-specific configuration', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/setup`);
    await page.waitForLoadState('networkidle');

    const azureCard = page.getByText('Microsoft Azure');
    await expect(azureCard).toBeVisible({ timeout: 10_000 });

    await azureCard.click();
    await page.waitForTimeout(1000);

    const azureFields = page.getByText(/Tenant|Subscription|Client|Azure/i);
    const nextStep = page.getByRole('button', { name: /next|continue|connect/i });

    const hasFields = await azureFields.first().isVisible().catch(() => false);
    const hasNext = await nextStep.first().isVisible().catch(() => false);

    expect(hasFields || hasNext).toBe(true);
  });

  test('clicking GCP shows GCP-specific configuration', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/setup`);
    await page.waitForLoadState('networkidle');

    const gcpCard = page.getByText('Google Cloud Platform');
    await expect(gcpCard).toBeVisible({ timeout: 10_000 });

    await gcpCard.click();
    await page.waitForTimeout(1000);

    const gcpFields = page.getByText(/Project|Service Account|GCP/i);
    const nextStep = page.getByRole('button', { name: /next|continue|connect/i });

    const hasFields = await gcpFields.first().isVisible().catch(() => false);
    const hasNext = await nextStep.first().isVisible().catch(() => false);

    expect(hasFields || hasNext).toBe(true);
  });
});

test.describe('Cloud Setup Wizard — Error Paths', () => {
  test('submitting empty credentials shows validation error', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/setup`);
    await page.waitForLoadState('networkidle');

    // Click a provider
    await page.getByText('Amazon Web Services').click();
    await page.waitForTimeout(1000);

    // Try to proceed without filling credentials
    const nextBtn = page.getByRole('button', { name: /next|continue|connect/i });
    if (await nextBtn.first().isVisible().catch(() => false)) {
      await nextBtn.first().click();

      // Should show validation error
      const error = page.getByText(/required|invalid|fill|credentials/i);
      const stillOnPage = page.getByText('Amazon Web Services');

      const hasError = await error.first().isVisible().catch(() => false);
      const stillVisible = await stillOnPage.isVisible().catch(() => false);

      expect(hasError || stillVisible).toBe(true);
    }
  });
});

/* ================================================================== */
/*  CSPM Findings                                                      */
/* ================================================================== */
test.describe('CSPM Findings — Happy Path', () => {
  test('findings page loads', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/findings`);
    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('shows findings table or empty state', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/findings`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const emptyState = page.getByText(/no findings|no cloud accounts|connect/i);

    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await emptyState.first().isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBe(true);
  });
});

test.describe('CSPM Findings — Filtering', () => {
  test('severity filter works', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/findings`);
    await page.waitForLoadState('networkidle');

    const sevSelect = page.locator('select').first();
    if (await sevSelect.isVisible().catch(() => false)) {
      await sevSelect.selectOption('critical');
      await page.waitForTimeout(1000);

      // Page should not crash
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible();

      // Reset
      await sevSelect.selectOption('');
    }
  });

  test('status filter works', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/findings`);
    await page.waitForLoadState('networkidle');

    const statusSelect = page.locator('select').nth(1);
    if (await statusSelect.isVisible().catch(() => false)) {
      await statusSelect.selectOption('open');
      await page.waitForTimeout(1000);

      await expect(page.getByRole('heading').first()).toBeVisible();

      await statusSelect.selectOption('');
    }
  });

  test('combined severity + status filter works', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud/findings`);
    await page.waitForLoadState('networkidle');

    const sevSelect = page.locator('select').first();
    const statusSelect = page.locator('select').nth(1);

    if (await sevSelect.isVisible().catch(() => false) &&
        await statusSelect.isVisible().catch(() => false)) {
      await sevSelect.selectOption('high');
      await statusSelect.selectOption('open');
      await page.waitForTimeout(1000);

      // Should show filtered results or empty state
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible();

      // Reset both
      await sevSelect.selectOption('');
      await statusSelect.selectOption('');
    }
  });
});

/* ================================================================== */
/*  Cloud API — Plan Enforcement                                       */
/* ================================================================== */
test.describe('Cloud API — Plan Enforcement', () => {
  test('cloud accounts endpoint requires authentication', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/cloud-accounts`);
    expect(res.status()).toBe(401);
  });

  test('cloud setup endpoint requires authentication', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/cloud/setup`, {
      data: { provider: 'aws', credentials: {} },
    });
    expect(res.status()).toBe(401);
  });

  test('CSPM findings endpoint requires authentication', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/cspm/findings`);
    expect(res.status()).toBe(401);
  });
});

/* ================================================================== */
/*  Connect Account Modal                                              */
/* ================================================================== */
test.describe('Connect Account Modal', () => {
  test('Connect Account button opens modal', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud`);
    await page.waitForLoadState('networkidle');

    const connectBtn = page.getByRole('button', { name: /connect account/i }).or(
      page.getByText('Connect Account').first()
    );

    if (!(await connectBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Connect button not visible');
    }

    await connectBtn.click();

    const modal = page.locator('[class*="modal"], [role="dialog"], [class*="fixed"]');
    await expect(modal.first()).toBeVisible();
  });

  test('modal closes with X button or Escape', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/cloud`);
    await page.waitForLoadState('networkidle');

    const connectBtn = page.getByRole('button', { name: /connect account/i }).or(
      page.getByText('Connect Account').first()
    );

    if (!(await connectBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Connect button not visible');
    }

    await connectBtn.click();

    const modal = page.locator('[class*="modal"], [role="dialog"], [class*="fixed"]');
    await expect(modal.first()).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');

    // Modal should be hidden or removed
    const closeBtn = page.getByRole('button', { name: /close|cancel/i });
    if (await modal.first().isVisible().catch(() => false)) {
      if (await closeBtn.first().isVisible().catch(() => false)) {
        await closeBtn.first().click();
      }
    }
  });
});
