/**
 * Shared helpers for production E2E tests against https://qestro.app
 */

import { Browser, Page, BrowserContext, expect } from '@playwright/test';
import { testUsers } from '../../fixtures/test-users';
import { waitForNetworkIdle } from '../../utils/test-helpers';

const demoUser = testUsers.demoUser;

export const PROD_URL = 'https://qestro.app';
export const SIDEBAR_SEL = 'nav:has(a:has-text("Dashboard"))';
const ROUTE_BY_LINK_TEXT: Record<string, string> = {
  Dashboard: '/dashboard',
  'Test Cases': '/cases',
  'Test Runs': '/runs',
  'Test Plans': '/plans',
  Settings: '/settings',
  Billing: '/billing',
  Analytics: '/insights',
  'AI Center': '/ai-center',
  'API Studio': '/api-studio',
  'Cloud Devices': '/cloud-devices',
  'Mission Control': '/mission-control',
  'Service Virtualization': '/service-virtualization',
  'Recording Studio': '/recording-studio',
  'AI Recorder': '/ai-recorder',
  Explorations: '/explorations',
  'Test Gen': '/test-gen',
};

/**
 * Hide floating overlays (OnboardingGuide, ChatWidget) that block clicks.
 * Called after page load to prevent overlay interference in tests.
 */
async function hideOverlaysInternal(page: Page) {
  await page.addStyleTag({
    content: `
      .fixed.bottom-6.right-6.z-\\35 0,
      .fixed.bottom-4.right-4,
      [class*="z-50"][class*="fixed"][class*="bottom-"] {
        display: none !important;
      }
    `,
  });
}

export async function loginAsDemoUser(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${PROD_URL}/login`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  await page.locator('input[type="email"], input[name="email"]').fill(demoUser.email);
  await page.locator('input[type="password"], input[name="password"]').fill(demoUser.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 20000,
  });

  await waitForNetworkIdle(page);

  // Hide overlays (OnboardingGuide, ChatWidget) that can block button clicks
  await hideOverlaysInternal(page);

  return { context, page };
}

export async function navigateSidebar(
  page: Page,
  linkText: string,
  urlPattern: RegExp,
): Promise<void> {
  const sidebarLink = page.locator(`${SIDEBAR_SEL} a:has-text("${linkText}")`).first();
  const anyLink = page.getByRole('link', { name: new RegExp(linkText, 'i') }).first();

  if (await sidebarLink.isVisible().catch(() => false)) {
    await sidebarLink.click();
    await page.waitForURL(urlPattern, { timeout: 15000 });
  } else if (await anyLink.isVisible().catch(() => false)) {
    await anyLink.click();
    await page.waitForURL(urlPattern, { timeout: 15000 });
  } else {
    const fallbackPath = ROUTE_BY_LINK_TEXT[linkText];
    if (!fallbackPath) {
      throw new Error(`No sidebar link or direct-route fallback found for "${linkText}"`);
    }
    await navigateDirect(page, fallbackPath);
    await page.waitForURL(urlPattern, { timeout: 15000 });
  }

  await waitForNetworkIdle(page);
  // Re-apply overlay suppression after navigation (style tags reset on navigation)
  await hideOverlaysInternal(page);
}

export async function navigateDirect(
  page: Page,
  path: string,
): Promise<void> {
  await page.goto(`${PROD_URL}${path}`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  // Re-apply overlay suppression after navigation (style tags reset on navigation)
  await hideOverlaysInternal(page);
}

export async function assertButton(
  page: Page,
  text: string,
): Promise<void> {
  const btn = page.getByRole('button', { name: text });
  await expect(btn).toBeVisible({ timeout: 10000 });
  await expect(btn).toBeEnabled();
}

export async function assertHeading(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  const heading = page.getByRole('heading', { name: text }).first();
  await expect(heading).toBeVisible({ timeout: 10000 });
}

export async function assertReleaseGate(
  page: Page,
  feature: string,
): Promise<void> {
  const gate = page.locator('.mx-auto.max-w-4xl.rounded-3xl').first();
  await expect(
    page.getByRole('heading', {
      name: `${feature} is hidden in the current production release.`,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(gate.getByText('Qestro is shipping the real workflow first')).toBeVisible({
    timeout: 10000,
  });
  await expect(gate.getByRole('link', { name: 'Recording Studio' })).toBeVisible({
    timeout: 10000,
  });
  await expect(gate.getByRole('link', { name: 'Test Runs' })).toBeVisible({
    timeout: 10000,
  });
  await expect(gate.getByRole('link', { name: 'Test Cases' })).toBeVisible({
    timeout: 10000,
  });
}

export async function assertVisible(
  page: Page,
  locator: string,
): Promise<void> {
  await expect(page.locator(locator).first()).toBeVisible({ timeout: 10000 });
}
