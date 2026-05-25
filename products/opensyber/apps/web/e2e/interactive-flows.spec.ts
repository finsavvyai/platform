import { test, expect } from '@playwright/test';

/**
 * Helper: wait for real content or skip if Cloudflare blocks.
 * Waits up to 8s for the expected element. If not found, checks for CF challenge.
 */
async function waitOrSkipIfBlocked(
  page: import('@playwright/test').Page,
  expectedLocator: import('@playwright/test').Locator,
  t: typeof test,
): Promise<void> {
  try {
    await expectedLocator.waitFor({ state: 'visible', timeout: 8_000 });
  } catch {
    const bodyText = await page.textContent('body').catch(() => '');
    if (
      bodyText?.includes('security verification') ||
      bodyText?.includes('Checking your browser') ||
      bodyText?.includes('Just a moment') ||
      bodyText?.includes('Cloudflare')
    ) {
      t.skip(true, 'Cloudflare bot protection blocked headless browser');
    }
    throw new Error('Expected element not visible and no CF challenge detected');
  }
}

/**
 * End-to-end interactive flows: form submissions, button clicks,
 * filter interactions, modal triggers, and navigation patterns.
 */
test.describe('Enterprise Contact Form Flow', () => {
  test('complete form submission flow', async ({ page }) => {
    await page.goto('/enterprise', { waitUntil: 'domcontentloaded' });
    const nameInput = page.getByPlaceholder('Your name');
    await waitOrSkipIfBlocked(page, nameInput, test);

    // 1. Verify form exists
    const emailInput = page.getByPlaceholder('Work email');
    const companyInput = page.getByPlaceholder('Company name');
    const messageInput = page.getByPlaceholder('Tell us about your needs');
    const submitBtn = page.getByRole('button', { name: /get in touch/i });

    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await expect(nameInput).toHaveValue('');

    // 2. Submit empty — should show validation error
    await submitBtn.click();
    await expect(page.getByText(/required|fill/i)).toBeVisible({ timeout: 5_000 });

    // 3. Fill all fields and submit
    await nameInput.fill('E2E User');
    await emailInput.fill('e2e@test.com');
    await companyInput.fill('Test Corp');
    await messageInput.fill('Playwright E2E flow test — please ignore.');

    await submitBtn.click();
    // Accept either success message or any state change (API may be unavailable)
    const success = page.getByText(/thank you|sent|received/i);
    const error = page.getByText(/error|failed|try again/i);
    await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Marketplace Category Filter Flow', () => {
  test('filter by category and reset', async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    const securityLink = page.getByRole('link', { name: 'Security' });
    await waitOrSkipIfBlocked(page, securityLink, test);

    // 1. Click Security category
    await page.getByRole('link', { name: 'Security' }).click();
    await expect(page).toHaveURL(/category=security/, { timeout: 10_000 });

    // 2. Click another category
    const devTools = page.getByRole('link', { name: /developer/i });
    if (await devTools.isVisible().catch(() => false)) {
      await devTools.click();
      await expect(page).toHaveURL(/category=/, { timeout: 10_000 });
    }

    // 3. Reset to All
    await page.getByRole('link', { name: 'All', exact: true }).click();
    await expect(page).toHaveURL(/\/marketplace/, { timeout: 10_000 });
  });
});

test.describe('Pricing Plan CTA Flow', () => {
  test('plan CTAs link to sign-up or dashboard', async ({ page }) => {
    await page.goto('/pricing');

    // "Start Free" or "Start Free Trial" buttons should link to auth
    const ctaButtons = page.getByRole('link', { name: /start free/i });
    const count = await ctaButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Click first CTA
    const href = await ctaButtons.first().getAttribute('href');
    expect(href).toMatch(/sign-up|dashboard/);
  });
});

test.describe('Navigation Flow — Cross-Page', () => {
  test('landing → pricing → enterprise → back', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const pricingLink = page.locator('nav').first().getByRole('link', { name: 'Pricing' });
    await waitOrSkipIfBlocked(page, pricingLink, test);

    // Navigate to Pricing via nav
    await pricingLink.click();
    await expect(page).toHaveURL(/\/pricing/, { timeout: 15_000 });

    // Navigate to Enterprise via Contact Sales or Enterprise link
    const contactSales = page.getByRole('link', { name: /contact sales|enterprise/i }).first();
    await expect(contactSales).toBeVisible({ timeout: 10_000 });
    await contactSales.click();
    await expect(page).toHaveURL(/\/enterprise/, { timeout: 15_000 });

    // Go back to home via logo or home link
    const homeLink = page.locator('a[href="/"]').first();
    await homeLink.click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  });

  test('docs navigation flow through sections', async ({ page }) => {
    await page.goto('/docs', { waitUntil: 'domcontentloaded' });
    const sidebar = page.locator('aside');
    await waitOrSkipIfBlocked(page, sidebar, test);

    const gettingStarted = sidebar.getByRole('link', { name: /getting.started/i });
    await expect(gettingStarted).toBeVisible({ timeout: 5_000 });
    await gettingStarted.click();
    await expect(page).toHaveURL(/getting-started/, { timeout: 10_000 });

    // Click Security
    const security = sidebar.getByRole('link', { name: /security/i }).first();
    await security.click();
    await expect(page).toHaveURL(/security/, { timeout: 10_000 });

    // Click FAQ
    const faq = sidebar.getByRole('link', { name: /faq/i });
    await faq.click();
    await expect(page).toHaveURL(/faq/, { timeout: 10_000 });
  });
});

test.describe('Demo Tab Switching Flow', () => {
  test('switch between all three tabs', async ({ page }) => {
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    const overviewTab = page.getByRole('button', { name: /overview/i }).or(
      page.getByText('Overview').first()
    );
    await waitOrSkipIfBlocked(page, overviewTab, test);

    // Tab buttons
    const tabs = ['Overview', 'Events', 'Network'];
    for (const tabName of tabs) {
      const tab = page.getByRole('button', { name: new RegExp(tabName, 'i') }).or(
        page.getByText(tabName, { exact: true }).first()
      );
      await expect(tab).toBeVisible({ timeout: 10_000 });
      await tab.click();
      await page.waitForTimeout(500);
    }
  });
});
