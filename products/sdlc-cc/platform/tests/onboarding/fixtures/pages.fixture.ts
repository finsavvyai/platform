import { test as base } from '@playwright/test';
import { LandingPage } from '../pages/landing.page';
import { SignUpPage } from '../pages/sign-up.page';
import { SignInPage } from '../pages/sign-in.page';
import { DashboardPage } from '../pages/dashboard.page';
import { GettingStartedPage } from '../pages/getting-started.page';

/**
 * Page Object Model fixtures
 * Provides instantiated page objects for tests
 */

export const test = base.extend<{
  landingPage: LandingPage;
  signUpPage: SignUpPage;
  signInPage: SignInPage;
  dashboardPage: DashboardPage;
  gettingStartedPage: GettingStartedPage;
}>({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },

  signUpPage: async ({ page }, use) => {
    await use(new SignUpPage(page));
  },

  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  gettingStartedPage: async ({ page }, use) => {
    await use(new GettingStartedPage(page));
  },
});

export { expect } from '@playwright/test';
