/**
 * Shared Auth Fixture for E2E Tests
 * Injects correct Zustand-persisted auth state into localStorage
 */

import { Page } from '@playwright/test';

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const defaultMockUser: MockUser = {
  id: 'test-1',
  email: 'test@questro.io',
  name: 'Test User',
  role: 'admin',
};

/**
 * Inject Zustand auth state into localStorage via addInitScript.
 * Must be called BEFORE page.goto() so the script runs on page load.
 * Also marks onboarding as completed to prevent the floating overlay
 * from blocking button clicks during tests.
 */
export async function mockAuth(page: Page, user: MockUser = defaultMockUser) {
  const authState = JSON.stringify({
    state: {
      user,
      isAuthenticated: true,
      ssoProvider: null,
    },
    version: 0,
  });

  await page.addInitScript((state: string) => {
    localStorage.setItem('qestro-auth', state);
    // Mark all onboarding tasks as completed so the guide shows as done
    localStorage.setItem('qestro_onboarding_tasks', JSON.stringify([
      { id: 'create_test_case', completed: true },
      { id: 'create_run', completed: true },
      { id: 'complete_run', completed: true },
      { id: 'generate_report', completed: true },
      { id: 'share_run', completed: true },
      { id: 'create_test_plan', completed: true },
      { id: 'add_plan_component', completed: true },
      { id: 'export_plan_pdf', completed: true },
      { id: 'share_test_plan', completed: true },
    ]));
  }, authState);

}

/**
 * Hide floating overlays (OnboardingGuide, ChatWidget) that block clicks.
 * Must be called AFTER page.goto() since addStyleTag requires a loaded page.
 */
export async function hideOverlays(page: Page) {
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

/**
 * Clear all auth state from localStorage.
 */
export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('qestro-auth');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.clear();
  });
}

/**
 * Check if the Zustand auth store considers the user authenticated.
 */
export async function isZustandAuthenticated(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('qestro-auth');
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.state?.isAuthenticated === true;
    } catch {
      return false;
    }
  });
}
